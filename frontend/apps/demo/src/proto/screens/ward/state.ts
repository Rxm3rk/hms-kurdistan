/**
 * The bed board's state: the beds as they change during the demo, who still waits for a bed, the pending
 * transfers, today's counts and each patient's discharge checklist. Nothing is written back to the data
 * module; the state lives in the screen (and in a module-level copy, so the board keeps its changes while the
 * presenter visits a patient's chart and comes back; a page reload starts the morning again).
 *
 * The bed state machine is enforced here: a transition that the table does not allow leaves the board
 * unchanged.
 *
 *   available → occupied (admit, transfer in) · reserved · blocked
 *   occupied  → cleaning (discharge, transfer out)
 *   cleaning  → available (marked clean) · blocked
 *   blocked   → cleaning (returned to service: cleaned before use)
 *   reserved  → available (reservation released) · occupied
 */
import { BEDS, WARD_IDS } from '../../data/index.ts';
import type { BedState, Text3, WardId } from '../../data/index.ts';
import {
  ACTION_ISO,
  BED_REQUESTS,
  TRANSFER_REQUESTS,
  initialChecklist,
  type Checklist,
  type ChecklistItem,
  type TransferReason,
} from './board-data.ts';

export interface LiveBed {
  readonly id: string;
  readonly wardId: WardId;
  readonly state: BedState;
  readonly patientId: string | null;
  readonly note: Text3 | null;
  readonly sinceIso: string;
  readonly isolationRoom: boolean;
}

export type BoardEventKind = 'admitted' | 'transferred-in' | 'transferred-out' | 'discharged' | 'cleaned' | 'returned' | 'released';

export interface BoardEvent {
  readonly seq: number;
  readonly iso: string;
  readonly kind: BoardEventKind;
  readonly bedId: string;
  readonly wardId: WardId;
  readonly patientId: string | null;
  /** For transfers: the other bed. */
  readonly otherBedId: string | null;
}

export interface BoardState {
  readonly wardId: WardId;
  readonly beds: Readonly<Record<string, LiveBed>>;
  /** Ids of the bed requests still waiting. */
  readonly waiting: readonly string[];
  /** Ids of the transfer requests still pending. */
  readonly transfers: readonly string[];
  readonly admittedToday: Readonly<Record<WardId, number>>;
  readonly dischargedToday: Readonly<Record<WardId, number>>;
  /** Checklist items completed during the demo, by patient. */
  readonly checklist: Readonly<Record<string, Partial<Checklist>>>;
  /** Patients admitted during the demo: when and why (from the bed request). */
  readonly admissions: Readonly<Record<string, { readonly iso: string; readonly requestId: string | null }>>;
  /** Newest first. */
  readonly events: readonly BoardEvent[];
  readonly seq: number;
}

export const BED_TRANSITIONS: Readonly<Record<BedState, readonly BedState[]>> = {
  available: ['occupied', 'reserved', 'blocked'],
  occupied: ['cleaning'],
  cleaning: ['available', 'blocked'],
  blocked: ['cleaning'],
  reserved: ['available', 'occupied'],
};

export function canTransition(from: BedState, to: BedState): boolean {
  return BED_TRANSITIONS[from].includes(to);
}

const ZERO: Readonly<Record<WardId, number>> = { 'med-a': 0, 'surg-b': 0, paeds: 0, icu: 0 };

export function initialBoard(): BoardState {
  const beds: Record<string, LiveBed> = {};
  for (const bed of BEDS) {
    beds[bed.id] = { ...bed };
  }
  return {
    wardId: WARD_IDS[0] ?? 'med-a',
    beds,
    waiting: BED_REQUESTS.map((request) => request.id),
    transfers: TRANSFER_REQUESTS.map((request) => request.id),
    admittedToday: ZERO,
    dischargedToday: ZERO,
    checklist: {},
    admissions: {},
    events: [],
    seq: 0,
  };
}

