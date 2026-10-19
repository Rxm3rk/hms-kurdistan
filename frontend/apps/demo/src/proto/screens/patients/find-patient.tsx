/**
 * "Find a patient": one search box that matches any name form (Sorani, Arabic, Latin, with spelling
 * variants), the MRN, the phone number, the national ID or the date of birth; a results list in which every
 * patient shows the photo (or "No photo") and two identifiers through the design system's PatientIdentity;
 * and a details panel with the record's key facts and the ways to open it.
 *
 * Nothing opens on a search: the user chooses, and opening a record goes through the window's patient
 * context (it asks "Change patient?" when another patient is open).
 */
import { Bdi, PatientIdentity } from '@hms/design-system';
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  GOVERNORATE_LABEL,
  getPayer,
  ISOLATION_LABEL,
  SEVERITY_LABEL,
  SEX_LABEL,
  type NameScript,
  type Patient,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient, useRole } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Dialog,
  EmptyState,
  KeyValueList,
  PatientName,
  personName,
  SearchField,
  useToast,
  type KeyValueItem,
} from '../../ui/index.ts';
import { identityOf, whereToday, type WhereToday } from './identity.ts';
import { messages } from './messages.ts';
import { searchPatients, type MatchKind, type SearchHit } from './search.ts';
import { isSessionPatient, useAllPatients } from './session.ts';
import { WristbandPreview, wristbandDob } from './wristband.tsx';

/** Example queries for the presenter: each shows one way the search matches. */
const EXAMPLES: readonly { readonly query: string; readonly dir: 'ltr' | 'rtl' }[] = [
  { query: 'کاروان', dir: 'rtl' },
  { query: 'كاروان', dir: 'rtl' },
  { query: 'Kerwan', dir: 'ltr' },
  { query: 'رەشید', dir: 'rtl' },
  { query: 'Abdulrahman Hawramani', dir: 'ltr' },
  { query: 'SYN-100101', dir: 'ltr' },
  { query: '0750 000 0105', dir: 'ltr' },
  { query: '٢٠/٠١/١٩٥٠', dir: 'ltr' },
];

type MatchLabelKey =
  | 'matchMrn'
  | 'matchPhone'
  | 'matchNid'
  | 'matchDob'
  | 'matchCkb'
  | 'matchAr'
  | 'matchLatin'
  | 'matchCkbAr'
  | 'matchSimilar';

function matchLabelKey(kind: MatchKind, forms: readonly NameScript[]): MatchLabelKey {
  switch (kind) {
    case 'mrn':
      return 'matchMrn';
    case 'phone':
      return 'matchPhone';
    case 'nid':
      return 'matchNid';
    case 'dob':
      return 'matchDob';
    case 'similar':
      return 'matchSimilar';
    case 'name':
      if (forms.includes('latin') && forms.length === 1) {
        return 'matchLatin';
      }
      if (forms.includes('ckb') && forms.includes('ar')) {
        return 'matchCkbAr';
      }
      return forms.includes('ar') ? 'matchAr' : forms.includes('latin') ? 'matchLatin' : 'matchCkb';
  }
}

function WhereText({ where }: { readonly where: WhereToday }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  switch (where.kind) {
    case 'ward':
      return <>{t('inpatientAt', { ward: f.text(where.ward.name), bed: where.bedId })}</>;
    case 'clinic':
      return <>{t('clinicToday', { clinic: f.text(where.clinicName), time: f.time(where.appointment.startIso) })}</>;
    case 'none':
      return <>{t('notInHospital')}</>;
  }
}

function SafetyFlags({ patient }: { readonly patient: Patient }): ReactNode {
  const t = useT(messages);
  return (
    <span className="patients-flags">
      {patient.allergies.kind === 'list' ? (
        <Badge tone="danger" icon="alert" size="sm" strong>
          {t('allergyFlag')}
        </Badge>
      ) : patient.allergies.kind === 'not-assessed' ? (
        <Badge tone="warning" icon="alert" size="sm">
          {t('allergiesNotAssessed')}
        </Badge>
      ) : null}
      {patient.isolation === null ? null : (
        <Badge tone="danger" icon="isolation" size="sm">
          {t('isolationFlag')}
        </Badge>
      )}
      {patient.alerts.some((alert) => alert.tone === 'warning' && alert.text.en.startsWith('Look-alike')) ? (
        <Badge tone="warning" icon="users" size="sm">
          {t('lookAlikeFlag')}
        </Badge>
      ) : null}
    </span>
  );
}

