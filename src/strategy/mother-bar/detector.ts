import { minuteKey } from '../../time';
import type { MotherBarState, PendingMotherBar, TimeframeBar } from '../../types';
import { calculateLevels, isInsideBar } from './utils';

interface ProcessOptions {
  positionOpen: boolean;
}

export class MotherBarDetector {
  private active: MotherBarState | null = null;
  private pending: PendingMotherBar | null = null;
  private previousRthBar: TimeframeBar | null = null;

  reset(): void {
    this.active = null;
    this.pending = null;
    this.previousRthBar = null;
  }

  getActive(): MotherBarState | null {
    return this.active;
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  process(bar: TimeframeBar, options: ProcessOptions): MotherBarState | null {
    let activated: MotherBarState | null = null;

    if (!this.previousRthBar) {
      this.previousRthBar = bar;
      return null;
    }

    if (isInsideBar(bar, this.previousRthBar)) {
      activated = this.activateMotherBar(this.previousRthBar, bar, options.positionOpen);
    }

    this.previousRthBar = bar;
    return activated;
  }

  promotePending(): MotherBarState | null {
    if (!this.pending) {
      return null;
    }
    const { mother, inside } = this.pending;
    this.pending = null;
    const size = mother.high - mother.low;
    if (size <= 0) {
      return null;
    }
    const levels = calculateLevels(mother.low, size);
    const id = `${minuteKey(mother.startTimestamp)}->${minuteKey(inside.startTimestamp)}`;
    this.active = {
      id,
      mother,
      inside,
      levels,
      tradeCount: 0,
      invalidated: false,
    };
    return this.active;
  }

  clearActive(): void {
    this.active = null;
  }

  markInvalidated(): void {
    if (this.active) {
      this.active.invalidated = true;
    }
  }

  private activateMotherBar(
    mother: TimeframeBar,
    inside: TimeframeBar,
    positionOpen: boolean,
  ): MotherBarState | null {
    if (this.active) {
      if (positionOpen) {
        this.pending = { mother, inside };
      }
      return null;
    }
    const size = mother.high - mother.low;
    if (size <= 0) {
      return null;
    }
    const levels = calculateLevels(mother.low, size);
    const id = `${minuteKey(mother.startTimestamp)}->${minuteKey(inside.startTimestamp)}`;
    this.active = {
      id,
      mother,
      inside,
      levels,
      tradeCount: 0,
      invalidated: false,
    };
    return this.active;
  }
}
