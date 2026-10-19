/**
 * The banner's statuses (docs/specs/modules/design-system.md §2.1 "Fields" and rule 2).
 *
 * Every status the banner can show (each allergy status, isolation, code status, every missing or
 * unavailable state, the approximate-DOB flag, "Identity incomplete", the error state and "Not translated")
 * is one entry of BANNER_STATUSES: its own text, its own icon shape and a tone. The tone picks the colour
 * pair from tokens.css; colour only repeats what text and shape already say, so within one field no two
 * statuses share a text or a shape (UnitTest:colour-not-only-carrier).
 *
 * A status whose text is data (the allergy count, the code-status label, the isolation precautions) has no
 * message of its own: the banner passes the text as children.
 */
import type { MessageKey } from '@hms/i18n';
import type { ReactNode } from 'react';
import { Message } from '../message/message.tsx';
import { StatusIcon, type IconShape } from './status-icon.tsx';

/** The colour pair of a status: the neutral text on the raised surface, or a status role of tokens.css. */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'danger';

/** The banner field a status belongs to. */
export type BannerStatusField =
  | 'banner'
  | 'photo'
  | 'name.ckb'
  | 'name.ar'
  | 'name.latin'
  | 'identity'
  | 'mrn'
  | 'dob'
  | 'allergies'
  | 'codeStatus'
  | 'isolation'
  | 'weight'
  | 'label';

export interface BannerStatusSpec {
  readonly field: BannerStatusField;
  /** The status text; absent when the text is data, passed as children. */
  readonly message?: MessageKey;
  readonly icon: IconShape;
  readonly tone: StatusTone;
}

export const BANNER_STATUSES = {
  // The banner's error state (rule 4).
  'banner.dataUnavailable': {
    field: 'banner',
    message: 'banner.dataUnavailable',
    icon: 'error',
    tone: 'danger',
  },
  'photo.missing': { field: 'photo', message: 'banner.photo.missing', icon: 'missing', tone: 'warning' },
  'name.ckb.missing': {
    field: 'name.ckb',
    message: 'banner.name.kurdishMissing',
    icon: 'missing',
    tone: 'warning',
  },
  'name.ar.missing': {
    field: 'name.ar',
    message: 'banner.name.arabicMissing',
    icon: 'missing',
    tone: 'warning',
  },
  'name.latin.missing': {
    field: 'name.latin',
    message: 'banner.name.latinMissing',
    icon: 'missing',
    tone: 'warning',
  },
  'identity.incomplete': {
    field: 'identity',
    message: 'banner.identity.incomplete',
    icon: 'identity-incomplete',
    tone: 'warning',
  },
  // A missing or invalid MRN puts the banner in its error state; the MRN's place says so too.
  'mrn.unavailable': { field: 'mrn', message: 'banner.dataUnavailable', icon: 'unavailable', tone: 'danger' },
  'dob.approximate': {
    field: 'dob',
    message: 'banner.dob.approximateFlag',
    icon: 'approximate',
    tone: 'warning',
  },
  'dob.missing': { field: 'dob', message: 'banner.dob.missing', icon: 'missing', tone: 'warning' },
  'dob.unavailable': {
    field: 'dob',
    message: 'banner.dob.unavailable',
    icon: 'unavailable',
    tone: 'warning',
  },
  'allergies.list': { field: 'allergies', icon: 'allergy', tone: 'danger' },
  'allergies.nka': { field: 'allergies', message: 'banner.allergies.nka', icon: 'none-known', tone: 'info' },
  'allergies.notAssessed': {
    field: 'allergies',
    message: 'banner.allergies.notAssessed',
    icon: 'not-assessed',
    tone: 'warning',
  },
  'allergies.unavailable': {
    field: 'allergies',
    message: 'banner.allergies.unavailable',
    icon: 'unavailable',
    tone: 'warning',
  },
  'codeStatus.documented': { field: 'codeStatus', icon: 'documented', tone: 'info' },
  'codeStatus.notDocumented': {
    field: 'codeStatus',
    message: 'banner.codeStatus.notDocumented',
    icon: 'none-recorded',
    tone: 'warning',
  },
  'codeStatus.unavailable': {
    field: 'codeStatus',
    message: 'banner.codeStatus.unavailable',
    icon: 'unavailable',
    tone: 'warning',
  },
  'isolation.active': { field: 'isolation', icon: 'isolation', tone: 'danger' },
  'isolation.noneRecorded': {
    field: 'isolation',
    message: 'banner.isolation.noneRecorded',
    icon: 'none-recorded',
    tone: 'neutral',
  },
  'isolation.unavailable': {
    field: 'isolation',
    message: 'banner.isolation.unavailable',
    icon: 'unavailable',
    tone: 'warning',
  },
  'weight.missing': {
    field: 'weight',
    message: 'banner.weight.missing',
    icon: 'none-recorded',
    tone: 'warning',
  },
  'weight.unavailable': {
    field: 'weight',
    message: 'banner.weight.unavailable',
    icon: 'unavailable',
    tone: 'warning',
  },
  'label.untranslated': {
    field: 'label',
    message: 'banner.label.untranslated',
    icon: 'untranslated',
    tone: 'info',
  },
} as const satisfies Record<string, BannerStatusSpec>;

export type BannerStatusId = keyof typeof BANNER_STATUSES;

export interface BannerStatusProps {
  readonly status: BannerStatusId;
  /** The text, for a status whose text is data; otherwise the status's own message is shown. */
  readonly children?: ReactNode;
}

/** One status: its icon and its text in one element, tinted by its tone. */
export function BannerStatus({ status, children }: BannerStatusProps): ReactNode {
  const spec: BannerStatusSpec = BANNER_STATUSES[status];
  const text = children ?? (spec.message === undefined ? undefined : <Message id={spec.message} />);
  return (
    <span className={`hms-banner-status hms-banner-status--${spec.tone}`} data-status={status}>
      <StatusIcon shape={spec.icon} />
      <span className="hms-banner-status__text">{text}</span>
    </span>
  );
}
