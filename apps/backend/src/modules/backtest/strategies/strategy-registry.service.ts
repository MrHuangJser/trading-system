import { Injectable } from '@nestjs/common';
import { Timeframe } from '../../shared/types/ohlcv';
import {
  StrategyDefinition,
  StrategyInstance,
  StrategyListItem,
} from '../types/strategy';
import { createBullishCloseStrategy } from './bullish-close.strategy';

type RegistryEntry = StrategyDefinition;

@Injectable()
export class StrategyRegistryService {
  private readonly strategies = new Map<string, RegistryEntry>();

  constructor() {
    const bullishClose: RegistryEntry = {
      name: 'BullishCloseOneMinute',
      description:
        '1m 回测：阳线收盘后开多，止盈 +1 点，止损为当前 K 线低点。',
      supportedTimeframes: [Timeframe.ONE_MINUTE],
      create: () => createBullishCloseStrategy(),
    };

    this.strategies.set(bullishClose.name, bullishClose);
  }

  listStrategies(): StrategyListItem[] {
    return Array.from(this.strategies.values()).map(
      ({ name, description, supportedTimeframes, paramsSchema }) => ({
        name,
        description,
        supportedTimeframes,
        paramsSchema,
      })
    );
  }

  createStrategy(name: string, params: Record<string, unknown>): StrategyInstance {
    const entry = this.strategies.get(name);
    if (!entry) {
      throw new Error(`策略 ${name} 未注册`);
    }
    return entry.create(params);
  }

  getStrategy(name: string): RegistryEntry | undefined {
    return this.strategies.get(name);
  }
}
