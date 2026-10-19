/**
 * Shared pieces of the Patient messaging screen: status tones, the channel badge, the patient cell and the
 * phone preview bubble (in the message's own language and direction, not the UI's).
 */
import type { ReactNode } from 'react';
import { getPatient } from '../../data/index.ts';
import type { Patient, Tone } from '../../data/index.ts';
import type { Channel, DeliveryStatus, LinkStatus, MessageTemplate } from '../../data/ext/messaging.ts';
import { formatDate, useT } from '../../i18n/use-t.ts';
import { Badge, Code, PatientName, type IconName } from '../../ui/index.ts';
import { messages } from './messages.ts';

export const DELIVERY_TONE: Readonly<Record<DeliveryStatus, Tone>> = {
  scheduled: 'neutral',
  queued: 'neutral',
  sent: 'info',
  delivered: 'info',
  read: 'success',
  replied: 'success',
  failed: 'danger',
  'opted-out': 'warning',
};

export const LINK_TONE: Readonly<Record<LinkStatus, Tone>> = { active: 'info', used: 'success', expired: 'neutral', revoked: 'danger' };

const CHANNEL_ICON: Readonly<Record<Channel, IconName>> = { whatsapp: 'phone', viber: 'phone', sms: 'bell' };

export function ChannelBadge({ channel }: { readonly channel: Channel }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone={channel === 'whatsapp' ? 'success' : channel === 'viber' ? 'accent' : 'neutral'} icon={CHANNEL_ICON[channel]} size="sm">
      {t(`ch_${channel}`)}
    </Badge>
  );
}

export function PatientCell({ patientId }: { readonly patientId: string }): ReactNode {
  const patient = getPatient(patientId);
  return (
    <span className="msg-stack">
      <PatientName patient={patient} />
      <Code className="msg-muted">{patient.mrn}</Code>
    </span>
  );
}

export type MsgLanguage = 'ckb' | 'ar' | 'en';

/** Fills a template body for a language: the patient's first name in that script, sample values elsewhere. */
export function fillTemplate(template: MessageTemplate, language: MsgLanguage, patient: Patient | null, about: string | null): string {
  const first = (patient === null ? messages[language].sampleName : (language === 'en' ? patient.name.latin : language === 'ar' ? patient.name.ar : patient.name.ckb).split(' ')[0]) ?? '';
  const values: Readonly<Record<string, string>> = {
    name: first,
    clinic: about ?? messages[language].sampleClinic,
    date: formatDate('2026-10-20', language),
    time: '10:00',
    doctor: messages[language].sampleDoctor,
    room: messages[language].sampleRoom,
    link: 'https://demo.hms.krd/r/7Q2KD',
    amount: language === 'en' ? 'IQD 245,000' : language === 'ckb' ? '245,000 دینار' : '245,000 دينار',
    expires: formatDate('2026-10-21', language),
    code: '482913',
  };
  return template.body[language].replace(/\{(\w+)\}/gu, (_, key: string) => values[key] ?? `{${key}}`);
}

/** A phone-style message bubble, in the message's language and direction. */
export function PhonePreview({ text, channel, language, footer }: { readonly text: string; readonly channel: Channel; readonly language: MsgLanguage; readonly footer?: ReactNode }): ReactNode {
  const t = useT(messages);
  return (
    <div className={`msg-phone msg-phone--${channel}`}>
      <div className="msg-phone__bar">
        <span>{t(`ch_${channel}`)}</span>
        <Code>+964 750 000 0000</Code>
      </div>
      <div className="msg-phone__screen">
        <p className="msg-bubble" dir={language === 'en' ? 'ltr' : 'rtl'} lang={language}>
          {text}
        </p>
        {footer === undefined ? null : <div className="msg-phone__footer">{footer}</div>}
      </div>
    </div>
  );
}
