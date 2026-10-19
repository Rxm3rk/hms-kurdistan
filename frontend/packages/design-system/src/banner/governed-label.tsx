/**
 * A governed label on the banner (docs/specs/modules/design-system.md §2.1 rule 6): a code-status,
 * isolation or allergy label from governed content, never a catalogue key.
 *
 * The label is shown in the user's UI locale when governed content has it. Otherwise ui-core's
 * resolveGovernedLabel gives another locale's label, or the recorded code when no locale has one, and the
 * banner shows "Not translated" beside it, so a label is never empty and an allergy is never hidden. The
 * text is isolated in `Bdi` with its own `lang` and direction (rule 5).
 */
import { textDirection } from '@hms/i18n';
import { resolveGovernedLabel, type BannerLocale, type GovernedConcept } from '@hms/ui-core';
import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Bdi, type BdiDirection } from '../bdi/bdi.tsx';
import { BannerStatus } from './banner-status.tsx';

/**
 * The banner locale of the active `LocaleProvider`, read from react-intl's locale tag
 * (`ckb-u-ca-gregory-nu-latn` → `ckb`). A tag of another language reads as `en`, the source locale [P]
 * (OQ-161); it only decides which governed labels count as translated.
 */
export function useBannerLocale(): BannerLocale {
  const { locale } = useIntl();
  let language: string;
  try {
    language = new Intl.Locale(locale).language;
  } catch {
    return 'en';
  }
  return language === 'ckb' || language === 'ar' ? language : 'en';
}

/** The direction of a label's text: its locale's, or left to right for a code (`zxx`). */
function labelDirection(lang: BannerLocale | 'zxx'): BdiDirection {
  return lang === 'zxx' ? 'ltr' : textDirection(lang);
}

export interface GovernedLabelProps {
  readonly concept: GovernedConcept;
}

export function GovernedLabel({ concept }: GovernedLabelProps): ReactNode {
  const locale = useBannerLocale();
  const label = resolveGovernedLabel(concept, locale);
  return (
    <span className="hms-governed-label" data-untranslated={label.untranslated}>
      <Bdi dir={labelDirection(label.lang)} lang={label.lang}>
        {label.text}
      </Bdi>
      {label.untranslated ? <BannerStatus status="label.untranslated" /> : null}
    </span>
  );
}