export type BoardAction =
  | { readonly type: 'selectWard'; readonly wardId: WardId }
  | { readonly type: 'admit'; readonly patientId: string; readonly bedId: string; readonly requestId: string | null }
  | {
      readonly type: 'transfer';
      readonly fromBedId: string;
      readonly toBedId: string;
      readonly requestId: string | null;
      readonly reason: TransferReason;
    }
  | { readonly type: 'discharge'; readonly bedId: string }
  | { readonly type: 'markClean'; readonly bedId: string }
  | { readonly type: 'returnToService'; readonly bedId: string }
  | { readonly type: 'releaseReservation'; readonly bedId: string }
  | { readonly type: 'check'; readonly patientId: string; readonly item: ChecklistItem }
  | { readonly type: 'reset' };

const CLEAN_AFTER_DISCHARGE: Text3 = {
  en: 'Discharge clean requested (housekeeping paged, simulated)',
  ckb: 'داوای پاککردنەوەی دوای دەرچوون کرا (پاککەرەوەکان ئاگادار کرانەوە، نموونەیی)',
  ar: 'طُلب تنظيف بعد الخروج (أُبلغ فريق النظافة، محاكاة)',
};

const CLEAN_AFTER_TRANSFER: Text3 = {
  en: 'Clean after transfer (housekeeping paged, simulated)',
  ckb: 'پاککردنەوە دوای گواستنەوە (پاککەرەوەکان ئاگادار کرانەوە، نموونەیی)',
  ar: 'تنظيف بعد النقل (أُبلغ فريق النظافة، محاكاة)',
};

const CLEAN_BEFORE_USE: Text3 = {
  en: 'Back in service: clean before first use',
  ckb: 'گەڕایەوە بۆ کار: پێش یەکەم بەکارهێنان پاک دەکرێتەوە',
  ar: 'عاد إلى الخدمة: يُنظَّف قبل أول استخدام',
};

function move(state: BoardState, bedId: string, to: BedState, patch: Partial<Omit<LiveBed, 'id' | 'wardId' | 'state'>>): BoardState | null {
  const bed = state.beds[bedId];
  if (bed === undefined || !canTransition(bed.state, to)) {
    return null;
  }
  const next: LiveBed = { ...bed, ...patch, state: to, sinceIso: ACTION_ISO };
  return { ...state, beds: { ...state.beds, [bedId]: next } };
}

function withEvent(state: BoardState, event: Omit<BoardEvent, 'seq' | 'iso'>): BoardState {
  const seq = state.seq + 1;
  return { ...state, seq, events: [{ ...event, seq, iso: ACTION_ISO }, ...state.events] };
}

