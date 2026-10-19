/**
 * The pre-approvals tab: the request worklist (status filter, payer filter, search) and the request detail
 * with its per-line payer and patient split and the workflow actions.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { getPatient } from '../../data/index.ts';
import { PAYER_ACCOUNTS, payerAccount, type PreApproval, type PreApprovalStatus } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  IconButton,
  KeyValueList,
  SearchField,
  Segmented,
  SelectField,
  Toolbar,
  personName,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { IqdUsd, NoSelection, PaBadge, PatientCell, paTotals } from './parts.tsx';

type Filter = 'open' | 'all' | PreApprovalStatus;
const OPEN: readonly PreApprovalStatus[] = ['draft', 'submitted', 'queried'];

export interface PreapprovalsTabProps {
  readonly requests: readonly PreApproval[];
  readonly onChange: (id: string, status: PreApprovalStatus) => void;
}

export function PreapprovalsTab({ requests, onChange }: PreapprovalsTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const goTo = useGoTo();
  const [filter, setFilter] = useState<Filter>('open');
  const [payer, setPayer] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (filter === 'open' ? !OPEN.includes(request.status) : filter !== 'all' && request.status !== filter) {
        return false;
      }
      if (payer !== 'all' && request.payerId !== payer) {
        return false;
      }
      if (q === '') {
        return true;
      }
      const patient = getPatient(request.patientId);
      const hay = [request.id, patient.mrn, patient.name.latin, patient.name.ckb, patient.name.ar, f.text(payerAccount(request.payerId).name), f.text(request.service)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, filter, payer, query, f]);

  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const columns: readonly Column<PreApproval>[] = [
    { id: 'id', header: t('colRequest'), cell: (r) => <Code>{r.id}</Code>, nowrap: true },
    { id: 'patient', header: t('colPatient'), cell: (r) => <PatientCell patientId={r.patientId} /> },
    { id: 'payer', header: t('colPayer'), cell: (r) => f.text(payerAccount(r.payerId).name) },
    {
      id: 'service',
      header: t('colService'),
      cell: (r) => (
        <span className="ins-stack">
          <span>{f.text(r.service)}</span>
          <span className="ins-muted">{t(`kind_${r.kind}`)}</span>
        </span>
      ),
    },
    { id: 'requested', header: t('colRequested'), cell: (r) => f.relative(r.requestedIso), nowrap: true },
    { id: 'estimate', header: t('colEstimate'), cell: (r) => <IqdUsd amount={paTotals(r).gross} />, align: 'end', nowrap: true },
    { id: 'status', header: t('colStatus'), cell: (r) => <PaBadge status={r.status} />, nowrap: true },
  ];

  const filterOptions = [
    { id: 'open', label: t('filterOpen') },
    { id: 'approved', label: t('pa_approved') },
    { id: 'denied', label: t('pa_denied') },
    { id: 'all', label: t('filterAll') },
  ];

  return (
    <div className="ins-tab">
      <Toolbar label={t('paTable')}>
        <Segmented label={t('statusFilter')} hideLabel options={filterOptions} value={filter} onChange={(id) => setFilter(id as Filter)} />
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
            caption={t('paTable')}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowAction={(r) => setSelectedId(r.id)}
            selectedKey={selectedId}
            rowTone={(r) => (r.status === 'queried' ? 'warning' : undefined)}
            emptyText={t('noMatches')}
            dense
          />
        </Card>
        {selected === null ? (
          <Card>
            <NoSelection />
          </Card>
        ) : (
          <PreapprovalDetail request={selected} onChange={onChange} onClose={() => setSelectedId(null)} onOpen={(screen) => goTo(screen, { patient: selected.patientId })} />
        )}
      </div>
    </div>
  );
}

function PreapprovalDetail({
  request,
  onChange,
  onClose,
  onOpen,
}: {
  readonly request: PreApproval;
  readonly onChange: (id: string, status: PreApprovalStatus) => void;
  readonly onClose: () => void;
  readonly onOpen: (screen: 'chart' | 'billing') => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const payer = payerAccount(request.payerId);
  const patient = getPatient(request.patientId);
  const totals = paTotals(request);
  const usd = payer.currency === 'USD';

  return (
    <Card
      title={<Code>{request.id}</Code>}
      subtitle={f.text(request.service)}
      icon="shield"
      className="ins-detail"
      actions={<IconButton icon="x" label={t('close')} onPress={onClose} />}
      footer={
        <div className="ins-actions">
          {request.status === 'draft' ? (
            <Button variant="primary" icon="arrow-forward" onPress={() => onChange(request.id, 'submitted')}>
              {t('submit')}
            </Button>
          ) : null}
          {request.status === 'queried' ? (
            <Button variant="primary" icon="arrow-forward" onPress={() => onChange(request.id, 'submitted')}>
              {t('answerQuery')}
            </Button>
          ) : null}
          {request.status === 'submitted' ? (
            <>
              <Button variant="primary" icon="check" onPress={() => onChange(request.id, 'approved')}>
                {t('recordApproval')}
              </Button>
              <Button variant="danger" icon="x" onPress={() => onChange(request.id, 'denied')}>
                {t('recordDenial')}
              </Button>
            </>
          ) : null}
          <Button variant="ghost" icon="chart" onPress={() => onOpen('chart')}>
            {t('openChart')}
          </Button>
          <Button variant="ghost" icon="receipt" onPress={() => onOpen('billing')}>
            {t('openBilling')}
          </Button>
        </div>
      }
    >
      <div className="ins-detail__body">
        <div className="ins-detail__status">
          <PaBadge status={request.status} />
          <Badge tone="neutral" size="sm">
            {t(`kind_${request.kind}`)}
          </Badge>
        </div>
        <KeyValueList
          items={[
            { id: 'patient', label: t('colPatient'), value: <span>{personName(patient.name, f.locale)} · <Code>{patient.mrn}</Code></span> },
            { id: 'payer', label: t('colPayer'), value: f.text(payer.name) },
            { id: 'requested', label: t('requestedOn'), value: f.dateTime(request.requestedIso) },
            { id: 'auth', label: t('authNo'), value: request.authorisationNo === null ? t('notYet') : <Code>{request.authorisationNo}</Code> },
            { id: 'valid', label: t('validUntil'), value: request.validUntil === null ? t('notYet') : f.date(request.validUntil) },
            { id: 'currency', label: t('billingCurrency'), value: payer.currency },
          ]}
        />
        {request.note === null ? null : (
          <Callout tone={request.status === 'denied' ? 'danger' : 'warning'} title={t('payerNote')}>
            {f.text(request.note)}
          </Callout>
        )}
        <h3 className="ins-h3">{t('splitTitle')}</h3>
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--dense ins-split-table">
            <caption className="hms-visually-hidden">{t('splitTitle')}</caption>
            <thead>
              <tr>
                <th scope="col" className="ui-table__th ui-align-start">{t('lineItem')}</th>
                <th scope="col" className="ui-table__th ui-align-end">{t('lineQty')}</th>
                <th scope="col" className="ui-table__th ui-align-end">{t('lineAmount')}</th>
                <th scope="col" className="ui-table__th ui-align-end">{t('linePayer')}</th>
                <th scope="col" className="ui-table__th ui-align-end">{t('linePatient')}</th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => {
                const amount = line.quantity * line.unitIqd;
                const payerPart = Math.round((amount * line.payerPct) / 100);
                return (
                  <tr key={line.id} className="ui-table__row">
                    <td className="ui-table__td">
                      <span className="ins-stack">
                        <span>{f.text(line.description)}</span>
                        <span className="ins-muted">
                          <Code>{line.code}</Code>
                          {line.payerPct === 0 ? (
                            <>
                              {' '}
                              <Badge tone="warning" size="sm">
                                {t('excluded')}
                              </Badge>
                            </>
                          ) : (
                            ` · ${f.percent(line.payerPct / 100)}`
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="ui-table__td ui-align-end">{f.number(line.quantity)}</td>
                    <td className="ui-table__td ui-align-end ui-nowrap">{f.iqd(amount)}</td>
                    <td className="ui-table__td ui-align-end ui-nowrap">{f.iqd(payerPart)}</td>
                    <td className="ui-table__td ui-align-end ui-nowrap">{f.iqd(amount - payerPart)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ins-total-row">
                <th scope="row" className="ui-table__td ui-align-start" colSpan={2}>
                  {t('totals')}
                </th>
                <td className="ui-table__td ui-align-end ui-nowrap">
                  <IqdUsd amount={totals.gross} showUsd={usd} />
                </td>
                <td className="ui-table__td ui-align-end ui-nowrap">
                  <IqdUsd amount={totals.payer} showUsd={usd} />
                </td>
                <td className="ui-table__td ui-align-end ui-nowrap">
                  <IqdUsd amount={totals.patient} showUsd={usd} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Card>
  );
}
