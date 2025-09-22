import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BunFile } from 'bun';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { loadSecondBars } from '../dataLoader';
import { resolveConfig } from '../config';
import { buildCandlesForTimeframe } from '../lib/candles';
import type { Timeframe } from '../lib/timeframe';
import type { CandleExportRow, SecondBar, StrategyConfig } from '../types';
import { DatasetRepository } from './dataset.repository';
import type { DatasetEntity } from './dataset.entity';

interface UploadDatasetMeta {
  originalName?: string;
  note?: string | null;
  activate?: boolean;
}

interface SecondsCacheEntry {
  data: SecondBar[];
  mtimeMs: number;
}

interface CandlesCacheEntry {
  data: CandleExportRow[];
  mtimeMs: number;
}

interface CsvAnalysisResult {
  rows: number;
  secondsStart: string | null;
  secondsEnd: string | null;
}

@Injectable()
export class DataService {
  private readonly datasetsDir: string;
  private readonly fallbackCacheKey = '__env__';
  private readonly secondsCache = new Map<string, SecondsCacheEntry>();
  private readonly candlesCache = new Map<string, Map<Timeframe, CandlesCacheEntry>>();

  constructor(private readonly repository: DatasetRepository) {
    this.datasetsDir = resolve(process.cwd(), 'storage', 'datasets');
    this.ensureDirectory(this.datasetsDir);
  }

