/**
 * "Register new patient": the three name forms (Sorani, Arabic, Latin, with suggestions from the Sorani
 * spelling that the clerk checks with the patient), sex, date of birth, national ID (optional), phone,
 * governorate and district, emergency contact and known allergies.
 *
 * Beside the form: the checks (what is still missing), the duplicate check (same name and date of birth as a
 * patient on file: open that record instead, or confirm this is a different person) and a live preview of how
 * the real patient banner will identify the patient. On save the patient gets the next synthetic MRN (kept in
 * this browser session only) and the wristband print preview opens.
 */
import { Bdi, PatientIdentity } from '@hms/design-system';
import type { ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  DEMO_TODAY,
  GOVERNORATE_LABEL,
  SEX_LABEL,
  type AllergyStatus,
  type Governorate,
  type NameScript,
  type Patient,
  type Sex,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient, useScreenHref } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Icon,
  KeyValueList,
  LinkButton,
  PatientInline,
  Segmented,
  SelectField,
  TextInput,
  useToast,
} from '../../ui/index.ts';
import { draftIdentity, identityOf } from './identity.ts';
import { messages } from './messages.ts';
import { DISTRICTS, findDistrict, GOVERNORATES, LOOK_ALIKE_ALERT, REGISTRATION_ALLERGENS, RELATIONS } from './reference.ts';
import { findDuplicates, formatIraqiMobile, parseDob, type ParsedDob } from './search.ts';
import { addSessionPatient, nextIdentifiers, useAllPatients } from './session.ts';
import { hasArabicScript, suggestArabic, suggestLatin } from './transliterate.ts';
import { WristbandPreview } from './wristband.tsx';

export interface RegistrationDraft {
  readonly ckb: string;
  readonly ar: string;
  readonly latin: string;
  readonly ownScript: NameScript;
  readonly sex: Sex | null;
  readonly dob: string;
  readonly dobApproximate: boolean;
  readonly nationalId: string;
  readonly phone: string;
  readonly governorate: Governorate | null;
  readonly district: string | null;
  readonly contactName: string;
  readonly contactRelation: string | null;
  readonly contactPhone: string;
  readonly allergyStatus: 'not-assessed' | 'nka' | 'list';
  readonly allergens: readonly string[];
  readonly differentPerson: boolean;
}

export const EMPTY_DRAFT: RegistrationDraft = {
  ckb: '',
  ar: '',
  latin: '',
  ownScript: 'ckb',
  sex: null,
  dob: '',
  dobApproximate: false,
  nationalId: '',
  phone: '',
  governorate: null,
  district: null,
  contactName: '',
  contactRelation: null,
  contactPhone: '',
  allergyStatus: 'not-assessed',
  allergens: [],
  differentPerson: false,
};

/** Demo: a new synthetic patient (not on file), with a latex allergy so the wristband shows its red band. */
const DEMO_NEW: RegistrationDraft = {
  ...EMPTY_DRAFT,
  ckb: 'شادی سەرکەوت مەحموود',
  ar: 'شادي سركوت محمود',
  latin: 'Shadi Sarkawt Mahmood',
  sex: 'female',
  dob: '14/03/1994',
  nationalId: 'SYN-NID-1994031',
  phone: '0750 000 0917',
  governorate: 'erbil',
  district: 'shaqlawa',
  contactName: 'ئاوات سەرکەوت',
  contactRelation: 'brother',
  contactPhone: '0750 000 0918',
  allergyStatus: 'list',
  allergens: ['SYN-ALG-LATEX'],
};

/** Demo: Karwan Tahir Bakr again (same name and date of birth as SYN-PAT-0101): the duplicate check fires. */
const DEMO_DUPLICATE: RegistrationDraft = {
  ...EMPTY_DRAFT,
  ckb: 'کاروان تاهیر بەکر',
  ar: 'كاروان طاهر بكر',
  latin: 'Karwan Tahir Bakr',
  sex: 'male',
  dob: '12/05/1971',
  phone: '0750 000 0931',
  governorate: 'erbil',
  district: 'erbil-centre',
};

const IDENTITY_KEYS: ReadonlySet<keyof RegistrationDraft> = new Set<keyof RegistrationDraft>(['ckb', 'ar', 'latin', 'dob', 'dobApproximate']);

export interface CompletedRegistration {
  readonly patient: Patient;
  readonly printedIso: string | null;
}

