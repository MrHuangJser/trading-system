import { Module } from '@nestjs/common';
import { DataManageController } from './data-manage.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [DataManageController],
  providers: [],
})
export class DataManageModule {}
