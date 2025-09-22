import { Injectable } from '@nestjs/common';
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CreateDatasetInput, DatasetEntity } from './dataset.entity';

interface DatasetRow {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  rows: number;
  secondsStart: string | null;
  secondsEnd: string | null;
  note: string | null;
  isActive: number;
}

@Injectable()
export class DatasetRepository {
  private readonly db: Database;

  constructor() {
    const dbPath = resolve(process.cwd(), 'storage', 'data.sqlite');
    this.ensureDirectory(dirname(dbPath));
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        originalName TEXT NOT NULL,
        uploadedAt TEXT NOT NULL,
        rows INTEGER NOT NULL,
        secondsStart TEXT,
        secondsEnd TEXT,
        note TEXT,
        isActive INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.db.run(
      'CREATE INDEX IF NOT EXISTS idx_datasets_active ON datasets(isActive)',
    );
    this.db.run(
      'CREATE INDEX IF NOT EXISTS idx_datasets_uploaded_at ON datasets(uploadedAt)',
    );
  }

  insert(data: CreateDatasetInput): DatasetEntity {
    const stmt = this.db.prepare(`
      INSERT INTO datasets (
        id,
        filename,
        originalName,
        uploadedAt,
        rows,
        secondsStart,
        secondsEnd,
        note,
        isActive
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `);
    stmt.run(
      data.id,
      data.filename,
      data.originalName,
      data.uploadedAt,
      data.rows,
      data.secondsStart,
      data.secondsEnd,
      data.note,
      data.isActive ? 1 : 0,
    );
    return this.findById(data.id)!;
  }

  findAll(): DatasetEntity[] {
    const stmt = this.db.query<DatasetRow, []>(
      'SELECT * FROM datasets ORDER BY uploadedAt DESC, id DESC',
    );
    return stmt.all().map((row) => this.mapRow(row));
  }

  findById(id: string): DatasetEntity | null {
    const stmt = this.db.query<DatasetRow, [string]>(
      'SELECT * FROM datasets WHERE id = ?1 LIMIT 1',
    );
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  findActive(): DatasetEntity | null {
    const stmt = this.db.query<DatasetRow, []>(
      'SELECT * FROM datasets WHERE isActive = 1 LIMIT 1',
    );
    const row = stmt.get();
    return row ? this.mapRow(row) : null;
  }

  setActive(id: string): DatasetEntity | null {
    const setActiveTx = this.db.transaction((targetId: string) => {
      this.db.run('UPDATE datasets SET isActive = 0 WHERE isActive = 1');
      const stmt = this.db.prepare(
        'UPDATE datasets SET isActive = 1 WHERE id = ?1',
      );
      return stmt.run(targetId).changes;
    });
    const changes = setActiveTx(id);
    if (!changes) {
      return null;
    }
    return this.findById(id);
  }

  clearActive() {
    this.db.run('UPDATE datasets SET isActive = 0 WHERE isActive = 1');
  }

  remove(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM datasets WHERE id = ?1');
    return stmt.run(id).changes > 0;
  }

  private mapRow(row: DatasetRow): DatasetEntity {
    return {
      id: row.id,
      filename: row.filename,
      originalName: row.originalName,
      uploadedAt: row.uploadedAt,
      rows: row.rows,
      secondsStart: row.secondsStart,
      secondsEnd: row.secondsEnd,
      note: row.note,
      isActive: row.isActive === 1,
    } satisfies DatasetEntity;
  }

  private ensureDirectory(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}
