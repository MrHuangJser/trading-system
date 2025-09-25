import { OrderSide } from '../orders/order.types';

export interface TradeFill {
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface OpenPosition {
  symbol: string;
  side: OrderSide;
  quantity: number;
  avgPrice: number;
  entryTimestamp: number;
  fills: TradeFill[];
}

export interface ClosedTrade {
  symbol: string;
  direction: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTimestamp: number;
  exitTimestamp: number;
  pnl: number;
}

export interface TradeSummary {
  totalTrades: number;
  totalPnl: number;
  winTrades: number;
  lossTrades: number;
}
