import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataModule } from './data/data.module';
import { CandlesModule } from './candles/candles.module';
import { BacktestModule } from './backtest/backtest.module';

@Module({
  imports: [DataModule, CandlesModule, BacktestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
