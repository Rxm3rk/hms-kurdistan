/**
 * The command palette's commands and its search (docs/specs/modules/design-system.md §2.4).
 *
 * Every visible word of a command comes from the catalogues: a command names a message key, and a patient
 * result is the patient's banner model, shown through the banner's PatientIdentity. WP-0.7 commands are
 * navigation, density, language and the demo fixtures (demo builds only); the application supplies them.
 *
 * Search matches every word of the query as a substring of the command's text, ignoring case and, for
 * Arabic-script text, the Arabic and Kurdish forms of ي/ی, ك/ک and ه/ە (sorani-letters.json), so a name
 * typed on an Arabic keyboard still finds the Sorani spelling. The folding is for matching only: what is
 * shown is always the stored text. It can only widen a search, never choose a result: nothing is ever
 * preselected (§2.4).
 */
import { SORANI_LETTERS, type MessageKey, type UiLocale } from '@hms/i18n';
import type { BannerModel } from '@hms/ui-core';

/** The palette's groups, in display order. */
export const PALETTE_GROUPS = ['navigation', 'patients', 'settings'] as const;
export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

export const PALETTE_GROUP_LABEL: Readonly<Record<PaletteGroup, MessageKey>> = {
  navigation: 'commandPalette.group.navigation',
  patients: 'commandPalette.group.patients',
  settings: 'commandPalette.group.settings',
};

/** A command: navigation, a setting, a demo fixture. */
export interface PaletteCommand {
  readonly kind: 'command';
  /** Unique among the palette's items. */
  readonly id: string;
  readonly group: Exclude<PaletteGroup, 'patients'>;
  readonly label: MessageKey;
  /** A second line, from the catalogues (the density or language it switches to), with its language. */
  readonly detail?: { readonly key: MessageKey; readonly lang?: UiLocale };
  /** Runs after the palette has closed, so a command may open a dialog of its own. */
  readonly run: () => void;
}

/**
 * A patient result. Choosing it closes the palette and only then calls `open`, which requests the patient
 * from the window's patient context (SelectPatient); the switch confirmation, if any, opens after the
 * palette has closed (§2.4, §2.2).
 */
export interface PalettePatient {
  readonly kind: 'patient';
  readonly id: string;
  readonly banner: BannerModel;
  readonly open: () => void;
}

export type PaletteItem = PaletteCommand | PalettePatient;

export function paletteItemGroup(item: PaletteItem): PaletteGroup {
  return item.kind === 'patient' ? 'patients' : item.group;
}

/** The text a patient result is found by: every valid name form, the MRN and the date of birth. */
export function patientSearchText(banner: BannerModel): string {
  const parts: string[] = [];
  for (const form of banner.name.order) {
    const field = banner.name.forms[form];
    if (field.status === 'valid') {
      parts.push(field.text);
    }
  }
  if (banner.mrn.status === 'valid') {
    parts.push(banner.mrn.value);
  }
  if (banner.dob.status === 'valid') {
    parts.push(banner.dob.value);
  }
  return parts.join(' ');
}

const LETTER_FOLDS: ReadonlyMap<string, string> = new Map(
  SORANI_LETTERS.pairs.map((pair) => [pair.arabic.char, pair.kurdish.char]),
);

/** Text folded for matching only: NFC, lower case, Arabic letter forms to their Kurdish forms. */
export function foldForSearch(text: string): string {
  let folded = '';
  for (const char of text.normalize('NFC').toLowerCase()) {
    folded += LETTER_FOLDS.get(char) ?? char;
  }
  return folded;
}

/** Every word of the query occurs in the text (after folding). An empty query matches everything. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = foldForSearch(text);
  return foldForSearch(query)
    .split(/\s+/u)
    .filter((word) => word.length > 0)
    .every((word) => haystack.includes(word));
}

const LANGUAGE_ENDONYM: Readonly<Record<UiLocale, MessageKey>> = {
  en: 'language.en.endonym',
  ckb: 'language.ckb.endonym',
  ar: 'language.ar.endonym',
};

/** "Change language" commands, one per other UI locale, each showing that language's own name. */
export function languageCommands(
  current: UiLocale,
  locales: readonly UiLocale[],
  setLocale: (locale: UiLocale) => void,
): PaletteCommand[] {
  return locales
    .filter((locale) => locale !== current)
    .map((locale) => ({
      kind: 'command',
      id: `settings.language.${locale}`,
      group: 'settings',
      label: 'commandPalette.command.changeLanguage',
      detail: { key: LANGUAGE_ENDONYM[locale], lang: locale },
      run: () => {
        setLocale(locale);
      },
    }));
}
