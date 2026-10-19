/**
 * Appointments & queue: clinic sessions across departments, a week of bookings (Saturday to Thursday; Friday
 * is the weekend), today's token queues and the no-show register. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * Today's bookings start from the shared APPOINTMENTS (so the outpatient screen and this one agree) and are
 * topped up with extra synthetic patients; the other days are generated.
 */
import { APPOINTMENTS, CLINICS, DEMO_TODAY, demoDate, getPatient, getStaff, PATIENTS } from '../index.ts';
import type { AppointmentStatus, Patient, PayerId, PersonName, Text3 } from '../types.ts';
import { extPatient } from './care-people.ts';

export interface ApptClinic {
  readonly id: string;
  readonly name: Text3;
  readonly department: Text3;
  readonly room: string;
  /** The clinician's name with prefix, already in the three forms. */
  readonly clinician: PersonName;
  /** Token prefix on the waiting-room screen: `M-07`. */
  readonly tokenPrefix: string;
  readonly slotMin: number;
  readonly start: string;
  readonly end: string;
  /** Weekdays (0 Sunday … 6 Saturday) the clinic runs. Never 5: Friday is the weekend. */
  readonly days: readonly number[];
  /** Consultation fee, integer IQD: new visit and follow-up. */
  readonly feeNewIqd: number;
  readonly feeFollowUpIqd: number;
}

function dr(staffId: string): PersonName {
  const member = getStaff(staffId);
  return { latin: `Dr. ${member.name.latin}`, ckb: `د. ${member.name.ckb}`, ar: `د. ${member.name.ar}` };
}

function clinicOf(id: (typeof CLINICS)[number]['id']): (typeof CLINICS)[number] {
  return CLINICS.find((clinic) => clinic.id === id) ?? CLINICS[0]!;
}

