/**
 * Vitals capture with nurse validation: NEWS2 is worked out live, implausible values are flagged, and the
 * nurse must confirm the values were checked before saving. A NEWS2 of 5 or more shows the escalation.
 */
import { useState, type ReactNode } from 'react';
import { news2, PLAUSIBLE, type Acvpu, type BrainPatient, type NursingObs } from '../../data/ext/nursing.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Checkbox, Dialog, PatientInline, Segmented, SelectField, TextInput, personName } from '../../ui/index.ts';
import { messages } from './messages.ts';
import { BandBadge } from './parts.tsx';

type Field = 'rr' | 'spo2' | 'sys' | 'dia' | 'hr' | 'temp';
const FIELDS: readonly Field[] = ['rr', 'spo2', 'sys', 'dia', 'hr', 'temp'];

export interface VitalsDialogProps {
  readonly patients: readonly BrainPatient[];
  readonly initialPatientId: string | null;
  readonly nurseId: string;
  readonly onClose: () => void;
  readonly onSave: (patientId: string, obs: NursingObs) => void;
}

export function VitalsDialog({ patients, initialPatientId, nurseId, onClose, onSave }: VitalsDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  const [values, setValues] = useState<Readonly<Record<Field, string>>>({ rr: '', spo2: '', sys: '', dia: '', hr: '', temp: '' });
  const [scale, setScale] = useState<1 | 2>(1);
  const [onOxygen, setOnOxygen] = useState(false);
  const [acvpu, setAcvpu] = useState<Acvpu>('A');
  const [checked, setChecked] = useState(false);
  const bp = patients.find((p) => p.patient.id === patientId);

  const num = (field: Field): number | null => {
    const raw = values[field].trim().replace(',', '.');
    if (raw === '' || Number.isNaN(Number(raw))) {
      return null;
    }
    return Number(raw);
  };
  const filled = FIELDS.every((field) => num(field) !== null);
  const implausible = FIELDS.filter((field) => {
    const value = num(field);
    const range = PLAUSIBLE[field];
    return value !== null && (value < range[0] || value > range[1]);
  });
  const score = filled
    ? news2({ rr: num('rr') ?? 0, spo2: num('spo2') ?? 0, scale, onOxygen, sys: num('sys') ?? 0, hr: num('hr') ?? 0, acvpu, temp: num('temp') ?? 0 })
    : null;
  const canSave = bp !== undefined && filled && checked;
  const label: Readonly<Record<Field, string>> = { rr: t('rr'), spo2: t('spo2'), sys: t('sys'), dia: t('dia'), hr: t('hr'), temp: t('temp') };
  const partKey: Readonly<Partial<Record<Field, 'rr' | 'spo2' | 'sys' | 'hr' | 'temp'>>> = { rr: 'rr', spo2: 'spo2', sys: 'sys', hr: 'hr', temp: 'temp' };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('vitalsTitle')}
      subtitle={t('vitalsSubtitle')}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!canSave}
            onPress={() => {
              if (bp === undefined || !filled) {
                return;
              }
              onSave(bp.patient.id, {
                rr: num('rr') ?? 0,
                spo2: num('spo2') ?? 0,
                scale,
                onOxygen,
                sys: num('sys') ?? 0,
                dia: num('dia') ?? 0,
                hr: num('hr') ?? 0,
                acvpu,
                temp: num('temp') ?? 0,
                time: '09:30',
                byId: nurseId,
              });
            }}
          >
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="nursing-form">
        {initialPatientId === null ? (
          <SelectField
            label={t('patient')}
            placeholder={t('choosePatient')}
            options={patients.map((p) => ({ id: p.patient.id, label: `${p.bedId} · ${personName(p.patient.name, f.locale)}` }))}
            selectedKey={patientId}
            onSelectionChange={setPatientId}
          />
        ) : null}
        {bp === undefined ? null : (
          <div className="nursing-dialog-head">
            <PatientInline patient={bp.patient} />
            <Badge tone="neutral">{bp.bedId}</Badge>
          </div>
        )}
        <div className="nursing-vitals-grid">
          {FIELDS.map((field) => {
            const part = partKey[field];
            const partScore = score === null || part === undefined ? null : score.parts[part];
            return (
              <div key={field} className={`nursing-vital${implausible.includes(field) ? ' nursing-vital--bad' : ''}`}>
                <TextInput
                  label={label[field]}
                  value={values[field]}
                  onChange={(value) => {
                    setValues((current) => ({ ...current, [field]: value }));
                    setChecked(false);
                  }}
                  inputMode="decimal"
                  dir="ltr"
                />
                {partScore === null ? null : <span className={`nursing-part nursing-part--${String(Math.min(partScore, 3))}`}>+{partScore}</span>}
              </div>
            );
          })}
        </div>
        <div className="nursing-form__row">
          <Segmented
            label={t('air')}
            value={onOxygen ? 'o2' : 'air'}
            onChange={(id) => {
              setOnOxygen(id === 'o2');
              setChecked(false);
            }}
            options={[
              { id: 'air', label: t('onAir') },
              { id: 'o2', label: t('onOxygen') },
            ]}
          />
          <Segmented
            label={t('scale')}
            value={String(scale)}
            onChange={(id) => {
              setScale(id === '2' ? 2 : 1);
            }}
            options={[
              { id: '1', label: t('scale1') },
              { id: '2', label: t('scale2') },
            ]}
          />
          <Segmented
            label={t('acvpu')}
            value={acvpu}
            onChange={(id) => {
              setAcvpu((['A', 'C', 'V', 'P', 'U'] as const).find((a) => a === id) ?? 'A');
              setChecked(false);
            }}
            options={(['A', 'C', 'V', 'P', 'U'] as const).map((a) => ({ id: a, label: a }))}
          />
        </div>

        <div className="nursing-live">
          <span className="nursing-live__label">{t('liveScore')}</span>
          {score === null ? (
            <span className="nursing-muted">{t('missing')}</span>
          ) : (
            <>
              <span className={`nursing-live__score nursing-score--${score.band}`}>{score.total}</span>
              <BandBadge band={score.band} />
            </>
          )}
        </div>

        {implausible.length === 0 ? null : (
          <Callout tone="danger" title={t('implausible')} role="alert">
            <ul className="nursing-list">
              {implausible.map((field) => (
                <li key={field}>
                  {t('implausibleItem', { name: label[field], value: values[field], low: PLAUSIBLE[field][0], high: PLAUSIBLE[field][1] })}
                </li>
              ))}
            </ul>
          </Callout>
        )}
        {score !== null && score.total >= 7 ? <Callout tone="danger" role="alert">{t('highCallout', { score: score.total })}</Callout> : null}
        {score !== null && score.total >= 5 && score.total < 7 ? <Callout tone="warning">{t('mediumCallout', { score: score.total })}</Callout> : null}

        <Checkbox isSelected={checked} onChange={setChecked} isDisabled={!filled}>
          {t('validated')}
        </Checkbox>
      </div>
    </Dialog>
  );
}
