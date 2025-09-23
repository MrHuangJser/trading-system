import { parseTimestamp } from '../../core/time';
import type { SecondBar, Timeframe } from '../../core';
import { ReplayMarketDataStream } from '../streams/replay-market-data-stream';
import type { MarketDataSource, MarketDataStream } from '../interfaces';

interface CacheEntry {
  mtimeMs: number;
  data: SecondBar[];
}

export class CsvSecondBarSource implements MarketDataSource {
  private cache: CacheEntry | null = null;

  constructor(private readonly filePath: string) {}

  async openStream(timeframe: Timeframe): Promise<MarketDataStream> {
    const seconds = await this.loadSeconds();
    return new ReplayMarketDataStream(seconds, timeframe);
  }

  async loadSeconds(): Promise<SecondBar[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) {
      throw new Error(`Data file not found: ${this.filePath}`);
    }

    const mtimeMs = file.lastModified ?? Date.now();
    if (this.cache && this.cache.mtimeMs === mtimeMs) {
      return this.cache.data;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) {
      this.cache = { data: [], mtimeMs };
      return [];
    }

    const [, ...dataLines] = lines;
    const data = dataLines.map((line) => parseLine(line));
    this.cache = { data, mtimeMs };
    return data;
  }
}

function parseLine(line: string): SecondBar {
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
}
