import type { Timeframe } from './timeframe';

export interface ParsedTimestamp {
  raw: string;
  date: string;
  time: string;
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
  startTimestamp: ParsedTimestamp;
  endTimestamp: ParsedTimestamp;
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
  parentId?: string | null;
  metadata?: Record<string, unknown>;
  active: boolean;
}

export type ExitReason = 'take-profit' | 'stop-loss' | 'timeout' | 'manual';

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
  strategyRef: string;
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
  contractMultiplier: number;
  baseQuantity: number;
  dataFile: string;
  enableLongEntry: boolean;
  enableLongTakeProfit: boolean;
  enableShortEntry: boolean;
  enableShortTakeProfit: boolean;
  timeframe: Timeframe;
  strategyId?: string;
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
