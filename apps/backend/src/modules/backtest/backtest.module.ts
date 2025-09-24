import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { OrderBookService } from './orders/order-book.service';

@Module({
  imports: [],
  controllers: [BacktestController],
  providers: [BacktestService, OrderBookService],
  exports: [BacktestService, OrderBookService],
})
export class BacktestModule {}
