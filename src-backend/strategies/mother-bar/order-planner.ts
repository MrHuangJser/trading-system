import type { MotherBarState } from './types';
import type { PositionSide, StrategyConfig } from '../../core';
import type { SecondBar } from '../../core';
import { priceTouches } from './utils';

export interface EntryPlan {
  side: PositionSide;
  price: number;
}

export class OrderPlanner {
  private longOrder: EntryPlan | null = null;
  private shortOrder: EntryPlan | null = null;

  constructor(private readonly config: StrategyConfig) {}

  reset(): void {
    this.longOrder = null;
    this.shortOrder = null;
  }

  prepare(active: MotherBarState): void {
    if (active.invalidated || active.tradeCount >= 2) {
      return;
    }

    const quantity = this.config.baseQuantity;
    if (quantity <= 0) {
      return;
    }

    if (this.config.enableLongEntry) {
      this.longOrder = {
        side: 'long',
        price: active.levels.n23,
      } satisfies EntryPlan;
    } else {
      this.longOrder = null;
    }

    if (this.config.enableShortEntry) {
      this.shortOrder = {
        side: 'short',
        price: active.levels.p123,
      } satisfies EntryPlan;
    } else {
      this.shortOrder = null;
    }
  }

  evaluate(sample: SecondBar, active: MotherBarState | null): EntryPlan | null {
    if (!active || active.invalidated) {
      return null;
    }

    if (this.longOrder && priceTouches(sample.low, sample.high, this.longOrder.price)) {
      const plan = this.longOrder;
      this.longOrder = null;
      this.shortOrder = null;
      return plan;
    }

    if (this.shortOrder && priceTouches(sample.low, sample.high, this.shortOrder.price)) {
      const plan = this.shortOrder;
      this.longOrder = null;
      this.shortOrder = null;
      return plan;
    }

    return null;
  }

  cancelAll(): void {
    this.longOrder = null;
    this.shortOrder = null;
  }
}
