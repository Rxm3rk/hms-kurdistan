/**
 * Three-part identification at the outpatient desk, before a patient is marked arrived: the patient states
 * (1) their full name and (2) their date of birth, and the clerk checks (3) the MRN on the hospital card or
 * the phone number on file. Each answer is compared with the record as it is typed (any name form, spelling
 * variants allowed and marked; Eastern Arabic digits accepted). Arrival is allowed only when all three match.
 *
 * A first and father's name that match with a different grandfather's name is called out as a possible
 * look-alike patient (the data has such a pair: SYN-PAT-0107 and SYN-PAT-0108).
 */
import { useState, type ReactNode } from 'react';
import type { Patient } from '../../data/index.ts';
import { formatDate, useT } from '../../i18n/use-t.ts';
import { Button, Icon, Meter, Segmented, TextInput, type IconName } from '../../ui/index.ts';
import { checkDob, checkIdentifier, checkName, type DobCheck, type IdentifierCheck, type IdentifierMode, type NameCheck } from '../patients/search.ts';
import { messages } from './messages.ts';

export interface IdentityCheckApi {
  readonly name: string;
  readonly dob: string;
  readonly mode: IdentifierMode;
  readonly identifier: string;
  readonly setName: (value: string) => void;
  readonly setDob: (value: string) => void;
  readonly setMode: (value: IdentifierMode) => void;
  readonly setIdentifier: (value: string) => void;
  readonly nameCheck: NameCheck;
  readonly dobCheck: DobCheck;
  readonly idCheck: IdentifierCheck;
  readonly confirmed: number;
  readonly allMatched: boolean;
  readonly fillCorrect: () => void;
  readonly fillLookAlike: () => void;
}

const OTHER_GRANDFATHER = {
  ckb: ['عەزیز', 'ڕەسوڵ'],
  ar: ['عزيز', 'رسول'],
  latin: ['Aziz', 'Rasul'],
} as const;

const EMPTY = { status: 'empty' } as const;

