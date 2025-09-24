export enum Timeframe {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
}

export interface OhlcvRecord {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
