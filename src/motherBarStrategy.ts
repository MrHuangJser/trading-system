import { TimeframeAggregator } from "./aggregation";
import { isRegularTradingHours, minuteKey } from "./time";
import type {
  BacktestSummary,
  ExitReason,
  LimitOrder,
  MinuteBar,
  MotherBarLevels,
  MotherBarState,
  ParsedTimestamp,
  PendingMotherBar,
  PositionSide,
  PositionState,
  SecondBar,
  StrategyConfig,
  TradeRecord,
} from "./types";

interface StrategyTotals {
  netPnlPoints: number;
  netPnlCurrency: number;
  grossProfitPoints: number;
  grossLossPoints: number;
  winningTrades: number;
  losingTrades: number;
}

interface EntryResult {
  side: PositionSide;
  price: number;
}

export class MotherBarStrategy {
  private readonly aggregator = new TimeframeAggregator("1m");
  private readonly trades: TradeRecord[] = [];
  private readonly totals: StrategyTotals = {
    netPnlPoints: 0,
    netPnlCurrency: 0,
    grossProfitPoints: 0,
    grossLossPoints: 0,
    winningTrades: 0,
    losingTrades: 0,
  };

  private activeMB: MotherBarState | null = null;
  private pendingMB: PendingMotherBar | null = null;
  private position: PositionState | null = null;
  private longOrder: LimitOrder | null = null;
  private shortOrder: LimitOrder | null = null;
  private sessionActive = false;
  private previousRthMinute: MinuteBar | null = null;
  private lastProcessedSecond: SecondBar | null = null;
  private lastRthSecond: SecondBar | null = null;
  private tradeSequence = 0;

  constructor(private readonly config: StrategyConfig) {}

  run(data: SecondBar[]): BacktestSummary {
    for (const sample of data) {
      this.processSecond(sample);
    }

    const trailingMinute = this.aggregator.flush();
    if (trailingMinute) {
      this.handleCompletedMinute(trailingMinute);
    }

    if (this.position && this.lastRthSecond) {
      this.forceExitPosition(this.lastRthSecond, "stop-loss");
    }

    return {
      trades: this.trades,
      totalTrades: this.trades.length,
      winningTrades: this.totals.winningTrades,
      losingTrades: this.totals.losingTrades,
      netPnlPoints: this.totals.netPnlPoints,
      netPnlCurrency: this.totals.netPnlCurrency,
      grossProfitPoints: this.totals.grossProfitPoints,
      grossLossPoints: this.totals.grossLossPoints,
    };
  }

  private processSecond(sample: SecondBar): void {
    const inRth = isRegularTradingHours(sample.timestamp);

    if (inRth && !this.sessionActive) {
      this.startSession();
    }
    if (!inRth && this.sessionActive) {
      this.endSession();
    }

    const completedMinute = this.aggregator.add(sample);
    if (completedMinute) {
      this.handleCompletedMinute(completedMinute);
    }

    if (inRth) {
      this.lastRthSecond = sample;
      this.evaluateSecond(sample);
    }

    this.lastProcessedSecond = sample;
  }

  private startSession(): void {
    this.sessionActive = true;
    this.cancelOrders();
    if (this.position && this.lastProcessedSecond) {
      this.forceExitPosition(this.lastProcessedSecond, "stop-loss");
    }
    this.clearMotherBar();
    this.pendingMB = null;
    this.previousRthMinute = null;
  }

  private endSession(): void {
    this.sessionActive = false;
    this.cancelOrders();
    if (this.position && this.lastRthSecond) {
      this.forceExitPosition(this.lastRthSecond, "stop-loss");
    }
    this.clearMotherBar();
    this.pendingMB = null;
    this.previousRthMinute = null;
  }

  private handleCompletedMinute(minute: MinuteBar): void {
    const isRthMinute = isRegularTradingHours(minute.startTimestamp);
    if (!isRthMinute) {
      return;
    }

    if (!this.previousRthMinute) {
      this.previousRthMinute = minute;
      return;
    }

    if (isInsideBar(minute, this.previousRthMinute)) {
      this.onMotherBarDetected(this.previousRthMinute, minute);
    }

    this.previousRthMinute = minute;
  }

  private onMotherBarDetected(mother: MinuteBar, inside: MinuteBar): void {
    const motherId = `${minuteKey(mother.startTimestamp)}->${minuteKey(inside.startTimestamp)}`;
    if (this.activeMB) {
      if (this.position) {
        this.pendingMB = { mother, inside };
      }
      return;
    }
    const size = mother.high - mother.low;
    if (size <= 0) {
      return;
    }
    const levels = calculateLevels(mother.low, size);
    this.activeMB = {
      id: motherId,
      mother,
      inside,
      levels,
      tradeCount: 0,
      invalidated: false,
    };
    this.prepareEntryOrders();
  }