export const APPT_CLINICS: readonly ApptClinic[] = [
  {
    id: 'clinic-im',
    name: clinicOf('clinic-im').name,
    department: { en: 'Internal Medicine', ckb: 'نەخۆشییە ناوەکییەکان', ar: 'الأمراض الباطنية' },
    room: 'OPD-1',
    clinician: dr('SYN-STF-008'),
    tokenPrefix: 'M',
    slotMin: 15,
    start: '08:00',
    end: '13:00',
    days: [6, 0, 1, 2, 3, 4],
    feeNewIqd: 25_000,
    feeFollowUpIqd: 15_000,
  },
  {
    id: 'clinic-endo',
    name: clinicOf('clinic-endo').name,
    department: { en: 'Diabetes and Endocrinology', ckb: 'شەکرە و ڕژێنەکان', ar: 'السكري والغدد الصم' },
    room: 'OPD-2',
    clinician: dr('SYN-STF-016'),
    tokenPrefix: 'D',
    slotMin: 20,
    start: '08:40',
    end: '13:00',
    days: [6, 1, 3],
    feeNewIqd: 30_000,
    feeFollowUpIqd: 20_000,
  },
  {
    id: 'clinic-cardio',
    name: clinicOf('clinic-cardio').name,
    department: { en: 'Cardiology', ckb: 'نەخۆشییەکانی دڵ', ar: 'أمراض القلب' },
    room: 'OPD-3',
    clinician: dr('SYN-STF-017'),
    tokenPrefix: 'C',
    slotMin: 20,
    start: '08:30',
    end: '13:30',
    days: [0, 1, 2, 4],
    feeNewIqd: 35_000,
    feeFollowUpIqd: 20_000,
  },
  {
    id: 'clinic-surg',
    name: clinicOf('clinic-surg').name,
    department: { en: 'General Surgery', ckb: 'نەشتەرگەریی گشتی', ar: 'الجراحة العامة' },
    room: 'OPD-4',
    clinician: dr('SYN-STF-005'),
    tokenPrefix: 'S',
    slotMin: 15,
    start: '08:15',
    end: '12:30',
    days: [6, 1, 3, 4],
    feeNewIqd: 25_000,
    feeFollowUpIqd: 10_000,
  },
  {
    id: 'clinic-paeds',
    name: clinicOf('clinic-paeds').name,
    department: { en: 'Paediatrics', ckb: 'منداڵان', ar: 'طب الأطفال' },
    room: 'OPD-5',
    clinician: dr('SYN-STF-006'),
    tokenPrefix: 'P',
    slotMin: 20,
    start: '09:00',
    end: '13:00',
    days: [6, 0, 1, 2, 3, 4],
    feeNewIqd: 20_000,
    feeFollowUpIqd: 10_000,
  },
  {
    id: 'clinic-obgyn',
    name: { en: 'Obstetrics & Gynaecology Clinic', ckb: 'نۆرینگەی ئافرەتان و منداڵبوون', ar: 'عيادة النسائية والتوليد' },
    department: { en: 'Obstetrics & Gynaecology', ckb: 'ئافرەتان و منداڵبوون', ar: 'النسائية والتوليد' },
    room: 'OPD-6',
    clinician: { latin: 'Dr. Avesta Jalal', ckb: 'د. ئاڤێستا جەلال', ar: 'د. آفيستا جلال' },
    tokenPrefix: 'G',
    slotMin: 20,
    start: '09:00',
    end: '13:00',
    days: [6, 0, 1, 2, 3, 4],
    feeNewIqd: 30_000,
    feeFollowUpIqd: 15_000,
  },
  {
    id: 'clinic-ortho',
    name: { en: 'Orthopaedics Clinic', ckb: 'نۆرینگەی ئێسک و جومگە', ar: 'عيادة العظام والمفاصل' },
    department: { en: 'Orthopaedics', ckb: 'ئێسک و جومگە', ar: 'جراحة العظام' },
    room: 'OPD-7',
    clinician: { latin: 'Dr. Dana Mohammed', ckb: 'د. دانا محەمەد', ar: 'د. دانا محمد' },
    tokenPrefix: 'O',
    slotMin: 15,
    start: '10:00',
    end: '13:30',
    days: [0, 1, 2],
    feeNewIqd: 30_000,
    feeFollowUpIqd: 15_000,
  },
  {
    id: 'clinic-ent',
    name: { en: 'ENT Clinic', ckb: 'نۆرینگەی گوێ و لووت و قوڕگ', ar: 'عيادة الأنف والأذن والحنجرة' },
    department: { en: 'Ear, Nose and Throat', ckb: 'گوێ و لووت و قوڕگ', ar: 'الأنف والأذن والحنجرة' },
    room: 'OPD-8',
    clinician: { latin: 'Dr. Sana Hawrami', ckb: 'د. سەنا هەورامی', ar: 'د. سنا هورامي' },
    tokenPrefix: 'E',
    slotMin: 15,
    start: '08:30',
    end: '12:00',
    days: [6, 1, 4],
    feeNewIqd: 25_000,
    feeFollowUpIqd: 15_000,
  },
];

export function apptClinic(id: string): ApptClinic {
  return APPT_CLINICS.find((clinic) => clinic.id === id) ?? APPT_CLINICS[0]!;
}

export type BookingChannel = 'reception' | 'phone' | 'referral' | 'online';

export interface ApptRow {
  readonly id: string;
  readonly patient: Patient;
  readonly clinicId: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** `HH:mm`. */
  readonly time: string;
  readonly durationMin: number;
  readonly status: AppointmentStatus;
  readonly visitType: 'new' | 'follow-up';
  readonly reason: Text3;
  readonly token: string | null;
  readonly arrivedAt: string | null;
  readonly channel: BookingChannel;
  readonly payerId: PayerId;
  /** No-shows in the last 12 months before this booking. */
  readonly priorNoShows: number;
}

