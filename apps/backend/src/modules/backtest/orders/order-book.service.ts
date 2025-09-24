import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  LiquidityRole,
  MarketTick,
  OrderEvent,
  OrderPlacementContext,
  OrderSide,
  OrderSnapshot,
  OrderStatus,
  OrderType,
  SubmitOrderInput,
  SubmitOrderResult,
  TimeInForce,
} from './order.types';

interface ManagedOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  remainingQuantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  reduceOnly: boolean;
  clientOrderId?: string;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  expireAt?: number;
  metadata?: Record<string, unknown>;
  fills: {
    fillId: string;
    price: number;
    quantity: number;
    timestamp: number;
    liquidity: LiquidityRole;
    fee?: number;
  }[];
}

@Injectable()
export class OrderBookService {
  private readonly openOrders = new Map<string, ManagedOrder>();
  private readonly archivedOrders = new Map<string, ManagedOrder>();

  reset() {
    this.openOrders.clear();
    this.archivedOrders.clear();
  }

  submitOrder(
    input: SubmitOrderInput,
    context: OrderPlacementContext = {}
  ): SubmitOrderResult {
    this.assertQuantity(input.quantity);
    this.assertPriceFields(input);

    const now = context.timestamp ?? Date.now();
    const orderId = randomUUID();
    const order: ManagedOrder = {
      id: orderId,
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      status: OrderStatus.NEW,
      quantity: input.quantity,
      remainingQuantity: input.quantity,
      price: input.price,
      stopPrice: input.stopPrice,
      timeInForce: input.timeInForce ?? TimeInForce.GTC,
      reduceOnly: Boolean(input.reduceOnly),
      clientOrderId: input.clientOrderId,
      createdAt: now,
      updatedAt: now,
      expireAt: input.expireAt,
      metadata: input.metadata,
      fills: [],
    };

    this.openOrders.set(order.id, order);
    const events: OrderEvent[] = [this.toEvent('CREATED', order)];
    if (order.type === OrderType.MARKET) {
      events.push(...this.executeMarketOrder(order, context));
    } else {
      order.status = OrderStatus.PENDING;
      order.updatedAt = now;
    }

    return { order: this.toSnapshot(order), events };
  }

  cancelOrder(orderId: string): OrderSnapshot | null {
    const order = this.openOrders.get(orderId);
    if (!order) {
      const archived = this.archivedOrders.get(orderId);
      return archived ? this.toSnapshot(archived) : null;
    }

    order.status = OrderStatus.CANCELED;
    order.updatedAt = Date.now();
    const snapshot = this.toSnapshot(order);
    this.finalizeOrder(order);
    return snapshot;
  }

  getOrder(orderId: string): OrderSnapshot | null {
    const order = this.openOrders.get(orderId);
    if (order) {
      return this.toSnapshot(order);
    }
    const archived = this.archivedOrders.get(orderId);
    return archived ? this.toSnapshot(archived) : null;
  }

  getOpenOrders(symbol?: string): OrderSnapshot[] {
    const orders: OrderSnapshot[] = [];
    this.openOrders.forEach((order) => {
      if (this.isFinal(order.status)) {
        return;
      }
      if (symbol && order.symbol !== symbol) {
        return;
      }
      orders.push(this.toSnapshot(order));
    });
    return orders;
  }

