/**
 * The orders screen (computerised order entry; patient-scoped: rendered under the PatientBanner by the
 * clinical layout).
 *
 * - Current orders in tabs (active, on hold, completed and discontinued), with Hold, Resume, Discontinue and
 *   Sign for prescribers. The allergy-conflict draft (SYN-ORD-0102) cannot be signed.
 * - Order entry: medicines from a synthetic formulary (dose field that refuses a number without a unit,
 *   route, frequency, duration, indication), laboratory tests, imaging and order sets; a blocking allergy
 *   alert with an override that needs a second prescriber's co-signature.
 * - "Sign orders" first re-verifies the patient (the banner's identity), then opens the design system's
 *   sign dialog. Everything stays in this screen's state; nothing is written back.
 */
import { Message } from '@hms/design-system';
import { useMemo, useState, type ReactNode } from 'react';
import {
  findStaff,
  ordersOf,
  ORDER_CATEGORY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  ROLE_LABEL,
  SEVERITY_LABEL,
  type Order,
  type OrderStatus,
  type Text3,
  type Tone,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useRole, useSign } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  Icon,
  PageHeader,
  Qty,
  StaffName,
  StatTile,
  Tabs,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { IdentityCheckDialog, StatusDialog, type StatusTarget } from './dialogs.tsx';
import { OrderEntry } from './entry.tsx';
import { messages } from './messages.ts';
import { allergyText, draftToOrder, type DraftOrder } from './model.ts';
import { CATEGORY_ICON, DraftReview, OrderMedLine, OrderReview } from './parts.tsx';
import { useDeferredSign } from './use-deferred-sign.ts';
import './orders.css';

type IdentityTarget = { readonly kind: 'basket' } | { readonly kind: 'order'; readonly order: Order };

const TAB_STATUSES: Readonly<Record<string, readonly OrderStatus[]>> = {
  active: ['pending-signature', 'draft', 'active', 'in-progress'],
  held: ['on-hold'],
  stopped: ['completed', 'cancelled'],
  all: ['pending-signature', 'draft', 'active', 'in-progress', 'on-hold', 'completed', 'cancelled'],
};

export function OrdersScreen(): ReactNode {
  const { patient } = useClinicalPatient();
  // A new patient starts with a fresh basket and fresh screen state.
  return <OrdersWorkspace key={patient.id} />;
}

