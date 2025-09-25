import type { OhlcvRecord, Timeframe } from '../../shared/types/ohlcv';
import type { StrategyContext } from '../strategies/strategy-context';

export interface StrategyInstance {
  onInit?(context: StrategyContext): Promise<void> | void;
  onCandle(candle: OhlcvRecord, context: StrategyContext): Promise<void> | void;
  onComplete?(context: StrategyContext): Promise<void> | void;
}

export interface StrategyDefinition<Params = Record<string, unknown>> {
  name: string;
  description: string;
  supportedTimeframes: Timeframe[];
  paramsSchema?: Record<string, unknown>;
  create(params: Params): StrategyInstance;
}

export interface StrategyListItem {
  name: string;
  description: string;
  supportedTimeframes: Timeframe[];
  paramsSchema?: Record<string, unknown>;
}
