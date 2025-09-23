import { useEffect, useRef } from 'react';
import ChartPanel, { type ChartPanelHandle } from './ChartPanel';
import {
  normalizeCandle,
  normalizeCandles,
} from '../utils/candles';
import type {
  CandleDatum,
  ReplayFeedEvent,
  Timeframe,
  TradeDatum,
  TradeMarker,
} from '../types';
import type { JSX } from 'react';

interface RealtimeFeedPanelProps {
  timeframe: Timeframe;
  baseCandles?: CandleDatum[];
  baseMarkers?: TradeMarker[];
  baseTrades?: TradeDatum[];
  events: ReplayFeedEvent[];
}

export default function RealtimeFeedPanel({
  timeframe,
  baseCandles = [],
  baseMarkers = [],
  baseTrades = [],
  events,
}: RealtimeFeedPanelProps): JSX.Element {
  const chartRef = useRef<ChartPanelHandle | null>(null);
  const processedCountRef = useRef(0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.replaceData({
      timeframe,
      candles: normalizeCandles(baseCandles),
      markers: baseMarkers,
      trades: baseTrades,
    });
    processedCountRef.current = 0;
  }, [baseCandles, baseMarkers, baseTrades, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    if (events.length <= processedCountRef.current) {
      return;
    }
    const nextEvents = events.slice(processedCountRef.current);
    const candles = nextEvents.map((event) => normalizeCandle(event.timeframeBar));
    chart.appendData({ candles });
    processedCountRef.current = events.length;
  }, [events]);

  return <ChartPanel ref={chartRef} timeframe={timeframe} />;
}
