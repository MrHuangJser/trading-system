import { createTimestamp } from '../time';
import type { ParsedTimestamp, SecondBar, TimeframeBar } from '../types';
import type { Timeframe } from '../lib/timeframe';
import { timeframeToMinutes } from '../lib/timeframe';

interface AggregationState {
  key: string;
  startTimestamp: ParsedTimestamp;
  endTimestamp: ParsedTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TimeframeAggregator {
  private state: AggregationState | null = null;

  constructor(private readonly timeframe: Timeframe) {}

  add(sample: SecondBar): TimeframeBar | null {
    const bucket = this.resolveBucket(sample.timestamp);
    if (!this.state) {
      this.state = this.createState(sample, bucket);
      return null;
    }

    if (bucket.key !== this.state.key) {
      const completed = this.toTimeframeBar(this.state);
      this.state = this.createState(sample, bucket);
      return completed;
    }

    this.state.endTimestamp = sample.timestamp;
    this.state.high = Math.max(this.state.high, sample.high);
    this.state.low = Math.min(this.state.low, sample.low);
    this.state.close = sample.close;
    this.state.volume += sample.volume;

    return null;
  }

  flush(): TimeframeBar | null {
    if (!this.state) {
      return null;
    }
    const completed = this.toTimeframeBar(this.state);
    this.state = null;
    return completed;
  }

  getCurrentPartial(): TimeframeBar | null {
    if (!this.state) {
      return null;
    }
    return this.toTimeframeBar(this.state);
  }

  getTimeframe(): Timeframe {
    return this.timeframe;
  }

  private createState(sample: SecondBar, bucket: BucketInfo): AggregationState {
    return {
      key: bucket.key,
      startTimestamp: bucket.startTimestamp,
      endTimestamp: sample.timestamp,
      open: sample.open,
      high: sample.high,
      low: sample.low,
      close: sample.close,
      volume: sample.volume,
    };
  }

  private toTimeframeBar(state: AggregationState): TimeframeBar {
    return {
      timeframe: this.timeframe,
      startTimestamp: state.startTimestamp,
      endTimestamp: state.endTimestamp,
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      volume: state.volume,
    };
  }

  private resolveBucket(timestamp: ParsedTimestamp): BucketInfo {
    const timeframeMinutes = timeframeToMinutes(this.timeframe);
    const totalMinutes = timestamp.hour * 60 + timestamp.minute;
    const bucketStartMinutes = Math.floor(totalMinutes / timeframeMinutes) * timeframeMinutes;
    const startHour = Math.floor(bucketStartMinutes / 60);
    const startMinute = bucketStartMinutes % 60;
    const startTimestamp = createTimestamp(timestamp.date, startHour, startMinute, 0);
    const key = `${startTimestamp.raw}|${this.timeframe}`;
    return { key, startTimestamp };
  }
}

interface BucketInfo {
  key: string;
  startTimestamp: ParsedTimestamp;
}
