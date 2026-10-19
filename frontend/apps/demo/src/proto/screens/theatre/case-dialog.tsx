/**
 * One theatre case: overview, the interactive WHO surgical safety checklist (sign in, time out, sign out,
 * each opening after the previous is confirmed), and the intra-op record whose implants and consumables
 * flow to the charges posted to the patient's bill.
 */
import { useState, type ReactNode } from 'react';
import { EXCHANGE_RATE, getStaff, iqdToUsd, isKnownPatient } from '../../data/index.ts';
import {
  ANAESTHESIA_LABEL,
  ANAESTHETISTS,
  caseEnd,
  chargesOf,
  CHECKLIST_TEXT,
  CONSUMABLES,
  IMPLANTS,
  personText,
  PRIORITY_LABEL,
  procedureOf,
  SIDE_LABEL,
  SIGN_IN_ITEMS,
  SIGN_OUT_ITEMS,
  STATUS_LABEL,
  STATUS_TONE,
  SURGEONS,
  THEATRE_ROOMS,
  TIME_OUT_ITEMS,
  type ChecklistPhase,
  type TheatreCase,
} from '../../data/ext/theatre.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  DataTable,
  Dialog,
  IconButton,
  KeyValueList,
  Money,
  PatientInline,
  SelectField,
  Tabs,
  TextInput,
  personName,
  staffName,
} from '../../ui/index.ts';
import { messages } from './messages.ts';

const NOW = '09:30';
const CIRCULATING_NURSE = 'SYN-STF-019';

type PhaseKey = 'signIn' | 'timeOut' | 'signOut';
const PHASES: readonly { readonly key: PhaseKey; readonly items: readonly string[]; readonly label: 'signIn' | 'timeOut' | 'signOut'; readonly when: 'signInWhen' | 'timeOutWhen' | 'signOutWhen' }[] = [
  { key: 'signIn', items: SIGN_IN_ITEMS, label: 'signIn', when: 'signInWhen' },
  { key: 'timeOut', items: TIME_OUT_ITEMS, label: 'timeOut', when: 'timeOutWhen' },
  { key: 'signOut', items: SIGN_OUT_ITEMS, label: 'signOut', when: 'signOutWhen' },
];

export function checklistDone(c: TheatreCase): number {
  return [c.signIn, c.timeOut, c.signOut].filter((p) => p.confirmedTime !== null).length;
}

export interface CaseDialogProps {
  readonly theatreCase: TheatreCase;
  readonly onClose: () => void;
  readonly onUpdate: (patch: Partial<TheatreCase>, toast?: string) => void;
  readonly onOpenChart: () => void;
  readonly onOpenBilling: () => void;
}

