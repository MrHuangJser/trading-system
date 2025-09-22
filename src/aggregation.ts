import { createTimestamp, minuteKey } from './time';
import type { MinuteBar, ParsedTimestamp, SecondBar } from './types';

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

export class MinuteAggregator {
  private state: AggregationState | null = null;

  add(sample: SecondBar): MinuteBar | null {
    const key = minuteKey(sample.timestamp);
    if (!this.state) {
      this.state = this.createState(sample, key);
      return null;
    }
    if (key !== this.state.key) {
      const completed = this.toMinuteBar(this.state);
      this.state = this.createState(sample, key);
      return completed;
    }
    this.state.endTimestamp = sample.timestamp;
    this.state.high = Math.max(this.state.high, sample.high);
    this.state.low = Math.min(this.state.low, sample.low);
    this.state.close = sample.close;
    this.state.volume += sample.volume;
    return null;
  }

  flush(): MinuteBar | null {
    if (!this.state) {
      return null;
    }
    const completed = this.toMinuteBar(this.state);
    this.state = null;
    return completed;
  }

  private createState(sample: SecondBar, key: string): AggregationState {
    const startTimestamp = createTimestamp(
      sample.timestamp.date,
      sample.timestamp.hour,
      sample.timestamp.minute,
      0,
    );
    return {
      key,
      startTimestamp,
      endTimestamp: sample.timestamp,
      open: sample.open,
      high: sample.high,
      low: sample.low,
      close: sample.close,
      volume: sample.volume,
    };
  }

  private toMinuteBar(state: AggregationState): MinuteBar {
    return {
      startTimestamp: state.startTimestamp,
      endTimestamp: state.endTimestamp,
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      volume: state.volume,
    };
  }
}
