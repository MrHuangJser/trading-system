import type { SecondBar, TimeframeBar, Timeframe } from '../core';

export type MarketDataEventState = 'forming' | 'completed';

export interface MarketDataEvent {
  second: SecondBar;
  timeframe: TimeframeBar;
  state: MarketDataEventState;
}

export interface MarketDataStream {
  getTimeframe(): Timeframe;
  subscribe(handler: (event: MarketDataEvent) => void): () => void;
  next(): MarketDataEvent | null;
  getLastCompleted(): TimeframeBar | null;
  getLastForming(): TimeframeBar | null;
}

export interface MarketDataSource {
  openStream(timeframe: Timeframe): Promise<MarketDataStream>;
}
