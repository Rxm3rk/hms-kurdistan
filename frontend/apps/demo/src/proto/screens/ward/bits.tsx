/**
 * Small pieces the ward screen's parts share: safety badges (early warning, isolation, fall risk, allergies,
 * critical result), the bed state badge, admission facts for a bed's occupant, and navigation that waits for
 * the screen's dialog to close (the window has one modal slot).
 */
import { Bdi } from '@hms/design-system';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BED_STATE_LABEL,
  BED_STATE_TONE,
  DEMO_NOW,
  DEMO_TODAY,
  ISOLATION_LABEL,
  currentEncounter,
  demoDate,
  getWard,
} from '../../data/index.ts';
import type { BedState, Diagnosis, Patient, Text3, Tone, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import type { ScreenId } from '../../shell/index.ts';
import { useOpenPatient } from '../../shell/index.ts';
import { Badge, Dot, personName } from '../../ui/index.ts';
import { BED_REQUESTS, type EarlyWarning, type WarningBand } from './board-data.ts';
import { messages } from './messages.ts';
import type { BoardState } from './state.ts';

export const BAND_TONE: Readonly<Record<WarningBand, Tone>> = { low: 'neutral', medium: 'warning', high: 'danger' };

export function useBandLabel(): (band: WarningBand) => string {
  const t = useT(messages);
  return (band) => (band === 'high' ? t('bandHigh') : band === 'medium' ? t('bandMedium') : t('bandLow'));
}

export function EarlyWarningBadge({ warning, size = 'sm' }: { readonly warning: EarlyWarning; readonly size?: 'sm' | 'md' }): ReactNode {
  const t = useT(messages);
  const bandLabel = useBandLabel();
  return (
    <span className="ward-ew" title={bandLabel(warning.band)}>
      <Badge tone={BAND_TONE[warning.band]} strong={warning.band === 'high'} icon="activity" size={size}>
        {t('scoreBadge', { scale: warning.scale, score: warning.score })}
        <span className="hms-visually-hidden">, {bandLabel(warning.band)}</span>
      </Badge>
    </span>
  );
}

export function IsolationBadge({ patient, size = 'sm' }: { readonly patient: Patient; readonly size?: 'sm' | 'md' }): ReactNode {
  const f = useFormat();
  if (patient.isolation === null) {
    return null;
  }
  return (
    <Badge tone="warning" icon="isolation" size={size}>
      {patient.isolation.types.map((type) => f.text(ISOLATION_LABEL[type])).join(' · ')}
    </Badge>
  );
}

export function FallRiskBadge({ size = 'sm' }: { readonly size?: 'sm' | 'md' }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone="warning" icon="alert" size={size}>
      {t('fallRisk')}
    </Badge>
  );
}

export function AllergyBadge({ patient, size = 'sm' }: { readonly patient: Patient; readonly size?: 'sm' | 'md' }): ReactNode {
  const t = useT(messages);
  switch (patient.allergies.kind) {
    case 'list':
      return (
        <Badge tone="danger" icon="alert" size={size}>
          {t('allergyBadge', { count: patient.allergies.items.length })}
        </Badge>
      );
    case 'not-assessed':
      return (
        <Badge tone="warning" icon="alert" size={size}>
          {t('allergyNotAssessed')}
        </Badge>
      );
    case 'nka':
      return null;
  }
}

export function CriticalBadge({ size = 'sm' }: { readonly size?: 'sm' | 'md' }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone="danger" strong icon="flask" size={size}>
      {t('criticalBadge')}
    </Badge>
  );
}

export function BedStateBadge({ state, size = 'md' }: { readonly state: BedState; readonly size?: 'sm' | 'md' }): ReactNode {
  const f = useFormat();
  return (
    <Badge tone={BED_STATE_TONE[state]} size={size}>
      {f.text(BED_STATE_LABEL[state])}
    </Badge>
  );
}

/** The patient's name in the UI language's script, bidi-isolated (for titles and sentences). */
export function NameBdi({ patient }: { readonly patient: Patient }): ReactNode {
  const f = useFormat();
  return <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{personName(patient.name, f.locale)}</Bdi>;
}

