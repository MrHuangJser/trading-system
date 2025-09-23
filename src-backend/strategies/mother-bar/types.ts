import type { TimeframeBar } from '../../core';

export interface MotherBarLevels {
  p300: number;
  p200: number;
  p161_8: number;
  p127_2: number;
  p123: number;
  p111: number;
  p100: number;
  p89: number;
  p79: number;
  p66: number;
  p50: number;
  p33: number;
  p21: number;
  p11: number;
  p0: number;
  n11: number;
  n23: number;
  n61_8: number;
  n100: number;
  n200: number;
}

export interface MotherBarState {
  id: string;
  mother: TimeframeBar;
  inside: TimeframeBar;
  levels: MotherBarLevels;
  tradeCount: number;
  invalidated: boolean;
}

export interface PendingMotherBar {
  mother: TimeframeBar;
  inside: TimeframeBar;
}