  private prepareEntryOrders(): void {
    if (!this.activeMB || this.activeMB.invalidated) {
      return;
    }
    if (this.position) {
      return;
    }
    if (this.activeMB.tradeCount >= 2) {
      return;
    }
    this.cancelOrders();
    const orderTimestamp = this.activeMB.inside.endTimestamp;
    const quantity = this.config.baseQuantity;

    if (this.config.enableLongEntry) {
      this.longOrder = {
        id: `L-${this.activeMB.id}-${this.activeMB.tradeCount + 1}`,
        side: "long",
        price: this.activeMB.levels.n23,
        quantity,
        createdAt: orderTimestamp,
        motherBarId: this.activeMB.id,
        active: true,
      };
    } else {
      this.longOrder = null;
    }

    if (this.config.enableShortEntry) {
      this.shortOrder = {
        id: `S-${this.activeMB.id}-${this.activeMB.tradeCount + 1}`,
        side: "short",
        price: this.activeMB.levels.p123,
        quantity,
        createdAt: orderTimestamp,
        motherBarId: this.activeMB.id,
        active: true,
      };
    } else {
      this.shortOrder = null;
    }
  }

  private evaluateSecond(sample: SecondBar): void {
    if (!this.activeMB || this.activeMB.invalidated) {
      return;
    }

    if (!this.position) {
      const entry = this.checkEntry(sample);
      if (entry) {
        this.onPositionOpened(entry, sample);
      }
    }

    if (this.position) {
      this.checkAdd(sample);
      this.checkExit(sample);
    }

    this.checkInvalidation(sample);
  }

  private checkEntry(sample: SecondBar): EntryResult | null {
    if (!this.activeMB) {
      return null;
    }
    if (this.longOrder?.active && priceTouches(sample.low, sample.high, this.longOrder.price)) {
      const price = this.longOrder.price;
      this.longOrder.active = false;
      this.shortOrder = null;
      return { side: "long", price };
    }
    if (this.shortOrder?.active && priceTouches(sample.low, sample.high, this.shortOrder.price)) {
      const price = this.shortOrder.price;
      this.shortOrder.active = false;
      this.longOrder = null;
      return { side: "short", price };
    }
    return null;
  }

