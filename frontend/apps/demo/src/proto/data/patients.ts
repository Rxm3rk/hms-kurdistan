/**
 * The prototype's synthetic patients. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE: every name, MRN, date,
 * phone number and identity number is invented. Phone numbers use the obviously fake +964 750 000 xxxx block.
 *
 * - 14 hand-written ("curated") patients with rich clinical data, several taken from the WP-0.7 banner
 *   fixtures (src/demo/fixtures.ts): the long Sorani name and its look-alike that differs only in the
 *   grandfather's name, the Arabic-script and the Latin-script patient, the year-only date of birth, the long
 *   allergy list, active isolation and a documented code status.
 * - 40 generated census patients with plain records, so the wards look full and the clinics busy.
 *
 * `bannerDataOf(patient)` turns a patient into the untrusted banner input that ui-core's parseBannerData
 * reads; the window's patient directory (src/proto/shell/proto-module.ts) serves it to the real
 * PatientBanner.
 */
import syntheticPhoto from '../../demo/synthetic-photo.png';
import { ISOLATION_LABEL, SEVERITY_LABEL } from './labels.ts';
import { findSessionPatient } from './session-patients.ts';
import type {
  Allergy,
  BloodGroup,
  Governorate,
  Patient,
  PatientName,
  PersonName,
  Sex,
  Text3,
} from './types.ts';

// ---------------------------------------------------------------------------------------------------------
// Allergens and reactions (synthetic codes)
// ---------------------------------------------------------------------------------------------------------

const RX = {
  anaphylaxis: { en: 'Anaphylaxis', ckb: 'ئەنافیلاکسی (شۆکی هەستیاری)', ar: 'صدمة تحسسية' },
  rash: { en: 'Rash', ckb: 'پەڵەی پێست', ar: 'طفح جلدي' },
  urticaria: { en: 'Hives', ckb: 'کوانەی پێست', ar: 'شرى' },
  vomiting: { en: 'Vomiting', ckb: 'ڕشانەوە', ar: 'تقيؤ' },
} as const satisfies Record<string, Text3>;

const ALG = {
  penicillin: { code: 'SYN-ALG-PENICILLIN', substance: { en: 'Penicillin', ckb: 'پێنیسیلین', ar: 'البنسلين' } },
  latex: { code: 'SYN-ALG-LATEX', substance: { en: 'Latex', ckb: 'لاتێکس', ar: 'اللاتكس' } },
  codeine: { code: 'SYN-ALG-CODEINE', substance: { en: 'Codeine', ckb: 'کۆدین', ar: 'الكودايين' } },
  coAmoxiclav: {
    code: 'SYN-ALG-AMOXICILLIN-CLAVULANATE',
    substance: {
      en: 'Amoxicillin and clavulanic acid',
      ckb: 'ئەمۆکسیسیلین و ئەسیدی کلاڤیولانیک',
      ar: 'أموكسيسيلين وحمض الكلافولانيك',
    },
  },
  coTrimoxazole: {
    code: 'SYN-ALG-SULFAMETHOXAZOLE-TRIMETHOPRIM',
    substance: {
      en: 'Sulfamethoxazole and trimethoprim',
      ckb: 'سەلفامێتۆکسازۆڵ و تریمێتۆپریم',
      ar: 'سلفاميثوكسازول وتريميثوبريم',
    },
  },
  contrast: {
    code: 'SYN-ALG-CONTRAST',
    substance: { en: 'Iodinated contrast media', ckb: 'ماددەی کۆنتراستی یۆددار', ar: 'وسائط التباين المحتوية على اليود' },
  },
  ibuprofen: { code: 'SYN-ALG-IBUPROFEN', substance: { en: 'Ibuprofen', ckb: 'ئایبوپرۆفین', ar: 'إيبوبروفين' } },
} as const satisfies Record<string, Allergy>;

const CITY = {
  erbil: { en: 'Erbil', ckb: 'هەولێر', ar: 'أربيل' },
  ankawa: { en: 'Ankawa, Erbil', ckb: 'عەنکاوە، هەولێر', ar: 'عنكاوا، أربيل' },
  koya: { en: 'Koya', ckb: 'کۆیە', ar: 'كويه' },
  shaqlawa: { en: 'Shaqlawa', ckb: 'شەقڵاوە', ar: 'شقلاوة' },
  soran: { en: 'Soran', ckb: 'سۆران', ar: 'سوران' },
  sulaymaniyah: { en: 'Sulaymaniyah', ckb: 'سلێمانی', ar: 'السليمانية' },
  ranya: { en: 'Ranya', ckb: 'ڕانیە', ar: 'رانية' },
  tawella: { en: 'Tawella', ckb: 'تەوێڵە', ar: 'طويلة' },
  chamchamal: { en: 'Chamchamal', ckb: 'چەمچەماڵ', ar: 'جمجمال' },
  duhok: { en: 'Duhok', ckb: 'دهۆک', ar: 'دهوك' },
  zakho: { en: 'Zakho', ckb: 'زاخۆ', ar: 'زاخو' },
  akre: { en: 'Akre', ckb: 'ئاکرێ', ar: 'عقرة' },
  halabja: { en: 'Halabja', ckb: 'هەڵەبجە', ar: 'حلبجة' },
} as const satisfies Record<string, Text3>;