/** The identification state for one patient; it starts again when the patient changes. */
export function useIdentityCheck(patient: Patient | null, locale: 'en' | 'ckb' | 'ar'): IdentityCheckApi {
  const [forId, setForId] = useState<string | null>(patient?.id ?? null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [mode, setMode] = useState<IdentifierMode>('mrn');
  const [identifier, setIdentifier] = useState('');
  if ((patient?.id ?? null) !== forId) {
    // Another patient: nothing typed for the previous one may count for this one.
    setForId(patient?.id ?? null);
    setName('');
    setDob('');
    setMode('mrn');
    setIdentifier('');
  }
  const nameCheck: NameCheck = patient === null ? EMPTY : checkName(patient, name);
  const dobCheck: DobCheck = patient === null ? EMPTY : checkDob(patient, dob);
  const idCheck: IdentifierCheck = patient === null ? EMPTY : checkIdentifier(patient, mode, identifier);
  const confirmed = [nameCheck.status === 'match', dobCheck.status === 'match', idCheck.status === 'match'].filter(Boolean).length;
  const script = locale === 'en' ? 'latin' : locale;
  return {
    name,
    dob,
    mode,
    identifier,
    setName,
    setDob,
    setMode,
    setIdentifier,
    nameCheck,
    dobCheck,
    idCheck,
    confirmed,
    allMatched: patient !== null && confirmed === 3,
    fillCorrect: () => {
      if (patient === null) {
        return;
      }
      setName(patient.name[script] === '' ? patient.name.latin : patient.name[script]);
      setDob(patient.dobPrecision === 'day' ? formatDate(patient.dob, 'en', 'short') : patient.dob.slice(0, 4));
      setMode('mrn');
      setIdentifier(patient.mrn);
    },
    fillLookAlike: () => {
      if (patient === null) {
        return;
      }
      const stated = patient.name[script] === '' ? patient.name.latin : patient.name[script];
      const words = stated.split(/\s+/u);
      const options = OTHER_GRANDFATHER[script];
      const index = Math.min(2, words.length - 1);
      words[index] = words[index] === options[0] ? options[1] : options[0];
      setName(words.join(' '));
      setDob(patient.dobPrecision === 'day' ? formatDate(patient.dob, 'en', 'short') : patient.dob.slice(0, 4));
      setMode('phone');
      setIdentifier(patient.phone.replace('+964 ', '0'));
    },
  };
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

interface Verdict {
  readonly tone: Tone;
  readonly text: string;
}

const TONE_ICON: Readonly<Record<Tone, IconName>> = { neutral: 'clock', success: 'check-circle', warning: 'alert', danger: 'x' };

function Step({
  number,
  prompt,
  verdict,
  children,
}: {
  readonly number: number;
  readonly prompt: string;
  readonly verdict: Verdict;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <li className={`outpatient-idstep outpatient-idstep--${verdict.tone}`}>
      <span className="outpatient-idstep__number" aria-hidden="true">
        {verdict.tone === 'success' ? <Icon name="check" /> : number}
      </span>
      <div className="outpatient-idstep__body">
        <p className="outpatient-idstep__prompt">{prompt}</p>
        {children}
        <p className={`outpatient-idstep__verdict outpatient-idstep__verdict--${verdict.tone}`}>
          <span className="outpatient-idstep__icon">
            <Icon name={TONE_ICON[verdict.tone]} />
          </span>
          <span>{verdict.text}</span>
        </p>
      </div>
    </li>
  );
}

export function IdentityCheckFields({ check }: { readonly check: IdentityCheckApi }): ReactNode {
  const t = useT(messages);
  const formKey = { ckb: 'formCkb', ar: 'formAr', latin: 'formLatin' } as const;

  const nameVerdict: Verdict = (() => {
    switch (check.nameCheck.status) {
      case 'empty':
        return { tone: 'neutral', text: t('notChecked') };
      case 'match':
        return {
          tone: 'success',
          text: check.nameCheck.variant
            ? t('nameMatchVariant', { form: t(formKey[check.nameCheck.form]) })
            : t('nameMatch', { form: t(formKey[check.nameCheck.form]) }),
        };
      case 'partial':
        return { tone: 'warning', text: t('namePartial') };
      case 'differs':
        return { tone: 'danger', text: t('nameDiffers') };
      case 'mismatch':
        return { tone: 'danger', text: t('noMatch') };
    }
  })();

  const dobVerdict: Verdict = (() => {
    switch (check.dobCheck.status) {
      case 'empty':
        return { tone: 'neutral', text: t('notChecked') };
      case 'invalid':
        return { tone: 'warning', text: t('dobInvalid') };
      case 'match':
        return { tone: 'success', text: check.dobCheck.yearOnly ? t('dobMatchYear') : t('dobMatch') };
      case 'mismatch':
        return { tone: 'danger', text: t('noMatch') };
    }
  })();

  const idVerdict: Verdict = (() => {
    switch (check.idCheck.status) {
      case 'empty':
        return { tone: 'neutral', text: t('notChecked') };
      case 'match':
        return { tone: 'success', text: check.mode === 'mrn' ? t('mrnMatch') : t('phoneMatch') };
      case 'mismatch':
        return { tone: 'danger', text: t('noMatch') };
    }
  })();

  return (
    <div className="outpatient-idcheck">
      <div className="outpatient-idcheck__progress">
        <Meter
          value={check.confirmed / 3}
          label={t('idProgressLabel')}
          valueLabel={t('idProgress', { count: check.confirmed })}
          tone={check.allMatched ? 'success' : check.confirmed === 0 ? 'neutral' : 'warning'}
          showText
        />
      </div>
      <ol className="outpatient-idsteps">
        <Step number={1} prompt={t('askName')} verdict={nameVerdict}>
          <TextInput label={t('statedName')} value={check.name} onChange={check.setName} dir="auto" />
        </Step>
        <Step number={2} prompt={t('askDob')} verdict={dobVerdict}>
          <TextInput label={t('statedDob')} value={check.dob} onChange={check.setDob} dir="ltr" placeholder={t('dobPlaceholder')} />
        </Step>
        <Step number={3} prompt={t('askId')} verdict={idVerdict}>
          <div className="outpatient-idcheck__id">
            <Segmented
              label={t('idKind')}
              value={check.mode}
              onChange={(value) => {
                check.setMode(value === 'phone' ? 'phone' : 'mrn');
              }}
              options={[
                { id: 'mrn', label: t('idMrn') },
                { id: 'phone', label: t('idPhone') },
              ]}
            />
            <TextInput
              label={check.mode === 'mrn' ? t('idMrnInput') : t('idPhoneInput')}
              value={check.identifier}
              onChange={check.setIdentifier}
              dir="ltr"
              inputMode={check.mode === 'phone' ? 'tel' : 'text'}
              placeholder={check.mode === 'mrn' ? 'SYN-000000-0' : '0750 000 0000'}
              className="outpatient-idcheck__input"
            />
          </div>
        </Step>
      </ol>
      <div className="outpatient-idcheck__demo" role="group" aria-label={t('demoLabel')}>
        <span className="outpatient-demo-label">{t('demoLabel')}</span>
        <Button size="sm" variant="ghost" icon="check" onPress={check.fillCorrect}>
          {t('demoCorrect')}
        </Button>
        <Button size="sm" variant="ghost" icon="users" onPress={check.fillLookAlike}>
          {t('demoLookAlike')}
        </Button>
      </div>
      <p className="outpatient-hint">{t('idPolicy')}</p>
    </div>
  );
}
