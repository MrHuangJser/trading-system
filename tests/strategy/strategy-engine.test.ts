import { describe, expect, test } from 'bun:test';
import { StrategyEngine } from '../../src/strategy';
import { parseTimestamp } from '../../src/time';
import type { SecondBar, StrategyConfig } from '../../src/types';

type BarValues = Pick<SecondBar, 'open' | 'high' | 'low' | 'close'> & { volume?: number };

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

function buildFeed(): SecondBar[] {
  const base = '2023-12-15';
  return [
    buildSecond(`${base} 08:30:00`, { open: 100, high: 102, low: 98, close: 101 }),
    buildSecond(`${base} 08:31:00`, { open: 101, high: 101, low: 99, close: 100 }),
    buildSecond(`${base} 08:32:00`, { open: 100, high: 101, low: 99.2, close: 100 }),
    buildSecond(`${base} 08:33:00`, { open: 100, high: 101, low: 99.3, close: 100 }),
    buildSecond(`${base} 08:34:00`, { open: 100, high: 101, low: 99.1, close: 100 }),
    buildSecond(`${base} 08:35:00`, { open: 100, high: 101, low: 99, close: 100 }),
    buildSecond(`${base} 08:36:00`, { open: 100, high: 101, low: 99.1, close: 100 }),
    buildSecond(`${base} 08:37:00`, { open: 100, high: 101, low: 99.2, close: 100 }),
    buildSecond(`${base} 08:38:00`, { open: 100, high: 101, low: 99.3, close: 100 }),
    buildSecond(`${base} 08:39:00`, { open: 100, high: 101, low: 99.2, close: 100 }),
    buildSecond(`${base} 08:40:00`, { open: 100, high: 100.5, low: 99.5, close: 100 }),
    buildSecond(`${base} 08:41:00`, { open: 99, high: 99, low: 97, close: 97.5 }),
    buildSecond(`${base} 08:42:00`, { open: 97.5, high: 99.5, low: 97.5, close: 99 }),
    buildSecond(`${base} 08:43:00`, { open: 99, high: 101, low: 98.5, close: 100.5 }),
    buildSecond(`${base} 08:44:00`, { open: 100, high: 100.2, low: 99.5, close: 99.8 }),
  ];
}

describe('StrategyEngine', () => {
  test('executes consistent trades across multiple timeframes', () => {
    const feed = buildFeed();

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

    const summary1m = StrategyEngine.run(feed, baseConfig);
    const summary5m = StrategyEngine.run(feed, { ...baseConfig, timeframe: '5m' });

    expect(summary1m.totalTrades).toBe(1);
    expect(summary5m.totalTrades).toBe(1);

    const trade1m = summary1m.trades[0];
    const trade5m = summary5m.trades[0];

    expect(trade1m.side).toBe('long');
    expect(trade5m.side).toBe('long');
    expect(trade1m.exitReason).toBe('take-profit');
    expect(trade5m.exitReason).toBe('take-profit');

    expect(trade1m.entryPrice).toBeCloseTo(trade5m.entryPrice, 5);
    expect(trade1m.exitPrice).toBeCloseTo(trade5m.exitPrice, 5);
    expect(summary1m.netPnlPoints).toBeCloseTo(summary5m.netPnlPoints, 5);
  });
});
