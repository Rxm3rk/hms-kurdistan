/**
 * Documents tab: the patient's documents on the inline-start side, the selected one as an A4 page. The
 * discharge summary (clinic visit summary for outpatients) is generated from the record in the patient's
 * language, can be shown in another language, printed, "downloaded" (simulated) and signed by the
 * responsible doctor. Scanned paper forms are listed with a simulated preview.
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import { ToggleButton } from 'react-aria-components';
import { DEMO_NOW_ISO, findStaff, type Encounter, type Patient } from '../../data/index.ts';
import { useFormat, useT, type Locale } from '../../i18n/use-t.ts';
import { SignAction, useRole } from '../../shell/index.ts';
import { Badge, Button, Card, Icon, Segmented, StaffName, useToast, type IconName } from '../../ui/index.ts';
import { DischargeDocument, documentIdOf, summarySignerId } from './discharge-document.tsx';
import type { ChartMessageKey } from './chart-shared.tsx';
import { messages } from './messages.ts';

type DocId = 'summary' | 'consent' | 'identity';

const LANG_KEY: Readonly<Record<Locale, ChartMessageKey>> = { en: 'langEn', ckb: 'langCkb', ar: 'langAr' };

export interface DocumentsTabProps {
  readonly patient: Patient;
  readonly encounter: Encounter | undefined;
  readonly summarySignedIso: string | null;
  readonly onSummarySigned: () => void;
}

export function DocumentsTab({ patient, encounter, summarySignedIso, onSummarySigned }: DocumentsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { user } = useRole();
  const [selected, setSelected] = useState<DocId>('summary');
  const [docLocale, setDocLocale] = useState<Locale>(patient.preferredLanguage);
  const inpatient = encounter?.type === 'inpatient';
  const signerId = summarySignerId(patient, encounter);
  const signer = findStaff(signerId);
  const signed = summarySignedIso !== null;

  const docs: readonly { readonly id: DocId; readonly title: string; readonly icon: IconName; readonly status: ReactNode; readonly meta: string }[] = [
    {
      id: 'summary',
      title: t(inpatient ? 'docSummary' : 'docClinic'),
      icon: 'clipboard',
      status: signed ? (
        <Badge tone="success" icon="check" size="sm">
          {t('docStatusSigned')}
        </Badge>
      ) : (
        <Badge tone="warning" icon="pen" size="sm">
          {t('docStatusDraft')}
        </Badge>
      ),
      meta: t('docGenerated', { time: f.dateTime(DEMO_NOW_ISO) }),
    },
    {
      id: 'consent',
      title: t('docConsent'),
      icon: 'pen',
      status: (
        <Badge tone="neutral" icon="scan" size="sm">
          {t('docStatusScanned')}
        </Badge>
      ),
      meta: t('docScannedOn', { date: f.date(encounter?.startIso ?? DEMO_NOW_ISO) }),
    },
    {
      id: 'identity',
      title: t('docIdentity'),
      icon: 'user',
      status: (
        <Badge tone="neutral" icon="scan" size="sm">
          {t('docStatusScanned')}
        </Badge>
      ),
      meta: t('docScannedOn', { date: f.date(patient.registeredOn) }),
    },
  ];

  const languageOptions = (['ckb', 'ar', 'en'] as const).map((locale) => ({
    id: locale,
    label: locale === patient.preferredLanguage ? `${t(LANG_KEY[locale])} (${t('patientLanguage')})` : t(LANG_KEY[locale]),
  }));

  return (
    <div className="chart-docs">
      <Card title={t('docsTitle')} icon="clipboard" flush className="chart-docs__list-card">
        <ul className="chart-docs__list" aria-label={t('docsListLabel')}>
          {docs.map((doc) => (
            <li key={doc.id}>
              <ToggleButton
                className="chart-docs__item"
                isSelected={selected === doc.id}
                onChange={() => {
                  setSelected(doc.id);
                }}
              >
                <Icon name={doc.icon} className="chart-docs__icon" />
                <span className="chart-docs__text">
                  <span className="chart-docs__title">{doc.title}</span>
                  <span className="chart-docs__meta">{doc.meta}</span>
                  <span>{doc.status}</span>
                </span>
              </ToggleButton>
            </li>
          ))}
        </ul>
      </Card>

      <div className="chart-docs__preview">
        {selected === 'summary' ? (
          <>
            <div className="chart-docs__toolbar">
              <Segmented
                label={t('docLanguage')}
                value={docLocale}
                onChange={(id) => {
                  setDocLocale(id === 'en' || id === 'ar' ? id : 'ckb');
                }}
                options={languageOptions}
              />
              <div className="chart-docs__buttons">
                <Button
                  icon="printer"
                  variant="secondary"
                  onPress={() => {
                    window.print();
                  }}
                >
                  {t('print')}
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => {
                    toast({ tone: 'info', title: t('downloadToastTitle'), body: t('downloadToastBody') });
                  }}
                >
                  {t('download')}
                </Button>
                {signed || signer === undefined || signerId !== user.id ? null : (
                  <SignAction
                    label={t('signSummary')}
                    review={
                      <div className="chart-review">
                        <p className="chart-review__label">{t(inpatient ? 'docSummary' : 'docClinic')}</p>
                        <p className="chart-review__title">
                          <Bdi dir="ltr">{documentIdOf(patient)}</Bdi>
                        </p>
                        <p className="chart-review__hint">{t('signHint')}</p>
                      </div>
                    }
                    onSigned={onSummarySigned}
                  />
                )}
                {signed || signer === undefined || signerId === user.id ? null : (
                  <span className="chart-docs__awaiting">{t.rich('awaitingSignature', { name: <StaffName member={signer} /> })}</span>
                )}
              </div>
            </div>
            <p className="chart-docs__label">
              <Badge tone="info" icon="info" size="sm">
                {t('previewLabel')}
              </Badge>
              <span className="chart-muted">{t('previewHint')}</span>
            </p>
            <div className="chart-docs__paper-bg">
              <DischargeDocument patient={patient} encounter={encounter} locale={docLocale} signed={signed} signedIso={summarySignedIso} />
            </div>
          </>
        ) : (
          <>
            <p className="chart-docs__label">
              <Badge tone="info" icon="scan" size="sm">
                {t('scannedTitle')}
              </Badge>
            </p>
            <div className="chart-docs__paper-bg">
              <div className="chart-a4 chart-a4--scan" role="img" aria-label={t('scannedTitle')}>
                <div className="chart-scan">
                  <span className="chart-scan__line chart-scan__line--title" />
                  {Array.from({ length: 14 }, (_, i) => (
                    <span key={i} className={i % 4 === 3 ? 'chart-scan__line chart-scan__line--short' : 'chart-scan__line'} />
                  ))}
                  <span className="chart-scan__box" />
                </div>
                <p className="chart-scan__note">
                  <Icon name="scan" /> {t('scannedBody')}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
