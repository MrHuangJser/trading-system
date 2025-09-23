import { describe, expect, test } from 'bun:test';
import type { MarketDataEvent, MarketDataSource, MarketDataStream } from '../../../src-backend/market-data';
import { ReplayMarketDataStream } from '../../../src-backend/market-data';
import type { BacktestMetadata, BacktestSummary, SecondBar, StrategyConfig, Timeframe } from '../../../src-backend/core';
import { BacktestEngine } from '../../../src-backend/backtest';
import type { StrategyController, StrategyRuntimeFactory } from '../../../src-backend/strategies';
import { makeSecond } from '../_support/helpers';

class StubController implements StrategyController<BacktestSummary> {
  private secondsProcessed = 0;
  private lastEvent: MarketDataEvent | null = null;

  constructor(private readonly config: StrategyConfig) {}

  onSecond(event: MarketDataEvent): void {
    this.secondsProcessed += 1;
    this.lastEvent = event;
  }

  onTimeframe(_event: MarketDataEvent): void {
    // no-op for stub
  }

  finalize() {
    const summary: BacktestSummary = {
      trades: [],
      totalTrades: this.secondsProcessed,
      winningTrades: 0,
      losingTrades: 0,
      netPnlPoints: 0,
      netPnlCurrency: 0,
      grossProfitPoints: 0,
      grossLossPoints: 0,
    } satisfies BacktestSummary;

    const metadata: BacktestMetadata = {
      generatedAt: new Date().toISOString(),
      dataFile: this.config.dataFile,
      baseQuantity: this.config.baseQuantity,
      contractMultiplier: this.config.contractMultiplier,
      resolution: this.config.timeframe,
      candles: 0,
      trades: 0,
      seconds: this.secondsProcessed,
      secondLimit: null,
    } satisfies BacktestMetadata;

    return {
      summary,
      trades: [],
      candles: [],
      metadata,
    };
  }
}

class StubFactory implements StrategyRuntimeFactory<BacktestSummary> {
  create(options: { config: StrategyConfig }): StrategyController<BacktestSummary> {
    return new StubController(options.config);
  }
}

class MemorySource implements MarketDataSource {
  constructor(private readonly seconds: SecondBar[]) {}

  async openStream(timeframe: Timeframe): Promise<MarketDataStream> {
    return new ReplayMarketDataStream(this.seconds, timeframe);
  }
}

describe('backtest/BacktestEngine', () => {
  test('runs controller pipeline and applies secondLimit metadata', async () => {
    const seconds = [
      makeSecond('2023-09-15 08:30:00', { open: 100, high: 101, low: 99.5, close: 100.5 }),
      makeSecond('2023-09-15 08:30:01', { open: 100.5, high: 101.5, low: 100, close: 101 }),
      makeSecond('2023-09-15 08:30:02', { open: 101, high: 101.2, low: 100.8, close: 101.1 }),
      makeSecond('2023-09-15 08:30:03', { open: 101.1, high: 101.4, low: 100.9, close: 101.2 }),
    ];

    const config: StrategyConfig = {
      contractMultiplier: 5,
      baseQuantity: 1,
      dataFile: 'synthetic.csv',
      enableLongEntry: true,
      enableLongTakeProfit: true,
      enableShortEntry: true,
      enableShortTakeProfit: true,
      timeframe: '1m',
    };

    const factory = new StubFactory();
    const engine = new BacktestEngine(config, new MemorySource(seconds), factory);

    const report = await engine.run({ secondLimit: 3 });

    expect(report.metadata.secondLimit).toBe(3);
    expect(report.summary.totalTrades).toBe(3);
    expect(report.metadata.seconds).toBe(3);
    expect(report.metadata.dataFile).toBe('synthetic.csv');
  });
});
