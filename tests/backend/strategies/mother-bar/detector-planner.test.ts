import { describe, expect, test } from 'bun:test';
import { parseTimestamp } from '../../../../src-backend/core/time';
import type { StrategyConfig, TimeframeBar } from '../../../../src-backend/core';
import { MotherBarDetector } from '../../../../src-backend/strategies/mother-bar/detector';
import { OrderPlanner } from '../../../../src-backend/strategies/mother-bar/order-planner';
import type { MotherBarState } from '../../../../src-backend/strategies/mother-bar/types';
import { makeSecond } from '../../_support/helpers';

function buildBar(raw: string, values: { open: number; high: number; low: number; close: number }): TimeframeBar {
  const startTimestamp = parseTimestamp(raw);
  return {
    timeframe: '1m',
    startTimestamp,
    endTimestamp: startTimestamp,
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    volume: 0,
  } satisfies TimeframeBar;
}

describe('MotherBarDetector & OrderPlanner integration', () => {
  test('activates mother bar sequence and yields entry plans', () => {
    const detector = new MotherBarDetector();
    const mother = buildBar('2023-09-15 08:30:00', { open: 100, high: 102, low: 100, close: 101 });
    const inside = buildBar('2023-09-15 08:31:00', { open: 101, high: 101.5, low: 100.5, close: 101.1 });

    expect(detector.process(mother, { positionOpen: false })).toBeNull();
    const activated = detector.process(inside, { positionOpen: false });
    expect(activated).not.toBeNull();
    expect(activated?.levels.n23).toBeCloseTo(99.54);

    const config: StrategyConfig = {
      contractMultiplier: 5,
      baseQuantity: 1,
      dataFile: 'synthetic.csv',
      enableLongEntry: true,
      enableLongTakeProfit: true,
      enableShortEntry: true,
      enableShortTakeProfit: true,
      timeframe: '1m',
    };

    const planner = new OrderPlanner(config);
    planner.prepare(activated as MotherBarState);

    const touchSecond = makeSecond('2023-09-15 08:32:00', {
      open: 100,
      high: 101,
      low: 99.5,
      close: 100.2,
      volume: 1,
    });

    const entry = planner.evaluate(touchSecond, activated as MotherBarState);
    expect(entry).not.toBeNull();
    expect(entry?.side).toBe('long');
    expect(entry?.price).toBeCloseTo(activated!.levels.n23);
  });
});
