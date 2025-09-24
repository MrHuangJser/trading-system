import { Module } from '@nestjs/common';
import { AggregationService } from './services/aggregation.service';

@Module({
  imports: [],
  controllers: [],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class SharedModule {}
