/**
 * The prototype's routes.
 *
 * ```
 * __root__              the prototype frame (ProtoFrame)
 * ├── /                 home         hospital-wide
 * ├── /patients         patients     hospital-wide
 * ├── /outpatient       outpatient   hospital-wide
 * ├── /ward             ward         hospital-wide
 * ├── /admin            admin        hospital-wide
 * └── _clinical         the clinical layout: PatientBanner, patient context, chooser, sign host
 *     ├── /chart        chart
 *     ├── /orders       orders
 *     ├── /emar         emar
 *     ├── /lab          lab
 *     └── /billing      billing
 * ```
 *
 * An unknown address goes to home, keeping the locale and density.
 */
import {
  createRootRoute,
  createRoute,
  createRouter,
  useRouter,
  type AnyRoute,
  type RouteComponent,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { parseSearch, stringifySearch, useAppSearch } from '../../routing/search.ts';
import { AdminScreen } from '../screens/admin/index.tsx';
import { BillingScreen } from '../screens/billing/index.tsx';
import { ChartScreen } from '../screens/chart/index.tsx';
import { EmarScreen } from '../screens/emar/index.tsx';
import { HomeScreen } from '../screens/home/index.tsx';
import { LabScreen } from '../screens/lab/index.tsx';
import { OrdersScreen } from '../screens/orders/index.tsx';
import { OutpatientScreen } from '../screens/outpatient/index.tsx';
import { PatientsScreen } from '../screens/patients/index.tsx';
import { WardScreen } from '../screens/ward/index.tsx';
import { AppointmentsScreen } from '../screens/appointments/index.tsx';
import { EmergencyScreen } from '../screens/emergency/index.tsx';
import { NursingScreen } from '../screens/nursing/index.tsx';
import { TheatreScreen } from '../screens/theatre/index.tsx';
import { IcuScreen } from '../screens/icu/index.tsx';
import { MaternityScreen } from '../screens/maternity/index.tsx';
import { LabWorklistScreen } from '../screens/labworklist/index.tsx';
import { RadiologyScreen } from '../screens/radiology/index.tsx';
import { PharmacyScreen } from '../screens/pharmacy/index.tsx';
import { BloodBankScreen } from '../screens/bloodbank/index.tsx';
import { InventoryScreen } from '../screens/inventory/index.tsx';
import { CashierScreen } from '../screens/cashier/index.tsx';
import { InsuranceScreen } from '../screens/insurance/index.tsx';
import { DashboardScreen } from '../screens/dashboard/index.tsx';
import { QualityScreen } from '../screens/quality/index.tsx';
import { StaffScreen } from '../screens/staff/index.tsx';
import { ReportsScreen } from '../screens/reports/index.tsx';
import { MessagingScreen } from '../screens/messaging/index.tsx';
import { ProtoClinicalLayout } from './clinical-layout.tsx';
import { ProtoFrame } from './frame.tsx';
import { SCREENS, type ScreenId } from './screens.ts';

const COMPONENTS: Readonly<Record<ScreenId, RouteComponent>> = {
  home: HomeScreen,
  patients: PatientsScreen,
  outpatient: OutpatientScreen,
  ward: WardScreen,
  chart: ChartScreen,
  orders: OrdersScreen,
  emar: EmarScreen,
  lab: LabScreen,
  billing: BillingScreen,
  appointments: AppointmentsScreen,
  emergency: EmergencyScreen,
  nursing: NursingScreen,
  theatre: TheatreScreen,
  icu: IcuScreen,
  maternity: MaternityScreen,
  labworklist: LabWorklistScreen,
  radiology: RadiologyScreen,
  pharmacy: PharmacyScreen,
  bloodbank: BloodBankScreen,
  inventory: InventoryScreen,
  cashier: CashierScreen,
  insurance: InsuranceScreen,
  dashboard: DashboardScreen,
  quality: QualityScreen,
  staff: StaffScreen,
  reports: ReportsScreen,
  messaging: MessagingScreen,
  admin: AdminScreen,
};

function NotFound(): null {
  const router = useRouter();
  const { locale, density } = useAppSearch();
  const href = `/${stringifySearch({ locale, density })}`;
  useEffect(() => {
    void router.navigate({ href, replace: true });
  }, [router, href]);
  return null;
}

export function createProtoRouteTree(): AnyRoute {
  const root = createRootRoute({
    staticData: { clinical: false },
    component: ProtoFrame,
    notFoundComponent: NotFound,
  });
  const clinicalLayout = createRoute({
    getParentRoute: () => root,
    id: '_clinical',
    staticData: { clinical: true },
    component: ProtoClinicalLayout,
  });
  const hospitalRoutes: AnyRoute[] = [];
  const clinicalRoutes: AnyRoute[] = [];
  for (const screen of Object.values(SCREENS)) {
    if (screen.clinical) {
      clinicalRoutes.push(
        createRoute({
          getParentRoute: () => clinicalLayout,
          path: screen.path.slice(1),
          staticData: { clinical: true, titleKey: screen.navKey },
          component: COMPONENTS[screen.id],
        }),
      );
    } else {
      hospitalRoutes.push(
        createRoute({
          getParentRoute: () => root,
          path: screen.path,
          staticData: { clinical: false, titleKey: screen.navKey },
          component: COMPONENTS[screen.id],
        }),
      );
    }
  }
  return root.addChildren([...hospitalRoutes, clinicalLayout.addChildren(clinicalRoutes)]);
}

export function createProtoRouter() {
  return createRouter({
    routeTree: createProtoRouteTree(),
    parseSearch,
    stringifySearch,
  });
}

export type ProtoRouter = ReturnType<typeof createProtoRouter>;
