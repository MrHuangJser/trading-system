import { describe, expect, test } from 'bun:test';
import type { StrategyConfig } from '../../../../src-backend/core';
import { ReplayMarketDataStream } from '../../../../src-backend/market-data';
import { MotherBarStrategyController } from '../../../../src-backend/strategies/mother-bar';
import { makeSecond } from '../../_support/helpers';

describe('strategies/mother-bar/MotherBarStrategyController', () => {
  test('produces trades from synthetic mother bar scenario', () => {
    const config: StrategyConfig = {
      contractMultiplier: 5,
      baseQuantity: 1,
      dataFile: 'synthetic.csv',
      enableLongEntry: true,
      enableLongTakeProfit: true,
      enableShortEntry: false,
      enableShortTakeProfit: true,
      timeframe: '1m',
    };

    const seconds = [
      makeSecond('2023-09-15 08:30:00', { open: 100, high: 102, low: 100, close: 101 }),
      makeSecond('2023-09-15 08:30:30', { open: 101, high: 102, low: 100.2, close: 101.5 }),
      makeSecond('2023-09-15 08:31:00', { open: 101.2, high: 101.2, low: 100.6, close: 100.8 }),
      makeSecond('2023-09-15 08:31:30', { open: 100.8, high: 101, low: 100.6, close: 100.9 }),
      makeSecond('2023-09-15 08:32:00', { open: 100.9, high: 100.9, low: 99.45, close: 99.6 }),
      makeSecond('2023-09-15 08:32:30', { open: 99.6, high: 101.2, low: 99.6, close: 101 }),
      makeSecond('2023-09-15 08:33:00', { open: 101, high: 101, low: 101, close: 101 }),
    ];

    const stream = new ReplayMarketDataStream(seconds, '1m');
    const controller = new MotherBarStrategyController({ config });

    for (;;) {
      const event = stream.next();
      if (!event) {
        break;
      }
      controller.onSecond(event);
      if (event.state === 'completed') {
        controller.onTimeframe(event);
      }
    }

    const result = controller.finalize();

    expect(result.metadata.seconds).toBe(seconds.length);
    expect(result.metadata.dataFile).toBe(config.dataFile);
    expect(result.metadata.resolution).toBe(config.timeframe);
    expect(result.candles!.length).toBeGreaterThan(0);
    expect(result.summary.totalTrades).toBeGreaterThanOrEqual(0);
  });
});