export function CaseDialog({ theatreCase: c, onClose, onUpdate, onOpenChart, onOpenBilling }: CaseDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [tab, setTab] = useState(c.status === 'scheduled' || c.status === 'sent-for' || c.status === 'anaesthesia' ? 'checklist' : 'intraop');
  const [implantId, setImplantId] = useState(IMPLANTS[0]?.id ?? '');
  const [lot, setLot] = useState('');
  const [serial, setSerial] = useState('');
  const [consumableId, setConsumableId] = useState(CONSUMABLES[0]?.id ?? '');
  const proc = procedureOf(c.procedureId);
  const room = THEATRE_ROOMS.find((r) => r.id === c.roomId);
  const name = personName(c.patient.name, f.locale);
  const charges = chargesOf(c);
  const allergies = c.patient.allergies.kind === 'list' ? c.patient.allergies.items.map((a) => f.text(a.substance)).join(', ') : null;

  // ---- overview ------------------------------------------------------------------------------------
  const overview = (
    <div className="theatre-stack">
      {allergies === null ? null : <Callout tone="danger" icon="alert">{t('allergyWarning', { list: allergies })}</Callout>}
      {c.note === null ? null : <Callout tone="info">{f.text(c.note)}</Callout>}
      <KeyValueList
        columns={2}
        items={[
          { id: 'proc', label: t('fProcedure'), value: f.text(proc.name) },
          { id: 'code', label: t('fCode'), value: <Code>{proc.code}</Code> },
          { id: 'side', label: t('fSide'), value: f.text(SIDE_LABEL[c.side]) },
          { id: 'duration', label: t('fDuration'), value: t('minutes', { min: proc.minutes }) },
          { id: 'surgeon', label: t('fSurgeon'), value: f.text(personText(SURGEONS, c.surgeon)) },
          { id: 'anaesthetist', label: t('fAnaesthetist'), value: f.text(personText(ANAESTHETISTS, c.anaesthetist)) },
          { id: 'anaesthesia', label: t('fAnaesthesia'), value: f.text(ANAESTHESIA_LABEL[c.anaesthesia]) },
          { id: 'priority', label: t('fPriority'), value: <Badge tone={c.priority === 'emergency' ? 'danger' : c.priority === 'urgent' ? 'warning' : 'neutral'} size="sm">{f.text(PRIORITY_LABEL[c.priority])}</Badge> },
          { id: 'status', label: t('fStatus'), value: <Badge tone={STATUS_TONE[c.status]} size="sm">{f.text(STATUS_LABEL[c.status])}</Badge> },
        ]}
      />
    </div>
  );

  // ---- checklist -----------------------------------------------------------------------------------
  const phaseOf = (key: PhaseKey): ChecklistPhase => c[key];
  const confirm = (key: PhaseKey): void => {
    const phase = phaseOf(key);
    const next: ChecklistPhase = { ...phase, confirmedTime: NOW, confirmedById: CIRCULATING_NURSE };
    const label = t(key);
    if (key === 'signIn') {
      onUpdate({ signIn: next, status: 'anaesthesia', times: { ...c.times, anaesthesiaStart: c.times.anaesthesiaStart ?? NOW } }, t('phaseToast', { phase: label, name }));
    } else if (key === 'timeOut') {
      onUpdate({ timeOut: next, status: 'surgery', times: { ...c.times, knifeToSkin: c.times.knifeToSkin ?? NOW } }, t('phaseToast', { phase: label, name }));
    } else {
      onUpdate({ signOut: next, status: 'recovery', times: { ...c.times, closure: c.times.closure ?? NOW, outOfTheatre: c.times.outOfTheatre ?? NOW } }, t('phaseToast', { phase: label, name }));
    }
  };
  const checklist = (
    <div className="theatre-stack">
      <Callout tone="info" icon="shield">
        {t('whoIntro')}
      </Callout>
      <div className="theatre-phases">
        {PHASES.map((p, index) => {
          const phase = phaseOf(p.key);
          const previous = index === 0 ? null : PHASES[index - 1];
          const locked = previous !== null && previous !== undefined && phaseOf(previous.key).confirmedTime === null;
          const left = p.items.filter((item) => phase.items[item] !== true).length;
          const done = phase.confirmedTime !== null;
          const by = phase.confirmedById === null ? null : getStaff(phase.confirmedById);
          return (
            <Card
              key={p.key}
              headingLevel={3}
              title={t(p.label)}
              subtitle={t(p.when)}
              icon={done ? 'check-circle' : locked ? 'lock' : 'clipboard'}
              {...(done ? { tone: 'success' as const } : locked ? {} : { tone: 'info' as const })}
              className={locked ? 'theatre-phase theatre-phase--locked' : 'theatre-phase'}
              footer={
                done ? (
                  <Badge tone="success" icon="check-circle">
                    {t('phaseDone', { phase: t(p.label), time: phase.confirmedTime ?? '', name: by === null ? '' : staffName(by, f.locale) })}
                  </Badge>
                ) : locked && previous !== undefined && previous !== null ? (
                  <span className="theatre-muted">{t('phaseLocked', { phase: t(previous.label) })}</span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    isDisabled={left > 0}
                    onPress={() => {
                      confirm(p.key);
                    }}
                  >
                    {left > 0 ? t('itemsLeft', { count: left }) : t('confirmPhase', { phase: t(p.label) })}
                  </Button>
                )
              }
            >
              <ul className="theatre-checks">
                {p.items.map((item) => (
                  <li key={item}>
                    <Checkbox
                      isSelected={phase.items[item] === true}
                      isDisabled={locked || done}
                      onChange={(on) => {
                        onUpdate({ [p.key]: { ...phase, items: { ...phase.items, [item]: on } } });
                      }}
                    >
                      {f.text(CHECKLIST_TEXT[item] ?? { en: item, ckb: item, ar: item })}
                    </Checkbox>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // ---- intra-op ------------------------------------------------------------------------------------
  const timeKeys = ['anaesthesiaStart', 'knifeToSkin', 'closure', 'outOfTheatre'] as const;
  const timeLabel = { anaesthesiaStart: t('tAnaesthesiaStart'), knifeToSkin: t('tKnifeToSkin'), closure: t('tClosure'), outOfTheatre: t('tOutOfTheatre') };
  const intraop = (
    <div className="theatre-stack">
      <section className="theatre-times" aria-label={t('times')}>
        {timeKeys.map((key) => (
          <div key={key} className="theatre-time">
            <span className="theatre-muted">{timeLabel[key]}</span>
            {c.times[key] === undefined ? (
              <Button
                size="sm"
                icon="clock"
                isDisabled={c.chargesPosted}
                onPress={() => {
                  onUpdate({ times: { ...c.times, [key]: NOW } });
                }}
              >
                {t('recordNow')}
              </Button>
            ) : (
              <Code className="theatre-time__value">{c.times[key]}</Code>
            )}
          </div>
        ))}
      </section>

      <Card title={t('implants')} subtitle={t('implantsHint')} icon="shield" headingLevel={3} flush>
        <DataTable
          caption={t('implants')}
          rows={c.implants.map((used, index) => ({ ...used, index }))}
          rowKey={(row) => `${row.implantId}-${String(row.index)}`}
          emptyText={t('noImplants')}
          dense
          columns={[
            { id: 'item', header: t('implantItem'), cell: (row) => { const def = IMPLANTS.find((i) => i.id === row.implantId); return <span className="theatre-cell-stack"><Code>{def?.name ?? row.implantId}</Code><span className="theatre-muted">{def?.manufacturer}</span></span>; } },
            { id: 'lot', header: t('lot'), cell: (row) => <Code>{row.lot === '' ? '–' : row.lot}</Code> },
            { id: 'serial', header: t('serial'), cell: (row) => <Code>{row.serial === '' ? '–' : row.serial}</Code> },
            { id: 'qty', header: t('qty'), align: 'end', cell: (row) => f.number(row.qty) },
            { id: 'price', header: t('price'), align: 'end', nowrap: true, cell: (row) => <Money amount={(IMPLANTS.find((i) => i.id === row.implantId)?.priceIqd ?? 0) * row.qty} /> },
            {
              id: 'remove',
              header: '',
              cell: (row) => (
                <IconButton
                  icon="x"
                  label={t('remove')}
                  size="sm"
                  isDisabled={c.chargesPosted}
                  onPress={() => {
                    onUpdate({ implants: c.implants.filter((_, i) => i !== row.index) });
                  }}
                />
              ),
            },
          ]}
        />
        <div className="theatre-add">
          <SelectField label={t('implantItem')} options={IMPLANTS.map((i) => ({ id: i.id, label: i.name }))} selectedKey={implantId} onSelectionChange={setImplantId} />
          <TextInput label={t('lot')} value={lot} onChange={setLot} dir="ltr" />
          <TextInput label={t('serial')} value={serial} onChange={setSerial} dir="ltr" />
          <Button
            icon="plus"
            isDisabled={c.chargesPosted || lot.trim() === ''}
            onPress={() => {
              onUpdate({ implants: [...c.implants, { implantId, lot: lot.trim(), serial: serial.trim(), qty: 1 }] }, t('addedToast', { item: IMPLANTS.find((i) => i.id === implantId)?.name ?? implantId }));
              setLot('');
              setSerial('');
            }}
          >
            {t('addImplant')}
          </Button>
        </div>
      </Card>

      <Card title={t('consumables')} icon="clipboard" headingLevel={3} flush>
        <DataTable
          caption={t('consumables')}
          rows={c.consumables}
          rowKey={(row) => row.consumableId}
          emptyText={t('noConsumables')}
          dense
          columns={[
            { id: 'item', header: t('consumableItem'), cell: (row) => <Code>{CONSUMABLES.find((i) => i.id === row.consumableId)?.name ?? row.consumableId}</Code> },
            {
              id: 'qty',
              header: t('qty'),
              cell: (row) => (
                <span className="theatre-stepper">
                  <IconButton
                    icon="minus"
                    size="sm"
                    label={t('less')}
                    isDisabled={c.chargesPosted}
                    onPress={() => {
                      onUpdate({ consumables: c.consumables.map((x) => (x.consumableId === row.consumableId ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0) });
                    }}
                  />
                  <span className="theatre-stepper__value">{f.number(row.qty)}</span>
                  <IconButton
                    icon="plus"
                    size="sm"
                    label={t('more')}
                    isDisabled={c.chargesPosted}
                    onPress={() => {
                      onUpdate({ consumables: c.consumables.map((x) => (x.consumableId === row.consumableId ? { ...x, qty: x.qty + 1 } : x)) });
                    }}
                  />
                </span>
              ),
            },
            { id: 'price', header: t('price'), align: 'end', nowrap: true, cell: (row) => <Money amount={(CONSUMABLES.find((i) => i.id === row.consumableId)?.unitPriceIqd ?? 0) * row.qty} /> },
          ]}
        />
        <div className="theatre-add">
          <SelectField label={t('consumableItem')} options={CONSUMABLES.map((i) => ({ id: i.id, label: i.name }))} selectedKey={consumableId} onSelectionChange={setConsumableId} />
          <Button
            icon="plus"
            isDisabled={c.chargesPosted}
            onPress={() => {
              const existing = c.consumables.find((x) => x.consumableId === consumableId);
              onUpdate(
                { consumables: existing === undefined ? [...c.consumables, { consumableId, qty: 1 }] : c.consumables.map((x) => (x.consumableId === consumableId ? { ...x, qty: x.qty + 1 } : x)) },
                t('addedToast', { item: CONSUMABLES.find((i) => i.id === consumableId)?.name ?? consumableId }),
              );
            }}
          >
            {t('addConsumable')}
          </Button>
        </div>
      </Card>

      <Card
        title={t('charges')}
        icon="receipt"
        headingLevel={3}
        tone={c.chargesPosted ? 'success' : 'accent'}
        footer={
          <span className="theatre-inline">
            {c.chargesPosted ? (
              <>
                <Badge tone="success" icon="check-circle">
                  {t('chargesPosted')}
                </Badge>
                {isKnownPatient(c.patient.id) ? (
                  <Button size="sm" icon="receipt" onPress={onOpenBilling}>
                    {t('openBilling')}
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                variant="primary"
                icon="receipt"
                isDisabled={c.signOut.confirmedTime === null && c.status !== 'completed'}
                onPress={() => {
                  onUpdate({ chargesPosted: true }, t('postedToast', { amount: f.iqd(charges.totalIqd), name }));
                }}
              >
                {t('postCharges')}
              </Button>
            )}
          </span>
        }
      >
        <KeyValueList
          columns={1}
          items={[
            { id: 'theatre', label: t('cTheatre'), value: <Money amount={charges.theatreIqd} /> },
            { id: 'anaesthesia', label: t('cAnaesthesia'), value: <Money amount={charges.anaesthesiaIqd} /> },
            { id: 'implants', label: t('cImplants'), value: <Money amount={charges.implantsIqd} /> },
            { id: 'consumables', label: t('cConsumables'), value: <Money amount={charges.consumablesIqd} /> },
            {
              id: 'total',
              label: t('cTotal'),
              value: (
                <span className="theatre-total">
                  <Money amount={charges.totalIqd} /> · <Money amount={iqdToUsd(charges.totalIqd)} currency="USD" />
                </span>
              ),
            },
          ]}
        />
        <p className="theatre-muted">{f.text(EXCHANGE_RATE.note)}</p>
      </Card>
    </div>
  );

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('caseTitle', { procedure: f.text(proc.name) })}
      subtitle={t('caseSubtitle', { room: room === undefined ? c.roomId : f.text(room.name), date: f.date(c.date), start: c.start, end: caseEnd(c) })}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          {isKnownPatient(c.patient.id) ? (
            <Button variant="secondary" icon="chart" onPress={onOpenChart}>
              {t('openChart')}
            </Button>
          ) : null}
          {c.status === 'scheduled' ? (
            <>
              <Button
                variant="secondary"
                onPress={() => {
                  onUpdate({ status: 'postponed' }, t('postponedToast'));
                }}
              >
                {t('postpone')}
              </Button>
              <Button
                variant="primary"
                icon="bell"
                onPress={() => {
                  onUpdate({ status: 'sent-for' }, t('sentToast', { name }));
                }}
              >
                {t('sendFor')}
              </Button>
            </>
          ) : null}
          {c.status === 'recovery' ? (
            <Button
              variant="primary"
              icon="bed"
              onPress={() => {
                onUpdate({ status: 'completed' }, t('toWardToast', { name }));
              }}
            >
              {t('toWard')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="theatre-stack">
        <div className="theatre-dialog-head">
          <PatientInline patient={c.patient} secondary />
          <span className="theatre-inline">
            {c.side === 'none' ? null : <Badge tone="warning" icon="alert">{t('sideLine', { side: f.text(SIDE_LABEL[c.side]) })}</Badge>}
            <Badge tone={STATUS_TONE[c.status]}>{f.text(STATUS_LABEL[c.status])}</Badge>
          </span>
        </div>
        <Tabs
          aria-label={t('tabsLabel')}
          selectedKey={tab}
          onSelectionChange={setTab}
          items={[
            { id: 'overview', label: t('tabOverview'), content: overview },
            { id: 'checklist', label: t('tabChecklist'), badge: t('checklistShort', { done: checklistDone(c) }), content: checklist },
            { id: 'intraop', label: t('tabIntraop'), content: intraop },
          ]}
        />
      </div>
    </Dialog>
  );
}
