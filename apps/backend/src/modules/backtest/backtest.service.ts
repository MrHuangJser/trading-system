import { Injectable } from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';
import { OrderBookService } from './orders/order-book.service';
import { TradeRecorderService } from './trading/trade-recorder.service';

@Injectable()
export class BacktestService {
  constructor(
    private readonly orderBook: OrderBookService,
    private readonly tradeRecorder: TradeRecorderService
  ) {}

  async run(dto: RunBacktestBodyDto) {
    this.orderBook.reset();
    this.tradeRecorder.reset();
    throw new Error(`Backtest runner not implemented for ${dto.strategyName}`);
  }
}
