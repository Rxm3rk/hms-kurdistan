/**
 * The discharge summary (or, for outpatients, the clinic visit summary) as an A4 page, written in the
 * document's language (the patient's preferred language by default) whatever the screen's language, with the
 * name in that script and a Latin-script name line. Labelled as a simulated PDF/A preview; no file is made.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  HOSPITAL,
  ROUTE_LABEL,
  SEX_LABEL,
  findStaff,
  getDepartment,
  locationOf,
  ordersOf,
  type Encounter,
  type Order,
  type Patient,
} from '../../data/index.ts';
import { formatDate, formatDateTime, pickText, type Locale } from '../../i18n/use-t.ts';
import { Qty, staffName } from '../../ui/index.ts';
import { DISCHARGE_TEXT } from './chart-data.ts';
import { docText } from './document-text.ts';

const NAME_SCRIPT: Readonly<Record<Locale, 'latin' | 'ckb' | 'ar'>> = { en: 'latin', ckb: 'ckb', ar: 'ar' };
const SHOWN: ReadonlySet<Order['status']> = new Set(['active', 'in-progress', 'on-hold']);

export interface DischargeDocumentProps {
  readonly patient: Patient;
  readonly encounter: Encounter | undefined;
  readonly locale: Locale;
  readonly signed: boolean;
  readonly signedIso: string | null;
}

/** The document number shown in the header. */
export function documentIdOf(patient: Patient): string {
  return `SYN-DOC-${patient.id.slice(-4)}-DS1`;
}

/** The doctor who signs the summary. */
export function summarySignerId(patient: Patient, encounter: Encounter | undefined): string | undefined {
  return DISCHARGE_TEXT[patient.id]?.signerId ?? encounter?.attendingId;
}

