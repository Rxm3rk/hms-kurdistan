/**
 * Discharge: the four-item checklist (summary signed, medicines reconciled, follow-up booked, invoice settled
 * or credit approved), with what is missing and where to fix it. An unacknowledged critical result stops the
 * discharge. When everything is done a physician or nurse discharges the patient and the bed goes to cleaning.
 */
import { Bdi } from '@hms/design-system';
import { useState, type ReactNode } from 'react';
import { findPatient, getClinic, getWard } from '../../data/index.ts';
import type { RoleId, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import type { ScreenId } from '../../shell/index.ts';
import { useRole } from '../../shell/index.ts';
import { Button, Callout, Dialog, Icon, Money, PatientInline, Qty, Segmented, StaffName, cx, useToast } from '../../ui/index.ts';
import {
  CHECKLIST_ITEMS,
  FOLLOW_UP_CLINIC,
  FOLLOW_UP_SLOT_ISO,
  initialChecklist,
  openBalanceIqd,
  openCriticalsOf,
  type ChecklistItem,
} from './board-data.ts';
import { NameBdi, dischargeWhen, stayOf } from './bits.tsx';
import { messages } from './messages.ts';
import { checklistOf, type BoardState } from './state.ts';

export interface DischargeDialogProps {
  readonly board: BoardState;
  readonly bedId: string;
  readonly onClose: () => void;
  readonly onCheck: (patientId: string, item: ChecklistItem) => void;
  readonly onDischarge: (bedId: string) => void;
  /** Opens the patient's record on a screen (closes this dialog first). */
  readonly onOpenPatient: (patientId: string, screen: ScreenId) => void;
}

const CAN_DISCHARGE: ReadonlySet<RoleId> = new Set<RoleId>(['physician', 'nurse']);
const CAN_APPROVE_CREDIT: ReadonlySet<RoleId> = new Set<RoleId>(['cashier', 'admin']);

type Destination = 'home' | 'hospital' | 'care';

export function DischargeDialog({ board, bedId, onClose, onCheck, onDischarge, onOpenPatient }: DischargeDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { roleId, user } = useRole();
  const [destination, setDestination] = useState<Destination>('home');
  const bed = board.beds[bedId];
  const patient = bed === undefined ? undefined : findPatient(bed.patientId);
  if (bed === undefined || patient === undefined) {
    return null;
  }
  const wardId: WardId = bed.wardId;
  const checklist = checklistOf(board, patient.id);
  const morning = initialChecklist(patient.id);
  const criticals = openCriticalsOf(patient.id);
  const stay = stayOf(board, patient.id, wardId);
  const when = dischargeWhen(stay.expectedDischargeOn);
  const missing = CHECKLIST_ITEMS.filter((item) => !checklist[item]);
  const roleMayDischarge = CAN_DISCHARGE.has(roleId);
  const ready = missing.length === 0 && criticals.length === 0;
  const clinic = getClinic(FOLLOW_UP_CLINIC[wardId]);
  const balance = openBalanceIqd(patient.id);

  const itemLabel = (item: ChecklistItem): string => {
    switch (item) {
      case 'summary':
        return t('itemSummary');
      case 'meds':
        return t('itemMeds');
      case 'followUp':
        return t('itemFollowUp');
      case 'invoice':
        return t('itemInvoice');
    }
  };

  const detail = (item: ChecklistItem): ReactNode => {
    const done = checklist[item];
    const byDemo = done && !morning[item];
    switch (item) {
      case 'summary':
        return done ? t('summaryDone') : t('summaryMissing');
      case 'meds':
        return done ? t('medsDone') : t('medsMissing');
      case 'followUp':
        if (byDemo) {
          return t('followUpBooked', { clinic: f.text(clinic.name), date: f.date(FOLLOW_UP_SLOT_ISO), time: f.time(FOLLOW_UP_SLOT_ISO) });
        }
        return done ? t('followUpDone') : t('followUpMissing');
      case 'invoice':
        if (byDemo) {
          return t.rich('creditApproved', { name: <StaffName member={user} /> });
        }
        if (done) {
          return t('invoiceDone');
        }
        return balance === null ? t('invoiceDeposit') : t.rich('invoiceBalance', { amount: <Money amount={balance} /> });
    }
  };

  const actions = (item: ChecklistItem): ReactNode => {
    if (checklist[item]) {
      return null;
    }
    switch (item) {
      case 'summary':
        return (
          <Button size="sm" icon="pen" onPress={() => { onOpenPatient(patient.id, 'chart'); }}>
            {t('actionSignInChart')}
          </Button>
        );
      case 'meds':
        return (
          <>
            <Button
              size="sm"
              icon="check"
              isDisabled={roleId !== 'physician'}
              onPress={() => {
                onCheck(patient.id, 'meds');
                toast({ tone: 'success', title: t('reconciledToast') });
              }}
            >
              {t('actionReconcile')}
            </Button>
            <Button size="sm" variant="ghost" icon="pill" onPress={() => { onOpenPatient(patient.id, 'emar'); }}>
              {t('actionOpenMedication')}
            </Button>
            {roleId === 'physician' ? null : <span className="ward-check__hint">{t('onlyPhysician')}</span>}
          </>
        );
      case 'followUp':
        return (
          <Button
            size="sm"
            icon="calendar"
            onPress={() => {
              onCheck(patient.id, 'followUp');
              toast({ tone: 'success', title: t('followUpToast', { clinic: f.text(clinic.name), date: f.date(FOLLOW_UP_SLOT_ISO) }) });
            }}
          >
            {t('actionBookFollowUp')}
          </Button>
        );
      case 'invoice':
        return (
          <>
            <Button
              size="sm"
              icon="money"
              isDisabled={!CAN_APPROVE_CREDIT.has(roleId)}
              onPress={() => {
                onCheck(patient.id, 'invoice');
                toast({ tone: 'success', title: t('creditToast') });
              }}
            >
              {t('actionApproveCredit')}
            </Button>
            <Button size="sm" variant="ghost" icon="receipt" onPress={() => { onOpenPatient(patient.id, 'billing'); }}>
              {t('actionOpenBilling')}
            </Button>
            {CAN_APPROVE_CREDIT.has(roleId) ? null : <span className="ward-check__hint">{t('onlyCashier')}</span>}
          </>
        );
    }
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t.rich('dischargeTitle', { name: <NameBdi patient={patient} /> })}
      subtitle={t.rich('dischargeSubtitle', { ward: f.text(getWard(wardId).name), bed: <Bdi dir="ltr">{bed.id}</Bdi> })}
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            icon="logout"
            isDisabled={!ready || !roleMayDischarge}
            onPress={() => {
              onDischarge(bed.id);
            }}
          >
            {t('dischargeConfirm')}
          </Button>
        </>
      }
    >
      <div className="ward-dialog">
        <div className="ward-dialog__patient">
          <PatientInline patient={patient} secondary />
        </div>
        {when === 'today' ? null : (
          <Callout tone="info" icon="calendar">
            {stay.expectedDischargeOn === null ? t('notPlanned') : t('notPlannedToday', { date: f.date(stay.expectedDischargeOn) })}
          </Callout>
        )}
        {criticals.map((result) => (
          <Callout
            key={result.id}
            tone="danger"
            icon="flask"
            title={t('criticalBadge')}
            actions={
              <Button size="sm" variant="danger" icon="flask" onPress={() => { onOpenPatient(patient.id, 'lab'); }}>
                {t('openLab')}
              </Button>
            }
          >
            {t.rich('criticalBlock', {
              analyte: (
                <>
                  {f.text(result.analyte)} <Qty value={result.value} unit={result.unit} />
                </>
              ),
            })}
          </Callout>
        ))}
        <section className="ward-check" aria-labelledby="ward-check-title">
          <h3 id="ward-check-title" className="ward-check__title">
            {t('checklistTitle')}
          </h3>
          <ul className="ward-check__list">
            {CHECKLIST_ITEMS.map((item) => {
              const done = checklist[item];
              return (
                <li key={item} className={cx('ward-check__item', done ? 'ward-check__item--done' : 'ward-check__item--missing')}>
                  <span className="ward-check__icon">
                    <Icon name={done ? 'check-circle' : 'x'} size="1.25rem" />
                  </span>
                  <span className="ward-check__text">
                    <span className="ward-check__label">
                      {itemLabel(item)}
                      <span className="ward-check__status">{done ? t('itemDone') : t('itemMissing')}</span>
                    </span>
                    <span className="ward-check__detail">{detail(item)}</span>
                    {done ? null : <span className="ward-check__actions">{actions(item)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        {ready ? (
          <Callout tone="success" role="status">
            {t('readyToGo')}
          </Callout>
        ) : missing.length > 0 ? (
          <Callout tone="warning" role="status">
            {t('missingItems', { count: missing.length, items: missing.map(itemLabel).join(t('listSeparator')) })}
          </Callout>
        ) : null}
        <Segmented
          label={t('destination')}
          options={[
            { id: 'home', label: t('destHome') },
            { id: 'hospital', label: t('destHospital') },
            { id: 'care', label: t('destCare') },
          ]}
          value={destination}
          onChange={(id) => {
            if (id === 'home' || id === 'hospital' || id === 'care') {
              setDestination(id);
            }
          }}
        />
        {roleMayDischarge ? null : (
          <Callout tone="info" icon="lock">
            {t('dischargeRole')}
          </Callout>
        )}
      </div>
    </Dialog>
  );
}
