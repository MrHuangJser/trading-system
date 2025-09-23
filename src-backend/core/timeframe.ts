export const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h'] as const;

export type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
};

export function timeframeToMinutes(timeframe: Timeframe): number {
  return TIMEFRAME_MINUTES[timeframe];
}

export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

export function timeframeToSeconds(timeframe: Timeframe): number {
  return minutesToSeconds(timeframeToMinutes(timeframe));
}

export function isTimeframe(value: string): value is Timeframe {
  return (SUPPORTED_TIMEFRAMES as readonly string[]).includes(value);
}
