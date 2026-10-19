/**
 * The Patient messaging screen (hospital-wide): the patient front door. The outbound queue of appointment
 * reminders, report-ready and payment messages with delivery statuses (retry, fall back to SMS, send,
 * cancel), WhatsApp / Viber / SMS templates in Sorani, Arabic and English with a phone preview, secure
 * links (booking, wallet payment, report download by OTP or expiring link) with their audit trail, and
 * delivery statistics. Nothing is sent; changes stay in React state. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_TODAY, getPatient, isToday, minutesFromNow, usdToIqd } from '../../data/index.ts';
import { DELIVERY_WEEK, LINKS, OUTBOX, TEMPLATES, type Channel, type DeliveryStatus, type MessageTemplate, type OutboundMessage, type SecureLink } from '../../data/ext/messaging.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  BarChart,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  IconButton,
  KeyValueList,
  PageHeader,
  SearchField,
  Segmented,
  SelectField,
  StatTile,
  Tabs,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { LinksTab, NewLinkDialog } from './links.tsx';
import { messages } from './messages.ts';
import './messaging.css';
import { ChannelBadge, DELIVERY_TONE, PatientCell, PhonePreview, fillTemplate, type MsgLanguage } from './parts.tsx';

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((tpl) => [tpl.id, tpl]));
const PROBLEMS: readonly DeliveryStatus[] = ['failed', 'opted-out'];
const UPCOMING: readonly DeliveryStatus[] = ['scheduled', 'queued'];

export function MessagingScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [tab, setTab] = useState('outbox');
  const [outbox, setOutbox] = useState<readonly (OutboundMessage & { readonly cancelled?: boolean })[]>(OUTBOX);
  const [links, setLinks] = useState<readonly SecureLink[]>(LINKS);
  const [dialog, setDialog] = useState(false);

  const today = outbox.filter((m) => isToday(m.scheduledIso) && m.cancelled !== true);
  const scheduled = outbox.filter((m) => UPCOMING.includes(m.status) && m.cancelled !== true).length;
  const failed = outbox.filter((m) => m.status === 'failed').length;
  const weekDelivered = DELIVERY_WEEK.reduce((s, d) => s + d.delivered, 0);
  const weekFailed = DELIVERY_WEEK.reduce((s, d) => s + d.failed, 0);
  const activeLinks = links.filter((l) => l.status === 'active');
  const paidToday = links.filter((l) => l.events.some((e) => e.event === 'paid' && e.iso.slice(0, 10) <= DEMO_TODAY && minutesFromNow(e.iso) > -24 * 60));
  const paidIqd = paidToday.reduce((s, l) => s + (l.amount === null ? 0 : l.currency === 'USD' ? usdToIqd(l.amount) : l.amount), 0);

  return (
    <div className="messaging-screen">
      <PageHeader
        icon="phone"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="primary" icon="plus" onPress={() => setDialog(true)}>
            {t('newLink')}
          </Button>
        }
      >
        <Badge tone="neutral" icon="info" size="sm">
          {t('synthetic')}
        </Badge>
      </PageHeader>

      <Grid min="12rem">
        <StatTile label={t('tileToday')} value={f.number(today.length)} icon="phone" hint={t('tileTodayHint', { count: scheduled })} onPress={() => setTab('outbox')} />
        <StatTile
          label={t('tileDelivered')}
          value={f.percent(weekDelivered / (weekDelivered + weekFailed))}
          icon="check-circle"
          hint={t('tileDeliveredHint', { count: f.number(weekFailed) })}
          trend={DELIVERY_WEEK.map((d) => d.delivered)}
          trendLabel={t('statsTitle')}
          onPress={() => setTab('stats')}
        />
        <StatTile label={t('tileFailed')} value={f.number(failed)} icon="alert" tone={failed > 0 ? 'danger' : 'success'} hint={t('tileFailedHint')} onPress={() => setTab('outbox')} />
        <StatTile label={t('tileLinks')} value={f.number(activeLinks.length)} icon="lock" hint={t('tileLinksHint', { count: activeLinks.filter((l) => l.kind === 'report').length })} onPress={() => setTab('links')} />
        <StatTile label={t('tilePaid')} value={f.iqd(paidIqd)} icon="money" hint={t('tilePaidHint', { count: paidToday.length })} onPress={() => setTab('links')} />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          {
            id: 'outbox',
            label: t('tabOutbox'),
            badge: String(failed),
            content: <OutboxTab outbox={outbox} onUpdate={(next) => setOutbox((current) => current.map((m) => (m.id === next.id ? next : m)))} />,
          },
          { id: 'templates', label: t('tabTemplates'), badge: String(TEMPLATES.length), content: <TemplatesTab /> },
          { id: 'links', label: t('tabLinks'), badge: String(activeLinks.length), content: <LinksTab links={links} onUpdate={(next) => setLinks((current) => current.map((l) => (l.id === next.id ? next : l)))} /> },
          { id: 'stats', label: t('tabStats'), content: <StatsTab /> },
        ]}
      />

      <NewLinkDialog
        isOpen={dialog}
        onOpenChange={setDialog}
        nextId={`LNK-N${String(links.length + 1).padStart(4, '0')}`}
        onCreate={(link, channel) => {
          setLinks((current) => [link, ...current]);
          setTab('links');
          toast({ tone: 'success', title: t('toastCreated', { id: link.id, channel: t(`ch_${channel}`) }) });
        }}
      />
    </div>
  );
}

type Row = OutboundMessage & { readonly cancelled?: boolean };

function OutboxTab({ outbox, onUpdate }: { readonly outbox: readonly Row[]; readonly onUpdate: (message: Row) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();
  const [filter, setFilter] = useState<'all' | 'problems' | 'upcoming'>('all');
  const [channel, setChannel] = useState<'all' | Channel>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(outbox.find((m) => m.status === 'failed')?.id ?? null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return outbox
      .filter((m) => (filter === 'problems' ? PROBLEMS.includes(m.status) : filter === 'upcoming' ? UPCOMING.includes(m.status) : true))
      .filter((m) => channel === 'all' || m.channel === channel)
      .filter((m) => {
        if (q === '') {
          return true;
        }
        const p = getPatient(m.patientId);
        return [m.id, p.mrn, p.name.latin, p.name.ckb, p.name.ar].join(' ').toLowerCase().includes(q);
      })
      .toSorted((a, b) => b.scheduledIso.localeCompare(a.scheduledIso));
  }, [outbox, filter, channel, query]);

  const selected = outbox.find((m) => m.id === selectedId) ?? null;

  const statusBadge = (m: Row) =>
    m.cancelled === true ? (
      <Badge tone="neutral" size="sm">
        {t('cancelled')}
      </Badge>
    ) : (
      <Badge tone={DELIVERY_TONE[m.status]} size="sm" {...(m.status === 'failed' ? { icon: 'alert' as const } : {})}>
        {t(`ds_${m.status}`)}
      </Badge>
    );

  const columns: readonly Column<Row>[] = [
    { id: 'id', header: t('colMessage'), cell: (m) => <Code>{m.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (m) => <PatientCell patientId={m.patientId} /> },
    {
      id: 'template',
      header: t('colTemplate'),
      cell: (m) => {
        const tpl = TEMPLATE_BY_ID.get(m.templateId);
        return (
          <span className="msg-stack">
            <span>{tpl === undefined ? m.templateId : f.text(tpl.name)}</span>
            <span className="msg-muted">{f.text(m.about)}</span>
          </span>
        );
      },
    },
    { id: 'channel', header: t('colChannel'), cell: (m) => <ChannelBadge channel={m.channel} />, nowrap: true },
    { id: 'lang', header: t('colLanguage'), cell: (m) => t(`lang_${m.language}`) },
    { id: 'when', header: t('colWhen'), cell: (m) => f.relative(m.scheduledIso), nowrap: true },
    { id: 'status', header: t('colStatus'), cell: statusBadge, nowrap: true },
  ];

  return (
    <div className="msg-tab">
      <Toolbar label={t('outboxTable')}>
        <Segmented
          label={t('statusFilter')}
          hideLabel
          options={[
            { id: 'all', label: t('filterAll') },
            { id: 'problems', label: t('filterProblems') },
            { id: 'upcoming', label: t('filterUpcoming') },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as 'all' | 'problems' | 'upcoming')}
        />
        <SelectField
          label={t('channelFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allChannels') }, ...(['whatsapp', 'viber', 'sms'] as const).map((c) => ({ id: c, label: t(`ch_${c}`) }))]}
          selectedKey={channel}
          onSelectionChange={(id) => setChannel(id as 'all' | Channel)}
          className="msg-select"
        />
        <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="msg-search" />
      </Toolbar>
      <div className="msg-split">
        <Card flush className="msg-list">
          <DataTable
            caption={t('outboxTable')}
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            onRowAction={(m) => setSelectedId(m.id)}
            selectedKey={selectedId}
            rowTone={(m) => (m.status === 'failed' && m.cancelled !== true ? 'danger' : m.status === 'opted-out' ? 'warning' : undefined)}
            emptyText={t('noMatches')}
            dense
          />
        </Card>
        {selected === null ? (
          <Card>
            <EmptyState icon="phone" title={t('selectTitle')} body={t('selectBody')} compact />
          </Card>
        ) : (
          (() => {
            const tpl = TEMPLATE_BY_ID.get(selected.templateId);
            const patient = getPatient(selected.patientId);
            const text = tpl === undefined ? '' : fillTemplate(tpl, selected.language, patient, selected.language === 'en' ? selected.about.en : selected.about[selected.language]);
            const upcoming = UPCOMING.includes(selected.status) && selected.cancelled !== true;
            return (
              <Card
                title={<Code>{selected.id}</Code>}
                subtitle={tpl === undefined ? undefined : f.text(tpl.name)}
                icon="phone"
                className="msg-detail"
                actions={<IconButton icon="x" label={t('close')} onPress={() => setSelectedId(null)} />}
                footer={
                  <div className="msg-actions">
                    {selected.status === 'failed' && selected.cancelled !== true ? (
                      <>
                        <Button variant="primary" icon="refresh" onPress={() => { onUpdate({ ...selected, status: 'queued', statusIso: '2026-10-19T09:30:00+03:00', scheduledIso: '2026-10-19T09:31:00+03:00' }); toast({ tone: 'success', title: t('toastRetry', { id: selected.id }) }); }}>
                          {t('retry')}
                        </Button>
                        {selected.channel === 'sms' ? null : (
                          <Button variant="secondary" icon="bell" onPress={() => { onUpdate({ ...selected, channel: 'sms', status: 'sent', statusIso: '2026-10-19T09:30:00+03:00' }); toast({ tone: 'success', title: t('toastSms', { id: selected.id }) }); }}>
                            {t('retrySms')}
                          </Button>
                        )}
                      </>
                    ) : null}
                    {upcoming ? (
                      <>
                        <Button variant="primary" icon="arrow-forward" onPress={() => { onUpdate({ ...selected, status: 'sent', scheduledIso: '2026-10-19T09:30:00+03:00', statusIso: '2026-10-19T09:30:00+03:00' }); toast({ tone: 'success', title: t('toastSent', { id: selected.id }) }); }}>
                          {t('sendNow')}
                        </Button>
                        <Button variant="danger" icon="x" onPress={() => { onUpdate({ ...selected, cancelled: true }); toast({ tone: 'info', title: t('toastCancelled', { id: selected.id }) }); }}>
                          {t('cancel')}
                        </Button>
                      </>
                    ) : null}
                    <Button variant="ghost" icon="chart" onPress={() => goTo('chart', { patient: selected.patientId })}>
                      {t('openChart')}
                    </Button>
                    <Button variant="ghost" icon="calendar" onPress={() => goTo('appointments')}>
                      {t('openAppointments')}
                    </Button>
                  </div>
                }
              >
                <div className="msg-detail__body">
                  <div className="msg-inline">
                    {statusBadge(selected)}
                    <ChannelBadge channel={selected.channel} />
                  </div>
                  {selected.status === 'opted-out' ? <Callout tone="warning">{t('optedOutNote')}</Callout> : null}
                  {selected.status === 'failed' && selected.detail !== null ? <Callout tone="danger">{f.text(selected.detail)}</Callout> : null}
                  <PhonePreview
                    text={text}
                    channel={selected.channel}
                    language={selected.language}
                    footer={
                      selected.status === 'replied' && selected.detail !== null ? (
                        <p className="msg-bubble msg-bubble--reply">{f.text(selected.detail)}</p>
                      ) : null
                    }
                  />
                  <KeyValueList
                    items={[
                      { id: 'patient', label: t('colPatient'), value: <PatientCell patientId={selected.patientId} /> },
                      { id: 'phone', label: t('phone'), value: <Code>{patient.phone}</Code> },
                      { id: 'pref', label: t('preferred'), value: t(`lang_${patient.preferredLanguage}`) },
                      { id: 'when', label: t('colWhen'), value: f.dateTime(selected.scheduledIso) },
                      { id: 'status', label: t('colStatus'), value: t('statusAt', { status: t(`ds_${selected.status}`), when: f.relative(selected.statusIso) }) },
                      { id: 'about', label: t('colAbout'), value: f.text(selected.about) },
                    ]}
                  />
                </div>
              </Card>
            );
          })()
        )}
      </div>
    </div>
  );
}

function TemplatesTab(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string>(TEMPLATES[0]?.id ?? '');
  const [language, setLanguage] = useState<MsgLanguage>('ckb');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const selected: MessageTemplate | undefined = TEMPLATE_BY_ID.get(selectedId);
  const text = selected === undefined ? '' : fillTemplate(selected, language, null, null);
  // SMS: 70 characters per part in Unicode (Sorani and Arabic), 160 in GSM-7 Latin.
  const perPart = language === 'en' ? 160 : 70;
  const parts = Math.max(1, Math.ceil(text.length / perPart));

  const columns: readonly Column<MessageTemplate>[] = [
    {
      id: 'name',
      header: t('colName'),
      cell: (tpl) => (
        <span className="msg-stack">
          <span className="msg-strong">{f.text(tpl.name)}</span>
          <Code className="msg-muted">{tpl.id}</Code>
        </span>
      ),
    },
    { id: 'kind', header: t('colKind'), cell: (tpl) => t(`kind_${tpl.kind}`) },
    {
      id: 'channels',
      header: t('colChannels'),
      cell: (tpl) => (
        <span className="msg-inline">
          {tpl.channels.map((c) => (
            <ChannelBadge key={c} channel={c} />
          ))}
        </span>
      ),
    },
    {
      id: 'approval',
      header: t('colApproval'),
      cell: (tpl) => (
        <Badge tone={tpl.approval === 'approved' ? 'success' : tpl.approval === 'pending' ? 'info' : 'danger'} size="sm">
          {t(`ap_${tpl.approval}`)}
        </Badge>
      ),
      nowrap: true,
    },
  ];

  return (
    <div className="msg-split">
      <Card flush className="msg-list">
        <DataTable caption={t('templatesTable')} columns={columns} rows={TEMPLATES} rowKey={(tpl) => tpl.id} onRowAction={(tpl) => setSelectedId(tpl.id)} selectedKey={selectedId} dense />
      </Card>
      {selected === undefined ? null : (
        <Card
          title={f.text(selected.name)}
          subtitle={t(`kind_${selected.kind}`)}
          icon="pen"
          className="msg-detail"
          footer={
            <div className="msg-actions">
              <Button variant="secondary" icon="phone" onPress={() => toast({ tone: 'success', title: t('toastTest') })}>
                {t('sendTest')}
              </Button>
            </div>
          }
        >
          <div className="msg-detail__body">
            <Segmented
              label={t('previewLanguage')}
              options={(['ckb', 'ar', 'en'] as const).map((l) => ({ id: l, label: t(`lang_${l}`) }))}
              value={language}
              onChange={(id) => setLanguage(id as MsgLanguage)}
            />
            <Segmented
              label={t('previewChannel')}
              options={selected.channels.map((c) => ({ id: c, label: t(`ch_${c}`) }))}
              value={selected.channels.includes(channel) ? channel : (selected.channels[0] ?? 'sms')}
              onChange={(id) => setChannel(id as Channel)}
            />
            <PhonePreview text={text} channel={selected.channels.includes(channel) ? channel : (selected.channels[0] ?? 'sms')} language={language} />
            <p className="msg-muted">{t('charCount', { count: f.number(text.length), parts })}</p>
            <KeyValueList
              columns={1}
              items={[
                {
                  id: 'vars',
                  label: t('variables'),
                  value: (
                    <span className="msg-inline">
                      {selected.variables.map((v) => (
                        <Code key={v} className="msg-var">{`{${v}}`}</Code>
                      ))}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function StatsTab(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const tick = (date: string): string => f.weekday(date);
  const total = DELIVERY_WEEK.reduce((s, d) => ({ whatsapp: s.whatsapp + d.whatsapp, viber: s.viber + d.viber, sms: s.sms + d.sms }), { whatsapp: 0, viber: 0, sms: 0 });
  return (
    <Grid min="20rem">
      <Card title={t('statsTitle')} subtitle={t('statsSubtitle')} icon="chart" footer={t('deliveryNote')}>
        <BarChart orientation="vertical" height="9rem" label={t('statsTitle')} data={DELIVERY_WEEK.map((d) => ({ id: d.date, label: tick(d.date), value: d.delivered, valueLabel: f.number(d.delivered) }))} />
      </Card>
      <Card title={t('channelMix')} icon="phone">
        <BarChart
          label={t('channelMix')}
          data={(['whatsapp', 'viber', 'sms'] as const).map((c) => ({ id: c, label: t(`ch_${c}`), value: total[c], valueLabel: f.number(total[c]) }))}
        />
      </Card>
      <Card title={t('failedPerDay')} icon="alert">
        <BarChart orientation="vertical" height="6rem" tone="danger" label={t('failedPerDay')} data={DELIVERY_WEEK.map((d) => ({ id: d.date, label: tick(d.date), value: d.failed, valueLabel: f.number(d.failed) }))} />
      </Card>
    </Grid>
  );
}
