export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  STOP_LIMIT = 'STOP_LIMIT',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  PENDING = 'PENDING',
  TRIGGERED = 'TRIGGERED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum TimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
}

export interface MarketTick {
  timestamp: number; // epoch milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type LiquidityRole = 'MAKER' | 'TAKER';

export interface OrderFill {
  orderId: string;
  fillId: string;
  price: number;
  quantity: number;
  timestamp: number;
  liquidity: LiquidityRole;
  fee?: number;
}

export interface SubmitOrderInput {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
  expireAt?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrderSnapshot {
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
  fills: OrderFill[];
  metadata?: Record<string, unknown>;
}

export interface OrderPlacementContext {
  currentTick?: MarketTick;
  timestamp?: number;
  marketPrice?: number;
}

export interface OrderEvent {
  type: 'CREATED' | 'TRIGGERED' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'EXPIRED';
  order: OrderSnapshot;
  fill?: OrderFill;
}

export interface SubmitOrderResult {
  order: OrderSnapshot;
  events: OrderEvent[];
}

