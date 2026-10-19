/** The injectable clock (docs/specs/modules/design-system.md §2.3: a monotonic clock that tests replace). */
import { describe, expect, it } from 'vitest';
import { FakeClock, readMonotonicMs, readWallTimeMs, systemClock, type Clock } from '../src/index.ts';

describe('clock', () => {
  it('reads the platform clocks', () => {
    const first = readMonotonicMs(systemClock);
    const second = readMonotonicMs(systemClock);
    expect(first).toBeTypeOf('number');
    expect(second).toBeGreaterThanOrEqual(first ?? Number.POSITIVE_INFINITY);
    expect(readWallTimeMs(systemClock)).toBeTypeOf('number');
  });

  it('moves a fake clock only when told to', () => {
    const clock = new FakeClock({ monotonicMs: 500, wallTimeMs: 1_000 });
    expect(readMonotonicMs(clock)).toBe(500);
    clock.advance(60_000);
    expect(readMonotonicMs(clock)).toBe(60_500);
    expect(readWallTimeMs(clock)).toBe(61_000);
    clock.setWallTimeMs(0);
    expect(readMonotonicMs(clock)).toBe(60_500);
    clock.setMonotonicMs(10);
    expect(readWallTimeMs(clock)).toBe(0);
  });

  it('reports a clock that throws or gives a non-finite value as unreadable, never as a time', () => {
    const fake = new FakeClock();
    fake.setUnreadable(true);
    expect(readMonotonicMs(fake)).toBeUndefined();
    expect(readWallTimeMs(fake)).toBeUndefined();
    const broken: Clock = { monotonicMs: () => Number.NaN, wallTimeMs: () => Number.POSITIVE_INFINITY };
    expect(readMonotonicMs(broken)).toBeUndefined();
    expect(readWallTimeMs(broken)).toBeUndefined();
  });

  it('reports a missing performance API as unreadable', () => {
    const saved = globalThis.performance;
    try {
      Object.defineProperty(globalThis, 'performance', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expect(readMonotonicMs(systemClock)).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, 'performance', { value: saved, configurable: true, writable: true });
    }
  });
});
