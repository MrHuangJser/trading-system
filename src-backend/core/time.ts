import type { ParsedTimestamp } from './types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const RTH_START_SECONDS = 8 * SECONDS_PER_HOUR + 30 * SECONDS_PER_MINUTE;
const RTH_END_SECONDS = 16 * SECONDS_PER_HOUR;

export function parseTimestamp(raw: string): ParsedTimestamp {
  const [datePart, timePart] = raw.trim().split(' ');
  if (!datePart || !timePart) {
    throw new Error(`Invalid timestamp string: ${raw}`);
  }
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const [hourStr, minuteStr, secondStr] = timePart.split(':');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);
  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid timestamp components: ${raw}`);
  }
  return {
    raw,
    date: datePart,
    time: timePart,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

export function createTimestamp(
  date: string,
  hour: number,
  minute: number,
  second: number,
): ParsedTimestamp {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid date: ${date}`);
  }
  const time = toTimeString(hour, minute, second);
  const raw = `${date} ${time}`;
  return {
    raw,
    date,
    time,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

export function toTimeString(hour: number, minute: number, second: number): string {
  return [hour, minute, second]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function minuteKey(ts: ParsedTimestamp): string {
  return `${ts.date} ${ts.hour.toString().padStart(2, '0')}:${ts.minute.toString().padStart(2, '0')}`;
}

export function isRegularTradingHours(ts: ParsedTimestamp): boolean {
  const seconds = ts.hour * SECONDS_PER_HOUR + ts.minute * SECONDS_PER_MINUTE + ts.second;
  return seconds >= RTH_START_SECONDS && seconds < RTH_END_SECONDS;
}

export function isSessionStart(prev: ParsedTimestamp | null, current: ParsedTimestamp): boolean {
  if (!isRegularTradingHours(current)) {
    return false;
  }
  if (!prev) {
    return true;
  }
  const prevSeconds = prev.hour * SECONDS_PER_HOUR + prev.minute * SECONDS_PER_MINUTE + prev.second;
  const currentSeconds = current.hour * SECONDS_PER_HOUR + current.minute * SECONDS_PER_MINUTE + current.second;
  const newDay = prev.date !== current.date;
  const enteredRth = !isRegularTradingHours(prev) && isRegularTradingHours(current);
  const firstRthSecond = currentSeconds === RTH_START_SECONDS;
  return newDay || (enteredRth && firstRthSecond) || (firstRthSecond && prevSeconds !== currentSeconds);
}

export function isSessionEnd(prev: ParsedTimestamp, current: ParsedTimestamp): boolean {
  if (!isRegularTradingHours(prev)) {
    return false;
  }
  if (!isRegularTradingHours(current)) {
    return true;
  }
  return false;
}

export function cloneTimestamp(
  base: ParsedTimestamp,
  updates: Partial<Pick<ParsedTimestamp, 'hour' | 'minute' | 'second' | 'time' | 'raw'>>,
): ParsedTimestamp {
  const hour = updates.hour ?? base.hour;
  const minute = updates.minute ?? base.minute;
  const second = updates.second ?? base.second;
  const time = updates.time ?? toTimeString(hour, minute, second);
  const raw = updates.raw ?? `${base.date} ${time}`;
  return {
    ...base,
    hour,
    minute,
    second,
    time,
    raw,
  };
}

export function timestampToUnixMs(ts: ParsedTimestamp): number {
  return Date.UTC(ts.year, ts.month - 1, ts.day, ts.hour, ts.minute, ts.second);
}
