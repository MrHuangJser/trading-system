import { Controller, Get, Query } from '@nestjs/common';
import { CandlesService } from './candles.service';
import { GetCandlesDto } from './dto/get-candles.dto';

@Controller('api/candles')
export class CandlesController {
  constructor(private readonly candlesService: CandlesService) {}

  @Get()
  getCandles(@Query() query: GetCandlesDto) {
    return this.candlesService.getPaginated(query.page, query.pageSize);
  }
}
