/**
 * The review status of each translated message (decision DN-021; KA-031; content request OQ-151).
 *
 * The `ckb` and `ar` messages are drafts written by the build agent; none has had the clinician review that
 * hospital use needs. `messages/review/<locale>.json` holds one status per message and the localisation
 * lint keeps it complete (lint/review-marking.ts). A screen or a piece of evidence can ask here whether the
 * text it shows is reviewed.
 */
import ar from './messages/review/ar.json' with { type: 'json' };
import ckb from './messages/review/ckb.json' with { type: 'json' };
import type { MessageKey } from './catalogues.ts';
import { SOURCE_LOCALE, type UiLocale } from './locales.ts';
import { REVIEW_STATUSES, type ReviewStatus } from './lint/review-marking.ts';

export { REVIEW_STATUSES, type ReviewStatus } from './lint/review-marking.ts';

/** The UI locales translated from the source locale. */
export type TranslatedLocale = Exclude<UiLocale, typeof SOURCE_LOCALE>;

/** Typed by the message keys, so type checking also fails if a review file lacks a key. */
export const TRANSLATION_REVIEW: Readonly<Record<TranslatedLocale, Readonly<Record<MessageKey, string>>>> = {
  ckb,
  ar,
};

/**
 * The review status of a message: `source` for the source locale, otherwise the recorded status. A status
 * this code does not know counts as `unreviewed`, so text is never treated as reviewed by mistake.
 */
export function reviewStatus(locale: UiLocale, key: MessageKey): ReviewStatus | 'source' {
  if (locale === SOURCE_LOCALE) {
    return 'source';
  }
  const status = TRANSLATION_REVIEW[locale][key];
  return (REVIEW_STATUSES as readonly string[]).includes(status) ? (status as ReviewStatus) : 'unreviewed';
}
