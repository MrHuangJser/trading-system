import type { MotherBarLevels, TimeframeBar } from '../../types';

export function calculateLevels(low: number, size: number): MotherBarLevels {
  return {
    p300: low + size * 3,
    p200: low + size * 2,
    p161_8: low + size * 1.618,
    p127_2: low + size * 1.272,
    p123: low + size * 1.23,
    p111: low + size * 1.11,
    p100: low + size * 1,
    p89: low + size * 0.89,
    p79: low + size * 0.79,
    p66: low + size * 0.66,
    p50: low + size * 0.5,
    p33: low + size * 0.33,
    p21: low + size * 0.21,
    p11: low + size * 0.11,
    p0: low,
    n11: low - size * 0.11,
    n23: low - size * 0.23,
    n61_8: low - size * 0.618,
    n100: low - size,
    n200: low - size * 2,
  };
}

export function priceTouches(low: number, high: number, price: number): boolean {
  return price >= low && price <= high;
}

export function isInsideBar(current: TimeframeBar, previous: TimeframeBar): boolean {
  return current.high <= previous.high && current.low >= previous.low;
}
