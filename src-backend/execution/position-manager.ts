import type {
  ExitReason,
  ParsedTimestamp,
  PositionSide,
  SecondBar,
  StrategyConfig,
  TradeRecord,
} from '../core';

export interface PositionOpenPlan {
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  timestamp: ParsedTimestamp;
  takeProfit: number;
  takeProfitEnabled: boolean;
  stopLoss: number;
  referenceId: string;
}

export interface PositionAddPlan {
  price: number;
  quantity: number;
  updateTakeProfitToAverage?: boolean;
}

export interface ClosedTrade extends Omit<TradeRecord, 'id'> {}

interface PositionState {
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  averagePrice: number;
  entryTime: ParsedTimestamp;
  takeProfit: number;
  takeProfitEnabled: boolean;
  stopLoss: number;
  referenceId: string;
  addExecuted: boolean;
  addEntryPrice?: number;
  addEntryTime?: ParsedTimestamp;
}

export class PositionManager {
  private position: PositionState | null = null;
  private addPlan: PositionAddPlan | null = null;

  constructor(private readonly config: StrategyConfig) {}

  reset(): void {
    this.position = null;
    this.addPlan = null;
  }

  hasOpenPosition(): boolean {
    return this.position !== null;
  }

  getPosition(): PositionState | null {
    return this.position;
  }

  configureAddPlan(plan: PositionAddPlan | null): void {
    this.addPlan = plan;
  }

  open(plan: PositionOpenPlan): void {
    if (this.position) {
      return;
    }
    this.position = {
      side: plan.side,
      quantity: plan.quantity,
      entryPrice: plan.entryPrice,
      averagePrice: plan.entryPrice,
      entryTime: plan.timestamp,
      takeProfit: plan.takeProfit,
      takeProfitEnabled: plan.takeProfitEnabled,
      stopLoss: plan.stopLoss,
      referenceId: plan.referenceId,
      addExecuted: false,
    } satisfies PositionState;
  }

  evaluate(sample: SecondBar): ClosedTrade | null {
    if (!this.position) {
      return null;
    }

    this.tryExecuteAdd(sample);
    return this.tryClose(sample);
  }

  forceExit(sample: SecondBar, reason: ExitReason): ClosedTrade | null {
    if (!this.position) {
      return null;
    }
    return this.close(sample.close, sample.timestamp, reason);
  }

  private tryExecuteAdd(sample: SecondBar): void {
    if (!this.position || !this.addPlan || this.position.addExecuted) {
      return;
    }

    const { price, quantity, updateTakeProfitToAverage } = this.addPlan;
    const touched = price >= sample.low && price <= sample.high;
    if (!touched) {
      return;
    }

    const newQuantity = this.position.quantity + quantity;
    const newAverage =
      (this.position.averagePrice * this.position.quantity + price * quantity) / newQuantity;

    this.position.quantity = newQuantity;
    this.position.averagePrice = newAverage;
    this.position.addExecuted = true;
    this.position.addEntryPrice = price;
    this.position.addEntryTime = sample.timestamp;

    if (updateTakeProfitToAverage && this.position.takeProfitEnabled) {
      this.position.takeProfit = newAverage;
    }
  }

  private tryClose(sample: SecondBar): ClosedTrade | null {
    if (!this.position) {
      return null;
    }

    const { side, stopLoss, takeProfit, takeProfitEnabled } = this.position;

    if (side === 'long') {
      if (sample.low <= stopLoss) {
        return this.close(stopLoss, sample.timestamp, 'stop-loss');
      }
      if (takeProfitEnabled && sample.high >= takeProfit) {
        return this.close(takeProfit, sample.timestamp, 'take-profit');
      }
      return null;
    }

    if (sample.high >= stopLoss) {
      return this.close(stopLoss, sample.timestamp, 'stop-loss');
    }
    if (takeProfitEnabled && sample.low <= takeProfit) {
      return this.close(takeProfit, sample.timestamp, 'take-profit');
    }

    return null;
  }

  private close(price: number, timestamp: ParsedTimestamp, reason: ExitReason): ClosedTrade {
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
      strategyRef: this.position.referenceId,
      addExecuted: this.position.addExecuted,
    } satisfies ClosedTrade;

    this.position = null;
    this.addPlan = null;
    return trade;
  }
}
