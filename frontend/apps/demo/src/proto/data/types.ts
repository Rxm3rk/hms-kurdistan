/**
 * Types of the prototype's synthetic data. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE: every person, number
 * and record is invented; identifiers start with `SYN-`.
 *
 * Conventions:
 * - Text a user reads is a `Text3` (English, Sorani Kurdish, Arabic). Pick the current locale's form with
 *   `useFormat().text(value)` or `pickText(value, locale)` (src/proto/i18n/use-t.ts).
 * - Instants are ISO 8601 strings with the Asia/Baghdad offset (`2026-10-19T09:30:00+03:00`); dates are
 *   `YYYY-MM-DD`.
 * - Clinical numbers are decimal strings (`'6.8'`) with a UCUM unit code (`'mmol/L'`), shown through
 *   `<Qty value unit />` (src/proto/ui), never as JavaScript numbers. Money is an integer number of Iraqi
 *   dinars.
 * - Drug names are international generic names in Latin script (`drug: string`), shown left to right.
 */

/** A user-visible text in the three UI languages. The ckb and ar forms are AI drafts, unreviewed. */
export interface Text3 {
  readonly en: string;
  readonly ckb: string;
  readonly ar: string;
}

/** Colour tone of a status; maps to the design system's status colours. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export type Governorate = 'erbil' | 'sulaymaniyah' | 'duhok' | 'halabja';
export type Sex = 'female' | 'male';
export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
export type NameScript = 'ckb' | 'ar' | 'latin';

/** A person's name in its three forms; `ownScript` is the form in the person's own script. */
export interface PersonName {
  readonly ckb: string;
  readonly ar: string;
  readonly latin: string;
}

export interface PatientName extends PersonName {
  readonly ownScript: NameScript;
}

// ---------------------------------------------------------------------------------------------------------
// Staff and roles
// ---------------------------------------------------------------------------------------------------------

/** The four roles of the role switcher. */
export type RoleId = 'physician' | 'nurse' | 'cashier' | 'admin';

/** Every staff role in the data (the switcher offers the first four). */
export type StaffRole = RoleId | 'lab' | 'pharmacist' | 'radiology' | 'reception';

export type DepartmentId =
  | 'internal-medicine'
  | 'general-surgery'
  | 'paediatrics'
  | 'intensive-care'
  | 'cardiology'
  | 'endocrinology'
  | 'emergency'
  | 'laboratory'
  | 'radiology'
  | 'pharmacy'
  | 'nursing'
  | 'finance'
  | 'administration';

export interface Department {
  readonly id: DepartmentId;
  readonly name: Text3;
}

export interface StaffMember {
  readonly id: string;
  readonly name: PersonName;
  /** "Dr." and the like, or null. */
  readonly prefix: Text3 | null;
  readonly role: StaffRole;
  readonly title: Text3;
  readonly departmentId: DepartmentId;
  /** Obviously fake: +964 750 000 9xxx. */
  readonly phone: string;
  readonly active: boolean;
  readonly lastSignInIso: string;
}

// ---------------------------------------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------------------------------------

export type AllergySeverity = 'mild' | 'moderate' | 'severe';

export interface Allergy {
  /** Synthetic code, `SYN-ALG-…`. */
  readonly code: string;
  readonly substance: Text3;
  readonly reaction?: Text3;
  readonly severity?: AllergySeverity;
}

export type AllergyStatus =
  | { readonly kind: 'nka' }
  | { readonly kind: 'not-assessed' }
  | { readonly kind: 'list'; readonly items: readonly Allergy[] };

export type IsolationType = 'contact' | 'droplet' | 'airborne';

export interface PatientIsolation {
  readonly types: readonly IsolationType[];
  readonly reason: Text3;
}

export type CodeStatus =
  | { readonly kind: 'not-documented' }
  | { readonly kind: 'attempt-cpr' | 'dnacpr'; readonly recordedOn: string };

export interface PatientWeight {
  /** Decimal string in kilograms. */
  readonly kg: string;
  readonly measuredOn: string;
  readonly source: 'measured' | 'stated' | 'estimated';
}

