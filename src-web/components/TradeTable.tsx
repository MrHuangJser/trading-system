import type { TradeDatum } from '../types';
import type { JSX } from 'react';

interface TradeTableProps {
  trades: TradeDatum[];
}

const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTimestamp(timestamp: number): string {
  return formatter.format(new Date(timestamp));
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatPnl(value: number): string {
  return value.toFixed(2);
}

export default function TradeTable({ trades }: TradeTableProps): JSX.Element {
  return (
    <div className="trade-table">
      <div className="trade-table__header">
        <h2>交易明细</h2>
        <span>共 {trades.length} 笔</span>
      </div>
      <div className="trade-table__body">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>方向</th>
              <th>数量</th>
              <th>入场</th>
              <th>离场</th>
              <th>结果</th>
              <th>点数</th>
              <th>美元</th>
              <th>加仓</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const isProfit = trade.pnlPoints >= 0;
              return (
                <tr key={trade.id} className={isProfit ? 'trade-row--profit' : 'trade-row--loss'}>
                  <td>{trade.id}</td>
                  <td>{trade.side === 'long' ? '多' : '空'}</td>
                  <td>{trade.quantity}</td>
                  <td>
                    <div>{formatPrice(trade.entryPrice)}</div>
                    <small>{formatTimestamp(trade.entryTimestamp)}</small>
                  </td>
                  <td>
                    <div>{formatPrice(trade.exitPrice)}</div>
                    <small>{formatTimestamp(trade.exitTimestamp)}</small>
                  </td>
                  <td>{trade.exitReason === 'take-profit' ? '止盈' : '止损'}</td>
                  <td>{formatPnl(trade.pnlPoints)}</td>
                  <td>{formatPnl(trade.pnlCurrency)}</td>
                  <td>{trade.addExecuted ? '是' : '否'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
