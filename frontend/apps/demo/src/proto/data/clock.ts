/**
 * The prototype's fixed demo clock: Monday 19 October 2026, 09:30 in Asia/Baghdad (UTC+03:00, no daylight
 * saving). Every "now", "today", "due" and "overdue" in the data is relative to this instant, so the demo
 * looks the same whenever it is shown.
 */

export const DEMO_TIME_ZONE = 'Asia/Baghdad';
export const DEMO_OFFSET = '+03:00';
export const DEMO_TODAY = '2026-10-19';
export const DEMO_NOW_ISO = `${DEMO_TODAY}T09:30:00${DEMO_OFFSET}`;
export const DEMO_NOW: Date = new Date(DEMO_NOW_ISO);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The date `days` days before (negative: after) the demo day, `YYYY-MM-DD`. */
export function demoDate(daysAgo: number): string {
  const date = new Date(Date.parse(`${DEMO_TODAY}T12:00:00${DEMO_OFFSET}`) - daysAgo * DAY_MS);
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** An instant on the demo day at `hhmm` (`'14:00'`), as an ISO string with the Baghdad offset. */
export function todayAt(hhmm: string): string {
  return `${DEMO_TODAY}T${hhmm}:00${DEMO_OFFSET}`;
}

/** An instant `daysAgo` days before the demo day at `hhmm`. */
export function daysAgoAt(daysAgo: number, hhmm: string): string {
  return `${demoDate(daysAgo)}T${hhmm}:00${DEMO_OFFSET}`;
}

/** Minutes from the demo clock to `iso` (negative: in the past). */
export function minutesFromNow(iso: string): number {
  return Math.round((Date.parse(iso) - DEMO_NOW.getTime()) / 60000);
}

/** True when `iso` falls on the demo day (Baghdad time). */
export function isToday(iso: string): boolean {
  return iso.startsWith(DEMO_TODAY);
}
