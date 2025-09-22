import type { Metadata, Summary } from '../types';
import type { JSX } from 'react';

interface SummaryPanelProps {
  metadata: Metadata;
  summary: Summary;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatPoints(value: number): string {
  return `${value.toFixed(2)} pts`;
}

export default function SummaryPanel({ metadata, summary }: SummaryPanelProps): JSX.Element {
  return (
    <div className="summary-panel">
      <div className="summary-panel__group">
        <h2>绩效概览</h2>
        <div className="summary-panel__items">
          <div className="summary-panel__item">
            <span className="summary-panel__label">总交易</span>
            <span className="summary-panel__value">{summary.totalTrades}</span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">赢/亏</span>
            <span className="summary-panel__value">
              {summary.winningTrades} / {summary.losingTrades}
            </span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">净盈亏 (点)</span>
            <span className={`summary-panel__value summary-panel__value--${summary.netPnlPoints >= 0 ? 'up' : 'down'}`}>
              {formatPoints(summary.netPnlPoints)}
            </span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">净盈亏 (美元)</span>
            <span className={`summary-panel__value summary-panel__value--${summary.netPnlCurrency >= 0 ? 'up' : 'down'}`}>
              {formatCurrency(summary.netPnlCurrency)}
            </span>
          </div>
        </div>
      </div>

      <div className="summary-panel__group">
        <h2>关于数据</h2>
        <div className="summary-panel__items">
          <div className="summary-panel__item">
            <span className="summary-panel__label">生成时间</span>
            <span className="summary-panel__value">{new Date(metadata.generatedAt).toLocaleString()}</span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">基础手数</span>
            <span className="summary-panel__value">{metadata.baseQuantity}</span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">合约乘数</span>
            <span className="summary-panel__value">{metadata.contractMultiplier}</span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">K线周期</span>
            <span className="summary-panel__value">{metadata.resolution}</span>
          </div>
          <div className="summary-panel__item">
            <span className="summary-panel__label">秒级样本数</span>
            <span className="summary-panel__value">{metadata.seconds.toLocaleString()}</span>
          </div>
          {metadata.secondLimit !== null ? (
            <div className="summary-panel__item">
              <span className="summary-panel__label">导出限制</span>
              <span className="summary-panel__value">{metadata.secondLimit.toLocaleString()} 秒</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
