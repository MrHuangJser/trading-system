export type TradeSide = 'long' | 'short';
export type ExitReason = 'take-profit' | 'stop-loss';

type Currency = number;

type TimestampMs = number;

export interface CandleDatum {
  timestamp: TimestampMs;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  raw: string;
}

export interface TradeDatum {
  id: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  entryTimestamp: TimestampMs;
  entryRaw: string;
  exitPrice: number;
  exitTimestamp: TimestampMs;
  exitRaw: string;
  exitReason: ExitReason;
  averageEntryPrice: number;
  pnlPoints: number;
  pnlCurrency: Currency;
  motherBarId: string;
  addExecuted: boolean;
}

export interface Metadata {
  generatedAt: string;
  dataFile: string;
  baseQuantity: number;
  contractMultiplier: number;
  resolution: string;
  candles: number;
  trades: number;
  seconds: number;
  secondLimit: number | null;
}

export interface Summary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  netPnlPoints: number;
  netPnlCurrency: number;
  grossProfitPoints: number;
  grossLossPoints: number;
}

export interface BacktestPayload {
  metadata: Metadata;
  summary: Summary;
  candles: CandleDatum[];
  trades: TradeDatum[];
}

export interface TradeMarker {
  id: string;
  tradeId: string;
  type: 'entry' | 'exit';
  side: TradeSide;
  label: string;
  timestamp: TimestampMs;
  price: number;
  exitReason?: ExitReason;
}
