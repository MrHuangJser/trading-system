import { describe, expect, test } from 'bun:test';
import { PositionManager, TradeReporter } from '../../../src-backend/execution';
import type { StrategyConfig } from '../../../src-backend/core';
import { makeSecond } from '../_support/helpers';

const baseConfig: StrategyConfig = {
  contractMultiplier: 5,
  baseQuantity: 1,
  dataFile: 'fixture.csv',
  enableLongEntry: true,
  enableLongTakeProfit: true,
  enableShortEntry: true,
  enableShortTakeProfit: true,
  timeframe: '1m',
};

describe('execution/PositionManager', () => {
  test('opens position, executes add-on, and closes with take profit', () => {
    const manager = new PositionManager(baseConfig);

    manager.open({
      side: 'long',
      entryPrice: 100,
      quantity: 1,
      timestamp: makeSecond('2023-09-15 08:30:00', {
        open: 100,
        high: 100,
        low: 100,
        close: 100,
      }).timestamp,
      takeProfit: 101,
      takeProfitEnabled: true,
      stopLoss: 98,
      referenceId: 'mother-1',
    });

    manager.configureAddPlan({ price: 99.5, quantity: 1, updateTakeProfitToAverage: true });

    const addSecond = makeSecond('2023-09-15 08:30:10', {
      open: 99.8,
      high: 99.7,
      low: 99.4,
      close: 99.5,
    });
    expect(manager.evaluate(addSecond)).toBeNull();

    const positionAfterAdd = manager.getPosition();
    expect(positionAfterAdd?.quantity).toBe(2);
    expect(positionAfterAdd?.averagePrice).toBeCloseTo(99.75);
    expect(positionAfterAdd?.takeProfit).toBeCloseTo(99.75);

    const tpSecond = makeSecond('2023-09-15 08:30:20', {
      open: 100,
      high: 100.5,
      low: 99.7,
      close: 100.2,
    });
    const closed = manager.evaluate(tpSecond);
    expect(closed).not.toBeNull();
    expect(closed?.exitReason).toBe('take-profit');
    expect(closed?.pnlPoints).toBeCloseTo(0);
  });

  test('forceExit closes open positions immediately', () => {
    const manager = new PositionManager(baseConfig);

    manager.open({
      side: 'short',
      entryPrice: 105,
      quantity: 1,
      timestamp: makeSecond('2023-09-15 08:30:00', {
        open: 105,
        high: 105,
        low: 105,
        close: 105,
      }).timestamp,
      takeProfit: 103,
      takeProfitEnabled: true,
      stopLoss: 107,
      referenceId: 'mother-2',
    });

    const exitSecond = makeSecond('2023-09-15 08:30:05', {
      open: 104,
      high: 104,
      low: 104,
      close: 104,
    });
    const forced = manager.forceExit(exitSecond, 'manual');
    expect(forced).not.toBeNull();
    expect(forced?.exitReason).toBe('manual');
    expect(manager.hasOpenPosition()).toBe(false);
  });
});

describe('execution/TradeReporter', () => {
  test('records trades and summarises pnl', () => {
    const reporter = new TradeReporter();
    reporter.record({
      side: 'long',
      quantity: 1,
      entryPrice: 100,
      entryTime: makeSecond('2023-09-15 08:30:00', {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }).timestamp,
      averageEntryPrice: 100,
      exitPrice: 101,
      exitTime: makeSecond('2023-09-15 08:35:00', {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }).timestamp,
      exitReason: 'take-profit',
      pnlPoints: 1,
      pnlCurrency: 5,
      strategyRef: 'mother-1',
      addExecuted: false,
    });

    reporter.record({
      side: 'short',
      quantity: 1,
      entryPrice: 105,
      entryTime: makeSecond('2023-09-15 09:00:00', {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }).timestamp,
      averageEntryPrice: 105,
      exitPrice: 106,
      exitTime: makeSecond('2023-09-15 09:10:00', {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }).timestamp,
      exitReason: 'stop-loss',
      pnlPoints: -1,
      pnlCurrency: -5,
      strategyRef: 'mother-2',
      addExecuted: false,
    });

    const summary = reporter.getSummary();
    expect(summary.totalTrades).toBe(2);
    expect(summary.winningTrades).toBe(1);
    expect(summary.losingTrades).toBe(1);
    expect(summary.netPnlPoints).toBe(0);
  });
});
