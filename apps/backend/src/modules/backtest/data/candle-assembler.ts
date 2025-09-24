import { MarketTick } from '../../shared/types/market';
import { OhlcvRecord, Timeframe } from '../../shared/types/ohlcv';
import {
  buildCandleFromSeed,
  getBucketStart,
  getTimeframeSeconds,
} from '../../shared/utils/aggregation.utils';

export interface CandleAssemblerOptions {
  /**
   * 是否在数据流结束时输出最后一个未闭合的K线。
   */
  includeFinalPartial?: boolean;
}

export class CandleAssembler {
  private readonly timeframeSeconds: number;
  private readonly options: CandleAssemblerOptions;

  private currentBucketStart: number | null = null;
  private currentCandle: OhlcvRecord | null = null;
  private closedCandles: OhlcvRecord[] = [];

  constructor(timeframe: Timeframe, options: CandleAssemblerOptions = {}) {
    const timeframeSeconds = getTimeframeSeconds(timeframe);
    if (!timeframeSeconds) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
    this.timeframeSeconds = timeframeSeconds;
    this.options = options;
  }

  accumulate(tick: MarketTick) {
    const epochSeconds = Math.floor(tick.timestamp / 1000);
    const bucketStart = getBucketStart(epochSeconds, this.timeframeSeconds);

    if (this.currentBucketStart === null) {
      this.startNewCandle(bucketStart, tick);
      return;
    }

    if (bucketStart !== this.currentBucketStart) {
      this.pushCurrentCandle();
      this.startNewCandle(bucketStart, tick);
      return;
    }

    this.updateCurrentCandle(tick);
  }

  /**
   * 是否存在已闭合的K线等待消费。
   */
  hasClosed(): boolean {
    return this.closedCandles.length > 0;
  }

  /**
   * 取出并清空所有已经闭合的K线。
   */
  consumeClosed(): OhlcvRecord[] {
    const candles = this.closedCandles;
    this.closedCandles = [];
    return candles;
  }

  /**
   * 获取当前正在构建的K线（未闭合）。
   */
  getCurrent(): OhlcvRecord | null {
    return this.currentCandle;
  }

  /**
   * 数据流结束时调用，返回最后一个未闭合的K线（根据配置决定是否包含）。
   */
  flush(): OhlcvRecord[] {
    if (this.currentCandle && this.options.includeFinalPartial) {
      const partial = this.currentCandle;
      this.currentCandle = null;
      this.currentBucketStart = null;
      return [...this.consumeClosed(), partial];
    }
    this.currentCandle = null;
    this.currentBucketStart = null;
    return this.consumeClosed();
  }

  private startNewCandle(bucketStart: number, tick: MarketTick) {
    this.currentBucketStart = bucketStart;
    this.currentCandle = buildCandleFromSeed(
      {
        open: tick.open,
        high: tick.high,
        low: tick.low,
        close: tick.close,
        volume: tick.volume,
      },
      bucketStart
    );
  }

  private pushCurrentCandle() {
    if (this.currentCandle) {
      this.closedCandles.push(this.currentCandle);
    }
    this.currentCandle = null;
    this.currentBucketStart = null;
  }

  private updateCurrentCandle(tick: MarketTick) {
    if (!this.currentCandle) {
      return;
    }

    this.currentCandle.high = Math.max(this.currentCandle.high, tick.high);
    this.currentCandle.low = Math.min(this.currentCandle.low, tick.low);
    this.currentCandle.close = tick.close;
    this.currentCandle.volume += tick.volume;
  }
}
