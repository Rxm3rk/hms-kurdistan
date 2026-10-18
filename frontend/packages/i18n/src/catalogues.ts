/**
 * The UI message catalogues: flat maps from a message key to an ICU MessageFormat string (BUILD-PROMPT.md
 * §6.5). Every user-facing string comes from here; hms/no-jsx-literals bans string literals in JSX.
 *
 * WP-0.1 holds only non-clinical shell keys: the product name, kept in Latin script in every catalogue, and
 * each UI language's name for itself (its endonym), which a language picker shows unchanged in every
 * locale. Translated and clinical strings arrive with the screens that need them and need clinician review
 * before release [HUMAN] (§11.1, §18.9).
 */
import ar from './messages/ar.json' with { type: 'json' };
import ckb from './messages/ckb.json' with { type: 'json' };
import en from './messages/en.json' with { type: 'json' };
import type { UiLocale } from './locales.ts';

/** A message key: a key of the source catalogue. The localisation lint keeps the other catalogues in step. */
export type MessageKey = keyof typeof en;

export type Catalogue = Readonly<Record<MessageKey, string>>;

/** Typed as Catalogue, so type checking also fails if ckb or ar lacks a key of en. */
export const CATALOGUES: Readonly<Record<UiLocale, Catalogue>> = { en, ckb, ar };
