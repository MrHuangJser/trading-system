import type { BacktestReport, CandleExportRow } from '../core';
import type { BacktestSummary, StrategyConfig, TradeRecord } from '../core';
import type { MarketDataSource } from '../market-data';
import type { StrategyRuntimeFactory } from '../strategies';

export interface BacktestEngineOptions {
  secondLimit?: number | null;
}

export class BacktestEngine {
  constructor(
    private readonly config: StrategyConfig,
    private readonly dataSource: MarketDataSource,
    private readonly strategyFactory: StrategyRuntimeFactory<BacktestSummary>,
  ) {}

  async run(options: BacktestEngineOptions = {}): Promise<BacktestReport<BacktestSummary, CandleExportRow, TradeRecord>> {
    const stream = await this.dataSource.openStream(this.config.timeframe);
    const controller = this.strategyFactory.create({ config: this.config });

    let consumedSeconds = 0;
    const limit = options.secondLimit ?? null;

    for (;;) {
      const event = stream.next();
      if (!event) {
        break;
      }

      controller.onSecond(event);
      if (event.state === 'completed') {
        controller.onTimeframe(event);
      }

      consumedSeconds += 1;
      if (limit && consumedSeconds >= limit) {
        break;
      }
    }

    const result = controller.finalize();
    const metadata = {
      ...result.metadata,
      secondLimit: limit,
    };

    return {
      metadata,
      summary: result.summary,
      candles: result.candles ?? [],
      trades: result.trades,
    } satisfies BacktestReport<BacktestSummary, CandleExportRow, TradeRecord>;
  }
}