interface ResultProps {
  readonly hit: SearchHit | { readonly patient: Patient; readonly kind: null; readonly forms: readonly NameScript[] };
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onOpen: () => void;
}

function Result({ hit, selected, onSelect, onOpen }: ResultProps): ReactNode {
  const t = useT(messages);
  const { patient } = hit;
  const session = isSessionPatient(patient.id);
  return (
    <li className="patients-result" data-selected={selected} data-allergy={patient.allergies.kind === 'list'}>
      <div className="patients-result__identity">
        <PatientIdentity model={identityOf(patient)} />
      </div>
      <div className="patients-result__meta">
        <span className="patients-result__where">
          <WhereText where={whereToday(patient)} />
        </span>
        <SafetyFlags patient={patient} />
        <span className="patients-result__badges">
          {hit.kind === null ? null : (
            <Badge tone={hit.kind === 'similar' ? 'warning' : 'info'} size="sm" icon="search">
              {t('matchedOn')}: {t(matchLabelKey(hit.kind, hit.forms))}
            </Badge>
          )}
          {session ? (
            <Badge tone="accent" size="sm">
              {t('newThisSession')}
            </Badge>
          ) : null}
        </span>
        <span className="patients-result__actions">
          <Button size="sm" variant={selected ? 'primary' : 'secondary'} icon="info" onPress={onSelect} aria-label={t('detailsFor', { name: personName(patient.name, t.locale) })}>
            {t('details')}
          </Button>
          <Button size="sm" variant="ghost" iconEnd="arrow-forward" onPress={onOpen}>
            {t('openRecord')}
          </Button>
        </span>
      </div>
    </li>
  );
}

function AllergyList({ patient }: { readonly patient: Patient }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  if (patient.allergies.kind === 'nka') {
    return <Badge tone="success" icon="check">{t('nka')}</Badge>;
  }
  if (patient.allergies.kind === 'not-assessed') {
    return (
      <Badge tone="warning" icon="alert">
        {t('allergiesNotAssessed')}
      </Badge>
    );
  }
  return (
    <ul className="patients-allergies">
      {patient.allergies.items.map((item) => (
        <li key={item.code} className="patients-allergies__item">
          <Badge tone="danger" icon="alert" strong={item.severity === 'severe'}>
            {f.text(item.substance)}
          </Badge>
          {item.reaction === undefined ? null : <span>{f.text(item.reaction)}</span>}
          {item.severity === undefined ? null : <span className="patients-muted">({f.text(SEVERITY_LABEL[item.severity])})</span>}
        </li>
      ))}
    </ul>
  );
}

interface DetailProps {
  readonly patient: Patient;
  readonly onOpen: (screen: 'chart' | 'billing') => void;
  readonly onWristband: () => void;
}

