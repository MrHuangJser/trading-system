import { StrategyEngine } from './strategy';
import type { BacktestResult, SecondBar, StrategyConfig } from './types';
import { buildMinuteCandles } from './lib/candles';

interface RunOptions {
  secondLimit?: number | null;
}

export function runBacktest(
  seconds: SecondBar[],
  config: StrategyConfig,
  options: RunOptions = {},
): BacktestResult {
  const { secondLimit = null } = options;
  const dataset = secondLimit ? seconds.slice(0, secondLimit) : seconds;

  const candles = buildMinuteCandles(dataset);

  const summary = StrategyEngine.run(dataset, config);

  return {
    candles,
    summary,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataFile: config.dataFile,
      baseQuantity: config.baseQuantity,
      contractMultiplier: config.contractMultiplier,
      resolution: config.timeframe,
      candles: candles.length,
      trades: summary.totalTrades,
      seconds: dataset.length,
      secondLimit,
    },
  };
}
