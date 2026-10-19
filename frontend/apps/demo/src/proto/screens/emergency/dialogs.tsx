/**
 * The Emergency screen's dialogs: attendance detail (triage, assignment, pathways, MLC, bed, discharge),
 * quick registration, the triage scale, and a medico-legal case.
 */
import { useState, type ReactNode } from 'react';
import { findStaff, getStaff, isKnownPatient } from '../../data/index.ts';
import {
  AREA_LABEL,
  ED_DOCTORS,
  ED_STATUS_LABEL,
  ED_STATUS_TONE,
  MLC_STATUS_LABEL,
  MLC_STATUS_TONE,
  MLC_TYPE_LABEL,
  MODE_LABEL,
  PATHWAY_DEFS,
  POLICE_STATIONS,
  TRIAGE_SCALES,
  type ArrivalMode,
  type EdArea,
  type EdRow,
  type EdStatus,
  type MlcCase,
  type PathwayKind,
  type TriageLevel,
  type TriageScale,
  type TriageScaleId,
} from '../../data/ext/emergency.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  BloodPressure,
  Button,
  Callout,
  Checkbox,
  Code,
  DataTable,
  Dialog,
  KeyValueList,
  PatientInline,
  Qty,
  Segmented,
  SelectField,
  TextInput,
  staffName,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { minutesBetweenIso, NOW_ISO, TriageChip } from './parts.tsx';

const LEVELS: readonly TriageLevel[] = [1, 2, 3, 4, 5];
const STATUSES: readonly EdStatus[] = ['awaiting-triage', 'awaiting-doctor', 'in-assessment', 'awaiting-results', 'awaiting-bed', 'ready-discharge'];
const PATHWAYS: readonly PathwayKind[] = ['stroke', 'stemi', 'sepsis'];

