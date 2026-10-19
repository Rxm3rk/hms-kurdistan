/** The Maternity screen's dialogs: an examination, the delivery record, and the KRG birth-notification form. */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, GOVERNORATE_LABEL, HOSPITAL } from '../../data/index.ts';
import { MODE_LABEL, PERINEUM_LABEL, type DeliveryMode, type LabourWoman, type Newborn, type PartographExam, type Perineum } from '../../data/ext/maternity.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Checkbox, Code, Dialog, KeyValueList, PatientInline, Segmented, SelectField, TextInput, personName } from '../../ui/index.ts';
import { messages } from './messages.ts';

function num(value: string): number | null {
  const n = Number(value.trim().replace(',', '.'));
  return value.trim() === '' || Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------------------------------------
// Examination
// ---------------------------------------------------------------------------------------------------------

export function ExamDialog({ woman, onClose, onSave }: { readonly woman: LabourWoman; readonly onClose: () => void; readonly onSave: (exam: PartographExam) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const last = woman.exams[woman.exams.length - 1];
  const [v, setV] = useState<Readonly<Record<'dilation' | 'descent' | 'fhr' | 'contractions' | 'pulse' | 'sys' | 'dia', string>>>({
    dilation: last === undefined ? '' : String(last.dilationCm),
    descent: last === undefined ? '5' : String(last.descentFifths),
    fhr: '',
    contractions: last === undefined ? '' : String(last.contractions),
    pulse: '',
    sys: '',
    dia: '',
  });
  const set = (key: keyof typeof v) => (value: string): void => {
    setV((cur) => ({ ...cur, [key]: value }));
  };
  const dilation = num(v.dilation);
  const fhr = num(v.fhr);
  const valid = dilation !== null && dilation >= 0 && dilation <= 10 && fhr !== null && num(v.descent) !== null && num(v.contractions) !== null;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('examTitle')}
      subtitle={`${personName(woman.patient.name, f.locale)} · ${t('examSubtitle', { time: f.time(DEMO_NOW_ISO) })}`}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!valid}
            onPress={() => {
              onSave({
                iso: DEMO_NOW_ISO,
                dilationCm: dilation ?? 0,
                descentFifths: num(v.descent) ?? 5,
                fhr: fhr ?? 0,
                contractions: num(v.contractions) ?? 0,
                pulse: num(v.pulse) ?? 0,
                sys: num(v.sys) ?? 0,
                dia: num(v.dia) ?? 0,
              });
            }}
          >
            {t('saveExam')}
          </Button>
        </>
      }
    >
      <div className="maternity-form-grid">
        <TextInput label={t('dilation')} value={v.dilation} onChange={set('dilation')} inputMode="decimal" dir="ltr" isRequired />
        <SelectField label={t('descent')} options={['5', '4', '3', '2', '1', '0'].map((d) => ({ id: d, label: `${d}/5` }))} selectedKey={v.descent} onSelectionChange={set('descent')} />
        <TextInput label={t('fhr')} value={v.fhr} onChange={set('fhr')} inputMode="numeric" dir="ltr" isRequired />
        <TextInput label={t('contractions')} value={v.contractions} onChange={set('contractions')} inputMode="numeric" dir="ltr" isRequired />
        <TextInput label={t('pulse')} value={v.pulse} onChange={set('pulse')} inputMode="numeric" dir="ltr" />
        <TextInput label={t('sys')} value={v.sys} onChange={set('sys')} inputMode="numeric" dir="ltr" />
        <TextInput label={t('dia')} value={v.dia} onChange={set('dia')} inputMode="numeric" dir="ltr" />
      </div>
      {fhr !== null && (fhr < 110 || fhr > 160) ? (
        <Callout tone="danger" role="alert">
          {t('fhrConcern', { fhr })}
        </Callout>
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------------------------------------

export interface DeliveryInput {
  readonly mode: DeliveryMode;
  readonly ebl: number;
  readonly perineum: Perineum;
  readonly sex: 'male' | 'female';
  readonly weightG: number;
  readonly apgar1: number;
  readonly apgar5: number;
}

const MODES: readonly DeliveryMode[] = ['svd', 'vacuum', 'forceps', 'elective-cs', 'emergency-cs'];
const PERINEUMS: readonly Perineum[] = ['intact', 'first', 'second', 'episiotomy', 'not-applicable'];

export function DeliveryDialog({ woman, onClose, onSave }: { readonly woman: LabourWoman; readonly onClose: () => void; readonly onSave: (input: DeliveryInput) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [mode, setMode] = useState<DeliveryMode>('svd');
  const [ebl, setEbl] = useState('300');
  const [perineum, setPerineum] = useState<Perineum>('intact');
  const [placenta, setPlacenta] = useState(true);
  const [oxy, setOxy] = useState(true);
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [weight, setWeight] = useState('');
  const [apgar1, setApgar1] = useState('8');
  const [apgar5, setApgar5] = useState('9');
  const eblN = num(ebl) ?? 0;
  const weightN = num(weight);
  const a1 = num(apgar1);
  const a5 = num(apgar5);
  const valid = weightN !== null && weightN > 400 && weightN < 6500 && a1 !== null && a5 !== null && a1 <= 10 && a5 <= 10;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('deliveryTitle')}
      subtitle={t('deliverySubtitle')}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!valid}
            onPress={() => {
              onSave({ mode, ebl: eblN, perineum: mode.endsWith('cs') ? 'not-applicable' : perineum, sex, weightG: weightN ?? 0, apgar1: a1 ?? 0, apgar5: a5 ?? 0 });
            }}
          >
            {t('saveDelivery')}
          </Button>
        </>
      }
    >
      <div className="maternity-stack">
        <PatientInline patient={woman.patient} />
        <div className="maternity-form-grid">
          <TextInput label={t('birthTime')} value={f.time(DEMO_NOW_ISO)} onChange={() => undefined} isDisabled dir="ltr" />
          <SelectField
            label={t('mode')}
            options={MODES.map((m) => ({ id: m, label: f.text(MODE_LABEL[m]) }))}
            selectedKey={mode}
            onSelectionChange={(id) => {
              setMode(MODES.find((m) => m === id) ?? 'svd');
            }}
          />
          <TextInput label={t('ebl')} value={ebl} onChange={setEbl} inputMode="numeric" dir="ltr" />
          {mode.endsWith('cs') ? null : (
            <SelectField
              label={t('perineum')}
              options={PERINEUMS.filter((p) => p !== 'not-applicable').map((p) => ({ id: p, label: f.text(PERINEUM_LABEL[p]) }))}
              selectedKey={perineum}
              onSelectionChange={(id) => {
                setPerineum(PERINEUMS.find((p) => p === id) ?? 'intact');
              }}
            />
          )}
        </div>
        <div className="maternity-inline">
          <Checkbox isSelected={placenta} onChange={setPlacenta}>
            {t('placenta')}
          </Checkbox>
          <Checkbox isSelected={oxy} onChange={setOxy}>
            {t('oxytocinGiven')}
          </Checkbox>
        </div>
        {eblN >= 500 ? <Callout tone="danger" role="alert">{t('pphWarning')}</Callout> : null}
        <h3 className="maternity-h3">{t('baby')}</h3>
        <div className="maternity-form-grid">
          <Segmented
            label={t('sex')}
            value={sex}
            onChange={(id) => {
              setSex(id === 'male' ? 'male' : 'female');
            }}
            options={[
              { id: 'female', label: t('girl') },
              { id: 'male', label: t('boy') },
            ]}
          />
          <TextInput label={t('weight')} value={weight} onChange={setWeight} inputMode="numeric" dir="ltr" isRequired />
          <TextInput label={t('apgar1')} value={apgar1} onChange={setApgar1} inputMode="numeric" dir="ltr" />
          <TextInput label={t('apgar5')} value={apgar5} onChange={setApgar5} inputMode="numeric" dir="ltr" />
        </div>
        {a5 !== null && a5 < 7 ? <Callout tone="warning">{t('lowApgar')}</Callout> : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// KRG birth notification (preview)
// ---------------------------------------------------------------------------------------------------------

export function NotificationDialog({ newborn, mother, onClose, onSubmit, onPrint }: { readonly newborn: Newborn; readonly mother: LabourWoman; readonly onClose: () => void; readonly onSubmit: () => void; readonly onPrint: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const m = mother.patient;
  const motherAge = f.age(m.dob);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('formTitle')}
      subtitle={newborn.notificationNo}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          <Button variant="secondary" icon="printer" onPress={onPrint}>
            {t('printForm')}
          </Button>
          <Button variant="primary" icon="arrow-forward" isDisabled={newborn.notification === 'submitted'} onPress={onSubmit}>
            {t('submit')}
          </Button>
        </>
      }
    >
      <article className="maternity-form-sheet" aria-label={t('formTitle')}>
        <header className="maternity-form-sheet__head">
          <div>
            <p className="maternity-form-sheet__issuer" dir="ltr" lang="en">
              {t('formIssuer')}
            </p>
            <p className="maternity-form-sheet__issuer" dir="rtl" lang="ckb">
              {t('formIssuerAlt')}
            </p>
          </div>
          <div className="maternity-form-sheet__title">
            <strong>{t('formTitle')}</strong>
            <span>
              {t('formNo')}: <Code>{newborn.notificationNo}</Code>
            </span>
            <Badge tone={newborn.notification === 'submitted' ? 'success' : 'warning'} size="sm">
              {newborn.notification === 'submitted' ? t('submitted') : t('draft')}
            </Badge>
          </div>
        </header>
        <p className="maternity-form-sheet__demo">{t('formDemo')}</p>

        <section className="maternity-form-sheet__section">
          <h3>{t('sFacility')}</h3>
          <KeyValueList
            columns={2}
            items={[
              { id: 'facility', label: t('facility'), value: f.text(HOSPITAL.name) },
              { id: 'gov', label: t('governorate'), value: f.text(GOVERNORATE_LABEL.erbil) },
            ]}
          />
        </section>
        <section className="maternity-form-sheet__section">
          <h3>{t('sChild')}</h3>
          <KeyValueList
            columns={2}
            items={[
              { id: 'name', label: t('childName'), value: t('notNamedYet') },
              { id: 'sex', label: t('sex'), value: newborn.sex === 'male' ? t('boy') : t('girl') },
              { id: 'dt', label: t('dateTime'), value: f.dateTime(newborn.birthIso) },
              { id: 'weight', label: t('weight'), value: t('grams', { g: f.number(newborn.weightG) }) },
              { id: 'mode', label: t('mode'), value: f.text(MODE_LABEL[newborn.mode]) },
              { id: 'plurality', label: t('plurality'), value: t('single') },
              { id: 'mrn', label: 'MRN', value: <Code>{newborn.baby.mrn}</Code> },
            ]}
          />
        </section>
        <section className="maternity-form-sheet__section">
          <h3>{t('sMother')}</h3>
          <KeyValueList
            columns={2}
            items={[
              { id: 'name', label: t('motherName'), value: personName(m.name, f.locale) },
              { id: 'nid', label: t('nationalId'), value: <Code>{m.nationalId}</Code> },
              { id: 'age', label: t('age'), value: motherAge },
              { id: 'address', label: t('address'), value: `${f.text(m.city)}, ${f.text(GOVERNORATE_LABEL[m.governorate])}` },
              { id: 'phone', label: t('phone'), value: <Code>{m.phone}</Code> },
              { id: 'mrn', label: 'MRN', value: <Code>{m.mrn}</Code> },
            ]}
          />
        </section>
        <section className="maternity-form-sheet__section">
          <h3>{t('sFather')}</h3>
          <KeyValueList
            columns={2}
            items={[
              { id: 'name', label: t('fatherName'), value: personName(mother.husband, f.locale) },
              { id: 'nid', label: t('nationalId'), value: <Code>{mother.husbandNationalId}</Code> },
            ]}
          />
        </section>
        <section className="maternity-form-sheet__section">
          <h3>{t('sAttendant')}</h3>
          <KeyValueList
            columns={2}
            items={[
              { id: 'name', label: t('attendantName'), value: f.text(newborn.attendant) },
              { id: 'qual', label: t('qualification'), value: t('midwifeQual') },
            ]}
          />
          <div className="maternity-form-sheet__sign">{t('signature')}</div>
        </section>
      </article>
    </Dialog>
  );
}
