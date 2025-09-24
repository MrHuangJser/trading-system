import { IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { Timeframe } from '../../shared/types/ohlcv';

export class RunBacktestBodyDto {
  @IsNotEmpty()
  datasetFileName: string;

  @IsNotEmpty()
  @IsEnum(Timeframe)
  timeframe: Timeframe;

  @IsNotEmpty()
  strategyName: string;

  @IsOptional()
  @IsObject()
  strategyParams: Record<string, any>;
}
