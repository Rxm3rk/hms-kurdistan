/**
 * The demo's synthetic patients (docs/specs/modules/design-system.md §5; BUILD-PROMPT.md §3.4 item 7,
 * §18.10). SYNTHETIC DATA, NOT FOR CLINICAL USE: every name, MRN, date, allergy and label here is invented,
 * and the code-status and isolation codes are ui-core's synthetic vocabulary (OQ-143). The Sorani and Arabic
 * texts are agent drafts, like the catalogue's (DN-021).
 *
 * Every fixture carries `provenance: synthetic`, at its top and in its banner data, and is checked by
 * `demoFixtureSchema` (Zod) when this module loads: a malformed fixture stops the demo build from starting.
 * The banner data itself is untrusted input for ui-core's banner model, and several fixtures are invalid on
 * purpose, to show the banner's missing and unavailable states. `expect` says what the banner model must
 * make of each one; demo-fixtures.test.ts checks it.
 *
 * The set covers the cases §5 lists: a complete record; NKA; not assessed; a long allergy list; missing and
 * contradictory allergy data; an approximate (year-only), a missing and an invalid date of birth; no photo; a
 * missing Latin name; a missing third name form; long four-part names in Sorani and in Arabic, two of them
 * differing only in the grandfather's name; active isolation and an unknown isolation code; code status
 * documented and not documented; no dated weight and an invalid weight; labels missing in a locale; a
 * Latin-script patient; an alias name; a newborn name; and the banner's error state.
 */
import { z } from 'zod';
import syntheticPhoto from './synthetic-photo.png';

/** Patient ids as ui-core accepts them. */
const PATIENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const identityFieldStatus = z.enum(['valid', 'missing', 'invalid']);

/** What the banner model must make of a fixture. Omitted fields are not checked. */
const expectationSchema = z.strictObject({
  errorState: z.boolean(),
  signingBlocked: z.boolean(),
  identityIncomplete: z.boolean(),
  names: z
    .strictObject({
      ckb: identityFieldStatus.optional(),
      ar: identityFieldStatus.optional(),
      latin: identityFieldStatus.optional(),
    })
    .optional(),
  mrn: identityFieldStatus.optional(),
  photo: z.enum(['present', 'absent', 'unavailable']).optional(),
  dob: z.enum(['valid', 'missing', 'unavailable']).optional(),
  approximateDobFlag: z.boolean().optional(),
  allergies: z.enum(['nka', 'not-assessed', 'list', 'unavailable']).optional(),
  allergyCount: z.number().int().min(1).optional(),
  codeStatus: z.enum(['documented', 'not-documented', 'unavailable']).optional(),
  isolation: z.enum(['active', 'none-recorded', 'unavailable']).optional(),
  weight: z.enum(['recorded', 'none-recorded', 'unavailable']).optional(),
});
export type DemoFixtureExpectation = z.infer<typeof expectationSchema>;

export const demoFixtureSchema = z.strictObject({
  /** The fixture's id, for `?fixture=<id>` (design-system §5). */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** The patient id the window's context uses for this fixture. */
  patientId: z.string().regex(PATIENT_ID),
  provenance: z.literal('synthetic'),
  /** What the fixture shows, for whoever maintains the demo; never shown in the UI. */
  shows: z.string().min(1),
  /** The banner data: untrusted input for ui-core's banner model, which may reject parts of it on purpose. */
  data: z.looseObject({ provenance: z.literal('synthetic') }),
  expect: expectationSchema,
});
export type DemoFixture = z.infer<typeof demoFixtureSchema>;

export const demoFixturesSchema = z
  .array(demoFixtureSchema)
  .min(1)
  .refine((fixtures) => new Set(fixtures.map((fixture) => fixture.id)).size === fixtures.length, {
    message: 'fixture ids must be unique',
  })
  .refine((fixtures) => new Set(fixtures.map((fixture) => fixture.patientId)).size === fixtures.length, {
    message: 'fixture patient ids must be unique',
  });