type Issue =
  | 'ownName'
  | 'latinName'
  | 'ckbScript'
  | 'arScript'
  | 'latinScript'
  | 'sex'
  | 'dob'
  | 'phone'
  | 'address'
  | 'contactPhone'
  | 'duplicate';

type Warning = 'threePart' | 'noContact' | 'allergiesUnknown';

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter((word) => word.length > 0).length;
}

function parsedDobOf(draft: RegistrationDraft): ParsedDob | null {
  const parsed = parseDob(draft.dob);
  if (parsed === null) {
    return null;
  }
  return parsed.precision === 'year' && !draft.dobApproximate ? null : parsed;
}

/** The draft as a Patient record (for the banner preview, the duplicate check and the save). */
function draftPatient(draft: RegistrationDraft, ids: { readonly id: string; readonly mrn: string }, locale: 'en' | 'ckb' | 'ar', lookAlike = false): Patient {
  const dob = parsedDobOf(draft);
  const district = draft.governorate === null ? undefined : findDistrict(draft.governorate, draft.district);
  const contactPhone = formatIraqiMobile(draft.contactPhone);
  const allergies: AllergyStatus =
    draft.allergyStatus === 'list'
      ? { kind: 'list', items: REGISTRATION_ALLERGENS.filter((allergen) => draft.allergens.includes(allergen.code)) }
      : { kind: draft.allergyStatus };
  return {
    id: ids.id,
    mrn: ids.mrn,
    name: { ckb: draft.ckb.trim(), ar: draft.ar.trim(), latin: draft.latin.trim(), ownScript: draft.ownScript },
    sex: draft.sex ?? 'female',
    dob: dob?.iso ?? '',
    dobPrecision: dob?.precision ?? 'day',
    dobApproximate: draft.dobApproximate,
    phone: formatIraqiMobile(draft.phone) ?? draft.phone.trim(),
    governorate: draft.governorate ?? 'erbil',
    city: district?.name ?? { en: '', ckb: '', ar: '' },
    nationalId: draft.nationalId.trim(),
    bloodGroup: null,
    payerId: 'self-pay',
    preferredLanguage: locale,
    allergies,
    isolation: null,
    codeStatus: { kind: 'not-documented' },
    weight: null,
    heightCm: null,
    alerts: lookAlike ? [{ tone: 'warning', text: LOOK_ALIKE_ALERT }] : [],
    hasPhoto: false,
    emergencyContact:
      draft.contactName.trim() === '' || contactPhone === null
        ? null
        : {
            name: {
              ckb: hasArabicScript(draft.contactName) ? draft.contactName.trim() : '',
              ar: hasArabicScript(draft.contactName) ? draft.contactName.trim() : '',
              latin: hasArabicScript(draft.contactName) ? suggestLatin(draft.contactName) : draft.contactName.trim(),
            },
            relation: RELATIONS.find((relation) => relation.id === draft.contactRelation)?.label ?? { en: '', ckb: '', ar: '' },
            phone: contactPhone,
          },
    curated: false,
    registeredOn: DEMO_TODAY,
  };
}

function issuesOf(draft: RegistrationDraft, duplicates: number): { readonly issues: readonly Issue[]; readonly warnings: readonly Warning[] } {
  const issues: Issue[] = [];
  const warnings: Warning[] = [];
  const own = draft[draft.ownScript].trim();
  if (own === '') {
    issues.push('ownName');
  }
  if (draft.latin.trim() === '' && draft.ownScript !== 'latin') {
    issues.push('latinName');
  }
  if (draft.ckb.trim() !== '' && !hasArabicScript(draft.ckb)) {
    issues.push('ckbScript');
  }
  if (draft.ar.trim() !== '' && !hasArabicScript(draft.ar)) {
    issues.push('arScript');
  }
  if (draft.latin.trim() !== '' && hasArabicScript(draft.latin)) {
    issues.push('latinScript');
  }
  if (draft.sex === null) {
    issues.push('sex');
  }
  if (parsedDobOf(draft) === null) {
    issues.push('dob');
  }
  if (formatIraqiMobile(draft.phone) === null) {
    issues.push('phone');
  }
  if (draft.governorate === null || draft.district === null) {
    issues.push('address');
  }
  if (draft.contactPhone.trim() !== '' && formatIraqiMobile(draft.contactPhone) === null) {
    issues.push('contactPhone');
  }
  if (duplicates > 0 && !draft.differentPerson) {
    issues.push('duplicate');
  }
  if (own !== '' && wordCount(own) < 3) {
    warnings.push('threePart');
  }
  if (draft.contactName.trim() === '') {
    warnings.push('noContact');
  }
  if (draft.allergyStatus === 'not-assessed') {
    warnings.push('allergiesUnknown');
  }
  return { issues, warnings };
}

