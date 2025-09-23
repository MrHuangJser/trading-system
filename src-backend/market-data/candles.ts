import { TimeframeAggregator } from '../aggregation/timeframe-aggregator';
import { timestampToUnixMs } from '../core/time';
import type { CandleExportRow, SecondBar, TimeframeBar, Timeframe } from '../core';

export function buildCandlesForTimeframe(seconds: SecondBar[], timeframe: Timeframe): CandleExportRow[] {
  const aggregator = new TimeframeAggregator(timeframe);
  const candles: CandleExportRow[] = [];
  for (const sample of seconds) {
    const completed = aggregator.add(sample);
    if (completed) {
      candles.push(toCandle(completed));
    }
  }
  const trailing = aggregator.flush();
  if (trailing) {
    candles.push(toCandle(trailing));
  }
  return candles;
}

function toCandle(bar: TimeframeBar): CandleExportRow {
  return {
    timestamp: timestampToUnixMs(bar.startTimestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    raw: bar.startTimestamp.raw,
  };
}
