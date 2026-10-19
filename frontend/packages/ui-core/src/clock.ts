/**
 * The clock of the patient context (docs/specs/modules/design-system.md §1 and §2.3; patient-context.yaml,
 * predicate contextChangedWithinWindow). Elapsed time is measured on a monotonic clock, never on the wall
 * clock, so a wall-clock correction cannot shorten or lengthen the SI-16 re-verification window. The wall
 * clock is read only to stamp the sign command for the server (CTRL-0016-7).
 *
 * The clock is injected: production uses systemClock, tests and the demo route use FakeClock. A clock that
 * cannot be read gives `undefined` through readMonotonicMs and readWallTimeMs, never a guess; the patient
 * context treats that as "within the window" (fail closed).
 */

/** A source of time. Either method may throw or return a non-finite value when the clock cannot be read. */
export interface Clock {
  /** Milliseconds on a monotonic timeline with an arbitrary origin (performance.now() in production). */
  monotonicMs(): number;
  /** Milliseconds since the Unix epoch (Date.now() in production); used only to stamp commands. */
  wallTimeMs(): number;
}

function readFinite(read: () => number): number | undefined {
  try {
    const value = read();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The monotonic time, or undefined when the clock cannot be read (it threw or gave a non-finite value). */
export function readMonotonicMs(clock: Clock): number | undefined {
  return readFinite(() => clock.monotonicMs());
}

/** The wall-clock time, or undefined when it cannot be read. */
export function readWallTimeMs(clock: Clock): number | undefined {
  return readFinite(() => clock.wallTimeMs());
}

/**
 * The platform clocks: performance.now() (monotonic in browsers, Node.js and React Native) and Date.now().
 * Where performance is missing, monotonicMs throws, which readMonotonicMs reports as unreadable.
 */
export const systemClock: Clock = {
  monotonicMs(): number {
    const performance = (globalThis as { performance?: { now(): number } }).performance;
    if (performance === undefined) {
      throw new Error('no monotonic clock: globalThis.performance is missing');
    }
    return performance.now();
  },
  wallTimeMs(): number {
    return Date.now();
  },
};

/**
 * A clock that tests (and the demo route) set by hand. It starts at the given times and moves only when
 * told to. `unreadable` makes both reads throw, as a broken platform clock would.
 */
export class FakeClock implements Clock {
  #monotonicMs: number;
  #wallTimeMs: number;
  #unreadable = false;

  constructor(start: { readonly monotonicMs?: number; readonly wallTimeMs?: number } = {}) {
    this.#monotonicMs = start.monotonicMs ?? 0;
    this.#wallTimeMs = start.wallTimeMs ?? Date.UTC(2026, 0, 1);
  }

  monotonicMs(): number {
    if (this.#unreadable) {
      throw new Error('FakeClock: the clock is unreadable');
    }
    return this.#monotonicMs;
  }

  wallTimeMs(): number {
    if (this.#unreadable) {
      throw new Error('FakeClock: the clock is unreadable');
    }
    return this.#wallTimeMs;
  }

  /** Moves both clocks forward (or, with a negative value, the monotonic clock backwards, to test that case). */
  advance(ms: number): void {
    this.#monotonicMs += ms;
    this.#wallTimeMs += ms;
  }

  /** Sets the monotonic reading directly; the wall clock is left alone. */
  setMonotonicMs(ms: number): void {
    this.#monotonicMs = ms;
  }

  /** Sets the wall-clock reading directly, as a wall-clock correction would; the monotonic clock is left alone. */
  setWallTimeMs(ms: number): void {
    this.#wallTimeMs = ms;
  }

  /** Makes both reads throw (true) or work again (false). */
  setUnreadable(unreadable: boolean): void {
    this.#unreadable = unreadable;
  }
}
