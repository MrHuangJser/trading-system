import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from 'react';
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
import type {
  CandleDatum,
  Timeframe,
  TradeDatum,
  TradeMarker,
} from '../types';
import { toKLineData, toKLineDataList } from '../utils/candles';
import type { JSX } from 'react';

interface ChartPanelProps {
  timeframe: Timeframe;
}

export interface ChartPanelDataset {
  timeframe: Timeframe;
  candles: CandleDatum[];
  markers: TradeMarker[];
  trades: TradeDatum[];
}

export interface ChartPanelAppendPayload {
  candles: CandleDatum[];
  markers?: TradeMarker[];
  trades?: TradeDatum[];
}

export interface ChartPanelHandle {
  replaceData(dataset: ChartPanelDataset): void;
  appendData(update: ChartPanelAppendPayload): void;
}

const TRADE_OVERLAY_NAME = 'tradeMarker';
const SEGMENT_OVERLAY_NAME = 'segment';

let overlayRegistered = false;

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

function createMarkerOverlay(chart: Chart, marker: TradeMarker): void {
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
}

function createTradeOverlay(chart: Chart, trade: TradeDatum): void {
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
}

function cloneCandles(candles: CandleDatum[]): CandleDatum[] {
  return candles.map((candle) => ({ ...candle }));
}

function cloneMarkers(markers: TradeMarker[]): TradeMarker[] {
  return markers.map((marker) => ({ ...marker }));
}

function cloneTrades(trades: TradeDatum[]): TradeDatum[] {
  return trades.map((trade) => ({ ...trade }));
}

function upsertCandle(target: CandleDatum[], candle: CandleDatum): void {
  const last = target[target.length - 1];
  if (!last) {
    target.push(candle);
    return;
  }
  if (last.timestamp === candle.timestamp) {
    target[target.length - 1] = candle;
    return;
  }
  if (last.timestamp < candle.timestamp) {
    target.push(candle);
    return;
  }
  const index = target.findIndex((existing) => existing.timestamp === candle.timestamp);
  if (index >= 0) {
    target[index] = candle;
    return;
  }
  target.push(candle);
  target.sort((a, b) => a.timestamp - b.timestamp);
}

function applyDatasetToChart(chart: Chart, dataset: ChartPanelDataset): void {
  chart.applyNewData(toKLineDataList(dataset.candles));
  chart.removeOverlay({ name: TRADE_OVERLAY_NAME });
  chart.removeOverlay({ name: SEGMENT_OVERLAY_NAME });
  dataset.markers.forEach((marker) => createMarkerOverlay(chart, marker));
  dataset.trades.forEach((trade) => createTradeOverlay(chart, trade));
  chart.scrollToRealTime();
}

const ChartPanel = (
  { timeframe }: ChartPanelProps,
  ref: ForwardedRef<ChartPanelHandle>,
): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const datasetRef = useRef<ChartPanelDataset>({
    timeframe,
    candles: [],
    markers: [],
    trades: [],
  });
  const markerMapRef = useRef<Map<string, TradeMarker>>(new Map());
  const tradeMapRef = useRef<Map<string, TradeDatum>>(new Map());

  const replaceData = useCallback((dataset: ChartPanelDataset) => {
    const candles = cloneCandles(dataset.candles);
    const markers = cloneMarkers(dataset.markers);
    const trades = cloneTrades(dataset.trades);
    datasetRef.current = {
      timeframe: dataset.timeframe,
      candles,
      markers,
      trades,
    };
    markerMapRef.current = new Map(markers.map((marker) => [marker.id, marker]));
    tradeMapRef.current = new Map(trades.map((trade) => [trade.id, trade]));
    const chart = chartRef.current;
    if (chart) {
      applyDatasetToChart(chart, datasetRef.current);
    }
  }, []);

  const appendData = useCallback(
    ({ candles, markers = [], trades = [] }: ChartPanelAppendPayload) => {
      const chart = chartRef.current;
      const dataset = datasetRef.current;

      if (candles.length > 0) {
        candles.forEach((incoming) => {
          const candle = { ...incoming };
          upsertCandle(dataset.candles, candle);
          if (chart) {
            chart.updateData(toKLineData(candle));
          }
        });
        if (chart) {
          chart.scrollToRealTime();
        }
      }

      if (markers.length > 0) {
        const markerMap = markerMapRef.current;
        markers.forEach((incoming) => {
          const marker = { ...incoming };
          markerMap.set(marker.id, marker);
          const existingIndex = dataset.markers.findIndex((item) => item.id === marker.id);
          if (existingIndex >= 0) {
            dataset.markers[existingIndex] = marker;
          } else {
            dataset.markers.push(marker);
          }
          if (chart) {
            chart.removeOverlay({ id: marker.id });
            createMarkerOverlay(chart, marker);
          }
        });
      }

      if (trades.length > 0) {
        const tradeMap = tradeMapRef.current;
        trades.forEach((incoming) => {
          const trade = { ...incoming };
          tradeMap.set(trade.id, trade);
          const existingIndex = dataset.trades.findIndex((item) => item.id === trade.id);
          if (existingIndex >= 0) {
            dataset.trades[existingIndex] = trade;
          } else {
            dataset.trades.push(trade);
          }
          if (chart) {
            chart.removeOverlay({ id: `${trade.id}-segment` });
            createTradeOverlay(chart, trade);
          }
        });
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      replaceData,
      appendData,
    }),
    [appendData, replaceData],
  );

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

    if (datasetRef.current.candles.length > 0) {
      applyDatasetToChart(chart, datasetRef.current);
    }

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

  useEffect(() => {
    datasetRef.current.timeframe = timeframe;
  }, [timeframe]);

  return (
    <div className="chart-panel">
      <div ref={containerRef} className="chart-panel__canvas" />
    </div>
  );
};

export default forwardRef(ChartPanel);
