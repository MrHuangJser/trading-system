import type { LimitOrder, MotherBarState, PositionSide, SecondBar, StrategyConfig } from '../../types';
import { priceTouches } from './utils';

export interface EntryPlan {
  side: PositionSide;
  price: number;
}

export class OrderPlanner {
  private longOrder: LimitOrder | null = null;
  private shortOrder: LimitOrder | null = null;

  constructor(private readonly config: StrategyConfig) {}

  reset(): void {
    this.longOrder = null;
    this.shortOrder = null;
  }

  prepareEntryOrders(active: MotherBarState): void {
    if (active.invalidated || active.tradeCount >= 2) {
      return;
    }
    const quantity = this.config.baseQuantity;
    const orderTimestamp = active.inside.endTimestamp;

    if (this.config.enableLongEntry) {
      this.longOrder = {
        id: `L-${active.id}-${active.tradeCount + 1}`,
        side: 'long',
        price: active.levels.n23,
        quantity,
        createdAt: orderTimestamp,
        motherBarId: active.id,
        active: true,
      };
    } else {
      this.longOrder = null;
    }

    if (this.config.enableShortEntry) {
      this.shortOrder = {
        id: `S-${active.id}-${active.tradeCount + 1}`,
        side: 'short',
        price: active.levels.p123,
        quantity,
        createdAt: orderTimestamp,
        motherBarId: active.id,
        active: true,
      };
    } else {
      this.shortOrder = null;
    }
  }

  evaluateEntry(sample: SecondBar, active: MotherBarState): EntryPlan | null {
    if (active.invalidated) {
      return null;
    }

    if (this.longOrder?.active && priceTouches(sample.low, sample.high, this.longOrder.price)) {
      const price = this.longOrder.price;
      this.longOrder.active = false;
      this.shortOrder = null;
      return { side: 'long', price };
    }

    if (this.shortOrder?.active && priceTouches(sample.low, sample.high, this.shortOrder.price)) {
      const price = this.shortOrder.price;
      this.shortOrder.active = false;
      this.longOrder = null;
      return { side: 'short', price };
    }

    return null;
  }

  cancelAll(): void {
    this.longOrder = null;
    this.shortOrder = null;
  }
}
