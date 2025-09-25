export type OrderSide = 'BUY' | 'SELL';

export interface StrategyParamSchema {
  type: 'number' | 'string' | 'boolean';
  description?: string;
  default?: number | string | boolean;
  enum?: Array<number | string | boolean>;
}

export interface StrategySchema {
  type: 'object';
  description?: string;
  properties?: Record<string, StrategyParamSchema>;
  required?: string[];
}

export interface StrategyListItem {
  name: string;
  description: string;
  supportedTimeframes: Timeframe[];
  paramsSchema?: StrategySchema;
}

export interface TradeFill {
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  timestamp: number;
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

export interface BacktestResponse {
  strategy: string;
  timeframe: Timeframe;
  symbol: string;
  summary: TradeSummary;
  closedTrades: ClosedTrade[];
  fills: TradeFill[];
}
