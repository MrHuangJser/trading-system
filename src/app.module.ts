import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataModule } from './data/data.module';
import { CandlesModule } from './candles/candles.module';
import { BacktestModule } from './backtest/backtest.module';
import { FeedModule } from './feed/feed.module';

@Module({
  imports: [DataModule, CandlesModule, BacktestModule, FeedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
