import { Module } from '@nestjs/common';
import { DataManageModule } from './modules/data-manage/data-manage.module';

@Module({
  imports: [DataManageModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
