/**
 * Patient search and identity matching for the patients and outpatient screens: a simple, explainable,
 * normalised contains-match over the synthetic data (no index, no server).
 *
 * Normalisation, in two tiers:
 * - exact: the design system's `foldForSearch` (NFC, lower case, Arabic letter forms to their Kurdish forms),
 *   Eastern Arabic digits to 0-9, Arabic diacritics and tatweel removed, Latin accents removed;
 * - loose ("similar spelling"): on top of that, Kurdish-only letters to the Arabic keyboard's letters
 *   (ڕ→ر, ڵ→ل, ێ→ی, ۆ→و, ە dropped, گ→ک, پ→ب, چ→ج, ژ→ز, ڤ→ف, hamza seats dropped) and, for Latin, a
 *   consonant skeleton (Rasheed = Rashid, Mohammed = Muhammad), repeated letters collapsed.
 *
 * Identifiers: the MRN and national ID compare without spaces or hyphens; phone numbers compare in the local
 * form (+964 750 000 0101, 0750 000 0101 and 7500000101 are the same); dates of birth parse from
 * DD/MM/YYYY, YYYY-MM-DD or a year.
 */
import { foldForSearch } from './stub-ds.ts';
import { DEMO_TODAY, type NameScript, type Patient, type PersonName } from './stub-data.ts';

const NAME_FORMS: readonly NameScript[] = ['ckb', 'ar', 'latin'];

