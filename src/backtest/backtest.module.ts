import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { DataModule } from '../data/data.module';

@Module({
  imports: [DataModule],
  controllers: [BacktestController],
  providers: [BacktestService],
})
export class BacktestModule {}
