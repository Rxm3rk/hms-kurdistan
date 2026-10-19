/**
 * The booking dialog: find the patient, choose clinic, day (Friday closed) and a free slot from the slot
 * picker, visit type and channel; shows the fee in IQD and USD at the demo rate.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_TODAY, EXCHANGE_RATE, getPayer, iqdToUsd, PATIENTS } from '../../data/index.ts';
import type { Patient } from '../../data/index.ts';
import { APPT_CLINICS, apptClinic, CHANNEL_LABEL, slotsOf, WEEK_DAYS, weekdayOf, type ApptRow, type BookingChannel } from '../../data/ext/appointments.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Callout, Dialog, PatientInline, SearchField, Segmented, SelectField, personName } from '../../ui/index.ts';
import { messages } from './messages.ts';
import { NOW_HHMM } from './shared.ts';

export interface BookingDraft {
  readonly patient: Patient | null;
  readonly clinicId: string;
  readonly date: string;
}

export interface BookingDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initial: BookingDraft;
  readonly rows: readonly ApptRow[];
  /** Earlier no-shows of a patient. */
  readonly priorNoShows: (patientId: string) => number;
  readonly onBook: (row: ApptRow) => void;
}

const CHANNELS: readonly BookingChannel[] = ['reception', 'phone', 'referral', 'online'];

