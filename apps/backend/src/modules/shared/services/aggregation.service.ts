import { Injectable } from '@nestjs/common';
import fs from 'fs';
import readline from 'readline';
import { Timeframe, OhlcvRecord } from '../types/ohlcv';
import {
  buildCandleFromSeed,
  getBucketStart,
  getTimeframeSeconds,
} from '../utils/aggregation.utils';

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
    const timeframeSeconds = getTimeframeSeconds(timeframe);
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

      const bucketStart = getBucketStart(epochSeconds, timeframeSeconds);

      if (currentBucketStart === null || bucketStart !== currentBucketStart) {
        if (currentBucket) {
          results.push(currentBucket);
        }

        currentBucketStart = bucketStart;
        currentBucket = buildCandleFromSeed(
          { open, high, low, close, volume },
          bucketStart
        );
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

  private getEpochSeconds(timestamp: string) {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }
}