// The week shown: Saturday 17 to Friday 23 October 2026 (the demo day is Monday 19).
export const WEEK_DAYS: readonly string[] = [2, 1, 0, -1, -2, -3, -4].map((daysAgo) => demoDate(daysAgo));

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00+03:00`).getUTCDay();
}

export function slotsOf(clinic: ApptClinic): readonly string[] {
  const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const slots: string[] = [];
  for (let m = toMin(clinic.start); m + clinic.slotMin <= toMin(clinic.end); m += clinic.slotMin) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

const REASONS: readonly Text3[] = [
  { en: 'Blood pressure review', ckb: 'پێداچوونەوەی پەستانی خوێن', ar: 'مراجعة ضغط الدم' },
  { en: 'HbA1c results', ckb: 'ئەنجامی HbA1c', ar: 'نتائج HbA1c' },
  { en: 'Chest pain on exertion', ckb: 'ئازاری سنگ لە کاتی ماندووبوون', ar: 'ألم صدري عند الجهد' },
  { en: 'Post-operative wound check', ckb: 'پشکنینی برین دوای نەشتەرگەری', ar: 'فحص الجرح بعد العملية' },
  { en: 'Fever and cough, 3 days', ckb: 'تا و کۆکە، 3 ڕۆژ', ar: 'حمى وسعال منذ 3 أيام' },
  { en: 'Antenatal visit, 28 weeks', ckb: 'سەردانی پێش منداڵبوون، 28 هەفتە', ar: 'زيارة ما قبل الولادة، 28 أسبوعاً' },
  { en: 'Knee pain after fall', ckb: 'ئازاری ئەژنۆ دوای کەوتن', ar: 'ألم الركبة بعد السقوط' },
  { en: 'Recurrent tonsillitis', ckb: 'هەوکردنی دووبارەی گەروو', ar: 'التهاب اللوزتين المتكرر' },
  { en: 'Thyroid function follow-up', ckb: 'بەدواداچوونی کاری ڕژێنی دەرەقی', ar: 'متابعة وظائف الغدة الدرقية' },
  { en: 'Palpitations', ckb: 'لێدانی خێرای دڵ', ar: 'خفقان' },
  { en: 'Abdominal pain, right upper quadrant', ckb: 'ئازاری سک، لای ڕاستی سەرەوە', ar: 'ألم في الربع العلوي الأيمن من البطن' },
  { en: 'Child growth check and vaccines', ckb: 'پشکنینی گەشە و ڤاکسین', ar: 'فحص النمو واللقاحات' },
  { en: 'Lower back pain', ckb: 'ئازاری پشتی خوارەوە', ar: 'ألم أسفل الظهر' },
  { en: 'Hearing loss, left ear', ckb: 'کەمبوونەوەی بیستن، گوێی چەپ', ar: 'ضعف السمع في الأذن اليسرى' },
];

const CHANNELS: readonly BookingChannel[] = ['reception', 'phone', 'referral', 'online', 'phone'];

function reasonFor(clinicId: string, seed: number): Text3 {
  const byClinic: Readonly<Record<string, readonly number[]>> = {
    'clinic-im': [0, 4, 10],
    'clinic-endo': [1, 8],
    'clinic-cardio': [2, 9, 0],
    'clinic-surg': [3, 10],
    'clinic-paeds': [11, 4],
    'clinic-obgyn': [5],
    'clinic-ortho': [6, 12],
    'clinic-ent': [7, 13],
  };
  const options = byClinic[clinicId] ?? [0];
  return REASONS[options[seed % options.length] ?? 0] ?? REASONS[0]!;
}

function patientFor(clinicId: string, seed: number): Patient {
  const age = clinicId === 'clinic-paeds' ? 1 + (seed % 12) : 22 + ((seed * 11) % 55);
  const sex = clinicId === 'clinic-obgyn' ? 'female' : seed % 2 === 0 ? 'male' : 'female';
  return extPatient(seed, { sex, age: clinicId === 'clinic-obgyn' ? 21 + (seed % 18) : age });
}

/** A stable pseudo-random step, so the generated week looks the same at every demo. */
function hash(a: number, b: number): number {
  return Math.abs((a * 73_856_093) ^ (b * 19_349_663)) % 1000;
}

function build(): readonly ApptRow[] {
  const rows: ApptRow[] = [];
  // 1. Today's shared bookings.
  for (const appt of APPOINTMENTS) {
    const patient = getPatient(appt.patientId);
    rows.push({
      id: appt.id,
      patient,
      clinicId: appt.clinicId,
      date: DEMO_TODAY,
      time: appt.startIso.slice(11, 16),
      durationMin: appt.durationMin,
      status: appt.status,
      visitType: appt.visitType,
      reason: appt.reason,
      token: appt.queueNumber,
      arrivedAt: appt.arrivedIso === null ? null : appt.arrivedIso.slice(11, 16),
      channel: 'reception',
      payerId: patient.payerId,
      priorNoShows: appt.status === 'no-show' ? 2 : 0,
    });
  }
  const taken = new Set(rows.map((row) => `${row.clinicId}|${row.date}|${row.time}`));
  // 2. Generated bookings for the whole week.
  let seed = 1;
  WEEK_DAYS.forEach((date, dayIndex) => {
    const weekday = weekdayOf(date);
    for (const clinic of APPT_CLINICS) {
      if (!clinic.days.includes(weekday)) {
        continue;
      }
      slotsOf(clinic).forEach((time, slotIndex) => {
        const h = hash(dayIndex * 31 + slotIndex, clinic.id.length * 7 + clinic.slotMin);
        const isToday = date === DEMO_TODAY;
        const fill = isToday ? 520 : date < DEMO_TODAY ? 640 : 380 - (dayIndex - 2) * 40;
        const key = `${clinic.id}|${date}|${time}`;
        if (h > fill || taken.has(key)) {
          return;
        }
        taken.add(key);
        seed += 1;
        const patient = seed % 9 === 0 ? (PATIENTS[(seed * 7) % PATIENTS.length] ?? patientFor(clinic.id, seed)) : patientFor(clinic.id, seed);
        const usable = clinic.id === 'clinic-paeds' ? patient.dob > '2012' : clinic.id === 'clinic-obgyn' ? patient.sex === 'female' : patient.dob < '2008';
        const who = usable ? patient : patientFor(clinic.id, seed);
        let status: AppointmentStatus = 'booked';
        let arrivedAt: string | null = null;
        const token: string | null = null;
        const past = date < DEMO_TODAY || (isToday && time < '09:10');
        if (past) {
          status = h % 11 === 0 ? 'no-show' : h % 17 === 0 ? 'cancelled' : 'completed';
        } else if (isToday && time <= '09:45') {
          status = time < '09:30' ? 'in-consultation' : 'arrived';
        } else if (h % 23 === 0) {
          status = 'cancelled';
        }
        if (isToday && (status === 'completed' || status === 'arrived' || status === 'in-consultation')) {
          const [hh = '09', mm = '00'] = time.split(':');
          const early = Math.max(0, Number(mm) - 12 - (h % 8));
          arrivedAt = `${hh}:${String(early).padStart(2, '0')}`;
        }
        // Only one person per clinic is in consultation at a time.
        if (status === 'in-consultation' && rows.some((row) => row.clinicId === clinic.id && row.date === date && row.status === 'in-consultation')) {
          status = 'completed';
        }
        rows.push({
          id: `SYN-APT-${String(100 + seed).padStart(4, '0')}`,
          patient: who,
          clinicId: clinic.id,
          date,
          time,
          durationMin: clinic.slotMin,
          status,
          visitType: h % 3 === 0 ? 'new' : 'follow-up',
          reason: reasonFor(clinic.id, h),
          token,
          arrivedAt,
          channel: CHANNELS[h % CHANNELS.length] ?? 'reception',
          payerId: who.payerId,
          priorNoShows: status === 'no-show' ? 1 + (h % 3) : h % 13 === 0 ? 1 : 0,
        });
      });
    }
  });
  // Tokens are issued at check-in, so number today's in order of arrival per clinic.
  const issued = new Map<string, number>();
  const tokenOf = new Map<string, string>();
  for (const row of rows.filter((r) => r.date === DEMO_TODAY && r.arrivedAt !== null).toSorted((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''))) {
    const next = (issued.get(row.clinicId) ?? 0) + 1;
    issued.set(row.clinicId, next);
    tokenOf.set(row.id, `${apptClinic(row.clinicId).tokenPrefix}-${String(next).padStart(2, '0')}`);
  }
  return rows
    .map((row) => (tokenOf.has(row.id) ? { ...row, token: tokenOf.get(row.id) ?? row.token } : row))
    .toSorted((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** The next token number a clinic would issue today. */
export function nextTokenNumber(clinicId: string, rows: readonly ApptRow[]): string {
  const used = rows.filter((row) => row.clinicId === clinicId && row.date === DEMO_TODAY && row.token !== null).length;
  return `${apptClinic(clinicId).tokenPrefix}-${String(used + 1).padStart(2, '0')}`;
}

export const APPT_ROWS: readonly ApptRow[] = build();

export type NoShowFollowUp = 'not-contacted' | 'sms-sent' | 'called' | 'rebooked';

export interface NoShowRecord {
  readonly id: string;
  readonly patient: Patient;
  readonly clinicId: string;
  readonly date: string;
  readonly time: string;
  readonly priorNoShows: number;
  readonly followUp: NoShowFollowUp;
}

/** The no-show register: the last four weeks (this week's from the bookings, earlier ones generated). */
function buildNoShows(): readonly NoShowRecord[] {
  const fromWeek: NoShowRecord[] = APPT_ROWS.filter((row) => row.status === 'no-show').map((row, index) => ({
    id: `NS-${row.id}`,
    patient: row.patient,
    clinicId: row.clinicId,
    date: row.date,
    time: row.time,
    priorNoShows: row.priorNoShows,
    followUp: row.date === DEMO_TODAY ? 'not-contacted' : index % 3 === 0 ? 'rebooked' : index % 3 === 1 ? 'sms-sent' : 'called',
  }));
  const earlier: NoShowRecord[] = [];
  for (let i = 0; i < 9; i += 1) {
    const clinic = APPT_CLINICS[(i * 3) % APPT_CLINICS.length] ?? APPT_CLINICS[0]!;
    const slots = slotsOf(clinic);
    earlier.push({
      id: `NS-OLD-${String(i)}`,
      patient: patientFor(clinic.id, 300 + i),
      clinicId: clinic.id,
      date: demoDate(4 + i * 3),
      time: slots[(i * 5) % slots.length] ?? clinic.start,
      priorNoShows: i % 4,
      followUp: i % 4 === 0 ? 'not-contacted' : i % 4 === 1 ? 'sms-sent' : i % 4 === 2 ? 'rebooked' : 'called',
    });
  }
  return [...fromWeek, ...earlier].toSorted((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export const NO_SHOWS: readonly NoShowRecord[] = buildNoShows();

export const CHANNEL_LABEL: Readonly<Record<BookingChannel, Text3>> = {
  reception: { en: 'Reception desk', ckb: 'پێشوازی', ar: 'الاستقبال' },
  phone: { en: 'Phone', ckb: 'تەلەفۆن', ar: 'الهاتف' },
  referral: { en: 'Referral', ckb: 'ڕەوانەکردن', ar: 'إحالة' },
  online: { en: 'Online / app', ckb: 'ئۆنلاین / ئەپ', ar: 'عبر الإنترنت / التطبيق' },
};

export const FOLLOW_UP_LABEL: Readonly<Record<NoShowFollowUp, Text3>> = {
  'not-contacted': { en: 'Not contacted', ckb: 'پەیوەندی نەکراوە', ar: 'لم يتم التواصل' },
  'sms-sent': { en: 'SMS sent', ckb: 'نامە نێردرا', ar: 'أُرسلت رسالة' },
  called: { en: 'Called', ckb: 'پەیوەندی کرا', ar: 'تم الاتصال' },
  rebooked: { en: 'Rebooked', ckb: 'دووبارە نۆرە گیرا', ar: 'أُعيد الحجز' },
};
