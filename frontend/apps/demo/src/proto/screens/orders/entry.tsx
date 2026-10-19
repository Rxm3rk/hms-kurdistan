/**
 * Order entry: the order-type switch (medicine, laboratory, imaging, order sets) beside the basket of
 * unsigned orders.
 */
import { useState, type ReactNode } from 'react';
import { ORDER_CATEGORY_LABEL, PRIORITY_LABEL, PRIORITY_TONE, type Order, type Patient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import type { SignRequest } from '../../shell/index.ts';
import { Badge, Card, EmptyState, IconButton, Segmented } from '../../ui/index.ts';
import { MedicationForm } from './medication-form.tsx';
import { messages } from './messages.ts';
import type { DraftOrder } from './model.ts';
import { ImagingForm, LabForm, OrderSetsPanel } from './other-forms.tsx';
import { DraftLine, DraftTitle, WarningList } from './parts.tsx';

type EntryType = 'medication' | 'lab' | 'imaging' | 'sets';

export interface OrderEntryProps {
  readonly patient: Patient;
  readonly existing: readonly Order[];
  readonly basket: readonly DraftOrder[];
  readonly onAdd: (drafts: readonly DraftOrder[]) => void;
  readonly onRemove: (id: string) => void;
  readonly requestSign: (request: SignRequest) => void;
  /** A note above the forms (for example: entered by a nurse). */
  readonly note?: ReactNode;
  /** The basket's footer: the Sign orders button and why it may be disabled. */
  readonly signArea: ReactNode;
  readonly onClose: () => void;
}

export function OrderEntry({ patient, existing, basket, onAdd, onRemove, requestSign, note, signArea, onClose }: OrderEntryProps): ReactNode {
  const t = useT(messages);
  const [type, setType] = useState<EntryType>('medication');
  const [allergyChecked, setAllergyChecked] = useState(false);

  const options: readonly { id: EntryType; label: string }[] = [
    { id: 'medication', label: t('typeMedication') },
    { id: 'lab', label: t('typeLab') },
    { id: 'imaging', label: t('typeImaging') },
    { id: 'sets', label: t('typeSets') },
  ];

  return (
    <div className="orders-entry">
      <Card
        className="orders-entry__form"
        icon="plus"
        title={t('entryTitle')}
        subtitle={t('entrySubtitle')}
        actions={<IconButton icon="x" label={t('closeEntry')} onPress={onClose} />}
      >
        <div className="orders-entry__body">
          {note}
          <Segmented label={t('typeLabel')} options={options} value={type} onChange={(id) => setType(id as EntryType)} />
          {type === 'medication' ? (
            <MedicationForm
              patient={patient}
              existing={existing}
              basket={basket}
              onAdd={onAdd}
              requestSign={requestSign}
              allergyChecked={allergyChecked}
              onAllergyChecked={setAllergyChecked}
            />
          ) : null}
          {type === 'lab' ? <LabForm patient={patient} existing={existing} basket={basket} onAdd={onAdd} /> : null}
          {type === 'imaging' ? <ImagingForm patient={patient} existing={existing} basket={basket} onAdd={onAdd} /> : null}
          {type === 'sets' ? (
            <OrderSetsPanel
              patient={patient}
              existing={existing}
              basket={basket}
              onAdd={onAdd}
              allergyChecked={allergyChecked}
              onAllergyChecked={setAllergyChecked}
            />
          ) : null}
        </div>
      </Card>
      <Basket drafts={basket} onRemove={onRemove} signArea={signArea} />
    </div>
  );
}

export function Basket({ drafts, onRemove, signArea }: { readonly drafts: readonly DraftOrder[]; readonly onRemove: (id: string) => void; readonly signArea: ReactNode }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <Card
      className="orders-basket"
      icon="clipboard"
      title={
        <span className="orders-basket__title">
          {t('basketTitle')}
          <Badge tone={drafts.length === 0 ? 'neutral' : 'warning'} size="sm" strong={drafts.length > 0}>
            {String(drafts.length)}
          </Badge>
        </span>
      }
      subtitle={t('basketSubtitle')}
      {...(drafts.some((draft) => draft.override !== null) ? { tone: 'danger' as const } : drafts.length > 0 ? { tone: 'warning' as const } : {})}
      footer={signArea}
    >
      {drafts.length === 0 ? (
        <EmptyState compact icon="clipboard" title={t('basketEmpty')} />
      ) : (
        <ol className="orders-basket__list">
          {drafts.map((draft) => (
            <li key={draft.id} className="orders-basket__item">
              <div className="orders-basket__row">
                <DraftTitle draft={draft} />
                <IconButton
                  icon="x"
                  size="sm"
                  label={t('remove', { item: draft.medication?.drug ?? f.text(draft.title) })}
                  onPress={() => onRemove(draft.id)}
                />
              </div>
              <DraftLine draft={draft} />
              <div className="orders-basket__badges">
                <Badge size="sm" tone="neutral">
                  {f.text(ORDER_CATEGORY_LABEL[draft.category])}
                </Badge>
                {draft.priority === 'routine' ? null : (
                  <Badge size="sm" tone={PRIORITY_TONE[draft.priority]}>
                    {f.text(PRIORITY_LABEL[draft.priority])}
                  </Badge>
                )}
                {draft.medication?.highAlert === true ? (
                  <Badge size="sm" tone="warning" icon="shield">
                    {t('highAlert')}
                  </Badge>
                ) : null}
                {draft.override === null ? null : (
                  <Badge size="sm" tone="danger" icon="alert">
                    {t('overrideBadge')}
                  </Badge>
                )}
              </div>
              {draft.fromSet === null ? null : <p className="orders-muted orders-small">{t('fromSet', { name: f.text(draft.fromSet) })}</p>}
              <WarningList warnings={draft.warnings} compact />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
