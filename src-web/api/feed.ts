import type { FeedEvent, Timeframe } from '../types';
import { API_BASE } from './backtest';

const FEED_ENDPOINT = `${API_BASE}/api/feed/play`;

export interface OpenFeedOptions {
  timeframe: Timeframe;
  datasetId?: string | null;
}

function buildFeedUrl({ timeframe, datasetId }: OpenFeedOptions): string {
  const url = new URL(FEED_ENDPOINT, window.location.origin);
  url.searchParams.set('timeframe', timeframe);
  if (datasetId) {
    url.searchParams.set('datasetId', datasetId);
  }
  return url.toString();
}

export function openReplayFeed(options: OpenFeedOptions): EventSource {
  return new EventSource(buildFeedUrl(options));
}

export type { FeedEvent };
