import type { BacktestSummary, TradeRecord } from '../../types';

interface StrategyTotals {
  netPnlPoints: number;
  netPnlCurrency: number;
  grossProfitPoints: number;
  grossLossPoints: number;
  winningTrades: number;
  losingTrades: number;
}

export class TradeReporter {
  private readonly trades: TradeRecord[] = [];
  private readonly totals: StrategyTotals = {
    netPnlPoints: 0,
    netPnlCurrency: 0,
    grossProfitPoints: 0,
    grossLossPoints: 0,
    winningTrades: 0,
    losingTrades: 0,
  };
  private tradeSequence = 0;

  recordTrade(trade: Omit<TradeRecord, 'id'>): TradeRecord {
    const record: TradeRecord = {
      id: `T-${++this.tradeSequence}`,
      ...trade,
    };

    this.trades.push(record);

    this.totals.netPnlPoints += record.pnlPoints;
    this.totals.netPnlCurrency += record.pnlCurrency;
    if (record.pnlPoints >= 0) {
      this.totals.grossProfitPoints += record.pnlPoints;
      this.totals.winningTrades += 1;
    } else {
      this.totals.grossLossPoints += record.pnlPoints;
      this.totals.losingTrades += 1;
    }

    return record;
  }

  getTrades(): TradeRecord[] {
    return this.trades;
  }

  getSummary(): BacktestSummary {
    return {
      trades: [...this.trades],
      totalTrades: this.trades.length,
      winningTrades: this.totals.winningTrades,
      losingTrades: this.totals.losingTrades,
      netPnlPoints: this.totals.netPnlPoints,
      netPnlCurrency: this.totals.netPnlCurrency,
      grossProfitPoints: this.totals.grossProfitPoints,
      grossLossPoints: this.totals.grossLossPoints,
    };
  }
}
