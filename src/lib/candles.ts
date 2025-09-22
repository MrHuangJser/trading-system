import { MinuteAggregator } from '../aggregation';
import { timestampToUnixMs } from '../time';
import type { CandleExportRow, SecondBar } from '../types';

/**
 * Convert 1-second OHLCV samples into 1-minute candles.
 */
export function buildMinuteCandles(seconds: SecondBar[]): CandleExportRow[] {
  const aggregator = new MinuteAggregator();
  const minuteBars = [];
  for (const sample of seconds) {
    const completed = aggregator.add(sample);
    if (completed) {
      minuteBars.push(completed);
    }
  }
  const trailing = aggregator.flush();
  if (trailing) {
    minuteBars.push(trailing);
  }

  return minuteBars.map((bar) => ({
    timestamp: timestampToUnixMs(bar.startTimestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    raw: bar.startTimestamp.raw,
  }));
}
