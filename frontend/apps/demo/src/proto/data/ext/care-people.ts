/**
 * Extra synthetic people for the extension screens (appointments, emergency, theatre, maternity…): walk-in
 * and booked patients who are not in the shared census. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * They are full `Patient` records, so the UI kit's PatientInline shows them with two identifiers, but they
 * are not in the shared patient directory: only shared patients (`isKnownPatient`) open in the chart.
 * Ids run from SYN-PAT-0600 upwards so they never clash with the shared census.
 */
import type { Governorate, Patient, PersonName, Sex, Text3 } from '../types.ts';

const MALE: readonly PersonName[] = [
  { ckb: 'ئازاد', ar: 'آزاد', latin: 'Azad' },
  { ckb: 'هەڤاڵ', ar: 'هفال', latin: 'Haval' },
  { ckb: 'سەرهەنگ', ar: 'سرهنك', latin: 'Sarhang' },
  { ckb: 'دیار', ar: 'ديار', latin: 'Diyar' },
  { ckb: 'ڕێکەوت', ar: 'ريكوت', latin: 'Rekawt' },
  { ckb: 'بەختیار', ar: 'بختيار', latin: 'Bakhtiyar' },
  { ckb: 'عەلی', ar: 'علي', latin: 'Ali' },
  { ckb: 'یوسف', ar: 'يوسف', latin: 'Yousif' },
  { ckb: 'کامەران', ar: 'كامران', latin: 'Kamaran' },
  { ckb: 'زانیار', ar: 'زانيار', latin: 'Zanyar' },
  { ckb: 'عومەر', ar: 'عمر', latin: 'Omar' },
  { ckb: 'شێرزاد', ar: 'شيرزاد', latin: 'Sherzad' },
  { ckb: 'حەیدەر', ar: 'حيدر', latin: 'Haider' },
  { ckb: 'مەهدی', ar: 'مهدي', latin: 'Mahdi' },
];

const FEMALE: readonly PersonName[] = [
  { ckb: 'ڕۆژان', ar: 'روجان', latin: 'Rojan' },
  { ckb: 'شیرین', ar: 'شيرين', latin: 'Shirin' },
  { ckb: 'هێرۆ', ar: 'هيرو', latin: 'Hero' },
  { ckb: 'ژیان', ar: 'ژيان', latin: 'Zhyan' },
  { ckb: 'سۆما', ar: 'سوما', latin: 'Soma' },
  { ckb: 'نیگار', ar: 'نيكار', latin: 'Nigar' },
  { ckb: 'پەیمان', ar: 'بيمان', latin: 'Payman' },
  { ckb: 'تارا', ar: 'تارا', latin: 'Tara' },
  { ckb: 'دەریا', ar: 'دريا', latin: 'Darya' },
  { ckb: 'ڤیان', ar: 'فيان', latin: 'Vian' },
  { ckb: 'زەینەب', ar: 'زينب', latin: 'Zainab' },
  { ckb: 'فاتیمە', ar: 'فاطمة', latin: 'Fatima' },
  { ckb: 'مەریەم', ar: 'مريم', latin: 'Maryam' },
  { ckb: 'هاوژین', ar: 'هاوژين', latin: 'Hawzhin' },
];

const FAMILY: readonly PersonName[] = [
  { ckb: 'ئەحمەد', ar: 'أحمد', latin: 'Ahmed' },
  { ckb: 'مەحموود', ar: 'محمود', latin: 'Mahmood' },
  { ckb: 'کەریم', ar: 'كريم', latin: 'Karim' },
  { ckb: 'ڕەشید', ar: 'رشيد', latin: 'Rashid' },
  { ckb: 'سەعید', ar: 'سعيد', latin: 'Saeed' },
  { ckb: 'ئیبراهیم', ar: 'إبراهيم', latin: 'Ibrahim' },
  { ckb: 'حوسێن', ar: 'حسين', latin: 'Hussein' },
  { ckb: 'جەلال', ar: 'جلال', latin: 'Jalal' },
  { ckb: 'نەجمەدین', ar: 'نجم الدين', latin: 'Najmaddin' },
  { ckb: 'سدیق', ar: 'صديق', latin: 'Sadiq' },
  { ckb: 'تۆفیق', ar: 'توفيق', latin: 'Tofiq' },
  { ckb: 'عەبدولڕەحمان', ar: 'عبد الرحمن', latin: 'Abdulrahman' },
  { ckb: 'قادر', ar: 'قادر', latin: 'Qadir' },
  { ckb: 'خالید', ar: 'خالد', latin: 'Khalid' },
  { ckb: 'فەرهاد', ar: 'فرهاد', latin: 'Farhad' },
  { ckb: 'شەریف', ar: 'شريف', latin: 'Sharif' },
];

/** Arabic-script given names for patients from Mosul, Kirkuk or the south (`ownScript: 'ar'`). */
const ARAB_MALE = new Set(['Ali', 'Haider', 'Mahdi', 'Yousif', 'Omar']);
const ARAB_FEMALE = new Set(['Zainab', 'Fatima', 'Maryam']);

