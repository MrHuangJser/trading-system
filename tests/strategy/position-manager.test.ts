import { describe, expect, test } from 'bun:test';
import { PositionManager } from '../../src/strategy/modules/position-manager';
import { calculateLevels } from '../../src/strategy/mother-bar/utils';
import { parseTimestamp } from '../../src/time';
import type {
  MinuteBar,
  MotherBarState,
  SecondBar,
  StrategyConfig,
} from '../../src/types';

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

function buildMinuteBar(start: string, high: number, low: number): MinuteBar {
  return {
    startTimestamp: parseTimestamp(`${start}:00`),
    endTimestamp: parseTimestamp(`${start}:59`),
    open: high,
    high,
    low,
    close: low,
    volume: 60,
  };
}

function buildMotherBarState(): MotherBarState {
  const mother = buildMinuteBar('2023-12-15 08:30', 102, 100);
  const inside: MinuteBar = {
    ...mother,
    startTimestamp: parseTimestamp('2023-12-15 08:31:00'),
    endTimestamp: parseTimestamp('2023-12-15 08:31:59'),
    open: 101.5,
    high: 101.6,
    low: 100.4,
    close: 100.6,
  };

  return {
    id: 'mb-1',
    mother,
    inside,
    levels: calculateLevels(mother.low, mother.high - mother.low),
    tradeCount: 0,
    invalidated: false,
  };
}

function second(timestamp: string, values: Pick<SecondBar, 'open' | 'high' | 'low' | 'close'>): SecondBar {
  return {
    timestamp: parseTimestamp(timestamp),
    volume: 1,
    ...values,
  };
}

describe('PositionManager add-on handling', () => {
  test('long add moves take-profit to breakeven and closes near zero PnL', () => {
    const manager = new PositionManager(baseConfig);
    const motherBar = buildMotherBarState();

    const entryPrice = motherBar.levels.n23;
    const addPrice = motherBar.levels.n100;
    const expectedBreakeven = (entryPrice + addPrice) / 2;

    manager.openPosition(
      { side: 'long', price: entryPrice },
      second('2023-12-15 08:31:00', {
        open: entryPrice,
        high: entryPrice + 0.1,
        low: entryPrice - 0.1,
        close: entryPrice,
      }),
      motherBar,
    );

    expect(manager.hasOpenPosition()).toBe(true);

    const addResult = manager.evaluateSecond(
      second('2023-12-15 08:31:30', {
        open: addPrice,
        high: addPrice + 0.1,
        low: addPrice - 0.1,
        close: addPrice,
      }),
      motherBar,
    );

    expect(addResult).toBeNull();

    const position = manager.getPosition();
    expect(position).not.toBeNull();
    expect(position?.addExecuted).toBe(true);
    expect(position?.takeProfit).toBeCloseTo(expectedBreakeven, 6);
    expect(position?.averagePrice).toBeCloseTo(expectedBreakeven, 6);

    const closeTrade = manager.evaluateSecond(
      second('2023-12-15 08:31:45', {
        open: addPrice,
        high: expectedBreakeven + 0.2,
        low: addPrice - 0.2,
        close: expectedBreakeven + 0.1,
      }),
      motherBar,
    );

    expect(closeTrade).not.toBeNull();
    expect(closeTrade?.exitReason).toBe('take-profit');
    expect(closeTrade?.addExecuted).toBe(true);
    expect(closeTrade?.exitPrice).toBeCloseTo(expectedBreakeven, 6);
    expect(closeTrade?.pnlPoints).toBeCloseTo(0, 6);
    expect(closeTrade?.pnlCurrency).toBeCloseTo(0, 6);
    expect(manager.hasOpenPosition()).toBe(false);
  });

  test('short add moves take-profit to breakeven and closes near zero PnL', () => {
    const manager = new PositionManager(baseConfig);
    const motherBar = buildMotherBarState();

    const entryPrice = motherBar.levels.p123;
    const addPrice = motherBar.levels.p200;
    const expectedBreakeven = (entryPrice + addPrice) / 2;

    manager.openPosition(
      { side: 'short', price: entryPrice },
      second('2023-12-15 08:32:00', {
        open: entryPrice,
        high: entryPrice + 0.1,
        low: entryPrice - 0.1,
        close: entryPrice,
      }),
      motherBar,
    );

    expect(manager.hasOpenPosition()).toBe(true);

    const addResult = manager.evaluateSecond(
      second('2023-12-15 08:32:30', {
        open: addPrice,
        high: addPrice + 0.05,
        low: addPrice - 0.05,
        close: addPrice,
      }),
      motherBar,
    );

    expect(addResult).toBeNull();

    const position = manager.getPosition();
    expect(position).not.toBeNull();
    expect(position?.addExecuted).toBe(true);
    expect(position?.takeProfit).toBeCloseTo(expectedBreakeven, 6);
    expect(position?.averagePrice).toBeCloseTo(expectedBreakeven, 6);

    const closeTrade = manager.evaluateSecond(
      second('2023-12-15 08:32:45', {
        open: addPrice,
        high: addPrice + 0.2,
        low: expectedBreakeven - 0.2,
        close: expectedBreakeven - 0.1,
      }),
      motherBar,
    );

    expect(closeTrade).not.toBeNull();
    expect(closeTrade?.exitReason).toBe('take-profit');
    expect(closeTrade?.addExecuted).toBe(true);
    expect(closeTrade?.exitPrice).toBeCloseTo(expectedBreakeven, 6);
    expect(closeTrade?.pnlPoints).toBeCloseTo(0, 6);
    expect(closeTrade?.pnlCurrency).toBeCloseTo(0, 6);
    expect(manager.hasOpenPosition()).toBe(false);
  });
});
