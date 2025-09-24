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
  async aggregate(sourceFilePath: string, timeframe: Timeframe) {
    // 使用流式读取csv文件
    const fileStream = fs.createReadStream(sourceFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    let first = false;
    rl.on('line', (line) => {
      if (!first) {
        first = true;
        return;
      }
      const [timestamp, open, high, low, close, volume] = line.split(',');
      console.log(timestamp, open, high, low, close, volume);
      if (timestamp) {
      }
    });
  }
}
