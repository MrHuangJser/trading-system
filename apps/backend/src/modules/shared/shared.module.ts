import { Module } from '@nestjs/common';
import { AggregationService } from './services/aggregation.service';
import { DataFeedService } from './services/data-feed.service';

const SERVICES = [AggregationService, DataFeedService];

@Module({
  imports: [],
  controllers: [],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class SharedModule {}
