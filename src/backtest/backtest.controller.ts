import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestRequestDto } from './dto/backtest-request.dto';
import type { Timeframe } from '../lib/timeframe';

@Controller('api/backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  runBacktest(@Body() body: BacktestRequestDto) {
    if (body.datasetId && body.dataFile) {
      throw new BadRequestException('Specify either datasetId or dataFile, not both');
    }

    const timeframe: Timeframe = body.timeframe ?? this.backtestService.getDefaultTimeframe();
    const request: BacktestRequestDto = {
      ...body,
      timeframe,
    };

    return this.backtestService.runBacktest(request);
  }
}
