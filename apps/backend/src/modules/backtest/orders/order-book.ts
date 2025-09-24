import { randomUUID } from 'crypto';
import { MarketTick } from '../../shared/types/market';
import {
  OrderFill,
  OrderRequest,
  OrderSide,
  OrderSnapshot,
  OrderStatus,
  OrderType,
} from './order.types';

interface ManagedOrder {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  quantity: number;
  price?: number;
  stopPrice?: number;
  createdAt: number;
  updatedAt: number;
  fills: OrderFill[];
  clientOrderId?: string;
}

export class OrderBook {
  private readonly openOrders = new Map<string, ManagedOrder>();
  private readonly history = new Map<string, ManagedOrder>();

  submit(request: OrderRequest, now: number = Date.now()): OrderSnapshot {
    this.validateRequest(request);
    const order: ManagedOrder = {
      id: randomUUID(),
      symbol: request.symbol,
      type: request.type,
      side: request.side,
      status: OrderStatus.NEW,
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      createdAt: now,
      updatedAt: now,
      fills: [],
      clientOrderId: request.clientOrderId,
    };

    if (order.type === OrderType.MARKET) {
      order.status = OrderStatus.PENDING;
    }

    if (
      order.type === OrderType.LIMIT ||
      order.type === OrderType.STOP_MARKET
    ) {
      order.status = OrderStatus.PENDING;
    }

    this.openOrders.set(order.id, order);
    return this.toSnapshot(order);
  }

  cancel(orderId: string) {
    const order = this.openOrders.get(orderId);
    if (!order) {
      return null;
    }
    order.status = OrderStatus.CANCELED;
    order.updatedAt = Date.now();
    this.finalize(order);
    return this.toSnapshot(order);
  }

  handleTick(tick: MarketTick): OrderSnapshot[] {
    const filled: OrderSnapshot[] = [];
    this.openOrders.forEach((order) => {
      if (
        order.status === OrderStatus.CANCELED ||
        order.status === OrderStatus.FILLED
      ) {
        return;
      }

      if (order.type === OrderType.MARKET) {
        this.fillOrder(order, tick.open, tick.timestamp);
        filled.push(this.toSnapshot(order));
        this.finalize(order);
        return;
      }

      if (order.type === OrderType.LIMIT) {
        const reachable = order.price ?? 0;
        const shouldFill =
          (order.side === OrderSide.BUY && tick.low <= reachable) ||
          (order.side === OrderSide.SELL && tick.high >= reachable);
        if (shouldFill && order.price !== undefined) {
          const fillPrice = order.price;
          this.fillOrder(order, fillPrice, tick.timestamp);
          filled.push(this.toSnapshot(order));
          this.finalize(order);
        }
        return;
      }

      if (order.type === OrderType.STOP_MARKET) {
        const triggerPrice = order.stopPrice;
        const triggered =
          triggerPrice !== undefined &&
          ((order.side === OrderSide.BUY && tick.high >= triggerPrice) ||
            (order.side === OrderSide.SELL && tick.low <= triggerPrice));
        if (triggered) {
          const fillPrice =
            order.side === OrderSide.BUY
              ? Math.max(tick.open, triggerPrice)
              : Math.min(tick.open, triggerPrice);
          this.fillOrder(order, fillPrice, tick.timestamp);
          filled.push(this.toSnapshot(order));
          this.finalize(order);
        }
      }
    });

    return filled;
  }

  getOpenOrders() {
    return Array.from(this.openOrders.values()).map((order) =>
      this.toSnapshot(order)
    );
  }

  getOrder(orderId: string) {
    const order = this.openOrders.get(orderId) ?? this.history.get(orderId);
    return order ? this.toSnapshot(order) : null;
  }

  private fillOrder(order: ManagedOrder, price: number, timestamp: number) {
    if (order.status === OrderStatus.FILLED) {
      return;
    }
    order.status = OrderStatus.FILLED;
    order.updatedAt = timestamp;
    order.fills.push({
      orderId: order.id,
      price,
      quantity: order.quantity,
      timestamp,
    });
  }

  private finalize(order: ManagedOrder) {
    this.openOrders.delete(order.id);
    this.history.set(order.id, order);
  }

  private validateRequest(request: OrderRequest) {
    if (!request.symbol) {
      throw new Error('Order symbol is required');
    }
    if (!Number.isFinite(request.quantity) || request.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (request.type === OrderType.LIMIT) {
      if (!Number.isFinite(request.price ?? NaN)) {
        throw new Error('Limit order requires a valid price');
      }
    }

    if (request.type === OrderType.STOP_MARKET) {
      if (!Number.isFinite(request.stopPrice ?? NaN)) {
        throw new Error('Stop market order requires stopPrice');
      }
    }
  }

  private toSnapshot(order: ManagedOrder): OrderSnapshot {
    return {
      id: order.id,
      symbol: order.symbol,
      type: order.type,
      side: order.side,
      status: order.status,
      quantity: order.quantity,
      price: order.price,
      stopPrice: order.stopPrice,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      fills: [...order.fills],
      clientOrderId: order.clientOrderId,
    };
  }
}