export function DischargeDocument({ patient, encounter, locale, signed, signedIso }: DischargeDocumentProps): ReactNode {
  const d = (key: Parameters<typeof docText>[1], vars?: Readonly<Record<string, string>>): string => docText(locale, key, vars);
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const inpatient = encounter?.type === 'inpatient';
  const where = locationOf(patient.id);
  const consultant = findStaff(encounter?.attendingId);
  const signer = findStaff(summarySignerId(patient, encounter));
  const extra = DISCHARGE_TEXT[patient.id];
  const primary = encounter?.diagnoses.find((dx) => dx.primary) ?? encounter?.diagnoses[0];
  const department = encounter === undefined ? undefined : pickText(getDepartment(encounter.departmentId).name, locale);
  const meds = ordersOf(patient.id).filter((order) => order.category === 'medication' && order.medication !== null && SHOWN.has(order.status));
  const dob = patient.dobPrecision === 'day' ? formatDate(patient.dob, locale) : patient.dob;

  let course: string;
  let followUp: string;
  if (extra !== undefined) {
    course = pickText(extra.course, locale);
    followUp = pickText(extra.followUp, locale);
  } else if (inpatient && encounter !== undefined) {
    course = d('genericCourse', { date: formatDate(encounter.startIso, locale), dx: primary === undefined ? '' : pickText(primary.text, locale) });
    followUp = d('genericFollow');
  } else {
    course = d('clinicCourse', {
      department: department ?? '',
      date: formatDate(encounter?.startIso ?? DEMO_NOW_ISO, locale),
      reason: encounter === undefined ? '' : pickText(encounter.reason, locale),
    });
    followUp = d('clinicFollow');
  }

  const field = (label: string, value: ReactNode): ReactNode => (
    <div className="chart-a4__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <article className="chart-a4" lang={locale === 'ckb' ? 'ckb' : locale} dir={dir} aria-label={d(inpatient ? 'titleDischarge' : 'titleClinic')}>
      {signed ? null : (
        <span className="chart-a4__watermark" aria-hidden="true">
          {d('draftMark')}
        </span>
      )}
      <header className="chart-a4__header">
        <div className="chart-a4__org">
          <svg className="chart-a4__logo" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="1" y="1" width="38" height="38" rx="8" />
            <path d="M16 9h8v7h7v8h-7v7h-8v-7H9v-8h7z" />
          </svg>
          <div>
            <p className="chart-a4__hospital">{pickText(HOSPITAL.name, locale)}</p>
            <p className="chart-a4__address">{pickText(HOSPITAL.address, locale)}</p>
            <p className="chart-a4__address">
              {d('phone')}: <Bdi dir="ltr">{HOSPITAL.phone}</Bdi>
            </p>
          </div>
        </div>
        <div className="chart-a4__doc">
          <h3 className="chart-a4__title">{d(inpatient ? 'titleDischarge' : 'titleClinic')}</h3>
          <p className="chart-a4__docmeta">
            {d('documentId')}: <Bdi dir="ltr">{documentIdOf(patient)}</Bdi>
          </p>
          <p className="chart-a4__docmeta">
            {d('generated')}: <Bdi dir={dir}>{formatDateTime(DEMO_NOW_ISO, locale)}</Bdi>
          </p>
        </div>
      </header>

      <section className="chart-a4__patient">
        <p className="chart-a4__label">{d('patient')}</p>
        <p className="chart-a4__name">
          <Bdi dir={NAME_SCRIPT[locale] === 'latin' ? 'ltr' : 'rtl'} lang={NAME_SCRIPT[locale] === 'latin' ? 'ckb-Latn' : NAME_SCRIPT[locale]}>
            {patient.name[NAME_SCRIPT[locale]]}
          </Bdi>
        </p>
        {locale === 'en' ? null : (
          <p className="chart-a4__latin">
            {d('nameLatin')}:{' '}
            <Bdi dir="ltr" lang="ckb-Latn">
              {patient.name.latin}
            </Bdi>
          </p>
        )}
        <dl className="chart-a4__fields">
          {field(d('mrn'), <Bdi dir="ltr">{patient.mrn}</Bdi>)}
          {field(
            d('dob'),
            <>
              <Bdi dir={dir}>{dob}</Bdi>
              {patient.dobApproximate ? ` ${d('approximate')}` : ''}
            </>,
          )}
          {field(d('sex'), SEX_LABEL[patient.sex][locale])}
          {inpatient && encounter !== undefined ? (
            <>
              {field(d('admitted'), <Bdi dir={dir}>{formatDateTime(encounter.startIso, locale)}</Bdi>)}
              {field(d('expectedDischarge'), encounter.expectedDischargeOn === null ? d('notSet') : <Bdi dir={dir}>{formatDate(encounter.expectedDischargeOn, locale)}</Bdi>)}
              {field(
                d('wardBed'),
                where === undefined ? (
                  d('notSet')
                ) : (
                  <>
                    {pickText(where.ward.name, locale)} · <Bdi dir="ltr">{where.bedId}</Bdi>
                  </>
                ),
              )}
            </>
          ) : (
            <>
              {field(d('visitDate'), <Bdi dir={dir}>{formatDate(encounter?.startIso ?? DEMO_NOW_ISO, locale)}</Bdi>)}
              {field(d('department'), department ?? d('notSet'))}
            </>
          )}
          {field(d('consultant'), consultant === undefined ? d('notSet') : staffName(consultant, locale))}
        </dl>
      </section>

      <section className="chart-a4__section">
        <h4>{d('diagnoses')}</h4>
        <ul className="chart-a4__list">
          {(encounter?.diagnoses ?? []).map((dx) => (
            <li key={dx.code}>
              <Bdi dir="ltr" className="chart-a4__code">
                {dx.code}
              </Bdi>{' '}
              {pickText(dx.text, locale)}
              {dx.primary ? <span className="chart-a4__primary"> ({d('primary')})</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="chart-a4__section">
        <h4>{d(inpatient ? 'course' : 'courseClinic')}</h4>
        <p>{course}</p>
      </section>

      <section className="chart-a4__section chart-a4__section--allergy">
        <h4>{d('allergies')}</h4>
        {patient.allergies.kind === 'list' ? (
          <ul className="chart-a4__list">
            {patient.allergies.items.map((item) => (
              <li key={item.code}>
                <strong>{pickText(item.substance, locale)}</strong>
                {item.reaction === undefined ? '' : ` – ${pickText(item.reaction, locale)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>{d(patient.allergies.kind === 'nka' ? 'nka' : 'notAssessed')}</p>
        )}
      </section>

      <section className="chart-a4__section">
        <h4>{d('meds')}</h4>
        {meds.length === 0 ? (
          <p>{d('noMeds')}</p>
        ) : (
          <table className="chart-a4__meds">
            <tbody>
              {meds.map((order) =>
                order.medication === null ? null : (
                  <tr key={order.id}>
                    <td>
                      <Bdi dir="ltr" lang="en">
                        {order.medication.drug}
                      </Bdi>
                    </td>
                    <td className="chart-num">
                      <Qty value={order.medication.dose} unit={order.medication.doseUnit} />
                    </td>
                    <td>{pickText(ROUTE_LABEL[order.medication.route], locale)}</td>
                    <td>{pickText(order.medication.frequency, locale)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="chart-a4__section">
        <h4>{d('followUp')}</h4>
        <p>{followUp}</p>
      </section>

      <section className="chart-a4__signature">
        <h4>{d('signature')}</h4>
        {signer === undefined ? null : signed && signedIso !== null ? (
          <p className="chart-a4__signed">
            {d('signedBy', { name: staffName(signer, locale), date: formatDateTime(signedIso, locale) })}
            <br />
            <Bdi dir="ltr" className="chart-a4__code">
              SYN-SIG-{patient.id.slice(-4)}-7F3A-91C2
            </Bdi>
          </p>
        ) : (
          <p className="chart-a4__unsigned">{d('awaiting', { name: staffName(signer, locale) })}</p>
        )}
      </section>

      <footer className="chart-a4__footer">
        <span>{d('footer')}</span>
        <span>{d('page')}</span>
      </footer>
    </article>
  );
}
