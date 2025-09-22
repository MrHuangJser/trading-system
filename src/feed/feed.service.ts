import { Injectable } from '@nestjs/common';
import { DataService } from '../data/data.service';
import type { SecondBar } from '../types';
import type { PlayFeedRequestDto } from './dto/play-feed.dto';
import { ReplayDataFeed } from './market-data.feed';

@Injectable()
export class FeedService {
  constructor(private readonly dataService: DataService) {}

  async createReplayFeed(request: PlayFeedRequestDto): Promise<ReplayDataFeed> {
    const seconds = await this.loadSeconds(request);
    return new ReplayDataFeed(seconds, request.timeframe);
  }

  private async loadSeconds(request: PlayFeedRequestDto): Promise<SecondBar[]> {
    if (request.datasetId) {
      return this.dataService.loadSeconds(request.datasetId);
    }
    return this.dataService.getSeconds();
  }
}
