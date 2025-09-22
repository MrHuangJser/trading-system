import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Timeframe } from '../../lib/timeframe';
import { SUPPORTED_TIMEFRAMES } from '../../lib/timeframe';

export class GetCandlesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  pageSize = 500;

  @IsOptional()
  @IsIn(SUPPORTED_TIMEFRAMES)
  timeframe: Timeframe = '1m';
}
