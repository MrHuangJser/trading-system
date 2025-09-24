import { Module } from '@nestjs/common';
import { DataManageController } from './data-manage.controller';

@Module({
  imports: [],
  controllers: [DataManageController],
  providers: [],
})
export class DataManageModule {}
