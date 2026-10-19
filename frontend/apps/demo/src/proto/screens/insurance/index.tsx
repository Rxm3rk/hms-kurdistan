/**
 * The Insurance & corporate screen (hospital-wide): the payer desk for insurers, companies and NGOs.
 * Pre-approval requests with their payer and patient split, claims with document packs and deductions,
 * payer contracts and credit limits, and receivables by ageing bucket. Changes stay in React state.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useState, type ReactNode } from 'react';
import { EXCHANGE_RATE, PATIENTS, minutesFromNow } from '../../data/index.ts';
import { CLAIMS, PAYER_ACCOUNTS, PRE_APPROVALS, type Claim, type PreApproval, type PreApprovalStatus } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Dialog, Grid, PageHeader, SelectField, StatTile, Tabs, TextInput, personName, useToast } from '../../ui/index.ts';
import { ClaimsTab, deductedOf } from './claims.tsx';
import './insurance.css';
import { messages } from './messages.ts';
import { paTotals } from './parts.tsx';
import { AgeingTab, PayersTab, ageingTotal } from './payers.tsx';
import { PreapprovalsTab } from './preapprovals.tsx';

const TOAST_KEY = { submitted: 'toastSubmitted', approved: 'toastApproved', denied: 'toastDenied' } as const;

export function InsuranceScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [requests, setRequests] = useState<readonly PreApproval[]>(PRE_APPROVALS);
  const [claims, setClaims] = useState<readonly Claim[]>(CLAIMS);
  const [tab, setTab] = useState('preapprovals');
  const [dialogOpen, setDialogOpen] = useState(false);

  const changeStatus = (id: string, status: PreApprovalStatus): void => {
    const before = requests.find((r) => r.id === id);
    setRequests((current) =>
      current.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              ...(status === 'approved' ? { authorisationNo: `AUTH-${String(80000 + current.indexOf(r))}`, validUntil: '2026-11-18' } : {}),
            }
          : r,
      ),
    );
    const key = before?.status === 'queried' && status === 'submitted' ? 'toastAnswered' : TOAST_KEY[status as keyof typeof TOAST_KEY];
    toast({ tone: status === 'denied' ? 'warning' : 'success', title: t(key, { id }) });
  };

  const pending = requests.filter((r) => r.status === 'submitted' || r.status === 'queried');
  const queried = requests.filter((r) => r.status === 'queried').length;
  const approved = requests.filter((r) => (r.status === 'approved' || r.status === 'partial') && minutesFromNow(r.requestedIso) > -30 * 24 * 60);
  const approvedValue = approved.reduce((sum, r) => sum + paTotals(r).payer, 0);
  const receivables = PAYER_ACCOUNTS.reduce((sum, p) => sum + ageingTotal(p.ageing), 0);
  const over90 = PAYER_ACCOUNTS.reduce((sum, p) => sum + p.ageing.d90plus, 0);
  const settled = claims.filter((c) => c.status === 'paid' || c.status === 'part-paid' || c.status === 'rejected');
  const settledBilled = settled.reduce((sum, c) => sum + c.billedIqd, 0);
  const deductionRate = settledBilled === 0 ? 0 : settled.reduce((sum, c) => sum + deductedOf(c), 0) / settledBilled;

  return (
    <div className="insurance-screen">
      <PageHeader
        icon="shield"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="primary" icon="plus" onPress={() => setDialogOpen(true)}>
            {t('newPreapproval')}
          </Button>
        }
      >
        <div className="ins-header-badges">
          <Badge tone="info" icon="money" size="sm">
            {f.text(EXCHANGE_RATE.note)}
          </Badge>
          <Badge tone="neutral" icon="info" size="sm">
            {t('synthetic')}
          </Badge>
        </div>
      </PageHeader>

      <Grid min="12.5rem">
        <StatTile
          label={t('tilePending')}
          value={f.number(pending.length)}
          icon="clock"
          tone={queried > 0 ? 'warning' : undefined}
          hint={t('tilePendingHint', { count: queried })}
          onPress={() => setTab('preapprovals')}
        />
        <StatTile label={t('tileApproved')} value={f.iqd(approvedValue)} icon="check-circle" hint={t('tileApprovedHint', { count: approved.length })} />
        <StatTile
          label={t('tileReceivables')}
          value={f.iqd(receivables)}
          icon="building"
          hint={t('tileReceivablesHint', { count: PAYER_ACCOUNTS.length })}
          trend={[412, 431, 455, 448, 470, 489, receivables / 1_000_000]}
          trendLabel={t('tileReceivables')}
          onPress={() => setTab('ageing')}
        />
        <StatTile label={t('tileOver90')} value={f.iqd(over90)} icon="alert" tone="danger" hint={t('tileOver90Hint')} onPress={() => setTab('ageing')} />
        <StatTile label={t('tileDeduction')} value={f.percent(deductionRate)} icon="minus" hint={t('tileDeductionHint')} onPress={() => setTab('claims')} />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          {
            id: 'preapprovals',
            label: t('tabPreapprovals'),
            badge: String(pending.length),
            content: <PreapprovalsTab requests={requests} onChange={changeStatus} />,
          },
          {
            id: 'claims',
            label: t('tabClaims'),
            badge: String(claims.filter((c) => c.status === 'preparing').length),
            content: <ClaimsTab claims={claims} onUpdate={(next) => setClaims((current) => current.map((c) => (c.id === next.id ? next : c)))} />,
          },
          { id: 'payers', label: t('tabPayers'), content: <PayersTab claims={claims} /> },
          { id: 'ageing', label: t('tabAgeing'), content: <AgeingTab /> },
        ]}
      />

      <NewPreapprovalDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        nextNumber={requests.length + 1}
        onCreate={(request) => {
          setRequests((current) => [request, ...current]);
          setTab('preapprovals');
          toast({ tone: 'success', title: t('toastCreated', { id: request.id }) });
        }}
      />
    </div>
  );
}

function NewPreapprovalDialog({
  isOpen,
  onOpenChange,
  nextNumber,
  onCreate,
}: {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly nextNumber: number;
  readonly onCreate: (request: PreApproval) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [patientId, setPatientId] = useState<string>(PATIENTS[0]?.id ?? '');
  const [payerId, setPayerId] = useState<string>(PAYER_ACCOUNTS[0]?.id ?? '');
  const [kind, setKind] = useState<PreApproval['kind']>('day-case');
  const [service, setService] = useState('');
  const [amount, setAmount] = useState('');
  const amountIqd = Number(amount.replace(/[^\d]/g, ''));
  const valid = service.trim() !== '' && amountIqd > 0;
  const payer = PAYER_ACCOUNTS.find((p) => p.id === payerId);

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
            isDisabled={!valid}
            onPress={() => {
              const id = `SYN-PA-${String(nextNumber).padStart(4, '0')}`;
              const text = service.trim();
              onCreate({
                id,
                patientId,
                payerId,
                service: { en: text, ckb: text, ar: text },
                kind,
                requestedIso: '2026-10-19T09:30:00+03:00',
                status: 'draft',
                authorisationNo: null,
                validUntil: null,
                note: null,
                lines: [{ id: 'a', code: 'SYN-TAR-EST01', description: { en: text, ckb: text, ar: text }, quantity: 1, unitIqd: amountIqd, payerPct: payer?.coveragePct ?? 0 }],
              });
              setService('');
              setAmount('');
              onOpenChange(false);
            }}
          >
            {t('createDraft')}
          </Button>
        </>
      }
    >
      <div className="ins-form">
        <SelectField
          label={t('fieldPatient')}
          options={PATIENTS.slice(0, 30).map((p) => ({ id: p.id, label: `${personName(p.name, f.locale)} · ${p.mrn}` }))}
          selectedKey={patientId}
          onSelectionChange={setPatientId}
        />
        <SelectField label={t('fieldPayer')} options={PAYER_ACCOUNTS.map((p) => ({ id: p.id, label: f.text(p.name) }))} selectedKey={payerId} onSelectionChange={setPayerId} />
        <SelectField
          label={t('fieldKind')}
          options={(['inpatient', 'day-case', 'outpatient', 'imaging'] as const).map((k) => ({ id: k, label: t(`kind_${k}`) }))}
          selectedKey={kind}
          onSelectionChange={(id) => setKind(id as PreApproval['kind'])}
        />
        <TextInput label={t('fieldService')} value={service} onChange={setService} isRequired />
        <TextInput
          label={t('fieldAmount')}
          value={amount}
          onChange={setAmount}
          dir="ltr"
          inputMode="numeric"
          isRequired
          {...(amountIqd > 0 && payer !== undefined ? { description: `${t('defaultCover')}: ${f.percent(payer.coveragePct / 100)} · ${f.iqd(Math.round((amountIqd * payer.coveragePct) / 100))}` } : {})}
        />
      </div>
    </Dialog>
  );
}
