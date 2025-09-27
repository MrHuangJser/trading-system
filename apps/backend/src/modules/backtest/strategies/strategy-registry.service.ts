import { Injectable } from '@nestjs/common';
import {
  StrategyDefinition,
  StrategyInstance,
  StrategyListItem,
} from '../types/strategy';

type RegistryEntry = StrategyDefinition;

@Injectable()
export class StrategyRegistryService {
  private readonly strategies = new Map<string, RegistryEntry>();

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

  createStrategy(
    name: string,
    params: Record<string, unknown>
  ): StrategyInstance {
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
