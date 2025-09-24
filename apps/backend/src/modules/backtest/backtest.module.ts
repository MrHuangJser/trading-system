import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { BacktestController } from './backtest.controller';

@Module({
  imports: [SharedModule],
  controllers: [BacktestController],
  providers: [],
  exports: [],
})
export class BacktestModule {}
