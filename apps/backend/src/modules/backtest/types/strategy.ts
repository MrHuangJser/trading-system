import type { OhlcvRecord } from '../../shared/services/aggregation.service';

export interface Strategy<Params> {
  onInit(params: Params): void;
  onCandle(candle: OhlcvRecord): void;
}
