/**
 * `PatientChooser`: a list of patients to open (docs/specs/modules/design-system.md §2.1 rule 3, §2.2, §4).
 *
 * Each patient is shown with the banner's PatientIdentity: the photo, every name form, the MRN and the date
 * of birth, wrapped and never truncated, so two patients whose long names differ only in the grandfather's
 * name never look alike. Built on React Aria's GridList (§6.5): arrow keys move between patients, Enter or a
 * press opens one. Nothing is selected or opened by default (§6.5 "defaults never select a patient").
 *
 * Choosing a patient only requests it: `onChoose` puts the patient id in the address, and the clinical layout
 * passes the request to the window's patient context, which asks for confirmation when another patient is
 * open (§2.2).
 */
import type { MessageKey } from '@hms/i18n';
import { PatientIdentity, patientSearchText, messageKey } from '@hms/design-system';
import type { ReactNode } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { useIntl } from 'react-intl';
import type { PatientListEntry } from './directory.ts';

export interface PatientChooserProps {
  readonly entries: readonly PatientListEntry[];
  /** The list's accessible name. */
  readonly label: MessageKey;
  readonly onChoose: (patientId: string) => void;
}

export function PatientChooser({ entries, label, onChoose }: PatientChooserProps): ReactNode {
  const intl = useIntl();
  return (
    <GridList
      className="hms-patient-chooser"
      aria-label={intl.formatMessage({ id: messageKey(label) })}
      items={entries}
      selectionMode="none"
      onAction={(key) => {
        onChoose(String(key));
      }}
    >
      {(entry) => (
        <GridListItem
          id={entry.patientId}
          className="hms-patient-chooser__item"
          textValue={patientSearchText(entry.identity)}
        >
          <PatientIdentity model={entry.identity} />
        </GridListItem>
      )}
    </GridList>
  );
}
