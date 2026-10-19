/**
 * The lab screen's demo state: what the user did (collected, received, rejected, acknowledged) kept in memory
 * for the session, outside React, so it survives a patient switch (the clinical layout unmounts the screen
 * while the window changes patient). Nothing is written back to the shared data module.
 *
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { acknowledgeCriticalResult, DEMO_NOW_ISO, resetCriticalAcknowledgements, type Text3 } from '../../data/index.ts';
import {
  BASE_LAB_SPECIMENS,
  REJECT_REASON_TEXT,
  type AckActionId,
  type IdentityCheck,
  type LabSpecimen,
  type RejectReasonId,
} from './lab-data.ts';

export type LabTab = 'results' | 'specimens' | 'worklist';

/** A critical result acknowledged in this session (sign + read-back). */
export interface CriticalAck {
  readonly resultId: string;
  /** The clinician who signed the acknowledgement. */
  readonly acknowledgedById: string;
  readonly acknowledgedIso: string;
  /** Who phoned from the laboratory. */
  readonly callerId: string;
  /** Who received the call and read the value back. */
  readonly informedId: string;
  /** When the call was received, `HH:mm` on the demo day. */
  readonly informedAt: string;
  readonly actions: readonly AckActionId[];
}

export interface PendingCollect {
  readonly specimenId: string;
  readonly patientId: string;
  /** performance.now() when requested; the request expires after two minutes. */
  readonly at: number;
}

export interface LabState {
  readonly patches: Readonly<Record<string, Partial<LabSpecimen>>>;
  /** Recollection tasks created in this session. */
  readonly added: readonly LabSpecimen[];
  readonly acks: Readonly<Record<string, CriticalAck>>;
  /** The chosen tab; null until the user picks one (the role then decides). */
  readonly tab: LabTab | null;
  /** "Collect" pressed for another patient: open the collection once that patient's record is open. */
  readonly pendingCollect: PendingCollect | null;
  /** How many times each specimen's label was printed (simulated). */
  readonly printed: Readonly<Record<string, number>>;
}

const INITIAL: LabState = { patches: {}, added: [], acks: {}, tab: null, pendingCollect: null, printed: {} };

let state: LabState = INITIAL;
const listeners = new Set<() => void>();

function update(next: (current: LabState) => LabState): void {
  state = next(state);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LabState {
  return state;
}

export function useLabState(): LabState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Every specimen with this session's changes applied. */
export function labSpecimensOf(current: LabState): readonly LabSpecimen[] {
  return [...BASE_LAB_SPECIMENS, ...current.added].map((specimen) => {
    const patch = current.patches[specimen.id];
    return patch === undefined ? specimen : { ...specimen, ...patch };
  });
}

export function useLabSpecimens(current: LabState): readonly LabSpecimen[] {
  return useMemo(() => labSpecimensOf(current), [current]);
}

const PENDING_LIFETIME_MS = 120_000;

function patch(id: string, change: Partial<LabSpecimen>): (current: LabState) => LabState {
  return (current) => ({ ...current, patches: { ...current.patches, [id]: { ...current.patches[id], ...change } } });
}

function rootId(id: string): string {
  return id.replace(/-R\d+$/u, '');
}

export const labActions = {
  setTab(tab: LabTab): void {
    update((current) => ({ ...current, tab }));
  },
  collect(id: string, byId: string, identityCheck: IdentityCheck): void {
    update(patch(id, { status: 'collected', collectedIso: DEMO_NOW_ISO, collectedById: byId, identityCheck }));
  },
  receive(id: string): void {
    update(patch(id, { status: 'received', receivedIso: DEMO_NOW_ISO }));
  },
  startAnalysis(id: string): void {
    update(patch(id, { status: 'in-progress' }));
  },
  /** Rejects a specimen; with `recollect`, creates the recollection task and returns its id. */
  reject(specimen: LabSpecimen, reason: RejectReasonId, comment: string, byId: string, recollect: boolean): string | null {
    const text = REJECT_REASON_TEXT[reason];
    let newId: string | null = null;
    update((current) => {
      const rejected = patch(specimen.id, {
        status: 'rejected',
        rejectionReason: text,
        rejectedIso: DEMO_NOW_ISO,
        rejectedById: byId,
        rejectComment: comment.trim() === '' ? null : comment.trim(),
      })(current);
      if (!recollect) {
        return rejected;
      }
      const root = rootId(specimen.id);
      const siblings = labSpecimensOf(rejected).filter((candidate) => candidate.id.startsWith(`${root}-R`)).length;
      newId = `${root}-R${String(siblings + 1)}`;
      const note: Text3 = {
        en: `Recollect: ${text.en}`,
        ckb: `دووبارە وەرگرتنەوە: ${text.ckb}`,
        ar: `إعادة السحب: ${text.ar}`,
      };
      const task: LabSpecimen = {
        ...specimen,
        id: newId,
        status: 'ordered',
        priority: specimen.priority === 'routine' ? 'urgent' : specimen.priority,
        collectedIso: null,
        collectedById: null,
        receivedIso: null,
        resultedIso: null,
        verifiedById: null,
        rejectionReason: null,
        orderedIso: DEMO_NOW_ISO,
        recollectOf: specimen.id,
        note,
        rejectedIso: null,
        rejectedById: null,
        rejectComment: null,
        identityCheck: null,
      };
      return { ...rejected, added: [...rejected.added, task] };
    });
    return newId;
  },
  acknowledge(ack: CriticalAck): void {
    update((current) => ({ ...current, acks: { ...current.acks, [ack.resultId]: ack } }));
    // Shared with the other screens (home, ward board, chart): the result is no longer unacknowledged.
    acknowledgeCriticalResult(ack.resultId);
  },
  markPrinted(id: string): void {
    update((current) => ({ ...current, printed: { ...current.printed, [id]: (current.printed[id] ?? 0) + 1 } }));
  },
  requestCollectAfterSwitch(specimenId: string, patientId: string): void {
    update((current) => ({ ...current, tab: 'worklist', pendingCollect: { specimenId, patientId, at: performance.now() } }));
  },
  /** Takes the pending collection for this patient, if it is still fresh. */
  takePendingCollect(patientId: string): string | null {
    const pending = state.pendingCollect;
    if (pending === null) {
      return null;
    }
    if (performance.now() - pending.at > PENDING_LIFETIME_MS) {
      update((current) => ({ ...current, pendingCollect: null }));
      return null;
    }
    if (pending.patientId !== patientId) {
      return null;
    }
    update((current) => ({ ...current, pendingCollect: null }));
    return pending.specimenId;
  },
  /** Back to the data as shipped (for presenters). */
  reset(): void {
    update(() => INITIAL);
    resetCriticalAcknowledgements();
  },
};
