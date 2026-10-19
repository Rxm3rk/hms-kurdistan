/**
 * `Message` (docs/specs/modules/design-system.md §2.9): a catalogue message in JSX. A key missing from the
 * active catalogue at run time is shown as the key in a visible error style, isolated left to right, never as
 * an empty string, and reported with the error code and the key only. `ClinicalNumber`'s markers and the
 * modal stack's announcement render through it.
 */
import { CATALOGUES, type MessageKey } from '@hms/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClinicalNumber, LocaleProvider, Message, type MessageErrorReport } from '../src/index.ts';

/** The ckb catalogue without one key, as a catalogue shipped out of step would be. */
function without(key: MessageKey): Record<string, string> {
  return Object.fromEntries(Object.entries(CATALOGUES.ckb).filter(([k]) => k !== key));
}

describe('Message', () => {
  it('renders a catalogue message as plain text, without the error style', () => {
    render(
      <LocaleProvider locale="ckb">
        <p data-testid="message">
          <Message id="clinical.value.missing" />
        </p>
      </LocaleProvider>,
    );
    const message = screen.getByTestId('message');
    expect(message).toHaveTextContent(CATALOGUES.ckb['clinical.value.missing']);
    expect(message.querySelector('.hms-message-missing')).toBeNull();
  });

  it('shows a key missing at run time as the key, in the error style, isolated, and reports it', () => {
    const reports: MessageErrorReport[] = [];
    const key = 'clinical.number.invalid';
    render(
      <LocaleProvider locale="ckb" messages={without(key)} onMessageError={(report) => reports.push(report)}>
        <p data-testid="message">
          <Message id={key} values={{ name: 'SYN-PATIENT' }} />
        </p>
      </LocaleProvider>,
    );
    const shown = screen.getByTestId('message').querySelector('.hms-message-missing');
    expect(shown).not.toBeNull();
    expect(shown?.tagName).toBe('BDI');
    expect(shown).toHaveAttribute('dir', 'ltr');
    expect(shown).toHaveTextContent(key);
    expect(reports).toContainEqual({ code: 'MISSING_TRANSLATION', key, locale: 'ckb' });
    expect(JSON.stringify(reports)).not.toContain('SYN-PATIENT');
  });

  it("shows ClinicalNumber's marker in the error style when its key is missing", () => {
    render(
      <LocaleProvider
        locale="ckb"
        messages={without('clinical.number.invalid')}
        onMessageError={() => undefined}
      >
        <p data-testid="value">
          <ClinicalNumber value="1e3" />
        </p>
      </LocaleProvider>,
    );
    const shown = screen.getByTestId('value').querySelector('.hms-message-missing');
    expect(shown).toHaveTextContent('clinical.number.invalid');
  });
});
