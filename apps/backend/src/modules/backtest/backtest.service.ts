import { Injectable } from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';
import { OrderBookService } from './orders/order-book.service';
import {
  OrderPlacementContext,
  OrderSnapshot,
  SubmitOrderInput,
  SubmitOrderResult,
} from './orders/order.types';

@Injectable()
export class BacktestService {
  constructor(private readonly orderBookService: OrderBookService) {}

  async run(dto: RunBacktestBodyDto) {
    this.orderBookService.reset();
    // TODO: implement full backtest pipeline
    throw new Error(`Backtest runner not implemented for ${dto.strategyName}`);
  }

  submitOrder(
    input: SubmitOrderInput,
    context?: OrderPlacementContext
  ): SubmitOrderResult {
    return this.orderBookService.submitOrder(input, context);
  }

  cancelOrder(orderId: string): OrderSnapshot | null {
    return this.orderBookService.cancelOrder(orderId);
  }

  getOpenOrders(symbol?: string): OrderSnapshot[] {
    return this.orderBookService.getOpenOrders(symbol);
  }
}
