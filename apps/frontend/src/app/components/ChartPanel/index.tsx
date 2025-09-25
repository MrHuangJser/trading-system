import classnames from 'classnames';
import {
  dispose,
  init,
  OverlayCreateFiguresCallbackParams,
  registerOverlay,
  type Chart,
  type KLineData,
} from 'klinecharts';
import { memo, useEffect, useRef, type FC } from 'react';

export interface TradeMarker {
  id: string;
  entryTimestamp: number;
  entryPrice: number;
  exitTimestamp: number;
  exitPrice: number;
  direction: 'BUY' | 'SELL';
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPanelProps {
  className?: string;
  data: KLineData[];
  markers?: TradeMarker[];
}

let overlayRegistered = false;

const ensureTradeOverlayRegistered = () => {
  if (overlayRegistered) {
    return;
  }
  registerOverlay({
    name: 'tradeLink',
    totalStep: 2,
    needDefaultYAxisFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultPointFigure: false,
    lock: true,
    createPointFigures: ({
      coordinates,
      overlay,
    }: OverlayCreateFiguresCallbackParams) => {
      if (!coordinates.length) {
        return [];
      }

      const [entry, exit] = coordinates;
      if (!entry || !exit) {
        return [];
      }

      const direction =
        overlay.extendData?.direction === 'SELL' ? 'SELL' : 'BUY';
      const entryColor = direction === 'BUY' ? '#2DC08E' : '#F92855';
      const exitColor = direction === 'BUY' ? '#F92855' : '#2DC08E';
      const size = 8;

      const entryTriangle =
        direction === 'BUY'
          ? [
              { x: entry.x, y: entry.y - size },
              { x: entry.x - size * 0.75, y: entry.y + size * 0.5 },
              { x: entry.x + size * 0.75, y: entry.y + size * 0.5 },
            ]
          : [
              { x: entry.x, y: entry.y + size },
              { x: entry.x - size * 0.75, y: entry.y - size * 0.5 },
              { x: entry.x + size * 0.75, y: entry.y - size * 0.5 },
            ];

      const exitTriangleDirection = direction === 'BUY' ? 'SELL' : 'BUY';
      const exitTriangle =
        exitTriangleDirection === 'BUY'
          ? [
              { x: exit.x, y: exit.y - size },
              { x: exit.x - size * 0.75, y: exit.y + size * 0.5 },
              { x: exit.x + size * 0.75, y: exit.y + size * 0.5 },
            ]
          : [
              { x: exit.x, y: exit.y + size },
              { x: exit.x - size * 0.75, y: exit.y - size * 0.5 },
              { x: exit.x + size * 0.75, y: exit.y - size * 0.5 },
            ];

      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: entryTriangle,
          },
          styles: {
            color: entryColor,
            backgroundColor: entryColor,
          },
          ignoreEvent: true,
        },
        {
          type: 'line',
          attrs: {
            coordinates: [entry, exit],
          },
          styles: {
            color: entryColor,
            size: 1,
          },
          ignoreEvent: true,
        },
        {
          type: 'polygon',
          attrs: {
            coordinates: exitTriangle,
          },
          styles: {
            color: exitColor,
            backgroundColor: exitColor,
          },
          ignoreEvent: true,
        },
      ];
    },
  });
  overlayRegistered = true;
};

export const ChartPanel: FC<ChartPanelProps> = memo(
  ({ data, markers = [], className }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Chart>(null);
    const overlayIdsRef = useRef<string[]>([]);

    useEffect(() => {
      ensureTradeOverlayRegistered();
      const chartDom = chartContainerRef.current;
      if (chartDom) {
        chartInstance.current = init(chartDom, {});
        chartInstance.current?.setPaneOptions({
          id: 'candle_pane',
        });
      }
      return () => {
        if (chartInstance.current && overlayIdsRef.current.length > 0) {
          overlayIdsRef.current.forEach((id) => {
            chartInstance.current?.removeOverlay(id);
          });
          overlayIdsRef.current = [];
        }
        if (chartDom) {
          dispose(chartDom);
        }
      };
    }, []);

    useEffect(() => {
      if (chartInstance.current) {
        chartInstance.current.applyNewData(data, false);
      }
    }, [data]);

    useEffect(() => {
      if (!chartInstance.current) {
        return;
      }

      if (overlayIdsRef.current.length > 0) {
        overlayIdsRef.current.forEach((id) =>
          chartInstance.current?.removeOverlay(id)
        );
        overlayIdsRef.current = [];
      }

      markers.forEach((marker) => {
        const overlayId = chartInstance.current?.createOverlay({
          name: 'tradeLink',
          lock: true,
          visible: true,
          id: marker.id,
          points: [
            {
              timestamp: marker.entryTimestamp,
              value: marker.entryPrice,
            },
            {
              timestamp: marker.exitTimestamp,
              value: marker.exitPrice,
            },
          ],
          extendData: {
            direction: marker.direction,
          },
        });

        if (typeof overlayId === 'string') {
          overlayIdsRef.current.push(overlayId);
        }
      });
    }, [markers]);

    return (
      <div ref={chartContainerRef} className={classnames(className)}></div>
    );
  }
);
