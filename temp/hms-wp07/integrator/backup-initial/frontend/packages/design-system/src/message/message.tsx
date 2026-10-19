/**
 * `Message`: a catalogue message rendered as JSX (BUILD-PROMPT.md §6.5 "Missing keys fail the build for
 * clinical paths"; docs/specs/modules/design-system.md §2.9).
 *
 * The key is typed against the `en` catalogue, so a misspelt key fails type checking. A key that is missing
 * from the active catalogue at run time is shown as the key itself, in a visible error style
 * (`hms-message-missing`), and react-intl reports it through `LocaleProvider`'s `onMessageError` with the
 * error code and the key only. It is never shown as an empty string. The key is isolated left to right,
 * because a key is ASCII and may sit in right-to-left text.
 *
 * Text that is not JSX (an `aria-label`, a `title`, any `intl.formatMessage` result) cannot carry a style:
 * there a missing key is still shown as the key and reported, but in plain text (KA-039).
 */
import type { MessageKey } from '@hms/i18n';
import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Bdi } from '../bdi/bdi.tsx';

/** Values for the message's placeholders: text, numbers, dates or elements (`Bdi`, `ClinicalNumber`). */
export type MessageValues = Readonly<Record<string, ReactNode | Date>>;

export interface MessageProps {
  readonly id: MessageKey;
  readonly values?: MessageValues;
}

export function Message({ id, values }: MessageProps): ReactNode {
  const { messages } = useIntl();
  const message =
    values === undefined ? <FormattedMessage id={id} /> : <FormattedMessage id={id} values={values} />;
  if (Object.hasOwn(messages, id)) {
    return message;
  }
  return (
    <Bdi dir="ltr" className="hms-message-missing">
      {message}
    </Bdi>
  );
}
