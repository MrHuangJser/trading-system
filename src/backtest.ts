import { StrategyEngine } from './strategy';
import { ReplayDataFeed } from './feed/market-data.feed';
import { timestampToUnixMs } from './time';
import type { Timeframe } from './lib/timeframe';
import type {
  BacktestResult,
  CandleExportRow,
  SecondBar,
  StrategyConfig,
  TimeframeBar,
} from './types';

interface RunOptions {
  secondLimit?: number | null;
  timeframe?: Timeframe;
}

export function runBacktest(
  seconds: SecondBar[],
  config: StrategyConfig,
  options: RunOptions = {},
): BacktestResult {
  const { secondLimit = null, timeframe: requestedTimeframe } = options;
  const timeframe = requestedTimeframe ?? config.timeframe;
  const dataset = secondLimit ? seconds.slice(0, secondLimit) : seconds;

  const candles = buildCandles(dataset, timeframe);

  const summary = StrategyEngine.run(dataset, { ...config, timeframe });

  return {
    candles,
    summary,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataFile: config.dataFile,
      baseQuantity: config.baseQuantity,
      contractMultiplier: config.contractMultiplier,
      resolution: timeframe,
      candles: candles.length,
      trades: summary.totalTrades,
      seconds: dataset.length,
      secondLimit,
    },
  };
}

function buildCandles(seconds: SecondBar[], timeframe: Timeframe): CandleExportRow[] {
  const feed = new ReplayDataFeed(seconds, timeframe);
  const timeframeBars: TimeframeBar[] = [];

  for (;;) {
    const event = feed.next();
    if (!event) {
      break;
    }
    if (event.timeframeState === 'completed') {
      timeframeBars.push(event.timeframeBar);
    }
  }

  const trailing = feed.getLastFormingBar();
  if (trailing) {
    timeframeBars.push(trailing);
  }

  return timeframeBars.map((bar) => ({
    timestamp: timestampToUnixMs(bar.startTimestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    raw: bar.startTimestamp.raw,
  }));
}
