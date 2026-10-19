/**
 * The selected bed's details beside the board. For an occupied bed: the patient's identity (the design
 * system's PatientIdentity: photo, every name form, MRN, date of birth), the safety facts and the stay, with
 * the next steps (open the chart, medication, transfer, discharge, print a wristband on the simulated
 * printer). For the other states: why the bed is not taking a patient and the one move the bed rules allow.
 */
import { PatientIdentity } from '@hms/design-system';
import type { ReactNode } from 'react';
import { SEVERITY_LABEL, findPatient, findStaff, getWard } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import type { ScreenId } from '../../shell/index.ts';
import { bannerModelOf } from '../../shell/index.ts';
import { Button, Callout, Card, Code, EmptyState, KeyValueList, Qty, Sparkline, Stack, StaffName, type KeyValueItem } from '../../ui/index.ts';
import { earlyWarningOf, hasFallRisk, openCriticalsOf } from './board-data.ts';
import {
  AllergyBadge,
  BedStateBadge,
  EarlyWarningBadge,
  FallRiskBadge,
  IsolationBadge,
  stayOf,
  useBandLabel,
  useDischargeText,
} from './bits.tsx';
import { messages } from './messages.ts';
import type { BoardState, LiveBed } from './state.ts';

export interface BedPanelProps {
  readonly bed: LiveBed | undefined;
  readonly board: BoardState;
  readonly onOpenPatient: (patientId: string, screen: ScreenId) => void;
  readonly onTransfer: (bedId: string) => void;
  readonly onDischarge: (bedId: string) => void;
  readonly onAdmitHere: (bedId: string) => void;
  readonly onMarkClean: (bedId: string) => void;
  readonly onReturnToService: (bedId: string) => void;
  readonly onRelease: (bedId: string) => void;
  readonly onPrintWristband: (bedId: string) => void;
}

