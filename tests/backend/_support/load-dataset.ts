import { resolve } from 'node:path';
import { CsvSecondBarSource } from '../../../src-backend/market-data';
import type { SecondBar } from '../../../src-backend/core';

let cached: { path: string; seconds: SecondBar[] } | null = null;

export async function loadFixtureSeconds(): Promise<SecondBar[]> {
  const path = resolve(process.cwd(), 'data', 'MESZ3-OHLC1s-20231215.csv');
  if (cached && cached.path === path) {
    return cached.seconds;
  }
  const source = new CsvSecondBarSource(path);
  const seconds = await source.loadSeconds();
  cached = { path, seconds };
  return seconds;
}
