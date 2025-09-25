import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { OrderBookService } from './orders/order-book.service';
import { TradeRecorderService } from './trading/trade-recorder.service';

@Module({
  imports: [],
  controllers: [BacktestController],
  providers: [BacktestService, OrderBookService, TradeRecorderService],
  exports: [BacktestService, OrderBookService, TradeRecorderService],
})
export class BacktestModule {}
