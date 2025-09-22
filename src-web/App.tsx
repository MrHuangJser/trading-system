import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import ChartPanel from './components/ChartPanel';
import SummaryPanel from './components/SummaryPanel';
import TradeTable from './components/TradeTable';
import type { BacktestPayload, TradeMarker } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_SECONDS = import.meta.env.VITE_API_SECONDS_LIMIT ?? '';
const DATA_URL = `${API_BASE}/api/backtest${API_SECONDS ? `?seconds=${API_SECONDS}` : ''}`;

interface FetchState {
  loading: boolean;
  error: string | null;
  payload: BacktestPayload | null;
}

const initialState: FetchState = {
  loading: true,
  error: null,
  payload: null,
};

export default function App(): JSX.Element {
  const [state, setState] = useState<FetchState>(initialState);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
          throw new Error(`加载回测数据失败 (${response.status})`);
        }
        const payload = (await response.json()) as BacktestPayload;
        if (!cancelled) {
          setState({ loading: false, error: null, payload });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: (error as Error).message, payload: null });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markers: TradeMarker[] = useMemo(() => {
    if (!state.payload) {
      return [];
    }
    return state.payload.trades.flatMap((trade) => {
      const entry: TradeMarker = {
        id: `${trade.id}-entry`,
        tradeId: trade.id,
        type: 'entry',
        side: trade.side,
        label: trade.side === 'long' ? '多入场' : '空入场',
        timestamp: trade.entryTimestamp,
        price: trade.entryPrice,
      };
      const exitLabel =
        trade.exitReason === 'take-profit'
          ? trade.side === 'long'
            ? '多止盈'
            : '空止盈'
          : trade.side === 'long'
            ? '多止损'
            : '空止损';
      const exit: TradeMarker = {
        id: `${trade.id}-exit`,
        tradeId: trade.id,
        type: 'exit',
        side: trade.side,
        label: exitLabel,
        timestamp: trade.exitTimestamp,
        price: trade.exitPrice,
        exitReason: trade.exitReason,
      };
      return [entry, exit];
    });
  }, [state.payload]);

  if (state.loading) {
    return (
      <div className="app app--status">
        <div className="status">正在加载回测数据…</div>
      </div>
    );
  }

  if (state.error || !state.payload) {
    return (
      <div className="app app--status">
        <div className="status status--error">{state.error ?? '无法加载回测数据'}</div>
      </div>
    );
  }

  const { payload } = state;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>MotherBar 策略回测面板</h1>
          <p className="app__subtitle">数据文件：{payload.metadata.dataFile}</p>
        </div>
        <div className="app__meta">
          <span>基础合约数：{payload.metadata.baseQuantity}</span>
          <span>合约乘数：{payload.metadata.contractMultiplier}</span>
          <span>K线数量（{payload.metadata.resolution}）：{payload.metadata.candles.toLocaleString()}</span>
          <span>交易次数：{payload.metadata.trades}</span>
        </div>
      </header>

      <section className="app__section">
        <SummaryPanel metadata={payload.metadata} summary={payload.summary} />
      </section>

      <section className="app__section app__section--chart">
        <ChartPanel candles={payload.candles} markers={markers} trades={payload.trades} />
      </section>

      <section className="app__section">
        <TradeTable trades={payload.trades} />
      </section>
    </div>
  );
}
