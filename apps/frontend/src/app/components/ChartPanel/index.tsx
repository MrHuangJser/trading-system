import classnames from 'classnames';
import {
  createChart,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesMarkerPosition,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { memo, useEffect, useRef, useState, type FC } from 'react';

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
  data: CandleData[];
  markers?: TradeMarker[];
}

const NAVIGATION_WINDOW = 60;

const toUTCTimestamp = (timestamp: number): UTCTimestamp =>
  Math.floor(timestamp / 1000) as UTCTimestamp;

const formatDatetimeLocal = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const binarySearchNearestIndex = (
  data: CandleData[],
  target: number
): number => {
  if (data.length === 0) {
    return -1;
  }

  let low = 0;
  let high = data.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = data[mid].timestamp;

    if (value === target) {
      return mid;
    }

    if (value < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const candidates = [low, high]
    .filter((index) => index >= 0 && index < data.length)
    .sort(
      (a, b) =>
        Math.abs(data[a].timestamp - target) -
        Math.abs(data[b].timestamp - target)
    );

  return candidates.length > 0 ? candidates[0] : -1;
};

const buildMarkers = (markers: TradeMarker[]): SeriesMarker<Time>[] => {
  const markerItems: SeriesMarker<Time>[] = [];

  markers.forEach((marker) => {
    const entryTime = toUTCTimestamp(marker.entryTimestamp);
    const exitTime = toUTCTimestamp(marker.exitTimestamp);
    const isBuy = marker.direction === 'BUY';

    markerItems.push(
      {
        time: entryTime,
        position: (isBuy ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
        color: isBuy ? '#12B76A' : '#F04438',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: isBuy ? '买入' : '卖出',
      },
      {
        time: exitTime,
        position: (isBuy ? 'aboveBar' : 'belowBar') as SeriesMarkerPosition,
        color: isBuy ? '#F59E0B' : '#2563EB',
        shape: isBuy ? 'arrowDown' : 'arrowUp',
        text: isBuy ? '卖出' : '买入',
      }
    );
  });

  return markerItems.sort((a, b) => Number(a.time) - Number(b.time));
};

export const ChartPanel: FC<ChartPanelProps> = memo(
  ({ data, markers = [], className }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const resizeObserverRef = useRef<ResizeObserver>(null);
    const sortedDataRef = useRef<CandleData[]>([]);

    const [isReady, setIsReady] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const [jumpError, setJumpError] = useState<string | null>(null);

    useEffect(() => {
      const container = chartContainerRef.current;
      if (!container) {
        return;
      }

      const chart = createChart(container, {
        layout: {
          background: { color: '#ffffff' },
          textColor: '#1f2937',
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        grid: {
          vertLines: {
            color: '#f0f2f5',
          },
          horzLines: {
            color: '#f0f2f5',
          },
        },
        width: container.clientWidth,
        height: container.clientHeight,
        rightPriceScale: {
          borderColor: '#e5e7eb',
        },
        timeScale: {
          borderColor: '#e5e7eb',
        },
      });

      chartInstance.current = chart;

      candleSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#12B76A',
        downColor: '#F04438',
        borderUpColor: '#12B76A',
        borderDownColor: '#F04438',
        wickUpColor: '#12B76A',
        wickDownColor: '#F04438',
      });

      const handleResize = () => {
        if (!chartContainerRef.current || !chartInstance.current) {
          return;
        }
        const { clientWidth, clientHeight } = chartContainerRef.current;
        chartInstance.current.applyOptions({
          width: clientWidth,
          height: clientHeight,
        });
      };

      handleResize();

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      resizeObserverRef.current = resizeObserver;

      setIsReady(true);

      return () => {
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;

        if (chartInstance.current) {
          chartInstance.current.remove();
          chartInstance.current = null;
        }

        candleSeriesRef.current = null;
        sortedDataRef.current = [];
      };
    }, []);

    useEffect(() => {
      if (!isReady || !candleSeriesRef.current) {
        return;
      }

      const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
      sortedDataRef.current = sorted;

      const candleSeriesData: CandlestickData[] = sorted.map((item) => ({
        time: toUTCTimestamp(item.timestamp),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      candleSeriesRef.current.setData(candleSeriesData);

      if (sorted.length > 0) {
        chartInstance.current?.timeScale().fitContent();
        setJumpValue(formatDatetimeLocal(sorted[0].timestamp));
      } else {
        setJumpValue('');
      }
    }, [data, isReady]);

    useEffect(() => {
      if (!isReady || !candleSeriesRef.current) {
        return;
      }

      const markerItems = buildMarkers(markers);
      candleSeriesRef.current.setMarkers(markerItems);
    }, [markers, isReady]);

    const focusOnIndex = (index: number) => {
      if (!chartInstance.current || !sortedDataRef.current.length) {
        return;
      }

      const dataLength = sortedDataRef.current.length;
      const clampedIndex = Math.max(0, Math.min(index, dataLength - 1));
      const buffer = Math.min(NAVIGATION_WINDOW, dataLength);
      const from = Math.max(0, clampedIndex - buffer);
      const to = Math.min(dataLength - 1, clampedIndex + buffer);

      chartInstance.current.timeScale().setVisibleLogicalRange({
        from,
        to,
      });

      chartInstance.current
        .timeScale()
        .scrollToPosition(clampedIndex - (dataLength - 1), false);
    };

    const handleJump = () => {
      setJumpError(null);
      if (!jumpValue) {
        setJumpError('请输入要跳转的日期时间');
        return;
      }

      const targetTimestamp = new Date(jumpValue).getTime();
      if (Number.isNaN(targetTimestamp)) {
        setJumpError('无效的日期时间格式');
        return;
      }

      const index = binarySearchNearestIndex(
        sortedDataRef.current,
        targetTimestamp
      );
      if (index === -1) {
        setJumpError('当前数据集中未找到接近的时间点');
        return;
      }

      focusOnIndex(index);
    };

    const handleGoStart = () => {
      setJumpError(null);
      focusOnIndex(0);
    };

    const handleGoEnd = () => {
      setJumpError(null);
      focusOnIndex(sortedDataRef.current.length - 1);
    };

    return (
      <div
        ref={chartContainerRef}
        className={classnames(className, 'relative')}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            正在初始化 TradingView 图表...
          </div>
        )}

        {isReady && (
          <div className="absolute top-3 right-3 flex flex-col gap-2 rounded-md bg-white/90 p-3 text-xs shadow-md">
            <span className="text-gray-500">
              数据区间：
              <span className="font-medium">
                {sortedDataRef.current.length
                  ? `${formatDatetimeLocal(sortedDataRef.current[0].timestamp)} 至 ${formatDatetimeLocal(
                      sortedDataRef.current[sortedDataRef.current.length - 1]
                        .timestamp
                    )}`
                  : '无数据'}
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-gray-600">
                <span>跳转时间</span>
                <input
                  type="datetime-local"
                  value={jumpValue}
                  onChange={(event) => {
                    setJumpValue(event.target.value);
                    setJumpError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleJump();
                    }
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={handleJump}
                className="rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
              >
                跳转
              </button>
              <button
                type="button"
                onClick={handleGoStart}
                className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
              >
                回到开始
              </button>
              <button
                type="button"
                onClick={handleGoEnd}
                className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
              >
                跳到末尾
              </button>
            </div>
            {jumpError && (
              <span className="text-red-500">{jumpError}</span>
            )}
          </div>
        )}
      </div>
    );
  }
);
