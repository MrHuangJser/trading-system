import { Injectable, NotFoundException } from '@nestjs/common';
import { DataService } from '../data/data.service';
import { runBacktest } from '../backtest';
import type { Timeframe } from '../lib/timeframe';
import type { SecondBar, StrategyConfig } from '../types';
import type { BacktestRequestDto } from './dto/backtest-request.dto';

/**
 * Executes strategy backtests based on request parameters.
 */
@Injectable()
export class BacktestService {
  constructor(private readonly dataService: DataService) {}

  async runBacktest(request: BacktestRequestDto) {
    const baseConfig = this.dataService.getBaseConfig();
    const timeframe = request.timeframe ?? baseConfig.timeframe;

    let seconds: SecondBar[];
    let dataFile = baseConfig.dataFile;

    if (request.datasetId) {
      const dataset = this.dataService.getDataset(request.datasetId);
      if (!dataset) {
        throw new NotFoundException('Dataset not found');
      }
      seconds = await this.dataService.loadSeconds(dataset.id);
      dataFile = this.dataService.resolveDatasetFilePath(dataset);
    } else if (request.dataFile) {
      seconds = await this.dataService.loadSecondsFromFile(request.dataFile);
      dataFile = this.dataService.resolveDataFilePath(request.dataFile);
    } else {
      seconds = await this.dataService.getSeconds();
    }

    const strategyConfig: StrategyConfig = {
      ...baseConfig,
      baseQuantity: request.baseQuantity ?? baseConfig.baseQuantity,
      contractMultiplier: request.contractMultiplier ?? baseConfig.contractMultiplier,
      enableLongEntry: request.enableLongEntry ?? baseConfig.enableLongEntry,
      enableLongTakeProfit: request.enableLongTakeProfit ?? baseConfig.enableLongTakeProfit,
      enableShortEntry: request.enableShortEntry ?? baseConfig.enableShortEntry,
      enableShortTakeProfit: request.enableShortTakeProfit ?? baseConfig.enableShortTakeProfit,
      timeframe,
      dataFile,
    };

    const result = runBacktest(seconds, strategyConfig, {
      secondLimit: request.seconds ?? null,
      timeframe,
    });

    return {
      metadata: result.metadata,
      summary: result.summary,
      candles: result.candles,
      trades: result.summary.trades,
    };
  }

  getDefaultTimeframe(): Timeframe {
    return this.dataService.getBaseConfig().timeframe;
  }
}
