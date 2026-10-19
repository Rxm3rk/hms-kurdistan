/**
 * Typed message keys. react-intl types a message id as any string; passing ids through `messageKey` makes
 * type checking fail when a key is not in the `en` catalogue, so a misspelt or missing key is found before
 * run time (BUILD-PROMPT.md §6.5 "Missing keys fail the build for clinical paths").
 */
import type { MessageKey } from '@hms/i18n';

export function messageKey<K extends MessageKey>(key: K): K {
  return key;
}
