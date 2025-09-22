import { Module } from '@nestjs/common';
import { DatasetRepository } from './dataset.repository';
import { DataService } from './data.service';
import { DataController } from './data.controller';

@Module({
  providers: [DatasetRepository, DataService],
  controllers: [DataController],
  exports: [DataService],
})
export class DataModule {}
