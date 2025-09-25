import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { OrderBookService } from './orders/order-book.service';
import { TradeRecorderService } from './trading/trade-recorder.service';
import { StrategyRegistryService } from './strategies/strategy-registry.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [BacktestController],
  providers: [
    BacktestService,
    OrderBookService,
    TradeRecorderService,
    StrategyRegistryService,
  ],
  exports: [BacktestService],
})
export class BacktestModule {}
