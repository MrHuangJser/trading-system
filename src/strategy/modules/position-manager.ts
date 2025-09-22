import type {
  ExitReason,
  MotherBarState,
  PositionState,
  SecondBar,
  StrategyConfig,
  TradeRecord,
} from '../../types';
import type { EntryPlan } from '../mother-bar/order-planner';
import { priceTouches } from '../mother-bar/utils';

export type ClosedTrade = Omit<TradeRecord, 'id'>;

export class PositionManager {
  private position: PositionState | null = null;

  constructor(private readonly config: StrategyConfig) {}

  reset(): void {
    this.position = null;
  }

  hasOpenPosition(): boolean {
    return this.position !== null;
  }

  getPosition(): PositionState | null {
    return this.position;
  }

  openPosition(entry: EntryPlan, sample: SecondBar, motherBar: MotherBarState): void {
    if (this.position) {
      return;
    }

    const quantity = this.config.baseQuantity;
    const stopLoss = entry.side === 'long' ? motherBar.levels.n200 : motherBar.levels.p300;
    const takeProfitEnabled = entry.side === 'long'
      ? this.config.enableLongTakeProfit
      : this.config.enableShortTakeProfit;
    const defaultTakeProfit = motherBar.levels.p50;
    const takeProfit = takeProfitEnabled
      ? defaultTakeProfit
      : entry.side === 'long'
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY;

    this.position = {
      side: entry.side,
      quantity,
      entryPrice: entry.price,
      averagePrice: entry.price,
      entryTime: sample.timestamp,
      addExecuted: false,
      takeProfit,
      takeProfitEnabled,
      stopLoss,
      motherBarId: motherBar.id,
    };
  }

  evaluateSecond(sample: SecondBar, motherBar: MotherBarState | null): ClosedTrade | null {
    if (!this.position || !motherBar) {
      return null;
    }

    this.tryAddPosition(sample, motherBar);
    return this.tryClosePosition(sample);
  }

  forceExit(sample: SecondBar, reason: ExitReason): ClosedTrade | null {
    if (!this.position) {
      return null;
    }
    return this.closePosition(sample.close, sample.timestamp, reason);
  }

  private tryAddPosition(sample: SecondBar, motherBar: MotherBarState): void {
    if (!this.position || this.position.addExecuted) {
      return;
    }

    const addPrice = this.position.side === 'long' ? motherBar.levels.n100 : motherBar.levels.p100;
    if (!priceTouches(sample.low, sample.high, addPrice)) {
      return;
    }

    const additionalQty = this.config.baseQuantity;
    const newQuantity = this.position.quantity + additionalQty;
    const newAverage =
      (this.position.averagePrice * this.position.quantity + addPrice * additionalQty) / newQuantity;

    this.position.quantity = newQuantity;
    this.position.averagePrice = newAverage;
    this.position.addExecuted = true;
    this.position.addEntryPrice = addPrice;
    this.position.addEntryTime = sample.timestamp;

    if (this.position.takeProfitEnabled) {
      if (this.position.side === 'long') {
        this.position.takeProfit = motherBar.levels.n61_8;
      } else {
        this.position.takeProfit = motherBar.levels.p161_8;
      }
    }
  }

  private tryClosePosition(sample: SecondBar): ClosedTrade | null {
    if (!this.position) {
      return null;
    }

    const { side, stopLoss, takeProfit } = this.position;

    if (side === 'long') {
      if (sample.low <= stopLoss) {
        return this.closePosition(stopLoss, sample.timestamp, 'stop-loss');
      }
      if (this.position.takeProfitEnabled && sample.high >= takeProfit) {
        return this.closePosition(takeProfit, sample.timestamp, 'take-profit');
      }
      return null;
    }

    if (sample.high >= stopLoss) {
      return this.closePosition(stopLoss, sample.timestamp, 'stop-loss');
    }
    if (this.position.takeProfitEnabled && sample.low <= takeProfit) {
      return this.closePosition(takeProfit, sample.timestamp, 'take-profit');
    }

    return null;
  }

  private closePosition(price: number, timestamp: SecondBar['timestamp'], reason: ExitReason): ClosedTrade {
    if (!this.position) {
      throw new Error('Cannot close position when none is open');
    }

    const pnlPerContract =
      this.position.side === 'long'
        ? price - this.position.averagePrice
        : this.position.averagePrice - price;
    const pnlPoints = pnlPerContract * this.position.quantity;
    const pnlCurrency = pnlPerContract * this.config.contractMultiplier * this.position.quantity;

    const trade: ClosedTrade = {
      side: this.position.side,
      quantity: this.position.quantity,
      entryPrice: this.position.entryPrice,
      entryTime: this.position.entryTime,
      averageEntryPrice: this.position.averagePrice,
      exitPrice: price,
      exitTime: timestamp,
      exitReason: reason,
      pnlPoints,
      pnlCurrency,
      motherBarId: this.position.motherBarId,
      addExecuted: this.position.addExecuted,
    };

    this.position = null;
    return trade;
  }
}
