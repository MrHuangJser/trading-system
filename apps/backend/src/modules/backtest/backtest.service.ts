import { Injectable } from '@nestjs/common';
import { RunBacktestBodyDto } from './dto/run-backtest.dto';

@Injectable()
export class BacktestService {
  constructor() {}

  async run(dto: RunBacktestBodyDto) {}
}