const RELATION = {
  wife: { en: 'Wife', ckb: 'هاوسەر', ar: 'الزوجة' },
  husband: { en: 'Husband', ckb: 'هاوسەر', ar: 'الزوج' },
  son: { en: 'Son', ckb: 'کوڕ', ar: 'الابن' },
  daughter: { en: 'Daughter', ckb: 'کچ', ar: 'الابنة' },
  mother: { en: 'Mother', ckb: 'دایک', ar: 'الأم' },
  father: { en: 'Father', ckb: 'باوک', ar: 'الأب' },
  brother: { en: 'Brother', ckb: 'برا', ar: 'الأخ' },
  colleague: { en: 'Colleague', ckb: 'هاوکار', ar: 'زميلة' },
} as const satisfies Record<string, Text3>;

const LOOK_ALIKE: Text3 = {
  en: "Look-alike name on file: check the grandfather's name and the MRN",
  ckb: 'ناوێکی لێکچوو لە تۆماردایە: ناوی باپیر و MRN بپشکنە',
  ar: 'يوجد اسم مشابه في السجلات: تحقق من اسم الجد ورقم السجل',
};

/** The "High fall risk" alert text (the curated patients' fall-risk assessment). */
export const FALL_RISK: Text3 = { en: 'High fall risk', ckb: 'مەترسیی بەرزی کەوتن', ar: 'خطر سقوط مرتفع' };

function phone(n: number): string {
  return `+964 750 000 ${String(n).padStart(4, '0')}`;
}

function base(number: number): Pick<Patient, 'id' | 'mrn' | 'phone' | 'nationalId'> {
  const digits = String(number).padStart(4, '0');
  return {
    id: `SYN-PAT-${digits}`,
    mrn: `SYN-10${digits}-${String(number % 10)}`,
    phone: phone(number),
    nationalId: `SYN-NID-${String(199_000_000 + number * 7919).slice(0, 9)}`,
  };
}

// ---------------------------------------------------------------------------------------------------------
// The 14 curated patients
// ---------------------------------------------------------------------------------------------------------

