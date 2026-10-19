/**
 * Workspace wiring for @hms/design-system (slice S1): the package loads, React renders into jsdom with
 * React Testing Library, react-intl formats a catalogue message from @hms/i18n, and the bundled font
 * packages resolve.
 */
import { createRequire } from 'node:module';
import { CATALOGUES } from '@hms/i18n';
import { render, screen } from '@testing-library/react';
import { IntlProvider, FormattedMessage } from 'react-intl';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('design-system workspace wiring', () => {
  // A dynamic import inside the test, so that an entry point that throws while loading fails this test.
  it('imports the package entry point without error', async () => {
    await expect(import('../src/index.ts')).resolves.toBeTypeOf('object');
  });

  it('renders a catalogue message through react-intl in jsdom', () => {
    render(
      <IntlProvider locale="ckb" messages={CATALOGUES.ckb}>
        <p data-testid="smoke">
          <FormattedMessage id="language.ckb.endonym" />
        </p>
      </IntlProvider>,
    );
    expect(screen.getByTestId('smoke')).toHaveTextContent(CATALOGUES.ckb['language.ckb.endonym']);
  });

  it('resolves the bundled font packages', () => {
    expect(require.resolve('@fontsource/noto-sans-arabic/400.css')).toMatch(/noto-sans-arabic/);
    expect(require.resolve('@fontsource/noto-sans/400.css')).toMatch(/noto-sans/);
  });
});
