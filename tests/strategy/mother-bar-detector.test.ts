import { describe, expect, test } from 'bun:test';
import { MotherBarDetector } from '../../src/strategy';
import { parseTimestamp } from '../../src/time';
import type { Timeframe } from '../../src/lib/timeframe';
import type { TimeframeBar } from '../../src/types';

function buildBar(
  timeframe: Timeframe,
  start: string,
  end: string,
  prices: { open: number; high: number; low: number; close: number },
): TimeframeBar {
  return {
    timeframe,
    startTimestamp: parseTimestamp(start),
    endTimestamp: parseTimestamp(end),
    open: prices.open,
    high: prices.high,
    low: prices.low,
    close: prices.close,
    volume: 0,
  };
}

describe('MotherBarDetector', () => {
  test('detects inside bars and pending setups across timeframes', () => {
    const detector = new MotherBarDetector();

    const mother1m = buildBar('1m', '2023-12-15 08:30:00', '2023-12-15 08:30:59', {
      open: 100,
      high: 102,
      low: 98,
      close: 101,
    });
    const inside1m = buildBar('1m', '2023-12-15 08:31:00', '2023-12-15 08:31:59', {
      open: 101,
      high: 101,
      low: 99,
      close: 100,
    });

    expect(detector.process(mother1m, { positionOpen: false })).toBeNull();
    const activated1m = detector.process(inside1m, { positionOpen: false });
    expect(activated1m).not.toBeNull();
    expect(activated1m?.levels.n23).toBeCloseTo(97.08, 2);

    const followUpInside = buildBar('1m', '2023-12-15 08:32:00', '2023-12-15 08:32:59', {
      open: 100,
      high: 100.5,
      low: 99.2,
      close: 99.5,
    });

    expect(detector.process(followUpInside, { positionOpen: true })).toBeNull();
    expect(detector.hasPending()).toBe(true);

    detector.clearActive();
    const promoted = detector.promotePending();
    expect(promoted).not.toBeNull();
    expect(promoted?.mother.startTimestamp.time).toBe('08:31:00');

    detector.reset();

    const mother5m = buildBar('5m', '2023-12-15 08:30:00', '2023-12-15 08:34:59', {
      open: 100,
      high: 102,
      low: 98,
      close: 100,
    });
    const inside5m = buildBar('5m', '2023-12-15 08:35:00', '2023-12-15 08:39:59', {
      open: 100,
      high: 101,
      low: 99,
      close: 100,
    });

    detector.process(mother5m, { positionOpen: false });
    const activated5m = detector.process(inside5m, { positionOpen: false });
    expect(activated5m).not.toBeNull();
    expect(activated5m?.mother.timeframe).toBe('5m');
  });
});