function Detail({ patient, onOpen, onWristband }: DetailProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { roleId } = useRole();
  const session = isSessionPatient(patient.id);
  const dob = wristbandDob(patient, f.locale);
  const languageKey = patient.preferredLanguage === 'en' ? 'langEn' : patient.preferredLanguage === 'ar' ? 'langAr' : 'langCkb';
  const items: KeyValueItem[] = [
    { id: 'mrn', label: t('fieldMrn'), value: <Bdi dir="ltr" className="patients-strong">{patient.mrn}</Bdi> },
    {
      id: 'dob',
      label: t('fieldDob'),
      value: (
        <span>
          <Bdi dir="ltr" className="patients-strong">{dob}</Bdi>
          {patient.dobApproximate ? ` (${t('approximate')})` : ''}
        </span>
      ),
    },
    { id: 'age', label: t('fieldAgeSex'), value: `${f.age(patient.dob)}, ${f.text(SEX_LABEL[patient.sex])}` },
    { id: 'phone', label: t('fieldPhone'), value: <Bdi dir="ltr">{patient.phone}</Bdi> },
    {
      id: 'nid',
      label: t('fieldNid'),
      value: patient.nationalId === '' ? <span className="patients-muted">{t('notRecorded')}</span> : <Bdi dir="ltr">{patient.nationalId}</Bdi>,
    },
    { id: 'address', label: t('fieldAddress'), value: `${f.text(GOVERNORATE_LABEL[patient.governorate])}, ${f.text(patient.city)}` },
    { id: 'blood', label: t('fieldBlood'), value: patient.bloodGroup === null ? <span className="patients-muted">{t('notRecorded')}</span> : <Bdi dir="ltr">{patient.bloodGroup}</Bdi> },
    { id: 'payer', label: t('fieldPayer'), value: f.text(getPayer(patient.payerId).name) },
    { id: 'language', label: t('fieldLanguage'), value: t(languageKey) },
    { id: 'registered', label: t('fieldRegistered'), value: f.date(patient.registeredOn) },
    {
      id: 'contact',
      label: t('fieldContact'),
      value:
        patient.emergencyContact === null ? (
          <span className="patients-muted">{t('notRecorded')}</span>
        ) : (
          <span className="patients-contact">
            <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{personName(patient.emergencyContact.name, f.locale)}</Bdi>
            <span className="patients-muted">{f.text(patient.emergencyContact.relation)}</span>
            <Bdi dir="ltr">{patient.emergencyContact.phone}</Bdi>
          </span>
        ),
    },
    { id: 'today', label: t('fieldToday'), value: <WhereText where={whereToday(patient)} /> },
  ];
  const billingFirst = roleId === 'cashier';
  return (
    <Card
      title={<PatientName patient={patient} secondary />}
      subtitle={t('detailTitle')}
      icon="user"
      headingLevel={2}
      className="patients-detail"
      {...(patient.allergies.kind === 'list' ? { tone: 'danger' as const } : {})}
      footer={
        <div className="patients-detail__actions">
          <Button variant={billingFirst ? 'secondary' : 'primary'} icon="chart" onPress={() => { onOpen('chart'); }}>
            {t('openChart')}
          </Button>
          <Button variant={billingFirst ? 'primary' : 'secondary'} icon="receipt" onPress={() => { onOpen('billing'); }}>
            {t('openBilling')}
          </Button>
          <Button variant="ghost" icon="printer" onPress={onWristband}>
            {t('reprint')}
          </Button>
        </div>
      }
    >
      <div className="patients-detail__body">
        <SafetyFlags patient={patient} />
        {session ? (
          <Callout tone="info" title={t('sessionTitle')}>
            {t('sessionOpenNote')}
          </Callout>
        ) : null}
        <div>
          <h3 className="patients-subheading">{t('fieldAllergies')}</h3>
          <AllergyList patient={patient} />
        </div>
        {patient.isolation === null ? null : (
          <Callout tone="danger" icon="isolation" title={t('fieldIsolation')}>
            {patient.isolation.types.map((type) => f.text(ISOLATION_LABEL[type])).join(', ')} · {f.text(patient.isolation.reason)}
          </Callout>
        )}
        {patient.alerts.length === 0 ? null : (
          <ul className="patients-alerts">
            {patient.alerts.map((alert) => (
              <li key={alert.text.en}>
                <Badge tone={alert.tone} icon={alert.tone === 'danger' || alert.tone === 'warning' ? 'alert' : 'info'}>
                  {f.text(alert.text)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <KeyValueList items={items} columns={2} />
      </div>
    </Card>
  );
}

export interface FindPatientProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (patientId: string | null) => void;
  readonly onRegister: () => void;
}

export function FindPatient({ query, onQueryChange, selectedId, onSelect, onRegister }: FindPatientProps): ReactNode {
  const t = useT(messages);
  const toast = useToast();
  const openPatient = useOpenPatient();
  const patients = useAllPatients();
  const [showAll, setShowAll] = useState(false);
  const [wristbandFor, setWristbandFor] = useState<Patient | null>(null);
  const [printed, setPrinted] = useState<ReadonlyMap<string, string>>(new Map());
  const hits = useMemo(() => searchPatients(patients, query), [patients, query]);
  const rows: readonly ResultProps['hit'][] =
    query.trim() === '' ? (showAll ? patients.map((patient) => ({ patient, kind: null, forms: [] })) : []) : hits;
  const selected = selectedId === null ? undefined : patients.find((patient) => patient.id === selectedId);

  return (
    <div className="patients-find">
      <div className="patients-find__search">
        <SearchField
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={onQueryChange}
          autoFocus
          className="patients-find__field"
        />
        <p className="patients-hint">{t('searchHint')}</p>
        <div className="patients-examples" role="group" aria-label={t('tryLabel')}>
          <span className="patients-examples__label">{t('tryLabel')}</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.query}
              type="button"
              className="patients-example"
              onClick={() => {
                onQueryChange(example.query);
              }}
            >
              <Bdi dir={example.dir}>{example.query}</Bdi>
            </button>
          ))}
        </div>
      </div>

      <div className="patients-find__layout">
        <section className="patients-find__results" aria-label={t('resultsLabel')}>
          <div className="patients-find__results-head">
            <p className="patients-count" aria-live="polite">
              {query.trim() === '' && !showAll ? t('startCount', { count: patients.length }) : t('resultCount', { count: rows.length })}
            </p>
            {query.trim() === '' ? (
              <Button
                size="sm"
                variant="ghost"
                icon={showAll ? 'minus' : 'users'}
                onPress={() => {
                  setShowAll((value) => !value);
                }}
              >
                {showAll ? t('hideAll') : t('showAll', { count: patients.length })}
              </Button>
            ) : null}
          </div>
          {rows.length === 0 ? (
            query.trim() === '' ? (
              <EmptyState icon="search" title={t('startTitle')} body={t('startBody')} />
            ) : (
              <EmptyState
                icon="search"
                title={t('noResultsTitle')}
                body={t('noResultsBody')}
                action={
                  <Button variant="primary" icon="plus" onPress={onRegister}>
                    {t('tabRegister')}
                  </Button>
                }
              />
            )
          ) : (
            <ul className="patients-results">
              {rows.map((hit) => (
                <Result
                  key={hit.patient.id}
                  hit={hit}
                  selected={hit.patient.id === selectedId}
                  onSelect={() => {
                    onSelect(hit.patient.id);
                  }}
                  onOpen={() => {
                    openPatient(hit.patient.id, 'chart');
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className="patients-find__detail" aria-label={t('detailTitle')}>
          {selected === undefined ? (
            <Card title={t('detailTitle')} icon="user">
              <EmptyState compact icon="user" title={t('detailEmptyTitle')} body={t('detailEmptyBody')} />
            </Card>
          ) : (
            <Detail
              patient={selected}
              onOpen={(screen) => {
                openPatient(selected.id, screen);
              }}
              onWristband={() => {
                setWristbandFor(selected);
              }}
            />
          )}
        </aside>
      </div>

      <Dialog
        isOpen={wristbandFor !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setWristbandFor(null);
          }
        }}
        size="lg"
        title={t('wristbandTitle')}
        {...(wristbandFor === null ? {} : { subtitle: t('wristbandFor', { name: personName(wristbandFor.name, t.locale), mrn: wristbandFor.mrn }) })}
        actions={
          <>
            <Button
              variant="secondary"
              onPress={() => {
                setWristbandFor(null);
              }}
            >
              {t('close')}
            </Button>
            <Button
              variant="primary"
              icon="printer"
              onPress={() => {
                if (wristbandFor !== null) {
                  setPrinted((current) => new Map(current).set(wristbandFor.id, DEMO_NOW_ISO));
                  toast({ tone: 'success', title: t('printedToast'), body: t('printedToastBody') });
                }
              }}
            >
              {t('printWristband')}
            </Button>
          </>
        }
      >
        {wristbandFor === null ? null : <WristbandPreview patient={wristbandFor} printedIso={printed.get(wristbandFor.id) ?? null} />}
      </Dialog>
    </div>
  );
}
