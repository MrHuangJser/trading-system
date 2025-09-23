import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { CsvSecondBarSource, ReplayMarketDataStream, buildCandlesForTimeframe } from '../../../src-backend/market-data';
import { timeframeToSeconds } from '../../../src-backend/core/timeframe';

const DATASET_PATH = resolve(process.cwd(), 'data', 'MESZ3-OHLC1s-20231215.csv');

describe('market-data CSV source', () => {
  test('loads seconds and caches responses', async () => {
    const source = new CsvSecondBarSource(DATASET_PATH);
    const seconds = await source.loadSeconds();
    expect(seconds.length).toBeGreaterThan(0);

    const again = await source.loadSeconds();
    expect(again).toBe(seconds);

    const first = seconds[0]!;
    expect(first.timestamp.raw).toBe('2023-09-15 08:30:00');
    expect(first.open).toBeCloseTo(4537);
  });

  test('replay stream yields forming and completed bars', async () => {
    const source = new CsvSecondBarSource(DATASET_PATH);
    const seconds = await source.loadSeconds();
    const subset = seconds.slice(0, timeframeToSeconds('1m') * 2 + 5);
    const stream = new ReplayMarketDataStream(subset, '1m');

    let forming = 0;
    let completed = 0;

    for (;;) {
      const event = stream.next();
      if (!event) {
        break;
      }
      if (event.state === 'forming') {
        forming += 1;
      } else {
        completed += 1;
        expect(event.timeframe.startTimestamp.minute).toBeDefined();
      }
    }

    expect(forming).toBeGreaterThan(0);
    expect(completed).toBeGreaterThan(0);
    expect(stream.getLastForming()).not.toBeNull();
  });

  test('buildCandlesForTimeframe aggregates to minute candles', async () => {
    const source = new CsvSecondBarSource(DATASET_PATH);
    const seconds = (await source.loadSeconds()).slice(0, 120);
    const candles = buildCandlesForTimeframe(seconds, '1m');
    expect(candles.length).toBeGreaterThanOrEqual(2);
    expect(candles[0]!.timestamp).toBeLessThan(candles[1]!.timestamp);
  });
});