export function BedPanel(props: BedPanelProps): ReactNode {
  const { bed, board } = props;
  const t = useT(messages);
  const f = useFormat();
  const dischargeText = useDischargeText();
  const bandLabel = useBandLabel();

  if (bed === undefined) {
    return (
      <Card className="ward-panel" title={t('panelTitle')} icon="bed" headingLevel={2}>
        <EmptyState compact icon="bed" title={t('panelEmptyTitle')} body={t('panelEmptyBody')} />
      </Card>
    );
  }

  const ward = getWard(bed.wardId);
  const header = {
    title: t('panelBed', { bed: bed.id }),
    subtitle: f.text(ward.name),
    actions: <BedStateBadge state={bed.state} />,
  };
  const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;

  if (patient === undefined) {
    const rule =
      bed.state === 'cleaning'
        ? t('cleanRule')
        : bed.state === 'blocked'
          ? t('blockedRule')
          : bed.state === 'reserved'
            ? t('reservedRule')
            : t('availableRule');
    const items: KeyValueItem[] = [
      { id: 'since', label: t('panelSince'), value: `${f.dateTime(bed.sinceIso)} (${f.relative(bed.sinceIso)})` },
    ];
    if (bed.note !== null) {
      items.unshift({ id: 'note', label: t('panelNote'), value: f.text(bed.note) });
    }
    if (bed.isolationRoom) {
      items.push({ id: 'room', label: t('isolation'), value: t('isolationRoom') });
    }
    return (
      <Card className="ward-panel" icon="bed" headingLevel={2} {...header}>
        <Stack gap="md">
          <KeyValueList items={items} columns={1} />
          <Callout tone={bed.state === 'available' ? 'success' : bed.state === 'blocked' ? 'neutral' : 'info'}>{rule}</Callout>
          <div className="ward-panel__actions">
            {bed.state === 'available' ? (
              <Button variant="primary" icon="plus" onPress={() => { props.onAdmitHere(bed.id); }}>
                {t('actionAdmitHere')}
              </Button>
            ) : null}
            {bed.state === 'cleaning' ? (
              <Button variant="primary" icon="check" onPress={() => { props.onMarkClean(bed.id); }}>
                {t('actionMarkClean')}
              </Button>
            ) : null}
            {bed.state === 'blocked' ? (
              <Button icon="refresh" onPress={() => { props.onReturnToService(bed.id); }}>
                {t('actionReturnToService')}
              </Button>
            ) : null}
            {bed.state === 'reserved' ? (
              <Button icon="x" onPress={() => { props.onRelease(bed.id); }}>
                {t('actionRelease')}
              </Button>
            ) : null}
          </div>
        </Stack>
      </Card>
    );
  }

  const warning = earlyWarningOf(patient, bed.wardId);
  const stay = stayOf(board, patient.id, bed.wardId);
  const criticals = openCriticalsOf(patient.id);
  const attending = findStaff(stay.attendingId);
  const primary = stay.diagnoses.find((dx) => dx.primary) ?? stay.diagnoses[0];

  const items: KeyValueItem[] = [];
  if (primary !== undefined) {
    items.push({
      id: 'dx',
      label: t('diagnosis'),
      value: (
        <span>
          {f.text(primary.text)} <Code>{primary.code}</Code>
        </span>
      ),
    });
  }
  if (stay.reason !== null) {
    items.push({ id: 'reason', label: t('admissionReason'), value: f.text(stay.reason) });
  }
  if (stay.startIso !== null) {
    items.push({ id: 'admitted', label: t('admitted'), value: f.dateTime(stay.startIso) });
  }
  if (stay.day !== null) {
    items.push({ id: 'los', label: t('lengthOfStay'), value: t('dayOfStay', { day: stay.day }) });
  }
  if (attending !== undefined) {
    items.push({ id: 'attending', label: t('attending'), value: <StaffName member={attending} /> });
  }
  items.push({ id: 'discharge', label: t('expectedDischarge'), value: dischargeText(stay.expectedDischargeOn) });
  items.push({
    id: 'code',
    label: t('codeStatus'),
    value: patient.codeStatus.kind === 'dnacpr' ? t('dnacpr') : patient.codeStatus.kind === 'attempt-cpr' ? t('attemptCpr') : t('notDocumented'),
  });

  return (
    <Card className="ward-panel" icon="bed" headingLevel={2} {...header}>
      <Stack gap="md">
        <div className="ward-panel__identity">
          <PatientIdentity model={bannerModelOf(patient.id)} />
        </div>
        <div className="ward-panel__flags">
          <IsolationBadge patient={patient} size="md" />
          {hasFallRisk(patient) ? <FallRiskBadge size="md" /> : null}
          <AllergyBadge patient={patient} size="md" />
        </div>
        {criticals.map((result) => (
          <Callout
            key={result.id}
            tone="danger"
            icon="flask"
            title={t('criticalBadge')}
            actions={
              <Button size="sm" variant="danger" onPress={() => { props.onOpenPatient(patient.id, 'lab'); }}>
                {t('openLab')}
              </Button>
            }
          >
            {f.text(result.analyte)} <Qty value={result.value} unit={result.unit} />
          </Callout>
        ))}
        {patient.allergies.kind === 'list' ? (
          <Callout tone="danger" title={t('allergies')}>
            <ul className="ward-panel__allergies">
              {patient.allergies.items.map((allergy) => (
                <li key={allergy.code}>
                  <strong>{f.text(allergy.substance)}</strong>
                  {allergy.reaction === undefined ? null : ` · ${f.text(allergy.reaction)}`}
                  {allergy.severity === undefined ? null : ` · ${f.text(SEVERITY_LABEL[allergy.severity])}`}
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {patient.isolation === null ? null : (
          <Callout tone="warning" icon="isolation" title={t('isolation')}>
            {f.text(patient.isolation.reason)}
          </Callout>
        )}
        <div className="ward-panel__ew">
          <span className="ward-panel__ew-label">{t('earlyWarning')}</span>
          <EarlyWarningBadge warning={warning} size="md" />
          <span className="ward-panel__ew-band">{bandLabel(warning.band)}</span>
          {warning.trend === null ? null : (
            <Sparkline
              values={warning.trend}
              label={t('trendLabel', { scale: warning.scale })}
              tone={warning.band === 'low' ? 'accent' : warning.band === 'medium' ? 'warning' : 'danger'}
              width={96}
              height={28}
            />
          )}
          <span className="ward-panel__ew-time">{t('observedAt', { time: f.time(warning.iso) })}</span>
        </div>
        <KeyValueList items={items} columns={1} />
        <div className="ward-panel__actions">
          <Button variant="primary" icon="chart" onPress={() => { props.onOpenPatient(patient.id, 'chart'); }}>
            {t('openChart')}
          </Button>
          <Button icon="pill" onPress={() => { props.onOpenPatient(patient.id, 'emar'); }}>
            {t('actionMedication')}
          </Button>
          <Button icon="arrow-forward" onPress={() => { props.onTransfer(bed.id); }}>
            {t('actionTransfer')}
          </Button>
          <Button icon="logout" onPress={() => { props.onDischarge(bed.id); }}>
            {t('actionDischarge')}
          </Button>
        </div>
        <div className="ward-panel__printer">
          <Button variant="ghost" size="sm" icon="printer" onPress={() => { props.onPrintWristband(bed.id); }}>
            {t('actionPrintWristband')}
          </Button>
          <span className="ward-panel__printer-note">{t('printerNote')}</span>
        </div>
      </Stack>
    </Card>
  );
}
