/**
 * Inventory and stores: the main store and sub-stores, stock by batch picked first-expiry first-out, ward
 * requisitions (approve, pick, issue), purchase orders (draft, approve, send, receive) and the
 * consumption-to-charge leakage view. Every change stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, DEMO_TODAY, EXCHANGE_RATE, findStaff, iqdToUsd, usdToIqd, type Tone } from '../../data/index.ts';
import {
  CATEGORY_LABEL,
  LEAKAGE,
  PURCHASE_ORDERS,
  REQUISITIONS,
  STOCK,
  STORES,
  SUPPLIERS,
  type Batch,
  type ItemCategory,
  type PoStatus,
  type PurchaseOrder,
  type Requisition,
  type RequisitionStatus,
  type StockItem,
} from '../../data/ext/inventory.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  BarChart,
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Dialog,
  EmptyState,
  Grid,
  IconButton,
  KeyValueList,
  Meter,
  Money,
  PageHeader,
  SearchField,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  Toolbar,
  useToast,
  type Column,
} from '../../ui/index.ts';
import './inventory.css';
import { messages } from './messages.ts';

const REQ_TONE: Readonly<Record<RequisitionStatus, Tone>> = { submitted: 'warning', approved: 'info', picking: 'accent', issued: 'success', rejected: 'neutral' };
const REQ_KEY = { submitted: 'rqSubmitted', approved: 'rqApproved', picking: 'rqPicking', issued: 'rqIssued', rejected: 'rqRejected' } as const satisfies Record<RequisitionStatus, string>;
const PO_TONE: Readonly<Record<PoStatus, Tone>> = { draft: 'neutral', 'awaiting-approval': 'warning', sent: 'info', 'partially-received': 'accent', received: 'success' };
const PO_KEY = { draft: 'poDraft', 'awaiting-approval': 'poAwaiting', sent: 'poSent', 'partially-received': 'poPartial', received: 'poReceived' } as const satisfies Record<PoStatus, string>;
const DAY_MS = 86_400_000;

function daysTo(date: string | null): number | null {
  return date === null ? null : Math.round((Date.parse(`${date}T12:00:00+03:00`) - Date.parse(`${DEMO_TODAY}T12:00:00+03:00`)) / DAY_MS);
}
function onHand(item: StockItem): number {
  return item.batches.reduce((sum, b) => sum + b.qty, 0);
}
/** Batches in first-expiry first-out order (no expiry last). */
function fefo(batches: readonly Batch[]): readonly Batch[] {
  return batches.filter((b) => b.qty > 0).toSorted((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
}
function poTotal(po: PurchaseOrder): number {
  return po.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export function InventoryScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();

  const [stock, setStock] = useState<readonly StockItem[]>(STOCK);
  const [reqs, setReqs] = useState<readonly Requisition[]>(REQUISITIONS);
  const [pos, setPos] = useState<readonly PurchaseOrder[]>(PURCHASE_ORDERS);
  const [tab, setTab] = useState('stock');
  const [store, setStore] = useState('all');
  const [category, setCategory] = useState<'all' | ItemCategory>('all');
  const [lowOnly, setLowOnly] = useState<'all' | 'low' | 'expiring'>('all');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [poDialog, setPoDialog] = useState(false);
  const [poSupplier, setPoSupplier] = useState('SUPL-01');
  const [poItem, setPoItem] = useState('SUP-0102');
  const [poQty, setPoQty] = useState('');

  const storeName = (id: string): string => {
    const s = STORES.find((candidate) => candidate.id === id);
    return s === undefined ? id : f.text(s.name);
  };
  const itemOf = (code: string): StockItem | undefined => stock.find((i) => i.code === code);

  const low = stock.filter((i) => onHand(i) < i.reorderLevel);
  const expiringBatches = stock.flatMap((i) => i.batches.filter((b) => b.qty > 0 && b.expiresOn !== null && (daysTo(b.expiresOn) ?? 999) <= 90).map((b) => ({ item: i, batch: b })));
  const expiringValue = expiringBatches.reduce((sum, e) => sum + e.batch.qty * e.item.unitCostIqd, 0);
  const openReqs = reqs.filter((r) => r.status === 'submitted' || r.status === 'approved' || r.status === 'picking');
  const poAwaiting = pos.filter((p) => p.status === 'awaiting-approval');
  const leakIqd = LEAKAGE.reduce((sum, r) => sum + (r.consumedIqd - r.chargedIqd), 0);
  const leakShare = leakIqd / LEAKAGE.reduce((sum, r) => sum + r.consumedIqd, 0);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return stock
      .filter((i) => store === 'all' || i.storeId === store)
      .filter((i) => category === 'all' || i.category === category)
      .filter((i) => {
        if (lowOnly === 'low') {
          return onHand(i) < i.reorderLevel;
        }
        if (lowOnly === 'expiring') {
          return i.batches.some((b) => b.qty > 0 && (daysTo(b.expiresOn) ?? 999) <= 90);
        }
        return true;
      })
      .filter((i) => needle === '' || i.code.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle));
  }, [stock, store, category, lowOnly, search]);

  const expiryBadge = (date: string | null): ReactNode => {
    const d = daysTo(date);
    if (d === null) {
      return <span className="inv-muted">{t('noExpiry')}</span>;
    }
    if (d < 0) {
      return <Badge tone="danger" size="sm" icon="alert" strong>{t('expired')}</Badge>;
    }
    return <Badge tone={d <= 30 ? 'danger' : d <= 90 ? 'warning' : 'neutral'} size="sm">{f.date(date ?? DEMO_TODAY)}</Badge>;
  };

  // ---------------------------------------------------------------------------------------------------------
  // Stock
  // ---------------------------------------------------------------------------------------------------------

  const columns: readonly Column<StockItem>[] = [
    {
      id: 'item',
      header: t('colItem'),
      cell: (i) => (
        <span className="inv-two">
          <Code className="inv-strong">{i.name}</Code>
          <span className="inv-muted">
            <Code>{i.code}</Code> · {f.text(CATEGORY_LABEL[i.category])} · <Code>{i.unit}</Code>
          </span>
        </span>
      ),
    },
    { id: 'store', header: t('colStore'), cell: (i) => storeName(i.storeId) },
    {
      id: 'onhand',
      header: t('colOnHand'),
      align: 'end',
      cell: (i) => {
        const n = onHand(i);
        return (
          <span className="inv-two inv-end">
            <span className={n < i.reorderLevel ? 'inv-strong inv-danger' : 'inv-strong'}>{f.number(n)}</span>
            <span className="inv-muted">{t('reorderAt', { n: f.number(i.reorderLevel) })}</span>
          </span>
        );
      },
    },
    {
      id: 'next',
      header: t('colNextExpiry'),
      cell: (i) => {
        const first = fefo(i.batches)[0];
        return first === undefined ? <span className="inv-muted">—</span> : <span className="inv-two">{expiryBadge(first.expiresOn)}<span className="inv-muted"><Code>{first.batch}</Code></span></span>;
      },
    },
    { id: 'value', header: t('colValue'), align: 'end', nowrap: true, cell: (i) => <Money amount={onHand(i) * i.unitCostIqd} /> },
    {
      id: 'flags',
      header: t('colFlags'),
      cell: (i) => (
        <span className="inv-badges">
          {onHand(i) < i.reorderLevel ? <Badge tone="danger" size="sm">{t('belowReorder')}</Badge> : null}
          {i.chargeable ? <Badge tone="info" size="sm">{t('chargeable')}</Badge> : null}
        </span>
      ),
    },
  ];

  const selected = stock.find((i) => i.code === selectedCode) ?? null;
  const writeOff = (item: StockItem, batch: Batch): void => {
    setStock((current) => current.map((i) => (i.code === item.code ? { ...i, batches: i.batches.map((b) => (b.batch === batch.batch ? { ...b, qty: 0 } : b)) } : i)));
    toast({ tone: 'warning', title: t('toastWrittenOff', { batch: batch.batch, qty: batch.qty }), body: t('toastWrittenOffBody') });
  };

  const detail = (item: StockItem): ReactNode => {
    const order = fefo(item.batches);
    const n = onHand(item);
    return (
      <Card
        title={<Code>{item.name}</Code>}
        subtitle={<Code>{item.code}</Code>}
        icon="building"
        tone={n < item.reorderLevel ? 'warning' : undefined}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedCode(null); }} />}
      >
        <div className="inv-stack">
          <KeyValueList
            columns={2}
            items={[
              { id: 'store', label: t('colStore'), value: storeName(item.storeId) },
              { id: 'cat', label: t('category'), value: f.text(CATEGORY_LABEL[item.category]) },
              { id: 'unit', label: t('unit'), value: <Code>{item.unit}</Code> },
              { id: 'cost', label: t('unitCost'), value: <Money amount={item.unitCostIqd} /> },
              { id: 'onhand', label: t('colOnHand'), value: f.number(n) },
              { id: 'reorder', label: t('reorderLevel'), value: f.number(item.reorderLevel) },
            ]}
          />
          <Meter label={t('stockMeter')} value={n / Math.max(1, item.reorderLevel * 2)} valueLabel={t('ofReorder', { n: f.number(n), level: f.number(item.reorderLevel) })} tone={n < item.reorderLevel ? 'danger' : n < item.reorderLevel * 1.3 ? 'warning' : 'success'} />
          <div>
            <p className="inv-label">{t('fefoTitle')}</p>
            <ol className="inv-batches">
              {order.map((batch, index) => {
                const d = daysTo(batch.expiresOn);
                return (
                  <li key={batch.batch} className={`inv-batch${index === 0 ? ' inv-batch--next' : ''}`}>
                    <span className="inv-two">
                      <span className="inv-row">
                        <Code className="inv-strong">{batch.batch}</Code>
                        {index === 0 ? <Badge tone="accent" size="sm">{t('pickNext')}</Badge> : null}
                      </span>
                      <span className="inv-row">{expiryBadge(batch.expiresOn)}</span>
                    </span>
                    <span className="inv-row">
                      <span className="inv-strong">{f.number(batch.qty)}</span>
                      {d !== null && d < 0 ? (
                        <Button size="sm" variant="danger" icon="x" onPress={() => { writeOff(item, batch); }}>
                          {t('actWriteOff')}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="inv-actions">
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setPoItem(item.code);
                setPoQty(String(Math.max(item.reorderLevel * 2 - n, item.reorderLevel)));
                setPoDialog(true);
              }}
            >
              {t('actRaisePo')}
            </Button>
            <Button icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastBinCard', { code: item.code }) }); }}>
              {t('actBinCard')}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const storeCards = (
    <Grid min="13rem">
      {STORES.map((s) => {
        const items = stock.filter((i) => i.storeId === s.id);
        const value = items.reduce((sum, i) => sum + onHand(i) * i.unitCostIqd, 0);
        const lowHere = items.filter((i) => onHand(i) < i.reorderLevel).length;
        return (
          <StatTile
            key={s.id}
            label={f.text(s.name)}
            value={<Money amount={value} />}
            icon="building"
            {...(lowHere > 0 ? { tone: 'warning' as const } : {})}
            hint={s.parentId === null ? t('mainStoreHint', { count: items.length }) : t('subStoreHint', { count: items.length, low: lowHere })}
            onPress={() => { setStore(s.id); }}
            className={store === s.id ? 'inv-store--active' : undefined}
          />
        );
      })}
    </Grid>
  );

  const stockTab = (
    <div className="inv-stack">
      {storeCards}
      <div className={selected === null ? undefined : 'inv-split'}>
        <Card flush>
          <div className="inv-toolbar">
            <Toolbar label={t('filters')}>
              <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
              <SelectField label={t('colStore')} hideLabel selectedKey={store} onSelectionChange={setStore} options={[{ id: 'all', label: t('allStores') }, ...STORES.map((s) => ({ id: s.id, label: f.text(s.name) }))]} />
              <SelectField
                label={t('category')}
                hideLabel
                selectedKey={category}
                onSelectionChange={(id) => { setCategory(id as 'all' | ItemCategory); }}
                options={[{ id: 'all', label: t('allCategories') }, ...(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((c) => ({ id: c, label: f.text(CATEGORY_LABEL[c]) }))]}
              />
              <SelectField
                label={t('show')}
                hideLabel
                selectedKey={lowOnly}
                onSelectionChange={(id) => { setLowOnly(id as 'all' | 'low' | 'expiring'); }}
                options={[
                  { id: 'all', label: t('showAll') },
                  { id: 'low', label: t('showLow') },
                  { id: 'expiring', label: t('showExpiring') },
                ]}
              />
            </Toolbar>
            <span className="inv-muted">{t('itemsShown', { count: rows.length })}</span>
          </div>
          <DataTable
            caption={t('stockTitle')}
            dense
            columns={columns}
            rows={rows}
            rowKey={(i) => i.code}
            selectedKey={selectedCode}
            onRowAction={(i) => { setSelectedCode(i.code); }}
            rowTone={(i) => (i.batches.some((b) => b.qty > 0 && (daysTo(b.expiresOn) ?? 1) < 0) ? 'danger' : onHand(i) < i.reorderLevel ? 'warning' : undefined)}
            emptyText={<EmptyState compact icon="building" title={t('stockEmpty')} />}
          />
        </Card>
        {selected === null ? null : detail(selected)}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Requisitions
  // ---------------------------------------------------------------------------------------------------------

  const setReq = (id: string, status: RequisitionStatus): void => {
    setReqs((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  /** Issues a requisition from the main store, taking each line first-expiry first-out. */
  const issue = (req: Requisition): void => {
    setStock((current) =>
      current.map((i) => {
        const line = req.lines.find((l) => l.code === i.code);
        if (line === undefined) {
          return i;
        }
        let need = line.qty;
        const order = fefo(i.batches).map((b) => b.batch);
        const batches = i.batches.map((b) => ({ ...b }));
        for (const name of order) {
          const b = batches.find((x) => x.batch === name);
          if (b === undefined || need <= 0 || (daysTo(b.expiresOn) ?? 1) < 0) {
            continue;
          }
          const take = Math.min(b.qty, need);
          b.qty -= take;
          need -= take;
        }
        return { ...i, batches };
      }),
    );
    setReq(req.id, 'issued');
    toast({ tone: 'success', title: t('toastIssued', { id: req.id }), body: t('toastIssuedBody') });
  };

  const selectedR = reqs.find((r) => r.id === selectedReq) ?? null;
  const reqDetail = (r: Requisition): ReactNode => {
    const by = findStaff(r.requestedById);
    return (
      <Card
        title={<Code>{r.id}</Code>}
        subtitle={storeName(r.fromStoreId)}
        icon="clipboard"
        tone={r.urgent && r.status === 'submitted' ? 'warning' : undefined}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedReq(null); }} />}
      >
        <div className="inv-stack">
          <KeyValueList
            columns={2}
            items={[
              { id: 'status', label: t('colStatus'), value: <Badge tone={REQ_TONE[r.status]} size="sm">{t(REQ_KEY[r.status])}</Badge> },
              { id: 'by', label: t('requestedBy'), value: by === undefined ? '—' : <StaffName member={by} /> },
              { id: 'when', label: t('requested'), value: f.dateTime(r.requestedIso) },
              { id: 'urgent', label: t('urgency'), value: r.urgent ? <Badge tone="danger" size="sm">{t('urgent')}</Badge> : t('routine') },
            ]}
          />
          <DataTable
            caption={t('reqLines')}
            showCaption
            dense
            rows={r.lines}
            rowKey={(l) => l.code}
            rowTone={(l) => {
              const i = itemOf(l.code);
              return i === undefined || onHand(i) < l.qty ? 'danger' : undefined;
            }}
            columns={[
              { id: 'item', header: t('colItem'), cell: (l) => <span className="inv-two"><Code>{itemOf(l.code)?.name ?? l.code}</Code><span className="inv-muted"><Code>{l.code}</Code></span></span> },
              { id: 'qty', header: t('colQty'), align: 'end', cell: (l) => f.number(l.qty) },
              {
                id: 'avail',
                header: t('colAvailable'),
                align: 'end',
                cell: (l) => {
                  const i = itemOf(l.code);
                  const n = i === undefined ? 0 : onHand(i);
                  return n < l.qty ? <Badge tone="danger" size="sm">{f.number(n)}</Badge> : f.number(n);
                },
              },
              {
                id: 'batch',
                header: t('colPickFrom'),
                cell: (l) => {
                  const i = itemOf(l.code);
                  const first = i === undefined ? undefined : fefo(i.batches).find((b) => (daysTo(b.expiresOn) ?? 1) >= 0);
                  return first === undefined ? '—' : <Code>{first.batch}</Code>;
                },
              },
            ]}
          />
          <div className="inv-actions">
            {r.status === 'submitted' ? (
              <>
                <Button variant="primary" icon="check" onPress={() => { setReq(r.id, 'approved'); toast({ tone: 'success', title: t('toastApproved', { id: r.id }) }); }}>
                  {t('actApprove')}
                </Button>
                <Button variant="danger" icon="x" onPress={() => { setReq(r.id, 'rejected'); toast({ tone: 'warning', title: t('toastRejected', { id: r.id }) }); }}>
                  {t('actReject')}
                </Button>
              </>
            ) : null}
            {r.status === 'approved' ? (
              <Button variant="primary" icon="printer" onPress={() => { setReq(r.id, 'picking'); toast({ tone: 'info', title: t('toastPickList', { id: r.id }) }); }}>
                {t('actPick')}
              </Button>
            ) : null}
            {r.status === 'picking' ? (
              <Button variant="primary" icon="check" onPress={() => { issue(r); }}>
                {t('actIssue')}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  const reqTab = (
    <div className={selectedR === null ? undefined : 'inv-split'}>
      <Card title={t('reqTitle')} subtitle={t('reqSubtitle', { count: openReqs.length })} icon="clipboard" flush>
        <DataTable
          caption={t('reqTitle')}
          rows={reqs.toSorted((a, b) => Number(b.urgent) - Number(a.urgent) || b.requestedIso.localeCompare(a.requestedIso))}
          rowKey={(r) => r.id}
          selectedKey={selectedReq}
          onRowAction={(r) => { setSelectedReq(r.id); }}
          rowTone={(r) => (r.urgent && r.status === 'submitted' ? 'warning' : undefined)}
          columns={[
            { id: 'id', header: t('colRequisition'), nowrap: true, cell: (r) => <span className="inv-two"><Code>{r.id}</Code><span className="inv-muted">{f.relative(r.requestedIso)}</span></span> },
            { id: 'from', header: t('colFrom'), cell: (r) => storeName(r.fromStoreId) },
            { id: 'lines', header: t('colLines'), cell: (r) => t('lines', { count: r.lines.length }) },
            { id: 'by', header: t('requestedBy'), cell: (r) => { const m = findStaff(r.requestedById); return m === undefined ? '—' : <StaffName member={m} />; } },
            {
              id: 'status',
              header: t('colStatus'),
              cell: (r) => (
                <span className="inv-badges">
                  <Badge tone={REQ_TONE[r.status]} size="sm">{t(REQ_KEY[r.status])}</Badge>
                  {r.urgent ? <Badge tone="danger" size="sm">{t('urgent')}</Badge> : null}
                </span>
              ),
            },
          ]}
        />
      </Card>
      {selectedR === null ? null : reqDetail(selectedR)}
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Purchase orders
  // ---------------------------------------------------------------------------------------------------------

  const setPo = (id: string, status: PoStatus): void => {
    setPos((current) => current.map((p) => (p.id === id ? { ...p, status } : p)));
  };
  const poNext = (p: PurchaseOrder): { readonly label: string; readonly run: () => void } | null => {
    switch (p.status) {
      case 'draft':
        return { label: t('actSubmitPo'), run: () => { setPo(p.id, 'awaiting-approval'); toast({ tone: 'info', title: t('toastPoSubmitted', { id: p.id }) }); } };
      case 'awaiting-approval':
        return { label: t('actApproveSend'), run: () => { setPo(p.id, 'sent'); toast({ tone: 'success', title: t('toastPoSent', { id: p.id }) }); } };
      case 'sent':
      case 'partially-received':
        return { label: t('actReceive'), run: () => { setPo(p.id, 'received'); toast({ tone: 'success', title: t('toastPoReceived', { id: p.id }), body: t('toastPoReceivedBody') }); } };
      case 'received':
        return null;
    }
  };

  const poTab = (
    <Card
      title={t('poTitle')}
      subtitle={t('poSubtitle', { rate: f.number(EXCHANGE_RATE.usdToIqd) })}
      icon="receipt"
      flush
      actions={
        <Button size="sm" variant="primary" icon="plus" onPress={() => { setPoQty(''); setPoDialog(true); }}>
          {t('actNewPo')}
        </Button>
      }
    >
      <DataTable
        caption={t('poTitle')}
        rows={pos.toSorted((a, b) => b.createdIso.localeCompare(a.createdIso))}
        rowKey={(p) => p.id}
        rowTone={(p) => (p.status === 'awaiting-approval' ? 'warning' : undefined)}
        columns={[
          { id: 'id', header: t('colPo'), nowrap: true, cell: (p) => <span className="inv-two"><Code>{p.id}</Code><span className="inv-muted">{f.date(p.createdIso)}</span></span> },
          {
            id: 'supplier',
            header: t('colSupplier'),
            cell: (p) => {
              const s = SUPPLIERS.find((x) => x.id === p.supplierId);
              return s === undefined ? p.supplierId : <span className="inv-two"><Code>{s.name}</Code><span className="inv-muted">{f.text(s.city)}</span></span>;
            },
          },
          { id: 'lines', header: t('colLines'), cell: (p) => <span className="inv-two">{p.lines.map((l) => <span key={l.code} className="inv-muted"><Code>{itemOf(l.code)?.name ?? l.code}</Code> × {f.number(l.qty)}</span>)}</span> },
          {
            id: 'total',
            header: t('colTotal'),
            align: 'end',
            nowrap: true,
            cell: (p) => (
              <span className="inv-two inv-end">
                <Money amount={poTotal(p)} currency={p.currency} className="inv-strong" />
                <span className="inv-muted">{p.currency === 'USD' ? <Money amount={usdToIqd(poTotal(p))} /> : <Money amount={iqdToUsd(poTotal(p))} currency="USD" />}</span>
              </span>
            ),
          },
          { id: 'expected', header: t('colExpected'), nowrap: true, cell: (p) => f.date(p.expectedOn) },
          { id: 'status', header: t('colStatus'), cell: (p) => <Badge tone={PO_TONE[p.status]} size="sm">{t(PO_KEY[p.status])}</Badge> },
          {
            id: 'act',
            header: t('colAction'),
            align: 'end',
            cell: (p) => {
              const next = poNext(p);
              return next === null ? null : <Button size="sm" variant={p.status === 'awaiting-approval' ? 'primary' : 'secondary'} onPress={next.run}>{next.label}</Button>;
            },
          },
        ]}
      />
    </Card>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Leakage
  // ---------------------------------------------------------------------------------------------------------

  const leakageTab = (
    <div className="inv-split inv-split--even">
      <Card title={t('leakTitle')} subtitle={t('leakSubtitle')} icon="chart" flush>
        <DataTable
          caption={t('leakTitle')}
          rows={LEAKAGE.toSorted((a, b) => (b.consumedIqd - b.chargedIqd) - (a.consumedIqd - a.chargedIqd))}
          rowKey={(r) => r.storeId}
          rowTone={(r) => ((r.consumedIqd - r.chargedIqd) / r.consumedIqd > 0.1 ? 'danger' : undefined)}
          columns={[
            { id: 'store', header: t('colStore'), cell: (r) => storeName(r.storeId) },
            { id: 'used', header: t('colConsumed'), align: 'end', nowrap: true, cell: (r) => <Money amount={r.consumedIqd} /> },
            { id: 'charged', header: t('colCharged'), align: 'end', nowrap: true, cell: (r) => <Money amount={r.chargedIqd} /> },
            {
              id: 'gap',
              header: t('colGap'),
              align: 'end',
              nowrap: true,
              cell: (r) => (
                <span className="inv-two inv-end">
                  <Money amount={r.consumedIqd - r.chargedIqd} className="inv-strong inv-danger" />
                  <span className="inv-muted">{f.percent((r.consumedIqd - r.chargedIqd) / r.consumedIqd)}</span>
                </span>
              ),
            },
            {
              id: 'top',
              header: t('colTopUnbilled'),
              cell: (r) => (
                <span className="inv-two">
                  {r.topItems.map((x) => (
                    <span key={x.code} className="inv-muted">
                      <Code>{itemOf(x.code)?.name ?? x.code}</Code> × {f.number(x.unbilledQty)}
                    </span>
                  ))}
                </span>
              ),
            },
          ]}
        />
      </Card>
      <div className="inv-stack">
        <Card title={t('leakChartTitle')} subtitle={t('leakChartSubtitle')} icon="chart">
          <BarChart
            label={t('leakChartTitle')}
            max={1}
            data={LEAKAGE.map((r) => {
              const share = r.chargedIqd / r.consumedIqd;
              return { id: r.storeId, label: storeName(r.storeId), value: share, valueLabel: f.percent(share), ...(share < 0.9 ? { tone: 'warning' as const } : {}) };
            })}
          />
        </Card>
        <Callout
          tone="warning"
          title={t('leakCalloutTitle', { amount: f.iqd(leakIqd) })}
          actions={
            <Button size="sm" icon="printer" onPress={() => { toast({ tone: 'success', title: t('toastAudit') }); }}>
              {t('actAudit')}
            </Button>
          }
        >
          {t('leakCalloutBody')}
        </Callout>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // New PO dialog
  // ---------------------------------------------------------------------------------------------------------

  const poSupplierObj = SUPPLIERS.find((s) => s.id === poSupplier);
  const poItemObj = itemOf(poItem);
  const qty = Number(poQty);
  const qtyOk = Number.isInteger(qty) && qty > 0;
  const estIqd = poItemObj === undefined || !qtyOk ? 0 : poItemObj.unitCostIqd * qty;
  const newPoDialog = poDialog ? (
    <Dialog
      isOpen
      onOpenChange={setPoDialog}
      title={t('newPoTitle')}
      subtitle={t('newPoSubtitle')}
      actions={
        <>
          <Button onPress={() => { setPoDialog(false); }}>{t('cancel')}</Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!qtyOk || poItemObj === undefined || poSupplierObj === undefined}
            onPress={() => {
              if (poItemObj === undefined || poSupplierObj === undefined) {
                return;
              }
              const id = `PO-26-${String(920 + pos.length - 6).padStart(4, '0')}`;
              const unitPrice = poSupplierObj.currency === 'USD' ? iqdToUsd(poItemObj.unitCostIqd) : poItemObj.unitCostIqd;
              setPos((current) => [
                { id, supplierId: poSupplierObj.id, createdIso: DEMO_NOW_ISO, expectedOn: DEMO_TODAY, status: 'awaiting-approval', currency: poSupplierObj.currency, createdBy: 'SYN-STF-004', lines: [{ code: poItemObj.code, qty, unitPrice }] },
                ...current,
              ]);
              toast({ tone: 'success', title: t('toastPoCreated', { id }) });
              setPoDialog(false);
              setTab('po');
            }}
          >
            {t('actCreatePo')}
          </Button>
        </>
      }
    >
      <div className="inv-stack">
        <SelectField label={t('colSupplier')} selectedKey={poSupplier} onSelectionChange={setPoSupplier} options={SUPPLIERS.map((s) => ({ id: s.id, label: `${s.name} · ${f.text(s.city)} · ${s.currency}` }))} />
        <SelectField label={t('colItem')} selectedKey={poItem} onSelectionChange={setPoItem} options={stock.map((i) => ({ id: i.code, label: `${i.code} · ${i.name}` }))} />
        <TextInput label={t('colQty')} value={poQty} onChange={setPoQty} inputMode="numeric" dir="ltr" isRequired {...(poItemObj === undefined ? {} : { description: t('qtyHint', { onhand: f.number(onHand(poItemObj)), level: f.number(poItemObj.reorderLevel), unit: poItemObj.unit }) })} />
        {qtyOk ? (
          <KeyValueList
            columns={2}
            items={[
              { id: 'iqd', label: t('estimate'), value: <Money amount={estIqd} /> },
              { id: 'usd', label: t('estimateUsd'), value: <Money amount={iqdToUsd(estIqd)} currency="USD" /> },
            ]}
          />
        ) : null}
        {estIqd > 10_000_000 ? <Callout tone="info">{t('approvalNote')}</Callout> : null}
      </div>
    </Dialog>
  ) : null;

  return (
    <div className="inv-screen">
      <PageHeader
        icon="building"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <>
            <Button icon="clipboard" onPress={() => { setTab('requisitions'); }}>
              {t('actRequisitions')}
            </Button>
            <Button variant="primary" icon="plus" onPress={() => { setPoQty(''); setPoDialog(true); }}>
              {t('actNewPo')}
            </Button>
          </>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiLow')} value={f.number(low.length)} icon="alert" tone={low.length > 0 ? 'warning' : 'success'} hint={t('kpiLowHint')} onPress={() => { setTab('stock'); setLowOnly('low'); setStore('all'); }} />
        <StatTile label={t('kpiExpiring')} value={<Money amount={expiringValue} />} icon="clock" tone={expiringValue > 0 ? 'warning' : 'success'} hint={t('kpiExpiringHint', { count: expiringBatches.length })} onPress={() => { setTab('stock'); setLowOnly('expiring'); setStore('all'); }} />
        <StatTile label={t('kpiReqs')} value={f.number(openReqs.length)} icon="clipboard" hint={t('kpiReqsHint', { count: openReqs.filter((r) => r.urgent).length })} onPress={() => { setTab('requisitions'); }} />
        <StatTile label={t('kpiPo')} value={f.number(poAwaiting.length)} icon="receipt" tone={poAwaiting.length > 0 ? 'warning' : undefined} hint={t('kpiPoHint')} onPress={() => { setTab('po'); }} />
        <StatTile label={t('kpiLeak')} value={<Money amount={leakIqd} />} icon="money" tone="danger" hint={t('kpiLeakHint', { pct: f.percent(leakShare) })} onPress={() => { setTab('leakage'); }} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'stock', label: t('tabStock'), content: stockTab },
          { id: 'requisitions', label: t('tabReqs'), badge: f.number(openReqs.length), content: reqTab },
          { id: 'po', label: t('tabPo'), ...(poAwaiting.length > 0 ? { badge: f.number(poAwaiting.length) } : {}), content: poTab },
          { id: 'leakage', label: t('tabLeak'), content: leakageTab },
        ]}
      />
      {newPoDialog}
    </div>
  );
}
