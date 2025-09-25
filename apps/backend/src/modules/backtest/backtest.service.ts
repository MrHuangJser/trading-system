import { Injectable } from '@nestjs/common';
import path from 'path';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';
import { OrderBookService } from './orders/order-book.service';
import { TradeRecorderService } from './trading/trade-recorder.service';
import { AggregationService } from '../shared/services/aggregation.service';
import { StrategyRegistryService } from './strategies/strategy-registry.service';
import { StrategyContextImpl } from './strategies/strategy-context';
import { CandleAssembler } from './data/candle-assembler';
import { BacktestClock } from './data/backtest-clock';
import { MarketTick } from '../shared/types/market';
import { Timeframe } from '../shared/types/ohlcv';

@Injectable()
export class BacktestService {
  constructor(
    private readonly orderBook: OrderBookService,
    private readonly tradeRecorder: TradeRecorderService,
    private readonly aggregationService: AggregationService,
    private readonly strategyRegistry: StrategyRegistryService
  ) {}

  async run(dto: RunBacktestBodyDto) {
    this.orderBook.reset();
    this.tradeRecorder.reset();

    const strategyEntry = this.strategyRegistry.getStrategy(dto.strategyName);
    if (!strategyEntry) {
      throw new Error(`未找到策略 ${dto.strategyName}`);
    }

    if (!strategyEntry.supportedTimeframes.includes(dto.timeframe)) {
      throw new Error(
        `策略 ${dto.strategyName} 仅支持时间周期 ${strategyEntry.supportedTimeframes.join(', ')}`
      );
    }

    const strategy = this.strategyRegistry.createStrategy(
      dto.strategyName,
      dto.strategyParams ?? {}
    );

    const symbol = this.deriveSymbol(dto.datasetFileName);
    const ticks = await this.loadTicks(dto.datasetFileName, dto.timeframe, symbol);

    const context = new StrategyContextImpl(
      symbol,
      dto.timeframe,
      this.orderBook,
      this.tradeRecorder
    );

    await strategy.onInit?.(context);

    const assembler = new CandleAssembler(dto.timeframe, {
      includeFinalPartial: true,
    });
    const clock = new BacktestClock(assembler, {
      includeFinalPartial: true,
    });

    clock.onTick((tick) => {
      context.setCurrentTick(tick);
      const filledOrders = this.orderBook.handleTick(tick);
      filledOrders.forEach((order) => this.tradeRecorder.recordFill(order));
    });

    clock.onCandle((candle) => {
      context.setCurrentCandle(candle);
      return strategy.onCandle(candle, context);
    });

    clock.onComplete(() => strategy.onComplete?.(context));

    await clock.run(ticks);

    context.setCurrentTick(null);
    context.setCurrentCandle(null);

    return {
      strategy: dto.strategyName,
      timeframe: dto.timeframe,
      symbol,
      summary: this.tradeRecorder.getSummary(),
      closedTrades: this.tradeRecorder.getClosedTrades(),
      fills: this.tradeRecorder.getFills(),
      openPositions: this.tradeRecorder.getOpenPositions(),
      remainingOrders: this.orderBook.getOpenOrders(),
    };
  }

  private async loadTicks(
    datasetFileName: string,
    timeframe: Timeframe,
    symbol: string
  ) {
    const filePath = path.join(
      process.cwd(),
      'storage',
      'dataset',
      datasetFileName
    );
    const candles = await this.aggregationService.aggregate(filePath, timeframe);
    return candles.map((candle) => this.toMarketTick(candle, symbol));
  }

  private toMarketTick(
    candle: {
      datetime: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    },
    symbol: string
  ): MarketTick {
    return {
      timestamp: new Date(candle.datetime).getTime(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      symbol,
    };
  }

  private deriveSymbol(datasetFileName: string): string {
    const baseName = path.basename(datasetFileName);
    const ext = path.extname(baseName);
    return (ext ? baseName.replace(ext, '') : baseName) || 'UNKNOWN';
  }
}