export const CURATED_PATIENTS: readonly Patient[] = [
  {
    ...base(101),
    name: { ckb: 'کاروان تاهیر بەکر', ar: 'كاروان طاهر بكر', latin: 'Karwan Tahir Bakr', ownScript: 'ckb' },
    sex: 'male',
    dob: '1971-05-12',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.erbil,
    bloodGroup: 'O+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'list', items: [{ ...ALG.penicillin, reaction: RX.anaphylaxis, severity: 'severe' }] },
    isolation: null,
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-17' },
    weight: { kg: '84.0', measuredOn: '2026-10-17', source: 'measured' },
    heightCm: '176',
    alerts: [
      {
        tone: 'warning',
        text: {
          en: 'Type 2 diabetes: insulin sliding scale',
          ckb: 'شەکرەی جۆری 2: ئەنسولین بەپێی خشتەی پێوانە',
          ar: 'سكري النوع الثاني: أنسولين حسب الجدول المتدرج',
        },
      },
    ],
    hasPhoto: true,
    emergencyContact: {
      name: { ckb: 'شنۆ ئەحمەد', ar: 'شنو أحمد', latin: 'Shno Ahmad' },
      relation: RELATION.wife,
      phone: phone(1101),
    },
    curated: true,
    registeredOn: '2019-02-11',
  },
  {
    ...base(102),
    name: { ckb: 'گوڵاڵە عوسمان ڕەشید', ar: 'كولاله عثمان رشيد', latin: 'Gulala Osman Rashid', ownScript: 'ckb' },
    sex: 'female',
    dob: '1938',
    dobPrecision: 'year',
    dobApproximate: true,
    governorate: 'halabja',
    city: CITY.halabja,
    bloodGroup: 'A+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'dnacpr', recordedOn: '2026-10-16' },
    weight: { kg: '58.2', measuredOn: '2026-10-19', source: 'measured' },
    heightCm: '152',
    alerts: [
      { tone: 'warning', text: FALL_RISK },
      {
        tone: 'info',
        text: {
          en: 'Hard of hearing: speak clearly, Sorani preferred',
          ckb: 'گوێی قورسە: بە ڕوونی قسە بکە، سۆرانی باشترە',
          ar: 'ضعيفة السمع: تحدث بوضوح، تفضّل السورانية',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'ئاراس ڕەشید', ar: 'آراس رشيد', latin: 'Aras Rashid' },
      relation: RELATION.son,
      phone: phone(1102),
    },
    curated: true,
    registeredOn: '2011-06-02',
  },
  {
    ...base(103),
    name: {
      ckb: 'کۆرپەی کچی شنیار عەبدولڕەحمان عەبدولکەریم هەورامی',
      ar: 'مولودة شنيار عبدالرحمن عبدالكريم الهورامي',
      latin: 'Baby girl of Shnyar Abdulrahman Abdulkarim Hawrami',
      ownScript: 'ckb',
    },
    sex: 'female',
    dob: '2026-10-18',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'sulaymaniyah',
    city: CITY.sulaymaniyah,
    bloodGroup: 'B+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'not-assessed' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: { kg: '3.150', measuredOn: '2026-10-18', source: 'measured' },
    heightCm: '49',
    alerts: [
      {
        tone: 'info',
        text: {
          en: 'Newborn: check both name bands before every feed and specimen',
          ckb: 'کۆرپەی تازە: پێش هەموو شیردان و نموونەیەک هەردوو بازنی ناو بپشکنە',
          ar: 'مولودة: تحقق من سواري الاسم قبل كل رضعة وكل عينة',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'شنیار عەبدولڕەحمان', ar: 'شنيار عبدالرحمن', latin: 'Shnyar Abdulrahman' },
      relation: RELATION.mother,
      phone: phone(1103),
    },
    curated: true,
    registeredOn: '2026-10-18',
  },
  {
    ...base(104),
    name: { ckb: 'ڕێبین سەردار قادر', ar: 'ريبين سردار قادر', latin: 'Rebin Sardar Qadir', ownScript: 'ckb' },
    sex: 'male',
    dob: '2019-03-08',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'duhok',
    city: CITY.duhok,
    bloodGroup: 'B+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: { kg: '22.4', measuredOn: '2026-10-19', source: 'measured' },
    heightCm: '121',
    alerts: [],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'سەردار قادر', ar: 'سردار قادر', latin: 'Sardar Qadir' },
      relation: RELATION.father,
      phone: phone(1104),
    },
    curated: true,
    registeredOn: '2019-03-08',
  },
  {
    ...base(105),
    name: { ckb: 'ئاسۆ کامەران یوسف', ar: 'آسو كامران يوسف', latin: 'Aso Kamaran Yousif', ownScript: 'ckb' },
    sex: 'male',
    dob: '1984-03-17',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.soran,
    bloodGroup: 'AB+',
    payerId: 'self-pay',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: {
      types: ['airborne'],
      reason: {
        en: 'Suspected pulmonary tuberculosis',
        ckb: 'گومانی سیلی سییەکان',
        ar: 'اشتباه بالسل الرئوي',
      },
    },
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-18' },
    weight: { kg: '61.0', measuredOn: '2026-10-18', source: 'measured' },
    heightCm: '178',
    alerts: [
      {
        tone: 'danger',
        text: {
          en: 'Airborne isolation: N95 respirator, negative-pressure room A-20',
          ckb: 'جیاکردنەوەی هەوایی: ماسکی N95، ژووری پەستانی نەرێنی A-20',
          ar: 'عزل هوائي: كمامة N95، غرفة الضغط السلبي A-20',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'کامەران یوسف', ar: 'كامران يوسف', latin: 'Kamaran Yousif' },
      relation: RELATION.father,
      phone: phone(1105),
    },
    curated: true,
    registeredOn: '2026-10-18',
  },
  {
    ...base(106),
    name: { ckb: 'نەسرین جەلال مەحموود', ar: 'نسرين جلال محمود', latin: 'Nasreen Jalal Mahmood', ownScript: 'ckb' },
    sex: 'female',
    dob: '1979-08-02',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.koya,
    bloodGroup: 'B-',
    payerId: 'syn-insurance',
    preferredLanguage: 'ckb',
    allergies: {
      kind: 'list',
      items: [
        { ...ALG.coAmoxiclav, reaction: RX.anaphylaxis, severity: 'severe' },
        { ...ALG.coTrimoxazole, reaction: RX.rash },
        { ...ALG.contrast, severity: 'moderate' },
        { ...ALG.ibuprofen },
        { ...ALG.latex, reaction: RX.rash, severity: 'moderate' },
      ],
    },
    isolation: null,
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-18' },
    weight: { kg: '77.3', measuredOn: '2026-10-18', source: 'measured' },
    heightCm: '163',
    alerts: [
      {
        tone: 'danger',
        text: {
          en: 'Latex allergy: latex-free gloves and equipment',
          ckb: 'هەستیاری بە لاتێکس: دەستکێش و ئامێری بێ لاتێکس',
          ar: 'حساسية اللاتكس: قفازات ومعدات خالية من اللاتكس',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'هەڤاڵ کەریم', ar: 'هفال كريم', latin: 'Hawal Karim' },
      relation: RELATION.husband,
      phone: phone(1106),
    },
    curated: true,
    registeredOn: '2015-09-21',
  },
  {
    ...base(107),
    name: {
      ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولڕەزاق هەورامانی',
      ar: 'عبدالرحمن عبدالكريم عبدالرزاق الهوراماني',
      latin: 'Abdulrahman Abdulkarim Abdulrazaq Hawramani',
      ownScript: 'ckb',
    },
    sex: 'male',
    dob: '1950-01-20',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'sulaymaniyah',
    city: CITY.tawella,
    bloodGroup: 'O-',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-16' },
    weight: { kg: '70.0', measuredOn: '2026-10-16', source: 'stated' },
    heightCm: '170',
    alerts: [
      { tone: 'warning', text: LOOK_ALIKE },
      { tone: 'warning', text: FALL_RISK },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'کاوە عەبدولڕەحمان', ar: 'كاوه عبدالرحمن', latin: 'Kawa Abdulrahman' },
      relation: RELATION.son,
      phone: phone(1107),
    },
    curated: true,
    registeredOn: '2008-04-14',
  },
  {
    ...base(108),
    name: {
      ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولموتەلیب هەورامانی',
      ar: 'عبدالرحمن عبدالكريم عبدالمطلب الهوراماني',
      latin: 'Abdulrahman Abdulkarim Abdulmutalib Hawramani',
      ownScript: 'ckb',
    },
    sex: 'male',
    dob: '1962-07-04',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'sulaymaniyah',
    city: CITY.sulaymaniyah,
    bloodGroup: 'A-',
    payerId: 'syn-insurance',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: { kg: '92.5', measuredOn: '2026-10-19', source: 'measured' },
    heightCm: '174',
    alerts: [{ tone: 'warning', text: LOOK_ALIKE }],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'ژیلا ئەحمەد', ar: 'ژيلا أحمد', latin: 'Zhila Ahmad' },
      relation: RELATION.wife,
      phone: phone(1108),
    },
    curated: true,
    registeredOn: '2012-11-30',
  },
  {
    ...base(109),
    name: {
      ckb: 'موحەممەد عەبدولکەریم عەبدولڕەزاق دولەیمی',
      ar: 'محمد عبدالكريم عبدالرزاق الدليمي',
      latin: 'Mohammed Abdulkarim Abdulrazzaq al-Dulaimi',
      ownScript: 'ar',
    },
    sex: 'male',
    dob: '1968-11-23',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.erbil,
    bloodGroup: 'A+',
    payerId: 'self-pay',
    preferredLanguage: 'ar',
    allergies: { kind: 'nka' },
    isolation: {
      types: ['contact'],
      reason: { en: 'MRSA colonisation', ckb: 'هەڵگرتنی بەکتریای MRSA', ar: 'استعمار بجرثومة MRSA' },
    },
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-17' },
    weight: { kg: '88', measuredOn: '2026-10-17', source: 'estimated' },
    heightCm: '180',
    alerts: [
      {
        tone: 'danger',
        text: {
          en: 'Ventilated, on noradrenaline infusion',
          ckb: 'لەسەر ئامێری هەناسەدان، تکاندنی نۆرئەدرێنالین',
          ar: 'على جهاز التنفس، تسريب نورأدرينالين',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'عومەر موحەممەد', ar: 'عمر محمد', latin: 'Omar Mohammed' },
      relation: RELATION.son,
      phone: phone(1109),
    },
    curated: true,
    registeredOn: '2026-10-17',
  },
  {
    ...base(110),
    name: { ckb: 'ئانا ماریا کۆڤاڵسکا', ar: 'آنا ماريا كوفالسكا', latin: 'Anna Maria Kowalska', ownScript: 'latin' },
    sex: 'female',
    dob: '1979-11',
    dobPrecision: 'month',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.ankawa,
    bloodGroup: 'O+',
    payerId: 'intl-insurance',
    preferredLanguage: 'en',
    allergies: { kind: 'list', items: [{ ...ALG.codeine, reaction: RX.vomiting, severity: 'mild' }] },
    isolation: null,
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-18' },
    weight: { kg: '64.8', measuredOn: '2026-10-18', source: 'measured' },
    heightCm: '168',
    alerts: [
      {
        tone: 'info',
        text: {
          en: 'Speaks English; interpreter not needed',
          ckb: 'بە ئینگلیزی قسە دەکات؛ پێویستی بە وەرگێڕ نییە',
          ar: 'تتحدث الإنجليزية؛ لا حاجة لمترجم',
        },
      },
    ],
    hasPhoto: true,
    emergencyContact: {
      name: { ckb: 'تۆماس بێرگ', ar: 'توماس بيرغ', latin: 'Tomas Berg' },
      relation: RELATION.colleague,
      phone: phone(1110),
    },
    curated: true,
    registeredOn: '2026-10-18',
  },
  {
    ...base(111),
    name: { ckb: 'زارا حەمید سەلیم', ar: 'زارا حميد سليم', latin: 'Zara Hamid Salim', ownScript: 'ckb' },
    sex: 'female',
    dob: '1992-02-14',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.erbil,
    bloodGroup: 'O+',
    payerId: 'self-pay',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: { kg: '63.0', measuredOn: '2026-10-19', source: 'measured' },
    heightCm: '165',
    alerts: [],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'حەمید سەلیم', ar: 'حميد سليم', latin: 'Hamid Salim' },
      relation: RELATION.father,
      phone: phone(1111),
    },
    curated: true,
    registeredOn: '2024-05-06',
  },
  {
    ...base(112),
    name: { ckb: 'هاوڕێ نەوزاد فەتاح', ar: 'هاوري نوزاد فتاح', latin: 'Hawre Nawzad Fattah', ownScript: 'ckb' },
    sex: 'male',
    dob: '1999-06-30',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'sulaymaniyah',
    city: CITY.ranya,
    bloodGroup: 'B+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'list', items: [{ ...ALG.latex, reaction: RX.urticaria, severity: 'moderate' }] },
    isolation: null,
    codeStatus: { kind: 'attempt-cpr', recordedOn: '2026-10-18' },
    weight: { kg: '66.4', measuredOn: '2026-10-18', source: 'measured' },
    heightCm: '181',
    alerts: [
      {
        tone: 'warning',
        text: {
          en: 'Insulin infusion: capillary glucose every hour',
          ckb: 'تکاندنی ئەنسولین: پشکنینی شەکرە هەموو کاتژمێرێک',
          ar: 'تسريب أنسولين: فحص السكر الشعري كل ساعة',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'نەوزاد فەتاح', ar: 'نوزاد فتاح', latin: 'Nawzad Fattah' },
      relation: RELATION.father,
      phone: phone(1112),
    },
    curated: true,
    registeredOn: '2013-01-15',
  },
  {
    ...base(113),
    name: { ckb: 'لاڤین ئەکرەم تاها', ar: 'لافين أكرم طه', latin: 'Lavin Akram Taha', ownScript: 'ckb' },
    sex: 'female',
    dob: '2011-09-09',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'duhok',
    city: CITY.zakho,
    bloodGroup: 'A+',
    payerId: 'government',
    preferredLanguage: 'ckb',
    allergies: { kind: 'nka' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: { kg: '48.0', measuredOn: '2026-07-14', source: 'measured' },
    heightCm: '158',
    alerts: [],
    hasPhoto: false,
    emergencyContact: {
      name: { ckb: 'ئەکرەم تاها', ar: 'أكرم طه', latin: 'Akram Taha' },
      relation: RELATION.father,
      phone: phone(1113),
    },
    curated: true,
    registeredOn: '2011-09-10',
  },
  {
    ...base(114),
    name: { ckb: 'پەیمان شێرزاد ئەنوەر', ar: 'بيمان شيرزاد أنور', latin: 'Peyman Sherzad Anwar', ownScript: 'ckb' },
    sex: 'male',
    dob: '1988-04-21',
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: 'erbil',
    city: CITY.shaqlawa,
    bloodGroup: null,
    payerId: 'self-pay',
    preferredLanguage: 'ckb',
    allergies: { kind: 'not-assessed' },
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: null,
    heightCm: null,
    alerts: [
      {
        tone: 'warning',
        text: {
          en: 'Allergies not yet assessed: ask before any medicine',
          ckb: 'هەستیارییەکان هێشتا هەڵنەسەنگێنراون: پێش هەر دەرمانێک بپرسە',
          ar: 'لم تُقيَّم الحساسية بعد: اسأل قبل أي دواء',
        },
      },
    ],
    hasPhoto: false,
    emergencyContact: null,
    curated: true,
    registeredOn: '2026-10-05',
  },
];

// ---------------------------------------------------------------------------------------------------------
// The generated census (synthetic names from three-script name pools)
// ---------------------------------------------------------------------------------------------------------

const MALE: readonly PersonName[] = [
  { ckb: 'سامان', ar: 'سامان', latin: 'Saman' },
  { ckb: 'ڕێبوار', ar: 'ريبوار', latin: 'Rebwar' },
  { ckb: 'هاوکار', ar: 'هاوكار', latin: 'Hawkar' },
  { ckb: 'باران', ar: 'باران', latin: 'Baran' },
  { ckb: 'ئازاد', ar: 'آزاد', latin: 'Azad' },
  { ckb: 'گۆران', ar: 'كوران', latin: 'Goran' },
  { ckb: 'هیوا', ar: 'هيوا', latin: 'Hiwa' },
  { ckb: 'ئومێد', ar: 'أوميد', latin: 'Omed' },
  { ckb: 'یوسف', ar: 'يوسف', latin: 'Yousif' },
  { ckb: 'عەلی', ar: 'علي', latin: 'Ali' },
  { ckb: 'حەسەن', ar: 'حسن', latin: 'Hassan' },
  { ckb: 'ئیبراهیم', ar: 'إبراهيم', latin: 'Ibrahim' },
  { ckb: 'شاخەوان', ar: 'شاخوان', latin: 'Shakhawan' },
];

const FEMALE: readonly PersonName[] = [
  { ckb: 'نازەنین', ar: 'نازنين', latin: 'Nazanin' },
  { ckb: 'شنۆ', ar: 'شنو', latin: 'Shno' },
  { ckb: 'بەهار', ar: 'بهار', latin: 'Bahar' },
  { ckb: 'کەژاڵ', ar: 'كژال', latin: 'Kazhal' },
  { ckb: 'سۆزان', ar: 'سوزان', latin: 'Sozan' },
  { ckb: 'تابان', ar: 'تابان', latin: 'Taban' },
  { ckb: 'دەریا', ar: 'دريا', latin: 'Darya' },
  { ckb: 'ئاڤین', ar: 'آفين', latin: 'Avin' },
  { ckb: 'چنار', ar: 'جنار', latin: 'Chnar' },
  { ckb: 'ژینۆ', ar: 'ژينو', latin: 'Zhino' },
  { ckb: 'فاتیمە', ar: 'فاطمة', latin: 'Fatima' },
  { ckb: 'لەیلا', ar: 'ليلى', latin: 'Layla' },
  { ckb: 'ڤیان', ar: 'فيان', latin: 'Vian' },
];

const FATHER: readonly PersonName[] = [
  { ckb: 'ئەحمەد', ar: 'أحمد', latin: 'Ahmad' },
  { ckb: 'مەحموود', ar: 'محمود', latin: 'Mahmood' },
  { ckb: 'ڕەسوڵ', ar: 'رسول', latin: 'Rasul' },
  { ckb: 'قادر', ar: 'قادر', latin: 'Qadir' },
  { ckb: 'کەریم', ar: 'كريم', latin: 'Karim' },
  { ckb: 'ساڵح', ar: 'صالح', latin: 'Salih' },
  { ckb: 'حەمە', ar: 'حمه', latin: 'Hama' },
  { ckb: 'عەزیز', ar: 'عزيز', latin: 'Aziz' },
  { ckb: 'ڕەشید', ar: 'رشيد', latin: 'Rashid' },
  { ckb: 'فەرەج', ar: 'فرج', latin: 'Faraj' },
  { ckb: 'جەمال', ar: 'جمال', latin: 'Jamal' },
  { ckb: 'عوسمان', ar: 'عثمان', latin: 'Othman' },
  { ckb: 'عەبدوڵڵا', ar: 'عبدالله', latin: 'Abdullah' },
  { ckb: 'خدر', ar: 'خضر', latin: 'Khidir' },
  { ckb: 'مەجید', ar: 'مجيد', latin: 'Majid' },
  { ckb: 'سابیر', ar: 'صابر', latin: 'Sabir' },
  { ckb: 'تۆفیق', ar: 'توفيق', latin: 'Tofiq' },
];

const GOVERNORATES: readonly { readonly governorate: Governorate; readonly city: Text3 }[] = [
  { governorate: 'erbil', city: CITY.erbil },
  { governorate: 'sulaymaniyah', city: CITY.sulaymaniyah },
  { governorate: 'erbil', city: CITY.shaqlawa },
  { governorate: 'duhok', city: CITY.duhok },
  { governorate: 'sulaymaniyah', city: CITY.chamchamal },
  { governorate: 'erbil', city: CITY.koya },
  { governorate: 'halabja', city: CITY.halabja },
  { governorate: 'duhok', city: CITY.akre },
  { governorate: 'erbil', city: CITY.erbil },
];

const BLOOD: readonly BloodGroup[] = ['O+', 'A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-', 'A+', 'O+'];

/** The census groups: who fills which beds, and the outpatients of today's clinics. */
export type CensusGroup = 'med-a' | 'surg-b' | 'paeds' | 'icu' | 'outpatient';

const CENSUS_PLAN: readonly { readonly group: CensusGroup; readonly count: number; readonly ages: readonly [number, number] }[] = [
  { group: 'med-a', count: 11, ages: [41, 86] },
  { group: 'surg-b', count: 9, ages: [19, 78] },
  { group: 'paeds', count: 6, ages: [0, 13] },
  { group: 'icu', count: 6, ages: [26, 81] },
  { group: 'outpatient', count: 8, ages: [17, 72] },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function censusPatient(index: number, group: CensusGroup, ages: readonly [number, number]): Patient {
  const number = 201 + index;
  const sex: Sex = index % 2 === 0 ? 'male' : 'female';
  const firstPool = sex === 'male' ? MALE : FEMALE;
  const first = firstPool[(index * 5 + 2) % firstPool.length] ?? MALE[0]!;
  const father = FATHER[(index * 7 + 1) % FATHER.length] ?? FATHER[0]!;
  let grand = FATHER[(index * 3 + 5) % FATHER.length] ?? FATHER[1]!;
  if (grand.latin === father.latin) {
    grand = FATHER[(index * 3 + 6) % FATHER.length] ?? FATHER[2]!;
  }
  const span = ages[1] - ages[0] + 1;
  const age = ages[0] + ((index * 13) % span);
  const month = ((index * 5) % 12) + 1;
  const day = ((index * 7) % 27) + 1;
  // Born before 19 October so the age is exact; infants keep a recent date.
  const year = 2026 - age - (month > 10 ? 1 : 0);
  const place = GOVERNORATES[index % GOVERNORATES.length] ?? GOVERNORATES[0]!;
  const child = age < 14;
  const kg = child ? (3.4 + age * 2.9 + (index % 3) * 0.6).toFixed(1) : (56 + ((index * 9) % 38) + (index % 2) * 0.5).toFixed(1);
  const name: PatientName = {
    ckb: `${first.ckb} ${father.ckb} ${grand.ckb}`,
    ar: `${first.ar} ${father.ar} ${grand.ar}`,
    latin: `${first.latin} ${father.latin} ${grand.latin}`,
    ownScript: 'ckb',
  };
  return {
    ...base(number),
    name,
    sex,
    dob: `${String(year)}-${pad2(month)}-${pad2(day)}`,
    dobPrecision: 'day',
    dobApproximate: false,
    governorate: place.governorate,
    city: place.city,
    bloodGroup: BLOOD[index % BLOOD.length] ?? null,
    payerId: index % 4 === 0 ? 'self-pay' : index % 5 === 0 ? 'syn-insurance' : 'government',
    preferredLanguage: index % 9 === 4 ? 'ar' : 'ckb',
    allergies: index % 7 === 3 ? { kind: 'not-assessed' } : { kind: 'nka' },
    isolation: null,
    codeStatus: group === 'icu' ? { kind: 'attempt-cpr', recordedOn: '2026-10-15' } : { kind: 'not-documented' },
    weight: { kg, measuredOn: group === 'outpatient' ? '2026-10-19' : '2026-10-17', source: 'measured' },
    heightCm: null,
    alerts: [],
    hasPhoto: false,
    emergencyContact: null,
    curated: false,
    registeredOn: `${String(2010 + (index % 16))}-${pad2(month)}-${pad2(day)}`,
  };
}

function buildCensus(): { readonly patients: readonly Patient[]; readonly groups: Readonly<Record<CensusGroup, readonly string[]>> } {
  const patients: Patient[] = [];
  const groups: Record<CensusGroup, string[]> = { 'med-a': [], 'surg-b': [], paeds: [], icu: [], outpatient: [] };
  let index = 0;
  for (const { group, count, ages } of CENSUS_PLAN) {
    for (let i = 0; i < count; i += 1) {
      const patient = censusPatient(index, group, ages);
      patients.push(patient);
      groups[group].push(patient.id);
      index += 1;
    }
  }
  return { patients, groups };
}

const CENSUS = buildCensus();

/** The generated census patients. */
export const CENSUS_PATIENTS: readonly Patient[] = CENSUS.patients;

/** The census patient ids by group (which beds they fill, or today's clinics). */
export const CENSUS_GROUPS: Readonly<Record<CensusGroup, readonly string[]>> = CENSUS.groups;

/** Every patient: the 14 curated first, then the census. */
export const PATIENTS: readonly Patient[] = [...CURATED_PATIENTS, ...CENSUS_PATIENTS];

const BY_ID: ReadonlyMap<string, Patient> = new Map(PATIENTS.map((patient) => [patient.id, patient]));

/** The patient with this id (synthetic data, then this session's registrations), or undefined. */
export function findPatient(patientId: string | null | undefined): Patient | undefined {
  return patientId === null || patientId === undefined ? undefined : (BY_ID.get(patientId) ?? findSessionPatient(patientId));
}

/** The patient with this id; throws for an unknown id (a defect in the data). */
export function getPatient(patientId: string): Patient {
  const patient = BY_ID.get(patientId) ?? findSessionPatient(patientId);
  if (patient === undefined) {
    throw new Error(`Unknown synthetic patient ${patientId}`);
  }
  return patient;
}

/** True when the patient carries the "High fall risk" alert. */
export function hasFallRiskAlert(patient: Patient): boolean {
  return patient.alerts.some((alert) => alert.text === FALL_RISK || alert.text.en === FALL_RISK.en);
}

/** True when the patient has an allergy whose code is `code` (e.g. 'SYN-ALG-PENICILLIN'). */
export function hasAllergy(patient: Patient, code: string): boolean {
  return patient.allergies.kind === 'list' && patient.allergies.items.some((item) => item.code === code);
}

// ---------------------------------------------------------------------------------------------------------
// Banner data (the input of ui-core's parseBannerData)
// ---------------------------------------------------------------------------------------------------------

function concept(code: string, labels: Text3) {
  return { code, labels: { en: labels.en, ckb: labels.ckb, ar: labels.ar } };
}

const CODE_STATUS_CONCEPT = {
  'attempt-cpr': concept('SYN-CS-ATTEMPT-CPR', { en: 'Attempt CPR', ckb: 'هەوڵی CPR بدرێت', ar: 'محاولة الإنعاش القلبي الرئوي' }),
  dnacpr: concept('SYN-CS-NO-CPR', { en: 'Do not attempt CPR', ckb: 'هەوڵی CPR نەدرێت', ar: 'عدم محاولة الإنعاش' }),
} as const;

const ISOLATION_CODE = { contact: 'SYN-ISO-CONTACT', droplet: 'SYN-ISO-DROPLET', airborne: 'SYN-ISO-AIRBORNE' } as const;
const SEVERITY_CODE = { mild: 'SYN-SEV-MILD', moderate: 'SYN-SEV-MODERATE', severe: 'SYN-SEV-SEVERE' } as const;

function reactionCode(text: Text3): string {
  return `SYN-RX-${text.en.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

/** The patient's banner data, as untrusted input for ui-core's parseBannerData (synthetic provenance). */
export function bannerDataOf(patient: Patient): Record<string, unknown> {
  const allergies =
    patient.allergies.kind === 'list'
      ? {
          status: 'list',
          items: patient.allergies.items.map((item) => ({
            substance: concept(item.code, item.substance),
            ...(item.reaction === undefined ? {} : { reaction: concept(reactionCode(item.reaction), item.reaction) }),
            ...(item.severity === undefined
              ? {}
              : { severity: concept(SEVERITY_CODE[item.severity], SEVERITY_LABEL[item.severity]) }),
          })),
        }
      : { status: patient.allergies.kind };
  const codeStatus =
    patient.codeStatus.kind === 'not-documented'
      ? { status: 'not-documented' }
      : {
          status: 'documented',
          concept: CODE_STATUS_CONCEPT[patient.codeStatus.kind],
          recordedOn: patient.codeStatus.recordedOn,
        };
  const isolation =
    patient.isolation === null
      ? { status: 'none-recorded' }
      : {
          status: 'active',
          precautions: patient.isolation.types.map((type) => concept(ISOLATION_CODE[type], ISOLATION_LABEL[type])),
        };
  const weight =
    patient.weight === null
      ? { status: 'none-recorded' }
      : {
          status: 'recorded',
          value: patient.weight.kg,
          unit: 'kg',
          measuredOn: patient.weight.measuredOn,
          source: patient.weight.source,
        };
  return {
    provenance: 'synthetic',
    patientId: patient.id,
    photo: patient.hasPhoto ? { status: 'present', src: syntheticPhoto } : { status: 'absent' },
    name: {
      ckb: patient.name.ckb,
      ar: patient.name.ar,
      latin: patient.name.latin,
      ownScript: patient.name.ownScript,
    },
    mrn: patient.mrn,
    dob: { value: patient.dob, precision: patient.dobPrecision, approximate: patient.dobApproximate },
    allergies,
    codeStatus,
    isolation,
    weight,
  };
}
