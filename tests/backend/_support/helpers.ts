import { parseTimestamp } from '../../../src-backend/core/time';
import type { SecondBar } from '../../../src-backend/core/types';

export function makeSecond(
  raw: string,
  values: { open: number; high: number; low: number; close: number; volume?: number },
): SecondBar {
  return {
    timestamp: parseTimestamp(raw),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    volume: values.volume ?? 0,
  } satisfies SecondBar;
}

export function sliceSeconds(seconds: SecondBar[], limit: number): SecondBar[] {
  return seconds.slice(0, limit);
}
