import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FeedService } from './feed.service';
import { PlayFeedRequestDto } from './dto/play-feed.dto';
import type { ReplayFeedEvent } from './market-data.feed';

@Controller('api/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Post('play')
  async play(@Body() body: PlayFeedRequestDto, @Res() res: Response): Promise<void> {
    const feed = await this.feedService.createReplayFeed(body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const unsubscribe = feed.subscribe((event) => {
      if (!closed) {
        this.writeEvent(res, event);
      }
    });

    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      unsubscribe();
      res.end();
    };

    const pushNext = () => {
      if (closed) {
        return;
      }
      const result = feed.next();
      if (!result) {
        this.writeEnd(res);
        cleanup();
      }
    };

    interval = setInterval(pushNext, 1000);

    res.on('close', cleanup);

    pushNext();
  }

  private writeEvent(res: Response, event: ReplayFeedEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  private writeEnd(res: Response): void {
    res.write('event: end\ndata: {}\n\n');
  }
}