const ISSUE_KEY = {
  ownName: 'issueOwnName',
  latinName: 'issueLatinName',
  ckbScript: 'issueCkbScript',
  arScript: 'issueArScript',
  latinScript: 'issueLatinScript',
  sex: 'issueSex',
  dob: 'issueDob',
  phone: 'issuePhone',
  address: 'issueAddress',
  contactPhone: 'issueContactPhone',
  duplicate: 'issueDuplicate',
} as const satisfies Record<Issue, string>;

const WARNING_KEY = {
  threePart: 'warnThreePart',
  noContact: 'warnNoContact',
  allergiesUnknown: 'warnAllergiesUnknown',
} as const satisfies Record<Warning, string>;

function Suggestion({ text, dir, onUse, label }: { readonly text: string; readonly dir: 'ltr' | 'rtl'; readonly onUse: () => void; readonly label: string }): ReactNode {
  const t = useT(messages);
  if (text === '') {
    return null;
  }
  return (
    <div className="patients-suggestion">
      <span className="patients-suggestion__text">
        {label}: <Bdi dir={dir} className="patients-strong">{text}</Bdi>
      </span>
      <Button size="sm" variant="ghost" icon="check" onPress={onUse}>
        {t('useSuggestion')}
      </Button>
    </div>
  );
}

export interface RegisterPatientProps {
  readonly draft: RegistrationDraft;
  readonly onDraftChange: (draft: RegistrationDraft) => void;
  readonly completed: CompletedRegistration | null;
  readonly onCompletedChange: (completed: CompletedRegistration | null) => void;
  /** Show the newly registered patient in "Find a patient". */
  readonly onShowPatient: (patientId: string) => void;
  /** Opened from the outpatient walk-in shortcut. */
  readonly fromWalkIn: boolean;
}

