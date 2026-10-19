/**
 * The banner data model (BUILD-PROMPT.md §2.1 SI-16 and SI-01, §9.4; docs/specs/modules/design-system.md
 * §2.1 "Data model" and rules 1, 4 and 6; CTRL-0016-3, CTRL-0016-4, CTRL-0001-4, CTRL-0001-6, CTRL-0001-7).
 *
 * parseBannerData turns untrusted input into a BannerModel field by field. Each field is parsed on its own
 * with a strict Zod schema (closed objects; the allergy status is a discriminated union with no extra keys),
 * so an invalid field shows that field's missing or unavailable state and the other fields still render
 * (rule 4: fail visibly). The model never guesses:
 *
 * - Allergy status is exactly one of `nka`, `not-assessed` or `list`. Missing, null, unknown, empty-list,
 *   malformed, extra-key and contradictory data (`nka` or `not-assessed` carrying items) give `unavailable`,
 *   never NKA, and one malformed item makes the whole field unavailable; no item is ever dropped (CTRL-0016-4).
 * - The model has no room, bed or location field. Keys that are not banner fields are ignored, so no location
 *   value can reach an identifier (rule 1; CTRL-0001-4).
 * - The weight is a decimal string greater than zero, checked by its characters, never by arithmetic (SI-05).
 *
 * - Before any schema runs, the input is copied into plain data (toPlainData): own enumerable data
 *   properties only, into objects with no prototype. An inherited key (a polluted Object.prototype, an object
 *   built on another prototype), a getter or a class instance can never supply a value, at any depth.
 *
 * The identity flags `errorState` and `signingBlocked` are the inputs of the patient-context predicates
 * requestedPatientIdentityValid and bannerIdentityValid (patient-context.ts; decision DN-032).
 */
import { z } from 'zod';
import {
  formatClinicalNumber,
  formatClinicalQuantity,
  type ClinicalQuantityDisplay,
  type UnitDisplayMap,
} from './clinical-number.ts';

/** The UI locales (`@hms/i18n` UI_LOCALES); repeated here because ui-core does not depend on @hms/i18n. */
export type BannerLocale = 'en' | 'ckb' | 'ar';
const BANNER_LOCALES: readonly BannerLocale[] = ['en', 'ckb', 'ar'];

/** The three name forms (§11.2): Kurdish in Arabic script, Arabic, and the Latin transliteration. */
export type NameForm = 'ckb' | 'ar' | 'latin';
export const NAME_FORMS: readonly NameForm[] = ['ckb', 'ar', 'latin'];

/** Direction and language of each name form, for the design system's Bdi (design-system §2.7). */
export const NAME_FORM_TEXT: Readonly<
  Record<NameForm, { readonly dir: 'ltr' | 'rtl'; readonly lang: string }>
> = {
  ckb: { dir: 'rtl', lang: 'ckb' },
  ar: { dir: 'rtl', lang: 'ar' },
  latin: { dir: 'ltr', lang: 'und-Latn' },
};

// ---------------------------------------------------------------------------------------------------------
// Text and code checks
// ---------------------------------------------------------------------------------------------------------

const ZERO_WIDTH_NON_JOINER = '\u200C';
const ZERO_WIDTH_JOINER = '\u200D';
/** Control, surrogate, private-use and line or paragraph separator characters, and U+FFFD. */
const FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cs}\p{Co}\p{Zl}\p{Zp}\uFFFD]/u;
/**
 * Format characters, which include the bidi controls, and the other default-ignorable code points (the
 * combining grapheme joiner, variation selectors, fillers), which render as nothing. Only ZWNJ and ZWJ are
 * allowed in text.
 */
const INVISIBLE_CHARACTER = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/u;
const LETTER = /\p{L}/u;
/** Non-spacing and spacing combining marks; an enclosing mark (\p{Me}) is never allowed in a name. */
const COMBINING_MARK = /[\p{Mn}\p{Mc}]/u;
const DECIMAL_DIGIT = /\p{Nd}/u;
const ASCII_DIGIT = /^[0-9]$/;
const PUNCTUATION = /\p{P}/u;
const COMMON_SCRIPT = /\p{Script_Extensions=Common}/u;
const ARABIC_SCRIPT = /\p{Script_Extensions=Arabic}/u;
const LATIN_SCRIPT = /\p{Script_Extensions=Latin}/u;