  private onPositionOpened(entry: EntryResult, sample: SecondBar): void {
    if (!this.activeMB) {
      return;
    }
    const quantity = this.config.baseQuantity;
    const stopLoss = entry.side === "long" ? this.activeMB.levels.n200 : this.activeMB.levels.p300;
    const takeProfitEnabled = entry.side === "long"
      ? this.config.enableLongTakeProfit
      : this.config.enableShortTakeProfit;
    const defaultTakeProfit = this.activeMB.levels.p50;
    const takeProfit = takeProfitEnabled
      ? defaultTakeProfit
      : entry.side === "long"
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
      motherBarId: this.activeMB.id,
    };
    this.cancelOppositeOrder(entry.side);
  }

  private cancelOppositeOrder(filledSide: PositionSide): void {
    if (filledSide === "long") {
      this.shortOrder = null;
    } else {
      this.longOrder = null;
    }
  }

  private checkAdd(sample: SecondBar): void {
    if (!this.position || !this.activeMB) {
      return;
    }
    if (this.position.addExecuted) {
      return;
    }
    const addPrice = this.position.side === "long" ? this.activeMB.levels.n100 : this.activeMB.levels.p100;
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
      if (this.position.side === "long") {
        this.position.takeProfit = this.activeMB.levels.n61_8;
      } else {
        this.position.takeProfit = this.activeMB.levels.p161_8;
      }
    }
  }

  private checkExit(sample: SecondBar): void {
    if (!this.position) {
      return;
    }
    const { side, stopLoss, takeProfit } = this.position;
    if (side === "long") {
      if (sample.low <= stopLoss) {
        this.closePosition(stopLoss, sample.timestamp, "stop-loss");
        return;
      }
      if (this.position.takeProfitEnabled && sample.high >= takeProfit) {
        this.closePosition(takeProfit, sample.timestamp, "take-profit");
      }
      return;
    }
    if (sample.high >= stopLoss) {
      this.closePosition(stopLoss, sample.timestamp, "stop-loss");
      return;
    }
    if (this.position.takeProfitEnabled && sample.low <= takeProfit) {
      this.closePosition(takeProfit, sample.timestamp, "take-profit");
    }
  }

  private checkInvalidation(sample: SecondBar): void {
    if (!this.activeMB || this.activeMB.invalidated) {
      return;
    }
    const invalidByHigh = sample.high >= this.activeMB.levels.p200;
    const invalidByLow = sample.low <= this.activeMB.levels.n100;
    if (!invalidByHigh && !invalidByLow) {
      return;
    }
    this.activeMB.invalidated = true;
    this.cancelOrders();
    if (!this.position) {
      this.clearMotherBar();
      if (this.pendingMB) {
        this.promotePendingMotherBar();
      }
    }
  }

  private closePosition(price: number, timestamp: ParsedTimestamp, reason: ExitReason): void {
    if (!this.position || !this.activeMB) {
      return;
    }
    const pnlPoints =
      this.position.side === "long" ? price - this.position.averagePrice : this.position.averagePrice - price;
    const pnlCurrency = pnlPoints * this.config.contractMultiplier * this.position.quantity;
    const trade: TradeRecord = {
      id: `T-${++this.tradeSequence}`,
      side: this.position.side,
      quantity: this.position.quantity,
      entryPrice: this.position.entryPrice,
      entryTime: this.position.entryTime,
      averageEntryPrice: this.position.averagePrice,
      exitPrice: price,
      exitTime: timestamp,
      exitReason: reason,
      pnlPoints: pnlPoints * this.position.quantity,
      pnlCurrency,
      motherBarId: this.position.motherBarId,
      addExecuted: this.position.addExecuted,
    };
    this.trades.push(trade);

    this.totals.netPnlPoints += trade.pnlPoints;
    this.totals.netPnlCurrency += trade.pnlCurrency;
    if (trade.pnlPoints >= 0) {
      this.totals.grossProfitPoints += trade.pnlPoints;
      this.totals.winningTrades += 1;
    } else {
      this.totals.grossLossPoints += trade.pnlPoints;
      this.totals.losingTrades += 1;
    }

    this.position = null;
    this.activeMB.tradeCount += 1;
    this.cancelOrders();

    if (this.activeMB.tradeCount < 2 && !this.activeMB.invalidated) {
      this.prepareEntryOrders();
    } else if (this.pendingMB) {
      this.promotePendingMotherBar();
    } else if (this.activeMB.invalidated) {
      this.clearMotherBar();
    }
  }

  private forceExitPosition(sample: SecondBar, reason: ExitReason): void {
    const price = reason === "take-profit" ? sample.close : sample.close;
    this.closePosition(price, sample.timestamp, reason);
  }

  private cancelOrders(): void {
    this.longOrder = null;
    this.shortOrder = null;
  }

  private clearMotherBar(): void {
    this.activeMB = null;
  }

  private promotePendingMotherBar(): void {
    if (!this.pendingMB) {
      return;
    }
    const { mother, inside } = this.pendingMB;
    const size = mother.high - mother.low;
    if (size <= 0) {
      this.pendingMB = null;
      return;
    }
    const levels = calculateLevels(mother.low, size);
    this.activeMB = {
      id: `${minuteKey(mother.startTimestamp)}->${minuteKey(inside.startTimestamp)}`,
      mother,
      inside,
      levels,
      tradeCount: 0,
      invalidated: false,
    };
    this.pendingMB = null;
    this.prepareEntryOrders();
  }
}

function calculateLevels(low: number, size: number): MotherBarLevels {
  return {
    p300: low + size * 3,
    p200: low + size * 2,
    p161_8: low + size * 1.618,
    p127_2: low + size * 1.272,
    p123: low + size * 1.23,
    p111: low + size * 1.11,
    p100: low + size * 1,
    p89: low + size * 0.89,
    p79: low + size * 0.79,
    p66: low + size * 0.66,
    p50: low + size * 0.5,
    p33: low + size * 0.33,
    p21: low + size * 0.21,
    p11: low + size * 0.11,
    p0: low,
    n11: low - size * 0.11,
    n23: low - size * 0.23,
    n61_8: low - size * 0.618,
    n100: low - size,
    n200: low - size * 2,
  };
}

function priceTouches(low: number, high: number, price: number): boolean {
  return price >= low && price <= high;
}

function isInsideBar(current: MinuteBar, previous: MinuteBar): boolean {
  return current.high <= previous.high && current.low >= previous.low;
}
