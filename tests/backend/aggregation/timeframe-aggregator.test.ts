import { describe, expect, test } from 'bun:test';
import { TimeframeAggregator } from '../../../src-backend/aggregation/timeframe-aggregator';
import { makeSecond } from '../_support/helpers';

describe('aggregation/TimeframeAggregator', () => {
  test('aggregates seconds into timeframe bars and flushes trailing', () => {
    const aggregator = new TimeframeAggregator('1m');
    const first = makeSecond('2023-09-15 08:30:00', {
      open: 100,
      high: 101,
      low: 99.5,
      close: 100.5,
    });
    const second = makeSecond('2023-09-15 08:30:30', {
      open: 100.5,
      high: 102,
      low: 100,
      close: 101,
    });
    const third = makeSecond('2023-09-15 08:31:00', {
      open: 101,
      high: 101.5,
      low: 100.5,
      close: 101.25,
    });

    const completed = aggregator.add(first);
    expect(completed).toBeNull();

    const stillForming = aggregator.add(second);
    expect(stillForming).toBeNull();

    const closed = aggregator.add(third);
    expect(closed).not.toBeNull();
    expect(closed?.startTimestamp.raw).toBe('2023-09-15 08:30:00');
    expect(closed?.high).toBe(102);
    expect(closed?.low).toBe(99.5);

    const trailing = aggregator.flush();
    expect(trailing).not.toBeNull();
    expect(trailing?.startTimestamp.raw).toBe('2023-09-15 08:31:00');
    expect(trailing?.high).toBe(101.5);
  });
});