/**
 * Display text from data (a name form or a governed label): after trimming, not empty, and free of control,
 * format (bidi control), other default-ignorable, surrogate, private-use and separator characters, which
 * could hide or reorder text. ZWNJ and ZWJ are allowed (Kurdish and Arabic spelling needs them). Returns the
 * trimmed text, or undefined.
 */
function cleanDisplayText(value: string): string | undefined {
  const text = value.trim();
  if (text.length === 0) {
    return undefined;
  }
  for (const character of text) {
    if (FORBIDDEN_CHARACTER.test(character)) {
      return undefined;
    }
    if (
      INVISIBLE_CHARACTER.test(character) &&
      character !== ZERO_WIDTH_NON_JOINER &&
      character !== ZERO_WIDTH_JOINER
    ) {
      return undefined;
    }
  }
  return text;
}

/**
 * Every character of a name form is one the form's script shows visibly, and there is at least one letter
 * [P] (OQ-158):
 *
 * - a letter whose Script_Extensions include the script (a Cyrillic look-alike in the Latin form fails);
 * - a non-spacing or spacing combining mark whose Script_Extensions include the script, directly after a
 *   letter or another mark (an Arabic shadda on a Latin name, a Latin accent on a Kurdish name, or a mark on
 *   a space fails);
 * - an ASCII digit, or a decimal digit of the script;
 * - punctuation of the Common script or of the form's script;
 * - U+0020 SPACE, never two in a row (HTML collapses them, so two would look like one);
 * - ZWNJ or ZWJ, in the Arabic-script forms only, directly after a letter or a mark.
 *
 * Anything else (another space such as U+00A0 or U+3000, a symbol such as U+2800 BRAILLE PATTERN BLANK, an
 * enclosing mark, a default-ignorable character) makes the form invalid: it could hide text, or make two
 * names that look the same compare as different.
 */
function nameCharactersAllowed(text: string, script: RegExp, joinersAllowed: boolean): boolean {
  let letters = 0;
  let previous: 'base' | 'space' | 'other' = 'other';
  for (const character of text) {
    if (LETTER.test(character)) {
      if (!script.test(character)) {
        return false;
      }
      letters += 1;
      previous = 'base';
    } else if (COMBINING_MARK.test(character)) {
      if (previous !== 'base' || !script.test(character)) {
        return false;
      }
    } else if (character === ' ') {
      if (previous === 'space') {
        return false;
      }
      previous = 'space';
    } else if (character === ZERO_WIDTH_NON_JOINER || character === ZERO_WIDTH_JOINER) {
      if (!joinersAllowed || previous !== 'base') {
        return false;
      }
      previous = 'other';
    } else if (DECIMAL_DIGIT.test(character)) {
      if (!ASCII_DIGIT.test(character) && !script.test(character)) {
        return false;
      }
      previous = 'other';
    } else if (PUNCTUATION.test(character)) {
      if (!COMMON_SCRIPT.test(character) && !script.test(character)) {
        return false;
      }
      previous = 'other';
    } else {
      return false;
    }
  }
  return letters > 0;
}

/**
 * A name form is valid when it is clean display text in its own script: the Kurdish and Arabic forms in
 * Arabic script, the Latin form in Latin script (nameCharactersAllowed). Digits and punctuation are allowed
 * (alias names such as "Trauma Zulu-17"). The text is put in Unicode normalisation form C first, so a
 * decomposed accented letter is checked, and shown, as the single letter it is canonically equal to.
 */
function parseNameFormText(form: NameForm, value: string): string | undefined {
  const text = cleanDisplayText(value)?.normalize('NFC');
  if (text === undefined) {
    return undefined;
  }
  const latin = form === 'latin';
  return nameCharactersAllowed(text, latin ? LATIN_SCRIPT : ARABIC_SCRIPT, !latin) ? text : undefined;
}