/** Eastern Arabic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to 0-9. */
export function latinDigits(text: string): string {
  return text
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

const ARABIC_MARKS = /[ً-ْٰـ]/gu;
const LATIN_LETTER = /[A-Za-zÀ-ɏḀ-ỿ]/gu;

/** The exact tier: what the patient picker and command palette match on, plus digits and accents. */
export function foldText(text: string): string {
  const unaccented = latinDigits(text).replace(LATIN_LETTER, (letter) => letter.normalize('NFD').replace(/[̀-ͯ]/gu, ''));
  return foldForSearch(unaccented).replace(ARABIC_MARKS, '').replace(/[‌‍]/gu, '').replace(/\s+/gu, ' ').trim();
}

const LOOSE_ARABIC: Readonly<Record<string, string>> = {
  'ڕ': 'ر',
  'ڵ': 'ل',
  'ێ': 'ی',
  'ي': 'ی',
  'ى': 'ی',
  'ۆ': 'و',
  'ؤ': 'و',
  'ە': '',
  'ة': '',
  'ھ': '',
  'ه': '',
  'ك': 'ک',
  'گ': 'ک',
  'پ': 'ب',
  'چ': 'ج',
  'ژ': 'ز',
  'ڤ': 'ف',
  'ئ': '',
  'ء': '',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
};

function collapseRepeats(text: string): string {
  return text.replace(/(.)\1+/gu, '$1');
}

/** The loose tier of one word (already exact-folded). */
export function looseWord(word: string): string {
  if (/[a-z]/u.test(word)) {
    const skeleton = word
      .replace(/[^a-z]/gu, '')
      .replace(/ph/gu, 'f')
      .replace(/kh/gu, 'x')
      .replace(/gh/gu, 'g')
      .replace(/q/gu, 'k')
      .replace(/[aeiou]/gu, '');
    return collapseRepeats(skeleton);
  }
  let out = '';
  for (const char of word) {
    out += LOOSE_ARABIC[char] ?? char;
  }
  return collapseRepeats(out.replace(/[^\p{L}\p{N}]/gu, ''));
}

function words(folded: string): string[] {
  return folded.split(/[\s\-–'’.,]+/u).filter((word) => word.length > 0);
}

/** MRN and national ID without spaces, hyphens or case. */
export function compactId(text: string): string {
  return latinDigits(text).toUpperCase().replace(/[^A-Z0-9]/gu, '');
}

/** A phone number in its local form: digits only, without +964 / 00964 and the trunk 0. */
export function localPhone(text: string): string {
  let digits = latinDigits(text).replace(/\D/gu, '');
  if (digits.startsWith('00964')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('964')) {
    digits = digits.slice(3);
  }
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

/** An Iraqi mobile number in the international display form, or null when it is not one. */
export function formatIraqiMobile(text: string): string | null {
  const local = localPhone(text);
  if (!/^7\d{9}$/u.test(local)) {
    return null;
  }
  return `+964 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export interface ParsedDob {
  /** `YYYY-MM-DD`, or `YYYY` for a year only. */
  readonly iso: string;
  readonly precision: 'day' | 'year';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

/** Parses a date of birth typed as DD/MM/YYYY (also - or .), YYYY-MM-DD, or a year; null when invalid or in the future. */
export function parseDob(text: string): ParsedDob | null {
  const value = latinDigits(text).trim();
  let year: number;
  let month: number;
  let day: number;
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/u.exec(value);
  const ymd = /^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/u.exec(value);
  const yearOnly = /^(\d{4})$/u.exec(value);
  if (dmy !== null) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd !== null) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else if (yearOnly !== null) {
    year = Number(yearOnly[1]);
    const thisYear = Number(DEMO_TODAY.slice(0, 4));
    return year >= 1900 && year <= thisYear ? { iso: String(year), precision: 'year' } : null;
  } else {
    return null;
  }
  if (year < 1900 || !validDay(year, month, day)) {
    return null;
  }
  const iso = `${String(year)}-${pad2(month)}-${pad2(day)}`;
  return iso > DEMO_TODAY ? null : { iso, precision: 'day' };
}

/** True when a typed date of birth fits the record (a year-only record matches any date in that year). */
export function dobFits(parsed: ParsedDob, patient: Patient): boolean {
  const recordYear = patient.dob.slice(0, 4);
  if (patient.dobPrecision !== 'day' || parsed.precision === 'year') {
    return parsed.iso.slice(0, 4) === recordYear;
  }
  return parsed.iso === patient.dob;
}

// ---------------------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------------------

export type MatchKind = 'mrn' | 'phone' | 'nid' | 'dob' | 'name' | 'similar';

export interface SearchHit {
  readonly patient: Patient;
  readonly kind: MatchKind;
  /** For name matches: the name forms that matched. */
  readonly forms: readonly NameScript[];
  readonly score: number;
}

interface Prepared {
  readonly patient: Patient;
  readonly folded: Readonly<Record<NameScript, string>>;
  readonly loose: Readonly<Record<NameScript, readonly string[]>>;
  readonly mrn: string;
  readonly nid: string;
  readonly phone: string;
}

const prepared = new WeakMap<Patient, Prepared>();

function prepare(patient: Patient): Prepared {
  const cached = prepared.get(patient);
  if (cached !== undefined) {
    return cached;
  }
  const folded = {
    ckb: foldText(patient.name.ckb),
    ar: foldText(patient.name.ar),
    latin: foldText(patient.name.latin),
  };
  const entry: Prepared = {
    patient,
    folded,
    loose: {
      ckb: words(folded.ckb).map(looseWord),
      ar: words(folded.ar).map(looseWord),
      latin: words(folded.latin).map(looseWord),
    },
    mrn: compactId(patient.mrn),
    nid: compactId(patient.nationalId),
    phone: localPhone(patient.phone),
  };
  prepared.set(patient, entry);
  return entry;
}

type WordMatch =
  | { readonly kind: 'name'; readonly forms: readonly NameScript[] }
  | { readonly kind: 'similar'; readonly forms: readonly NameScript[] }
  | { readonly kind: 'mrn' | 'phone' | 'nid' | 'dob' };

function matchIdentifier(entry: Prepared, raw: string): WordMatch | null {
  const compact = compactId(raw);
  const dob = parseDob(raw);
  if (dob !== null && dobFits(dob, entry.patient) && (dob.precision === 'day' || compact.length === 4)) {
    return { kind: 'dob' };
  }
  if (compact.length >= 3 && entry.mrn.includes(compact)) {
    return { kind: 'mrn' };
  }
  const phone = localPhone(raw);
  if (phone.length >= 4 && entry.phone.includes(phone)) {
    return { kind: 'phone' };
  }
  if (compact.length >= 4 && entry.nid.includes(compact)) {
    return { kind: 'nid' };
  }
  return null;
}

function matchWord(entry: Prepared, word: string): WordMatch | null {
  if (/\d/u.test(word)) {
    return matchIdentifier(entry, word);
  }
  const exact = NAME_FORMS.filter((form) => entry.folded[form].includes(word));
  if (exact.length > 0) {
    return { kind: 'name', forms: exact };
  }
  const loose = looseWord(word);
  if (loose.length >= 3 || (loose.length >= 2 && word.length >= 4)) {
    const similar = NAME_FORMS.filter((form) => entry.loose[form].some((nameWord) => nameWord.startsWith(loose)));
    if (similar.length > 0) {
      return { kind: 'similar', forms: similar };
    }
  }
  if (word.startsWith('syn')) {
    return matchIdentifier(entry, word);
  }
  return null;
}

const KIND_SCORE: Readonly<Record<MatchKind, number>> = { mrn: 5, phone: 4, nid: 4, dob: 3, name: 3, similar: 1 };

/** Searches the patients; an empty query finds nothing. Best matches first. */
export function searchPatients(patients: readonly Patient[], query: string): SearchHit[] {
  const trimmed = latinDigits(query).trim();
  if (trimmed.length === 0) {
    return [];
  }
  // A query of digits (with spaces, + or -, optionally after SYN- or SYN-NID-) is one identifier: an MRN, a
  // national ID, a date of birth or a phone number typed in groups.
  const identifierOnly = /^(syn[-\s]?(nid[-\s]?)?)?[+\d][\d\s\-/.]*$/iu.test(trimmed);
  const queryWords = identifierOnly ? [trimmed] : foldText(trimmed).split(' ').filter((word) => word.length > 0);
  const hits: SearchHit[] = [];
  for (const patient of patients) {
    const entry = prepare(patient);
    const matches: WordMatch[] = [];
    let ok = true;
    for (const word of queryWords) {
      const match = identifierOnly ? matchIdentifier(entry, word) : matchWord(entry, word);
      if (match === null) {
        ok = false;
        break;
      }
      matches.push(match);
    }
    if (!ok || matches.length === 0) {
      continue;
    }
    const identifier = matches.find((match) => match.kind !== 'name' && match.kind !== 'similar');
    const anySimilar = matches.some((match) => match.kind === 'similar');
    const kind: MatchKind = identifier !== undefined ? identifier.kind : anySimilar ? 'similar' : 'name';
    const formSets = matches.flatMap((match) => ('forms' in match ? [match.forms] : []));
    const forms = NAME_FORMS.filter((form) => formSets.length > 0 && formSets.every((set) => set.includes(form)));
    const score = matches.reduce((sum, match) => sum + KIND_SCORE[match.kind], 0) / matches.length;
    hits.push({ patient, kind, forms: forms.length > 0 ? forms : formSets[0] ?? [], score });
  }
  return hits.toSorted((a, b) => b.score - a.score || a.patient.name.latin.localeCompare(b.patient.name.latin));
}

// ---------------------------------------------------------------------------------------------------------
// Duplicate check (registration)
// ---------------------------------------------------------------------------------------------------------

export interface DraftIdentity {
  readonly name: PersonName;
  readonly dob: ParsedDob | null;
}

export interface DuplicateReport {
  /** Same name (any form, exactly or by similar spelling) and the same date of birth. */
  readonly duplicates: readonly Patient[];
  /** Same full name, or the same first and father's names, with another date of birth. */
  readonly similarNames: readonly Patient[];
}

function sameName(entry: Prepared, draft: PersonName): 'exact' | 'similar' | 'partial' | null {
  let best: 'exact' | 'similar' | 'partial' | null = null;
  for (const form of NAME_FORMS) {
    const typed = foldText(draft[form]);
    if (typed.length === 0) {
      continue;
    }
    if (typed === entry.folded[form]) {
      return 'exact';
    }
    const typedLoose = words(typed).map(looseWord);
    const record = entry.loose[form];
    if (typedLoose.length === record.length && typedLoose.every((word, index) => word === record[index])) {
      best = 'similar';
    } else if (best === null && typedLoose.length >= 2 && record.length >= 2 && typedLoose[0] === record[0] && typedLoose[1] === record[1]) {
      best = 'partial';
    }
  }
  return best;
}

export function findDuplicates(patients: readonly Patient[], draft: DraftIdentity): DuplicateReport {
  const duplicates: Patient[] = [];
  const similarNames: Patient[] = [];
  for (const patient of patients) {
    const match = sameName(prepare(patient), draft.name);
    if (match === null) {
      continue;
    }
    const sameDob = draft.dob !== null && dobFits(draft.dob, patient);
    if (sameDob && (match === 'exact' || match === 'similar')) {
      duplicates.push(patient);
    } else {
      similarNames.push(patient);
    }
  }
  return { duplicates, similarNames: similarNames.slice(0, 4) };
}

// ---------------------------------------------------------------------------------------------------------
// Three-part identification (outpatient check-in)
// ---------------------------------------------------------------------------------------------------------

export type NameCheck =
  | { readonly status: 'empty' }
  | { readonly status: 'match'; readonly form: NameScript; readonly variant: boolean }
  /** The words given match the start of the name, but the full name (grandfather's name) is missing. */
  | { readonly status: 'partial'; readonly form: NameScript }
  /** The first names match but a later name differs: a possible look-alike patient. */
  | { readonly status: 'differs'; readonly form: NameScript }
  | { readonly status: 'mismatch' };

export function checkName(patient: Patient, typed: string): NameCheck {
  const folded = foldText(typed);
  if (folded.length === 0) {
    return { status: 'empty' };
  }
  const entry = prepare(patient);
  const typedWords = words(folded);
  const typedLoose = typedWords.map(looseWord);
  let partial: NameScript | null = null;
  let differs: NameScript | null = null;
  for (const form of NAME_FORMS) {
    if (folded === entry.folded[form]) {
      return { status: 'match', form, variant: false };
    }
    const record = entry.loose[form];
    if (typedLoose.length === record.length && typedLoose.every((word, index) => word === record[index])) {
      return { status: 'match', form, variant: true };
    }
    const prefix = typedLoose.length < record.length && typedLoose.every((word, index) => word === record[index]);
    if (prefix) {
      partial ??= form;
    } else if (typedLoose.length >= 2 && typedLoose[0] === record[0] && typedLoose[1] === record[1]) {
      differs ??= form;
    }
  }
  if (differs !== null) {
    return { status: 'differs', form: differs };
  }
  if (partial !== null) {
    return { status: 'partial', form: partial };
  }
  return { status: 'mismatch' };
}

export type DobCheck =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid' }
  | { readonly status: 'match'; readonly yearOnly: boolean }
  | { readonly status: 'mismatch' };

export function checkDob(patient: Patient, typed: string): DobCheck {
  if (typed.trim().length === 0) {
    return { status: 'empty' };
  }
  const parsed = parseDob(typed);
  if (parsed === null) {
    return { status: 'invalid' };
  }
  if (patient.dobPrecision === 'day' && parsed.precision === 'year') {
    return { status: 'invalid' };
  }
  return dobFits(parsed, patient) ? { status: 'match', yearOnly: patient.dobPrecision !== 'day' } : { status: 'mismatch' };
}

export type IdentifierMode = 'mrn' | 'phone';

export type IdentifierCheck = { readonly status: 'empty' } | { readonly status: 'match' } | { readonly status: 'mismatch' };

export function checkIdentifier(patient: Patient, mode: IdentifierMode, typed: string): IdentifierCheck {
  if (typed.trim().length === 0) {
    return { status: 'empty' };
  }
  if (mode === 'mrn') {
    const compact = compactId(typed);
    const record = compactId(patient.mrn);
    // The MRN with or without the SYN- prefix.
    return compact === record || `SYN${compact}` === record ? { status: 'match' } : { status: 'mismatch' };
  }
  return localPhone(typed) === localPhone(patient.phone) ? { status: 'match' } : { status: 'mismatch' };
}
