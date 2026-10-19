/**
 * Timeline tab: everything that happened to the patient on one line, newest first, grouped by day: the
 * admission or clinic visit, the planned discharge, orders, laboratory results (critical ones in the danger
 * tone), notes, NEWS2 escalations, earlier visits and procedures, and the registration at the hospital.
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  DEMO_TODAY,
  NOTE_KIND_LABEL,
  ORDER_CATEGORY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  RESULT_FLAG_LABEL,
  demoDate,
  findStaff,
  getDepartment,
  locationOf,
  ordersOf,
  resultsOfSpecimen,
  specimensOf,
  type Encounter,
  type Patient,
  type Tone,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Card, EmptyState, Icon, Qty, Segmented, StaffName, type IconName } from '../../ui/index.ts';
import { historyOf, type ChartNote, type ChartVitals, type HistoryKind } from './chart-data.ts';
import type { ChartMessageKey, NewsView } from './chart-shared.tsx';
import { messages } from './messages.ts';
import type { News2Band } from './news2.ts';

type TlKind = 'care' | 'order' | 'result' | 'note';
type TlFilter = 'all' | TlKind;

interface TlEvent {
  readonly id: string;
  readonly iso: string;
  readonly kind: TlKind;
  readonly icon: IconName;
  readonly tone?: Tone;
  readonly title: ReactNode;
  readonly detail?: ReactNode;
  readonly badge?: ReactNode;
  readonly future?: boolean;
}

const HISTORY_ICON: Readonly<Record<HistoryKind, IconName>> = { encounter: 'stethoscope', procedure: 'building', allergy: 'alert', diagnosis: 'clipboard' };
const ORDER_ICON: Readonly<Record<string, IconName>> = { lab: 'flask', imaging: 'scan', medication: 'pill', nursing: 'heart', diet: 'droplet', consult: 'users' };
const ESCALATING: ReadonlySet<News2Band> = new Set(['low-medium', 'medium', 'high']);

export interface TimelineTabProps {
  readonly patient: Patient;
  readonly encounter: Encounter | undefined;
  readonly notes: readonly ChartNote[];
  readonly vitals: readonly ChartVitals[];
  readonly news: NewsView;
}

export function TimelineTab({ patient, encounter, notes, vitals, news }: TimelineTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [filter, setFilter] = useState<TlFilter>('all');
  const events: TlEvent[] = [];

  if (encounter !== undefined) {
    const where = locationOf(patient.id);
    events.push({
      id: `enc-${encounter.id}`,
      iso: encounter.startIso,
      kind: 'care',
      icon: encounter.type === 'inpatient' ? 'bed' : 'stethoscope',
      tone: 'accent',
      title:
        encounter.type === 'inpatient' && where !== undefined
          ? t.rich('eventAdmitted', { ward: f.text(where.ward.name), bed: <Bdi dir="ltr">{where.bedId}</Bdi> })
          : t('eventClinicVisit', { department: f.text(getDepartment(encounter.departmentId).name) }),
      detail: f.text(encounter.reason),
      future: encounter.startIso > DEMO_NOW_ISO,
    });
    if (encounter.expectedDischargeOn !== null) {
      events.push({
        id: `dis-${encounter.id}`,
        iso: `${encounter.expectedDischargeOn}T12:00:00+03:00`,
        kind: 'care',
        icon: 'calendar',
        title: t('eventPlannedDischarge'),
        future: encounter.expectedDischargeOn >= DEMO_TODAY,
      });
    }
  }
  events.push({
    id: 'registered',
    iso: `${patient.registeredOn}T09:00:00+03:00`,
    kind: 'care',
    icon: 'user',
    title: t('eventRegistered'),
  });
  for (const item of historyOf(patient.id)) {
    events.push({
      id: `hist-${item.iso}-${item.kind}`,
      iso: item.iso,
      kind: 'care',
      icon: HISTORY_ICON[item.kind],
      ...(item.kind === 'allergy' ? { tone: 'danger' as const } : {}),
      title: f.text(item.title),
      ...(item.detail === null ? {} : { detail: f.text(item.detail) }),
      badge: (
        <Badge tone={item.kind === 'allergy' ? 'danger' : 'neutral'} size="sm">
          {t(`history_${item.kind}` as ChartMessageKey)}
        </Badge>
      ),
    });
  }
  for (const order of ordersOf(patient.id)) {
    const orderer = findStaff(order.orderedById);
    const danger = order.alerts.some((alert) => alert.tone === 'danger');
    events.push({
      id: `ord-${order.id}`,
      iso: order.orderedIso,
      kind: 'order',
      icon: ORDER_ICON[order.category] ?? 'clipboard',
      ...(danger ? { tone: 'danger' as const } : {}),
      title: t.rich('eventOrder', {
        category: f.text(ORDER_CATEGORY_LABEL[order.category]),
        title: order.medication === null ? f.text(order.title) : <Bdi dir="ltr">{order.medication.drug}</Bdi>,
      }),
      ...(orderer === undefined ? {} : { detail: t.rich('orderedBy', { name: <StaffName member={orderer} /> }) }),
      badge: (
        <Badge tone={ORDER_STATUS_TONE[order.status]} size="sm">
          {f.text(ORDER_STATUS_LABEL[order.status])}
        </Badge>
      ),
    });
  }
  for (const specimen of specimensOf(patient.id)) {
    if (specimen.resultedIso === null) {
      continue;
    }
    const results = resultsOfSpecimen(specimen.id);
    const flagged = results.filter((result) => result.flag !== 'normal');
    const critical = results.some((result) => result.critical !== null);
    events.push({
      id: `res-${specimen.id}`,
      iso: specimen.resultedIso,
      kind: 'result',
      icon: 'flask',
      ...(critical ? { tone: 'danger' as const } : flagged.length > 0 ? { tone: 'warning' as const } : {}),
      title: t('eventResults', { panel: f.text(specimen.panel) }),
      detail:
        flagged.length === 0 ? (
          t('eventResultsNormal')
        ) : (
          <span className="chart-tl__results">
            {flagged.map((result) => (
              <span key={result.id} className={result.critical === null ? 'chart-tl__result' : 'chart-tl__result chart-tl__result--critical'}>
                {f.text(result.analyte)}{' '}
                {result.value === null ? (result.text === null ? null : f.text(result.text)) : <Qty value={result.value} unit={result.unit} />}{' '}
                <span className="chart-muted">({f.text(RESULT_FLAG_LABEL[result.flag])})</span>
              </span>
            ))}
          </span>
        ),
      ...(critical
        ? {
            badge: (
              <Badge tone="danger" strong icon="alert" size="sm">
                {t('critical')}
              </Badge>
            ),
          }
        : {}),
    });
  }
  for (const note of notes) {
    const author = findStaff(note.authorId);
    events.push({
      id: `note-${note.id}`,
      iso: note.clinicalIso,
      kind: 'note',
      icon: 'pen',
      title: (
        <>
          <span className="chart-tl__kind">{f.text(NOTE_KIND_LABEL[note.kind])}:</span> {f.text(note.title)}
        </>
      ),
      ...(author === undefined ? {} : { detail: t.rich('byAuthor', { name: <StaffName member={author} /> }) }),
      badge: note.signed ? (
        <Badge tone="success" icon="check" size="sm">
          {t('signed')}
        </Badge>
      ) : (
        <Badge tone="warning" icon="pen" strong size="sm">
          {t('draft')}
        </Badge>
      ),
    });
  }
  // NEWS2 escalations: the first set of each run in a low-medium, medium or high band.
  let previous: News2Band | null = null;
  vitals.forEach((set, i) => {
    const score = news.scores[i] ?? null;
    if (score === null) {
      return;
    }
    if (ESCALATING.has(score.band) && score.band !== previous) {
      events.push({
        id: `news-${set.iso}`,
        iso: set.iso,
        kind: 'result',
        icon: 'activity',
        tone: score.band === 'high' ? 'danger' : 'warning',
        title: t('eventNews', { score: score.total, band: t(`newsBand_${score.band}` as ChartMessageKey) }),
      });
    }
    previous = score.band;
  });

  const visible = events.filter((event) => filter === 'all' || event.kind === filter).toSorted((a, b) => b.iso.localeCompare(a.iso));
  const groups: { key: string; label: string; items: TlEvent[] }[] = [];
  for (const event of visible) {
    const day = event.iso.slice(0, 10);
    const key = event.future === true ? 'planned' : day;
    let group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) {
      const label =
        key === 'planned'
          ? t('planned')
          : day === DEMO_TODAY
            ? `${t('today')} · ${f.date(event.iso, 'long')}`
            : day === demoDate(1)
              ? `${t('yesterday')} · ${f.date(event.iso, 'long')}`
              : f.date(event.iso, 'long');
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(event);
  }

  return (
    <Card
      title={t('timelineTitle')}
      icon="clock"
      actions={<Badge tone="neutral">{t('eventsCount', { count: visible.length })}</Badge>}
    >
      <div className="chart-stack">
        <Segmented
          label={t('timelineFilter')}
          value={filter}
          onChange={(value) => {
            setFilter(value === 'care' || value === 'order' || value === 'result' || value === 'note' ? value : 'all');
          }}
          options={[
            { id: 'all', label: t('tlAll') },
            { id: 'care', label: t('tlCare') },
            { id: 'order', label: t('tlOrders') },
            { id: 'result', label: t('tlResults') },
            { id: 'note', label: t('tlNotes') },
          ]}
        />
        {groups.length === 0 ? (
          <EmptyState compact icon="filter" title={t('noEvents')} />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="chart-tl__group">
              <h3 className="chart-day-heading">{group.label}</h3>
              <ol className="chart-tl">
                {group.items.map((event) => (
                  <li key={event.id} className={['chart-tl__item', event.tone === undefined ? '' : `chart-tl__item--${event.tone}`, event.future === true ? 'chart-tl__item--future' : ''].filter(Boolean).join(' ')}>
                    <span className="chart-tl__time">
                      <Bdi dir="ltr">{event.future === true ? f.date(event.iso, 'short') : f.time(event.iso)}</Bdi>
                    </span>
                    <span className="chart-tl__marker" aria-hidden="true">
                      <Icon name={event.icon} size="0.95rem" />
                    </span>
                    <span className="chart-tl__content">
                      <span className="chart-tl__title">
                        {event.title}
                        {event.badge ?? null}
                      </span>
                      {event.detail === undefined ? null : <span className="chart-tl__detail">{event.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
      </div>
    </Card>
  );
}
