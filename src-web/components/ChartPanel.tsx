import { useEffect, useMemo, useRef } from 'react';
import {
  dispose,
  init,
  LineType,
  PolygonType,
  registerOverlay,
  type Chart,
  type OverlayCreateFiguresCallbackParams,
  type OverlayTemplate,
} from 'klinecharts';
import type { CandleDatum, TradeDatum, TradeMarker } from '../types';
import type { JSX } from 'react';

interface ChartPanelProps {
  candles: CandleDatum[];
  markers?: TradeMarker[];
  trades?: TradeDatum[];
  mode?: 'static' | 'streaming';
}

const TRADE_OVERLAY_NAME = 'tradeMarker';
const SEGMENT_OVERLAY_NAME = 'segment';

let overlayRegistered = false;

const EMPTY_MARKERS: TradeMarker[] = [];
const EMPTY_TRADES: TradeDatum[] = [];

function ensureTradeOverlay(): void {
  if (overlayRegistered) {
    return;
  }

  const template: OverlayTemplate<TradeMarker> = {
    name: TRADE_OVERLAY_NAME,
    totalStep: 1,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }: OverlayCreateFiguresCallbackParams<TradeMarker>) => {
      const coordinate = coordinates[0];
      const trade = overlay.extendData;
      if (!coordinate || !trade) {
        return [];
      }
      const isEntry = trade.type === 'entry';
      const baseColor = trade.side === 'long' ? '#12b886' : '#f03e3e';
      const yOffset = isEntry ? -16 : 16;
      const baseline = isEntry ? 'bottom' : 'top';
      const tagColor = !isEntry && trade.exitReason === 'stop-loss' ? '#f08c00' : baseColor;
      return [
        {
          type: 'circle',
          attrs: {
            x: coordinate.x,
            y: coordinate.y,
            r: 5,
          },
          styles: {
            style: PolygonType.StrokeFill,
            color: baseColor,
            borderColor: '#111',
            borderSize: 1,
          },
        },
        {
          type: 'text',
          attrs: {
            x: coordinate.x,
            y: coordinate.y + yOffset,
            text: trade.label,
            align: 'center',
            baseline,
          },
          styles: {
            color: '#fff',
            backgroundColor: tagColor,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 4,
            size: 12,
          },
        },
      ];
    },
  };

  registerOverlay(template);
  overlayRegistered = true;
}

export default function ChartPanel({
  candles,
  markers,
  trades,
  mode = 'static',
}: ChartPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const streamingSnapshotRef = useRef<{ lastTimestamp: number | null; length: number }>({
    lastTimestamp: null,
    length: 0,
  });

  useEffect(() => {
    ensureTradeOverlay();
    if (!containerRef.current) {
      return;
    }
    const chart = init(containerRef.current);
    if (!chart) {
      return;
    }
    chartRef.current = chart;

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        dispose(containerRef.current);
      } else if (chartRef.current) {
        dispose(chartRef.current);
      }
      chartRef.current = null;
    };
  }, []);

  const klineData = useMemo(
    () =>
      candles.map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
    [candles],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    if (mode === 'streaming') {
      const length = klineData.length;
      const last = length > 0 ? klineData[length - 1] : null;
      const snapshot = streamingSnapshotRef.current;

      if (!last) {
        chart.applyNewData([]);
        chart.scrollToRealTime();
        streamingSnapshotRef.current = { lastTimestamp: null, length: 0 };
        return;
      }

      const hasReset =
        length < snapshot.length ||
        snapshot.lastTimestamp === null ||
        length - snapshot.length > 1 ||
        last.timestamp < snapshot.lastTimestamp;

      if (hasReset) {
        chart.applyNewData(klineData);
      } else {
        chart.updateData(last);
      }

      chart.scrollToRealTime();
      streamingSnapshotRef.current = { lastTimestamp: last.timestamp, length };
      return;
    }

    chart.applyNewData(klineData);
    chart.scrollToRealTime();
    streamingSnapshotRef.current = {
      lastTimestamp: klineData.length > 0 ? klineData[klineData.length - 1].timestamp : null,
      length: klineData.length,
    };
  }, [klineData, mode]);

  const resolvedMarkers = markers ?? EMPTY_MARKERS;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.removeOverlay({ name: TRADE_OVERLAY_NAME });
    resolvedMarkers.forEach((marker) => {
      chart.createOverlay({
        id: marker.id,
        name: TRADE_OVERLAY_NAME,
        extendData: marker,
        points: [
          {
            timestamp: marker.timestamp,
            value: marker.price,
          },
        ],
      });
    });
  }, [resolvedMarkers]);

  const resolvedTrades = trades ?? EMPTY_TRADES;
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.removeOverlay({ name: SEGMENT_OVERLAY_NAME });
    resolvedTrades.forEach((trade) => {
      const color = trade.pnlPoints >= 0 ? '#51cf66' : '#ff6b6b';
      chart.createOverlay({
        id: `${trade.id}-segment`,
        name: SEGMENT_OVERLAY_NAME,
        points: [
          { timestamp: trade.entryTimestamp, value: trade.entryPrice },
          { timestamp: trade.exitTimestamp, value: trade.exitPrice },
        ],
        styles: {
          line: {
            color,
            style: LineType.Solid,
            size: 1,
          },
        },
      });
    });
  }, [resolvedTrades]);

  return (
    <div className="chart-panel">
      <div ref={containerRef} className="chart-panel__canvas" />
    </div>
  );
}
