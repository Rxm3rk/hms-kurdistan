/**
 * The links tab: booking, wallet payment and report-download links (OTP to the registered phone, or an
 * expiring link), each with its audit trail and the staff actions (revoke, resend code, extend, copy), and
 * the dialog that creates and sends a new link.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW, PATIENTS, getPatient } from '../../data/index.ts';
import type { Channel, LinkKind, SecureLink } from '../../data/ext/messaging.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Dialog,
  EmptyState,
  IconButton,
  KeyValueList,
  Money,
  SelectField,
  TextInput,
  Toolbar,
  personName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { LINK_TONE, PatientCell } from './parts.tsx';

export interface LinksTabProps {
  readonly links: readonly SecureLink[];
  readonly onUpdate: (link: SecureLink) => void;
}

const nowIso = (): string => DEMO_NOW.toISOString();

export function LinksTab({ links, onUpdate }: LinksTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [kind, setKind] = useState<'all' | LinkKind>('all');
  const [selectedId, setSelectedId] = useState<string | null>(links[0]?.id ?? null);
  const rows = kind === 'all' ? links : links.filter((l) => l.kind === kind);
  const selected = links.find((l) => l.id === selectedId) ?? null;

  const columns: readonly Column<SecureLink>[] = [
    { id: 'id', header: t('colLink'), cell: (l) => <Code>{l.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (l) => <PatientCell patientId={l.patientId} /> },
    {
      id: 'kind',
      header: t('colKindLink'),
      cell: (l) => (
        <span className="msg-stack">
          <span>{t(`lk_${l.kind}`)}</span>
          <span className="msg-muted">{f.text(l.about)}</span>
        </span>
      ),
    },
    { id: 'access', header: t('colAccess'), cell: (l) => <span className="msg-muted">{t(`ac_${l.access}`)}</span> },
    { id: 'amount', header: t('colAmount'), cell: (l) => (l.amount === null || l.currency === null ? '–' : <Money amount={l.amount} currency={l.currency} />), align: 'end', nowrap: true },
    { id: 'expires', header: t('colExpires'), cell: (l) => f.relative(l.expiresIso), nowrap: true },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (l) => (
        <Badge tone={LINK_TONE[l.status]} size="sm">
          {t(`ls_${l.status}`)}
        </Badge>
      ),
      nowrap: true,
    },
  ];

  const add = (link: SecureLink, event: SecureLink['events'][number]['event'], patch: Partial<SecureLink> = {}): SecureLink => ({
    ...link,
    ...patch,
    events: [...link.events, { iso: nowIso(), event, device: null }],
  });

  return (
    <div className="msg-tab">
      <Toolbar label={t('linksTable')}>
        <SelectField
          label={t('kindFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allKinds') }, ...(['booking', 'payment', 'report'] as const).map((k) => ({ id: k, label: t(`lk_${k}`) }))]}
          selectedKey={kind}
          onSelectionChange={(id) => setKind(id as 'all' | LinkKind)}
          className="msg-select"
        />
      </Toolbar>
      <div className="msg-split">
        <Card flush className="msg-list">
          <DataTable caption={t('linksTable')} columns={columns} rows={rows} rowKey={(l) => l.id} onRowAction={(l) => setSelectedId(l.id)} selectedKey={selectedId} rowTone={(l) => (l.status === 'revoked' ? 'danger' : undefined)} dense />
        </Card>
        {selected === null ? (
          <Card>
            <EmptyState icon="lock" title={t('selectTitle')} body={t('selectBody')} compact />
          </Card>
        ) : (
          <Card
            title={<Code>{selected.id}</Code>}
            subtitle={`${t(`lk_${selected.kind}`)} · ${f.text(selected.about)}`}
            icon="lock"
            className="msg-detail"
            actions={<IconButton icon="x" label={t('close')} onPress={() => setSelectedId(null)} />}
            footer={
              <div className="msg-actions">
                {selected.status === 'active' && selected.access === 'otp' ? (
                  <Button variant="secondary" icon="refresh" onPress={() => { onUpdate(add(selected, 'otp-sent')); toast({ tone: 'success', title: t('toastOtp') }); }}>
                    {t('resendOtp')}
                  </Button>
                ) : null}
                {selected.status === 'active' || selected.status === 'expired' ? (
                  <Button
                    variant="secondary"
                    icon="clock"
                    onPress={() => {
                      onUpdate({ ...selected, status: 'active', expiresIso: new Date(Math.max(Date.parse(selected.expiresIso), DEMO_NOW.getTime()) + 24 * 3_600_000).toISOString() });
                      toast({ tone: 'success', title: t('toastExtended', { id: selected.id }) });
                    }}
                  >
                    {t('extend')}
                  </Button>
                ) : null}
                <Button variant="ghost" icon="clipboard" onPress={() => toast({ tone: 'info', title: t('toastCopied') })}>
                  {t('copy')}
                </Button>
                {selected.status === 'active' ? (
                  <Button variant="danger" icon="lock" onPress={() => { onUpdate(add(selected, 'revoked', { status: 'revoked' })); toast({ tone: 'warning', title: t('toastRevoked', { id: selected.id }) }); }}>
                    {t('revoke')}
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="msg-detail__body">
              <KeyValueList
                items={[
                  { id: 'patient', label: t('colPatient'), value: <PatientCell patientId={selected.patientId} /> },
                  { id: 'phone', label: t('phone'), value: <Code>{getPatient(selected.patientId).phone}</Code> },
                  { id: 'access', label: t('colAccess'), value: t(`ac_${selected.access}`) },
                  { id: 'expires', label: t('colExpires'), value: f.dateTime(selected.expiresIso) },
                  { id: 'url', label: t('colLink'), value: <Code>{selected.url}</Code> },
                  ...(selected.amount === null || selected.currency === null ? [] : [{ id: 'amount', label: t('colAmount'), value: <Money amount={selected.amount} currency={selected.currency} /> }]),
                  ...(selected.wallet === null ? [] : [{ id: 'wallet', label: t('wallet'), value: <Code>{selected.wallet}</Code> }]),
                ]}
              />
              {(() => {
                const failed = selected.events.filter((e) => e.event === 'otp-failed').length;
                return failed > 0 ? <Callout tone={selected.status === 'revoked' ? 'danger' : 'warning'}>{t('failedOtpNote', { count: failed })}</Callout> : null;
              })()}
              <h3 className="msg-h3">{t('auditTitle')}</h3>
              <ol className="msg-audit">
                {selected.events.toReversed().map((e, i) => (
                  <li key={`${e.iso}-${String(i)}`} className={`msg-audit__item msg-audit__item--${e.event}`}>
                    <span className="msg-audit__dot" aria-hidden="true" />
                    <span className="msg-stack">
                      <span className="msg-strong">{t(`ev_${e.event}`)}</span>
                      <span className="msg-muted">
                        {f.dateTime(e.iso)}
                        {e.device === null ? null : (
                          <>
                            {' · '}
                            <Code>{e.device}</Code>
                          </>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export function NewLinkDialog({
  isOpen,
  onOpenChange,
  nextId,
  onCreate,
}: {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly nextId: string;
  readonly onCreate: (link: SecureLink, channel: Channel) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [patientId, setPatientId] = useState(PATIENTS[0]?.id ?? '');
  const [kind, setKind] = useState<LinkKind>('payment');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [amount, setAmount] = useState('250000');
  const [about, setAbout] = useState('');
  const amountIqd = Number(amount.replace(/[^\d]/gu, ''));
  const valid = about.trim() !== '' && (kind !== 'payment' || amountIqd > 0);
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('dialogTitle')}
      subtitle={t('dialogSubtitle')}
      actions={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="arrow-forward"
            isDisabled={!valid}
            onPress={() => {
              const text = about.trim();
              const now = DEMO_NOW.getTime();
              const hours = kind === 'report' ? 72 : kind === 'payment' ? 24 : 7 * 24;
              const code = nextId.slice(4);
              onCreate(
                {
                  id: nextId,
                  kind,
                  patientId,
                  access: kind === 'report' ? 'otp' : 'expiring',
                  createdIso: nowIso(),
                  expiresIso: new Date(now + hours * 3_600_000).toISOString(),
                  status: 'active',
                  url: `https://demo.hms.krd/${kind === 'report' ? 'r' : kind === 'payment' ? 'p' : 'b'}/${code}`,
                  about: { en: text, ckb: text, ar: text },
                  amount: kind === 'payment' ? amountIqd : null,
                  currency: kind === 'payment' ? 'IQD' : null,
                  wallet: null,
                  events: [
                    { iso: nowIso(), event: 'created', device: null },
                    { iso: nowIso(), event: 'sent', device: null },
                  ],
                },
                channel,
              );
              setAbout('');
              onOpenChange(false);
            }}
          >
            {t('create')}
          </Button>
        </>
      }
    >
      <div className="msg-form">
        <SelectField
          label={t('fieldPatient')}
          options={PATIENTS.slice(0, 30).map((p) => ({ id: p.id, label: `${personName(p.name, f.locale)} · ${p.mrn}` }))}
          selectedKey={patientId}
          onSelectionChange={setPatientId}
        />
        <div className="msg-form__row">
          <SelectField label={t('fieldKind')} options={(['payment', 'booking', 'report'] as const).map((k) => ({ id: k, label: t(`lk_${k}`) }))} selectedKey={kind} onSelectionChange={(id) => setKind(id as LinkKind)} />
          <SelectField label={t('fieldChannel')} options={(['whatsapp', 'viber', 'sms'] as const).map((c) => ({ id: c, label: t(`ch_${c}`) }))} selectedKey={channel} onSelectionChange={(id) => setChannel(id as Channel)} />
        </div>
        <TextInput label={t('fieldAbout')} value={about} onChange={setAbout} isRequired />
        {kind === 'payment' ? <TextInput label={t('fieldAmount')} value={amount} onChange={setAmount} dir="ltr" inputMode="numeric" description={f.iqd(amountIqd)} /> : null}
        <p className="msg-muted">{`${t('fieldAccess')}: ${t(kind === 'report' ? 'ac_otp' : 'ac_expiring')}`}</p>
      </div>
    </Dialog>
  );
}