function TriagePicker({ scale, value, onChange, label }: { readonly scale: TriageScale; readonly value: TriageLevel | null; readonly onChange: (level: TriageLevel) => void; readonly label: string }): ReactNode {
  const f = useFormat();
  return (
    <div className="emergency-picker" role="radiogroup" aria-label={label}>
      {scale.categories.map((category) => (
        <button
          key={category.level}
          type="button"
          role="radio"
          aria-checked={value === category.level}
          className={`emergency-picker__option emergency-triage--${String(category.level)}${value === category.level ? ' emergency-picker__option--on' : ''}`}
          onClick={() => {
            onChange(category.level);
          }}
        >
          <strong>{category.level}</strong> {f.text(category.name)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Attendance detail
// ---------------------------------------------------------------------------------------------------------

export interface DetailDialogProps {
  readonly row: EdRow;
  readonly scale: TriageScale;
  readonly activePathways: readonly PathwayKind[];
  readonly onClose: () => void;
  readonly onUpdate: (patch: Partial<EdRow>, toast?: string) => void;
  readonly onStartPathway: (kind: PathwayKind) => void;
  readonly onOpenMlc: () => void;
  readonly onDischarge: () => void;
  readonly onOpenChart: () => void;
}

export function DetailDialog({ row, scale, activePathways, onClose, onUpdate, onStartPathway, onOpenMlc, onDischarge, onOpenChart }: DetailDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [level, setLevel] = useState<TriageLevel | null>(row.triage);
  const doctor = findStaff(row.doctorId);
  const nurse = findStaff(row.nurseId);
  const v = row.vitals;
  const name = (): string => (f.locale === 'en' ? row.patient.name.latin : row.patient.name[f.locale]);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('detailTitle', { id: row.id })}
      subtitle={`${f.text(AREA_LABEL[row.area])}${row.bay === null ? '' : ` · ${row.bay}`} · ${f.text(row.complaint)}`}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          {isKnownPatient(row.patient.id) ? (
            <Button variant="secondary" icon="chart" onPress={onOpenChart}>
              {t('openChart')}
            </Button>
          ) : null}
          <Button variant="secondary" icon="bed" isDisabled={row.status === 'awaiting-bed'} onPress={() => {
            onUpdate({ status: 'awaiting-bed' }, t('bedRequested', { name: name() }));
          }}>
            {t('requestBed')}
          </Button>
          <Button variant="secondary" icon="logout" onPress={onDischarge}>
            {t('discharge')}
          </Button>
          {row.seenIso === null && row.triage !== null ? (
            <Button
              variant="primary"
              icon="stethoscope"
              onPress={() => {
                onUpdate({ seenIso: NOW_ISO, status: 'in-assessment', doctorId: row.doctorId ?? ED_DOCTORS[0] ?? null }, t('seenToast', { name: name() }));
              }}
            >
              {t('markSeen')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="emergency-detail">
        <div className="emergency-detail__head">
          <PatientInline patient={row.patient} secondary />
          <span className="emergency-inline">
            <TriageChip level={row.triage} scale={scale} />
            <Badge tone={ED_STATUS_TONE[row.status]}>{f.text(ED_STATUS_LABEL[row.status])}</Badge>
          </span>
        </div>
        {row.unknownIdentity ? <Callout tone="warning" title={t('unknownBadge')}>{t('unknownCallout')}</Callout> : null}
        {row.mlcId === null ? null : <Callout tone="danger" icon="shield">{t('mlcCallout', { id: row.mlcId })}</Callout>}

        <section className="emergency-detail__section">
          <h3 className="emergency-h3">{row.triage === null ? t('triageNow') : t('retriage')}</h3>
          <TriagePicker scale={scale} value={level} onChange={setLevel} label={t('triageLevel')} />
          <div>
            <Button
              size="sm"
              variant="primary"
              isDisabled={level === null || level === row.triage}
              onPress={() => {
                if (level !== null) {
                  const category = scale.categories.find((c) => c.level === level);
                  onUpdate(
                    { triage: level, triageIso: row.triageIso ?? NOW_ISO, status: row.status === 'awaiting-triage' ? 'awaiting-doctor' : row.status },
                    t('triageSaved', { level: `${String(level)} · ${category === undefined ? '' : f.text(category.name)}` }),
                  );
                }
              }}
            >
              {t('save')}
            </Button>
          </div>
        </section>

        <div className="emergency-detail__grid">
          <section className="emergency-detail__section">
            <h3 className="emergency-h3">{t('vitalsAtTriage')}</h3>
            {v === null ? (
              <p className="emergency-muted">{t('noVitals')}</p>
            ) : (
              <KeyValueList
                columns={2}
                items={[
                  { id: 'hr', label: t('vHr'), value: <Qty value={v.hr} unit="/min" /> },
                  { id: 'bp', label: t('vBp'), value: <BloodPressure systolic={v.sys} diastolic={v.dia} /> },
                  { id: 'rr', label: t('vRr'), value: <Qty value={v.rr} unit="/min" /> },
                  { id: 'spo2', label: t('vSpo2'), value: <Qty value={v.spo2} unit="%" /> },
                  { id: 'temp', label: t('vTemp'), value: <Qty value={v.temp} unit="Cel" /> },
                  { id: 'gcs', label: t('vGcs'), value: <Code>{v.gcs}/15</Code> },
                ]}
              />
            )}
          </section>
          <section className="emergency-detail__section">
            <h3 className="emergency-h3">{t('timeline')}</h3>
            <ol className="emergency-timeline">
              <li>
                <Code>{f.time(row.arrivalIso)}</Code> {t('tArrived', { mode: f.text(MODE_LABEL[row.mode]) })}
              </li>
              <li className={row.triageIso === null ? 'emergency-timeline--pending' : ''}>
                <Code>{row.triageIso === null ? '--:--' : f.time(row.triageIso)}</Code> {t('tTriaged')}
                {row.triageIso === null ? ` · ${t('tPending')}` : ` (+${String(minutesBetweenIso(row.arrivalIso, row.triageIso))}′)`}
              </li>
              <li className={row.seenIso === null ? 'emergency-timeline--pending' : ''}>
                <Code>{row.seenIso === null ? '--:--' : f.time(row.seenIso)}</Code> {t('tSeen')}
                {row.seenIso === null ? ` · ${t('tPending')}` : ` (+${String(minutesBetweenIso(row.arrivalIso, row.seenIso))}′)`}
              </li>
            </ol>
            <p className="emergency-muted">
              {doctor === undefined ? t('unassigned') : staffName(doctor, f.locale)}
              {nurse === undefined ? '' : ` · ${staffName(nurse, f.locale)}`}
            </p>
          </section>
        </div>

        <div className="emergency-detail__grid">
          <SelectField
            label={t('assignDoctor')}
            options={ED_DOCTORS.map((id) => ({ id, label: staffName(getStaff(id), f.locale) }))}
            selectedKey={row.doctorId}
            onSelectionChange={(id) => {
              onUpdate({ doctorId: id });
            }}
          />
          <SelectField
            label={t('statusSelect')}
            options={STATUSES.map((s) => ({ id: s, label: f.text(ED_STATUS_LABEL[s]) }))}
            selectedKey={row.status}
            onSelectionChange={(id) => {
              const status = STATUSES.find((s) => s === id);
              if (status !== undefined) {
                onUpdate({ status });
              }
            }}
          />
        </div>

        <section className="emergency-detail__section">
          <h3 className="emergency-h3">{t('startPathway')}</h3>
          <div className="emergency-inline">
            {PATHWAYS.map((kind) => (
              <Button
                key={kind}
                size="sm"
                icon="clock"
                variant={activePathways.includes(kind) ? 'ghost' : 'secondary'}
                isDisabled={activePathways.includes(kind)}
                onPress={() => {
                  onStartPathway(kind);
                }}
              >
                {f.text(PATHWAY_DEFS[kind].name)}
              </Button>
            ))}
            {row.mlcId === null ? (
              <Button size="sm" icon="shield" variant="danger" onPress={onOpenMlc}>
                {t('openMlc')}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Quick registration
// ---------------------------------------------------------------------------------------------------------

export interface Registration {
  readonly unknown: boolean;
  readonly name: string;
  readonly sex: 'male' | 'female';
  readonly age: number;
  readonly mode: ArrivalMode;
  readonly complaint: string;
  readonly triage: TriageLevel | null;
  readonly area: EdArea;
  readonly mlc: boolean;
  readonly pathways: readonly PathwayKind[];
}

const MODES: readonly ArrivalMode[] = ['walk-in', 'ambulance', 'police', 'referral', 'private-car'];
const AREAS: readonly EdArea[] = ['resus', 'majors', 'minors', 'paeds', 'waiting'];

export function RegisterDialog({ scale, onClose, onRegister }: { readonly scale: TriageScale; readonly onClose: () => void; readonly onRegister: (reg: Registration) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [unknown, setUnknown] = useState(false);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('');
  const [mode, setMode] = useState<ArrivalMode>('walk-in');
  const [complaint, setComplaint] = useState('');
  const [triage, setTriage] = useState<TriageLevel | null>(null);
  const [area, setArea] = useState<EdArea>('waiting');
  const [mlc, setMlc] = useState(false);
  const [pathways, setPathways] = useState<readonly PathwayKind[]>([]);
  const valid = unknown || name.trim().length > 1;
  const flagKey: Readonly<Record<PathwayKind, 'flagStroke' | 'flagStemi' | 'flagSepsis'>> = { stroke: 'flagStroke', stemi: 'flagStemi', sepsis: 'flagSepsis' };
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('regTitle')}
      subtitle={t('regSubtitle')}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          <Button
            variant="primary"
            icon="plus"
            isDisabled={!valid}
            onPress={() => {
              onRegister({ unknown, name: name.trim(), sex, age: Number(age) > 0 ? Math.min(110, Math.round(Number(age))) : 35, mode, complaint: complaint.trim(), triage, area, mlc, pathways });
            }}
          >
            {t('register')}
          </Button>
        </>
      }
    >
      <div className="emergency-form">
        <Segmented
          label={t('identity')}
          value={unknown ? 'unknown' : 'known'}
          onChange={(id) => {
            setUnknown(id === 'unknown');
          }}
          options={[
            { id: 'known', label: t('idKnown') },
            { id: 'unknown', label: t('idUnknown') },
          ]}
        />
        <div className="emergency-form__row">
          {unknown ? null : <TextInput label={t('givenName')} value={name} onChange={setName} isRequired />}
          <Segmented
            label={t('sex')}
            value={sex}
            onChange={(id) => {
              setSex(id === 'female' ? 'female' : 'male');
            }}
            options={[
              { id: 'male', label: t('male') },
              { id: 'female', label: t('female') },
            ]}
          />
          <TextInput label={unknown ? t('estimatedAge') : t('age')} value={age} onChange={setAge} inputMode="numeric" dir="ltr" />
        </div>
        <div className="emergency-form__row">
          <SelectField
            label={t('mode')}
            options={MODES.map((m) => ({ id: m, label: f.text(MODE_LABEL[m]) }))}
            selectedKey={mode}
            onSelectionChange={(id) => {
              setMode(MODES.find((m) => m === id) ?? 'walk-in');
              if (id === 'police') {
                setMlc(true);
              }
            }}
          />
          <SelectField
            label={t('area')}
            options={AREAS.map((a) => ({ id: a, label: f.text(AREA_LABEL[a]) }))}
            selectedKey={area}
            onSelectionChange={(id) => {
              setArea(AREAS.find((a) => a === id) ?? 'waiting');
            }}
          />
        </div>
        <TextInput label={t('complaint')} value={complaint} onChange={setComplaint} />
        <div>
          <p className="emergency-label">{t('triageLevel')}</p>
          <TriagePicker scale={scale} value={triage} onChange={setTriage} label={t('triageLevel')} />
        </div>
        <fieldset className="emergency-fieldset">
          <legend className="emergency-label">{t('flags')}</legend>
          <Checkbox isSelected={mlc} onChange={setMlc}>
            {t('flagMlc')}
          </Checkbox>
          {PATHWAYS.map((kind) => (
            <Checkbox
              key={kind}
              isSelected={pathways.includes(kind)}
              onChange={(on) => {
                setPathways((current) => (on ? [...current, kind] : current.filter((k) => k !== kind)));
              }}
            >
              {t(flagKey[kind])}
            </Checkbox>
          ))}
        </fieldset>
        {valid ? null : <p className="emergency-muted">{t('regNeedsName')}</p>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Triage scale
// ---------------------------------------------------------------------------------------------------------

export function ScaleDialog({ scaleId, onClose, onChange }: { readonly scaleId: TriageScaleId; readonly onClose: () => void; readonly onChange: (id: TriageScaleId) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [choice, setChoice] = useState<TriageScaleId>(scaleId);
  const scale = TRIAGE_SCALES[choice];
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t('scaleTitle')}
      subtitle={t('scaleSubtitle')}
      size="lg"
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          <Button
            variant="primary"
            isDisabled={choice === scaleId}
            onPress={() => {
              onChange(choice);
            }}
          >
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="emergency-form">
        <Segmented
          label={t('scaleInUse')}
          value={choice}
          onChange={(id) => {
            setChoice(id === 'esi' ? 'esi' : 'mts');
          }}
          options={[
            { id: 'mts', label: f.text(TRIAGE_SCALES.mts.name) },
            { id: 'esi', label: f.text(TRIAGE_SCALES.esi.name) },
          ]}
        />
        <DataTable
          caption={f.text(scale.name)}
          rows={scale.categories}
          rowKey={(c) => String(c.level)}
          columns={[
            { id: 'level', header: t('scaleLevel'), cell: (c) => <TriageChip level={c.level} scale={scale} compact /> },
            { id: 'name', header: t('scaleName'), cell: (c) => f.text(c.name) },
            { id: 'colour', header: t('scaleColour'), cell: (c) => f.text(c.colour) },
            { id: 'target', header: t('scaleTarget'), align: 'end', cell: (c) => (c.targetMin === 0 ? t('scaleImmediate') : t('waitMin', { min: c.targetMin })) },
          ]}
          dense
        />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Medico-legal case
// ---------------------------------------------------------------------------------------------------------

export function MlcDialog({ mlc, onClose, onUpdate, onPrint }: { readonly mlc: MlcCase; readonly onClose: () => void; readonly onUpdate: (patch: Partial<MlcCase>, toast: string) => void; readonly onPrint: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [station, setStation] = useState('0');
  const [officer, setOfficer] = useState('');
  const [ref, setRef] = useState('');
  const by = findStaff(mlc.notifiedById);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('mlcDialogTitle', { id: mlc.id })}
      subtitle={f.text(MLC_TYPE_LABEL[mlc.type])}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          <Button variant="secondary" icon="printer" onPress={onPrint}>
            {t('printForm')}
          </Button>
          {mlc.status === 'pending' ? (
            <Button
              variant="primary"
              icon="phone"
              onPress={() => {
                onUpdate(
                  {
                    status: 'notified',
                    station: POLICE_STATIONS[Number(station)] ?? POLICE_STATIONS[0]!,
                    notifiedIso: NOW_ISO,
                    notifiedById: 'SYN-STF-015',
                    officer: officer.trim() === '' ? null : officer.trim(),
                    policeRef: ref.trim() === '' ? null : ref.trim(),
                  },
                  t('notifiedToast', { time: '09:30' }),
                );
              }}
            >
              {t('recordNotification')}
            </Button>
          ) : null}
          {mlc.status === 'notified' ? (
            <Button
              variant="primary"
              icon="shield"
              onPress={() => {
                onUpdate({ status: 'attended' }, t('attendedToast'));
              }}
            >
              {t('markAttended')}
            </Button>
          ) : null}
          {mlc.status === 'attended' ? (
            <Button
              variant="primary"
              icon="clipboard"
              onPress={() => {
                onUpdate({ status: 'report-issued' }, t('reportToast', { id: mlc.id }));
              }}
            >
              {t('issueReport')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="emergency-form">
        <div className="emergency-detail__head">
          <PatientInline patient={mlc.patient} secondary />
          <Badge tone={MLC_STATUS_TONE[mlc.status]} icon="shield">
            {f.text(MLC_STATUS_LABEL[mlc.status])}
          </Badge>
        </div>
        <KeyValueList
          columns={2}
          items={[
            { id: 'type', label: t('colType'), value: f.text(MLC_TYPE_LABEL[mlc.type]) },
            { id: 'arrival', label: t('arrival'), value: f.dateTime(mlc.arrivalIso) },
            { id: 'station', label: t('station'), value: mlc.station === null ? t('notYet') : f.text(mlc.station) },
            {
              id: 'notified',
              label: t('colNotified'),
              value: mlc.notifiedIso === null ? t('notYet') : `${f.dateTime(mlc.notifiedIso)} · ${t('delay', { min: minutesBetweenIso(mlc.arrivalIso, mlc.notifiedIso) })}`,
            },
            { id: 'by', label: t('notifiedBy'), value: by === undefined ? '–' : staffName(by, f.locale) },
            { id: 'officer', label: t('colOfficer'), value: `${mlc.officer ?? '–'}${mlc.policeRef === null ? '' : ` · ${mlc.policeRef}`}` },
          ]}
        />
        {mlc.status === 'pending' ? (
          <>
            <Callout tone="danger">{t('mlcRule')}</Callout>
            <div className="emergency-form__row">
              <SelectField
                label={t('station')}
                options={POLICE_STATIONS.map((s, i) => ({ id: String(i), label: f.text(s) }))}
                selectedKey={station}
                onSelectionChange={setStation}
              />
              <TextInput label={t('officer')} value={officer} onChange={setOfficer} dir="auto" />
              <TextInput label={t('policeRef')} value={ref} onChange={setRef} dir="ltr" />
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
