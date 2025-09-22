import { TimeframeAggregator } from '../../aggregation';
import { isRegularTradingHours } from '../../time';
import type { BacktestSummary, MotherBarState, SecondBar, StrategyConfig, TimeframeBar } from '../../types';
import { MotherBarDetector } from '../mother-bar/detector';
import { OrderPlanner, type EntryPlan } from '../mother-bar/order-planner';
import { PositionManager, type ClosedTrade } from '../modules/position-manager';
import { TradeReporter } from '../modules/trade-reporter';

export class StrategyEngine {
  private readonly aggregator: TimeframeAggregator;
  private readonly detector = new MotherBarDetector();
  private readonly orderPlanner: OrderPlanner;
  private readonly positionManager: PositionManager;
  private readonly reporter = new TradeReporter();

  private sessionActive = false;
  private lastProcessedSecond: SecondBar | null = null;
  private lastRthSecond: SecondBar | null = null;

  constructor(private readonly config: StrategyConfig) {
    this.aggregator = new TimeframeAggregator(config.timeframe);
    this.orderPlanner = new OrderPlanner(config);
    this.positionManager = new PositionManager(config);
  }

  static run(feed: SecondBar[], config: StrategyConfig): BacktestSummary {
    const engine = new StrategyEngine(config);
    engine.processFeed(feed);
    return engine.reporter.getSummary();
  }

  private processFeed(feed: SecondBar[]): void {
    for (const sample of feed) {
      this.processSecond(sample);
    }

    const trailing = this.aggregator.flush();
    if (trailing && isRegularTradingHours(trailing.startTimestamp)) {
      this.handleCompletedBar(trailing);
    }

    if (this.positionManager.hasOpenPosition() && this.lastRthSecond) {
      const trade = this.positionManager.forceExit(this.lastRthSecond, 'stop-loss');
      if (trade) {
        this.onPositionClosed(trade, this.detector.getActive());
      }
    }
  }

  private processSecond(sample: SecondBar): void {
    const inRth = isRegularTradingHours(sample.timestamp);

    if (inRth && !this.sessionActive) {
      this.startSession();
    }
    if (!inRth && this.sessionActive) {
      this.endSession();
    }

    const completedBar = this.aggregator.add(sample);
    if (completedBar && isRegularTradingHours(completedBar.startTimestamp)) {
      this.handleCompletedBar(completedBar);
    }

    if (inRth) {
      this.lastRthSecond = sample;
      this.evaluateSecond(sample);
    }

    this.lastProcessedSecond = sample;
  }

  private handleCompletedBar(bar: TimeframeBar): void {
    const activated = this.detector.process(bar, {
      positionOpen: this.positionManager.hasOpenPosition(),
    });
    if (activated && !this.positionManager.hasOpenPosition()) {
      this.orderPlanner.prepareEntryOrders(activated);
    }
  }

  private evaluateSecond(sample: SecondBar): void {
    const active = this.detector.getActive();

    if (!this.positionManager.hasOpenPosition() && active && !active.invalidated) {
      const entry = this.orderPlanner.evaluateEntry(sample, active);
      if (entry) {
        this.handlePositionOpened(entry, sample, active);
      }
    }

    if (this.positionManager.hasOpenPosition()) {
      const closed = this.positionManager.evaluateSecond(sample, active);
      if (closed) {
        this.onPositionClosed(closed, active ?? null);
      }
    }

    if (active) {
      this.checkInvalidation(sample, active);
    }
  }

  private handlePositionOpened(entry: EntryPlan, sample: SecondBar, motherBar: MotherBarState): void {
    this.positionManager.openPosition(entry, sample, motherBar);
  }

  private onPositionClosed(trade: ClosedTrade, motherBar: MotherBarState | null): void {
    this.orderPlanner.cancelAll();
    this.reporter.recordTrade(trade);

    if (!motherBar) {
      return;
    }

    motherBar.tradeCount += 1;

    if (motherBar.tradeCount < 2 && !motherBar.invalidated) {
      this.orderPlanner.prepareEntryOrders(motherBar);
      return;
    }

    if (this.detector.hasPending()) {
      this.detector.clearActive();
      const promoted = this.detector.promotePending();
      if (promoted) {
        this.orderPlanner.prepareEntryOrders(promoted);
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
        this.orderPlanner.prepareEntryOrders(promoted);
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