// ---------------------------------------------------------------------------------------------------------
// Building blocks (synthetic)
// ---------------------------------------------------------------------------------------------------------

type Names = Readonly<Partial<Record<'ckb' | 'ar' | 'latin', string>>> & {
  readonly ownScript: 'ckb' | 'ar' | 'latin';
};

const PHOTO = { status: 'present', src: syntheticPhoto } as const;
const NO_PHOTO = { status: 'absent' } as const;

function concept(code: string, en?: string, ckb?: string, ar?: string) {
  return {
    code,
    labels: {
      ...(en === undefined ? {} : { en }),
      ...(ckb === undefined ? {} : { ckb }),
      ...(ar === undefined ? {} : { ar }),
    },
  };
}

const PENICILLIN = concept('SYN-ALG-PENICILLIN', 'Penicillin', 'پێنیسیلین', 'بنسلين');
const LATEX = concept('SYN-ALG-LATEX', 'Latex', 'لاتێکس', 'لاتكس');
const RASH = concept('SYN-RX-RASH', 'Rash', 'خورشت', 'طفح جلدي');
const MODERATE = concept('SYN-SEV-MODERATE', 'Moderate', 'مامناوەند', 'متوسط');
const SEVERE = concept('SYN-SEV-SEVERE', 'Severe', 'توند', 'شديد');
const ANAPHYLAXIS = concept('SYN-RX-ANAPHYLAXIS', 'Anaphylaxis', 'ئەنافیلاکسی', 'تأق');

const ATTEMPT_CPR = concept(
  'SYN-CS-ATTEMPT-CPR',
  'Attempt CPR (synthetic)',
  'هەوڵی CPR (نموونە)',
  'محاولة CPR (تجريبي)',
);
const NO_CPR = concept('SYN-CS-NO-CPR', 'Do not attempt CPR (synthetic)', 'CPR مەکە (نموونە)', 'لا تحاول CPR (تجريبي)');
const CONTACT = concept('SYN-ISO-CONTACT', 'Contact (synthetic)', 'بەرکەوتن (نموونە)', 'تلامسي (تجريبي)');
const DROPLET = concept('SYN-ISO-DROPLET', 'Droplet (synthetic)', 'دڵۆپە (نموونە)', 'رذاذي (تجريبي)');
const AIRBORNE = concept('SYN-ISO-AIRBORNE', 'Airborne (synthetic)', 'هەوایی (نموونە)', 'هوائي (تجريبي)');

const NKA = { status: 'nka' } as const;
const NOT_DOCUMENTED = { status: 'not-documented' } as const;
const NO_ISOLATION = { status: 'none-recorded' } as const;
const NO_WEIGHT = { status: 'none-recorded' } as const;

function weight(value: string, measuredOn: string, source: 'measured' | 'stated' | 'estimated' = 'measured') {
  return { status: 'recorded', value, unit: 'kg', measuredOn, source } as const;
}

function dob(value: string, precision: 'day' | 'month' | 'year' = 'day', approximate = false) {
  return { value, precision, approximate } as const;
}

/** One synthetic patient's banner data: a valid record that each fixture changes where it needs to. */
function patient(
  number: number,
  names: Names,
  fields: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const digits = String(number).padStart(4, '0');
  return {
    provenance: 'synthetic',
    patientId: `SYN-PAT-${digits}`,
    photo: NO_PHOTO,
    name: names,
    mrn: `SYN-10${digits}-${String(number % 10)}`,
    dob: dob('1984-03-17'),
    allergies: NKA,
    codeStatus: NOT_DOCUMENTED,
    isolation: NO_ISOLATION,
    weight: weight('72.5', '2026-10-15'),
    ...fields,
  };
}

/** A record whose identity is complete and valid. */
const VALID_IDENTITY = { errorState: false, signingBlocked: false, identityIncomplete: false } as const;

