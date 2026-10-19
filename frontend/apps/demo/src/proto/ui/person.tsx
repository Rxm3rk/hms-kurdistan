/**
 * Names of people in lists and worklists (not the banner: patient-scoped screens get the real PatientBanner
 * from the shell).
 *
 * - The name form matching the UI language comes first (English: Latin; Sorani: Sorani; Arabic: Arabic), each
 *   isolated in its own direction and language, so a Sorani name beside a Latin MRN keeps its order.
 * - PatientInline shows two identifiers wherever a patient is listed: the MRN and the date of birth (with
 *   age and sex). Never identify a patient by bed or room alone.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import type { NameScript, Patient, PersonName, StaffMember } from '../data/types.ts';
import { SEX_LABEL } from '../data/labels.ts';
import { formatAge, formatDate, type Locale } from '../i18n/format.ts';
import { useLocale, useT } from '../i18n/use-t.ts';
import { uiMessages } from './messages.ts';

const SCRIPT_OF_LOCALE: Readonly<Record<Locale, NameScript>> = { en: 'latin', ckb: 'ckb', ar: 'ar' };
const LANG_OF_SCRIPT: Readonly<Record<NameScript, string>> = { latin: 'ckb-Latn', ckb: 'ckb', ar: 'ar' };

/** The name form for the UI language (en: Latin, ckb: Sorani, ar: Arabic). */
export function personName(name: PersonName, locale: Locale): string {
  return name[SCRIPT_OF_LOCALE[locale]];
}

/** A staff member's display name with prefix: `Dr. Shilan Kareem`, `د. شیلان کەریم`. */
export function staffName(member: StaffMember, locale: Locale): string {
  const name = personName(member.name, locale);
  return member.prefix === null ? name : `${member.prefix[locale]} ${name}`;
}

/** Initials for an avatar, from the name form of the UI language. */
export function initials(name: PersonName, locale: Locale): string {
  return personName(name, locale)
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join(locale === 'en' ? '' : ' ');
}

function NameText({ name, script }: { readonly name: PersonName; readonly script: NameScript }): ReactNode {
  return (
    <Bdi dir={script === 'latin' ? 'ltr' : 'rtl'} lang={LANG_OF_SCRIPT[script]}>
      {name[script]}
    </Bdi>
  );
}

/** A staff member's name (with prefix) in the UI language. */
export function StaffName({ member, className }: { readonly member: StaffMember; readonly className?: string | undefined }): ReactNode {
  const locale = useLocale();
  const script = SCRIPT_OF_LOCALE[locale];
  return (
    <span className={['ui-person', className ?? ''].filter(Boolean).join(' ')}>
      <Bdi dir={script === 'latin' ? 'ltr' : 'rtl'} lang={LANG_OF_SCRIPT[script]}>
        {staffName(member, locale)}
      </Bdi>
    </span>
  );
}

export interface PatientNameProps {
  readonly patient: Patient;
  /** Also show a second name form under the first (Latin under Sorani or Arabic; Sorani under Latin). */
  readonly secondary?: boolean;
  readonly className?: string | undefined;
}

/** A patient's name in the UI language, optionally with a second script beneath. */
export function PatientName({ patient, secondary = false, className }: PatientNameProps): ReactNode {
  const locale = useLocale();
  const first = SCRIPT_OF_LOCALE[locale];
  const second: NameScript = first === 'latin' ? 'ckb' : 'latin';
  return (
    <span className={['ui-patient-name', className ?? ''].filter(Boolean).join(' ')}>
      <span className="ui-patient-name__primary">
        <NameText name={patient.name} script={first} />
      </span>
      {secondary ? (
        <span className="ui-patient-name__secondary">
          <NameText name={patient.name} script={second} />
        </span>
      ) : null}
    </span>
  );
}

export interface PatientInlineProps {
  readonly patient: Patient;
  /** Show the second name form too. */
  readonly secondary?: boolean;
  readonly className?: string | undefined;
}

/** A patient in a list: name, then MRN · date of birth (age, sex). Two identifiers, always. */
export function PatientInline({ patient, secondary = false, className }: PatientInlineProps): ReactNode {
  const locale = useLocale();
  const t = useT(uiMessages);
  const dob = patient.dobPrecision === 'day' ? formatDate(patient.dob, locale, 'short') : patient.dob;
  return (
    <span className={['ui-patient-inline', className ?? ''].filter(Boolean).join(' ')}>
      <PatientName patient={patient} secondary={secondary} />
      <span className="ui-patient-inline__ids">
        <span>
          {t('mrn')} <Bdi dir="ltr">{patient.mrn}</Bdi>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t('dob')} <Bdi dir="ltr">{dob}</Bdi>
          {patient.dobApproximate ? ` (${t('approximate')})` : ''}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {formatAge(patient.dob, locale)}, {SEX_LABEL[patient.sex][locale]}
        </span>
      </span>
    </span>
  );
}

/** A round avatar with initials (staff, or patients without a photo in lists). Decorative. */
export function Avatar({ name, size = 'md' }: { readonly name: PersonName; readonly size?: 'sm' | 'md' | 'lg' }): ReactNode {
  const locale = useLocale();
  return (
    <span className={`ui-avatar ui-avatar--${size}`} aria-hidden="true">
      {initials(name, locale)}
    </span>
  );
}
