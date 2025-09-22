import { describe, expect, test } from 'bun:test';
import { PositionManager } from '../../src/strategy';
import { parseTimestamp } from '../../src/time';
import { calculateLevels } from '../../src/strategy/mother-bar/utils';
import type { MotherBarState, SecondBar, StrategyConfig } from '../../src/types';

type BarValues = Pick<SecondBar, 'open' | 'high' | 'low' | 'close'> & { volume?: number };

type MinuteValues = { open: number; high: number; low: number; close: number; volume?: number };

function buildSecond(timestamp: string, values: BarValues): SecondBar {
  return {
    timestamp: parseTimestamp(timestamp),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    volume: values.volume ?? 1,
  };
}

function buildMinute(start: string, end: string, values: MinuteValues) {
  return {
    startTimestamp: parseTimestamp(start),
    endTimestamp: parseTimestamp(end),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    volume: values.volume ?? 1,
  };
}

function buildMotherBarState(id: string): MotherBarState {
  const baseLow = 100;
  const range = 8;
  const levels = calculateLevels(baseLow, range);

  return {
    id,
    mother: buildMinute('2023-12-15 08:30:00', '2023-12-15 08:30:59', {
      open: baseLow + 4,
      high: baseLow + range,
      low: baseLow,
      close: baseLow + 5,
    }),
    inside: buildMinute('2023-12-15 08:31:00', '2023-12-15 08:31:59', {
      open: baseLow + 2,
      high: baseLow + range - 1,
      low: baseLow + 1,
      close: baseLow + 3,
    }),
    levels,
    tradeCount: 0,
    invalidated: false,
  };
}

const baseConfig: StrategyConfig = {
  baseQuantity: 1,
  contractMultiplier: 5,
  dataFile: 'test.csv',
  enableLongEntry: true,
  enableLongTakeProfit: true,
  enableShortEntry: true,
  enableShortTakeProfit: true,
  timeframe: '1m',
};

describe('PositionManager add-on take-profit adjustments', () => {
  test('long add-on shifts take-profit to an extended target without immediate loss exit', () => {
    const manager = new PositionManager(baseConfig);
    const motherBar = buildMotherBarState('MB-long');

    const entryPlan = { side: 'long' as const, price: motherBar.levels.n23 };
    const entrySample = buildSecond('2023-12-15 08:31:00', {
      open: 99,
      high: 100,
      low: 98,
      close: 99.5,
    });

    manager.openPosition(entryPlan, entrySample, motherBar);

    const addSample = buildSecond('2023-12-15 08:32:00', {
      open: 94,
      high: 96,
      low: 90,
      close: 92,
    });

    const addResult = manager.evaluateSecond(addSample, motherBar);
    expect(addResult).toBeNull();

    const positionAfterAdd = manager.getPosition();
    expect(positionAfterAdd).not.toBeNull();
    if (!positionAfterAdd) {
      throw new Error('position should exist after add-on');
    }

    expect(positionAfterAdd.addExecuted).toBe(true);
    expect(positionAfterAdd.takeProfit).toBeCloseTo(motherBar.levels.p161_8, 6);
    expect(positionAfterAdd.takeProfit).toBeGreaterThan(positionAfterAdd.averagePrice);

    const closeSample = buildSecond('2023-12-15 08:33:00', {
      open: 110,
      high: 116,
      low: 109,
      close: 115,
    });

    const closedTrade = manager.evaluateSecond(closeSample, motherBar);
    expect(closedTrade).not.toBeNull();
    if (!closedTrade) {
      throw new Error('trade should have closed at take-profit');
    }

    expect(closedTrade.exitReason).toBe('take-profit');
    expect(closedTrade.exitPrice).toBeCloseTo(motherBar.levels.p161_8, 6);
    expect(manager.getPosition()).toBeNull();
  });

  test('short add-on shifts take-profit to a downside target without immediate loss exit', () => {
    const manager = new PositionManager(baseConfig);
    const motherBar = buildMotherBarState('MB-short');

    const entryPlan = { side: 'short' as const, price: motherBar.levels.p123 };
    const entrySample = buildSecond('2023-12-15 08:31:00', {
      open: 110,
      high: 111,
      low: 109,
      close: 110,
    });

    manager.openPosition(entryPlan, entrySample, motherBar);

    const addSample = buildSecond('2023-12-15 08:32:00', {
      open: 109,
      high: 110,
      low: 100,
      close: 105,
    });

    const addResult = manager.evaluateSecond(addSample, motherBar);
    expect(addResult).toBeNull();

    const positionAfterAdd = manager.getPosition();
    expect(positionAfterAdd).not.toBeNull();
    if (!positionAfterAdd) {
      throw new Error('position should exist after add-on');
    }

    expect(positionAfterAdd.addExecuted).toBe(true);
    expect(positionAfterAdd.takeProfit).toBeCloseTo(motherBar.levels.n61_8, 6);
    expect(positionAfterAdd.takeProfit).toBeLessThan(positionAfterAdd.averagePrice);

    const closeSample = buildSecond('2023-12-15 08:33:00', {
      open: 100,
      high: 101,
      low: 94,
      close: 95,
    });

    const closedTrade = manager.evaluateSecond(closeSample, motherBar);
    expect(closedTrade).not.toBeNull();
    if (!closedTrade) {
      throw new Error('trade should have closed at take-profit');
    }

    expect(closedTrade.exitReason).toBe('take-profit');
    expect(closedTrade.exitPrice).toBeCloseTo(motherBar.levels.n61_8, 6);
    expect(manager.getPosition()).toBeNull();
  });
});