// ---------------------------------------------------------------------------------------------------------
// The fixtures
// ---------------------------------------------------------------------------------------------------------

const RAW_FIXTURES: readonly unknown[] = [
  {
    id: 'complete',
    shows: 'a complete record: photo, all three name forms, allergies with reaction and severity, code status, isolation and a dated weight',
    data: patient(
      1,
      { ckb: 'هێمن ئازاد عومەر', ar: 'هيمن آزاد عمر', latin: 'Hêmin Azad Omer', ownScript: 'ckb' },
      {
        photo: PHOTO,
        allergies: {
          status: 'list',
          items: [{ substance: PENICILLIN, reaction: RASH, severity: MODERATE }, { substance: LATEX }],
        },
        codeStatus: { status: 'documented', concept: ATTEMPT_CPR, recordedOn: '2026-10-01' },
        isolation: { status: 'active', precautions: [CONTACT] },
        weight: weight('72.50', '2026-10-18'),
      },
    ),
    expect: {
      ...VALID_IDENTITY,
      names: { ckb: 'valid', ar: 'valid', latin: 'valid' },
      photo: 'present',
      allergies: 'list',
      allergyCount: 2,
      codeStatus: 'documented',
      isolation: 'active',
      weight: 'recorded',
    },
  },
  {
    id: 'nka',
    shows: 'no known allergies (NKA)',
    data: patient(2, { ckb: 'شیلان کەریم ئەحمەد', ar: 'شيلان كريم أحمد', latin: 'Şîlan Kerîm Ehmed', ownScript: 'ckb' }, { photo: PHOTO }),
    expect: { ...VALID_IDENTITY, allergies: 'nka' },
  },
  {
    id: 'not-assessed',
    shows: 'allergies not assessed, distinct from NKA',
    data: patient(
      3,
      { ckb: 'دڵشاد ڕەسوڵ حەمە', ar: 'دلشاد رسول حمه', latin: 'Dilşad Resul Heme', ownScript: 'ckb' },
      { allergies: { status: 'not-assessed' } },
    ),
    expect: { ...VALID_IDENTITY, allergies: 'not-assessed' },
  },
  {
    id: 'allergy-list-long',
    shows: 'a long allergy list: every substance whole, wrapping, never collapsed',
    data: patient(
      4,
      { ckb: 'نەسرین جەلال مەحمود', ar: 'نسرين جلال محمود', latin: 'Nesrîn Celal Mehmud', ownScript: 'ckb' },
      {
        allergies: {
          status: 'list',
          items: [
            {
              substance: concept(
                'SYN-ALG-AMOXICILLIN-CLAVULANATE',
                'Amoxicillin and clavulanic acid',
                'ئەمۆکسیسیلین و ئەسیدی کلاڤیولانیک',
                'أموكسيسيلين وحمض الكلافولانيك',
              ),
              reaction: ANAPHYLAXIS,
              severity: SEVERE,
            },
            {
              substance: concept(
                'SYN-ALG-SULFAMETHOXAZOLE-TRIMETHOPRIM',
                'Sulfamethoxazole and trimethoprim',
                'سەلفامێتۆکسازۆڵ و تریمێتۆپریم',
                'سلفاميثوكسازول وتريميثوبريم',
              ),
              reaction: RASH,
            },
            {
              substance: concept('SYN-ALG-CONTRAST', 'Iodinated contrast media', 'ماددەی کۆنتراستی یۆددار', 'وسائط التباين المحتوية على اليود'),
              severity: MODERATE,
            },
            { substance: concept('SYN-ALG-IBUPROFEN', 'Ibuprofen', 'ئایبوپرۆفین', 'إيبوبروفين') },
            { substance: concept('SYN-ALG-PEANUT', 'Peanut', 'فستەق', 'فول سوداني'), reaction: ANAPHYLAXIS, severity: SEVERE },
            { substance: concept('SYN-ALG-EGG', 'Egg', 'هێلکە', 'بيض') },
            { substance: LATEX, reaction: RASH, severity: MODERATE },
          ],
        },
      },
    ),
    expect: { ...VALID_IDENTITY, allergies: 'list', allergyCount: 7 },
  },
  {
    id: 'allergies-missing',
    shows: 'missing allergy data: "Allergy status unavailable", never NKA',
    data: patient(
      5,
      { ckb: 'ئاراس فەرهاد قادر', ar: 'آراس فرهاد قادر', latin: 'Aras Ferhad Qadir', ownScript: 'ckb' },
      { allergies: undefined },
    ),
    expect: { ...VALID_IDENTITY, allergies: 'unavailable' },
  },
  {
    id: 'allergies-contradictory',
    shows: 'contradictory allergy data (NKA with items): unavailable, never NKA',
    data: patient(
      6,
      { ckb: 'ژیان سەلام ئیبراهیم', ar: 'جيان سلام إبراهيم', latin: 'Jiyan Selam Îbrahîm', ownScript: 'ckb' },
      { allergies: { status: 'nka', items: [{ substance: PENICILLIN }] } },
    ),
    expect: { ...VALID_IDENTITY, allergies: 'unavailable' },
  },
  {
    id: 'dob-year-only',
    shows: 'a date of birth recorded to the year only, with the approximate-DOB flag',
    data: patient(
      7,
      { ckb: 'گوڵاڵە عوسمان ڕەشید', ar: 'كولاله عثمان رشيد', latin: 'Gulale Osman Reşîd', ownScript: 'ckb' },
      { dob: dob('1956', 'year', true) },
    ),
    expect: { ...VALID_IDENTITY, dob: 'valid', approximateDobFlag: true },
  },
  {
    id: 'dob-invalid',
    shows: 'an invalid date of birth (31 February): "Date of birth unavailable", identity incomplete, signing blocked',
    data: patient(
      8,
      { ckb: 'بەختیار نامیق سەعید', ar: 'بختيار ناميق سعيد', latin: 'Bextiyar Namîq Seîd', ownScript: 'ckb' },
      { dob: dob('1990-02-31') },
    ),
    expect: { errorState: false, signingBlocked: true, identityIncomplete: true, dob: 'unavailable' },
  },
  {
    id: 'no-photo',
    shows: 'no photo recorded: "No photo" in its place',
    data: patient(9, { ckb: 'ڕۆژان حسێن عەلی', ar: 'روجان حسين علي', latin: 'Rojan Hisên Elî', ownScript: 'ckb' }),
    expect: { ...VALID_IDENTITY, photo: 'absent' },
  },
  {
    id: 'latin-name-missing',
    shows: 'a missing Latin name: "Latin name missing" and "Identity incomplete"; signing is not blocked',
    data: patient(10, { ckb: 'سۆران مستەفا خدر', ar: 'سوران مصطفى خضر', ownScript: 'ckb' }, { photo: PHOTO }),
    expect: { errorState: false, signingBlocked: false, identityIncomplete: true, names: { latin: 'missing' } },
  },
  {
    id: 'third-name-missing',
    shows: 'a missing third name form (Arabic): flagged, without "Identity incomplete"',
    data: patient(11, { ckb: 'کاوە جەمال حەسەن', latin: 'Kawe Cemal Hesen', ownScript: 'ckb' }),
    expect: { ...VALID_IDENTITY, names: { ckb: 'valid', ar: 'missing', latin: 'valid' } },
  },
  {
    id: 'long-name-sorani',
    shows: 'a long four-part name in Sorani: wraps, never truncated',
    data: patient(12, {
      ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولڕەزاق هەورامانی',
      ar: 'عبدالرحمن عبدالكريم عبدالرزاق الهوراماني',
      latin: 'Abdulrehman Abdulkerîm Abdulrezaq Hewramanî',
      ownScript: 'ckb',
    }),
    expect: VALID_IDENTITY,
  },
  {
    id: 'long-name-sorani-grandfather',
    shows: 'the patient of long-name-sorani with only the grandfather\'s name different: the two are told apart',
    data: patient(13, {
      ckb: 'عەبدولڕەحمان عەبدولکەریم عەبدولموتەلیب هەورامانی',
      ar: 'عبدالرحمن عبدالكريم عبدالمطلب الهوراماني',
      latin: 'Abdulrehman Abdulkerîm Abdulmutelîb Hewramanî',
      ownScript: 'ckb',
    }),
    expect: VALID_IDENTITY,
  },
  {
    id: 'long-name-arabic',
    shows: 'a long four-part name with Arabic as the patient\'s own script, shown first',
    data: patient(14, {
      ckb: 'موحەممەد عەبدولکەریم عەبدولڕەزاق دولەیمی',
      ar: 'محمد عبدالكريم عبدالرزاق الدليمي',
      latin: 'Mohammed Abdulkarim Abdulrazzaq al-Dulaimi',
      ownScript: 'ar',
    }),
    expect: VALID_IDENTITY,
  },
  {
    id: 'isolation-active',
    shows: 'active isolation with two precautions',
    data: patient(
      15,
      { ckb: 'ئاسۆ کامەران یوسف', ar: 'آسو كامران يوسف', latin: 'Aso Kameran Yûsif', ownScript: 'ckb' },
      { isolation: { status: 'active', precautions: [AIRBORNE, DROPLET] } },
    ),
    expect: { ...VALID_IDENTITY, isolation: 'active' },
  },
  {
    id: 'isolation-unknown-code',
    shows: 'an isolation code the client vocabulary does not know: "Isolation status unavailable"',
    data: patient(
      16,
      { ckb: 'پەیمان شێرزاد ئەنوەر', ar: 'بيمان شيرزاد أنور', latin: 'Peyman Şêrzad Enwer', ownScript: 'ckb' },
      { isolation: { status: 'active', precautions: [concept('SYN-ISO-UNKNOWN', 'Unknown precaution (synthetic)')] } },
    ),
    expect: { ...VALID_IDENTITY, isolation: 'unavailable' },
  },
  {
    id: 'code-status-documented',
    shows: 'a documented code status with the date it was recorded',
    data: patient(
      17,
      { ckb: 'زارا حەمید سەلیم', ar: 'زارا حميد سليم', latin: 'Zara Hemîd Selîm', ownScript: 'ckb' },
      { codeStatus: { status: 'documented', concept: NO_CPR, recordedOn: '2026-09-28' } },
    ),
    expect: { ...VALID_IDENTITY, codeStatus: 'documented' },
  },
  {
    id: 'code-status-not-documented',
    shows: 'code status not documented, distinct from unavailable',
    data: patient(18, { ckb: 'لاڤین ئەکرەم تاها', ar: 'لافين أكرم طه', latin: 'Lavîn Ekrem Taha', ownScript: 'ckb' }),
    expect: { ...VALID_IDENTITY, codeStatus: 'not-documented' },
  },
  {
    id: 'weight-none',
    shows: 'no dated weight recorded: "No dated weight"',
    data: patient(
      19,
      { ckb: 'هاوڕێ نەوزاد فەتاح', ar: 'هاوري نوزاد فتاح', latin: 'Hawrê Newzad Fetah', ownScript: 'ckb' },
      { weight: NO_WEIGHT },
    ),
    expect: { ...VALID_IDENTITY, weight: 'none-recorded' },
  },
  {
    id: 'weight-invalid',
    shows: 'an invalid weight (zero): "Weight unavailable", never shown as a weight',
    data: patient(
      20,
      { ckb: 'ڤیان ئیسماعیل مەجید', ar: 'فيان إسماعيل مجيد', latin: 'Viyan Îsmaîl Mecîd', ownScript: 'ckb' },
      { weight: weight('0', '2026-10-12') },
    ),
    expect: { ...VALID_IDENTITY, weight: 'unavailable' },
  },
  {
    id: 'label-untranslated',
    shows: 'governed labels missing in some locales: another locale\'s label with "Not translated", or the code',
    data: patient(
      21,
      { ckb: 'ئەڤین سەردار ڕەحیم', ar: 'أفين سردار رحيم', latin: 'Evîn Serdar Rehîm', ownScript: 'ckb' },
      {
        allergies: {
          status: 'list',
          items: [
            { substance: concept('SYN-ALG-CODEINE', 'Codeine') },
            { substance: concept('SYN-ALG-UNLABELLED') },
          ],
        },
        isolation: { status: 'active', precautions: [concept('SYN-ISO-CONTACT', undefined, 'بەرکەوتن (نموونە)')] },
      },
    ),
    expect: { ...VALID_IDENTITY, allergies: 'list', allergyCount: 2, isolation: 'active' },
  },
  {
    id: 'latin-script-patient',
    shows: 'a patient whose own script is Latin: the Latin form first',
    data: patient(
      22,
      { ckb: 'ئانا ماریا کۆڤاڵسکا', ar: 'آنا ماريا كوفالسكا', latin: 'Anna Maria Kowalska', ownScript: 'latin' },
      { dob: dob('1979-11', 'month') },
    ),
    expect: { ...VALID_IDENTITY, dob: 'valid', approximateDobFlag: true },
  },
  {
    id: 'alias-name',
    shows: 'an unidentified patient under an alias, with no date of birth: "Date of birth missing", signing blocked',
    data: patient(
      23,
      { ckb: 'ترۆما زوولو-17', ar: 'تروما زولو-17', latin: 'Trauma Zulu-17', ownScript: 'latin' },
      { dob: undefined, allergies: { status: 'not-assessed' }, weight: weight('80', '2026-10-19', 'estimated') },
    ),
    expect: { errorState: false, signingBlocked: true, identityIncomplete: true, dob: 'missing', weight: 'recorded' },
  },
  {
    id: 'newborn-name',
    shows: 'a newborn registered as "Baby of" the mother, with a measured weight',
    data: patient(
      24,
      { ckb: 'کۆرپەی شیلان کەریم', ar: 'مولود شيلان كريم', latin: 'Baby of Şîlan Kerîm', ownScript: 'ckb' },
      { dob: dob('2026-10-17'), allergies: { status: 'not-assessed' }, weight: weight('3.250', '2026-10-17') },
    ),
    expect: { ...VALID_IDENTITY, weight: 'recorded' },
  },
  {
    id: 'banner-error',
    shows: 'a record without an MRN: the banner error state, clinical actions and signing disabled',
    data: patient(
      25,
      { ckb: 'نیان دارا عومەر', ar: 'نيان دارا عمر', latin: 'Nyan Dara Omer', ownScript: 'ckb' },
      { mrn: undefined },
    ),
    expect: { errorState: true, signingBlocked: true, identityIncomplete: false, mrn: 'missing' },
  },
].map((fixture) => {
  const { data } = fixture as { readonly data: Record<string, unknown> };
  // A field set to undefined is removed, so that it is missing rather than present and undefined.
  const cleaned = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  return {
    ...(fixture as Record<string, unknown>),
    data: cleaned,
    provenance: 'synthetic',
    patientId: cleaned.patientId,
  };
});

/** The demo fixtures, checked by demoFixturesSchema when this module loads. */
export const DEMO_FIXTURES: readonly DemoFixture[] = demoFixturesSchema.parse(RAW_FIXTURES);

/** The fixture with this id, if any. */
export function findFixture(id: string): DemoFixture | undefined {
  return DEMO_FIXTURES.find((fixture) => fixture.id === id);
}