export function RegisterPatient({ draft, onDraftChange, completed, onCompletedChange, onShowPatient, fromWalkIn }: RegisterPatientProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const href = useScreenHref();
  const openPatient = useOpenPatient();
  const patients = useAllPatients();
  const ids = nextIdentifiers();
  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]): void => {
    // A change to the name or the date of birth withdraws an earlier "this is a different person".
    onDraftChange({ ...draft, [key]: value, differentPerson: IDENTITY_KEYS.has(key) ? false : draft.differentPerson });
  };
  const dob = parsedDobOf(draft);
  const report = findDuplicates(patients, { name: { ckb: draft.ckb, ar: draft.ar, latin: draft.latin }, dob });
  const { issues, warnings } = issuesOf(draft, report.duplicates.length);
  const preview = draftPatient(draft, ids, f.locale);
  const previewModel = draftIdentity(preview);
  const latinSuggestion = draft.ckb.trim() === '' ? '' : suggestLatin(draft.ckb);
  const arabicSuggestion = draft.ckb.trim() === '' ? '' : suggestArabic(draft.ckb);
  const governorateOptions = GOVERNORATES.map((id) => ({ id, label: f.text(GOVERNORATE_LABEL[id]) }));
  const districtOptions = draft.governorate === null ? [] : DISTRICTS[draft.governorate].map((district) => ({ id: district.id, label: f.text(district.name) }));
  const phonePreview = formatIraqiMobile(draft.phone);

  const save = (): void => {
    if (issues.length > 0) {
      return;
    }
    // A similar name on file: the new record carries the look-alike alert, as the synthetic look-alikes do.
    const patient = draftPatient(draft, ids, f.locale, report.duplicates.length + report.similarNames.length > 0);
    addSessionPatient(patient);
    onCompletedChange({ patient, printedIso: null });
    onDraftChange(EMPTY_DRAFT);
    toast({ tone: 'success', title: t('savedToast', { mrn: patient.mrn }), body: t('savedToastBody') });
  };

  if (completed !== null) {
    const { patient } = completed;
    return (
      <div className="patients-done">
        <Callout tone="success" title={t('savedTitle', { mrn: patient.mrn })} role="status">
          {t('savedBody')}
        </Callout>
        <div className="patients-done__grid">
          <Card title={t('newRecordTitle')} icon="user" subtitle={t('newRecordSubtitle')}>
            <PatientIdentity model={identityOf(patient)} />
            <KeyValueList
              columns={2}
              items={[
                { id: 'sex', label: t('fieldAgeSex'), value: `${f.age(patient.dob)}, ${f.text(SEX_LABEL[patient.sex])}` },
                { id: 'phone', label: t('fieldPhone'), value: <Bdi dir="ltr">{patient.phone}</Bdi> },
                { id: 'address', label: t('fieldAddress'), value: `${f.text(GOVERNORATE_LABEL[patient.governorate])}, ${f.text(patient.city)}` },
                {
                  id: 'allergies',
                  label: t('fieldAllergies'),
                  value:
                    patient.allergies.kind === 'list' ? (
                      <span className="patients-flags">
                        {patient.allergies.items.map((item) => (
                          <Badge key={item.code} tone="danger" icon="alert" size="sm">
                            {f.text(item.substance)}
                          </Badge>
                        ))}
                      </span>
                    ) : patient.allergies.kind === 'nka' ? (
                      t('nka')
                    ) : (
                      <Badge tone="warning" icon="alert" size="sm">
                        {t('allergiesNotAssessed')}
                      </Badge>
                    ),
                },
              ]}
            />
          </Card>
          <Card
            title={t('wristbandTitle')}
            icon="printer"
            className="patients-done__wristband"
            footer={
              <div className="patients-detail__actions">
                <Button
                  variant="primary"
                  icon="printer"
                  onPress={() => {
                    onCompletedChange({ patient, printedIso: DEMO_NOW_ISO });
                    toast({ tone: 'success', title: t('printedToast'), body: t('printedToastBody') });
                  }}
                >
                  {t('printWristband')}
                </Button>
                <Button
                  variant="secondary"
                  icon="user"
                  onPress={() => {
                    openPatient(patient.id, 'chart');
                  }}
                >
                  {t('openPatient')}
                </Button>
                <Button
                  variant="ghost"
                  icon="search"
                  onPress={() => {
                    onShowPatient(patient.id);
                  }}
                >
                  {t('tabFind')}
                </Button>
                {fromWalkIn ? (
                  <LinkButton href={href('outpatient', { walkin: patient.id })} variant="secondary" icon="stethoscope" iconEnd="arrow-forward">
                    {t('backToWalkIn')}
                  </LinkButton>
                ) : null}
                <Button
                  variant="ghost"
                  icon="plus"
                  onPress={() => {
                    onCompletedChange(null);
                  }}
                >
                  {t('registerAnother')}
                </Button>
              </div>
            }
          >
            <WristbandPreview patient={patient} printedIso={completed.printedIso} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="patients-register">
      {fromWalkIn ? (
        <Callout tone="info" icon="stethoscope" title={t('walkInTitle')}>
          {t('walkInBody')}
        </Callout>
      ) : null}
      <div className="patients-register__demo" role="group" aria-label={t('demoFill')}>
        <span className="patients-examples__label">{t('demoFill')}</span>
        <Button size="sm" variant="ghost" icon="user" onPress={() => { onDraftChange(DEMO_NEW); }}>
          {t('demoNew')}
        </Button>
        <Button size="sm" variant="ghost" icon="users" onPress={() => { onDraftChange(DEMO_DUPLICATE); }}>
          {t('demoDuplicate')}
        </Button>
        <Button size="sm" variant="ghost" icon="x" onPress={() => { onDraftChange(EMPTY_DRAFT); }}>
          {t('clearForm')}
        </Button>
      </div>
      <div className="patients-register__layout">
        <div className="patients-register__form">
          <Card title={t('namesTitle')} icon="user" subtitle={t('namesSubtitle')}>
            <div className="patients-form">
              <Segmented
                label={t('ownScript')}
                value={draft.ownScript}
                onChange={(value) => {
                  set('ownScript', value === 'ar' || value === 'latin' ? value : 'ckb');
                }}
                options={[
                  { id: 'ckb', label: t('scriptCkb') },
                  { id: 'ar', label: t('scriptAr') },
                  { id: 'latin', label: t('scriptLatin') },
                ]}
              />
              <div className="patients-form__grid patients-form__grid--names">
                <div className="patients-form__cell">
                  <TextInput
                    label={t('nameCkb')}
                    value={draft.ckb}
                    onChange={(value) => { set('ckb', value); }}
                    dir="rtl"
                    placeholder="کاروان تاهیر بەکر"
                    isRequired={draft.ownScript === 'ckb'}
                    description={t('nameHint')}
                  />
                </div>
                <div className="patients-form__cell">
                  <TextInput
                    label={t('nameAr')}
                    value={draft.ar}
                    onChange={(value) => { set('ar', value); }}
                    dir="rtl"
                    placeholder="كاروان طاهر بكر"
                    isRequired={draft.ownScript === 'ar'}
                  />
                  {draft.ar.trim() === '' ? (
                    <Suggestion text={arabicSuggestion} dir="rtl" label={t('suggestedFromSorani')} onUse={() => { set('ar', arabicSuggestion); }} />
                  ) : null}
                </div>
                <div className="patients-form__cell">
                  <TextInput
                    label={t('nameLatin')}
                    value={draft.latin}
                    onChange={(value) => { set('latin', value); }}
                    dir="ltr"
                    placeholder="Karwan Tahir Bakr"
                    isRequired
                  />
                  {draft.latin.trim() === '' ? (
                    <Suggestion text={latinSuggestion} dir="ltr" label={t('suggestedFromSorani')} onUse={() => { set('latin', latinSuggestion); }} />
                  ) : null}
                </div>
              </div>
              <p className="patients-hint">{t('suggestHint')}</p>
            </div>
          </Card>

          <Card title={t('identityTitle')} icon="shield">
            <div className="patients-form__grid">
              <Segmented
                label={t('fieldSex')}
                value={draft.sex ?? ''}
                onChange={(value) => {
                  set('sex', value === 'male' ? 'male' : 'female');
                }}
                options={[
                  { id: 'female', label: f.text(SEX_LABEL.female) },
                  { id: 'male', label: f.text(SEX_LABEL.male) },
                ]}
              />
              <div className="patients-form__cell">
                <TextInput
                  label={t('fieldDob')}
                  value={draft.dob}
                  onChange={(value) => { set('dob', value); }}
                  dir="ltr"
                  placeholder={t('dobPlaceholder')}
                  isRequired
                  description={
                    dob === null
                      ? draft.dob.trim() === ''
                        ? t('dobHint')
                        : t('dobInvalid')
                      : dob.precision === 'day'
                        ? t('dobReads', { date: f.date(dob.iso, 'long'), age: f.age(dob.iso) })
                        : t('dobYearReads', { year: dob.iso })
                  }
                />
                <Checkbox isSelected={draft.dobApproximate} onChange={(value) => { set('dobApproximate', value); }}>
                  {t('dobApproximate')}
                </Checkbox>
              </div>
              <TextInput
                label={t('fieldNidOptional')}
                value={draft.nationalId}
                onChange={(value) => { set('nationalId', value); }}
                dir="ltr"
                placeholder="SYN-NID-000000000"
                description={t('nidHint')}
              />
              <TextInput
                label={t('fieldPhone')}
                value={draft.phone}
                onChange={(value) => { set('phone', value); }}
                dir="ltr"
                inputMode="tel"
                placeholder="0750 000 0000"
                isRequired
                description={phonePreview === null ? t('phoneHint') : t('phoneReads', { phone: phonePreview })}
              />
              <SelectField
                label={t('fieldGovernorate')}
                options={governorateOptions}
                selectedKey={draft.governorate}
                onSelectionChange={(id) => {
                  const governorate = GOVERNORATES.find((candidate) => candidate === id) ?? null;
                  onDraftChange({ ...draft, governorate, district: governorate === null ? null : (DISTRICTS[governorate][0]?.id ?? null) });
                }}
              />
              <SelectField
                label={t('fieldDistrict')}
                options={districtOptions}
                selectedKey={draft.district}
                isDisabled={draft.governorate === null}
                onSelectionChange={(id) => { set('district', id); }}
              />
            </div>
          </Card>

          <Card title={t('contactTitle')} icon="phone" subtitle={t('contactSubtitle')}>
            <div className="patients-form__grid">
              <TextInput label={t('contactName')} value={draft.contactName} onChange={(value) => { set('contactName', value); }} dir="auto" />
              <SelectField
                label={t('contactRelation')}
                options={RELATIONS.map((relation) => ({ id: relation.id, label: f.text(relation.label) }))}
                selectedKey={draft.contactRelation}
                onSelectionChange={(id) => { set('contactRelation', id); }}
              />
              <TextInput
                label={t('contactPhone')}
                value={draft.contactPhone}
                onChange={(value) => { set('contactPhone', value); }}
                dir="ltr"
                inputMode="tel"
                placeholder="0750 000 0000"
              />
            </div>
          </Card>

          <Card title={t('allergiesTitle')} icon="alert" {...(draft.allergyStatus === 'list' && draft.allergens.length > 0 ? { tone: 'danger' as const } : {})}>
            <div className="patients-form">
              <Segmented
                label={t('allergyStatus')}
                value={draft.allergyStatus}
                onChange={(value) => {
                  set('allergyStatus', value === 'nka' || value === 'list' ? value : 'not-assessed');
                }}
                options={[
                  { id: 'not-assessed', label: t('allergiesNotAssessed') },
                  { id: 'nka', label: t('nka') },
                  { id: 'list', label: t('hasAllergies') },
                ]}
              />
              {draft.allergyStatus === 'list' ? (
                <div className="patients-allergen-grid" role="group" aria-label={t('allergensLabel')}>
                  {REGISTRATION_ALLERGENS.map((allergen) => (
                    <Checkbox
                      key={allergen.code}
                      isSelected={draft.allergens.includes(allergen.code)}
                      onChange={(selected) => {
                        set('allergens', selected ? [...draft.allergens, allergen.code] : draft.allergens.filter((code) => code !== allergen.code));
                      }}
                    >
                      {f.text(allergen.substance)}
                    </Checkbox>
                  ))}
                </div>
              ) : null}
              <p className="patients-hint">{t('allergiesHint')}</p>
            </div>
          </Card>
        </div>

        <aside className="patients-register__side" aria-label={t('checksTitle')}>
          {report.duplicates.length > 0 ? (
            <Callout tone="danger" icon="users" title={t('duplicateTitle')} role="status">
              <p className="patients-callout-text">{t('duplicateBody')}</p>
              <ul className="patients-dupes">
                {report.duplicates.map((patient) => (
                  <li key={patient.id} className="patients-dupes__item">
                    <PatientInline patient={patient} secondary />
                    <Button
                      size="sm"
                      variant="primary"
                      iconEnd="arrow-forward"
                      onPress={() => {
                        openPatient(patient.id, 'chart');
                      }}
                    >
                      {t('openExisting')}
                    </Button>
                  </li>
                ))}
              </ul>
              <Checkbox isSelected={draft.differentPerson} onChange={(value) => { onDraftChange({ ...draft, differentPerson: value }); }}>
                {t('differentPerson')}
              </Checkbox>
            </Callout>
          ) : report.similarNames.length > 0 ? (
            <Callout tone="warning" icon="users" title={t('similarTitle')}>
              <p className="patients-callout-text">{t('similarBody')}</p>
              <ul className="patients-dupes">
                {report.similarNames.map((patient) => (
                  <li key={patient.id} className="patients-dupes__item">
                    <PatientInline patient={patient} secondary />
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}

          <Card title={t('checksTitle')} icon="check-circle" headingLevel={2}>
            <ul className="patients-checks">
              {issues.length === 0 ? (
                <li className="patients-checks__item patients-checks__item--ok">
                  <span className="patients-checks__icon"><Icon name="check-circle" /></span>
                  <span>{t('readyToSave')}</span>
                </li>
              ) : (
                issues.map((issue) => (
                  <li key={issue} className="patients-checks__item patients-checks__item--issue">
                    <span className="patients-checks__icon"><Icon name="x" /></span>
                    <span>{t(ISSUE_KEY[issue])}</span>
                  </li>
                ))
              )}
              {warnings.map((warning) => (
                <li key={warning} className="patients-checks__item patients-checks__item--warn">
                  <span className="patients-checks__icon"><Icon name="alert" /></span>
                  <span>{t(WARNING_KEY[warning])}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" size="lg" icon="printer" onPress={save} isDisabled={issues.length > 0} className="patients-save">
              {t('saveAndPrint')}
            </Button>
            <p className="patients-hint">{t('mrnOnSave', { mrn: ids.mrn })}</p>
          </Card>

          <Card title={t('previewTitle')} icon="shield" subtitle={t('previewSubtitle')}>
            {draft.ckb.trim() === '' && draft.ar.trim() === '' && draft.latin.trim() === '' ? (
              <p className="patients-hint">{t('previewEmpty')}</p>
            ) : (
              <div className="patients-preview">
                <PatientIdentity model={previewModel} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
