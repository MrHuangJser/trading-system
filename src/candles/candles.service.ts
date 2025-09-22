import { Injectable } from '@nestjs/common';
import { DataService } from '../data/data.service';
import type { Timeframe } from '../lib/timeframe';
import type { CandleExportRow } from '../types';

export interface PaginatedCandles {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  data: CandleExportRow[];
}

/**
 * Provides paginated access to cached timeframe candles.
 */
@Injectable()
export class CandlesService {
  constructor(private readonly dataService: DataService) {}

  async getPaginated(
    page: number,
    pageSize: number,
    timeframe: Timeframe,
  ): Promise<PaginatedCandles> {
    const candles = await this.dataService.getCandles(timeframe);
    const total = candles.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    const data = candles.slice(start, end);

    return {
      meta: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },
      data,
    };
  }
}