export const EXT_CITY = {
  erbil: { en: 'Erbil', ckb: 'هەولێر', ar: 'أربيل' },
  sulaymaniyah: { en: 'Sulaymaniyah', ckb: 'سلێمانی', ar: 'السليمانية' },
  duhok: { en: 'Duhok', ckb: 'دهۆک', ar: 'دهوك' },
  koya: { en: 'Koya', ckb: 'کۆیە', ar: 'كويه' },
  soran: { en: 'Soran', ckb: 'سۆران', ar: 'سوران' },
  zakho: { en: 'Zakho', ckb: 'زاخۆ', ar: 'زاخو' },
  ranya: { en: 'Ranya', ckb: 'ڕانیە', ar: 'رانية' },
  mosul: { en: 'Mosul (Nineveh)', ckb: 'مووسڵ (نەینەوا)', ar: 'الموصل (نينوى)' },
} as const satisfies Record<string, Text3>;

type CityKey = keyof typeof EXT_CITY;
const CITY_GOV: Readonly<Record<CityKey, Governorate>> = {
  erbil: 'erbil',
  sulaymaniyah: 'sulaymaniyah',
  duhok: 'duhok',
  koya: 'erbil',
  soran: 'erbil',
  zakho: 'duhok',
  ranya: 'sulaymaniyah',
  mosul: 'erbil',
};
const CITY_KEYS = Object.keys(EXT_CITY) as CityKey[];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export interface ExtPersonSpec {
  readonly sex: Sex;
  /** Age in whole years at the demo day (0 for a newborn; then `dob` must be given). */
  readonly age: number;
  /** An explicit date of birth (newborns), `YYYY-MM-DD`. */
  readonly dob?: string;
  /** An explicit name, otherwise drawn from the pools by `seed`. */
  readonly name?: PersonName;
  readonly city?: CityKey;
  readonly payerId?: Patient['payerId'];
  /** Unknown identity (unconscious ED arrival): age estimated, year-only date of birth. */
  readonly unknown?: boolean;
}

/** A synthetic patient not in the shared census. `n` makes the id (SYN-PAT-0600 + n) and seeds the name. */
export function extPatient(n: number, spec: ExtPersonSpec): Patient {
  const number = 600 + n;
  const pool = spec.sex === 'male' ? MALE : FEMALE;
  const given = pool[(n * 5 + 3) % pool.length] ?? pool[0]!;
  const father = FAMILY[(n * 7 + 2) % FAMILY.length] ?? FAMILY[0]!;
  let grand = FAMILY[(n * 3 + 9) % FAMILY.length] ?? FAMILY[1]!;
  if (grand.latin === father.latin) {
    grand = FAMILY[(n * 3 + 10) % FAMILY.length] ?? FAMILY[2]!;
  }
  const generated: PersonName = {
    ckb: `${given.ckb} ${father.ckb} ${grand.ckb}`,
    ar: `${given.ar} ${father.ar} ${grand.ar}`,
    latin: `${given.latin} ${father.latin} ${grand.latin}`,
  };
  const name = spec.name ?? generated;
  const arab = spec.sex === 'male' ? ARAB_MALE.has(given.latin) : ARAB_FEMALE.has(given.latin);
  const cityKey = spec.city ?? (arab ? 'mosul' : CITY_KEYS[n % 7] ?? 'erbil');
  const month = ((n * 5) % 9) + 1;
  const day = ((n * 7) % 27) + 1;
  const dob = spec.dob ?? (spec.unknown === true ? String(2026 - spec.age) : `${String(2026 - spec.age)}-${pad(month, 2)}-${pad(day, 2)}`);
  const digits = pad(number, 4);
  return {
    id: `SYN-PAT-${digits}`,
    mrn: `SYN-10${digits}-${String(number % 10)}`,
    name: { ...name, ownScript: arab && spec.name === undefined ? 'ar' : 'ckb' },
    sex: spec.sex,
    dob,
    dobPrecision: spec.unknown === true ? 'year' : 'day',
    dobApproximate: spec.unknown === true,
    phone: `+964 750 000 ${digits}`,
    governorate: CITY_GOV[cityKey],
    city: EXT_CITY[cityKey],
    nationalId: `SYN-NID-${String(199_500_000 + number * 7919).slice(0, 9)}`,
    bloodGroup: null,
    payerId: spec.payerId ?? (n % 4 === 0 ? 'self-pay' : n % 3 === 0 ? 'syn-insurance' : 'government'),
    preferredLanguage: arab ? 'ar' : 'ckb',
    allergies: n % 6 === 2 ? { kind: 'not-assessed' } : { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: null,
    heightCm: null,
    alerts: [],
    hasPhoto: false,
    emergencyContact: null,
    curated: false,
    registeredOn: '2026-10-19',
  };
}

/** The unknown-identity placeholder name used for an unconscious arrival. */
export function unknownName(serial: string): PersonName {
  return { ckb: `نەناسراو ${serial}`, ar: `مجهول ${serial}`, latin: `Unknown ${serial}` };
}
