import { CandleAssembler } from './candle-assembler';
import { MarketTick } from '../../shared/types/market';
import { OhlcvRecord } from '../../shared/types/ohlcv';

export type TickListener = (tick: MarketTick) => void | Promise<void>;
export type CandleListener = (candle: OhlcvRecord) => void | Promise<void>;
export type CompleteListener = () => void | Promise<void>;

export interface BacktestClockOptions {
  /**
   * 是否输出数据流结束时的未闭合K线。
   */
  includeFinalPartial?: boolean;
}

export class BacktestClock {
  private readonly tickListeners: TickListener[] = [];
  private readonly candleListeners: CandleListener[] = [];
  private readonly completeListeners: CompleteListener[] = [];

  private currentTick: MarketTick | null = null;

  constructor(
    private readonly assembler: CandleAssembler,
    private readonly options: BacktestClockOptions = {}
  ) {}

  onTick(listener: TickListener) {
    this.tickListeners.push(listener);
    return this;
  }

  onCandle(listener: CandleListener) {
    this.candleListeners.push(listener);
    return this;
  }

  onComplete(listener: CompleteListener) {
    this.completeListeners.push(listener);
    return this;
  }

  getCurrentTick(): MarketTick | null {
    return this.currentTick;
  }

  async run(stream: AsyncIterable<MarketTick> | Iterable<MarketTick>) {
    for await (const tick of toAsyncIterable(stream)) {
      this.currentTick = tick;
      this.assembler.accumulate(tick);
      await this.emitClosedCandles();
      await this.emitTick(tick);
    }

    const tail = this.assembler.flush();
    if (tail.length > 0 && this.options.includeFinalPartial) {
      await this.emitCandles(tail);
    } else {
      // flush 已经清空了闭合K线，这里只需处理可能遗留的闭合结果
      await this.emitClosedCandles();
    }

    await this.emitComplete();
    this.currentTick = null;
  }

  private async emitTick(tick: MarketTick) {
    for (const listener of this.tickListeners) {
      await listener(tick);
    }
  }

  private async emitClosedCandles() {
    if (!this.assembler.hasClosed()) {
      return;
    }
    const candles = this.assembler.consumeClosed();
    await this.emitCandles(candles);
  }

  private async emitCandles(candles: OhlcvRecord[]) {
    for (const candle of candles) {
      for (const listener of this.candleListeners) {
        await listener(candle);
      }
    }
  }

  private async emitComplete() {
    for (const listener of this.completeListeners) {
      await listener();
    }
  }
}

async function* toAsyncIterable<T>(input: AsyncIterable<T> | Iterable<T>) {
  if (isAsyncIterable<T>(input)) {
    for await (const item of input) {
      yield item;
    }
    return;
  }

  for (const item of input as Iterable<T>) {
    yield item;
  }
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return value != null && typeof (value as any)[Symbol.asyncIterator] === 'function';
}