  handleTick(tick: MarketTick): OrderEvent[] {
    const events: OrderEvent[] = [];
    this.openOrders.forEach((order) => {
      if (this.isFinal(order.status)) {
        return;
      }
      if (order.expireAt && tick.timestamp >= order.expireAt) {
        order.status = OrderStatus.EXPIRED;
        order.updatedAt = tick.timestamp;
        events.push(this.toEvent('EXPIRED', order));
        this.finalizeOrder(order);
        return;
      }

      if (order.type === OrderType.MARKET) {
        if (order.status === OrderStatus.NEW || order.status === OrderStatus.PENDING) {
          events.push(...this.executeMarketOrder(order, { currentTick: tick }));
        }
        return;
      }

      if (order.type === OrderType.LIMIT) {
        if (this.shouldFillLimit(order, tick)) {
          events.push(...this.fillOrder(order, order.price!, tick.timestamp, 'MAKER'));
        }
        this.handleTimeInForce(order, tick.timestamp, events);
        return;
      }

      if (order.type === OrderType.STOP) {
        if (this.shouldTriggerStop(order, tick)) {
          events.push(...this.executeStopAsMarket(order, tick));
        }
        this.handleTimeInForce(order, tick.timestamp, events);
        return;
      }

      if (order.type === OrderType.STOP_LIMIT) {
        if (
          order.status === OrderStatus.PENDING &&
          this.shouldTriggerStop(order, tick)
        ) {
          order.status = OrderStatus.TRIGGERED;
          order.triggeredAt = tick.timestamp;
          order.updatedAt = tick.timestamp;
          events.push(this.toEvent('TRIGGERED', order));
        }
        if (
          order.status === OrderStatus.TRIGGERED &&
          this.shouldFillLimit(order, tick)
        ) {
          events.push(...this.fillOrder(order, order.price!, tick.timestamp, 'MAKER'));
        }
        this.handleTimeInForce(order, tick.timestamp, events);
      }
    });

    return events;
  }

  private executeMarketOrder(
    order: ManagedOrder,
    context: OrderPlacementContext
  ): OrderEvent[] {
    const now = context.timestamp ?? context.currentTick?.timestamp ?? Date.now();
    const price = this.resolveMarketPrice(order, context);
    const events = this.fillOrder(order, price, now, 'TAKER');
    return events;
  }

  private executeStopAsMarket(order: ManagedOrder, tick: MarketTick): OrderEvent[] {
    const price = this.resolveStopFillPrice(order, tick);
    return this.fillOrder(order, price, tick.timestamp, 'TAKER');
  }

  private handleTimeInForce(
    order: ManagedOrder,
    timestamp: number,
    events: OrderEvent[]
  ) {
    if (order.timeInForce === TimeInForce.GTC) {
      return;
    }
    if (order.status === OrderStatus.FILLED) {
      return;
    }

    if (order.timeInForce === TimeInForce.IOC) {
      order.status = OrderStatus.CANCELED;
      order.updatedAt = timestamp;
      events.push(this.toEvent('CANCELED', order));
      this.finalizeOrder(order);
      return;
    }

    if (order.timeInForce === TimeInForce.FOK) {
      if (order.remainingQuantity === order.quantity) {
        order.status = OrderStatus.CANCELED;
        order.updatedAt = timestamp;
        events.push(this.toEvent('CANCELED', order));
        this.finalizeOrder(order);
      }
    }
  }

  private shouldFillLimit(order: ManagedOrder, tick: MarketTick): boolean {
    if (order.price === undefined) {
      return false;
    }

    if (order.side === OrderSide.BUY) {
      return this.getIntrabarLow(tick) <= order.price;
    }
    return this.getIntrabarHigh(tick) >= order.price;
  }

  private shouldTriggerStop(order: ManagedOrder, tick: MarketTick): boolean {
    if (order.stopPrice === undefined) {
      return false;
    }

    if (order.side === OrderSide.BUY) {
      return this.getIntrabarHigh(tick) >= order.stopPrice;
    }
    return this.getIntrabarLow(tick) <= order.stopPrice;
  }

  private resolveMarketPrice(
    order: ManagedOrder,
    context: OrderPlacementContext
  ): number {
    if (context.marketPrice !== undefined) {
      return context.marketPrice;
    }
    if (context.currentTick) {
      return context.currentTick.open;
    }
    if (order.price !== undefined) {
      return order.price;
    }
    if (order.stopPrice !== undefined) {
      return order.stopPrice;
    }
    throw new Error('Unable to resolve market price for the order');
  }

  private resolveStopFillPrice(order: ManagedOrder, tick: MarketTick): number {
    if (order.stopPrice === undefined) {
      return this.resolveMarketPrice(order, { currentTick: tick });
    }
    if (order.side === OrderSide.BUY) {
      const open = tick.open;
      return open > order.stopPrice ? open : order.stopPrice;
    }
    const open = tick.open;
    return open < order.stopPrice ? open : order.stopPrice;
  }