function OrdersWorkspace(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { patient, banner, actionsDisabled } = useClinicalPatient();
  const { roleId, user, setRole } = useRole();
  const sign = useSign();
  const requestSign = useDeferredSign();

  const [statusOverrides, setStatusOverrides] = useState<ReadonlyMap<string, OrderStatus>>(new Map());
  const [signed, setSigned] = useState<readonly Order[]>([]);
  const [basket, setBasket] = useState<readonly DraftOrder[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentityTarget | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [tab, setTab] = useState('active');

  const orders = useMemo(
    () =>
      [...signed, ...ordersOf(patient.id)].map((order) => {
        const status = statusOverrides.get(order.id);
        return status === undefined ? order : { ...order, status };
      }),
    [signed, patient.id, statusOverrides],
  );
  const freshIds = new Set(signed.map((order) => order.id));
  const changedIds = new Set(statusOverrides.keys());

  const isPrescriber = roleId === 'physician';
  const canEnter = (roleId === 'physician' || roleId === 'nurse') && !actionsDisabled;
  const hasConflict = (order: Order): boolean => order.alerts.some((alert) => alert.tone === 'danger');

  const activeCount = orders.filter((order) => order.status === 'active' || order.status === 'in-progress').length;
  const activeMeds = orders.filter((order) => (order.status === 'active' || order.status === 'in-progress') && order.category === 'medication').length;
  const pending = orders.filter((order) => order.status === 'pending-signature');
  const heldCount = orders.filter((order) => order.status === 'on-hold').length;

  const setStatus = (id: string, status: OrderStatus): void => {
    setStatusOverrides((current) => new Map(current).set(id, status));
  };

  const confirmIdentity = (): void => {
    const target = identity;
    setIdentity(null);
    if (target === null) {
      return;
    }
    if (target.kind === 'basket') {
      const toSign = basket;
      const signer = user.id;
      requestSign({
        kind: 'sign',
        review: <DraftReview drafts={toSign} />,
        onSigned: () => {
          setSigned((current) => [...toSign.map((draft) => draftToOrder(draft, patient, signer)), ...current]);
          setBasket((current) => current.filter((draft) => !toSign.includes(draft)));
          setEntryOpen(false);
          setTab('active');
          toast({ tone: 'info', title: t('signedOrdersToast'), body: t('signedOrdersBody') });
        },
      });
    } else {
      const order = target.order;
      requestSign({ kind: 'sign', review: <OrderReview order={order} />, onSigned: () => setStatus(order.id, 'active') });
    }
  };

  // ------------------------------------------------------------------------------------------------ table
  const columns: readonly Column<Order>[] = [
    {
      id: 'order',
      header: t('colOrder'),
      cell: (order) => (
        <div className="orders-item">
          <div className="orders-item__title">
            <Icon name={CATEGORY_ICON[order.category]} size="1.1em" />
            {order.medication === null ? <span>{f.text(order.title)}</span> : <Code className="orders-item__drug">{order.medication.drug}</Code>}
            {freshIds.has(order.id) ? (
              <Badge tone="success" size="sm" icon="check">
                {t('newBadge')}
              </Badge>
            ) : null}
            {order.medication?.highAlert === true ? (
              <Badge tone="warning" size="sm" icon="shield">
                {t('highAlert')}
              </Badge>
            ) : null}
          </div>
          <OrderMedLine order={order} />
          {order.detail === null ? null : <p className="orders-item__detail">{f.text(order.detail)}</p>}
          {order.alerts.length === 0 ? null : (
            <ul className="orders-item__alerts">
              {order.alerts.map((alert) => (
                <li key={alert.text.en} className={`orders-warning orders-warning--${alert.tone}`}>
                  <Icon name="alert" size="1em" />
                  <span>{f.text(alert.text)}</span>
                </li>
              ))}
            </ul>
          )}
          <Code className="orders-item__id">{order.id}</Code>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('colType'),
      width: '9rem',
      cell: (order) => (
        <div className="orders-cell-stack">
          <Badge size="sm" tone="neutral">
            {f.text(ORDER_CATEGORY_LABEL[order.category])}
          </Badge>
          {order.priority === 'routine' ? null : (
            <Badge size="sm" tone={PRIORITY_TONE[order.priority]} strong={order.priority === 'stat'}>
              {f.text(PRIORITY_LABEL[order.priority])}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      width: '9rem',
      cell: (order) => (
        <div className="orders-cell-stack">
          <Badge tone={ORDER_STATUS_TONE[order.status]} {...(order.status === 'on-hold' ? { icon: 'minus' as const } : {})}>
            {f.text(ORDER_STATUS_LABEL[order.status])}
          </Badge>
          {changedIds.has(order.id) ? <span className="orders-muted orders-small">{t('demoOnlyBody')}</span> : null}
        </div>
      ),
    },
    {
      id: 'ordered',
      header: t('colOrdered'),
      width: '11rem',
      cell: (order) => {
        const member = findStaff(order.orderedById);
        return (
          <div className="orders-cell-stack">
            {member === undefined ? null : <StaffName member={member} />}
            <span className="orders-muted orders-small orders-nums">{f.dateTime(order.orderedIso)}</span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: t('colActions'),
      width: '12rem',
      cell: (order) => {
        if (!isPrescriber || actionsDisabled) {
          return null;
        }
        const conflict = hasConflict(order);
        const discontinue = (
          <Button size="sm" variant="ghost" icon="x" onPress={() => setStatusTarget({ order, mode: 'discontinue' })}>
            {t('discontinue')}
          </Button>
        );
        switch (order.status) {
          case 'pending-signature':
          case 'draft':
            return (
              <div className="orders-actions">
                <Button size="sm" variant="primary" icon="pen" isDisabled={conflict || !sign.canSign} onPress={() => setIdentity({ kind: 'order', order })}>
                  <Message id="sign.action" />
                </Button>
                {discontinue}
                {conflict ? <p className="orders-danger-text orders-small">{t('conflictCannotSign')}</p> : null}
              </div>
            );
          case 'active':
          case 'in-progress':
            return (
              <div className="orders-actions">
                {order.category === 'medication' ? (
                  <Button size="sm" variant="secondary" icon="minus" onPress={() => setStatusTarget({ order, mode: 'hold' })}>
                    {t('hold')}
                  </Button>
                ) : null}
                {discontinue}
              </div>
            );
          case 'on-hold':
            return (
              <div className="orders-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  icon="refresh"
                  onPress={() => {
                    setStatus(order.id, 'active');
                    toast({ tone: 'success', title: t('resumedToast'), body: t('demoOnlyBody') });
                  }}
                >
                  {t('resume')}
                </Button>
                {discontinue}
              </div>
            );
          default:
            return null;
        }
      },
    },
  ];

  const rowTone = (order: Order): Tone | undefined => {
    if (hasConflict(order) && (order.status === 'pending-signature' || order.status === 'draft')) {
      return 'danger';
    }
    if (order.status === 'on-hold') {
      return 'warning';
    }
    return freshIds.has(order.id) ? 'success' : undefined;
  };

  const table = (statuses: readonly OrderStatus[]): ReactNode => {
    const rows = orders.filter((order) => statuses.includes(order.status));
    return rows.length === 0 ? (
      <EmptyState compact icon="clipboard" title={t('emptyTab')} />
    ) : (
      <DataTable columns={columns} rows={rows} rowKey={(order) => order.id} caption={t('listCaption')} rowTone={rowTone} />
    );
  };

  const countOf = (statuses: readonly OrderStatus[]): number => orders.filter((order) => statuses.includes(order.status)).length;

  // ------------------------------------------------------------------------------------------ allergies
  const allergyBadges: ReactNode =
    patient.allergies.kind === 'list' ? (
      patient.allergies.items.map((allergy) => (
        <Badge key={allergy.code} tone="danger" icon="alert" size="sm">
          {allergyText(allergy, f.locale, (severity) => f.text(SEVERITY_LABEL[severity]))}
        </Badge>
      ))
    ) : patient.allergies.kind === 'nka' ? (
      <Badge tone="success" icon="check" size="sm">
        {t('nka')}
      </Badge>
    ) : (
      <Badge tone="warning" icon="alert" size="sm" strong>
        {t('notAssessed')}
      </Badge>
    );

  const signArea = (
    <div className="orders-sign">
      {!isPrescriber ? (
        <div className="orders-sign__note">
          <Icon name="lock" size="1em" />
          <span>{t('signNeedsPrescriber', { name: staffName(user, f.locale) })}</span>
          <Button size="sm" variant="secondary" onPress={() => setRole('physician')}>
            {t('switchToPhysician')}
          </Button>
        </div>
      ) : null}
      {sign.blockedByBanner ? (
        <p className="orders-danger-text orders-small">
          <Message id="sign.blockedByBanner" />
        </p>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        icon="pen"
        isDisabled={basket.length === 0 || !isPrescriber || !sign.canSign || actionsDisabled}
        onPress={() => setIdentity({ kind: 'basket' })}
      >
        {t('signOrders', { count: basket.length })}
      </Button>
    </div>
  );

  const roleText: Text3 = ROLE_LABEL[roleId];

  return (
    <div className="orders-screen" data-patient-id={patient.id}>
      <PageHeader
        icon="clipboard"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          entryOpen ? (
            <Button variant="secondary" icon="x" onPress={() => setEntryOpen(false)}>
              {t('closeEntry')}
            </Button>
          ) : (
            <Button variant="primary" icon="plus" isDisabled={!canEnter} onPress={() => setEntryOpen(true)}>
              {t('newOrder')}
            </Button>
          )
        }
      >
        <div className="orders-context">
          <span className="orders-context__label">{t('allergiesLabel')}</span>
          {allergyBadges}
          <span className="orders-context__sep" aria-hidden="true" />
          <span className="orders-context__label">{t('weightLabel')}</span>
          {patient.weight === null ? (
            <span className="orders-muted">{t('weightNone')}</span>
          ) : (
            <Badge size="sm" tone="neutral">
              <Qty value={patient.weight.kg} unit="kg" />
            </Badge>
          )}
        </div>
      </PageHeader>

      {roleId === 'cashier' || roleId === 'admin' ? (
        <Callout
          tone="info"
          icon="lock"
          actions={
            <Button size="sm" variant="secondary" onPress={() => setRole('physician')}>
              {t('switchToPhysician')}
            </Button>
          }
        >
          {t('viewOnlyNote', { role: f.text(roleText) })}
        </Callout>
      ) : null}

      <Grid min="13rem">
        <StatTile icon="clipboard" tone="info" label={t('statActive')} value={String(activeCount)} hint={t('statMeds', { count: activeMeds })} />
        <StatTile
          icon="pen"
          {...(pending.length > 0 ? { tone: pending.some(hasConflict) ? ('danger' as const) : ('warning' as const) } : {})}
          label={t('statPending')}
          value={String(pending.length)}
          hint={pending.some(hasConflict) ? t('statConflict') : t('statNothing')}
        />
        <StatTile icon="minus" {...(heldCount > 0 ? { tone: 'warning' as const } : {})} label={t('statHeld')} value={String(heldCount)} />
        <StatTile
          icon="plus"
          {...(basket.length > 0 ? { tone: 'accent' as const } : {})}
          label={t('statBasket')}
          value={String(basket.length)}
          {...(canEnter ? { onPress: () => setEntryOpen(true) } : {})}
        />
      </Grid>

      {entryOpen || basket.length > 0 ? (
        <OrderEntry
          patient={patient}
          existing={orders}
          basket={basket}
          onAdd={(drafts) => setBasket((current) => [...current, ...drafts])}
          onRemove={(id) => setBasket((current) => current.filter((draft) => draft.id !== id))}
          requestSign={requestSign}
          {...(roleId === 'nurse' ? { note: <Callout tone="info">{t('nurseEntryNote')}</Callout> } : {})}
          signArea={signArea}
          onClose={() => setEntryOpen(false)}
        />
      ) : null}

      <Card
        icon="clipboard"
        title={t('listTitle')}
        subtitle={t('listSubtitle')}
        {...(!isPrescriber ? { footer: <span className="orders-muted orders-small">{t('prescriberOnly')}</span> } : {})}
      >
        <Tabs
          aria-label={t('tabsLabel')}
          selectedKey={tab}
          onSelectionChange={setTab}
          items={[
            { id: 'active', label: t('tabActive'), badge: String(countOf(TAB_STATUSES.active ?? [])), content: table(TAB_STATUSES.active ?? []) },
            { id: 'held', label: t('tabHeld'), badge: String(countOf(TAB_STATUSES.held ?? [])), content: table(TAB_STATUSES.held ?? []) },
            { id: 'stopped', label: t('tabStopped'), badge: String(countOf(TAB_STATUSES.stopped ?? [])), content: table(TAB_STATUSES.stopped ?? []) },
            { id: 'all', label: t('tabAll'), badge: String(orders.length), content: table(TAB_STATUSES.all ?? []) },
          ]}
        />
      </Card>

      <IdentityCheckDialog
        key={identity === null ? 'closed' : 'open'}
        isOpen={identity !== null}
        banner={banner}
        count={identity === null ? 0 : identity.kind === 'basket' ? basket.length : 1}
        onConfirm={confirmIdentity}
        onReject={() => {
          setIdentity(null);
          toast({ tone: 'warning', title: t('idStoppedToast'), body: t('idStoppedBody') });
        }}
        onCancel={() => setIdentity(null)}
      />
      <StatusDialog
        key={statusTarget === null ? 'closed' : `${statusTarget.mode}-${statusTarget.order.id}`}
        target={statusTarget}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => {
          const target = statusTarget;
          setStatusTarget(null);
          if (target === null) {
            return;
          }
          setStatus(target.order.id, target.mode === 'hold' ? 'on-hold' : 'cancelled');
          toast({ tone: 'success', title: target.mode === 'hold' ? t('heldToast') : t('discontinuedToast'), body: t('demoOnlyBody') });
        }}
      />
    </div>
  );
}
