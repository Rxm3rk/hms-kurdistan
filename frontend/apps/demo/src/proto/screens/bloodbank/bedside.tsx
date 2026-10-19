/**
 * The bedside two-person check before a transfusion starts: scan the wristband, scan the unit, confirm the
 * group compatibility and expiry, tick every check, and name the second checker. A wrong patient or an
 * incompatible unit stops the flow.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_TODAY, STAFF, getPatient } from '../../data/index.ts';
import { BEDSIDE_CHECKS, RBC_COMPATIBLE, type BedsideCheck, type BloodUnit } from '../../data/ext/bloodbank.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Checkbox, Code, Dialog, KeyValueList, PatientInline, SelectField, TextInput, staffName } from '../../ui/index.ts';
import { messages } from './messages.ts';

const FIRST_NURSE = 'SYN-STF-002';

export interface BedsideCheckProps {
  readonly unit: BloodUnit;
  readonly onCancel: () => void;
  readonly onStart: (secondCheckerId: string) => void;
}

export function BedsideCheckDialog({ unit, onCancel, onStart }: BedsideCheckProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const patient = getPatient(unit.patientId ?? '');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wristband, setWristband] = useState('');
  const [unitScan, setUnitScan] = useState('');
  const [ticks, setTicks] = useState<ReadonlySet<BedsideCheck>>(new Set());
  const [second, setSecond] = useState('');

  const wristOk = wristband.trim().toUpperCase() === patient.mrn.toUpperCase();
  const wristTyped = wristband.trim() !== '';
  const unitOk = unitScan.trim().toUpperCase() === unit.id.toUpperCase();
  const unitTyped = unitScan.trim() !== '';
  const compatible =
    patient.bloodGroup === null ? false : unit.component === 'RBC' ? RBC_COMPATIBLE[patient.bloodGroup].includes(unit.group) : true;
  const inDate = unit.expiresOn >= DEMO_TODAY;
  const allTicked = BEDSIDE_CHECKS.every((key) => ticks.has(key));
  const nurses = STAFF.filter((member) => (member.role === 'nurse' || member.role === 'physician') && member.id !== FIRST_NURSE);

  const next = (): void => {
    setStep((s) => (s === 1 ? 2 : 3));
  };

  return (
    <Dialog
      isOpen
      size="lg"
      onOpenChange={(open) => { if (!open) { onCancel(); } }}
      title={t('bedTitle')}
      subtitle={t('bedStep', { step, total: 3 })}
      actions={
        <>
          <Button onPress={onCancel}>{t('cancel')}</Button>
          {step > 1 ? (
            <Button onPress={() => { setStep((s) => (s === 3 ? 2 : 1)); }} icon="chevron-back">
              {t('back')}
            </Button>
          ) : null}
          {step < 3 ? (
            <Button variant="primary" iconEnd="chevron-forward" isDisabled={step === 1 ? !wristOk : !(unitOk && compatible && inDate)} onPress={next}>
              {t('next')}
            </Button>
          ) : (
            <Button variant="primary" icon="droplet" isDisabled={!allTicked || second === ''} onPress={() => { onStart(second); }}>
              {t('bedStart')}
            </Button>
          )}
        </>
      }
    >
      <ol className="bb-steps" aria-label={t('bedStepsLabel')}>
        {[t('bedStepPatient'), t('bedStepUnit'), t('bedStepConfirm')].map((label, index) => (
          <li key={label} className={`bb-steps__item${index + 1 === step ? ' bb-steps__item--current' : ''}${index + 1 < step ? ' bb-steps__item--done' : ''}`}>
            <span className="bb-steps__num">{f.number(index + 1)}</span>
            {label}
          </li>
        ))}
      </ol>
      {step === 1 ? (
        <div className="bb-stack">
          <PatientInline patient={patient} secondary />
          <TextInput label={t('scanWristband')} value={wristband} onChange={setWristband} dir="ltr" description={t('scanWristbandHint', { mrn: patient.mrn })} />
          {wristTyped && !wristOk ? (
            <Callout tone="danger" role="alert" title={t('wrongPatientTitle')}>
              {t('wrongPatientBody')}
            </Callout>
          ) : null}
          {wristOk ? <Callout tone="success">{t('patientMatched')}</Callout> : null}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="bb-stack">
          <TextInput label={t('scanUnit')} value={unitScan} onChange={setUnitScan} dir="ltr" description={t('scanUnitHint', { id: unit.id })} />
          {unitTyped && !unitOk ? (
            <Callout tone="danger" role="alert" title={t('wrongUnitTitle')}>
              {t('wrongUnitBody')}
            </Callout>
          ) : null}
          <KeyValueList
            columns={3}
            items={[
              { id: 'pg', label: t('patientGroup'), value: <span className="bb-group">{patient.bloodGroup ?? t('unknownGroup')}</span> },
              { id: 'ug', label: t('unitGroup'), value: <span className="bb-group">{unit.group}</span> },
              { id: 'comp', label: t('component'), value: <Code>{unit.component}</Code> },
              {
                id: 'compat',
                label: t('compatibility'),
                value: compatible ? <Badge tone="success" icon="check">{t('compatible')}</Badge> : <Badge tone="danger" icon="alert" strong>{t('incompatible')}</Badge>,
              },
              {
                id: 'exp',
                label: t('expires'),
                value: inDate ? f.date(unit.expiresOn) : <Badge tone="danger" icon="alert" strong>{t('expired')}</Badge>,
              },
              { id: 'vol', label: t('volume'), value: <Code>{`${String(unit.volumeMl)} mL`}</Code> },
            ]}
          />
          {!compatible ? (
            <Callout tone="danger" role="alert" title={t('incompatibleTitle')}>
              {t('incompatibleBody')}
            </Callout>
          ) : null}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="bb-stack">
          <div className="bb-checks">
            {BEDSIDE_CHECKS.map((key) => (
              <Checkbox
                key={key}
                isSelected={ticks.has(key)}
                onChange={(on) => {
                  setTicks((current) => {
                    const nextSet = new Set(current);
                    if (on) {
                      nextSet.add(key);
                    } else {
                      nextSet.delete(key);
                    }
                    return nextSet;
                  });
                }}
              >
                {t(key)}
              </Checkbox>
            ))}
          </div>
          <KeyValueList
            columns={2}
            items={[{ id: 'first', label: t('firstChecker'), value: staffName(STAFF.find((s) => s.id === FIRST_NURSE) ?? nurses[0]!, f.locale) }]}
          />
          <SelectField
            label={t('secondChecker')}
            selectedKey={second === '' ? null : second}
            onSelectionChange={setSecond}
            options={nurses.map((member) => ({ id: member.id, label: `${staffName(member, f.locale)} · ${f.text(member.title)}` }))}
          />
          <Callout tone="info">{t('obsNote')}</Callout>
        </div>
      ) : null}
    </Dialog>
  );
}