/** Patient ids and content codes: ASCII letters, digits and `.`, `_`, `:`, `-`, at most 128 characters [P]. */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** An MRN as stored, check digit included (not validated here: KA-033): ASCII letters, digits and inner hyphens [P]. */
const MRN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?$/;
/** A same-origin photo source: a root-relative path (not `//`), or an inline image data URL [P]. */
const PHOTO_PATH_PATTERN = /^\/(?![/\\])[A-Za-z0-9._~%/-]+$/;
const PHOTO_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const YEAR = /^(\d{4})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The precision a date of birth was recorded at (§11.2; §18.10 "DOB precision flags"). */
export type DatePrecision = 'day' | 'month' | 'year';

/**
 * True when the value is a Gregorian date written at exactly the given precision: `YYYY-MM-DD` for `day`,
 * `YYYY-MM` for `month`, `YYYY` for `year`; year 0001 to 9999, a real month and a real day of that month.
 * A partial date written with a placeholder day or month (`1990-01-01` recorded as year precision) does not
 * match, so a placeholder is never shown as if it were recorded (CTRL-0001-7).
 */
export function isDateAtPrecision(value: string, precision: DatePrecision): boolean {
  const pattern = precision === 'day' ? YEAR_MONTH_DAY : precision === 'month' ? YEAR_MONTH : YEAR;
  const match = pattern.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number.parseInt(match[1] ?? '', 10);
  if (year < 1) {
    return false;
  }
  if (precision === 'year') {
    return true;
  }
  const month = Number.parseInt(match[2] ?? '', 10);
  if (month < 1 || month > 12) {
    return false;
  }
  if (precision === 'month') {
    return true;
  }
  const day = Number.parseInt(match[3] ?? '', 10);
  return day >= 1 && day <= daysInMonth(year, month);
}

// ---------------------------------------------------------------------------------------------------------
// Schemas (strict: closed objects, no extra keys)
// ---------------------------------------------------------------------------------------------------------

const codeSchema = z.string().regex(CODE_PATTERN);
const labelTextSchema = z.string().refine((value) => cleanDisplayText(value) === value);
const calendarDateSchema = z.string().refine((value) => isDateAtPrecision(value, 'day'));

const governedLabelsSchema = z.strictObject({
  en: labelTextSchema.optional(),
  ckb: labelTextSchema.optional(),
  ar: labelTextSchema.optional(),
});

/** A coded concept from governed content (§3.4 item 3) with its labels in the UI languages it has. */
const governedConceptSchema = z.strictObject({ code: codeSchema, labels: governedLabelsSchema });

const allergyItemSchema = z.strictObject({
  substance: governedConceptSchema,
  reaction: governedConceptSchema.optional(),
  severity: governedConceptSchema.optional(),
});

/** Exactly one of three statuses; `nka` and `not-assessed` carry nothing else, so items make them invalid. */
export const allergiesSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('nka') }),
  z.strictObject({ status: z.literal('not-assessed') }),
  z.strictObject({ status: z.literal('list'), items: z.array(allergyItemSchema).min(1) }),
]);

export const photoSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('present'),
    src: z.string().refine((src) => PHOTO_PATH_PATTERN.test(src) || PHOTO_DATA_URL_PATTERN.test(src)),
  }),
  z.strictObject({ status: z.literal('absent') }),
]);

/** The name field's shape; each form is then parsed on its own, so one bad form does not hide the others. */
const nameSchema = z.strictObject({
  ckb: z.unknown().optional(),
  ar: z.unknown().optional(),
  latin: z.unknown().optional(),
  ownScript: z.unknown().optional(),
});
const nameFormSchema = z.enum(['ckb', 'ar', 'latin']);

export const dobSchema = z
  .strictObject({
    value: z.string(),
    precision: z.enum(['day', 'month', 'year']),
    approximate: z.boolean(),
  })
  .refine((dob) => isDateAtPrecision(dob.value, dob.precision));

export const codeStatusSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('documented'),
    concept: governedConceptSchema,
    recordedOn: calendarDateSchema,
  }),
  z.strictObject({ status: z.literal('not-documented') }),
]);

export const isolationSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('none-recorded') }),
  z.strictObject({ status: z.literal('active'), precautions: z.array(governedConceptSchema).min(1) }),
]);

