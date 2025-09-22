import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

function transformBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

export class BacktestRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  contractMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seconds?: number;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  enableLongEntry?: boolean;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  enableLongTakeProfit?: boolean;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  enableShortEntry?: boolean;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  enableShortTakeProfit?: boolean;
}
