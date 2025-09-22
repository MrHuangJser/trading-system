import type { StrategyConfig } from './types';

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
}

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    if (body.startsWith('no-')) {
      const key = body.slice(3);
      flags[key] = 'false';
      continue;
    }
    const [rawKey, value] = body.split('=', 2);
    const key = rawKey ?? '';
    if (!key) {
      continue;
    }
    flags[key] = value ?? 'true';
  }
  return { positional, flags };
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }
  return defaultValue;
}

export function resolveConfig(args: string[] = Bun.argv.slice(2)): StrategyConfig {
  const { positional, flags } = parseArgs(args);
  const dataFile = positional[0] ?? Bun.env.DATA_FILE ?? 'data/MESZ3-OHLC1s-20231215.csv';
  const baseQuantity = Number(Bun.env.BASE_QTY ?? flags['base-qty'] ?? '1');
  const contractMultiplier = Number(Bun.env.CONTRACT_MULTIPLIER ?? flags['contract-multiplier'] ?? '5');
  if (Number.isNaN(baseQuantity) || baseQuantity <= 0) {
    throw new Error('Invalid base quantity value');
  }
  if (Number.isNaN(contractMultiplier) || contractMultiplier <= 0) {
    throw new Error('Invalid contract multiplier value');
  }
  const enableLongEntry = parseBoolean(flags['enable-long-entry'] ?? Bun.env.ENABLE_LONG_ENTRY, true);
  const enableLongTakeProfit = parseBoolean(flags['enable-long-tp'] ?? Bun.env.ENABLE_LONG_TP, true);
  const enableShortEntry = parseBoolean(flags['enable-short-entry'] ?? Bun.env.ENABLE_SHORT_ENTRY, true);
  const enableShortTakeProfit = parseBoolean(flags['enable-short-tp'] ?? Bun.env.ENABLE_SHORT_TP, true);
  return {
    dataFile,
    baseQuantity: Math.trunc(baseQuantity),
    contractMultiplier,
    enableLongEntry,
    enableLongTakeProfit,
    enableShortEntry,
    enableShortTakeProfit,
  };
}
