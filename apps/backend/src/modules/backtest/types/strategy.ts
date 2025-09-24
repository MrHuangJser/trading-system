import type { OhlcvRecord } from '../../shared/types/ohlcv';

export interface Strategy<Params> {
  onInit(params: Params): void;
  onCandle(candle: OhlcvRecord): void;
}
