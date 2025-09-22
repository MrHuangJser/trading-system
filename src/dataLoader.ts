import { parseTimestamp } from './time';
import type { SecondBar } from './types';

export async function loadSecondBars(filePath: string): Promise<SecondBar[]> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Data file not found: ${filePath}`);
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }
  const [, ...dataLines] = lines;
  return dataLines.map((line) => {
    const [timestampRaw, openStr, highStr, lowStr, closeStr, volumeStr] = line.split(',');
    if (!timestampRaw) {
      throw new Error(`Missing timestamp in line: ${line}`);
    }
    const timestamp = parseTimestamp(timestampRaw);
    const open = Number(openStr);
    const high = Number(highStr);
    const low = Number(lowStr);
    const close = Number(closeStr);
    const volume = Number(volumeStr);
    if ([open, high, low, close, volume].some((value) => Number.isNaN(value))) {
      throw new Error(`Invalid numeric value in line: ${line}`);
    }
    return {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    } satisfies SecondBar;
  });
}
