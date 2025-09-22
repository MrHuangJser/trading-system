import { useEffect, useMemo, useState, type FormEvent } from 'react';
import ChartPanel from './ChartPanel';
import SummaryPanel from './SummaryPanel';
import TradeTable from './TradeTable';
import { runBacktest, API_BASE } from '../api/backtest';
import {
  SUPPORTED_TIMEFRAMES,
  type BacktestPayload,
  type BacktestRequest,
  type DatasetSummary,
  type Timeframe,
  type TradeMarker,
} from '../types';
import type { JSX } from 'react';

const DATASETS_ENDPOINT = `${API_BASE}/api/data`;

interface FormState {
  timeframe: Timeframe;
  datasetId: string;
  baseQuantity: string;
  contractMultiplier: string;
  seconds: string;
  enableLongEntry: boolean;
  enableLongTakeProfit: boolean;
  enableShortEntry: boolean;
  enableShortTakeProfit: boolean;
}

const INITIAL_FORM: FormState = {
  timeframe: '1m',
  datasetId: '',
  baseQuantity: '',
  contractMultiplier: '',
  seconds: '',
  enableLongEntry: true,
  enableLongTakeProfit: true,
  enableShortEntry: true,
  enableShortTakeProfit: true,
};

function formatDatasetOption(dataset: DatasetSummary): string {
  const name = dataset.originalName || dataset.id;
  const details: string[] = [];
  if (Number.isFinite(dataset.rows) && dataset.rows > 0) {
    details.push(`${dataset.rows.toLocaleString()} 行`);
  }
  if (dataset.isActive) {
    details.push('当前激活');
  }
  const date = new Date(dataset.uploadedAt);
  if (!Number.isNaN(date.getTime())) {
    details.push(date.toLocaleDateString('zh-CN'));
  }
  if (details.length === 0) {
    return name;
  }
  return `${name} · ${details.join(' · ')}`;
}

async function fetchDatasets(): Promise<DatasetSummary[]> {
  const response = await fetch(DATASETS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`无法加载数据集 (${response.status})`);
  }
  return (await response.json()) as DatasetSummary[];
}

function buildRequestFromForm(form: FormState): BacktestRequest {
  const request: BacktestRequest = {
    timeframe: form.timeframe,
    enableLongEntry: form.enableLongEntry,
    enableLongTakeProfit: form.enableLongTakeProfit,
    enableShortEntry: form.enableShortEntry,
    enableShortTakeProfit: form.enableShortTakeProfit,
  };

  if (form.datasetId) {
    request.datasetId = form.datasetId;
  }

  const baseQuantity = Number.parseInt(form.baseQuantity, 10);
  if (!Number.isNaN(baseQuantity) && baseQuantity > 0) {
    request.baseQuantity = baseQuantity;
  }

  const contractMultiplier = Number.parseFloat(form.contractMultiplier);
  if (!Number.isNaN(contractMultiplier) && contractMultiplier > 0) {
    request.contractMultiplier = contractMultiplier;
  }

  const seconds = Number.parseInt(form.seconds, 10);
  if (!Number.isNaN(seconds) && seconds > 0) {
    request.seconds = seconds;
  }

  return request;
}

