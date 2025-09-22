import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [DataModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
