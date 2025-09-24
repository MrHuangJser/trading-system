import { Injectable } from '@nestjs/common';
import path from 'path';
import { of } from 'rxjs';
import { AggregationService, Timeframe } from './aggregation.service';

@Injectable()
export class DataFeedService {
  constructor(private readonly aggregationService: AggregationService) {}

  async getCandleObserve(datasetFileName: string, timeframe: Timeframe) {
    const filePath = path.join(
      process.cwd(),
      'storage',
      'dataset',
      datasetFileName
    );
    const result = await this.aggregationService.aggregate(filePath, timeframe);

    return of(...result);
  }
}
