import { Module } from '@nestjs/common';
import { AggregationService } from './services/aggregation.service';

const SERVICES = [AggregationService];

@Module({
  imports: [],
  controllers: [],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class SharedModule {}
