/**
 * The "NOT FOR CLINICAL USE" watermark of demo builds (BUILD-PROMPT.md §3.3, §18.10;
 * docs/specs/modules/design-system.md §5).
 *
 * A fixed, non-interactive band at the end edge of the viewport, on every screen of a demo build and so in
 * every screenshot of one. It reads "NOT FOR CLINICAL USE" in English in every locale (the plan's label) and,
 * in Sorani and Arabic, the locale's translation beside it (`demo.watermark`), each with its own `lang`.
 * The text is opaque on its own surface, so it keeps its contrast and never lowers the contrast of the
 * content (the page leaves room for the band at its end).
 */
import { Bdi, Message } from '@hms/design-system';
import { CATALOGUES, LOCALES, type UiLocale } from '@hms/i18n';
import type { ReactNode } from 'react';

export function DemoWatermark({ locale }: { readonly locale: UiLocale }): ReactNode {
  return (
    <aside className="hms-demo-watermark" data-testid="demo-watermark">
      <Bdi dir="ltr" lang={LOCALES.en.tag}>
        {CATALOGUES.en['demo.watermark']}
      </Bdi>
      {locale === 'en' ? null : (
        <span lang={LOCALES[locale].tag}>
          <Message id="demo.watermark" />
        </span>
      )}
    </aside>
  );
}
