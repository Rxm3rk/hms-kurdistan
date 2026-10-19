/**
 * The prototype's screens: id, address, navigation label (a catalogue key, so the side navigation, the
 * command palette and the document title share it), icon, and whether the screen is patient-scoped
 * (clinical: rendered inside the clinical layout with the real PatientBanner).
 */
import type { MessageKey } from '@hms/i18n';
import type { IconName } from '../ui/icons.tsx';

export const SCREEN_IDS = ['home', 'patients', 'outpatient', 'ward', 'chart', 'orders', 'emar', 'lab', 'billing', 'admin', 'appointments', 'emergency', 'nursing', 'theatre', 'icu', 'maternity', 'labworklist', 'radiology', 'pharmacy', 'bloodbank', 'inventory', 'cashier', 'insurance', 'dashboard', 'quality', 'staff', 'reports', 'messaging'] as const;
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
  appointments: { id: 'appointments', path: '/appointments', navKey: 'proto.nav.appointments', icon: 'calendar', clinical: false },
  emergency: { id: 'emergency', path: '/emergency', navKey: 'proto.nav.emergency', icon: 'alert', clinical: false },
  nursing: { id: 'nursing', path: '/nursing', navKey: 'proto.nav.nursing', icon: 'thermometer', clinical: false },
  theatre: { id: 'theatre', path: '/theatre', navKey: 'proto.nav.theatre', icon: 'clock', clinical: false },
  icu: { id: 'icu', path: '/icu', navKey: 'proto.nav.icu', icon: 'heart', clinical: false },
  maternity: { id: 'maternity', path: '/maternity', navKey: 'proto.nav.maternity', icon: 'users', clinical: false },
  labworklist: { id: 'labworklist', path: '/lab-worklist', navKey: 'proto.nav.labworklist', icon: 'flask', clinical: false },
  radiology: { id: 'radiology', path: '/radiology', navKey: 'proto.nav.radiology', icon: 'scan', clinical: false },
  pharmacy: { id: 'pharmacy', path: '/pharmacy', navKey: 'proto.nav.pharmacy', icon: 'pill', clinical: false },
  bloodbank: { id: 'bloodbank', path: '/blood-bank', navKey: 'proto.nav.bloodbank', icon: 'droplet', clinical: false },
  inventory: { id: 'inventory', path: '/inventory', navKey: 'proto.nav.inventory', icon: 'building', clinical: false },
  cashier: { id: 'cashier', path: '/cashier', navKey: 'proto.nav.cashier', icon: 'money', clinical: false },
  insurance: { id: 'insurance', path: '/insurance', navKey: 'proto.nav.insurance', icon: 'shield', clinical: false },
  dashboard: { id: 'dashboard', path: '/dashboard', navKey: 'proto.nav.dashboard', icon: 'activity', clinical: false },
  quality: { id: 'quality', path: '/quality', navKey: 'proto.nav.quality', icon: 'check-circle', clinical: false },
  staff: { id: 'staff', path: '/staff', navKey: 'proto.nav.staff', icon: 'user', clinical: false },
  reports: { id: 'reports', path: '/reports', navKey: 'proto.nav.reports', icon: 'printer', clinical: false },
  messaging: { id: 'messaging', path: '/messaging', navKey: 'proto.nav.messaging', icon: 'phone', clinical: false },
  admin: { id: 'admin', path: '/admin', navKey: 'proto.nav.admin', icon: 'settings', clinical: false },
};

/** Navigation groups, in order: patient flow, clinical services, the patient record, finance, management, administration. */
export const NAV_GROUPS: readonly { readonly id: 'hospital' | 'services' | 'record' | 'finance' | 'management' | 'system'; readonly screens: readonly ScreenId[] }[] = [
  { id: 'hospital', screens: ['home', 'patients', 'appointments', 'outpatient', 'emergency', 'ward', 'nursing', 'theatre', 'icu', 'maternity'] },
  { id: 'services', screens: ['labworklist', 'radiology', 'pharmacy', 'bloodbank', 'inventory'] },
  { id: 'record', screens: ['chart', 'orders', 'emar', 'lab', 'billing'] },
  { id: 'finance', screens: ['cashier', 'insurance'] },
  { id: 'management', screens: ['dashboard', 'quality', 'staff', 'reports', 'messaging'] },
  { id: 'system', screens: ['admin'] },
];

/** The screen whose path is `pathname`, if any. */
export function screenOfPath(pathname: string): ScreenInfo | undefined {
  const normalised = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return Object.values(SCREENS).find((screen) => screen.path === normalised);
}
