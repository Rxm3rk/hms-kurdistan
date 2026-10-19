/**
 * The orders screen's model: draft orders in the basket, the allergy check, and turning a signed draft into
 * an `Order` kept in the screen's state (nothing is written back to the data module).
 */
import { PROTO_UNIT_DISPLAY_MAP } from '../../ui/index.ts';
import {
  currentEncounter,
  DEMO_NOW_ISO,
  ORDER_STATUS_LABEL,
  SEVERITY_LABEL,
  type Allergy,
  type Order,
  type OrderPriority,
  type OrderStatus,
  type Patient,
  type RouteId,
  type Text3,
  type Tone,
} from '../../data/index.ts';
import type { UnitDisplayMap } from '@hms/ui-core';
import { DURATION, FREQUENCY, FREQUENCY_TIMES, type DoseUnit, type DurationId, type FormularyDrug, type FrequencyId } from './catalogue.ts';
import type { OrdersMessageKey } from './messages.ts';

/** The prototype's unit map plus `mmol` (potassium chloride). */
export const ORDERS_UNIT_MAP: UnitDisplayMap = new Map([...PROTO_UNIT_DISPLAY_MAP, ['mmol', 'mmol']]);

export interface DraftWarning {
  readonly tone: Tone;
  readonly key: OrdersMessageKey;
  readonly vars?: Readonly<Record<string, string | Text3>>;
}

export interface DraftMedication {
  readonly drugId: string;
  readonly drug: string;
  readonly dose: string;
  readonly unit: DoseUnit;
  readonly route: RouteId;
  readonly frequency: FrequencyId;
  readonly duration: DurationId;
  readonly indication: string;
  readonly highAlert: boolean;
}

export interface DraftOverride {
  readonly reason: Text3;
  readonly comment: string;
}

export interface DraftOrder {
  readonly id: string;
  readonly category: 'medication' | 'lab' | 'imaging';
  readonly title: Text3;
  /** Short code shown beside the title (CBC, CXR PA), or null. */
  readonly code: string | null;
  readonly priority: OrderPriority;
  readonly medication: DraftMedication | null;
  readonly detail: Text3 | null;
  readonly warnings: readonly DraftWarning[];
  readonly override: DraftOverride | null;
  readonly fromSet: Text3 | null;
}

let draftSeq = 0;

export function nextDraftId(): string {
  draftSeq += 1;
  return `SYN-DRAFT-${String(draftSeq).padStart(3, '0')}`;
}

let orderSeq = 0;

/** A drug name as a Text3 (the same Latin name in every language). */
export function same(text: string): Text3 {
  return { en: text, ckb: text, ar: text };
}

// ---------------------------------------------------------------------------------------------------------
// Allergy check
// ---------------------------------------------------------------------------------------------------------

const PENICILLIN_CODES = new Set(['SYN-ALG-PENICILLIN', 'SYN-ALG-AMOXICILLIN-CLAVULANATE']);

export interface AllergyMatch {
  readonly allergy: Allergy;
  /** block: the order may not go ahead without an override; caution: a warning; note: information. */
  readonly level: 'block' | 'caution' | 'note';
}

export function allergyMatches(patient: Patient, drug: FormularyDrug): readonly AllergyMatch[] {
  if (patient.allergies.kind !== 'list') {
    return [];
  }
  const out: AllergyMatch[] = [];
  for (const allergy of patient.allergies.items) {
    if (drug.allergyClass === 'penicillin' && PENICILLIN_CODES.has(allergy.code)) {
      out.push({ allergy, level: 'block' });
    } else if (drug.allergyClass === 'cephalosporin' && PENICILLIN_CODES.has(allergy.code) && allergy.severity === 'severe') {
      out.push({ allergy, level: 'caution' });
    } else if (drug.allergyClass === 'opioid' && allergy.code === 'SYN-ALG-CODEINE') {
      out.push({ allergy, level: 'note' });
    }
  }
  return out;
}

export function blockingAllergy(patient: Patient, drug: FormularyDrug): Allergy | undefined {
  return allergyMatches(patient, drug).find((match) => match.level === 'block')?.allergy;
}

/** "Penicillin (Anaphylaxis, severe)" in one language. */
export function allergyText(allergy: Allergy, locale: 'en' | 'ckb' | 'ar', severityLabel: (severity: NonNullable<Allergy['severity']>) => string): string {
  const parts: string[] = [];
  if (allergy.reaction !== undefined) {
    parts.push(allergy.reaction[locale]);
  }
  if (allergy.severity !== undefined) {
    parts.push(severityLabel(allergy.severity));
  }
  const sep = locale === 'en' ? ', ' : '، ';
  return parts.length === 0 ? allergy.substance[locale] : `${allergy.substance[locale]} (${parts.join(sep)})`;
}

