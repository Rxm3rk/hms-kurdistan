/**
 * Beds of the four wards and their states on the demo morning. SYNTHETIC DATA ONLY.
 *
 * Medical Ward A 20 beds, Surgical Ward B 16, Paediatrics 12, ICU 8: 42 occupied, the rest available,
 * cleaning, blocked or reserved. Curated patients sit in fixed beds (A-04, A-07, A-11, A-20, B-03, B-07, B-12,
 * P-02, P-05, ICU-03); the census fills the other occupied beds.
 */
import { daysAgoAt, todayAt } from './clock.ts';
import { WARDS } from './organisation.ts';
import { CENSUS_GROUPS } from './patients.ts';
import type { Bed, BedState, Text3, Ward, WardId } from './types.ts';

interface BedPlan {
  readonly state: BedState;
  readonly patientId?: string;
  readonly note?: Text3;
  readonly sinceIso?: string;
  readonly isolationRoom?: boolean;
}

const FIXED: Readonly<Record<string, BedPlan>> = {
  // Medical Ward A
  'A-04': { state: 'occupied', patientId: 'SYN-PAT-0101', sinceIso: daysAgoAt(2, '12:40') },
  'A-07': { state: 'occupied', patientId: 'SYN-PAT-0112', sinceIso: daysAgoAt(1, '22:15') },
  'A-08': { state: 'available', sinceIso: todayAt('07:50') },
  'A-11': { state: 'occupied', patientId: 'SYN-PAT-0102', sinceIso: daysAgoAt(4, '15:05') },
  'A-13': {
    state: 'cleaning',
    sinceIso: todayAt('09:05'),
    note: { en: 'Discharge clean, ready about 10:00', ckb: 'پاککردنەوەی دوای دەرچوون، نزیکەی 10:00 ئامادە دەبێت', ar: 'تنظيف بعد الخروج، جاهز نحو 10:00' },
  },
  'A-16': { state: 'available', sinceIso: daysAgoAt(1, '18:30') },
  'A-18': {
    state: 'blocked',
    sinceIso: daysAgoAt(3, '11:00'),
    note: { en: 'Oxygen outlet under repair', ckb: 'خاڵی ئۆکسجین لە چاککردنەوەدایە', ar: 'مخرج الأكسجين قيد الإصلاح' },
  },
  'A-19': {
    state: 'reserved',
    sinceIso: todayAt('08:55'),
    note: { en: 'Admission from Emergency, expected 10:30', ckb: 'خەواندن لە فریاکەوتنەوە، چاوەڕوانی 10:30', ar: 'إدخال من الطوارئ، متوقع 10:30' },
  },
  'A-20': { state: 'occupied', patientId: 'SYN-PAT-0105', sinceIso: daysAgoAt(1, '17:10'), isolationRoom: true },
  // Surgical Ward B
  'B-03': { state: 'occupied', patientId: 'SYN-PAT-0106', sinceIso: daysAgoAt(1, '13:20') },
  'B-07': { state: 'occupied', patientId: 'SYN-PAT-0107', sinceIso: daysAgoAt(3, '16:45') },
  'B-08': { state: 'available', sinceIso: todayAt('06:30') },
  'B-11': {
    state: 'cleaning',
    sinceIso: todayAt('09:20'),
    note: { en: 'Terminal clean after discharge', ckb: 'پاککردنەوەی تەواو دوای دەرچوون', ar: 'تنظيف نهائي بعد الخروج' },
  },
  'B-12': { state: 'occupied', patientId: 'SYN-PAT-0110', sinceIso: todayAt('03:10') },
  'B-14': { state: 'available', sinceIso: daysAgoAt(1, '15:00') },
  'B-16': {
    state: 'reserved',
    sinceIso: todayAt('08:00'),
    note: { en: 'Post-operative patient from theatre 2', ckb: 'نەخۆشی دوای نەشتەرگەری لە هۆڵی 2', ar: 'مريض بعد العملية من الصالة 2' },
  },
  // Paediatrics
  'P-02': { state: 'occupied', patientId: 'SYN-PAT-0103', sinceIso: daysAgoAt(1, '14:40') },
  'P-05': { state: 'occupied', patientId: 'SYN-PAT-0104', sinceIso: daysAgoAt(1, '21:30') },
  'P-06': { state: 'available', sinceIso: daysAgoAt(2, '10:00') },
  'P-09': { state: 'available', sinceIso: daysAgoAt(1, '12:00') },
  'P-11': { state: 'available', sinceIso: todayAt('08:10') },
  'P-12': {
    state: 'cleaning',
    sinceIso: todayAt('09:15'),
    note: { en: 'Routine clean', ckb: 'پاککردنەوەی ئاسایی', ar: 'تنظيف روتيني' },
  },
  // ICU
  'ICU-03': { state: 'occupied', patientId: 'SYN-PAT-0109', sinceIso: daysAgoAt(2, '03:45') },
  'ICU-08': {
    state: 'reserved',
    sinceIso: todayAt('09:00'),
    note: { en: 'Elective post-operative bed, theatre 1', ckb: 'جێگەی دوای نەشتەرگەریی پلاندانراو، هۆڵی 1', ar: 'سرير بعد عملية مجدولة، الصالة 1' },
  },
};

