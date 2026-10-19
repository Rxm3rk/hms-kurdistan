/**
 * Critical results acknowledged during this browser session (the lab screen's read-back and sign step).
 * Kept in memory so every screen agrees once a result is acknowledged: `unacknowledgedCriticals()` (./lab.ts)
 * leaves these out, so home, the ward board, the chart and the figures stop listing them. A reload, or the
 * lab screen's "Reset lab demo", brings the shipped state back. SYNTHETIC DATA ONLY.
 */
let acknowledged: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes to acknowledgements (for useSyncExternalStore). */
export function subscribeAcknowledgements(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The result ids acknowledged in this session (a new set after each change). */
export function sessionAcknowledgements(): ReadonlySet<string> {
  return acknowledged;
}

/** Records that a critical result was acknowledged in this session. */
export function acknowledgeCriticalResult(resultId: string): void {
  if (acknowledged.has(resultId)) {
    return;
  }
  acknowledged = new Set([...acknowledged, resultId]);
  notify();
}

/** True when the result was acknowledged in this session. */
export function isAcknowledgedInSession(resultId: string): boolean {
  return acknowledged.has(resultId);
}

/** Forgets this session's acknowledgements (the lab screen's "Reset lab demo"). */
export function resetCriticalAcknowledgements(): void {
  if (acknowledged.size === 0) {
    return;
  }
  acknowledged = new Set();
  notify();
}
