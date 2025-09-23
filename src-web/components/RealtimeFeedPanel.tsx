import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import ChartPanel from './ChartPanel';
import { openReplayFeed } from '../api/feed';
import type {
  CandleDatum,
  FeedEvent,
  FeedParsedTimestamp,
  FeedTimeframeBar,
  FeedTimeframeState,
  Timeframe,
} from '../types';

interface RealtimeFeedPanelProps {
  timeframe: Timeframe;
  datasetId: string | null;
}

type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';

const priceFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const volumeFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 0,
});

const MAX_STREAM_CANDLES = 500;

function parseTimestampToMs(timestamp: FeedParsedTimestamp): number {
  const isoLike = `${timestamp.date}T${timestamp.time}`;
  const parsed = Date.parse(isoLike);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const constructed = new Date(
    timestamp.year,
    timestamp.month - 1,
    timestamp.day,
    timestamp.hour,
    timestamp.minute,
    timestamp.second,
  );
  const value = constructed.getTime();
  return Number.isNaN(value) ? Date.now() : value;
}

function formatTimestampLabel(timestamp: FeedParsedTimestamp): string {
  return `${timestamp.date} ${timestamp.time}`;
}

function toCandle(bar: FeedTimeframeBar): CandleDatum {
  const timestamp = parseTimestampToMs(bar.startTimestamp);
  return {
    timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    raw: bar.endTimestamp.raw,
  };
}

function mergeCandle(previous: CandleDatum[], candle: CandleDatum): CandleDatum[] {
  if (previous.length === 0) {
    return [candle];
  }

  const last = previous[previous.length - 1];
  if (candle.timestamp === last.timestamp) {
    return [...previous.slice(0, -1), candle];
  }

  if (candle.timestamp > last.timestamp) {
    const next = previous.length >= MAX_STREAM_CANDLES ? previous.slice(-(MAX_STREAM_CANDLES - 1)) : previous.slice();
    next.push(candle);
    return next;
  }

  return [candle];
}

function formatStatus(status: StreamStatus): string {
  switch (status) {
    case 'connecting':
      return '连接中…';
    case 'streaming':
      return '播放中';
    case 'completed':
      return '已结束';
    case 'error':
      return '连接错误';
    case 'idle':
    default:
      return '已停止';
  }
}

function formatState(state: FeedTimeframeState): string {
  return state === 'completed' ? '已完成' : '形成中';
}

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

function formatVolume(value: number): string {
  return volumeFormatter.format(value);
}