export default function BacktestView(): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [payload, setPayload] = useState<BacktestPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await runBacktest({});
        if (cancelled) {
          return;
        }
        setPayload(result);
        setForm((previous) => ({
          ...previous,
          timeframe: result.metadata.resolution,
          baseQuantity: result.metadata.baseQuantity.toString(),
          contractMultiplier: result.metadata.contractMultiplier.toString(),
          seconds: result.metadata.secondLimit !== null ? String(result.metadata.secondLimit) : '',
        }));
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || '无法加载回测数据');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setDatasetsLoading(true);
        const list = await fetchDatasets();
        if (cancelled) {
          return;
        }
        setDatasets(list);
        setDatasetError(null);
      } catch (err) {
        if (!cancelled) {
          setDatasetError((err as Error).message || '无法加载数据集列表');
        }
      } finally {
        if (!cancelled) {
          setDatasetsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markers: TradeMarker[] = useMemo(() => {
    if (!payload) {
      return [];
    }
    return payload.trades.flatMap((trade) => {
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
  }, [payload]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const request = buildRequestFromForm(form);
      const result = await runBacktest(request);
      setPayload(result);
      setForm((previous) => ({
        ...previous,
        timeframe: result.metadata.resolution,
        baseQuantity: result.metadata.baseQuantity.toString(),
        contractMultiplier: result.metadata.contractMultiplier.toString(),
        seconds: result.metadata.secondLimit !== null ? String(result.metadata.secondLimit) : '',
      }));
    } catch (err) {
      setSubmitError((err as Error).message || '回测执行失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app app--status">
        <div className="status">正在加载回测数据…</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="app app--status">
        <div className="status status--error">{error ?? '无法加载回测数据'}</div>
      </div>
    );
  }

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
        <form className="backtest-form" onSubmit={handleSubmit}>
          <div className="backtest-form__grid">
            <label className="backtest-form__field">
              <span>时间框架</span>
              <select
                value={form.timeframe}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    timeframe: event.target.value as Timeframe,
                  }))
                }
                disabled={submitting}
              >
                {SUPPORTED_TIMEFRAMES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="backtest-form__field">
              <span>数据集</span>
              <select
                value={form.datasetId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    datasetId: event.target.value,
                  }))
                }
                disabled={datasetsLoading || submitting}
              >
                <option value="">使用当前配置</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id} title={dataset.note ?? undefined}>
                    {formatDatasetOption(dataset)}
                  </option>
                ))}
              </select>
              {datasetError ? <span className="backtest-form__hint">{datasetError}</span> : null}
            </label>

            <label className="backtest-form__field">
              <span>秒级截断</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.seconds}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    seconds: event.target.value,
                  }))
                }
                placeholder="保持默认"
                disabled={submitting}
              />
            </label>

            <label className="backtest-form__field">
              <span>基础手数</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.baseQuantity}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    baseQuantity: event.target.value,
                  }))
                }
                placeholder="保持默认"
                disabled={submitting}
              />
            </label>

            <label className="backtest-form__field">
              <span>合约乘数</span>
              <input
                type="number"
                min="0.0001"
                step="0.01"
                value={form.contractMultiplier}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    contractMultiplier: event.target.value,
                  }))
                }
                placeholder="保持默认"
                disabled={submitting}
              />
            </label>
          </div>

          <div className="backtest-form__toggles">
            <label className="backtest-form__toggle">
              <input
                type="checkbox"
                checked={form.enableLongEntry}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    enableLongEntry: event.target.checked,
                  }))
                }
                disabled={submitting}
              />
              <span>开启多头入场</span>
            </label>
            <label className="backtest-form__toggle">
              <input
                type="checkbox"
                checked={form.enableLongTakeProfit}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    enableLongTakeProfit: event.target.checked,
                  }))
                }
                disabled={submitting}
              />
              <span>开启多头止盈</span>
            </label>
            <label className="backtest-form__toggle">
              <input
                type="checkbox"
                checked={form.enableShortEntry}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    enableShortEntry: event.target.checked,
                  }))
                }
                disabled={submitting}
              />
              <span>开启空头入场</span>
            </label>
            <label className="backtest-form__toggle">
              <input
                type="checkbox"
                checked={form.enableShortTakeProfit}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    enableShortTakeProfit: event.target.checked,
                  }))
                }
                disabled={submitting}
              />
              <span>开启空头止盈</span>
            </label>
          </div>

          <div className="backtest-form__actions">
            <button className="backtest-form__submit" type="submit" disabled={submitting}>
              {submitting ? '运行中…' : '运行回测'}
            </button>
            {submitError ? <span className="backtest-form__error">{submitError}</span> : null}
          </div>
        </form>
      </section>

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