function bedLabel(ward: Ward, n: number): string {
  return `${ward.code}-${String(n).padStart(2, '0')}`;
}

function buildBeds(): readonly Bed[] {
  const beds: Bed[] = [];
  for (const ward of WARDS) {
    const census = [...CENSUS_GROUPS[ward.id]];
    for (let n = 1; n <= ward.bedCount; n += 1) {
      const id = bedLabel(ward, n);
      const fixed = FIXED[id];
      if (fixed !== undefined) {
        beds.push({
          id,
          wardId: ward.id,
          state: fixed.state,
          patientId: fixed.patientId ?? null,
          note: fixed.note ?? null,
          sinceIso: fixed.sinceIso ?? todayAt('07:00'),
          isolationRoom: fixed.isolationRoom ?? false,
        });
        continue;
      }
      const patientId = census.shift();
      if (patientId === undefined) {
        throw new Error(`No census patient left for bed ${id}`);
      }
      beds.push({
        id,
        wardId: ward.id,
        state: 'occupied',
        patientId,
        note: null,
        sinceIso: daysAgoAt(1 + ((n * 3) % 8), `${String(8 + (n % 12)).padStart(2, '0')}:${n % 2 === 0 ? '15' : '40'}`),
        isolationRoom: false,
      });
    }
    if (census.length > 0) {
      throw new Error(`Census patients without a bed in ${ward.id}`);
    }
  }
  return beds;
}

/** Every bed of every ward, in ward and bed order. */
export const BEDS: readonly Bed[] = buildBeds();

/** The ward with this id; throws for an unknown id. */
export function getWard(wardId: WardId): Ward {
  const ward = WARDS.find((candidate) => candidate.id === wardId);
  if (ward === undefined) {
    throw new Error(`Unknown ward ${wardId}`);
  }
  return ward;
}

/** The beds of one ward. */
export function bedsOfWard(wardId: WardId): readonly Bed[] {
  return BEDS.filter((bed) => bed.wardId === wardId);
}

/** The bed a patient occupies, if any. */
export function bedOfPatient(patientId: string): Bed | undefined {
  return BEDS.find((bed) => bed.patientId === patientId);
}

/** Bed counts by state for one ward, or for the hospital when `wardId` is omitted. */
export function bedCounts(wardId?: WardId): Readonly<Record<BedState, number>> & { readonly total: number } {
  const counts: Record<BedState, number> = { available: 0, occupied: 0, cleaning: 0, blocked: 0, reserved: 0 };
  let total = 0;
  for (const bed of BEDS) {
    if (wardId === undefined || bed.wardId === wardId) {
      counts[bed.state] += 1;
      total += 1;
    }
  }
  return { ...counts, total };
}

/** Occupied beds as a fraction (0 to 1) of the beds that are not blocked. */
export function occupancy(wardId?: WardId): number {
  const counts = bedCounts(wardId);
  const usable = counts.total - counts.blocked;
  return usable === 0 ? 0 : counts.occupied / usable;
}
