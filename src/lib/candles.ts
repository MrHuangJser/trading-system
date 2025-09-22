import { TimeframeAggregator } from '../aggregation';
import { timestampToUnixMs } from '../time';
import type { CandleExportRow, SecondBar } from '../types';
import type { Timeframe } from './timeframe';

/**
 * Convert 1-second OHLCV samples into candles for the requested timeframe.
 */
export function buildCandlesForTimeframe(
  seconds: SecondBar[],
  timeframe: Timeframe,
): CandleExportRow[] {
  const aggregator = new TimeframeAggregator(timeframe);
  const timeframeBars = [];
  for (const sample of seconds) {
    const completed = aggregator.add(sample);
    if (completed) {
      timeframeBars.push(completed);
    }
  }
  const trailing = aggregator.flush();
  if (trailing) {
    timeframeBars.push(trailing);
  }

  return timeframeBars.map((bar) => ({
    timestamp: timestampToUnixMs(bar.startTimestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    raw: bar.startTimestamp.raw,
  }));
}

/**
 * Convert 1-second OHLCV samples into 1-minute candles.
 */
export function buildMinuteCandles(seconds: SecondBar[]): CandleExportRow[] {
  return buildCandlesForTimeframe(seconds, '1m');
}
