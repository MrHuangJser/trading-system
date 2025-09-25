import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  Get,
} from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';
import { BacktestService } from './backtest.service';
import { StrategyRegistryService } from './strategies/strategy-registry.service';

@Controller('backtest')
@UsePipes(new ValidationPipe())
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    private readonly strategyRegistry: StrategyRegistryService
  ) {}

  @Get('strategy-list')
  async getStrategyList() {
    return this.strategyRegistry.listStrategies();
  }

  @Post('run')
  async runBacktest(@Body() body: RunBacktestBodyDto) {
    return this.backtestService.run(body);
  }
}