function bump(counts: Readonly<Record<WardId, number>>, wardId: WardId): Readonly<Record<WardId, number>> {
  return { ...counts, [wardId]: counts[wardId] + 1 };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'selectWard':
      return { ...state, wardId: action.wardId };
    case 'admit': {
      const bed = state.beds[action.bedId];
      const moved = move(state, action.bedId, 'occupied', { patientId: action.patientId, note: null });
      if (bed === undefined || moved === null) {
        return state;
      }
      return withEvent(
        {
          ...moved,
          waiting: moved.waiting.filter((id) => id !== action.requestId),
          admittedToday: bump(moved.admittedToday, bed.wardId),
          admissions: { ...moved.admissions, [action.patientId]: { iso: ACTION_ISO, requestId: action.requestId } },
        },
        { kind: 'admitted', bedId: bed.id, wardId: bed.wardId, patientId: action.patientId, otherBedId: null },
      );
    }
    case 'transfer': {
      const from = state.beds[action.fromBedId];
      const to = state.beds[action.toBedId];
      if (from === undefined || to === undefined || from.patientId === null || to.state !== 'available') {
        return state;
      }
      const patientId = from.patientId;
      const out = move(state, from.id, 'cleaning', { patientId: null, note: CLEAN_AFTER_TRANSFER });
      const into = out === null ? null : move(out, to.id, 'occupied', { patientId, note: null });
      if (into === null) {
        return state;
      }
      const transfers = into.transfers.filter((id) => {
        if (id === action.requestId) {
          return false;
        }
        // A request for this patient is met by any transfer to the requested ward.
        const request = TRANSFER_REQUESTS.find((candidate) => candidate.id === id);
        return !(request !== undefined && request.patientId === patientId && request.toWardId === to.wardId);
      });
      const logged = withEvent(
        { ...into, transfers },
        { kind: 'transferred-out', bedId: from.id, wardId: from.wardId, patientId, otherBedId: to.id },
      );
      return withEvent(logged, { kind: 'transferred-in', bedId: to.id, wardId: to.wardId, patientId, otherBedId: from.id });
    }
    case 'discharge': {
      const bed = state.beds[action.bedId];
      if (bed === undefined || bed.patientId === null) {
        return state;
      }
      const patientId = bed.patientId;
      const moved = move(state, bed.id, 'cleaning', { patientId: null, note: CLEAN_AFTER_DISCHARGE });
      if (moved === null) {
        return state;
      }
      const transfers = moved.transfers.filter((id) => TRANSFER_REQUESTS.find((request) => request.id === id)?.patientId !== patientId);
      return withEvent(
        { ...moved, transfers, dischargedToday: bump(moved.dischargedToday, bed.wardId) },
        { kind: 'discharged', bedId: bed.id, wardId: bed.wardId, patientId, otherBedId: null },
      );
    }
    case 'markClean': {
      const bed = state.beds[action.bedId];
      const moved = move(state, action.bedId, 'available', { note: null });
      if (bed === undefined || moved === null || bed.state !== 'cleaning') {
        return state;
      }
      return withEvent(moved, { kind: 'cleaned', bedId: bed.id, wardId: bed.wardId, patientId: null, otherBedId: null });
    }
    case 'returnToService': {
      const bed = state.beds[action.bedId];
      const moved = move(state, action.bedId, 'cleaning', { note: CLEAN_BEFORE_USE });
      if (bed === undefined || moved === null || bed.state !== 'blocked') {
        return state;
      }
      return withEvent(moved, { kind: 'returned', bedId: bed.id, wardId: bed.wardId, patientId: null, otherBedId: null });
    }
    case 'releaseReservation': {
      const bed = state.beds[action.bedId];
      const moved = move(state, action.bedId, 'available', { note: null });
      if (bed === undefined || moved === null || bed.state !== 'reserved') {
        return state;
      }
      return withEvent(moved, { kind: 'released', bedId: bed.id, wardId: bed.wardId, patientId: null, otherBedId: null });
    }
    case 'check': {
      const current = state.checklist[action.patientId] ?? {};
      return { ...state, checklist: { ...state.checklist, [action.patientId]: { ...current, [action.item]: true } } };
    }
    case 'reset':
      return { ...initialBoard(), wardId: state.wardId };
  }
}

/** The patient's checklist: the morning's state plus what was completed during the demo. */
export function checklistOf(state: BoardState, patientId: string): Checklist {
  return { ...initialChecklist(patientId), ...state.checklist[patientId] };
}

/** The bed a patient lies in on the board, if any. */
export function liveBedOfPatient(state: BoardState, patientId: string): LiveBed | undefined {
  return Object.values(state.beds).find((bed) => bed.patientId === patientId);
}

/** The beds of one ward, in bed order. */
export function liveBedsOfWard(state: BoardState, wardId: WardId): readonly LiveBed[] {
  return BEDS.filter((bed) => bed.wardId === wardId).flatMap((bed) => {
    const live = state.beds[bed.id];
    return live === undefined ? [] : [live];
  });
}

export interface WardCounts extends Readonly<Record<BedState, number>> {
  readonly total: number;
  readonly usable: number;
  readonly occupancy: number;
}

export function wardCounts(state: BoardState, wardId: WardId): WardCounts {
  const counts: Record<BedState, number> = { available: 0, occupied: 0, cleaning: 0, blocked: 0, reserved: 0 };
  const beds = liveBedsOfWard(state, wardId);
  for (const bed of beds) {
    counts[bed.state] += 1;
  }
  const usable = beds.length - counts.blocked;
  return { ...counts, total: beds.length, usable, occupancy: usable === 0 ? 0 : counts.occupied / usable };
}

// The board survives a visit to a patient's chart (the screen unmounts); a reload starts the morning again.
let sessionBoard: BoardState | null = null;

export function loadSessionBoard(): BoardState {
  return sessionBoard ?? initialBoard();
}

export function saveSessionBoard(state: BoardState): void {
  sessionBoard = state;
}
