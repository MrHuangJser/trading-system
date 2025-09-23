import { isRegularTradingHours } from '../../core/time';
import type {
  BacktestSummary,
  CandleExportRow,
  StrategyConfig,
  TimeframeBar,
  SecondBar,
} from '../../core';
import type { BacktestMetadata } from '../../core';
import { PositionManager, TradeReporter } from '../../execution';
import type { ClosedTrade } from '../../execution/position-manager';
import type { MarketDataEvent } from '../../market-data';
import { buildCandlesForTimeframe } from '../../market-data';
import type { StrategyController, StrategyResult } from '..';
import { MotherBarDetector } from './detector';
import { OrderPlanner, type EntryPlan } from './order-planner';
import type { MotherBarState } from './types';

interface StrategyContext {
  config: StrategyConfig;
}

export class MotherBarStrategyController implements StrategyController<BacktestSummary> {
  private readonly detector = new MotherBarDetector();
  private readonly orderPlanner: OrderPlanner;
  private readonly positionManager: PositionManager;
  private readonly reporter = new TradeReporter();
  private readonly secondFeed: SecondBar[] = [];

  private sessionActive = false;
  private lastProcessedSecond: SecondBar | null = null;
  private lastRthSecond: SecondBar | null = null;
  private timeframe: StrategyConfig['timeframe'];

  constructor(private readonly context: StrategyContext) {
    this.orderPlanner = new OrderPlanner(context.config);
    this.positionManager = new PositionManager(context.config);
    this.timeframe = context.config.timeframe;
  }

  onSecond(event: MarketDataEvent): void {
    const { second } = event;
    this.secondFeed.push(second);

    const inRth = isRegularTradingHours(second.timestamp);

    if (inRth && !this.sessionActive) {
      this.startSession();
    }
    if (!inRth && this.sessionActive) {
      this.endSession();
    }

    if (inRth) {
      this.lastRthSecond = second;
      this.evaluateSecond(second);
    }

    this.lastProcessedSecond = second;
  }

  onTimeframe(event: MarketDataEvent): void {
    if (event.state !== 'completed') {
      return;
    }

    this.timeframe = event.timeframe.timeframe;

    if (!isRegularTradingHours(event.timeframe.startTimestamp)) {
      return;
    }

    this.handleCompletedBar(event.timeframe);
  }

  finalize(): StrategyResult<BacktestSummary> {
    if (this.positionManager.hasOpenPosition() && this.lastRthSecond) {
      const trade = this.positionManager.forceExit(this.lastRthSecond, 'stop-loss');
      if (trade) {
        this.onPositionClosed(trade, this.detector.getActive());
      }
    }

    const candles = buildCandlesForTimeframe(this.secondFeed, this.timeframe);

    const summary = this.reporter.getSummary();
    const trades = this.reporter.getTrades();

    const metadata: BacktestMetadata = {
      generatedAt: new Date().toISOString(),
      dataFile: this.context.config.dataFile,
      baseQuantity: this.context.config.baseQuantity,
      contractMultiplier: this.context.config.contractMultiplier,
      resolution: this.timeframe,
      candles: candles.length,
      trades: summary.totalTrades,
      seconds: this.secondFeed.length,
      secondLimit: null,
    };

    return {
      summary,
      trades,
      candles,
      metadata,
    };
  }

  private evaluateSecond(sample: SecondBar): void {
    const active = this.detector.getActive();

    if (!this.positionManager.hasOpenPosition() && active && !active.invalidated) {
      const entry = this.orderPlanner.evaluate(sample, active);
      if (entry) {
        this.handlePositionOpened(entry, sample, active);
      }
    }

    if (this.positionManager.hasOpenPosition()) {
      const closed = this.positionManager.evaluate(sample);
      if (closed) {
        this.onPositionClosed(closed, active ?? null);
      }
    }

    if (active) {
      this.checkInvalidation(sample, active);
    }
  }

  private handleCompletedBar(bar: TimeframeBar): void {
    const activated = this.detector.process(bar, {
      positionOpen: this.positionManager.hasOpenPosition(),
    });
    if (activated && !this.positionManager.hasOpenPosition()) {
      this.orderPlanner.prepare(activated);
    }
  }

  private handlePositionOpened(entry: EntryPlan, sample: SecondBar, motherBar: MotherBarState): void {
    const quantity = this.context.config.baseQuantity;
    const stopLoss = entry.side === 'long' ? motherBar.levels.n200 : motherBar.levels.p300;
    const takeProfitEnabled = entry.side === 'long'
      ? this.context.config.enableLongTakeProfit
      : this.context.config.enableShortTakeProfit;
    const defaultTakeProfit = motherBar.levels.p50;
    const takeProfit = takeProfitEnabled
      ? defaultTakeProfit
      : entry.side === 'long'
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY;

    this.positionManager.open({
      side: entry.side,
      entryPrice: entry.price,
      quantity,
      timestamp: sample.timestamp,
      takeProfit,
      takeProfitEnabled,
      stopLoss,
      referenceId: motherBar.id,
    });

    const addPrice = entry.side === 'long' ? motherBar.levels.n100 : motherBar.levels.p200;
    this.positionManager.configureAddPlan({
      price: addPrice,
      quantity,
      updateTakeProfitToAverage: true,
    });
  }

  private onPositionClosed(trade: ClosedTrade, motherBar: MotherBarState | null): void {
    this.orderPlanner.cancelAll();
    this.reporter.record(trade);

    if (!motherBar) {
      return;
    }

    motherBar.tradeCount += 1;

    if (motherBar.tradeCount < 2 && !motherBar.invalidated) {
      this.orderPlanner.prepare(motherBar);
      return;
    }

    if (this.detector.hasPending()) {
      this.detector.clearActive();
      const promoted = this.detector.promotePending();
      if (promoted) {
        this.orderPlanner.prepare(promoted);
      }
      return;
    }

    if (motherBar.invalidated) {
      this.detector.clearActive();
    }
  }

  private checkInvalidation(sample: SecondBar, motherBar: MotherBarState): void {
    if (!motherBar || motherBar.invalidated) {
      return;
    }

    const invalidByHigh = sample.high >= motherBar.levels.p200;
    const invalidByLow = sample.low <= motherBar.levels.n100;
    if (!invalidByHigh && !invalidByLow) {
      return;
    }

    this.detector.markInvalidated();
    this.orderPlanner.cancelAll();

    if (!this.positionManager.hasOpenPosition()) {
      this.detector.clearActive();
      const promoted = this.detector.promotePending();
      if (promoted) {
        this.orderPlanner.prepare(promoted);
      }
    }
  }

  private startSession(): void {
    this.sessionActive = true;
    this.orderPlanner.cancelAll();

    const activeBeforeReset = this.detector.getActive();
    if (this.positionManager.hasOpenPosition() && this.lastProcessedSecond) {
      const trade = this.positionManager.forceExit(this.lastProcessedSecond, 'stop-loss');
      if (trade) {
        this.onPositionClosed(trade, activeBeforeReset);
      }
    }

    this.detector.reset();
  }

  private endSession(): void {
    this.sessionActive = false;
    this.orderPlanner.cancelAll();

    const activeBeforeReset = this.detector.getActive();
    if (this.positionManager.hasOpenPosition() && this.lastRthSecond) {
      const trade = this.positionManager.forceExit(this.lastRthSecond, 'stop-loss');
      if (trade) {
        this.onPositionClosed(trade, activeBeforeReset);
      }
    }

    this.detector.reset();
  }
}
