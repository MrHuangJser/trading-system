import { TimeframeAggregator } from '../aggregation';
import type { Timeframe } from '../lib/timeframe';
import type { SecondBar, TimeframeBar } from '../types';

export type ReplayTimeframeState = 'forming' | 'completed';

export interface ReplayFeedEvent {
  secondBar: SecondBar;
  timeframeBar: TimeframeBar;
  timeframeState: ReplayTimeframeState;
}

export type ReplayFeedHandler = (event: ReplayFeedEvent) => void;

/**
 * Replays second-level market data while aggregating into higher timeframes.
 */
export class ReplayDataFeed {
  private readonly aggregator: TimeframeAggregator;
  private readonly subscribers = new Set<ReplayFeedHandler>();
  private index = 0;
  private latestCompleted: TimeframeBar | null = null;
  private latestForming: TimeframeBar | null = null;

  constructor(private readonly seconds: SecondBar[], timeframe: Timeframe) {
    this.aggregator = new TimeframeAggregator(timeframe);
  }

  subscribe(handler: ReplayFeedHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  next(): ReplayFeedEvent | null {
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

    let timeframeState: ReplayTimeframeState;
    let timeframeBar: TimeframeBar | null = completed ?? null;

    if (completed) {
      this.latestCompleted = completed;
      timeframeState = 'completed';
    } else {
      timeframeState = 'forming';
    }

    const current = this.aggregator.getCurrentPartial();
    if (current) {
      this.latestForming = current;
      if (!timeframeBar) {
        timeframeBar = current;
      }
    }

    if (!timeframeBar) {
      throw new Error('Timeframe aggregator did not yield a bar');
    }

    const event: ReplayFeedEvent = {
      secondBar,
      timeframeBar,
      timeframeState,
    };

    this.dispatch(event);

    return event;
  }

  getLastCompletedBar(): TimeframeBar | null {
    return this.latestCompleted;
  }

  getLastFormingBar(): TimeframeBar | null {
    return this.latestForming;
  }

  private dispatch(event: ReplayFeedEvent): void {
    for (const handler of this.subscribers) {
      handler(event);
    }
  }
}
