/** Small helpers of the Appointments & queue screen. */
export const NOW_HHMM = '09:30';

export function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** Minutes from `from` to `to` (both `HH:mm`), never negative. */
export function minutesBetween(from: string, to: string): number {
  return Math.max(0, toMinutes(to) - toMinutes(from));
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
