/**
 * The claims tab: the claim worklist, the document pack checklist (a claim is submitted only with a full
 * pack), deductions with their reasons (each can be disputed) and the remittance action.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { getPatient } from '../../data/index.ts';
import { CLAIM_DOC_KINDS, PAYER_ACCOUNTS, payerAccount, type Claim, type ClaimDocKind, type ClaimStatus } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  DataTable,
  IconButton,
  KeyValueList,
  SearchField,
  SelectField,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { ClaimBadge, IqdUsd, NoSelection, PatientCell } from './parts.tsx';

export function deductedOf(claim: Claim): number {
  return claim.deductions.reduce((sum, d) => sum + d.amountIqd, 0);
}

export interface ClaimsTabProps {
  readonly claims: readonly Claim[];
  readonly onUpdate: (claim: Claim) => void;
}

export function ClaimsTab({ claims, onUpdate }: ClaimsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const goTo = useGoTo();
  const toast = useToast();
  const [payer, setPayer] = useState('all');
  const [status, setStatus] = useState<'all' | ClaimStatus>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(claims[0]?.id ?? null);
  const [disputed, setDisputed] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((claim) => {
      if (payer !== 'all' && claim.payerId !== payer) {
        return false;
      }
      if (status !== 'all' && claim.status !== status) {
        return false;
      }
      if (q === '') {
        return true;
      }
      const patient = getPatient(claim.patientId);
      return [claim.id, claim.invoiceRef, patient.mrn, patient.name.latin, patient.name.ckb, patient.name.ar].join(' ').toLowerCase().includes(q);
    });
  }, [claims, payer, status, query]);

  const selected = claims.find((claim) => claim.id === selectedId) ?? null;
  const total = CLAIM_DOC_KINDS.length;

  const columns: readonly Column<Claim>[] = [
    { id: 'id', header: t('colClaim'), cell: (c) => <Code>{c.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (c) => <PatientCell patientId={c.patientId} /> },
    { id: 'payer', header: t('colPayer'), cell: (c) => f.text(payerAccount(c.payerId).name) },
    { id: 'service', header: t('colServiceOn'), cell: (c) => f.date(c.serviceOn), nowrap: true },
    { id: 'billed', header: t('colBilled'), cell: (c) => f.iqd(c.billedIqd), align: 'end', nowrap: true },
    { id: 'paid', header: t('colPaid'), cell: (c) => f.iqd(c.paidIqd), align: 'end', nowrap: true },
    {
      id: 'docs',
      header: t('colDocs'),
      cell: (c) => (
        <Badge tone={c.docs.length === total ? 'success' : 'warning'} size="sm">
          {t('docsCount', { have: c.docs.length, total })}
        </Badge>
      ),
      nowrap: true,
    },
    { id: 'status', header: t('colStatus'), cell: (c) => <ClaimBadge status={c.status} />, nowrap: true },
  ];

  const statusOptions = [
    { id: 'all', label: t('filterAll') },
    ...(['preparing', 'submitted', 'under-review', 'part-paid', 'paid', 'rejected'] as const).map((s) => ({ id: s, label: t(`cl_${s}`) })),
  ];

  const toggleDoc = (claim: Claim, doc: ClaimDocKind, on: boolean): void => {
    const docs = on ? CLAIM_DOC_KINDS.filter((d) => d === doc || claim.docs.includes(d)) : claim.docs.filter((d) => d !== doc);
    onUpdate({ ...claim, docs });
  };

  return (
    <div className="ins-tab">
      <Toolbar label={t('claimsTable')}>
        <SelectField label={t('statusFilter')} hideLabel options={statusOptions} selectedKey={status} onSelectionChange={(id) => setStatus(id as 'all' | ClaimStatus)} className="ins-select" />
        <SelectField
          label={t('payerFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allPayers') }, ...PAYER_ACCOUNTS.map((p) => ({ id: p.id, label: f.text(p.name) }))]}
          selectedKey={payer}
          onSelectionChange={setPayer}
          className="ins-select"
        />
        <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="ins-search" />
      </Toolbar>
      <div className="ins-split">
        <Card flush className="ins-list">
          <DataTable
            caption={t('claimsTable')}
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            onRowAction={(c) => setSelectedId(c.id)}
            selectedKey={selectedId}
            rowTone={(c) => (c.status === 'rejected' ? 'danger' : undefined)}
            emptyText={t('noMatches')}
            dense
          />
        </Card>
        {selected === null ? (
          <Card>
            <NoSelection />
          </Card>
        ) : (
          (() => {
            const payerAcc = payerAccount(selected.payerId);
            const missing = total - selected.docs.length;
            const deducted = deductedOf(selected);
            const outstanding = Math.max(0, selected.billedIqd - selected.paidIqd - deducted);
            const editable = selected.status === 'preparing';
            return (
              <Card
                title={<Code>{selected.id}</Code>}
                subtitle={f.text(payerAcc.name)}
                icon="receipt"
                className="ins-detail"
                actions={<IconButton icon="x" label={t('close')} onPress={() => setSelectedId(null)} />}
                footer={
                  <div className="ins-actions">
                    {editable ? (
                      <Button
                        variant="primary"
                        icon="arrow-forward"
                        isDisabled={missing > 0}
                        onPress={() => {
                          onUpdate({ ...selected, status: 'submitted', submittedOn: '2026-10-19' });
                          toast({ tone: 'success', title: t('toastClaimSubmitted', { id: selected.id }) });
                        }}
                      >
                        {t('submitClaim')}
                      </Button>
                    ) : null}
                    {selected.status === 'submitted' || selected.status === 'under-review' ? (
                      <Button
                        variant="primary"
                        icon="money"
                        onPress={() => {
                          onUpdate({ ...selected, status: 'paid', paidIqd: selected.billedIqd - deducted });
                          toast({ tone: 'success', title: t('toastRemittance', { id: selected.id }) });
                        }}
                      >
                        {t('recordRemittance')}
                      </Button>
                    ) : null}
                    <Button variant="ghost" icon="receipt" onPress={() => goTo('billing', { patient: selected.patientId })}>
                      {t('openBilling')}
                    </Button>
                  </div>
                }
              >
                <div className="ins-detail__body">
                  <div className="ins-detail__status">
                    <ClaimBadge status={selected.status} />
                  </div>
                  <KeyValueList
                    items={[
                      { id: 'patient', label: t('colPatient'), value: <PatientCell patientId={selected.patientId} /> },
                      { id: 'invoice', label: t('colInvoice'), value: <Code>{selected.invoiceRef}</Code> },
                      { id: 'service', label: t('colServiceOn'), value: f.date(selected.serviceOn) },
                      { id: 'submitted', label: t('submittedOn'), value: selected.submittedOn === null ? t('notYet') : f.date(selected.submittedOn) },
                      { id: 'billed', label: t('colBilled'), value: <IqdUsd amount={selected.billedIqd} showUsd={payerAcc.currency === 'USD'} /> },
                      { id: 'outstanding', label: t('outstanding'), value: <IqdUsd amount={outstanding} showUsd={payerAcc.currency === 'USD'} /> },
                    ]}
                  />
                  <h3 className="ins-h3">{t('packTitle')}</h3>
                  <ul className="ins-docs">
                    {CLAIM_DOC_KINDS.map((doc) => (
                      <li key={doc}>
                        <Checkbox isSelected={selected.docs.includes(doc)} isDisabled={!editable} onChange={(on) => toggleDoc(selected, doc, on)}>
                          {t(`doc_${doc}`)}
                        </Checkbox>
                      </li>
                    ))}
                  </ul>
                  {missing > 0 ? (
                    <Callout tone="warning">{t('packMissing', { count: missing })}</Callout>
                  ) : (
                    <Callout tone="success">{t('packComplete')}</Callout>
                  )}
                  <h3 className="ins-h3">{t('deductionsTitle')}</h3>
                  {selected.deductions.length === 0 ? (
                    <p className="ins-muted">{t('deductionsEmpty')}</p>
                  ) : (
                    <ul className="ins-deductions">
                      {selected.deductions.map((d) => {
                        const key = `${selected.id}:${d.id}`;
                        const isDisputed = disputed.has(key);
                        return (
                          <li key={d.id} className="ins-deduction">
                            <span className="ins-stack">
                              <span>{f.text(d.reason)}</span>
                              <Code className="ins-muted">{d.code}</Code>
                            </span>
                            <span className="ins-deduction__end">
                              <span className="ui-nowrap">{f.iqd(d.amountIqd)}</span>
                              {isDisputed ? (
                                <Badge tone="info" size="sm">
                                  {t('disputed')}
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    setDisputed(new Set([...disputed, key]));
                                    toast({ tone: 'info', title: t('toastDisputed') });
                                  }}
                                >
                                  {t('dispute')}
                                </Button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })()
        )}
      </div>
    </div>
  );
}