export interface PatientAlert {
  readonly tone: Tone;
  readonly text: Text3;
}

export type PayerId = 'self-pay' | 'government' | 'syn-insurance' | 'intl-insurance';

export interface Payer {
  readonly id: PayerId;
  readonly name: Text3;
  /** Share of the bill the payer covers, 0 to 100. */
  readonly coveragePct: number;
  /** The currency the payer is billed in. */
  readonly currency: Currency;
}

export interface Patient {
  /** The patient id the window's patient context uses: `SYN-PAT-0101`. */
  readonly id: string;
  /** Medical record number: `SYN-100101-1`. */
  readonly mrn: string;
  readonly name: PatientName;
  readonly sex: Sex;
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY` (see dobPrecision). */
  readonly dob: string;
  readonly dobPrecision: 'day' | 'month' | 'year';
  readonly dobApproximate: boolean;
  readonly phone: string;
  readonly governorate: Governorate;
  readonly city: Text3;
  /** Synthetic national identity number. */
  readonly nationalId: string;
  readonly bloodGroup: BloodGroup | null;
  readonly payerId: PayerId;
  readonly preferredLanguage: 'en' | 'ckb' | 'ar';
  readonly allergies: AllergyStatus;
  readonly isolation: PatientIsolation | null;
  readonly codeStatus: CodeStatus;
  readonly weight: PatientWeight | null;
  /** Decimal string in centimetres, or null. */
  readonly heightCm: string | null;
  readonly alerts: readonly PatientAlert[];
  readonly hasPhoto: boolean;
  readonly emergencyContact: {
    readonly name: PersonName;
    readonly relation: Text3;
    readonly phone: string;
  } | null;
  /** True for the 14 hand-written patients with rich clinical data; false for the generated census. */
  readonly curated: boolean;
  readonly registeredOn: string;
}

// ---------------------------------------------------------------------------------------------------------
// Wards and beds
// ---------------------------------------------------------------------------------------------------------

export type WardId = 'med-a' | 'surg-b' | 'paeds' | 'icu';
export type BedState = 'available' | 'occupied' | 'cleaning' | 'blocked' | 'reserved';

export interface Ward {
  readonly id: WardId;
  /** Bed label prefix: `A`, `B`, `P`, `ICU`. */
  readonly code: string;
  readonly name: Text3;
  readonly floor: Text3;
  readonly departmentId: DepartmentId;
  readonly chargeNurseId: string;
  readonly consultantId: string;
  readonly phoneExt: string;
  readonly bedCount: number;
}

export interface Bed {
  /** `A-04`, `ICU-03`. */
  readonly id: string;
  readonly wardId: WardId;
  readonly state: BedState;
  /** The occupant, for occupied beds. */
  readonly patientId: string | null;
  /** Why it is blocked, who it is reserved for, or what the cleaning is. */
  readonly note: Text3 | null;
  /** When the bed entered its state. */
  readonly sinceIso: string;
  /** A single room with negative pressure or an anteroom. */
  readonly isolationRoom: boolean;
}

// ---------------------------------------------------------------------------------------------------------
// Encounters and appointments
// ---------------------------------------------------------------------------------------------------------

export type EncounterType = 'inpatient' | 'outpatient' | 'emergency';
export type EncounterStatus = 'planned' | 'active' | 'finished';

export interface Diagnosis {
  /** ICD-10 code. */
  readonly code: string;
  readonly text: Text3;
  readonly primary: boolean;
}

export interface Encounter {
  readonly id: string;
  readonly patientId: string;
  readonly type: EncounterType;
  readonly status: EncounterStatus;
  readonly startIso: string;
  readonly endIso: string | null;
  readonly departmentId: DepartmentId;
  readonly attendingId: string;
  readonly wardId: WardId | null;
  readonly bedId: string | null;
  readonly reason: Text3;
  readonly diagnoses: readonly Diagnosis[];
  readonly expectedDischargeOn: string | null;
}

export type ClinicId = 'clinic-im' | 'clinic-endo' | 'clinic-cardio' | 'clinic-surg' | 'clinic-paeds';

export interface Clinic {
  readonly id: ClinicId;
  readonly name: Text3;
  readonly room: string;
  readonly departmentId: DepartmentId;
}

export type AppointmentStatus = 'booked' | 'arrived' | 'in-consultation' | 'completed' | 'no-show' | 'cancelled';

export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly clinicId: ClinicId;
  readonly clinicianId: string;
  readonly startIso: string;
  readonly durationMin: number;
  readonly status: AppointmentStatus;
  readonly visitType: 'new' | 'follow-up';
  readonly reason: Text3;
  readonly arrivedIso: string | null;
  /** The ticket number on the waiting-room screen, once arrived. */
  readonly queueNumber: string | null;
  readonly encounterId: string | null;
}

// ---------------------------------------------------------------------------------------------------------
// Orders and medication
// ---------------------------------------------------------------------------------------------------------

export type OrderCategory = 'lab' | 'imaging' | 'medication' | 'nursing' | 'diet' | 'consult';
export type OrderStatus =
  | 'draft'
  | 'pending-signature'
  | 'active'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'cancelled';
export type OrderPriority = 'routine' | 'urgent' | 'stat';
export type RouteId = 'po' | 'iv' | 'iv-infusion' | 'im' | 'sc' | 'neb' | 'ng' | 'top';

export interface MedicationSpec {
  /** International generic name, Latin script. */
  readonly drug: string;
  /** Decimal string. */
  readonly dose: string;
  /** UCUM unit code of the dose (`mg`, `g`, `U`, `mL`, `ug/kg/min`…). */
  readonly doseUnit: string;
  readonly route: RouteId;
  readonly frequency: Text3;
  readonly prn: boolean;
  readonly prnReason: Text3 | null;
  /** High-alert medicine (insulin, opioids, vasopressors, anticoagulants, concentrated electrolytes). */
  readonly highAlert: boolean;
  /** Clock times of scheduled doses today (`HH:mm`), empty for PRN and continuous. */
  readonly times: readonly string[];
  readonly continuous: boolean;
}

export interface OrderAlert {
  readonly tone: Tone;
  readonly text: Text3;
}

export interface Order {
  readonly id: string;
  readonly patientId: string;
  readonly encounterId: string;
  readonly category: OrderCategory;
  readonly title: Text3;
  readonly detail: Text3 | null;
  readonly priority: OrderPriority;
  readonly status: OrderStatus;
  readonly orderedById: string;
  readonly orderedIso: string;
  readonly medication: MedicationSpec | null;
  readonly alerts: readonly OrderAlert[];
}

export type MarStatus = 'given' | 'due' | 'overdue' | 'scheduled' | 'held' | 'refused' | 'running';

/** One dose on today's medication administration record. */
export interface MarDose {
  readonly id: string;
  readonly patientId: string;
  readonly orderId: string;
  /** Scheduled time; for PRN doses the time it was given. */
  readonly scheduledIso: string;
  readonly status: MarStatus;
  readonly givenIso: string | null;
  readonly givenById: string | null;
  /** Second nurse for high-alert medicines. */
  readonly witnessId: string | null;
  readonly note: Text3 | null;
}

// ---------------------------------------------------------------------------------------------------------
// Laboratory
// ---------------------------------------------------------------------------------------------------------

export type SpecimenStatus =
  | 'ordered'
  | 'collected'
  | 'received'
  | 'in-progress'
  | 'resulted'
  | 'verified'
  | 'rejected';

export type ContainerType = 'serum' | 'edta' | 'citrate' | 'blood-gas' | 'blood-culture' | 'sputum' | 'capillary';

export interface Specimen {
  /** Barcode, `SYN-SPC-…`. */
  readonly id: string;
  readonly patientId: string;
  readonly orderIds: readonly string[];
  readonly panel: Text3;
  readonly specimenType: Text3;
  readonly container: ContainerType;
  readonly priority: OrderPriority;
  readonly status: SpecimenStatus;
  readonly collectedIso: string | null;
  readonly collectedById: string | null;
  readonly receivedIso: string | null;
  readonly resultedIso: string | null;
  readonly verifiedById: string | null;
  readonly rejectionReason: Text3 | null;
}

export type ResultFlag = 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high' | 'abnormal' | 'pending';

export interface CriticalNotice {
  readonly acknowledged: boolean;
  readonly acknowledgedById: string | null;
  readonly acknowledgedIso: string | null;
}

export interface LabResult {
  readonly id: string;
  readonly specimenId: string;
  readonly patientId: string;
  readonly analyte: Text3;
  /** Synthetic test code. */
  readonly code: string;
  /** Decimal string, or null for a text result (see `text`). */
  readonly value: string | null;
  /** UCUM unit code, or null. */
  readonly unit: string | null;
  readonly refLow: string | null;
  readonly refHigh: string | null;
  /** A text result or reference ("No growth at 48 h", "< 5"). */
  readonly text: Text3 | null;
  readonly flag: ResultFlag;
  readonly resultedIso: string;
  /** Present on critical results. */
  readonly critical: CriticalNotice | null;
  /** Earlier values of the same test, oldest first. */
  readonly history: readonly { readonly iso: string; readonly value: string }[];
}

// ---------------------------------------------------------------------------------------------------------
// Clinical record
// ---------------------------------------------------------------------------------------------------------

export interface VitalSigns {
  readonly patientId: string;
  readonly iso: string;
  /** Decimal strings. */
  readonly tempC: string;
  readonly heartRate: string;
  readonly systolic: string;
  readonly diastolic: string;
  readonly respRate: string;
  readonly spo2: string;
  readonly painScore: string | null;
  /** National Early Warning Score 2. */
  readonly news2: number;
  readonly recordedById: string;
}

export type NoteKind = 'admission' | 'progress' | 'nursing' | 'consult' | 'discharge-plan';

export interface ClinicalNote {
  readonly id: string;
  readonly patientId: string;
  readonly encounterId: string;
  readonly kind: NoteKind;
  readonly iso: string;
  readonly authorId: string;
  readonly title: Text3;
  readonly body: Text3;
  readonly signed: boolean;
}

// ---------------------------------------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------------------------------------

export type Currency = 'IQD' | 'USD';
export type ChargeCategory =
  | 'consultation'
  | 'bed'
  | 'laboratory'
  | 'imaging'
  | 'pharmacy'
  | 'procedure'
  | 'theatre'
  | 'supplies';
export type InvoiceStatus = 'draft' | 'open' | 'partially-paid' | 'paid' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'insurance' | 'transfer';

export interface InvoiceLine {
  readonly id: string;
  readonly category: ChargeCategory;
  readonly description: Text3;
  readonly quantity: number;
  /** Integer Iraqi dinars. */
  readonly unitPriceIqd: number;
  readonly serviceOn: string;
}

export interface Payment {
  readonly id: string;
  readonly iso: string;
  /** In the payment's own currency (USD may have cents). */
  readonly amount: number;
  readonly currency: Currency;
  readonly method: PaymentMethod;
  readonly receivedById: string;
  /** Receipt number, `SYN-RCT-…`. */
  readonly receipt: string;
}

export interface Invoice {
  /** `SYN-INV-…`. */
  readonly id: string;
  readonly patientId: string;
  readonly encounterId: string;
  readonly issuedIso: string;
  readonly status: InvoiceStatus;
  readonly payerId: PayerId;
  /** The currency the invoice is presented in; amounts are kept in IQD and converted at the demo rate. */
  readonly currency: Currency;
  readonly lines: readonly InvoiceLine[];
  readonly payments: readonly Payment[];
  readonly note: Text3 | null;
}

export interface InvoiceTotals {
  readonly grossIqd: number;
  readonly payerShareIqd: number;
  readonly patientShareIqd: number;
  readonly paidIqd: number;
  readonly balanceIqd: number;
}

export interface ExchangeRate {
  readonly usdToIqd: number;
  readonly asOf: string;
  readonly note: Text3;
}

// ---------------------------------------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------------------------------------

export interface AuditEvent {
  readonly id: string;
  readonly iso: string;
  readonly actorId: string;
  readonly action: Text3;
  readonly target: string | null;
  readonly tone: Tone;
}
