/**
 * The eMAR screen (medication administration record; patient-scoped: rendered under the PatientBanner by
 * the clinical layout).
 *
 * - Today's grid: rows are medicines, columns are hours; doses are scheduled, due, late, missed, given, not
 *   given, held, running (infusions) or not active (order not signed).
 * - "Due and late now" worklist and the late-dose warnings.
 * - The administration panel for a dose: simulated wristband and medicine scans (with a wrong-patient hard
 *   stop), the five rights, the second-nurse co-signature for high-alert medicines, then given or not given.
 *   The rules panel shows what the dose's state allows now. Documentation stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, minutesFromNow, ROUTE_LABEL } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useScreenHref } from '../../shell/index.ts';
import { Button, Callout, Card, Code, EmptyState, Grid, LinkButton, PageHeader, Qty, StatTile, useToast } from '../../ui/index.ts';
import { MarGrid, StateChip } from './grid.tsx';
import { messages } from './messages.ts';
import { buildRows, clockOf, clockPlus, DOSE_STATES, orderIsActive, type GridDose, type LocalDoc, type MedRow } from './model.ts';
import { AdminPanel } from './panel.tsx';
import './emar.css';

type Selection = { readonly kind: 'dose'; readonly id: string } | { readonly kind: 'prn'; readonly orderId: string; readonly seq: number };

export function EmarScreen(): ReactNode {
  const { patient } = useClinicalPatient();
  // A new patient starts with a fresh record view (no half-finished administration carried over).
  return <EmarWorkspace key={patient.id} />;
}

function freshPrnDose(row: MedRow, seq: number): GridDose {
  return {
    id: `prn-new-${row.order.id}-${String(seq)}`,
    orderId: row.order.id,
    scheduledIso: DEMO_NOW_ISO,
    state: 'due',
    mar: null,
    doc: null,
    prn: true,
    fresh: true,
  };
}

function resolveSelection(selection: Selection | null, rows: readonly MedRow[]): { readonly row: MedRow; readonly dose: GridDose } | undefined {
  if (selection === null) {
    return undefined;
  }
  if (selection.kind === 'dose') {
    for (const row of rows) {
      const dose = row.doses.find((candidate) => candidate.id === selection.id);
      if (dose !== undefined) {
        return { row, dose };
      }
    }
    return undefined;
  }
  const row = rows.find((candidate) => candidate.order.id === selection.orderId);
  return row === undefined ? undefined : { row, dose: freshPrnDose(row, selection.seq) };
}

function EmarWorkspace(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const href = useScreenHref();
  const { patient } = useClinicalPatient();

  const [docs, setDocs] = useState<ReadonlyMap<string, LocalDoc>>(new Map());
  const [extra, setExtra] = useState<readonly GridDose[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [prnSeq, setPrnSeq] = useState(0);

  const rows = useMemo(() => buildRows(patient.id, docs, extra), [patient.id, docs, extra]);
  const all = rows.flatMap((row) => row.doses.map((dose) => ({ row, dose })));

  const selected = resolveSelection(selection, rows);

  const duration = (minutes: number): string =>
    minutes < 60 ? t('minutes', { count: minutes }) : t('hoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 });

  const count = (...states: readonly GridDose['state'][]): number => all.filter((entry) => states.includes(entry.dose.state)).length;
  const worklist = all.filter((entry) => entry.dose.state === 'due' || entry.dose.state === 'late' || entry.dose.state === 'missed');
  const late = all.filter((entry) => entry.dose.state === 'late' || entry.dose.state === 'missed');
  const next = all.filter((entry) => entry.dose.state === 'scheduled').sort((a, b) => a.dose.scheduledIso.localeCompare(b.dose.scheduledIso))[0];
  const highAlertCount = rows.filter((row) => row.med.highAlert && orderIsActive(row.order)).length;

  const select = (dose: GridDose): void => setSelection({ kind: 'dose', id: dose.id });
  const givePrn = (row: MedRow): void => {
    setPrnSeq((current) => current + 1);
    setSelection({ kind: 'prn', orderId: row.order.id, seq: prnSeq + 1 });
  };

  const onDocument = (row: MedRow, dose: GridDose, doc: LocalDoc): void => {
    if (dose.fresh) {
      setExtra((current) => [
        ...current,
        { ...dose, id: `prn-${row.order.id}-${String(current.length + 1)}`, scheduledIso: doc.iso, state: doc.kind, doc, fresh: false },
      ]);
    } else {
      setDocs((current) => new Map(current).set(dose.id, doc));
    }
    setSelection(null);
    toast({
      tone: doc.kind === 'given' ? 'success' : 'warning',
      title: doc.kind === 'given' ? t('documentedToast', { drug: row.med.drug, time: clockOf(doc.iso) }) : t('notGivenToast', { drug: row.med.drug }),
      body: t('demoOnly'),
    });
  };

  const header = (
    <PageHeader
      eyebrow={t('todayEyebrow', { date: f.date(DEMO_NOW_ISO, 'long'), time: '09:30' })}
      icon="pill"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <LinkButton href={href('orders')} icon="clipboard">
          {t('goOrders')}
        </LinkButton>
      }
    />
  );

  if (rows.length === 0) {
    return (
      <div className="emar-screen" data-patient-id={patient.id}>
        {header}
        <EmptyState
          icon="pill"
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <LinkButton href={href('orders')} variant="primary" icon="clipboard">
              {t('goOrders')}
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="emar-screen" data-patient-id={patient.id}>
      {header}

      <Grid min="12rem">
        <StatTile icon="clock" {...(count('due') > 0 ? { tone: 'accent' as const } : {})} label={t('statDue')} value={String(count('due'))} />
        <StatTile
          icon="alert"
          {...(late.length > 0 ? { tone: late.some((entry) => entry.dose.state === 'missed') ? ('danger' as const) : ('warning' as const) } : {})}
          label={t('statLate')}
          value={String(late.length)}
        />
        <StatTile icon="check-circle" tone="success" label={t('statGiven')} value={String(count('given'))} />
        <StatTile
          icon="minus"
          {...(count('held', 'not-given') > 0 ? { tone: 'warning' as const } : {})}
          label={t('statHeld')}
          value={String(count('held', 'not-given'))}
          hint={t('statHighAlert', { count: highAlertCount })}
        />
      </Grid>

      {late.map(({ row, dose }) => {
        const ago = -minutesFromNow(dose.scheduledIso);
        return (
          <Callout
            key={dose.id}
            tone={dose.state === 'missed' ? 'danger' : 'warning'}
            title={t.rich('lateTitle', { drug: <Code>{row.med.drug}</Code> })}
            actions={
              <Button variant="primary" size="sm" icon="pill" onPress={() => select(dose)}>
                {t('give')}
              </Button>
            }
          >
            {t('lateBody', { time: clockOf(dose.scheduledIso), late: duration(ago), missed: clockPlus(dose.scheduledIso, 120) })}
          </Callout>
        );
      })}

      <div className="emar-top">
        <Card icon="clock" title={t('worklistTitle')} className="emar-worklist">
          {worklist.length === 0 ? (
            <EmptyState compact icon="check-circle" title={t('worklistEmpty')} {...(next === undefined ? {} : { body: t('worklistNext', { time: clockOf(next.dose.scheduledIso) }) })} />
          ) : (
            <ul className="emar-worklist__list">
              {worklist
                .toSorted((a, b) => a.dose.scheduledIso.localeCompare(b.dose.scheduledIso))
                .map(({ row, dose }) => {
                  const ago = -minutesFromNow(dose.scheduledIso);
                  return (
                    <li key={dose.id} className={`emar-work emar-work--${dose.state}`}>
                      <span className="emar-work__time">{clockOf(dose.scheduledIso)}</span>
                      <span className="emar-work__what">
                        <Code className="emar-strong">{row.med.drug}</Code>
                        <span className="emar-work__line">
                          <Qty value={row.med.dose} unit={row.med.doseUnit} /> · {f.text(ROUTE_LABEL[row.med.route])}
                        </span>
                      </span>
                      <span className="emar-work__state">
                        <StateChip state={dose.state} />
                        <span className="emar-muted emar-small">
                          {dose.state === 'due'
                            ? t('dueAt', { time: clockOf(dose.scheduledIso) })
                            : `${t('lateBy', { duration: duration(ago) })} · ${t('missedAt', { time: clockPlus(dose.scheduledIso, 120) })}`}
                        </span>
                      </span>
                      <Button variant={dose.state === 'due' ? 'primary' : 'secondary'} size="sm" icon="pill" onPress={() => select(dose)}>
                        {t('give')}
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
        <Card icon="info" title={t('legendTitle')} className="emar-legend">
          <ul className="emar-legend__list">
            {DOSE_STATES.map((state) => (
              <li key={state}>
                <StateChip state={state} />
              </li>
            ))}
          </ul>
          <p className="emar-muted emar-small">{t('legendRules')}</p>
          <p className="emar-muted emar-small">{t('simulatedScanner')}</p>
        </Card>
      </div>

      <Card icon="calendar" title={t('gridTitle')} subtitle={t('gridSubtitle')} flush>
        <MarGrid rows={rows} selectedId={selected?.dose.id ?? null} onSelect={select} onGivePrn={givePrn} />
      </Card>

      {selected === undefined ? null : (
        <AdminPanel
          key={selected.dose.id}
          row={selected.row}
          dose={selected.dose}
          patient={patient}
          onClose={() => setSelection(null)}
          onDocument={(doc) => onDocument(selected.row, selected.dose, doc)}
        />
      )}
    </div>
  );
}
