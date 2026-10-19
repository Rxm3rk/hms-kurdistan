/**
 * Reference lists for the registration form: districts per governorate, emergency-contact relations and the
 * allergens a registration clerk can record. SYNTHETIC SAMPLE LISTS for the prototype (not a governed
 * vocabulary). ckb and ar forms are AI drafts, unreviewed.
 */
import type { Allergy, Governorate, Text3 } from '../../data/index.ts';

export interface District {
  readonly id: string;
  readonly name: Text3;
}

/** The main districts (qeza) of each governorate of the Kurdistan Region; the centre first. */
export const DISTRICTS: Readonly<Record<Governorate, readonly District[]>> = {
  erbil: [
    { id: 'erbil-centre', name: { en: 'Erbil (centre)', ckb: 'هەولێر (ناوەند)', ar: 'أربيل (المركز)' } },
    { id: 'shaqlawa', name: { en: 'Shaqlawa', ckb: 'شەقڵاوە', ar: 'شقلاوة' } },
    { id: 'koya', name: { en: 'Koya', ckb: 'کۆیە', ar: 'كويه' } },
    { id: 'soran', name: { en: 'Soran', ckb: 'سۆران', ar: 'سوران' } },
    { id: 'choman', name: { en: 'Choman', ckb: 'چۆمان', ar: 'جومان' } },
    { id: 'mergasur', name: { en: 'Mergasur', ckb: 'مێرگەسۆر', ar: 'ميركسور' } },
    { id: 'khabat', name: { en: 'Khabat', ckb: 'خەبات', ar: 'خبات' } },
  ],
  sulaymaniyah: [
    { id: 'sulaymaniyah-centre', name: { en: 'Sulaymaniyah (centre)', ckb: 'سلێمانی (ناوەند)', ar: 'السليمانية (المركز)' } },
    { id: 'ranya', name: { en: 'Ranya', ckb: 'ڕانیە', ar: 'رانية' } },
    { id: 'chamchamal', name: { en: 'Chamchamal', ckb: 'چەمچەماڵ', ar: 'جمجمال' } },
    { id: 'dukan', name: { en: 'Dukan', ckb: 'دوکان', ar: 'دوكان' } },
    { id: 'penjwen', name: { en: 'Penjwen', ckb: 'پێنجوێن', ar: 'بنجوين' } },
    { id: 'pshdar', name: { en: 'Pshdar', ckb: 'پشدەر', ar: 'بشدر' } },
    { id: 'darbandikhan', name: { en: 'Darbandikhan', ckb: 'دەربەندیخان', ar: 'دربندخان' } },
    { id: 'kalar', name: { en: 'Kalar', ckb: 'کەلار', ar: 'كلار' } },
  ],
  duhok: [
    { id: 'duhok-centre', name: { en: 'Duhok (centre)', ckb: 'دهۆک (ناوەند)', ar: 'دهوك (المركز)' } },
    { id: 'zakho', name: { en: 'Zakho', ckb: 'زاخۆ', ar: 'زاخو' } },
    { id: 'amedi', name: { en: 'Amedi', ckb: 'ئامێدی', ar: 'العمادية' } },
    { id: 'akre', name: { en: 'Akre', ckb: 'ئاکرێ', ar: 'عقرة' } },
    { id: 'semel', name: { en: 'Semel', ckb: 'سێمێل', ar: 'سميل' } },
    { id: 'shekhan', name: { en: 'Shekhan', ckb: 'شێخان', ar: 'الشيخان' } },
  ],
  halabja: [
    { id: 'halabja-centre', name: { en: 'Halabja (centre)', ckb: 'هەڵەبجە (ناوەند)', ar: 'حلبجة (المركز)' } },
    { id: 'khurmal', name: { en: 'Khurmal', ckb: 'خورماڵ', ar: 'خورمال' } },
    { id: 'byara', name: { en: 'Byara', ckb: 'بیارە', ar: 'بيارة' } },
    { id: 'sirwan', name: { en: 'Sirwan', ckb: 'سیروان', ar: 'سيروان' } },
  ],
};

export const GOVERNORATES: readonly Governorate[] = ['erbil', 'sulaymaniyah', 'duhok', 'halabja'];

export function findDistrict(governorate: Governorate, districtId: string | null): District | undefined {
  return districtId === null ? undefined : DISTRICTS[governorate].find((district) => district.id === districtId);
}

export interface Relation {
  readonly id: string;
  readonly label: Text3;
}

export const RELATIONS: readonly Relation[] = [
  { id: 'spouse', label: { en: 'Spouse', ckb: 'هاوسەر', ar: 'الزوج أو الزوجة' } },
  { id: 'mother', label: { en: 'Mother', ckb: 'دایک', ar: 'الأم' } },
  { id: 'father', label: { en: 'Father', ckb: 'باوک', ar: 'الأب' } },
  { id: 'son', label: { en: 'Son', ckb: 'کوڕ', ar: 'الابن' } },
  { id: 'daughter', label: { en: 'Daughter', ckb: 'کچ', ar: 'الابنة' } },
  { id: 'brother', label: { en: 'Brother', ckb: 'برا', ar: 'الأخ' } },
  { id: 'sister', label: { en: 'Sister', ckb: 'خوشک', ar: 'الأخت' } },
  { id: 'other', label: { en: 'Other relative', ckb: 'خزمێکی تر', ar: 'قريب آخر' } },
];

/** Allergens a registration clerk may record (same synthetic codes as the shared data). */
export const REGISTRATION_ALLERGENS: readonly Allergy[] = [
  { code: 'SYN-ALG-PENICILLIN', substance: { en: 'Penicillin', ckb: 'پێنیسیلین', ar: 'البنسلين' } },
  { code: 'SYN-ALG-LATEX', substance: { en: 'Latex', ckb: 'لاتێکس', ar: 'اللاتكس' } },
  { code: 'SYN-ALG-CODEINE', substance: { en: 'Codeine', ckb: 'کۆدین', ar: 'الكودايين' } },
  { code: 'SYN-ALG-IBUPROFEN', substance: { en: 'Ibuprofen', ckb: 'ئایبوپرۆفین', ar: 'إيبوبروفين' } },
  {
    code: 'SYN-ALG-CONTRAST',
    substance: { en: 'Iodinated contrast media', ckb: 'ماددەی کۆنتراستی یۆددار', ar: 'وسائط التباين المحتوية على اليود' },
  },
];

/** The allergy band on the wristband: printed in all three languages at once. */
export const ALLERGY_BAND: Text3 = { en: 'ALLERGY', ckb: 'هەستیاری', ar: 'حساسية' };

/** The alert a new record gets when a similar name is already on file (same text as the synthetic look-alikes). */
export const LOOK_ALIKE_ALERT: Text3 = {
  en: "Look-alike name on file: check the grandfather's name and the MRN",
  ckb: 'ناوێکی لێکچوو لە تۆماردایە: ناوی باپیر و MRN بپشکنە',
  ar: 'يوجد اسم مشابه في السجلات: تحقق من اسم الجد ورقم السجل',
};