export const weightSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('none-recorded') }),
  z.strictObject({
    status: z.literal('recorded'),
    value: z.string(),
    unit: z.literal('kg'),
    measuredOn: calendarDateSchema,
    source: z.enum(['measured', 'stated', 'estimated']),
  }),
]);

// ---------------------------------------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------------------------------------

export interface GovernedLabels {
  readonly en?: string;
  readonly ckb?: string;
  readonly ar?: string;
}

export interface GovernedConcept {
  readonly code: string;
  readonly labels: GovernedLabels;
}

export interface AllergyItem {
  readonly substance: GovernedConcept;
  readonly reaction?: GovernedConcept;
  readonly severity?: GovernedConcept;
}

/** The patient id or the MRN. */
export type IdentifierField =
  | { readonly status: 'valid'; readonly value: string }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' };

/** One name form; `missing` and `invalid` both show "<form> name missing" in the form's place. */
export type NameFormField =
  | { readonly status: 'valid'; readonly text: string }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' };

export interface BannerName {
  /** The script of the patient's own name; undefined when the data does not say or is invalid. */
  readonly ownScript: NameForm | undefined;
  readonly forms: Readonly<Record<NameForm, NameFormField>>;
  /** Display order: the own-script form first, then the others in NAME_FORMS order. */
  readonly order: readonly NameForm[];
  /** The forms that are missing or invalid; each is flagged on the banner. */
  readonly flaggedForms: readonly NameForm[];
  /**
   * True when the own-script form or the Latin form is not valid, or the own script is unknown: the banner
   * shows "Identity incomplete" (CTRL-0001-6 wording; DN-029). A missing third form is flagged only.
   */
  readonly identityIncomplete: boolean;
  /** At least one form is valid. When none is, the banner is in its error state. */
  readonly anyValid: boolean;
}

/** `absent` and `unavailable` both show "No photo", never an empty frame. */
export type PhotoField =
  | { readonly status: 'present'; readonly src: string }
  | { readonly status: 'absent' }
  | { readonly status: 'unavailable' };

export type DobField =
  | {
      readonly status: 'valid';
      /** The date at its recorded precision, Western digits: `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. */
      readonly value: string;
      readonly precision: DatePrecision;
      readonly approximate: boolean;
      /** Shown whenever the date is approximate or recorded to less than a day (CTRL-0001-7). */
      readonly showApproximateFlag: boolean;
    }
  /** "Date of birth missing". */
  | { readonly status: 'missing' }
  /** "Date of birth unavailable": the recorded value could not be read. */
  | { readonly status: 'unavailable' };

export type AllergiesField =
  | { readonly status: 'nka' }
  | { readonly status: 'not-assessed' }
  | { readonly status: 'list'; readonly items: readonly AllergyItem[] }
  /** "Allergy status unavailable": never NKA. */
  | { readonly status: 'unavailable' };

export type CodeStatusField =
  | { readonly status: 'documented'; readonly concept: GovernedConcept; readonly recordedOn: string }
  | { readonly status: 'not-documented' }
  | { readonly status: 'unavailable' };

export type IsolationField =
  | { readonly status: 'active'; readonly precautions: readonly GovernedConcept[] }
  | { readonly status: 'none-recorded' }
  | { readonly status: 'unavailable' };

export type WeightSource = 'measured' | 'stated' | 'estimated';

export type WeightField =
  | {
      readonly status: 'recorded';
      /** The weight and its unit for display, through ClinicalNumber's rules (always `valid` here). */
      readonly quantity: Extract<ClinicalQuantityDisplay, { status: 'valid' }>;
      readonly measuredOn: string;
      readonly source: WeightSource;
    }
  /** "No dated weight". */
  | { readonly status: 'none-recorded' }
  /** "Weight unavailable": invalid, undated, zero, negative or not a decimal. */
  | { readonly status: 'unavailable' };

