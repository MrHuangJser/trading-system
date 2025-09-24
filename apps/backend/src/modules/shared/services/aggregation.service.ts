import { Injectable } from '@nestjs/common';
import fs from 'fs';
import readline from 'readline';

export enum Timeframe {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
}

@Injectable()
export class AggregationService {
  /**
   * 根据提供的秒级OHLCV数据，生成指定时间周期的OHLCV数据
   * @param sourceFilePath 源csv文件路径
   * @param timeframe
   */
  async aggregate(
    sourceFilePath: string,
    timeframe: Timeframe
  ): Promise<OhlcvRecord[]> {
    const timeframeSeconds = this.getTimeframeSeconds(timeframe);
    if (!timeframeSeconds) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    const results: OhlcvRecord[] = [];
    const fileStream = fs.createReadStream(sourceFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isHeader = true;
    let currentBucketStart: number | null = null;
    let currentBucket: OhlcvRecord | null = null;

    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (isHeader) {
        isHeader = false;
        continue;
      }

      const parts = line.split(',');
      if (parts.length < 6) {
        continue;
      }

      const [timestamp, openStr, highStr, lowStr, closeStr, volumeStr] = parts;
      const open = Number(openStr);
      const high = Number(highStr);
      const low = Number(lowStr);
      const close = Number(closeStr);
      const volume = Number(volumeStr);

      if (
        [open, high, low, close, volume].some((value) => Number.isNaN(value))
      ) {
        continue;
      }

      const epochSeconds = this.getEpochSeconds(timestamp);
      if (Number.isNaN(epochSeconds)) {
        continue;
      }

      const bucketStart = epochSeconds - (epochSeconds % timeframeSeconds);

      if (currentBucketStart === null || bucketStart !== currentBucketStart) {
        if (currentBucket) {
          results.push(currentBucket);
        }

        currentBucketStart = bucketStart;
        currentBucket = {
          datetime: this.formatTimestamp(bucketStart),
          open,
          high,
          low,
          close,
          volume,
        };
        continue;
      }
      if (currentBucket) {
        currentBucket.high = Math.max(currentBucket.high, high);
        currentBucket.low = Math.min(currentBucket.low, low);
        currentBucket.close = close;
        currentBucket.volume += volume;
      }
    }

    rl.close();

    if (currentBucket) {
      results.push(currentBucket);
    }

    return results;
  }

  private getTimeframeSeconds(timeframe: Timeframe) {
    const timeframeSecondsMap: Record<Timeframe, number> = {
      [Timeframe.ONE_MINUTE]: 60,
      [Timeframe.FIVE_MINUTES]: 5 * 60,
      [Timeframe.FIFTEEN_MINUTES]: 15 * 60,
      [Timeframe.THIRTY_MINUTES]: 30 * 60,
      [Timeframe.ONE_HOUR]: 60 * 60,
    };

    return timeframeSecondsMap[timeframe];
  }

  private getEpochSeconds(timestamp: string) {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }

  private formatTimestamp(epochSeconds: number) {
    const date = new Date(epochSeconds * 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

export interface OhlcvRecord {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
