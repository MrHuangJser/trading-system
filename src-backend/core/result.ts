export interface BacktestMetadata {
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

export interface BacktestReport<Summary, CandleRow, Trade> {
  metadata: BacktestMetadata;
  summary: Summary;
  candles: CandleRow[];
  trades: Trade[];
}
