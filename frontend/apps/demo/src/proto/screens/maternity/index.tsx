/**
 * The Maternity screen (hospital-wide): the labour ward board, the partograph with examinations, the
 * delivery record that registers the newborn and links the baby to the mother, the newborn list with
 * wristband checks, and the KRG Ministry of Health birth-notification form preview.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, DEMO_TODAY } from '../../data/index.ts';
import {
  LABOUR_WOMEN,
  makeBaby,
  MEMBRANES_LABEL,
  MODE_LABEL,
  NEWBORNS,
  RISK_LABEL,
  STAGE_LABEL,
  STAGE_TONE,
  type LabourWoman,
  type Newborn,
} from '../../data/ext/maternity.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  Button,
  Card,
  Code,
  DataTable,
  EmptyState,
  PageHeader,
  PatientInline,
  PatientName,
  SelectField,
  StatTile,
  Tabs,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { DeliveryDialog, ExamDialog, NotificationDialog } from './dialogs.tsx';
import './maternity.css';
import { messages } from './messages.ts';
import { lineState, Partograph } from './partograph.tsx';

type DialogState = { readonly kind: 'exam' | 'delivery'; readonly id: string } | { readonly kind: 'notification'; readonly id: string } | null;

const IN_LABOUR = new Set(['latent', 'active', 'second', 'third']);

export function MaternityScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [women, setWomen] = useState<readonly LabourWoman[]>(LABOUR_WOMEN);
  const [babies, setBabies] = useState<readonly Newborn[]>(NEWBORNS);
  const [selected, setSelected] = useState('MAT-02');
  const [tab, setTab] = useState('board');
  const [dialog, setDialog] = useState<DialogState>(null);
  const nameOf = (w: LabourWoman): string => personName(w.patient.name, f.locale);
  const lastExam = (w: LabourWoman) => w.exams[w.exams.length - 1];

  // ---- KPIs ----------------------------------------------------------------------------------------
  const labouring = women.filter((w) => IN_LABOUR.has(w.stage));
  const late = labouring.filter((w) => w.stage === 'second' || w.stage === 'third').length;
  const birthsToday = babies.filter((b) => b.birthIso.startsWith(DEMO_TODAY));
  const csRate = birthsToday.length === 0 ? 0 : birthsToday.filter((b) => b.mode.endsWith('cs')).length / birthsToday.length;
  const alerts = women.filter((w) => lineState(w) !== 'none').length;
  const fhrConcern = labouring.filter((w) => {
    const e = lastExam(w);
    return e !== undefined && (e.fhr < 110 || e.fhr > 160);
  }).length;
  const toNotify = babies.filter((b) => b.notification === 'draft').length;

  // ---- board ---------------------------------------------------------------------------------------
  const columns: readonly Column<LabourWoman>[] = [
    { id: 'room', header: t('colRoom'), nowrap: true, cell: (w) => <Code className="maternity-room">{w.room}</Code> },
    { id: 'woman', header: t('colWoman'), cell: (w) => <PatientInline patient={w.patient} /> },
    {
      id: 'obs',
      header: t('colObstetric'),
      nowrap: true,
      cell: (w) => (
        <span className="maternity-cell-stack">
          <Code>{t('gp', { g: w.gravida, p: w.para })}</Code>
          <span className="maternity-muted">{t('ga', { w: w.gaWeeks, d: w.gaDays })}</span>
        </span>
      ),
    },
    {
      id: 'stage',
      header: t('colStage'),
      cell: (w) => {
        const line = lineState(w);
        return (
          <span className="maternity-cell-stack">
            <Badge tone={STAGE_TONE[w.stage]} size="sm">
              {f.text(STAGE_LABEL[w.stage])}
            </Badge>
            {line === 'none' ? null : (
              <Badge tone={line === 'action' ? 'danger' : 'warning'} size="sm" strong={line === 'action'} icon="alert">
                {line === 'action' ? t('actionLine') : t('alertLine')}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      id: 'cervix',
      header: t('colDilation'),
      nowrap: true,
      cell: (w) => {
        const e = lastExam(w);
        return e === undefined ? (
          <span className="maternity-muted">{t('noExam')}</span>
        ) : (
          <span className="maternity-cell-stack">
            <strong>{t('cm', { cm: e.dilationCm })}</strong>
            <span className="maternity-muted">{t('lastExam', { time: f.time(e.iso) })}</span>
          </span>
        );
      },
    },
    {
      id: 'fhr',
      header: t('colFhr'),
      align: 'end',
      cell: (w) => {
        const e = lastExam(w);
        if (e === undefined || w.stage === 'delivered') {
          return '–';
        }
        const bad = e.fhr < 110 || e.fhr > 160;
        return bad ? (
          <Badge tone="danger" size="sm" icon="heart">
            {e.fhr}
          </Badge>
        ) : (
          <span>{e.fhr}</span>
        );
      },
    },
    { id: 'membranes', header: t('colMembranes'), cell: (w) => <span className={w.membranes === 'meconium' ? 'maternity-warn' : undefined}>{f.text(MEMBRANES_LABEL[w.membranes])}</span> },
    {
      id: 'risks',
      header: t('colRisks'),
      cell: (w) => (
        <span className="maternity-inline">
          {w.risks.map((r) => (
            <Badge key={r} tone="warning" size="sm">
              {f.text(RISK_LABEL[r])}
            </Badge>
          ))}
          {w.oxytocin ? <Badge tone="accent" size="sm">{t('oxytocin')}</Badge> : null}
          {w.epidural ? <Badge tone="info" size="sm">{t('epidural')}</Badge> : null}
        </span>
      ),
    },
    {
      id: 'team',
      header: t('colTeam'),
      cell: (w) => (
        <span className="maternity-cell-stack">
          <span>{f.text(w.midwife)}</span>
          <span className="maternity-muted">{f.text(w.obstetrician)}</span>
        </span>
      ),
    },
  ];

  const board = (
    <DataTable
      caption={t('boardCaption')}
      columns={columns}
      rows={women}
      rowKey={(w) => w.id}
      onRowAction={(w) => {
        setSelected(w.id);
        setTab('partograph');
      }}
      rowTone={(w) => (lineState(w) === 'action' ? 'danger' : lineState(w) === 'alert' ? 'warning' : undefined)}
      selectedKey={selected}
    />
  );

  // ---- partograph ----------------------------------------------------------------------------------
  const woman = women.find((w) => w.id === selected) ?? women[0];
  const partograph =
    woman === undefined ? null : (
      <div className="maternity-stack">
        <div className="maternity-toolbar">
          <SelectField
            label={t('chooseWoman')}
            options={women.map((w) => ({ id: w.id, label: `${w.room} · ${nameOf(w)}` }))}
            selectedKey={woman.id}
            onSelectionChange={setSelected}
          />
          <span className="maternity-inline">
            <Button
              icon="plus"
              variant="primary"
              isDisabled={woman.stage === 'delivered'}
              onPress={() => {
                setDialog({ kind: 'exam', id: woman.id });
              }}
            >
              {t('addExam')}
            </Button>
            <Button
              icon="users"
              isDisabled={!(woman.stage === 'second' || woman.stage === 'third' || woman.stage === 'active' || woman.stage === 'antenatal')}
              onPress={() => {
                setDialog({ kind: 'delivery', id: woman.id });
              }}
            >
              {t('recordDelivery')}
            </Button>
          </span>
        </div>
        <Card
          title={
            <span className="maternity-inline">
              <Code className="maternity-room">{woman.room}</Code>
              <PatientName patient={woman.patient} />
              <Badge tone={STAGE_TONE[woman.stage]} size="sm">
                {f.text(STAGE_LABEL[woman.stage])}
              </Badge>
            </span>
          }
          subtitle={`${t('gp', { g: woman.gravida, p: woman.para })} · ${t('ga', { w: woman.gaWeeks, d: woman.gaDays })} · ${f.text(MEMBRANES_LABEL[woman.membranes])}`}
          icon="activity"
        >
          <p className="maternity-muted">{t('partographSubtitle')}</p>
          {woman.activeFromIso === null ? (
            <EmptyState compact icon="clock" title={t('notActive')} />
          ) : (
            <>
              <Partograph
                exams={woman.exams}
                activeFromIso={woman.activeFromIso}
                label={t('chartLabel', { name: nameOf(woman) })}
                axisHours={t('axisHours')}
                axisCm={t('axisCm')}
                alertLabel={t('legendAlert')}
                actionLabel={t('legendAction')}
              />
              <p className="maternity-legend">
                <span className="maternity-legend__item maternity-legend__item--dilation">{t('legendDilation')}</span>
                <span className="maternity-legend__item maternity-legend__item--descent">{t('legendDescent')}</span>
                <span className="maternity-legend__item maternity-legend__item--alert">{t('legendAlert')}</span>
                <span className="maternity-legend__item maternity-legend__item--action">{t('legendAction')}</span>
              </p>
            </>
          )}
          <DataTable
            caption={t('examsCaption')}
            showCaption
            rows={woman.exams.toReversed()}
            rowKey={(e) => e.iso}
            dense
            columns={[
              { id: 'time', header: t('colTime'), nowrap: true, cell: (e) => <Code>{f.time(e.iso)}</Code> },
              { id: 'dil', header: t('colDilation'), align: 'end', cell: (e) => t('cm', { cm: e.dilationCm }) },
              { id: 'desc', header: t('colDescent'), align: 'end', cell: (e) => `${String(e.descentFifths)}/5` },
              { id: 'fhr', header: t('colFhr'), align: 'end', cell: (e) => (e.fhr < 110 || e.fhr > 160 ? <Badge tone="danger" size="sm">{e.fhr}</Badge> : e.fhr) },
              { id: 'con', header: t('colContractions'), align: 'end', cell: (e) => e.contractions },
              { id: 'pulse', header: t('colPulse'), align: 'end', cell: (e) => (e.pulse === 0 ? '–' : e.pulse) },
              { id: 'bp', header: t('colBp'), align: 'end', cell: (e) => (e.sys === 0 ? '–' : <bdi dir="ltr" className={e.sys >= 140 || e.dia >= 90 ? 'maternity-warn' : undefined}>{`${String(e.sys)}/${String(e.dia)}`}</bdi>) },
            ]}
          />
        </Card>
      </div>
    );

  // ---- newborns ------------------------------------------------------------------------------------
  const motherOf = (b: Newborn): LabourWoman | undefined => women.find((w) => w.id === b.motherId);
  const newbornColumns: readonly Column<Newborn>[] = [
    { id: 'baby', header: t('colBaby'), cell: (b) => <PatientInline patient={b.baby} /> },
    {
      id: 'mother',
      header: t('colMother'),
      cell: (b) => {
        const m = motherOf(b);
        return m === undefined ? '–' : (
          <span className="maternity-cell-stack">
            <PatientName patient={m.patient} />
            <span className="maternity-muted">
              <Code>{m.patient.mrn}</Code> · {m.room}
            </span>
          </span>
        );
      },
    },
    { id: 'born', header: t('colBorn'), nowrap: true, cell: (b) => f.dateTime(b.birthIso) },
    { id: 'weight', header: t('colWeight'), align: 'end', nowrap: true, cell: (b) => (b.weightG < 2500 ? <Badge tone="warning" size="sm">{t('grams', { g: f.number(b.weightG) })}</Badge> : t('grams', { g: f.number(b.weightG) })) },
    { id: 'apgar', header: t('colApgar'), align: 'end', cell: (b) => t('apgarPair', { a1: b.apgar1, a5: b.apgar5 }) },
    { id: 'mode', header: t('colMode'), cell: (b) => f.text(MODE_LABEL[b.mode]) },
    {
      id: 'band',
      header: t('colBand'),
      cell: (b) =>
        b.bandsChecked ? (
          <span className="maternity-cell-stack">
            <Badge tone="success" size="sm" icon="check-circle">
              {t('bandsMatched')}
            </Badge>
            <Code>{b.bandId}</Code>
          </span>
        ) : (
          <Button
            size="sm"
            icon="scan"
            onPress={() => {
              setBabies((cur) => cur.map((x) => (x.id === b.id ? { ...x, bandsChecked: true } : x)));
              toast({ tone: 'success', title: t('bandsToast', { band: b.bandId }) });
            }}
          >
            {t('checkBands')}
          </Button>
        ),
    },
    {
      id: 'meds',
      header: `${t('vitK')} · ${t('vaccines')}`,
      cell: (b) => (
        <span className="maternity-inline">
          <Badge tone={b.vitaminK ? 'success' : 'warning'} size="sm">
            {t('vitK')}: {b.vitaminK ? t('given') : t('due')}
          </Badge>
          <Badge tone={b.bcgHepB ? 'success' : 'warning'} size="sm">
            {t('vaccines')}: {b.bcgHepB ? t('given') : t('due')}
          </Badge>
        </span>
      ),
    },
    {
      id: 'notification',
      header: t('colNotification'),
      cell: (b) => (
        <Button
          size="sm"
          variant={b.notification === 'draft' ? 'primary' : 'ghost'}
          icon="clipboard"
          onPress={() => {
            setDialog({ kind: 'notification', id: b.id });
          }}
        >
          {b.notification === 'draft' ? t('preview') : t('submitted')}
        </Button>
      ),
    },
  ];
  const newborns = (
    <DataTable caption={t('newbornsCaption')} columns={newbornColumns} rows={babies} rowKey={(b) => b.id} rowTone={(b) => (b.bandsChecked ? undefined : 'warning')} />
  );

  const notifications = (
    <div className="maternity-cards">
      {babies.map((b) => {
        const m = motherOf(b);
        return (
          <Card
            key={b.id}
            headingLevel={3}
            icon="clipboard"
            title={<Code>{b.notificationNo}</Code>}
            subtitle={`${f.dateTime(b.birthIso)} · ${b.sex === 'male' ? t('boy') : t('girl')} · ${t('grams', { g: f.number(b.weightG) })}`}
            tone={b.notification === 'draft' ? 'warning' : 'success'}
            actions={
              <Badge tone={b.notification === 'draft' ? 'warning' : 'success'} size="sm">
                {b.notification === 'draft' ? t('draft') : t('submitted')}
              </Badge>
            }
            footer={
              <Button
                size="sm"
                variant={b.notification === 'draft' ? 'primary' : 'secondary'}
                onPress={() => {
                  setDialog({ kind: 'notification', id: b.id });
                }}
              >
                {t('preview')}
              </Button>
            }
          >
            <p className="maternity-label">{t('linkTitle')}</p>
            <div className="maternity-link">
              <PatientName patient={b.baby} />
              <span aria-hidden="true" className="maternity-link__arrow">⇄</span>
              {m === undefined ? null : <PatientName patient={m.patient} />}
            </div>
          </Card>
        );
      })}
    </div>
  );

  // ---- dialogs -------------------------------------------------------------------------------------
  const close = (): void => {
    setDialog(null);
  };
  let dialogNode: ReactNode = null;
  if (dialog !== null) {
    if (dialog.kind === 'notification') {
      const b = babies.find((x) => x.id === dialog.id);
      const m = b === undefined ? undefined : motherOf(b);
      if (b !== undefined && m !== undefined) {
        dialogNode = (
          <NotificationDialog
            newborn={b}
            mother={m}
            onClose={close}
            onPrint={() => {
              toast({ tone: 'info', title: t('printFormToast') });
            }}
            onSubmit={() => {
              setBabies((cur) => cur.map((x) => (x.id === b.id ? { ...x, notification: 'submitted' } : x)));
              toast({ tone: 'success', title: t('submittedToast', { no: b.notificationNo }) });
            }}
          />
        );
      }
    } else {
      const w = women.find((x) => x.id === dialog.id);
      if (w !== undefined && dialog.kind === 'exam') {
        dialogNode = (
          <ExamDialog
            woman={w}
            onClose={close}
            onSave={(exam) => {
              setWomen((cur) =>
                cur.map((x) => {
                  if (x.id !== w.id) {
                    return x;
                  }
                  const stage = exam.dilationCm >= 10 ? 'second' : exam.dilationCm >= 4 && (x.stage === 'latent' || x.stage === 'antenatal') ? 'active' : x.stage;
                  return { ...x, exams: [...x.exams, exam], stage, activeFromIso: x.activeFromIso ?? (exam.dilationCm >= 4 ? exam.iso : null) };
                }),
              );
              close();
              toast({ tone: exam.fhr < 110 || exam.fhr > 160 ? 'warning' : 'success', title: exam.dilationCm >= 10 ? t('secondStageToast', { name: nameOf(w) }) : t('examSaved', { name: nameOf(w) }) });
            }}
          />
        );
      } else if (w !== undefined && dialog.kind === 'delivery') {
        dialogNode = (
          <DeliveryDialog
            woman={w}
            onClose={close}
            onSave={(input) => {
              const n = babies.length;
              const baby = makeBaby(n + 10, w.patient, input.sex, DEMO_NOW_ISO);
              const newborn: Newborn = {
                id: `NB-${String(n + 1).padStart(2, '0')}`,
                baby,
                motherId: w.id,
                birthIso: DEMO_NOW_ISO,
                sex: input.sex,
                weightG: input.weightG,
                apgar1: input.apgar1,
                apgar5: input.apgar5,
                mode: input.mode,
                ebl: input.ebl,
                perineum: input.perineum,
                bandId: `SYN-BND-${String(4410 + n)}`,
                bandsChecked: false,
                vitaminK: false,
                bcgHepB: false,
                notification: 'draft',
                notificationNo: `SYN-BN-2026-${String(18_240 + n)}`,
                attendant: w.midwife,
              };
              setBabies((cur) => [newborn, ...cur]);
              setWomen((cur) => cur.map((x) => (x.id === w.id ? { ...x, stage: 'delivered', para: x.para + 1 } : x)));
              close();
              setTab('newborns');
              toast({ tone: 'success', title: t('deliveredToast', { baby: personName(baby.name, f.locale), mother: nameOf(w) }) });
            }}
          />
        );
      }
    }
  }

  return (
    <div className="maternity-screen">
      <PageHeader
        icon="users"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            icon="printer"
            onPress={() => {
              toast({ tone: 'info', title: t('printToast') });
            }}
          >
            {t('printBoard')}
          </Button>
        }
      />
      <div className="maternity-kpis">
        <StatTile label={t('kpiLabour')} icon="activity" tone="accent" value={f.number(labouring.length)} hint={t('kpiLabourHint', { count: late })} onPress={() => { setTab('board'); }} />
        <StatTile label={t('kpiDeliveries')} icon="users" tone="success" value={f.number(birthsToday.length)} hint={t('kpiDeliveriesHint', { rate: f.percent(csRate) })} onPress={() => { setTab('newborns'); }} />
        <StatTile label={t('kpiAlert')} icon="alert" tone={alerts > 0 ? 'danger' : 'success'} value={f.number(alerts)} hint={t('kpiAlertHint')} onPress={() => { const w = women.find((x) => lineState(x) !== 'none'); if (w !== undefined) { setSelected(w.id); } setTab('partograph'); }} />
        <StatTile label={t('kpiFhr')} icon="heart" tone={fhrConcern > 0 ? 'danger' : 'success'} value={f.number(fhrConcern)} hint={t('kpiFhrHint')} />
        <StatTile label={t('kpiNotify')} icon="clipboard" tone={toNotify > 0 ? 'warning' : 'success'} value={f.number(toNotify)} hint={t('kpiNotifyHint')} onPress={() => { setTab('notifications'); }} />
      </div>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'board', label: t('tabBoard'), badge: f.number(labouring.length), content: board },
          { id: 'partograph', label: t('tabPartograph'), content: partograph },
          { id: 'newborns', label: t('tabNewborns'), badge: f.number(babies.length), content: newborns },
          { id: 'notifications', label: t('tabNotifications'), badge: f.number(toNotify), content: notifications },
        ]}
      />
      {dialogNode}
    </div>
  );
}
