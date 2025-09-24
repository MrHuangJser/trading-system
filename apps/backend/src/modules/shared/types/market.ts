export interface MarketTick {
  /**
   * 以毫秒为单位的Unix时间戳。
   */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
}
