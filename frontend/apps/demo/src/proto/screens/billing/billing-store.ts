/**
 * The billing screen's session state: payments taken, exemption requests, claim steps and the shift, kept in
 * memory for this browser tab only (a module-level store read with useSyncExternalStore), so it survives a
 * change of patient but not a reload. Nothing is written back to the shared data. SYNTHETIC DATA ONLY.
 */
import { useSyncExternalStore } from 'react';
import { DEMO_NOW_ISO, INVOICES } from '../../data/index.ts';
import type { Invoice } from '../../data/index.ts';
import {
  DEFAULT_REJECTION,
  recordOfDataPayment,
  seedClaim,
  type Claim,
  type ClaimStatus,
  type ExemptionId,
  type ExemptionRequest,
  type PaymentRecord,
} from './billing-data.ts';

export interface ShiftClose {
  readonly closedIso: string;
  readonly countedIqd: number;
  readonly countedUsdCents: number;
  readonly expectedIqd: number;
  readonly expectedUsdCents: number;
}

export interface BillingSession {
  /** Payments taken in this session, by invoice id. */
  readonly payments: Readonly<Record<string, readonly PaymentRecord[]>>;
  readonly exemptions: Readonly<Record<string, ExemptionRequest>>;
  /** Claims changed in this session, by invoice id (otherwise the seed). */
  readonly claims: Readonly<Record<string, Claim>>;
  readonly receiptSeq: number;
  readonly authSeq: number;
  readonly shiftClose: ShiftClose | null;
}

const INITIAL: BillingSession = {
  payments: {},
  exemptions: {},
  claims: {},
  receiptSeq: 50_200,
  authSeq: 731_400,
  shiftClose: null,
};

let state: BillingSession = INITIAL;
const listeners = new Set<() => void>();

function set(next: BillingSession): void {
  state = next;
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

function snapshot(): BillingSession {
  return state;
}

/** The session state; re-renders on every change. */
export function useBillingSession(): BillingSession {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Every payment of an invoice: the shared data's, then this session's. */
export function paymentsOf(session: BillingSession, invoice: Invoice): readonly PaymentRecord[] {
  return [...invoice.payments.map((payment) => recordOfDataPayment(invoice, payment)), ...(session.payments[invoice.id] ?? [])];
}

/** Every payment of the day (shared data and this session, estimates included), newest first. */
export function allPaymentsToday(session: BillingSession): readonly PaymentRecord[] {
  const today = DEMO_NOW_ISO.slice(0, 10);
  const fromData = INVOICES.flatMap((invoice) => invoice.payments.map((payment) => recordOfDataPayment(invoice, payment)));
  const fromSession = Object.values(session.payments).flat();
  return [...fromData, ...fromSession]
    .filter((record) => record.iso.startsWith(today))
    .toSorted((a, b) => b.iso.localeCompare(a.iso) || b.receipt.localeCompare(a.receipt));
}

/** The claim of an invoice: this session's version, else the seed (null for self-pay). */
export function claimOf(session: BillingSession, invoice: Invoice): Claim | null {
  return session.claims[invoice.id] ?? seedClaim(invoice);
}

export const billingActions = {
  /** The next receipt number (`SYN-RCT-50201`, …) and card authorisation code. */
  nextNumbers(): { readonly receipt: string; readonly paymentId: string; readonly authCode: string } {
    const receiptSeq = state.receiptSeq + 1;
    const authSeq = state.authSeq + 7;
    set({ ...state, receiptSeq, authSeq });
    return { receipt: `SYN-RCT-${String(receiptSeq)}`, paymentId: `SYN-PAY-${String(receiptSeq)}`, authCode: `SYN-AUTH-${String(authSeq)}` };
  },

  recordPayment(record: PaymentRecord): void {
    const existing = state.payments[record.invoiceId] ?? [];
    set({ ...state, payments: { ...state.payments, [record.invoiceId]: [...existing, record] } });
  },

  requestExemption(invoiceId: string, ruleId: ExemptionId, evidence: string, requestedById: string): void {
    const request: ExemptionRequest = { ruleId, evidence, status: 'pending', requestedIso: DEMO_NOW_ISO, requestedById, decidedIso: null };
    set({ ...state, exemptions: { ...state.exemptions, [invoiceId]: request } });
  },

  decideExemption(invoiceId: string, decision: 'approved' | 'rejected'): void {
    const current = state.exemptions[invoiceId];
    if (current === undefined) {
      return;
    }
    set({ ...state, exemptions: { ...state.exemptions, [invoiceId]: { ...current, status: decision, decidedIso: DEMO_NOW_ISO } } });
  },

  withdrawExemption(invoiceId: string): void {
    const { [invoiceId]: _removed, ...rest } = state.exemptions;
    set({ ...state, exemptions: rest });
  },

  /** Moves a claim to a new status (a cashier's submission or a simulated insurer reply). */
  moveClaim(invoice: Invoice, status: ClaimStatus): void {
    const claim = claimOf(state, invoice);
    if (claim === null) {
      return;
    }
    const next: Claim = {
      ...claim,
      status,
      events: [...claim.events, { status, iso: DEMO_NOW_ISO, note: null, simulated: true }],
      rejectionReason: status === 'rejected' ? (claim.rejectionReason ?? DEFAULT_REJECTION) : null,
    };
    set({ ...state, claims: { ...state.claims, [invoice.id]: next } });
  },

  closeShift(close: Omit<ShiftClose, 'closedIso'>): void {
    set({ ...state, shiftClose: { ...close, closedIso: DEMO_NOW_ISO } });
  },

  reopenShift(): void {
    set({ ...state, shiftClose: null });
  },
};