/** The banner's view of one patient. It has no location field (rule 1). */
export interface BannerModel {
  readonly patientId: IdentifierField;
  readonly photo: PhotoField;
  readonly name: BannerName;
  readonly mrn: IdentifierField;
  readonly dob: DobField;
  readonly allergies: AllergiesField;
  readonly codeStatus: CodeStatusField;
  readonly isolation: IsolationField;
  readonly weight: WeightField;
  /**
   * The banner's error state, "Patient banner data unavailable": the patient id, the MRN or every name form
   * is missing or invalid. The route's clinical actions are disabled (rule 4; DN-032).
   */
  readonly errorState: boolean;
  /** "Identity incomplete": a missing own-script or Latin name form, or a missing or invalid date of birth. */
  readonly identityIncomplete: boolean;
  /** Signing is blocked: the error state, or a missing or invalid date of birth (rule 4; DN-032). */
  readonly signingBlocked: boolean;
}

/** The code-status and isolation codes the client knows; any other code makes its field unavailable (rule 6). */
export interface BannerVocabularies {
  readonly codeStatus: ReadonlySet<string>;
  readonly isolation: ReadonlySet<string>;
}

/**
 * SYNTHETIC SAMPLE ENTRIES, NOT FOR CLINICAL USE (§3.4 item 3; content request OQ-143; KA-033). They exist for
 * the WP-0.7 demo fixtures only and are replaced by governed vocabularies before any clinical use.
 */
export const SYNTHETIC_BANNER_VOCABULARIES: BannerVocabularies & { readonly provenance: 'synthetic' } = {
  provenance: 'synthetic',
  codeStatus: new Set(['SYN-CS-ATTEMPT-CPR', 'SYN-CS-NO-CPR']),
  isolation: new Set(['SYN-ISO-CONTACT', 'SYN-ISO-DROPLET', 'SYN-ISO-AIRBORNE']),
};

/** The unit display map used for the weight; only `kg` is accepted, so only its entry is read. */
const WEIGHT_UNIT_MAP: UnitDisplayMap = new Map([['kg', 'kg']]);

/**
 * Marks a part of the input that could not be copied as plain data. It is a symbol, which no schema accepts,
 * so the field that holds it shows its unavailable or invalid state.
 */
const UNREADABLE: unique symbol = Symbol('unreadable banner data');

/** Deeper than any banner field (input > allergies > items > item > substance > labels > label is 6). */
const MAX_DEPTH = 16;

type PlainData =
  string | number | boolean | null | undefined | typeof UNREADABLE | readonly PlainData[] | PlainRecord;

interface PlainRecord {
  readonly [key: string]: PlainData;
}

/**
 * Copies untrusted input into plain data, as JSON would hold it, before any schema reads it:
 *
 * - an object must have Object.prototype or no prototype; only its own enumerable data properties with
 *   string keys are copied, into an object with no prototype, so no inherited key can be read later;
 * - an array must be a plain array; each element is copied, and a hole reads as unreadable;
 * - a getter is never called: its property reads as unreadable;
 * - a class instance, a function, a symbol, a bigint, or anything deeper than MAX_DEPTH (a cycle) reads as
 *   unreadable.
 *
 * Never throws: a proxy whose traps throw makes its part unreadable.
 */
function toPlainData(value: unknown, depth = 0): PlainData {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'object' || depth >= MAX_DEPTH) {
    return UNREADABLE;
  }
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        return UNREADABLE;
      }
      const items: PlainData[] = [];
      for (let index = 0; index < value.length; index += 1) {
        items.push(ownDataValue(value, String(index), depth));
      }
      return items;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return UNREADABLE;
    }
    const copy = Object.create(null) as Record<string, PlainData>;
    for (const key of Object.keys(value)) {
      copy[key] = ownDataValue(value, key, depth);
    }
    return copy;
  } catch {
    return UNREADABLE;
  }
}

/** The plain copy of an own data property; a missing property (an array hole) or a getter is unreadable. */
function ownDataValue(object: object, key: string, depth: number): PlainData {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && 'value' in descriptor
    ? toPlainData(descriptor.value, depth + 1)
    : UNREADABLE;
}

function isPlainRecord(value: PlainData): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * An own property. The plain data has no prototype, but Zod's outputs are ordinary objects, so an optional
 * key that the input did not have is read through this too, never as `object[key]`.
 */
function own(object: object, key: string): unknown {
  return Object.hasOwn(object, key) ? (object as Readonly<Record<string, unknown>>)[key] : undefined;
}

