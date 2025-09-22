import { Module } from '@nestjs/common';
import { CandlesController } from './candles.controller';
import { CandlesService } from './candles.service';
import { DataModule } from '../data/data.module';

@Module({
  imports: [DataModule],
  providers: [CandlesService],
  controllers: [CandlesController],
})
export class CandlesModule {}
