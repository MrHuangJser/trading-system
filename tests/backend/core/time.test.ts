import { describe, expect, test } from 'bun:test';
import {
  cloneTimestamp,
  createTimestamp,
  isRegularTradingHours,
  isSessionEnd,
  isSessionStart,
  minuteKey,
  parseTimestamp,
  timestampToUnixMs,
} from '../../../src-backend/core/time';

describe('core/time', () => {
  test('parseTimestamp returns structured components', () => {
    const parsed = parseTimestamp('2023-09-15 08:30:05');
    expect(parsed.year).toBe(2023);
    expect(parsed.month).toBe(9);
    expect(parsed.day).toBe(15);
    expect(parsed.hour).toBe(8);
    expect(parsed.minute).toBe(30);
    expect(parsed.second).toBe(5);
    expect(parsed.raw).toBe('2023-09-15 08:30:05');
  });

  test('createTimestamp mirrors parseTimestamp', () => {
    const created = createTimestamp('2023-09-15', 9, 45, 10);
    expect(created.raw).toBe('2023-09-15 09:45:10');
    expect(created.minute).toBe(45);
  });

  test('regular trading hours checks', () => {
    const open = parseTimestamp('2023-09-15 08:30:00');
    const pre = parseTimestamp('2023-09-15 08:29:59');
    const close = parseTimestamp('2023-09-15 16:00:00');

    expect(isRegularTradingHours(open)).toBe(true);
    expect(isRegularTradingHours(pre)).toBe(false);
    expect(isRegularTradingHours(close)).toBe(false);
  });

  test('session transitions', () => {
    const prev = parseTimestamp('2023-09-15 08:29:59');
    const open = parseTimestamp('2023-09-15 08:30:00');
    const after = parseTimestamp('2023-09-15 08:30:01');
    const end = parseTimestamp('2023-09-15 16:00:00');

    expect(isSessionStart(prev, open)).toBe(true);
    expect(isSessionStart(open, after)).toBe(false);
    expect(isSessionEnd(after, end)).toBe(true);
  });

  test('minuteKey and timestampToUnixMs utilities', () => {
    const ts = parseTimestamp('2023-09-15 12:34:56');
    expect(minuteKey(ts)).toBe('2023-09-15 12:34');
    // Validate ordering via ISO string
    expect(new Date(timestampToUnixMs(ts)).toISOString()).toBe('2023-09-15T12:34:56.000Z');
  });

  test('cloneTimestamp updates fields while preserving date', () => {
    const ts = parseTimestamp('2023-09-15 08:30:00');
    const cloned = cloneTimestamp(ts, { minute: 45, second: 10 });
    expect(cloned.raw).toBe('2023-09-15 08:45:10');
    expect(cloned.date).toBe('2023-09-15');
  });
});
