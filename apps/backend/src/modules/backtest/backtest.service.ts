import { Injectable } from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';
import { OrderBookService } from './orders/order-book.service';

@Injectable()
export class BacktestService {
  constructor(private readonly orderBookService: OrderBookService) {}

  async run(dto: RunBacktestBodyDto) {}
}