export function BookingDialog({ isOpen, onOpenChange, initial, rows, priorNoShows, onBook }: BookingDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [patient, setPatient] = useState<Patient | null>(initial.patient);
  const [query, setQuery] = useState('');
  const [clinicId, setClinicId] = useState(initial.clinicId);
  const [date, setDate] = useState(initial.date === WEEK_DAYS[6] ? DEMO_TODAY : initial.date);
  const [slot, setSlot] = useState<string | null>(null);
  const [visit, setVisit] = useState<'new' | 'follow-up'>('follow-up');
  const [channel, setChannel] = useState<BookingChannel>('reception');

  const pool = useMemo(() => {
    const byId = new Map<string, Patient>();
    for (const p of PATIENTS) {
      byId.set(p.id, p);
    }
    for (const row of rows) {
      byId.set(row.patient.id, row.patient);
    }
    return [...byId.values()];
  }, [rows]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }
    return pool
      .filter((p) => [p.name.latin, p.name.ckb, p.name.ar, p.mrn, p.phone].some((value) => value.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [pool, query]);

  const clinic = apptClinic(clinicId);
  const runs = clinic.days.includes(weekdayOf(date));
  const taken = new Set(rows.filter((row) => row.clinicId === clinicId && row.date === date && row.status !== 'cancelled').map((row) => row.time));
  const slots = runs ? slotsOf(clinic) : [];
  const fee = visit === 'new' ? clinic.feeNewIqd : clinic.feeFollowUpIqd;
  const noShows = patient === null ? 0 : priorNoShows(patient.id);
  const bookableDays = WEEK_DAYS.filter((day) => day >= DEMO_TODAY);

  const book = (): void => {
    if (patient === null || slot === null) {
      return;
    }
    onBook({
      id: `SYN-APT-N${String(Date.now()).slice(-5)}`,
      patient,
      clinicId,
      date,
      time: slot,
      durationMin: clinic.slotMin,
      status: 'booked',
      visitType: visit,
      reason: { en: 'Booked at reception', ckb: 'لە پێشوازی گیراوە', ar: 'حُجز في الاستقبال' },
      token: null,
      arrivedAt: null,
      channel,
      payerId: patient.payerId,
      priorNoShows: noShows,
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('bookingTitle')}
      subtitle={t('bookingSubtitle')}
      actions={
        <>
          <Button
            variant="ghost"
            onPress={() => {
              onOpenChange(false);
            }}
          >
            {t('close')}
          </Button>
          <Button variant="primary" icon="calendar" isDisabled={patient === null || slot === null} onPress={book}>
            {t('confirmBooking')}
          </Button>
        </>
      }
    >
      <div className="appointments-booking">
        <div className="appointments-booking__patient">
          {patient === null ? (
            <>
              <SearchField label={t('patientSearch')} placeholder={t('patientSearchPlaceholder')} value={query} onChange={setQuery} autoFocus />
              {query.trim().length >= 2 && matches.length === 0 ? <p className="appointments-muted">{t('noPatientMatch')}</p> : null}
              <ul className="appointments-matches">
                {matches.map((p) => (
                  <li key={p.id}>
                    <Button
                      variant="ghost"
                      className="appointments-match"
                      onPress={() => {
                        setPatient(p);
                      }}
                    >
                      <PatientInline patient={p} />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="appointments-chosen">
              <PatientInline patient={patient} secondary />
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setPatient(null);
                  setQuery('');
                }}
              >
                {t('changePatient')}
              </Button>
            </div>
          )}
        </div>

        <div className="appointments-booking__row">
          <SelectField
            label={t('fClinic')}
            options={APPT_CLINICS.map((c) => ({ id: c.id, label: `${f.text(c.name)} · ${c.room}` }))}
            selectedKey={clinicId}
            onSelectionChange={(id) => {
              setClinicId(id);
              setSlot(null);
            }}
          />
          <Segmented
            label={t('fVisit')}
            value={visit}
            onChange={(id) => {
              setVisit(id === 'new' ? 'new' : 'follow-up');
            }}
            options={[
              { id: 'follow-up', label: t('visitFollowUp') },
              { id: 'new', label: t('visitNew') },
            ]}
          />
          <SelectField
            label={t('fChannelSel')}
            options={CHANNELS.map((c) => ({ id: c, label: f.text(CHANNEL_LABEL[c]) }))}
            selectedKey={channel}
            onSelectionChange={(id) => {
              setChannel(CHANNELS.find((c) => c === id) ?? 'reception');
            }}
          />
        </div>

        <fieldset className="appointments-fieldset">
          <legend className="appointments-legend">{t('fDay')}</legend>
          <div className="appointments-daypick">
            {bookableDays.map((day) => {
              const friday = weekdayOf(day) === 5;
              const open = apptClinic(clinicId).days.includes(weekdayOf(day));
              return (
                <Button
                  key={day}
                  size="sm"
                  variant={day === date ? 'primary' : 'secondary'}
                  isDisabled={friday}
                  onPress={() => {
                    setDate(day);
                    setSlot(null);
                  }}
                >
                  {f.weekday(day)} {f.date(day, 'short').slice(0, 5)}
                  {friday ? ` · ${t('closedFriday')}` : open ? '' : ` · ${t('noSession')}`}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="appointments-fieldset">
          <legend className="appointments-legend">
            {t('slotPicker')} · {f.text(clinic.name)} · {personName(clinic.clinician, f.locale)}
          </legend>
          {slots.length === 0 ? (
            <p className="appointments-muted">{t('noSlots')}</p>
          ) : (
            <>
              <div className="appointments-slots" role="group" aria-label={t('slotPicker')}>
                {slots.map((time) => {
                  const isTaken = taken.has(time);
                  const past = date === DEMO_TODAY && time < NOW_HHMM;
                  return (
                    <Button
                      key={time}
                      size="sm"
                      variant={slot === time ? 'primary' : 'secondary'}
                      className={isTaken ? 'appointments-slot appointments-slot--taken' : past ? 'appointments-slot appointments-slot--past' : 'appointments-slot'}
                      isDisabled={isTaken || past}
                      aria-label={isTaken ? t('slotTakenLabel', { time }) : time}
                      onPress={() => {
                        setSlot(time);
                      }}
                    >
                      {time}
                    </Button>
                  );
                })}
              </div>
              <p className="appointments-legend-row">
                <span className="appointments-swatch appointments-swatch--free" /> {t('slotLegendFree')}
                <span className="appointments-swatch appointments-swatch--taken" /> {t('slotLegendTaken')}
                <span className="appointments-swatch appointments-swatch--past" /> {t('slotLegendPast')}
              </p>
            </>
          )}
        </fieldset>

        {noShows >= 2 ? (
          <Callout tone="warning">{t('noShowWarning', { count: noShows })}</Callout>
        ) : null}

        <div className="appointments-fee">
          <span className="appointments-fee__label">{t('feeSummary')}</span>
          <strong>{t('feeLine', { iqd: f.iqd(fee), usd: f.usd(iqdToUsd(fee)) })}</strong>
          <span className="appointments-muted">
            {patient === null ? '' : `${t('fPayer')}: ${f.text(getPayer(patient.payerId).name)} · `}
            {f.text(EXCHANGE_RATE.note)}
          </span>
        </div>
        {patient === null || slot === null ? <p className="appointments-muted">{t('needPatient')}</p> : null}
      </div>
    </Dialog>
  );
}