  async saveUpload(file: BunFile, meta: UploadDatasetMeta): Promise<DatasetEntity> {
    if (!(await file.exists())) {
      throw new BadRequestException('Uploaded file not found');
    }
    const id = randomUUID();
    const originalName = meta.originalName?.trim() || file.name || 'dataset.csv';
    const extension = this.inferExtension(originalName);
    const filename = `${id}${extension}`;
    const destination = this.buildDatasetPath(filename);

    await this.copyFile(file, destination);

    try {
      const analysis = await this.inspectCsv(destination);
      const datasetRecord = this.repository.insert({
        id,
        filename,
        originalName,
        uploadedAt: new Date().toISOString(),
        rows: analysis.rows,
        secondsStart: analysis.secondsStart,
        secondsEnd: analysis.secondsEnd,
        note: meta.note ? meta.note.trim() || null : null,
      });

      const shouldActivate = Boolean(meta.activate) || !this.repository.findActive();
      let dataset = datasetRecord;
      if (shouldActivate) {
        dataset = this.repository.setActive(id) ?? datasetRecord;
        this.invalidateCachesForKey(id);
      }

      return dataset;
    } catch (error) {
      await Bun.file(destination).delete().catch(() => undefined);
      this.repository.remove(id);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to store dataset',
      );
    }
  }

  listDatasets(): DatasetEntity[] {
    return this.repository.findAll();
  }

  getDataset(id: string): DatasetEntity | null {
    return this.repository.findById(id);
  }

  setActiveDataset(id: string): DatasetEntity {
    const dataset = this.repository.setActive(id);
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }
    this.invalidateCachesForKey(id);
    return dataset;
  }

  async removeDataset(id: string): Promise<void> {
    const dataset = this.repository.findById(id);
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }
    const filePath = this.buildDatasetPath(dataset.filename);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      await file.delete().catch(() => undefined);
    }
    this.repository.remove(id);
    this.invalidateCachesForKey(id);
  }

  async loadSeconds(id: string): Promise<SecondBar[]> {
    const dataset = this.repository.findById(id);
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }
    const filePath = this.buildDatasetPath(dataset.filename);
    const entry = await this.loadSecondsFromPath(dataset.id, filePath);
    return entry.data;
  }

  async getSeconds(): Promise<SecondBar[]> {
    const dataset = this.repository.findActive();
    if (dataset) {
      return this.loadSeconds(dataset.id);
    }
    const config = resolveConfig();
    const entry = await this.loadSecondsFromPath(
      this.fallbackCacheKey,
      config.dataFile,
    );
    return entry.data;
  }

  async getCandles(timeframe: Timeframe): Promise<CandleExportRow[]> {
    const dataset = this.repository.findActive();
    const cacheKey = dataset ? dataset.id : this.fallbackCacheKey;
    const secondsEntry = dataset
      ? await this.loadSecondsFromPath(dataset.id, this.buildDatasetPath(dataset.filename))
      : await this.loadSecondsFromPath(cacheKey, resolveConfig().dataFile);

    let timeframeCache = this.candlesCache.get(cacheKey);
    if (!timeframeCache) {
      timeframeCache = new Map();
      this.candlesCache.set(cacheKey, timeframeCache);
    }

    const cached = timeframeCache.get(timeframe);
    if (cached && cached.mtimeMs === secondsEntry.mtimeMs) {
      return cached.data;
    }

    const candles = buildCandlesForTimeframe(secondsEntry.data, timeframe);
    timeframeCache.set(timeframe, {
      data: candles,
      mtimeMs: secondsEntry.mtimeMs,
    });

    return candles;
  }

  async getMinuteCandles(): Promise<CandleExportRow[]> {
    return this.getCandles('1m');
  }

  getBaseConfig(): StrategyConfig {
    const config = resolveConfig();
    const dataset = this.repository.findActive();
    if (dataset) {
      config.dataFile = this.buildDatasetPath(dataset.filename);
    } else {
      config.dataFile = this.resolveAbsolutePath(config.dataFile);
    }
    return config;
  }

  getActiveDataset(): DatasetEntity | null {
    return this.repository.findActive();
  }

  async loadSecondsFromFile(pathValue: string): Promise<SecondBar[]> {
    const absolutePath = this.resolveAbsolutePath(pathValue);
    const entry = await this.loadSecondsFromPath(absolutePath, absolutePath);
    return entry.data;
  }

  resolveDataFilePath(pathValue: string): string {
    return this.resolveAbsolutePath(pathValue);
  }

  resolveDatasetFilePath(dataset: DatasetEntity): string {
    return this.buildDatasetPath(dataset.filename);
  }

  private async inspectCsv(filePath: string): Promise<CsvAnalysisResult> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new NotFoundException('Stored dataset file is missing');
    }
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }
    const [headerLine, ...dataLines] = lines;
    if (!headerLine) {
      throw new BadRequestException('CSV header row is missing');
    }
    const headerColumns = headerLine
      .split(',')
      .map((column) => column.trim().toLowerCase());
    if (headerColumns.length < 6) {
      throw new BadRequestException('CSV header does not include expected columns');
    }
    if (!headerColumns[0] || !headerColumns[0].includes('time')) {
      throw new BadRequestException('First column must contain a timestamp value');
    }
    if (dataLines.length === 0) {
      return { rows: 0, secondsStart: null, secondsEnd: null };
    }
    const sampleLines = dataLines.slice(0, Math.min(5, dataLines.length));
    for (const line of sampleLines) {
      const parts = line.split(',');
      if (parts.length < 6) {
        throw new BadRequestException(`Invalid data row: ${line}`);
      }
      const numericParts = parts.slice(1, 6).map((value) => Number(value));
      if (numericParts.some((value) => Number.isNaN(value))) {
        throw new BadRequestException(`Invalid numeric value in row: ${line}`);
      }
    }
    const firstLine = dataLines[0];
    const lastLine = dataLines[dataLines.length - 1];
    if (!firstLine || !lastLine) {
      throw new BadRequestException('CSV data rows are missing');
    }
    const firstParts = firstLine.split(',');
    const lastParts = lastLine.split(',');
    return {
      rows: dataLines.length,
      secondsStart: firstParts[0]?.trim() || null,
      secondsEnd: lastParts[0]?.trim() || null,
    } satisfies CsvAnalysisResult;
  }

  private async loadSecondsFromPath(
    cacheKey: string,
    rawPath: string,
  ): Promise<SecondsCacheEntry> {
    const filePath = this.resolveAbsolutePath(rawPath);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new NotFoundException(`Dataset file not found: ${filePath}`);
    }
    const lastModified = file.lastModified ?? Date.now();
    const cached = this.secondsCache.get(cacheKey);
    if (cached && cached.mtimeMs === lastModified) {
      return cached;
    }
    const data = await loadSecondBars(filePath);
    const entry: SecondsCacheEntry = { data, mtimeMs: lastModified };
    this.secondsCache.set(cacheKey, entry);
    this.candlesCache.delete(cacheKey);
    return entry;
  }

  private buildDatasetPath(filename: string): string {
    return resolve(this.datasetsDir, filename);
  }

  private resolveAbsolutePath(pathValue: string): string {
    return isAbsolute(pathValue)
      ? pathValue
      : resolve(process.cwd(), pathValue);
  }

  private inferExtension(originalName: string): string {
    const ext = extname(originalName);
    if (!ext) {
      return '.csv';
    }
    return ext;
  }

  private async copyFile(source: BunFile, destination: string) {
    this.ensureDirectory(dirname(destination));
    await Bun.write(destination, source);
  }

  private ensureDirectory(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private invalidateCachesForKey(key: string) {
    this.secondsCache.delete(key);
    this.candlesCache.delete(key);
  }
}