export function StateLabel({ state }: { readonly state: BedState }): ReactNode {
  const f = useFormat();
  return (
    <span className="ward-state-label">
      <Dot tone={BED_STATE_TONE[state]} />
      <span>{f.text(BED_STATE_LABEL[state])}</span>
    </span>
  );
}

/** What the board knows about an occupant's stay. */
export interface StayFacts {
  readonly startIso: string | null;
  readonly expectedDischargeOn: string | null;
  readonly diagnoses: readonly Diagnosis[];
  readonly reason: Text3 | null;
  readonly attendingId: string | null;
  /** Day 1 is the day of admission. */
  readonly day: number | null;
  /** Admitted during the demo. */
  readonly demoAdmission: boolean;
}

export function stayOf(board: BoardState, patientId: string, wardId: WardId): StayFacts {
  const encounter = currentEncounter(patientId);
  const demo = board.admissions[patientId];
  if (demo !== undefined) {
    const request = BED_REQUESTS.find((candidate) => candidate.id === demo.requestId);
    return {
      startIso: demo.iso,
      expectedDischargeOn: null,
      diagnoses: encounter?.diagnoses ?? [],
      reason: request?.reason ?? null,
      attendingId: getWard(wardId).consultantId,
      day: 1,
      demoAdmission: true,
    };
  }
  if (encounter === undefined || encounter.type !== 'inpatient') {
    return { startIso: null, expectedDischargeOn: null, diagnoses: [], reason: null, attendingId: null, day: null, demoAdmission: false };
  }
  const days = Math.floor((DEMO_NOW.getTime() - Date.parse(encounter.startIso)) / 86_400_000);
  return {
    startIso: encounter.startIso,
    expectedDischargeOn: encounter.expectedDischargeOn,
    diagnoses: encounter.diagnoses,
    reason: encounter.reason,
    attendingId: encounter.attendingId,
    day: Math.max(0, days) + 1,
    demoAdmission: false,
  };
}

export type DischargeWhen = 'today' | 'tomorrow' | 'later' | 'overdue' | 'unset';

export function dischargeWhen(expected: string | null): DischargeWhen {
  if (expected === null) {
    return 'unset';
  }
  if (expected === DEMO_TODAY) {
    return 'today';
  }
  if (expected === demoDate(-1)) {
    return 'tomorrow';
  }
  return expected < DEMO_TODAY ? 'overdue' : 'later';
}

/** "Home today" / "Home tomorrow" / "Expected home 22 Oct 2026" / "Discharge date not set". */
export function useDischargeText(): (expected: string | null) => string {
  const t = useT(messages);
  const f = useFormat();
  return (expected) => {
    const when = dischargeWhen(expected);
    if (when === 'today') {
      return t('homeToday');
    }
    if (when === 'tomorrow') {
      return t('homeTomorrow');
    }
    if (expected === null) {
      return t('homeNotSet');
    }
    return t('expectedHome', { date: f.date(expected) });
  };
}

/**
 * Opens a patient's record once the screen's own dialog has closed: the patient switch confirmation needs
 * the window's single modal slot. Returns `go(patientId, screen)`; pass `dialogOpen` so it can wait.
 */
export function useDeferredOpenPatient(dialogOpen: boolean, closeDialog: () => void): (patientId: string, screen: ScreenId) => void {
  const openPatient = useOpenPatient();
  const [pending, setPending] = useState<{ readonly patientId: string; readonly screen: ScreenId } | null>(null);
  const closeRef = useRef(closeDialog);
  closeRef.current = closeDialog;

  useEffect(() => {
    if (!dialogOpen && pending !== null) {
      const { patientId, screen } = pending;
      setPending(null);
      openPatient(patientId, screen);
    }
  }, [dialogOpen, pending, openPatient]);

  return useCallback(
    (patientId, screen) => {
      if (dialogOpen) {
        setPending({ patientId, screen });
        closeRef.current();
      } else {
        openPatient(patientId, screen);
      }
    },
    [dialogOpen, openPatient],
  );
}
