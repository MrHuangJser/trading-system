import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  Get,
} from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';

@Controller('backtest')
@UsePipes(new ValidationPipe())
export class BacktestController {
  @Get('strategy-list')
  async getStrategyList() {
    return [
      {
        name: 'MotherBarStrategy',
        description: 'MotherBarStrategy',
        paramsSchema: {
          type: 'object',
          description: 'MotherBarStrategy parameters',
          properties: {
            buyZonePercent: { type: 'number', description: '买入区域百分比' },
            sellZonePercent: { type: 'number', description: '卖出区域百分比' },
            longTakeProfitPercent: {
              type: 'number',
              description: '多头初始止盈百分比',
            },
            shortTakeProfitPercent: {
              type: 'number',
              description: '空头初始止盈百分比',
            },
            longStopLossPercent: {
              type: 'number',
              description: '多头损百分比',
            },
            shortStopLossPercent: {
              type: 'number',
              description: '空头止损百分比',
            },
            longAddPercent: { type: 'number', description: '多头加仓百分比' },
            shortAddPercent: { type: 'number', description: '空头加仓百分比' },
            longAddTpPercent: {
              type: 'number',
              description: '多头加仓后止盈百分比',
            },
            shortAddTpPercent: {
              type: 'number',
              description: '空头加仓后止盈百分比',
            },
          },
        },
      },
    ];
  }

  @Post('run')
  async runBacktest(@Body() body: RunBacktestBodyDto) {}
}
