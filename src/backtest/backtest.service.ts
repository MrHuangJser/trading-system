import { Injectable } from '@nestjs/common';
import { DataService } from '../data/data.service';
import { runBacktest } from '../backtest';
import type { StrategyConfig } from '../types';
import type { BacktestRequestDto } from './dto/backtest-request.dto';

/**
 * Executes strategy backtests based on request parameters.
 */
@Injectable()
export class BacktestService {
  constructor(private readonly dataService: DataService) {}

  runBacktest(request: BacktestRequestDto) {
    const baseConfig = this.dataService.getBaseConfig();
    const strategyConfig: StrategyConfig = {
      ...baseConfig,
      baseQuantity: request.baseQuantity ?? baseConfig.baseQuantity,
      contractMultiplier: request.contractMultiplier ?? baseConfig.contractMultiplier,
      enableLongEntry: request.enableLongEntry ?? baseConfig.enableLongEntry,
      enableLongTakeProfit: request.enableLongTakeProfit ?? baseConfig.enableLongTakeProfit,
      enableShortEntry: request.enableShortEntry ?? baseConfig.enableShortEntry,
      enableShortTakeProfit: request.enableShortTakeProfit ?? baseConfig.enableShortTakeProfit,
    };

    const seconds = this.dataService.getSeconds();
    const result = runBacktest(seconds, strategyConfig, {
      secondLimit: request.seconds ?? null,
    });

    return {
      metadata: result.metadata,
      summary: result.summary,
      candles: result.candles,
      trades: result.summary.trades,
    };
  }
}