  private fillOrder(
    order: ManagedOrder,
    price: number,
    timestamp: number,
    liquidity: LiquidityRole
  ): OrderEvent[] {
    if (this.isFinal(order.status)) {
      return [];
    }

    const fillQuantity = order.remainingQuantity;
    if (fillQuantity <= 0) {
      order.status = OrderStatus.FILLED;
      order.updatedAt = timestamp;
      const events = [this.toEvent('FILLED', order)];
      this.finalizeOrder(order);
      return events;
    }

    const fillId = randomUUID();
    order.fills.push({
      fillId,
      price,
      quantity: fillQuantity,
      timestamp,
      liquidity,
    });
    order.remainingQuantity = 0;
    order.status = OrderStatus.FILLED;
    order.updatedAt = timestamp;

    const fillEvent: OrderEvent = {
      type: fillQuantity < order.quantity ? 'PARTIALLY_FILLED' : 'FILLED',
      order: this.toSnapshot(order),
      fill: {
        orderId: order.id,
        fillId,
        price,
        quantity: fillQuantity,
        timestamp,
        liquidity,
      },
    };

    const events: OrderEvent[] = [fillEvent];
    if (fillEvent.type === 'PARTIALLY_FILLED') {
      events.push(this.toEvent('FILLED', order));
    }
    this.finalizeOrder(order);
    return events;
  }

  private toSnapshot(order: ManagedOrder): OrderSnapshot {
    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      quantity: order.quantity,
      remainingQuantity: order.remainingQuantity,
      price: order.price,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      reduceOnly: order.reduceOnly,
      clientOrderId: order.clientOrderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      triggeredAt: order.triggeredAt,
      expireAt: order.expireAt,
      fills: order.fills.map((fill) => ({
        orderId: order.id,
        fillId: fill.fillId,
        price: fill.price,
        quantity: fill.quantity,
        timestamp: fill.timestamp,
        liquidity: fill.liquidity,
        fee: fill.fee,
      })),
      metadata: order.metadata,
    };
  }

  private toEvent(type: OrderEvent['type'], order: ManagedOrder): OrderEvent {
    return {
      type,
      order: this.toSnapshot(order),
    };
  }

  private finalizeOrder(order: ManagedOrder) {
    if (!this.isFinal(order.status)) {
      return;
    }
    if (this.openOrders.has(order.id)) {
      this.openOrders.delete(order.id);
      this.archivedOrders.set(order.id, order);
    }
  }

  private isFinal(status: OrderStatus): boolean {
    return (
      status === OrderStatus.FILLED ||
      status === OrderStatus.CANCELED ||
      status === OrderStatus.REJECTED ||
      status === OrderStatus.EXPIRED
    );
  }

  private getIntrabarHigh(tick: MarketTick): number {
    return Math.max(tick.open, tick.high, tick.low, tick.close);
  }

  private getIntrabarLow(tick: MarketTick): number {
    return Math.min(tick.open, tick.high, tick.low, tick.close);
  }

  private assertQuantity(quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid order quantity: ${quantity}`);
    }
  }

  private assertPriceFields(input: SubmitOrderInput) {
    if (input.type === OrderType.LIMIT || input.type === OrderType.STOP_LIMIT) {
      if (!this.isFiniteNumber(input.price)) {
        throw new Error('Limit orders require a valid price');
      }
    }
    if (input.type === OrderType.STOP || input.type === OrderType.STOP_LIMIT) {
      if (!this.isFiniteNumber(input.stopPrice)) {
        throw new Error('Stop orders require a valid stopPrice');
      }
    }
    if (input.type === OrderType.MARKET && input.price !== undefined) {
      if (!this.isFiniteNumber(input.price) || input.price <= 0) {
        throw new Error('Market price, when provided, must be positive');
      }
    }
  }

  private isFiniteNumber(value: number | undefined): value is number {
    return value !== undefined && Number.isFinite(value);
  }
}