/** The allergy as text in all three languages (for warnings kept in state). */
export function allergyText3(allergy: Allergy): Text3 {
  return {
    en: allergyText(allergy, 'en', (severity) => SEVERITY_LABEL[severity].en),
    ckb: allergyText(allergy, 'ckb', (severity) => SEVERITY_LABEL[severity].ckb),
    ar: allergyText(allergy, 'ar', (severity) => SEVERITY_LABEL[severity].ar),
  };
}

/** The patient's allergy with this code, if any. */
export function allergyByCode(patient: Patient, code: string): Allergy | undefined {
  return patient.allergies.kind === 'list' ? patient.allergies.items.find((item) => item.code === code) : undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------------------------------------

const LIVE_STATUSES: readonly OrderStatus[] = ['draft', 'pending-signature', 'active', 'in-progress', 'on-hold'];

export function isLive(order: Order): boolean {
  return LIVE_STATUSES.includes(order.status);
}

/** Warnings for a medicine already ordered (live orders) or already in the basket. */
export function medicationDuplicates(drug: FormularyDrug, existing: readonly Order[], basket: readonly DraftOrder[]): DraftWarning[] {
  const name = drug.drug.toLowerCase();
  const out: DraftWarning[] = [];
  for (const order of existing) {
    if (order.medication !== null && isLive(order) && order.medication.drug.toLowerCase().includes(name)) {
      out.push({ tone: 'warning', key: 'duplicateWarn', vars: { drug: drug.drug, id: order.id, status: ORDER_STATUS_LABEL[order.status] } });
    }
  }
  for (const draft of basket) {
    if (draft.medication?.drugId === drug.id) {
      out.push({ tone: 'warning', key: 'duplicateWarn', vars: { drug: drug.drug, id: draft.id, status: ORDER_STATUS_LABEL.draft } });
    }
  }
  return out;
}

/** A live laboratory order that already covers this test, if any. */
export function labDuplicate(match: readonly string[], existing: readonly Order[]): Order | undefined {
  return existing.find(
    (order) => order.category === 'lab' && isLive(order) && match.some((word) => order.title.en.toLowerCase().includes(word.toLowerCase())),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Age (for weight-based doses)
// ---------------------------------------------------------------------------------------------------------

/** Whole years from the date of birth to the demo day. */
export function ageYears(patient: Patient): number {
  const [year = '0', month = '07', day = '01'] = patient.dob.split('-');
  const birth = { y: Number(year), m: Number(month), d: Number(day) };
  const today = { y: 2026, m: 10, d: 19 };
  let years = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) {
    years -= 1;
  }
  return years;
}

// ---------------------------------------------------------------------------------------------------------
// Signed drafts become orders (screen state only)
// ---------------------------------------------------------------------------------------------------------

export function draftToOrder(draft: DraftOrder, patient: Patient, userId: string): Order {
  orderSeq += 1;
  const med = draft.medication;
  const encounterId = currentEncounter(patient.id)?.id ?? `SYN-ENC-${patient.id.slice(-4)}`;
  const detail: Text3 | null =
    med === null
      ? draft.detail
      : {
          en: `${med.indication} · ${DURATION[med.duration].en}`,
          ckb: `${med.indication} · ${DURATION[med.duration].ckb}`,
          ar: `${med.indication} · ${DURATION[med.duration].ar}`,
        };
  const alerts =
    draft.override === null
      ? []
      : [
          {
            tone: 'warning' as const,
            text: {
              en: `Allergy override, co-signed: ${draft.override.reason.en}`,
              ckb: `تێپەڕاندنی هەستیاری، واژۆی هاوبەشی کراوە: ${draft.override.reason.ckb}`,
              ar: `تجاوز الحساسية، موقّع بتوقيع مشترك: ${draft.override.reason.ar}`,
            },
          },
        ];
  return {
    id: `SYN-ORD-N${String(orderSeq).padStart(3, '0')}`,
    patientId: patient.id,
    encounterId,
    category: draft.category,
    title: draft.title,
    detail,
    priority: draft.priority,
    status: 'active',
    orderedById: userId,
    orderedIso: DEMO_NOW_ISO,
    medication:
      med === null
        ? null
        : {
            drug: med.drug,
            dose: med.dose,
            doseUnit: med.unit,
            route: med.route,
            frequency: FREQUENCY[med.frequency],
            prn: med.frequency.endsWith('prn'),
            prnReason: null,
            highAlert: med.highAlert,
            times: FREQUENCY_TIMES[med.frequency],
            continuous: med.frequency === 'continuous',
          },
    alerts,
  };
}
