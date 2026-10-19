/**
 * The prototype's screens: id, address, navigation label (a catalogue key, so the side navigation, the
 * command palette and the document title share it), icon, and whether the screen is patient-scoped
 * (clinical: rendered inside the clinical layout with the real PatientBanner).
 */
import type { MessageKey } from '@hms/i18n';
import type { IconName } from '../ui/icons.tsx';

export const SCREEN_IDS = ['home', 'patients', 'outpatient', 'ward', 'chart', 'orders', 'emar', 'lab', 'billing', 'admin'] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export interface ScreenInfo {
  readonly id: ScreenId;
  /** The route path, without search parameters. */
  readonly path: string;
  readonly navKey: MessageKey;
  readonly icon: IconName;
  /** Patient-scoped: shows the PatientBanner and needs a patient in the window. */
  readonly clinical: boolean;
}

export const SCREENS: Readonly<Record<ScreenId, ScreenInfo>> = {
  home: { id: 'home', path: '/', navKey: 'proto.nav.home', icon: 'home', clinical: false },
  patients: { id: 'patients', path: '/patients', navKey: 'proto.nav.patients', icon: 'users', clinical: false },
  outpatient: { id: 'outpatient', path: '/outpatient', navKey: 'proto.nav.outpatient', icon: 'stethoscope', clinical: false },
  ward: { id: 'ward', path: '/ward', navKey: 'proto.nav.ward', icon: 'bed', clinical: false },
  chart: { id: 'chart', path: '/chart', navKey: 'proto.nav.chart', icon: 'chart', clinical: true },
  orders: { id: 'orders', path: '/orders', navKey: 'proto.nav.orders', icon: 'clipboard', clinical: true },
  emar: { id: 'emar', path: '/emar', navKey: 'proto.nav.emar', icon: 'pill', clinical: true },
  lab: { id: 'lab', path: '/lab', navKey: 'proto.nav.lab', icon: 'flask', clinical: true },
  billing: { id: 'billing', path: '/billing', navKey: 'proto.nav.billing', icon: 'receipt', clinical: true },
  admin: { id: 'admin', path: '/admin', navKey: 'proto.nav.admin', icon: 'settings', clinical: false },
};

/** Navigation groups, in order: the hospital-wide screens, the patient record, administration. */
export const NAV_GROUPS: readonly { readonly id: 'hospital' | 'record' | 'system'; readonly screens: readonly ScreenId[] }[] = [
  { id: 'hospital', screens: ['home', 'patients', 'outpatient', 'ward'] },
  { id: 'record', screens: ['chart', 'orders', 'emar', 'lab', 'billing'] },
  { id: 'system', screens: ['admin'] },
];

/** The screen whose path is `pathname`, if any. */
export function screenOfPath(pathname: string): ScreenInfo | undefined {
  const normalised = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return Object.values(SCREENS).find((screen) => screen.path === normalised);
}
