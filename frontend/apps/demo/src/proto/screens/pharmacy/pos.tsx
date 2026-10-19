/**
 * The outpatient retail counter: products, a cart, payment in IQD or USD at the demo exchange rate, the
 * change due, and a printed receipt. Sales stay in this screen's state.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, EXCHANGE_RATE, iqdToUsd } from '../../data/index.ts';
import { RETAIL_PRODUCTS, type RetailProduct } from '../../data/ext/pharmacy.ts';
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
  EmptyState,
  IconButton,
  Money,
  SearchField,
  Segmented,
  TextInput,
  useToast,
} from '../../ui/index.ts';
import { messages } from './messages.ts';

interface CartLine {
  readonly product: RetailProduct;
  readonly qty: number;
}

interface Receipt {
  readonly number: string;
  readonly lines: readonly CartLine[];
  readonly totalIqd: number;
  readonly currency: 'IQD' | 'USD';
  readonly tendered: number;
  readonly change: number;
}

export function RetailCounter({ onSale }: { readonly onSale: (iqd: number, currency: 'IQD' | 'USD', amount: number) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<readonly CartLine[]>([]);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [tendered, setTendered] = useState('');
  const [rxChecked, setRxChecked] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [seq, setSeq] = useState(38);

  const needle = search.trim().toLowerCase();
  const products = RETAIL_PRODUCTS.filter((p) => needle === '' || p.brand.toLowerCase().includes(needle) || p.generic.toLowerCase().includes(needle));

  const add = (product: RetailProduct): void => {
    setCart((current) => {
      const line = current.find((l) => l.product.id === product.id);
      return line === undefined ? [...current, { product, qty: 1 }] : current.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l));
    });
  };
  const change = (id: string, delta: number): void => {
    setCart((current) => current.map((l) => (l.product.id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));
  };

  const totalIqd = cart.reduce((sum, l) => sum + l.product.priceIqd * l.qty, 0);
  const totalUsd = iqdToUsd(totalIqd);
  const due = currency === 'IQD' ? totalIqd : totalUsd;
  const paid = Number(tendered.replace(/,/g, ''));
  const valid = Number.isFinite(paid) && paid >= due && cart.length > 0;
  const needsRx = cart.some((l) => l.product.rxOnly);
  const changeDue = valid ? Math.round((paid - due) * 100) / 100 : 0;

  return (
    <div className="ph-split ph-split--pos">
      <Card title={t('posProducts')} subtitle={t('posProductsSub')} icon="pill" flush>
        <div className="ph-toolbar">
          <SearchField label={t('search')} hideLabel placeholder={t('posSearch')} value={search} onChange={setSearch} />
        </div>
        <DataTable
          caption={t('posProducts')}
          dense
          rows={products}
          rowKey={(p) => p.id}
          onRowAction={add}
          columns={[
            {
              id: 'brand',
              header: t('colProduct'),
              cell: (p) => (
                <span className="ph-two">
                  <span className="ph-row">
                    <Code className="ph-strong">{p.brand}</Code>
                    {p.rxOnly ? <Badge size="sm" tone="info">{t('rxOnly')}</Badge> : null}
                  </span>
                  <span className="ph-muted">
                    <Code>{p.generic}</Code> · <Code>{p.pack}</Code>
                  </span>
                </span>
              ),
            },
            {
              id: 'stock',
              header: t('colStock'),
              align: 'end',
              cell: (p) => (p.stock < 15 ? <Badge size="sm" tone="warning">{f.number(p.stock)}</Badge> : f.number(p.stock)),
            },
            { id: 'price', header: t('colPrice'), align: 'end', nowrap: true, cell: (p) => <Money amount={p.priceIqd} /> },
            { id: 'add', header: t('colAdd'), align: 'end', cell: (p) => <IconButton icon="plus" label={t('addToCart', { name: p.brand })} onPress={() => { add(p); }} /> },
          ]}
        />
      </Card>
      <Card title={t('posCart')} icon="receipt" subtitle={f.text(EXCHANGE_RATE.note)}>
        {cart.length === 0 ? (
          <EmptyState compact icon="receipt" title={t('cartEmpty')} body={t('cartEmptyBody')} />
        ) : (
          <div className="ph-stack">
            <ul className="ph-cart">
              {cart.map((line) => (
                <li key={line.product.id} className="ph-cart__line">
                  <span className="ph-two">
                    <Code className="ph-strong">{line.product.brand}</Code>
                    <span className="ph-muted">
                      <Money amount={line.product.priceIqd} /> × {f.number(line.qty)}
                    </span>
                  </span>
                  <span className="ph-row">
                    <IconButton icon="minus" size="sm" label={t('qtyLess')} onPress={() => { change(line.product.id, -1); }} />
                    <span className="ph-qty">{f.number(line.qty)}</span>
                    <IconButton icon="plus" size="sm" label={t('qtyMore')} onPress={() => { change(line.product.id, 1); }} />
                    <Money amount={line.product.priceIqd * line.qty} className="ph-strong ph-line-total" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="ph-totals">
              <span>{t('total')}</span>
              <span className="ph-two ph-end">
                <Money amount={totalIqd} className="ph-big" />
                <Money amount={totalUsd} currency="USD" className="ph-muted" />
              </span>
            </div>
            {needsRx ? (
              <Callout tone="info" title={t('rxNeededTitle')}>
                <Checkbox isSelected={rxChecked} onChange={setRxChecked}>
                  {t('rxChecked')}
                </Checkbox>
              </Callout>
            ) : null}
            <Segmented
              label={t('payIn')}
              value={currency}
              onChange={(id) => { setCurrency(id === 'USD' ? 'USD' : 'IQD'); setTendered(''); }}
              options={[
                { id: 'IQD', label: t('curIqd') },
                { id: 'USD', label: t('curUsd') },
              ]}
            />
            <TextInput
              label={t('tendered', { currency: currency === 'IQD' ? t('curIqd') : t('curUsd') })}
              value={tendered}
              onChange={setTendered}
              inputMode="decimal"
              dir="ltr"
              description={t('dueIs', { amount: f.money(due, currency) })}
            />
            <div className="ph-totals">
              <span>{t('changeDue')}</span>
              <Money amount={changeDue} currency={currency} className="ph-big" />
            </div>
            <div className="ph-actions">
              <Button onPress={() => { setCart([]); setTendered(''); setRxChecked(false); }}>{t('clearCart')}</Button>
              <Button
                variant="primary"
                icon="check"
                isDisabled={!valid || (needsRx && !rxChecked)}
                onPress={() => {
                  const number = `SYN-RCT-PH-${String(seq).padStart(5, '0')}`;
                  setReceipt({ number, lines: cart, totalIqd, currency, tendered: paid, change: changeDue });
                  onSale(totalIqd, currency, due);
                  setSeq((n) => n + 1);
                  setCart([]);
                  setTendered('');
                  setRxChecked(false);
                }}
              >
                {t('completeSale')}
              </Button>
            </div>
          </div>
        )}
      </Card>
      {receipt === null ? null : (
        <Dialog
          isOpen
          onOpenChange={(open) => { if (!open) { setReceipt(null); } }}
          title={t('receiptTitle')}
          subtitle={<Code>{receipt.number}</Code>}
          actions={
            <>
              <Button onPress={() => { setReceipt(null); }}>{t('close')}</Button>
              <Button variant="primary" icon="printer" onPress={() => { toast({ tone: 'success', title: t('toastReceiptPrinted', { number: receipt.number }) }); setReceipt(null); }}>
                {t('printReceipt')}
              </Button>
            </>
          }
        >
          <div className="ph-receipt">
            <p className="ph-receipt__head">{t('receiptHospital')}</p>
            <p className="ph-muted">{f.dateTime(DEMO_NOW_ISO)}</p>
            <ul className="ph-cart">
              {receipt.lines.map((line) => (
                <li key={line.product.id} className="ph-cart__line">
                  <span>
                    <Code>{line.product.brand}</Code> × {f.number(line.qty)}
                  </span>
                  <Money amount={line.product.priceIqd * line.qty} />
                </li>
              ))}
            </ul>
            <div className="ph-totals">
              <span>{t('total')}</span>
              <span className="ph-two ph-end">
                <Money amount={receipt.totalIqd} className="ph-strong" />
                <Money amount={iqdToUsd(receipt.totalIqd)} currency="USD" className="ph-muted" />
              </span>
            </div>
            <div className="ph-totals">
              <span>{t('paidIn', { currency: receipt.currency === 'IQD' ? t('curIqd') : t('curUsd') })}</span>
              <Money amount={receipt.tendered} currency={receipt.currency} />
            </div>
            <div className="ph-totals">
              <span>{t('changeDue')}</span>
              <Money amount={receipt.change} currency={receipt.currency} />
            </div>
            <p className="ph-muted">{t('rateUsed', { rate: f.number(EXCHANGE_RATE.usdToIqd) })}</p>
            <p className="ph-muted">{t('receiptFooter')}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
