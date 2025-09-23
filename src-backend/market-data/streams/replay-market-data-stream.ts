import { TimeframeAggregator } from '../../aggregation/timeframe-aggregator';
import type { Timeframe, SecondBar, TimeframeBar } from '../../core';
import type { MarketDataEvent, MarketDataEventState, MarketDataStream } from '../interfaces';

export class ReplayMarketDataStream implements MarketDataStream {
  private readonly aggregator: TimeframeAggregator;
  private readonly subscribers = new Set<(event: MarketDataEvent) => void>();
  private index = 0;
  private latestCompleted: TimeframeBar | null = null;
  private latestForming: TimeframeBar | null = null;

  constructor(private readonly seconds: SecondBar[], timeframe: Timeframe) {
    this.aggregator = new TimeframeAggregator(timeframe);
  }

  getTimeframe(): Timeframe {
    return this.aggregator.getTimeframe();
  }

  subscribe(handler: (event: MarketDataEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  next(): MarketDataEvent | null {
    if (this.index >= this.seconds.length) {
      return null;
    }

    const secondBar = this.seconds[this.index];
    if (!secondBar) {
      this.index = this.seconds.length;
      return null;
    }

    this.index += 1;
    const completed = this.aggregator.add(secondBar);

    let state: MarketDataEventState;
    let timeframeBar: TimeframeBar | null = completed ?? null;

    if (completed) {
      this.latestCompleted = completed;
      state = 'completed';
    } else {
      state = 'forming';
    }

    const partial = this.aggregator.getCurrentPartial();
    if (partial) {
      this.latestForming = partial;
      if (!timeframeBar) {
        timeframeBar = partial;
      }
    }

    if (!timeframeBar) {
      throw new Error('Timeframe aggregator yielded no bar');
    }

    const event: MarketDataEvent = {
      second: secondBar,
      timeframe: timeframeBar,
      state,
    };

    this.dispatch(event);
    return event;
  }

  getLastCompleted(): TimeframeBar | null {
    return this.latestCompleted;
  }

  getLastForming(): TimeframeBar | null {
    return this.latestForming;
  }

  private dispatch(event: MarketDataEvent): void {
    for (const handler of this.subscribers) {
      handler(event);
    }
  }
}
