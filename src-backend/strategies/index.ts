import type { BacktestMetadata, CandleExportRow, StrategyConfig, TradeRecord } from '../core';
import type { MarketDataEvent } from '../market-data';

export interface StrategyResult<Summary> {
  summary: Summary;
  trades: TradeRecord[];
  candles?: CandleExportRow[];
  metadata: BacktestMetadata;
}

export interface StrategyController<Summary> {
  onSecond(event: MarketDataEvent): void;
  onTimeframe(event: MarketDataEvent): void;
  finalize(): StrategyResult<Summary>;
}

export interface StrategyRuntimeFactory<Summary> {
  create(options: { config: StrategyConfig }): StrategyController<Summary>;
}

export * from './mother-bar';