function parseIdentifier(value: unknown, pattern: RegExp): IdentifierField {
  if (value === undefined || value === null) {
    return { status: 'missing' };
  }
  return typeof value === 'string' && pattern.test(value)
    ? { status: 'valid', value }
    : { status: 'invalid' };
}

function parseNameForm(form: NameForm, value: unknown): NameFormField {
  if (value === undefined || value === null) {
    return { status: 'missing' };
  }
  if (typeof value !== 'string') {
    return { status: 'invalid' };
  }
  const text = parseNameFormText(form, value);
  return text === undefined ? { status: 'invalid' } : { status: 'valid', text };
}

function parseName(value: unknown): BannerName {
  const shape = nameSchema.safeParse(value);
  let forms: Record<NameForm, NameFormField>;
  let ownScript: NameForm | undefined;
  if (shape.success) {
    forms = {
      ckb: parseNameForm('ckb', own(shape.data, 'ckb')),
      ar: parseNameForm('ar', own(shape.data, 'ar')),
      latin: parseNameForm('latin', own(shape.data, 'latin')),
    };
    const script = nameFormSchema.safeParse(own(shape.data, 'ownScript'));
    ownScript = script.success ? script.data : undefined;
  } else {
    // A name that is not a closed object of the expected keys: every form shows its state.
    const state: NameFormField =
      value === undefined || value === null ? { status: 'missing' } : { status: 'invalid' };
    forms = { ckb: state, ar: state, latin: state };
    ownScript = undefined;
  }
  const order =
    ownScript === undefined ? NAME_FORMS : [ownScript, ...NAME_FORMS.filter((form) => form !== ownScript)];
  const flaggedForms = order.filter((form) => forms[form].status !== 'valid');
  const identityIncomplete =
    ownScript === undefined || forms[ownScript].status !== 'valid' || forms.latin.status !== 'valid';
  return {
    ownScript,
    forms,
    order,
    flaggedForms,
    identityIncomplete,
    anyValid: NAME_FORMS.some((form) => forms[form].status === 'valid'),
  };
}

function parsePhoto(value: unknown): PhotoField {
  const parsed = photoSchema.safeParse(value);
  return parsed.success ? parsed.data : { status: 'unavailable' };
}

function parseDob(value: unknown): DobField {
  if (value === undefined || value === null) {
    return { status: 'missing' };
  }
  const parsed = dobSchema.safeParse(value);
  if (!parsed.success) {
    return { status: 'unavailable' };
  }
  const { value: date, precision, approximate } = parsed.data;
  return {
    status: 'valid',
    value: date,
    precision,
    approximate,
    showApproximateFlag: approximate || precision !== 'day',
  };
}

function toConcept(concept: z.infer<typeof governedConceptSchema>): GovernedConcept {
  const labels: { en?: string; ckb?: string; ar?: string } = {};
  for (const locale of BANNER_LOCALES) {
    const label = own(concept.labels, locale);
    if (typeof label === 'string') {
      labels[locale] = label;
    }
  }
  return { code: concept.code, labels };
}

/** CTRL-0016-4: anything but a valid nka, not-assessed or non-empty list is unavailable, never NKA. */
function parseAllergies(value: unknown): AllergiesField {
  const parsed = allergiesSchema.safeParse(value);
  if (!parsed.success) {
    return { status: 'unavailable' };
  }
  const allergies = parsed.data;
  switch (allergies.status) {
    case 'nka':
      return { status: 'nka' };
    case 'not-assessed':
      return { status: 'not-assessed' };
    case 'list':
      return {
        status: 'list',
        items: allergies.items.map((item) => {
          const reaction = Object.hasOwn(item, 'reaction') ? item.reaction : undefined;
          const severity = Object.hasOwn(item, 'severity') ? item.severity : undefined;
          return {
            substance: toConcept(item.substance),
            ...(reaction === undefined ? {} : { reaction: toConcept(reaction) }),
            ...(severity === undefined ? {} : { severity: toConcept(severity) }),
          };
        }),
      };
  }
}

function parseCodeStatus(value: unknown, known: ReadonlySet<string>): CodeStatusField {
  const parsed = codeStatusSchema.safeParse(value);
  if (!parsed.success) {
    return { status: 'unavailable' };
  }
  const codeStatus = parsed.data;
  if (codeStatus.status === 'not-documented') {
    return { status: 'not-documented' };
  }
  if (!known.has(codeStatus.concept.code)) {
    return { status: 'unavailable' };
  }
  return { status: 'documented', concept: toConcept(codeStatus.concept), recordedOn: codeStatus.recordedOn };
}

