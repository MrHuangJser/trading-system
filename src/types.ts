import type { Timeframe } from './lib/timeframe';

export interface ParsedTimestamp {
  raw: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface SecondBar {
  timestamp: ParsedTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MinuteBar {
  startTimestamp: ParsedTimestamp; // minute start (HH:mm:00)
  endTimestamp: ParsedTimestamp; // last second included in this minute
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeBar extends MinuteBar {
  timeframe: Timeframe;
}

export type PositionSide = 'long' | 'short';

export interface LimitOrder {
  id: string;
  side: PositionSide;
  price: number;
  quantity: number;
  createdAt: ParsedTimestamp;
  motherBarId: string;
  active: boolean;
}

export type ExitReason = 'take-profit' | 'stop-loss';

export interface TradeRecord {
  id: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  entryTime: ParsedTimestamp;
  averageEntryPrice: number;
  exitPrice: number;
  exitTime: ParsedTimestamp;
  exitReason: ExitReason;
  pnlPoints: number;
  pnlCurrency: number;
  motherBarId: string;
  addExecuted: boolean;
}

export interface BacktestSummary {
  trades: TradeRecord[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  netPnlPoints: number;
  netPnlCurrency: number;
  grossProfitPoints: number;
  grossLossPoints: number;
}

export interface StrategyConfig {
  contractMultiplier: number; // $ per point
  baseQuantity: number;
  dataFile: string;
  enableLongEntry: boolean;
  enableLongTakeProfit: boolean;
  enableShortEntry: boolean;
  enableShortTakeProfit: boolean;
  timeframe: Timeframe;
}

export interface MotherBarLevels {
  p300: number;
  p200: number;
  p161_8: number;
  p127_2: number;
  p123: number;
  p111: number;
  p100: number;
  p89: number;
  p79: number;
  p66: number;
  p50: number;
  p33: number;
  p21: number;
  p11: number;
  p0: number;
  n11: number;
  n23: number;
  n61_8: number;
  n100: number;
  n200: number;
}

export interface MotherBarState {
  id: string;
  mother: MinuteBar;
  inside: MinuteBar;
  levels: MotherBarLevels;
  tradeCount: number;
  invalidated: boolean;
}

export interface PendingMotherBar {
  mother: MinuteBar;
  inside: MinuteBar;
}

export interface CandleExportRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  raw: string;
}

export interface PositionState {
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  averagePrice: number;
  entryTime: ParsedTimestamp;
  addExecuted: boolean;
  addEntryPrice?: number;
  addEntryTime?: ParsedTimestamp;
  takeProfit: number;
  takeProfitEnabled: boolean;
  stopLoss: number;
  motherBarId: string;
}

export interface BacktestResult {
  candles: CandleExportRow[];
  summary: BacktestSummary;
  metadata: {
    generatedAt: string;
    dataFile: string;
    baseQuantity: number;
    contractMultiplier: number;
    resolution: string;
    candles: number;
    trades: number;
    seconds: number;
    secondLimit: number | null;
  };
}
