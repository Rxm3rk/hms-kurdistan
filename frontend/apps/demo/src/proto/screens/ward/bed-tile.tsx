/**
 * One bed on the board: a toggle button (selecting it opens the bed's details beside the board). Occupied
 * beds show the patient with two identifiers (name in two scripts, MRN, date of birth, age and sex), the early
 * warning score and the safety flags; the other states say why the bed is not taking a patient.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { ToggleButton } from 'react-aria-components';
import { findPatient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Icon, PatientInline, cx } from '../../ui/index.ts';
import { earlyWarningOf, hasFallRisk, openCriticalsOf } from './board-data.ts';
import {
  AllergyBadge,
  CriticalBadge,
  EarlyWarningBadge,
  FallRiskBadge,
  IsolationBadge,
  StateLabel,
  dischargeWhen,
  stayOf,
  useDischargeText,
} from './bits.tsx';
import { messages } from './messages.ts';
import type { BoardState, LiveBed } from './state.ts';

export interface BedTileProps {
  readonly bed: LiveBed;
  readonly board: BoardState;
  readonly isSelected: boolean;
  readonly onSelect: (bedId: string) => void;
}

export function BedTile({ bed, board, isSelected, onSelect }: BedTileProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const dischargeText = useDischargeText();
  const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;

  let body: ReactNode;
  if (patient !== undefined) {
    const warning = earlyWarningOf(patient, bed.wardId);
    const stay = stayOf(board, patient.id, bed.wardId);
    const when = dischargeWhen(stay.expectedDischargeOn);
    body = (
      <>
        <span className="ward-bed__patient">
          <PatientInline patient={patient} secondary />
        </span>
        <span className="ward-bed__flags">
          <EarlyWarningBadge warning={warning} />
          {openCriticalsOf(patient.id).length > 0 ? <CriticalBadge /> : null}
          <IsolationBadge patient={patient} />
          {hasFallRisk(patient) ? <FallRiskBadge /> : null}
          <AllergyBadge patient={patient} />
        </span>
        <span className="ward-bed__foot">
          <span className={cx('ward-bed__discharge', when === 'today' && 'ward-bed__discharge--today')}>
            <Icon name={when === 'today' ? 'logout' : 'calendar'} size="1em" />
            <span>{dischargeText(stay.expectedDischargeOn)}</span>
          </span>
          {stay.demoAdmission ? (
            <Badge tone="info" size="sm">
              {t('justAdmitted')}
            </Badge>
          ) : stay.day === null ? null : (
            <span className="ward-bed__day">{t('dayOfStay', { day: stay.day })}</span>
          )}
        </span>
      </>
    );
  } else {
    const note = bed.note === null ? null : f.text(bed.note);
    body = (
      <>
        <span className="ward-bed__empty-title">
          {bed.state === 'available' ? t('tileReady') : note ?? <StateLabel state={bed.state} />}
        </span>
        <span className="ward-bed__empty-meta">
          <Icon name="clock" size="1em" />
          <span>
            {bed.state === 'available'
              ? t('tileReadySince', { time: f.time(bed.sinceIso) })
              : t('tileSince', { time: f.time(bed.sinceIso), relative: f.relative(bed.sinceIso) })}
          </span>
        </span>
      </>
    );
  }

  return (
    <ToggleButton
      className={cx('ward-bed', `ward-bed--${bed.state}`)}
      isSelected={isSelected}
      onChange={() => {
        onSelect(bed.id);
      }}
    >
      <span className="ward-bed__head">
        <span className="ward-bed__id">
          <Bdi dir="ltr">{bed.id}</Bdi>
        </span>
        <span className="ward-bed__head-end">
          {bed.isolationRoom ? (
            <span className="ward-bed__room" title={t('isolationRoom')}>
              <Icon name="isolation" size="1em" />
              <span className="hms-visually-hidden">{t('isolationRoom')}</span>
            </span>
          ) : null}
          <StateLabel state={bed.state} />
        </span>
      </span>
      {body}
    </ToggleButton>
  );
}
