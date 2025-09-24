interface ImportMetaEnv {
  readonly PUBLIC_API_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h';
type OhlcvRecord = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
