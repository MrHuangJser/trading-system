import type { BacktestSummary, StrategyConfig } from '../../core';
import type { StrategyRuntimeFactory, StrategyController } from '..';
import { MotherBarStrategyController } from './strategy-controller';

export function createMotherBarStrategyFactory(): StrategyRuntimeFactory<BacktestSummary> {
  return {
    create(options: { config: StrategyConfig }): StrategyController<BacktestSummary> {
      return new MotherBarStrategyController({ config: options.config });
    },
  } satisfies StrategyRuntimeFactory<BacktestSummary>;
}

export { MotherBarStrategyController } from './strategy-controller';
export { MotherBarDetector } from './detector';
export type { MotherBarState } from './types';
