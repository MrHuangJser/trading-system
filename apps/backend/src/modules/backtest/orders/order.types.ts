export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_MARKET = 'STOP_MARKET',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  PENDING = 'PENDING',
  TRIGGERED = 'TRIGGERED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export interface OrderRequest {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface OrderFill {
  orderId: string;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface OrderSnapshot {
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
