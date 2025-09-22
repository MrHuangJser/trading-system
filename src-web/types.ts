export const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h'] as const;

export type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

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
  resolution: Timeframe;
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

export interface BacktestRequest {
  datasetId?: string;
  dataFile?: string;
  baseQuantity?: number;
  contractMultiplier?: number;
  seconds?: number;
  enableLongEntry?: boolean;
  enableLongTakeProfit?: boolean;
  enableShortEntry?: boolean;
  enableShortTakeProfit?: boolean;
  timeframe?: Timeframe;
}

export interface DatasetSummary {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  rows: number;
  secondsStart: string | null;
  secondsEnd: string | null;
  note: string | null;
  isActive: boolean;
}
