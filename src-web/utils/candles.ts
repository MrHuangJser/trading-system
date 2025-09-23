import type {
  CandleDatum,
  ParsedTimestamp,
  TimeframeBar,
} from '../types';

interface CandleWithTimestamp {
  timestamp: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  raw?: string;
}

type CandleInput = CandleWithTimestamp | TimeframeBar;

function normalizeTimestampValue(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    throw new Error(`无法解析时间戳：${value}`);
  }
  return parsed;
}

export function parsedTimestampToUnixMs(parsed: ParsedTimestamp): number {
  return Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
  );
}

function isTimeframeBar(value: CandleInput): value is TimeframeBar {
  return typeof (value as TimeframeBar)?.startTimestamp === 'object';
}

export function normalizeCandle(input: CandleInput): CandleDatum {
  if (isTimeframeBar(input)) {
    return {
      timestamp: parsedTimestampToUnixMs(input.startTimestamp),
      open: input.open,
      high: input.high,
      low: input.low,
      close: input.close,
      volume: input.volume,
      raw: input.startTimestamp.raw,
    };
  }

  const timestamp = normalizeTimestampValue(input.timestamp);
  const rawTimestamp =
    typeof input.raw === 'string'
      ? input.raw
      : typeof input.timestamp === 'string'
        ? input.timestamp
        : String(input.timestamp);

  return {
    timestamp,
    open: input.open,
    high: input.high,
    low: input.low,
    close: input.close,
    volume: input.volume,
    raw: rawTimestamp,
  } satisfies CandleDatum;
}

export function normalizeCandles<T extends CandleInput>(candles: T[]): CandleDatum[] {
  return candles.map((candle) => normalizeCandle(candle));
}

export function toKLineData(candle: CandleDatum) {
  return {
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

export function toKLineDataList(candles: CandleDatum[]) {
  return candles.map((candle) => toKLineData(candle));
}
