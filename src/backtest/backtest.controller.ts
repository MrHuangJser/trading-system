import { Body, Controller, Post } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestRequestDto } from './dto/backtest-request.dto';

@Controller('api/backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  runBacktest(@Body() body: BacktestRequestDto) {
    return this.backtestService.runBacktest(body);
  }
}
