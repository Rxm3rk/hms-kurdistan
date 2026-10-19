/**
 * The Intensive care screen (hospital-wide): the ICU bed overview with severity (APACHE II, SOFA) and organ
 * support, the hourly flowsheet (vitals, ventilator, infusions, intake and output with the running fluid
 * balance) with a validated hourly entry, and device association (lines, tubes, connected equipment).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, isKnownPatient } from '../../data/index.ts';
import {
  balanceOf,
  DEVICE_LABEL,
  devicesOf,
  FLOW_HOURS,
  FLOW_ROWS,
  flowsheetOf,
  ICU_BED_COUNT,
  ICU_PATIENTS,
  REVIEW_AFTER_DAYS,
  VENT_LABEL,
  type DeviceKind,
  type Flowsheet,
  type FlowRow,
  type IcuDevice,
  type IcuPatient,
} from '../../data/ext/icu.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  DataTable,
  Dialog,
  KeyValueList,
  PageHeader,
  PatientInline,
  PatientName,
  SelectField,
  StatTile,
  Tabs,
  TextInput,
  useToast,
  type Column,
} from '../../ui/index.ts';
import './icu.css';
import { messages } from './messages.ts';

const GROUPS: readonly FlowRow['group'][] = ['vitals', 'vent', 'infusion', 'intake', 'output'];
const DEVICE_KINDS: readonly DeviceKind[] = ['monitor', 'ventilator', 'pump', 'dialysis', 'cvc', 'arterial', 'ett', 'urinary', 'ng'];
const CONNECTED: readonly DeviceKind[] = ['monitor', 'ventilator', 'pump', 'dialysis'];

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.parse(DEMO_NOW_ISO) - Date.parse(iso)) / 86_400_000));
}

function outOfRange(row: FlowRow, value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  const n = Number(value);
  return (row.low !== undefined && n < row.low) || (row.high !== undefined && n > row.high);
}

type DialogState = { readonly kind: 'hour' } | { readonly kind: 'device' } | null;

export function IcuScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [selected, setSelected] = useState(ICU_PATIENTS.find((p) => p.patient.id === 'SYN-PAT-0109')?.bedId ?? ICU_PATIENTS[0]?.bedId ?? 'ICU-01');
  const [tab, setTab] = useState('flowsheet');
  const [extraHours, setExtraHours] = useState<Readonly<Record<string, readonly { readonly hour: string; readonly values: Readonly<Record<string, string>> }[]>>>({});
  const [devices, setDevices] = useState<Readonly<Record<string, readonly IcuDevice[]>>>(() => Object.fromEntries(ICU_PATIENTS.map((p, i) => [p.bedId, devicesOf(p, i)])));
  const [dialog, setDialog] = useState<DialogState>(null);

  const sheets = useMemo(() => Object.fromEntries(ICU_PATIENTS.map((p) => [p.bedId, flowsheetOf(p)])) as Readonly<Record<string, Flowsheet>>, []);
  const current = ICU_PATIENTS.find((p) => p.bedId === selected) ?? ICU_PATIENTS[0];
  const activeDevices = (bedId: string): readonly IcuDevice[] => (devices[bedId] ?? []).filter((d) => d.removedIso === null);
  const reviewDue = (d: IcuDevice): boolean => {
    const limit = REVIEW_AFTER_DAYS[d.kind];
    return limit !== undefined && d.removedIso === null && daysSince(d.insertedIso) > limit;
  };

  // ---- KPIs ----------------------------------------------------------------------------------------
  const ventilated = ICU_PATIENTS.filter((p) => p.vent === 'SIMV-PC' || p.vent === 'PRVC').length;
  const niv = ICU_PATIENTS.filter((p) => p.vent === 'CPAP-PS' || p.vent === 'HFNO').length;
  const pressors = ICU_PATIENTS.filter((p) => p.vasopressor).length;
  const meanApache = ICU_PATIENTS.reduce((s, p) => s + p.apache2, 0) / Math.max(1, ICU_PATIENTS.length);
  const meanSofa = ICU_PATIENTS.reduce((s, p) => s + p.sofa, 0) / Math.max(1, ICU_PATIENTS.length);
  const linesDue = ICU_PATIENTS.reduce((s, p) => s + activeDevices(p.bedId).filter(reviewDue).length, 0);

  // ---- bed overview --------------------------------------------------------------------------------
  const severityTone = (p: IcuPatient): 'danger' | 'warning' | 'info' => (p.sofa >= 10 ? 'danger' : p.sofa >= 6 ? 'warning' : 'info');
  const latest = (p: IcuPatient, id: string): string => {
    const sheet = sheets[p.bedId];
    const extra = extraHours[p.bedId] ?? [];
    const last = extra[extra.length - 1]?.values[id];
    if (last !== undefined && last !== '') {
      return last;
    }
    const values = sheet?.[id] ?? [];
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const v = values[i];
      if (v !== null && v !== undefined) {
        return v;
      }
    }
    return '–';
  };
  const beds = Array.from({ length: ICU_BED_COUNT }, (_, i) => `ICU-${String(i + 1).padStart(2, '0')}`);
  const overview = (
    <section className="icu-beds" aria-label={t('overview')}>
      {beds.map((bedId) => {
        const p = ICU_PATIENTS.find((x) => x.bedId === bedId);
        if (p === undefined) {
          return (
            <div key={bedId} className="icu-bed icu-bed--empty">
              <span className="icu-bed__id">{bedId}</span>
              <Badge tone="info" size="sm">
                {t('reserved')}
              </Badge>
              <span className="icu-muted">{t('reservedFor')}</span>
            </div>
          );
        }
        const tone = severityTone(p);
        return (
          <button
            key={bedId}
            type="button"
            aria-pressed={selected === bedId}
            aria-label={t('selectBed', { bed: bedId })}
            className={`icu-bed icu-bed--${tone}${selected === bedId ? ' icu-bed--selected' : ''}`}
            onClick={() => {
              setSelected(bedId);
            }}
          >
            <span className="icu-bed__top">
              <span className="icu-bed__id">{bedId}</span>
              <span className="icu-muted">{t('icuDay', { day: p.icuDay })}</span>
            </span>
            <PatientName patient={p.patient} />
            <span className="icu-bed__dx">{f.text(p.diagnosis)}</span>
            <span className="icu-bed__scores">
              <Badge tone={tone} size="sm" strong={tone === 'danger'}>
                {t('sofa', { score: p.sofa })}
              </Badge>
              <Badge tone="neutral" size="sm">
                {t('apache', { score: p.apache2 })}
              </Badge>
            </span>
            <span className="icu-bed__support">
              {p.vent === null ? null : <Badge tone="accent" size="sm" icon="activity">{f.text(VENT_LABEL[p.vent])}</Badge>}
              {p.vasopressor ? <Badge tone="danger" size="sm" icon="droplet">{t('pressor')}</Badge> : null}
              {p.rrt ? <Badge tone="warning" size="sm">{t('rrt')}</Badge> : null}
            </span>
            <span className="icu-bed__vitals">
              <span>HR <strong>{latest(p, 'hr')}</strong></span>
              <span>MAP <strong>{latest(p, 'map')}</strong></span>
              <span>SpO2 <strong>{latest(p, 'spo2')}</strong></span>
            </span>
            <span className="icu-muted">
              {t('devicesCount', { count: activeDevices(bedId).length })}
              {p.sedated ? ` · ${t('rass', { score: p.rass })}` : ''}
            </span>
          </button>
        );
      })}
    </section>
  );

  // ---- flowsheet -----------------------------------------------------------------------------------
  const flowsheet = (() => {
    if (current === undefined) {
      return null;
    }
    const sheet = sheets[current.bedId] ?? {};
    const extra = extraHours[current.bedId] ?? [];
    const hours = [...FLOW_HOURS, ...extra.map((e) => e.hour)];
    const valueAt = (rowId: string, index: number): string | null => {
      if (index < FLOW_HOURS.length) {
        return sheet[rowId]?.[index] ?? null;
      }
      const v = extra[index - FLOW_HOURS.length]?.values[rowId];
      return v === undefined || v === '' ? null : v;
    };
    const merged: Flowsheet = Object.fromEntries(FLOW_ROWS.map((row) => [row.id, hours.map((_, i) => valueAt(row.id, i))]));
    const balance = (() => {
      const base = balanceOf(sheet);
      let running = base[base.length - 1] ?? 0;
      const more = extra.map((e) => {
        const n = (id: string): number => Number(e.values[id] ?? 0) || 0;
        running += n('ivfluid') + n('enteral') - n('urine') - n('drain');
        return running;
      });
      return [...base, ...more];
    })();
    const groupLabel = { vitals: t('gVitals'), vent: t('gVent'), infusion: t('gInfusion'), intake: t('gIntake'), output: t('gOutput') };
    const nextHour = `${String(9 + extra.length + 1).padStart(2, '0')}:00`;
    return (
      <div className="icu-stack">
        <div className="icu-toolbar">
          <Button
            variant="primary"
            icon="plus"
            isDisabled={extra.length >= 3}
            onPress={() => {
              setDialog({ kind: 'hour' });
            }}
          >
            {t('addHour', { hour: nextHour })}
          </Button>
        </div>
        <div className="icu-flow-wrap">
          <table className="icu-flow">
            <caption className="hms-visually-hidden">{t('flowCaption', { bed: current.bedId })}</caption>
            <thead>
              <tr>
                <th scope="col" className="icu-flow__param">
                  {t('parameter')}
                </th>
                <th scope="col">{t('unit')}</th>
                {hours.map((h, i) => (
                  <th key={`${h}-${String(i)}`} scope="col" className={i >= FLOW_HOURS.length ? 'icu-flow__new' : undefined}>
                    <bdi dir="ltr">{h}</bdi>
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((group) => {
              const rows = FLOW_ROWS.filter((row) => row.group === group && (merged[row.id] ?? []).some((v) => v !== null));
              if (rows.length === 0) {
                return null;
              }
              return (
                <tbody key={group}>
                  <tr className="icu-flow__group">
                    <th scope="colgroup" colSpan={hours.length + 2}>
                      {groupLabel[group]}
                    </th>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="icu-flow__param">
                        {f.text(row.label)}
                      </th>
                      <td className="icu-muted">
                        <bdi dir="ltr">{row.unit}</bdi>
                      </td>
                      {hours.map((h, i) => {
                        const v = merged[row.id]?.[i] ?? null;
                        const bad = outOfRange(row, v);
                        return (
                          <td key={`${h}-${String(i)}`} className={['icu-flow__cell', bad ? 'icu-flow__cell--bad' : '', i >= FLOW_HOURS.length ? 'icu-flow__new' : ''].filter(Boolean).join(' ')} {...(bad ? { title: t('outOfRange') } : {})}>
                            {v === null ? <span className="icu-muted" aria-label={t('notRecorded')}>·</span> : <bdi dir="ltr">{v}</bdi>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tfoot>
              <tr className="icu-flow__balance">
                <th scope="row" className="icu-flow__param">
                  {t('balance')}
                </th>
                <td className="icu-muted">mL</td>
                {balance.map((b, i) => (
                  <td key={i} className={b > 1500 ? 'icu-flow__cell icu-flow__cell--bad' : 'icu-flow__cell'}>
                    <bdi dir="ltr">{b > 0 ? `+${String(b)}` : String(b)}</bdi>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  })();

  // ---- devices -------------------------------------------------------------------------------------
  const deviceName = (d: IcuDevice): string => f.text(DEVICE_LABEL[d.kind]);
  const deviceColumns: readonly Column<IcuDevice>[] = [
    { id: 'device', header: t('device'), cell: (d) => <span className="icu-cell-stack"><strong>{deviceName(d)}</strong><Code>{d.detail}</Code></span> },
    { id: 'serial', header: t('serial'), cell: (d) => (d.serial === null ? '–' : <Code>{d.serial}</Code>) },
    { id: 'inserted', header: t('inserted'), nowrap: true, cell: (d) => f.dateTime(d.insertedIso) },
    {
      id: 'days',
      header: t('days'),
      align: 'end',
      cell: (d) => (
        <span className="icu-cell-stack icu-cell-stack--end">
          <span>{f.number(daysSince(d.insertedIso))}</span>
          {reviewDue(d) ? <Badge tone="warning" size="sm" icon="alert">{t('reviewDue')}</Badge> : null}
        </span>
      ),
    },
    {
      id: 'stream',
      header: t('streaming'),
      cell: (d) => (CONNECTED.includes(d.kind) ? <Badge tone={d.streaming ? 'success' : 'neutral'} size="sm" icon={d.streaming ? 'activity' : 'x'}>{d.streaming ? t('streamingOn') : t('streamingOff')}</Badge> : '–'),
    },
    {
      id: 'bundle',
      header: t('bundle'),
      cell: (d) => (CONNECTED.includes(d.kind) ? '–' : <Badge tone={d.bundleChecked ? 'success' : 'warning'} size="sm">{d.bundleChecked ? t('bundleOk') : t('bundleDue')}</Badge>),
    },
    {
      id: 'actions',
      header: t('actions'),
      cell: (d) =>
        d.removedIso !== null ? (
          <Badge tone="neutral" size="sm">{t('removed')}</Badge>
        ) : (
          <span className="icu-inline">
            {!CONNECTED.includes(d.kind) && !d.bundleChecked ? (
              <Button
                size="sm"
                icon="check"
                onPress={() => {
                  setDevices((cur) => ({ ...cur, [selected]: (cur[selected] ?? []).map((x) => (x.id === d.id ? { ...x, bundleChecked: true } : x)) }));
                  toast({ tone: 'success', title: t('bundleToast', { device: deviceName(d) }) });
                }}
              >
                {t('checkBundle')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              icon="x"
              onPress={() => {
                setDevices((cur) => ({ ...cur, [selected]: (cur[selected] ?? []).map((x) => (x.id === d.id ? { ...x, removedIso: DEMO_NOW_ISO, streaming: false } : x)) }));
                toast({ tone: 'info', title: t('removedToast', { device: deviceName(d), bed: selected }) });
              }}
            >
              {t('removeDevice')}
            </Button>
          </span>
        ),
    },
  ];
  const deviceView = (
    <div className="icu-stack">
      <div className="icu-toolbar">
        <Button
          variant="primary"
          icon="scan"
          onPress={() => {
            setDialog({ kind: 'device' });
          }}
        >
          {t('associate')}
        </Button>
      </div>
      <DataTable
        caption={t('devicesCaption', { bed: selected })}
        columns={deviceColumns}
        rows={devices[selected] ?? []}
        rowKey={(d) => d.id}
        rowTone={(d) => (d.removedIso !== null ? 'neutral' : reviewDue(d) ? 'warning' : undefined)}
        emptyText={t('noDevices')}
        dense
      />
    </div>
  );

  const summary =
    current === undefined ? null : (
      <KeyValueList
        columns={2}
        items={[
          { id: 'dx', label: t('diagnosis'), value: f.text(current.diagnosis) },
          { id: 'consultant', label: t('consultant'), value: f.text(current.consultant) },
          { id: 'severity', label: t('severity'), value: `${t('apache', { score: current.apache2 })} · ${t('sofa', { score: current.sofa })}` },
          {
            id: 'support',
            label: t('support'),
            value: [current.vent === null ? null : f.text(VENT_LABEL[current.vent]), current.vasopressor ? t('pressor') : null, current.rrt ? t('rrt') : null].filter(Boolean).join(' · ') || t('noSupport'),
          },
          { id: 'sedation', label: t('sedation'), value: current.sedated ? `${t('sedated')} · ${t('rass', { score: current.rass })}` : t('notSedated') },
          { id: 'day', label: t('icuDay', { day: current.icuDay }), value: <PatientInline patient={current.patient} /> },
        ]}
      />
    );

  // ---- dialogs -------------------------------------------------------------------------------------
  let dialogNode: ReactNode = null;
  if (dialog?.kind === 'hour' && current !== undefined) {
    const extra = extraHours[current.bedId] ?? [];
    const hour = `${String(9 + extra.length + 1).padStart(2, '0')}:00`;
    dialogNode = (
      <HourDialog
        bed={current.bedId}
        hour={hour}
        sheet={sheets[current.bedId] ?? {}}
        onClose={() => {
          setDialog(null);
        }}
        onSave={(values) => {
          setExtraHours((cur) => ({ ...cur, [current.bedId]: [...(cur[current.bedId] ?? []), { hour, values }] }));
          setDialog(null);
          toast({ tone: 'success', title: t('savedHour', { hour, bed: current.bedId }) });
        }}
      />
    );
  } else if (dialog?.kind === 'device') {
    dialogNode = (
      <DeviceDialog
        bed={selected}
        onClose={() => {
          setDialog(null);
        }}
        onSave={(device) => {
          setDevices((cur) => ({ ...cur, [selected]: [...(cur[selected] ?? []), device] }));
          setDialog(null);
          toast({ tone: 'success', title: t('associatedToast', { device: f.text(DEVICE_LABEL[device.kind]), bed: selected }) });
        }}
      />
    );
  }

  return (
    <div className="icu-screen">
      <PageHeader
        icon="heart"
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
            {t('printFlowsheet')}
          </Button>
        }
      />
      <div className="icu-kpis">
        <StatTile label={t('kpiOccupied')} icon="bed" value={`${f.number(ICU_PATIENTS.length)}/${f.number(ICU_BED_COUNT)}`} hint={t('kpiOccupiedHint', { free: ICU_BED_COUNT - ICU_PATIENTS.length })} />
        <StatTile label={t('kpiVent')} icon="activity" tone="accent" value={f.number(ventilated)} hint={t('kpiVentHint', { count: niv })} />
        <StatTile label={t('kpiPressors')} icon="droplet" tone="danger" value={f.number(pressors)} />
        <StatTile label={t('kpiSeverity')} icon="chart" value={f.number(meanApache, { maximumFractionDigits: 1 })} hint={t('kpiSeverityHint', { sofa: f.number(meanSofa, { maximumFractionDigits: 1 }) })} />
        <StatTile
          label={t('kpiLines')}
          icon="alert"
          tone={linesDue > 0 ? 'warning' : 'success'}
          value={f.number(linesDue)}
          hint={t('kpiLinesHint')}
          onPress={() => {
            const bed = ICU_PATIENTS.find((p) => activeDevices(p.bedId).some(reviewDue));
            if (bed !== undefined) {
              setSelected(bed.bedId);
            }
            setTab('devices');
          }}
        />
      </div>

      {overview}

      {current === undefined ? null : (
        <Card
          title={
            <span className="icu-card-title">
              <Code className="icu-bed__id">{current.bedId}</Code>
              <PatientName patient={current.patient} />
            </span>
          }
          subtitle={`${f.text(current.diagnosis)} · ${t('icuDay', { day: current.icuDay })}`}
          icon="heart"
          actions={
            isKnownPatient(current.patient.id) ? (
              <Button
                size="sm"
                icon="chart"
                onPress={() => {
                  goTo('chart', { patient: current.patient.id });
                }}
              >
                {t('openChart')}
              </Button>
            ) : undefined
          }
        >
          <Tabs
            aria-label={t('tabsLabel')}
            selectedKey={tab}
            onSelectionChange={setTab}
            items={[
              { id: 'flowsheet', label: t('tabFlowsheet'), content: flowsheet },
              { id: 'devices', label: t('tabDevices'), badge: f.number(activeDevices(selected).length), content: deviceView },
              { id: 'summary', label: t('tabSummary'), content: summary },
            ]}
          />
        </Card>
      )}
      {dialogNode}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hourly entry, prefilled from the connected monitor, with nurse validation
// ---------------------------------------------------------------------------------------------------------

const ENTRY_ROWS = ['hr', 'sbp', 'map', 'rr', 'spo2', 'temp', 'fio2', 'norad', 'ivfluid', 'enteral', 'urine', 'drain'] as const;
const FROM_MONITOR: readonly string[] = ['hr', 'sbp', 'map', 'rr', 'spo2', 'fio2', 'norad'];

function HourDialog({ bed, hour, sheet, onClose, onSave }: { readonly bed: string; readonly hour: string; readonly sheet: Flowsheet; readonly onClose: () => void; readonly onSave: (values: Readonly<Record<string, string>>) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [values, setValues] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(ENTRY_ROWS.map((id) => [id, FROM_MONITOR.includes(id) ? ((sheet[id] ?? []).filter((v) => v !== null).at(-1) ?? '') : ''])),
  );
  const [checked, setChecked] = useState(false);
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('hourTitle', { hour })}
      subtitle={`${bed} · ${t('hourSubtitle')}`}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!checked}
            onPress={() => {
              onSave(values);
            }}
          >
            {t('saveHour')}
          </Button>
        </>
      }
    >
      <div className="icu-stack">
        <div className="icu-entry-grid">
          {ENTRY_ROWS.map((id) => {
            const row = FLOW_ROWS.find((r) => r.id === id);
            if (row === undefined) {
              return null;
            }
            const bad = outOfRange(row, values[id]);
            return (
              <div key={id} className={bad ? 'icu-entry icu-entry--bad' : 'icu-entry'}>
                <TextInput
                  label={`${f.text(row.label)} (${row.unit})`}
                  value={values[id] ?? ''}
                  onChange={(v) => {
                    setValues((cur) => ({ ...cur, [id]: v }));
                    setChecked(false);
                  }}
                  inputMode="decimal"
                  dir="ltr"
                  {...(FROM_MONITOR.includes(id) ? { description: t('fromDevice') } : {})}
                />
                {bad ? <Badge tone="danger" size="sm" icon="alert">{t('outOfRange')}</Badge> : null}
              </div>
            );
          })}
        </div>
        <Checkbox isSelected={checked} onChange={setChecked}>
          {t('validate')}
        </Checkbox>
      </div>
    </Dialog>
  );
}

function DeviceDialog({ bed, onClose, onSave }: { readonly bed: string; readonly onClose: () => void; readonly onSave: (device: IcuDevice) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [kind, setKind] = useState<DeviceKind>('pump');
  const [barcode, setBarcode] = useState('');
  const [site, setSite] = useState('');
  const connected = CONNECTED.includes(kind);
  const valid = connected ? barcode.trim().length >= 4 : site.trim().length >= 2;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t('associateTitle', { bed })}
      subtitle={t('associateSubtitle')}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="scan"
            isDisabled={!valid}
            onPress={() => {
              onSave({
                id: `${bed}-${kind}-${String(Date.now())}`,
                kind,
                detail: site.trim() === '' ? f.text(DEVICE_LABEL[kind]) : site.trim(),
                serial: barcode.trim() === '' ? null : barcode.trim(),
                insertedIso: DEMO_NOW_ISO,
                removedIso: null,
                streaming: connected,
                bundleChecked: true,
              });
            }}
          >
            {t('associateSave')}
          </Button>
        </>
      }
    >
      <div className="icu-stack">
        <SelectField
          label={t('kind')}
          options={DEVICE_KINDS.map((k) => ({ id: k, label: f.text(DEVICE_LABEL[k]) }))}
          selectedKey={kind}
          onSelectionChange={(id) => {
            setKind(DEVICE_KINDS.find((k) => k === id) ?? 'pump');
          }}
        />
        <TextInput label={t('barcode')} value={barcode} onChange={setBarcode} dir="ltr" isRequired={connected} placeholder="PMP-10274" />
        <TextInput label={t('site')} value={site} onChange={setSite} dir="auto" isRequired={!connected} />
      </div>
    </Dialog>
  );
}