export default function RealtimeFeedPanel({ timeframe, datasetId }: RealtimeFeedPanelProps): JSX.Element {
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [candles, setCandles] = useState<CandleDatum[]>([]);
  const [latestEvent, setLatestEvent] = useState<FeedEvent | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
    closeSource();
    if (!mountedRef.current) {
      return;
    }
    setStatus('idle');
  }, [closeSource]);

  const handleStart = useCallback(() => {
    closeSource();
    if (!mountedRef.current) {
      return;
    }
    setStatus('connecting');
    setCandles([]);
    setLatestEvent(null);
    setLastUpdateAt(null);
    setError(null);

    try {
      const source = openReplayFeed({ timeframe, datasetId });
      eventSourceRef.current = source;

      source.onopen = () => {
        if (!mountedRef.current) {
          return;
        }
        setStatus('streaming');
      };

      source.onmessage = (event) => {
        if (!mountedRef.current) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as FeedEvent;
          setLatestEvent(payload);
          setLastUpdateAt(Date.now());
          setCandles((previous) => mergeCandle(previous, toCandle(payload.timeframeBar)));
        } catch (err) {
          console.error('无法解析行情事件', err);
        }
      };

      source.addEventListener('end', () => {
        if (!mountedRef.current) {
          return;
        }
        setStatus('completed');
        closeSource();
      });

      source.onerror = () => {
        if (!mountedRef.current) {
          return;
        }
        setStatus('error');
        setError('实时行情连接出现问题');
        closeSource();
      };
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setStatus('error');
      setError((err as Error).message || '无法启动实时行情');
      closeSource();
    }
  }, [closeSource, datasetId, timeframe]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closeSource();
    };
  }, [closeSource]);

  useEffect(() => {
    setCandles([]);
    setLatestEvent(null);
    setLastUpdateAt(null);
    setError(null);
    closeSource();
    setStatus('idle');
  }, [closeSource, datasetId, timeframe]);

  const secondBar = latestEvent?.secondBar ?? null;
  const timeframeBar = latestEvent?.timeframeBar ?? null;

  const statusLabel = useMemo(() => formatStatus(status), [status]);
  const timeframeStateLabel = useMemo(
    () => (latestEvent ? formatState(latestEvent.timeframeState) : '—'),
    [latestEvent],
  );

  const lastUpdateLabel = useMemo(() => {
    if (!lastUpdateAt) {
      return '—';
    }
    return new Date(lastUpdateAt).toLocaleTimeString('zh-CN', { hour12: false });
  }, [lastUpdateAt]);

  return (
    <div className="realtime-panel">
      <header className="realtime-panel__header">
        <div>
          <h2 className="realtime-panel__title">实时回放行情</h2>
          <div className="realtime-panel__meta">
            <span>时间框架：{timeframe}</span>
            <span>数据集：{datasetId ?? '激活数据集'}</span>
          </div>
        </div>
        <div className="realtime-panel__controls">
          <span className={`realtime-panel__status realtime-panel__status--${status}`}>
            状态：{statusLabel}
          </span>
          <button
            type="button"
            className="realtime-panel__button realtime-panel__button--start"
            onClick={handleStart}
            disabled={status === 'connecting' || status === 'streaming'}
          >
            开始播放
          </button>
          <button
            type="button"
            className="realtime-panel__button realtime-panel__button--stop"
            onClick={handleStop}
            disabled={status === 'idle'}
          >
            停止播放
          </button>
        </div>
      </header>

      <div className="realtime-panel__info">
        <div className="realtime-panel__grid">
          <div className="realtime-panel__group">
            <div className="realtime-panel__group-title">最新秒级行情</div>
            {secondBar ? (
              <dl className="realtime-panel__stats">
                <div>
                  <dt>时间</dt>
                  <dd>{formatTimestampLabel(secondBar.timestamp)}</dd>
                </div>
                <div>
                  <dt>开/收</dt>
                  <dd>
                    {formatPrice(secondBar.open)} / {formatPrice(secondBar.close)}
                  </dd>
                </div>
                <div>
                  <dt>最高</dt>
                  <dd>{formatPrice(secondBar.high)}</dd>
                </div>
                <div>
                  <dt>最低</dt>
                  <dd>{formatPrice(secondBar.low)}</dd>
                </div>
                <div>
                  <dt>成交量</dt>
                  <dd>{formatVolume(secondBar.volume)}</dd>
                </div>
              </dl>
            ) : (
              <div className="realtime-panel__placeholder">等待行情更新…</div>
            )}
          </div>

          <div className="realtime-panel__group">
            <div className="realtime-panel__group-title">时间框架 K 线</div>
            {timeframeBar ? (
              <dl className="realtime-panel__stats">
                <div>
                  <dt>状态</dt>
                  <dd className={`realtime-panel__state realtime-panel__state--${latestEvent?.timeframeState ?? 'forming'}`}>
                    {timeframeStateLabel}
                  </dd>
                </div>
                <div>
                  <dt>起止</dt>
                  <dd>
                    {formatTimestampLabel(timeframeBar.startTimestamp)}
                    <span className="realtime-panel__arrow">→</span>
                    {formatTimestampLabel(timeframeBar.endTimestamp)}
                  </dd>
                </div>
                <div>
                  <dt>开/收</dt>
                  <dd>
                    {formatPrice(timeframeBar.open)} / {formatPrice(timeframeBar.close)}
                  </dd>
                </div>
                <div>
                  <dt>最高</dt>
                  <dd>{formatPrice(timeframeBar.high)}</dd>
                </div>
                <div>
                  <dt>最低</dt>
                  <dd>{formatPrice(timeframeBar.low)}</dd>
                </div>
                <div>
                  <dt>成交量</dt>
                  <dd>{formatVolume(timeframeBar.volume)}</dd>
                </div>
              </dl>
            ) : (
              <div className="realtime-panel__placeholder">等待时间框架数据…</div>
            )}
          </div>
        </div>
        <div className="realtime-panel__footnote">最后更新时间：{lastUpdateLabel}</div>
        {error ? <div className="realtime-panel__error">{error}</div> : null}
      </div>

      <div className="realtime-panel__chart">
        <ChartPanel candles={candles} mode="streaming" />
      </div>
    </div>
  );
}