function parseIsolation(value: unknown, known: ReadonlySet<string>): IsolationField {
  const parsed = isolationSchema.safeParse(value);
  if (!parsed.success) {
    return { status: 'unavailable' };
  }
  const isolation = parsed.data;
  if (isolation.status === 'none-recorded') {
    return { status: 'none-recorded' };
  }
  if (!isolation.precautions.every((precaution) => known.has(precaution.code))) {
    return { status: 'unavailable' };
  }
  return { status: 'active', precautions: isolation.precautions.map(toConcept) };
}

/** A decimal weight greater than zero, judged by ClinicalNumber's character rules, never by arithmetic. */
function parseWeight(value: unknown): WeightField {
  const parsed = weightSchema.safeParse(value);
  if (!parsed.success) {
    return { status: 'unavailable' };
  }
  const weight = parsed.data;
  if (weight.status === 'none-recorded') {
    return { status: 'none-recorded' };
  }
  const number = formatClinicalNumber(weight.value);
  if (number.status !== 'valid' || number.negative || number.zero) {
    return { status: 'unavailable' };
  }
  const quantity = formatClinicalQuantity(weight.value, weight.unit, WEIGHT_UNIT_MAP);
  if (quantity.status !== 'valid') {
    return { status: 'unavailable' };
  }
  return { status: 'recorded', quantity, measuredOn: weight.measuredOn, source: weight.source };
}

/**
 * Parses untrusted banner data field by field, after copying it into plain data (toPlainData). Keys other
 * than the banner fields (a room, bed or location among them) are ignored. Never throws.
 */
export function parseBannerData(input: unknown, vocabularies: BannerVocabularies): BannerModel {
  const plain = toPlainData(input);
  const data: PlainRecord = isPlainRecord(plain) ? plain : (Object.create(null) as PlainRecord);
  const field = (key: string): unknown => own(data, key);
  const patientId = parseIdentifier(field('patientId'), CODE_PATTERN);
  const mrn = parseIdentifier(field('mrn'), MRN_PATTERN);
  const name = parseName(field('name'));
  const dob = parseDob(field('dob'));
  const errorState = patientId.status !== 'valid' || mrn.status !== 'valid' || !name.anyValid;
  return {
    patientId,
    photo: parsePhoto(field('photo')),
    name,
    mrn,
    dob,
    allergies: parseAllergies(field('allergies')),
    codeStatus: parseCodeStatus(field('codeStatus'), vocabularies.codeStatus),
    isolation: parseIsolation(field('isolation'), vocabularies.isolation),
    weight: parseWeight(field('weight')),
    errorState,
    identityIncomplete: name.identityIncomplete || dob.status !== 'valid',
    signingBlocked: errorState || dob.status !== 'valid',
  };
}

/** A governed label resolved for one UI locale (rule 6). */
export interface ResolvedLabel {
  /** The label, or the recorded code when no locale has one. Never empty. */
  readonly text: string;
  /** The language of `text`; `zxx` (no linguistic content) for a code. */
  readonly lang: BannerLocale | 'zxx';
  /** True when `text` is not in the user's locale: the banner shows "Not translated" beside it. */
  readonly untranslated: boolean;
}

/**
 * The label of a governed concept in the user's locale; otherwise the first available label in the order
 * en, ckb, ar [P], marked untranslated; otherwise the code itself, marked untranslated, so the concept (an
 * allergy above all) is never hidden.
 */
export function resolveGovernedLabel(concept: GovernedConcept, locale: BannerLocale): ResolvedLabel {
  const own = concept.labels[locale];
  if (own !== undefined) {
    return { text: own, lang: locale, untranslated: false };
  }
  for (const fallback of BANNER_LOCALES) {
    const label = concept.labels[fallback];
    if (label !== undefined) {
      return { text: label, lang: fallback, untranslated: true };
    }
  }
  return { text: concept.code, lang: 'zxx', untranslated: true };
}
