/**
 * The waiting-room screen (simulated): what the television in the outpatient waiting area shows. It speaks
 * all three languages at once, whatever the desk's UI language is: Sorani first, then Arabic, then English.
 *
 * - "Now serving": the last token called, very large, with the room and the clinic. A new call (or a recall)
 *   flashes it; the flash is off for users who prefer reduced motion.
 * - "Next": the tokens of patients who have arrived and wait, longest wait first.
 * - "Recently called": the tokens before the current one.
 *
 * Tokens and rooms only: no patient names on a public screen.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { CLINICS, DEMO_NOW_ISO, HOSPITAL, type ClinicId, type Text3 } from '../../data/index.ts';
import { formatTime } from '../../i18n/use-t.ts';
import { DISPLAY_TEXT } from './messages.ts';
import type { OpdState } from './state.ts';

function roomOf(clinicId: ClinicId): string {
  return CLINICS.find((clinic) => clinic.id === clinicId)?.room ?? '';
}

function clinicName(clinicId: ClinicId): Text3 {
  return CLINICS.find((clinic) => clinic.id === clinicId)?.name ?? { en: '', ckb: '', ar: '' };
}

/** One text in the three languages, each in its own direction. */
function Tri({ text, className, inline = false }: { readonly text: Text3; readonly className?: string; readonly inline?: boolean }): ReactNode {
  return (
    <span className={['outpatient-tri', inline ? 'outpatient-tri--inline' : '', className ?? ''].filter(Boolean).join(' ')}>
      <span lang="ckb" dir="rtl">
        {text.ckb}
      </span>
      <span lang="ar" dir="rtl">
        {text.ar}
      </span>
      <span lang="en" dir="ltr">
        {text.en}
      </span>
    </span>
  );
}

function withRoom(template: Text3, room: string): Text3 {
  return { en: template.en.replace('{room}', room), ckb: template.ckb.replace('{room}', room), ar: template.ar.replace('{room}', room) };
}

export interface QueueDisplayProps {
  readonly state: OpdState;
  /** The full-screen version (in the dialog): more rows, bigger type. */
  readonly large?: boolean;
  /** The accessible name of the display region (in the UI language). */
  readonly label: string;
}

export function QueueDisplay({ state, large = false, label }: QueueDisplayProps): ReactNode {
  const current = state.calls.at(-1);
  const waiting = state.appointments
    .filter((appointment) => appointment.status === 'arrived' && appointment.queueNumber !== null)
    .toSorted((a, b) => (a.arrivedIso ?? '').localeCompare(b.arrivedIso ?? ''))
    .slice(0, large ? 8 : 5);
  const seen = new Set<string>(current === undefined ? [] : [current.token]);
  const recent = state.calls
    .toReversed()
    .filter((call) => {
      if (seen.has(call.token)) {
        return false;
      }
      seen.add(call.token);
      return true;
    })
    .slice(0, large ? 5 : 3);
  return (
    <section className={large ? 'outpatient-display outpatient-display--large' : 'outpatient-display'} aria-label={label}>
      <header className="outpatient-display__header">
        <div className="outpatient-display__hospital">
          <Tri text={HOSPITAL.name} />
        </div>
        <div className="outpatient-display__clock">
          <Bdi dir="ltr" className="outpatient-display__time">
            {formatTime(DEMO_NOW_ISO)}
          </Bdi>
          <Tri text={DISPLAY_TEXT.area} className="outpatient-display__area" />
        </div>
      </header>

      <div className="outpatient-display__main">
        <div className="outpatient-display__now-wrap">
          <Tri text={DISPLAY_TEXT.nowServing} inline className="outpatient-display__label" />
          {current === undefined ? (
            <p className="outpatient-display__token outpatient-display__token--none">—</p>
          ) : (
            <div key={current.seq} className="outpatient-display__now">
              <Bdi dir="ltr" className="outpatient-display__token">
                {current.token}
              </Bdi>
              <span className="outpatient-display__room">
                <Tri text={withRoom(DISPLAY_TEXT.goToRoom, roomOf(current.clinicId))} />
              </span>
              <span className="outpatient-display__clinic">
                <Tri text={clinicName(current.clinicId)} inline />
              </span>
            </div>
          )}
        </div>

        <div className="outpatient-display__side">
          <div className="outpatient-display__list">
            <Tri text={DISPLAY_TEXT.next} inline className="outpatient-display__label" />
            {waiting.length === 0 ? (
              <p className="outpatient-display__empty">—</p>
            ) : (
              <ol className="outpatient-display__tokens">
                {waiting.map((appointment) => (
                  <li key={appointment.id} className="outpatient-display__row">
                    <Bdi dir="ltr" className="outpatient-display__small-token">
                      {appointment.queueNumber ?? ''}
                    </Bdi>
                    <Bdi dir="ltr" className="outpatient-display__small-room">
                      {roomOf(appointment.clinicId)}
                    </Bdi>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="outpatient-display__list">
            <Tri text={DISPLAY_TEXT.recent} inline className="outpatient-display__label" />
            <ol className="outpatient-display__tokens outpatient-display__tokens--recent">
              {recent.map((call) => (
                <li key={call.seq} className="outpatient-display__row">
                  <Bdi dir="ltr" className="outpatient-display__small-token">
                    {call.token}
                  </Bdi>
                  <Bdi dir="ltr" className="outpatient-display__small-room">
                    {roomOf(call.clinicId)}
                  </Bdi>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <footer className="outpatient-display__footer">
        <Tri text={DISPLAY_TEXT.notice} inline />
      </footer>
    </section>
  );
}

/** The paper token slip the desk printer gives the patient (simulated), in the three languages. */
export function TokenSlipView({ token, clinicId, iso, walkIn, label }: { readonly token: string; readonly clinicId: ClinicId; readonly iso: string; readonly walkIn: boolean; readonly label: string }): ReactNode {
  return (
    <figure className="outpatient-slip" aria-label={label}>
      <Tri text={HOSPITAL.shortName} className="outpatient-slip__hospital" />
      <Tri text={DISPLAY_TEXT.yourNumber} inline className="outpatient-slip__label" />
      <Bdi dir="ltr" className="outpatient-slip__token">
        {token}
      </Bdi>
      <Tri text={clinicName(clinicId)} className="outpatient-slip__clinic" />
      <Tri text={withRoom(DISPLAY_TEXT.room, roomOf(clinicId))} inline className="outpatient-slip__room" />
      {walkIn ? <Tri text={DISPLAY_TEXT.walkIn} inline className="outpatient-slip__walkin" /> : null}
      <Bdi dir="ltr" className="outpatient-slip__time">
        {`${iso.slice(0, 10)} ${formatTime(iso)}`}
      </Bdi>
      <Tri text={DISPLAY_TEXT.slipNotice} className="outpatient-slip__notice" />
    </figure>
  );
}
