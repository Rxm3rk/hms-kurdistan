/**
 * PatientPicker: the friendly patient chooser (search, a filter and the list), shown in place of a
 * patient-scoped screen when no patient is open, and inside the "Choose a patient" dialog.
 *
 * Each patient is shown with the design system's PatientIdentity (photo, every name form, MRN, date of
 * birth: wrapped, never truncated), plus where they are today and their allergy and isolation flags.
 * Nothing is preselected; choosing only requests the patient (the context may ask to confirm a switch).
 */
import { matchesQuery, Modal, PatientIdentity, patientSearchText } from '@hms/design-system';
import type { BannerModel } from '@hms/ui-core';
import { useMemo, useState, type ReactNode } from 'react';
import { GridList, GridListItem, Heading } from 'react-aria-components';
import { APPOINTMENTS } from '../data/encounters.ts';
import { PATIENTS } from '../data/patients.ts';
import { bedOfPatient, getWard } from '../data/wards.ts';
import type { Patient } from '../data/types.ts';
import { useFormat, useT } from '../i18n/use-t.ts';
import { Badge, Button, SearchField, Segmented } from '../ui/index.ts';
import { shellMessages } from './messages.ts';
import { useChooserDialogState } from './patient.tsx';
import { protoDirectory } from './proto-module.ts';

type Filter = 'all' | 'inpatients' | 'clinics';

interface Row {
  readonly patient: Patient;
  readonly identity: BannerModel;
  readonly where: string;
  readonly inpatient: boolean;
  readonly clinicToday: boolean;
  readonly searchText: string;
}

function useRows(): readonly Row[] {
  const t = useT(shellMessages);
  const format = useFormat();
  return useMemo(() => {
    const identities = new Map(protoDirectory.list().map((entry) => [entry.patientId, entry.identity]));
    return PATIENTS.flatMap((patient): Row[] => {
      const identity = identities.get(patient.id);
      if (identity === undefined) {
        return [];
      }
      const bed = bedOfPatient(patient.id);
      const appointment = APPOINTMENTS.find((candidate) => candidate.patientId === patient.id && candidate.status !== 'cancelled');
      const where =
        bed !== undefined
          ? t('location', { ward: format.text(getWard(bed.wardId).name), bed: bed.id })
          : appointment !== undefined
            ? t('outpatientToday', { time: format.time(appointment.startIso) })
            : '';
      return [
        {
          patient,
          identity,
          where,
          inpatient: bed !== undefined,
          clinicToday: appointment !== undefined,
          searchText: `${patientSearchText(identity)} ${patient.name.ckb} ${patient.name.ar} ${patient.name.latin} ${where}`,
        },
      ];
    });
  }, [t, format]);
}

export interface PatientPickerProps {
  readonly onChoose: (patientId: string) => void;
  readonly autoFocus?: boolean;
}

export function PatientPicker({ onChoose, autoFocus = false }: PatientPickerProps): ReactNode {
  const t = useT(shellMessages);
  const rows = useRows();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const visible = rows.filter(
    (row) =>
      (filter === 'all' || (filter === 'inpatients' ? row.inpatient : row.clinicToday)) && matchesQuery(row.searchText, query),
  );
  return (
    <div className="shell-picker">
      <div className="shell-picker__controls">
        <SearchField
          label={t('chooserSearch')}
          placeholder={t('chooserSearchPlaceholder')}
          value={query}
          onChange={setQuery}
          autoFocus={autoFocus}
          className="shell-picker__search"
        />
        <Segmented
          label={t('chooserFilter')}
          value={filter}
          onChange={(value) => {
            setFilter(value === 'inpatients' || value === 'clinics' ? value : 'all');
          }}
          options={[
            { id: 'all', label: t('filterAll') },
            { id: 'inpatients', label: t('filterInpatients') },
            { id: 'clinics', label: t('filterClinics') },
          ]}
        />
        <p className="shell-picker__count" aria-live="polite">
          {t('chooserCount', { count: visible.length })}
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="shell-picker__empty">{t('chooserEmpty')}</p>
      ) : (
        <GridList
          className="shell-picker__list"
          aria-label={t('chooserList')}
          items={visible}
          selectionMode="none"
          onAction={(key) => {
            onChoose(String(key));
          }}
        >
          {(row) => (
            <GridListItem id={row.patient.id} className="shell-picker__item" textValue={patientSearchText(row.identity)}>
              <div className="shell-picker__identity">
                <PatientIdentity model={row.identity} />
              </div>
              <div className="shell-picker__meta">
                {row.where === '' ? null : <span className="shell-picker__where">{row.where}</span>}
                <span className="shell-picker__flags">
                  {row.patient.allergies.kind === 'list' ? (
                    <Badge tone="danger" icon="alert" size="sm">
                      {t('allergyFlag')}
                    </Badge>
                  ) : null}
                  {row.patient.isolation === null ? null : (
                    <Badge tone="danger" icon="isolation" size="sm">
                      {t('isolationFlag')}
                    </Badge>
                  )}
                </span>
              </div>
            </GridListItem>
          )}
        </GridList>
      )}
    </div>
  );
}

/** The "Choose a patient" dialog, mounted once by the frame and opened with usePatientChooser(). */
export function ChooserDialog(): ReactNode {
  const t = useT(shellMessages);
  const { state, closeChooser, choose } = useChooserDialogState();
  return (
    <Modal
      isOpen={state.isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeChooser();
        }
      }}
    >
      <div className="shell-chooser-dialog">
        <div className="shell-chooser-dialog__header">
          <Heading slot="title" level={2} className="shell-chooser-dialog__title">
            {t('chooserTitle')}
          </Heading>
          <Button variant="ghost" icon="x" onPress={closeChooser}>
            {t('cancel')}
          </Button>
        </div>
        <PatientPicker onChoose={choose} autoFocus />
      </div>
    </Modal>
  );
}
