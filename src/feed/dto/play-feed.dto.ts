import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Timeframe } from '../../lib/timeframe';
import { SUPPORTED_TIMEFRAMES } from '../../lib/timeframe';

export class PlayFeedRequestDto {
  @IsOptional()
  @IsString()
  datasetId?: string;

  @IsIn(SUPPORTED_TIMEFRAMES)
  timeframe!: Timeframe;
}
