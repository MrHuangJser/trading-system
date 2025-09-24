import { Timeframe, OhlcvRecord } from '../types/ohlcv';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  [Timeframe.ONE_MINUTE]: 60,
  [Timeframe.FIVE_MINUTES]: 5 * 60,
  [Timeframe.FIFTEEN_MINUTES]: 15 * 60,
  [Timeframe.THIRTY_MINUTES]: 30 * 60,
  [Timeframe.ONE_HOUR]: 60 * 60,
};

export function getTimeframeSeconds(timeframe: Timeframe): number | undefined {
  return TIMEFRAME_SECONDS[timeframe];
}

export function getBucketStart(epochSeconds: number, timeframeSeconds: number) {
  return epochSeconds - (epochSeconds % timeframeSeconds);
}

export function formatTimestamp(epochSeconds: number) {
  const date = new Date(epochSeconds * 1000);
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export interface CandleSeed {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function buildCandleFromSeed(
  seed: CandleSeed,
  bucketStart: number
): OhlcvRecord {
  return {
    datetime: formatTimestamp(bucketStart),
    open: seed.open,
    high: seed.high,
    low: seed.low,
    close: seed.close,
    volume: seed.volume,
  };
}
