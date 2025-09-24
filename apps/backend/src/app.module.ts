import { Module } from '@nestjs/common';
import { BacktestModule } from './modules/backtest/backtest.module';
import { DataManageModule } from './modules/data-manage/data-manage.module';

@Module({
  imports: [DataManageModule, BacktestModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
