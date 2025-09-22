import type { BacktestPayload, BacktestRequest } from '../types';

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const BACKTEST_ENDPOINT = `${API_BASE}/api/backtest`;

function buildErrorMessage(status: number, body: string | undefined): string {
  if (!body) {
    return `回测请求失败 (${status})`;
  }
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    const message = parsed?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
  } catch {
    // Fall back to using the raw body text.
  }
  return body;
}

export async function runBacktest(request: BacktestRequest): Promise<BacktestPayload> {
  const response = await fetch(BACKTEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request ?? {}),
  });

  if (!response.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = undefined;
    }
    throw new Error(buildErrorMessage(response.status, errorBody));
  }

  return (await response.json()) as BacktestPayload;
}
