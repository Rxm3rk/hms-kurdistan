/** Booking a theatre case: patient, procedure, side, team, and a free start time in the session. */
import { useMemo, useState, type ReactNode } from 'react';
import { CENSUS_GROUPS, getPatient } from '../../data/index.ts';
import type { Patient } from '../../data/index.ts';
import {
  ANAESTHESIA_LABEL,
  ANAESTHETISTS,
  caseEnd,
  PRIORITY_LABEL,
  PROCEDURES,
  procedureOf,
  SIDE_LABEL,
  SIGN_IN_ITEMS,
  SIGN_OUT_ITEMS,
  SURGEONS,
  THEATRE_DAYS,
  THEATRE_ROOMS,
  TIME_OUT_ITEMS,
  type AnaesthesiaType,
  type CasePriority,
  type Side,
  type TheatreCase,
} from '../../data/ext/theatre.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Dialog, PatientInline, Segmented, SelectField, personName } from '../../ui/index.ts';
import { messages } from './messages.ts';

function toMin(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function fromMin(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface BookingDialogProps {
  readonly cases: readonly TheatreCase[];
  readonly initialRoom: string;
  readonly initialDate: string;
  readonly patients: readonly Patient[];
  readonly onClose: () => void;
  readonly onBook: (c: TheatreCase) => void;
}

const ANAESTHESIA: readonly AnaesthesiaType[] = ['general', 'spinal', 'regional', 'local-sedation'];
const PRIORITIES: readonly CasePriority[] = ['elective', 'urgent', 'emergency'];

export function BookingDialog({ cases, initialRoom, initialDate, patients, onClose, onBook }: BookingDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [procId, setProcId] = useState(PROCEDURES[0]?.id ?? '');
  const [side, setSide] = useState<Side>('none');
  const [roomId, setRoomId] = useState(initialRoom);
  const [date, setDate] = useState(initialDate);
  const [surgeon, setSurgeon] = useState(SURGEONS[0]?.id ?? '');
  const [anaesthetist, setAnaesthetist] = useState(ANAESTHETISTS[0]?.id ?? '');
  const [anaesthesia, setAnaesthesia] = useState<AnaesthesiaType>('general');
  const [priority, setPriority] = useState<CasePriority>('elective');
  const [start, setStart] = useState<string | null>(null);
  const proc = procedureOf(procId);
  const room = THEATRE_ROOMS.find((r) => r.id === roomId) ?? THEATRE_ROOMS[0]!;
  const pool = useMemo(() => {
    const surg = CENSUS_GROUPS['surg-b'].map((id) => getPatient(id));
    const seen = new Set<string>();
    return [...surg, ...patients].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [patients]);
  const patient = pool.find((p) => p.id === patientId);

  const free = useMemo(() => {
    const booked = cases
      .filter((c) => c.roomId === roomId && c.date === date && c.status !== 'postponed')
      .map((c) => [toMin(c.start), toMin(caseEnd(c)) + 15] as const);
    const out: string[] = [];
    for (let m = toMin(room.start); m + proc.minutes <= toMin(room.end); m += 15) {
      const end = m + proc.minutes;
      if (booked.every(([s, e]) => end <= s || m >= e) && !(date === THEATRE_DAYS[0] && m < toMin('09:30'))) {
        out.push(fromMin(m));
      }
    }
    return out;
  }, [cases, roomId, date, room, proc.minutes]);

  const valid = patient !== undefined && start !== null && (!proc.sided || side !== 'none');
  const phase = (items: readonly string[]): TheatreCase['signIn'] => ({ items: Object.fromEntries(items.map((i) => [i, false])), confirmedTime: null, confirmedById: null });

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="lg"
      title={t('bookTitle')}
      subtitle={t('bookSubtitle')}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('close')}
          </Button>
          <Button
            variant="primary"
            icon="calendar"
            isDisabled={!valid}
            onPress={() => {
              if (patient === undefined || start === null) {
                return;
              }
              onBook({
                id: `SYN-OT-${String(2700 + cases.length)}`,
                patient,
                roomId,
                date,
                start,
                procedureId: procId,
                side: proc.sided ? side : 'none',
                surgeon,
                anaesthetist,
                anaesthesia,
                priority,
                status: 'scheduled',
                signIn: phase(SIGN_IN_ITEMS),
                timeOut: phase(TIME_OUT_ITEMS),
                signOut: phase(SIGN_OUT_ITEMS),
                times: {},
                implants: [],
                consumables: [],
                chargesPosted: false,
                note: null,
              });
            }}
          >
            {t('confirmBook')}
          </Button>
        </>
      }
    >
      <div className="theatre-stack">
        <SelectField
          label={t('patient')}
          placeholder={t('choosePatient')}
          options={pool.map((p) => ({ id: p.id, label: `${personName(p.name, f.locale)} · ${p.mrn}` }))}
          selectedKey={patientId}
          onSelectionChange={setPatientId}
        />
        {patient === undefined ? null : <PatientInline patient={patient} secondary />}
        <div className="theatre-form-row">
          <SelectField
            label={t('procedure')}
            options={PROCEDURES.map((p) => ({ id: p.id, label: `${f.text(p.name)} · ${t('minutes', { min: p.minutes })}` }))}
            selectedKey={procId}
            onSelectionChange={(id) => {
              setProcId(id);
              setStart(null);
            }}
          />
          {proc.sided ? (
            <Segmented
              label={t('side')}
              value={side}
              onChange={(id) => {
                setSide(id === 'left' ? 'left' : id === 'right' ? 'right' : 'none');
              }}
              options={(['left', 'right'] as const).map((s) => ({ id: s, label: f.text(SIDE_LABEL[s]) }))}
            />
          ) : null}
        </div>
        <div className="theatre-form-row">
          <SelectField label={t('surgeon')} options={SURGEONS.map((s) => ({ id: s.id, label: f.text(s.name) }))} selectedKey={surgeon} onSelectionChange={setSurgeon} />
          <SelectField label={t('anaesthetist')} options={ANAESTHETISTS.map((s) => ({ id: s.id, label: f.text(s.name) }))} selectedKey={anaesthetist} onSelectionChange={setAnaesthetist} />
          <SelectField
            label={t('anaesthesia')}
            options={ANAESTHESIA.map((a) => ({ id: a, label: f.text(ANAESTHESIA_LABEL[a]) }))}
            selectedKey={anaesthesia}
            onSelectionChange={(id) => {
              setAnaesthesia(ANAESTHESIA.find((a) => a === id) ?? 'general');
            }}
          />
          <SelectField
            label={t('priority')}
            options={PRIORITIES.map((p) => ({ id: p, label: f.text(PRIORITY_LABEL[p]) }))}
            selectedKey={priority}
            onSelectionChange={(id) => {
              setPriority(PRIORITIES.find((p) => p === id) ?? 'elective');
            }}
          />
        </div>
        <div className="theatre-form-row">
          <SelectField
            label={t('room')}
            options={THEATRE_ROOMS.map((r) => ({ id: r.id, label: f.text(r.name) }))}
            selectedKey={roomId}
            onSelectionChange={(id) => {
              setRoomId(id);
              setStart(null);
            }}
          />
          <SelectField
            label={t('day')}
            options={THEATRE_DAYS.map((d) => ({ id: d, label: `${f.weekday(d)} ${f.date(d)}` }))}
            selectedKey={date}
            onSelectionChange={(id) => {
              setDate(id);
              setStart(null);
            }}
          />
        </div>
        <fieldset className="theatre-fieldset">
          <legend className="theatre-legend">{t('freeTimes', { min: proc.minutes })}</legend>
          {free.length === 0 ? (
            <p className="theatre-muted">{t('noFreeTime')}</p>
          ) : (
            <div className="theatre-slots">
              {free.map((time) => (
                <Button
                  key={time}
                  size="sm"
                  variant={start === time ? 'primary' : 'secondary'}
                  onPress={() => {
                    setStart(time);
                  }}
                >
                  {time}
                </Button>
              ))}
            </div>
          )}
        </fieldset>
        {valid ? null : <p className="theatre-muted">{t('needAll')}</p>}
      </div>
    </Dialog>
  );
}
