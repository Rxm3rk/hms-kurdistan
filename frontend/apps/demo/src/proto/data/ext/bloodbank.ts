/**
 * Blood bank: units by group and expiry, receipts from the public blood banks with relabelling, cross-match
 * requests, issue, bedside two-person checks and transfusion reactions (haemovigilance).
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Unit numbers follow an invented ISBT-like pattern.
 */
import { daysAgoAt, demoDate, todayAt } from '../clock.ts';
import type { BloodGroup, OrderPriority, Text3 } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export type Component = 'RBC' | 'FFP' | 'PLT' | 'CRYO';
export type UnitStatus = 'quarantine' | 'available' | 'crossmatched' | 'issued' | 'transfusing' | 'transfused' | 'expired' | 'discarded';

export interface BloodSource {
  readonly id: string;
  readonly name: Text3;
}

export const BLOOD_SOURCES: readonly BloodSource[] = [
  { id: 'SRC-EBL', name: T('Erbil Central Blood Bank (public)', 'بانکی خوێنی ناوەندیی هەولێر (گشتی)', 'مصرف الدم المركزي في أربيل (حكومي)') },
  { id: 'SRC-SUL', name: T('Sulaymaniyah Blood Bank (public)', 'بانکی خوێنی سلێمانی (گشتی)', 'مصرف دم السليمانية (حكومي)') },
  { id: 'SRC-DHK', name: T('Duhok Blood Bank (public)', 'بانکی خوێنی دهۆک (گشتی)', 'مصرف دم دهوك (حكومي)') },
  { id: 'SRC-HOS', name: T('Hospital donor session', 'بەخشینی ناو نەخۆشخانە', 'جلسة تبرع في المستشفى') },
];

export interface BloodUnit {
  /** Hospital unit number after relabelling. */
  readonly id: string;
  /** The public blood bank's own number. */
  readonly sourceNumber: string;
  readonly sourceId: string;
  readonly component: Component;
  readonly group: BloodGroup;
  readonly volumeMl: number;
  readonly collectedOn: string;
  readonly expiresOn: string;
  readonly status: UnitStatus;
  /** Cross-matched or issued to. */
  readonly patientId: string | null;
  readonly irradiated: boolean;
  readonly leucodepleted: boolean;
}

function unit(
  n: number,
  component: Component,
  group: BloodGroup,
  sourceId: string,
  collectedDaysAgo: number,
  expiresInDays: number,
  status: UnitStatus,
  patientId: string | null = null,
): BloodUnit {
  const volume = component === 'RBC' ? 280 : component === 'FFP' ? 220 : component === 'PLT' ? 250 : 40;
  return {
    id: `SYN-BU-26-${String(n).padStart(5, '0')}`,
    sourceNumber: `${sourceId.slice(4)}-${String(7_100_000 + n * 37)}`,
    sourceId,
    component,
    group,
    volumeMl: volume,
    collectedOn: demoDate(collectedDaysAgo),
    expiresOn: demoDate(-expiresInDays),
    status,
    patientId,
    irradiated: n % 9 === 0,
    leucodepleted: component !== 'CRYO',
  };
}

export const BLOOD_UNITS: readonly BloodUnit[] = [
  unit(101, 'RBC', 'O+', 'SRC-EBL', 12, 23, 'available'),
  unit(102, 'RBC', 'O+', 'SRC-EBL', 30, 5, 'available'),
  unit(103, 'RBC', 'O+', 'SRC-SUL', 33, 2, 'available'),
  unit(104, 'RBC', 'O-', 'SRC-EBL', 8, 27, 'available'),
  unit(105, 'RBC', 'O-', 'SRC-DHK', 34, 1, 'available'),
  unit(106, 'RBC', 'A+', 'SRC-EBL', 10, 25, 'crossmatched', 'SYN-PAT-0102'),
  unit(107, 'RBC', 'A+', 'SRC-EBL', 10, 25, 'crossmatched', 'SYN-PAT-0102'),
  unit(108, 'RBC', 'A+', 'SRC-SUL', 18, 17, 'available'),
  unit(109, 'RBC', 'A-', 'SRC-SUL', 20, 15, 'issued', 'SYN-PAT-0108'),
  unit(110, 'RBC', 'B+', 'SRC-DHK', 6, 29, 'available'),
  unit(111, 'RBC', 'B+', 'SRC-DHK', 25, 10, 'available'),
  unit(112, 'RBC', 'B-', 'SRC-EBL', 15, 20, 'crossmatched', 'SYN-PAT-0106'),
  unit(113, 'RBC', 'AB+', 'SRC-HOS', 4, 31, 'available'),
  unit(114, 'RBC', 'O+', 'SRC-HOS', 3, 32, 'quarantine'),
  unit(115, 'RBC', 'O+', 'SRC-EBL', 36, -1, 'expired'),
  unit(116, 'RBC', 'O-', 'SRC-EBL', 22, 13, 'transfusing', 'SYN-PAT-0109'),
  unit(201, 'FFP', 'A+', 'SRC-EBL', 60, 300, 'available'),
  unit(202, 'FFP', 'O+', 'SRC-EBL', 45, 315, 'available'),
  unit(203, 'FFP', 'AB+', 'SRC-SUL', 90, 270, 'available'),
  unit(204, 'FFP', 'A+', 'SRC-DHK', 70, 290, 'issued', 'SYN-PAT-0109'),
  unit(301, 'PLT', 'O+', 'SRC-EBL', 2, 3, 'available'),
  unit(302, 'PLT', 'A+', 'SRC-EBL', 4, 1, 'available'),
  unit(303, 'PLT', 'A+', 'SRC-SUL', 3, 2, 'crossmatched', 'SYN-PAT-0229'),
  unit(401, 'CRYO', 'A+', 'SRC-EBL', 40, 320, 'available'),
  unit(402, 'CRYO', 'O+', 'SRC-EBL', 40, 320, 'available'),
];

/** Minimum stock per group for red cells (units). */
export const RBC_MINIMUM: Readonly<Record<BloodGroup, number>> = { 'O+': 6, 'O-': 4, 'A+': 4, 'A-': 2, 'B+': 3, 'B-': 1, 'AB+': 1, 'AB-': 1 };

export const BLOOD_GROUPS: readonly BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export const COMPONENTS: readonly Component[] = ['RBC', 'FFP', 'PLT', 'CRYO'];

/** Red-cell compatibility: recipient group to the donor groups they may receive. */
export const RBC_COMPATIBLE: Readonly<Record<BloodGroup, readonly BloodGroup[]>> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

// ---------------------------------------------------------------------------------------------------------
// Receipts from public blood banks
// ---------------------------------------------------------------------------------------------------------

export interface Shipment {
  readonly id: string;
  readonly sourceId: string;
  readonly receivedIso: string;
  readonly units: readonly { readonly sourceNumber: string; readonly component: Component; readonly group: BloodGroup; readonly expiresOn: string }[];
  /** Temperature on arrival, °C, as a decimal string. */
  readonly arrivalTempC: string;
  readonly status: 'awaiting-relabel' | 'relabelled' | 'rejected';
  readonly courier: Text3;
}

export const SHIPMENTS: readonly Shipment[] = [
  {
    id: 'SHP-26-0331',
    sourceId: 'SRC-EBL',
    receivedIso: todayAt('08:20'),
    units: [
      { sourceNumber: 'EBL-7210331', component: 'RBC', group: 'O+', expiresOn: demoDate(-34) },
      { sourceNumber: 'EBL-7210332', component: 'RBC', group: 'O+', expiresOn: demoDate(-34) },
      { sourceNumber: 'EBL-7210340', component: 'RBC', group: 'O-', expiresOn: demoDate(-33) },
      { sourceNumber: 'EBL-7210356', component: 'RBC', group: 'A+', expiresOn: demoDate(-33) },
      { sourceNumber: 'EBL-7210371', component: 'FFP', group: 'AB+', expiresOn: demoDate(-360) },
    ],
    arrivalTempC: '4.2',
    status: 'awaiting-relabel',
    courier: T('Hospital van, driver Hiwa', 'ئۆتۆمبێلی نەخۆشخانە، شۆفێر هیوا', 'سيارة المستشفى، السائق هيوا'),
  },
  {
    id: 'SHP-26-0330',
    sourceId: 'SRC-SUL',
    receivedIso: daysAgoAt(1, '15:40'),
    units: [
      { sourceNumber: 'SUL-5518810', component: 'PLT', group: 'B+', expiresOn: demoDate(-2) },
      { sourceNumber: 'SUL-5518811', component: 'RBC', group: 'B+', expiresOn: demoDate(-31) },
    ],
    arrivalTempC: '5.1',
    status: 'relabelled',
    courier: T('MOH cold-chain courier', 'گەیاندنی زنجیرەی سارد', 'ناقل سلسلة التبريد'),
  },
  {
    id: 'SHP-26-0329',
    sourceId: 'SRC-DHK',
    receivedIso: daysAgoAt(2, '11:05'),
    units: [{ sourceNumber: 'DHK-3301207', component: 'RBC', group: 'B+', expiresOn: demoDate(-29) }],
    arrivalTempC: '11.8',
    status: 'rejected',
    courier: T('Private taxi (not approved)', 'تاکسیی تایبەت (ڕێپێنەدراو)', 'سيارة أجرة خاصة (غير معتمدة)'),
  },
];

// ---------------------------------------------------------------------------------------------------------
// Cross-match requests
// ---------------------------------------------------------------------------------------------------------

export type XmStatus = 'sample-awaited' | 'grouping' | 'crossmatching' | 'ready' | 'issued' | 'problem';

export interface XmRequest {
  readonly id: string;
  readonly patientId: string;
  readonly component: Component;
  readonly units: number;
  readonly priority: OrderPriority;
  readonly indication: Text3;
  readonly requestedById: string;
  readonly requestedIso: string;
  readonly requiredBy: string;
  readonly status: XmStatus;
  readonly sampleId: string | null;
  readonly antibodyScreen: 'negative' | 'positive' | 'pending';
  readonly unitIds: readonly string[];
  readonly hb: string | null;
}

export const XM_REQUESTS: readonly XmRequest[] = [
  {
    id: 'XM-26-1201', patientId: 'SYN-PAT-0102', component: 'RBC', units: 2, priority: 'urgent',
    indication: T('Symptomatic anaemia, Hb 6.9 g/dL', 'کەمخوێنیی نیشانەدار، Hb 6.9', 'فقر دم عرضي، Hb 6.9'),
    requestedById: 'SYN-STF-005', requestedIso: todayAt('07:20'), requiredBy: todayAt('11:00'), status: 'ready', sampleId: 'SYN-SPC-26G101', antibodyScreen: 'negative',
    unitIds: ['SYN-BU-26-00106', 'SYN-BU-26-00107'], hb: '6.9',
  },
  {
    id: 'XM-26-1202', patientId: 'SYN-PAT-0109', component: 'RBC', units: 1, priority: 'stat',
    indication: T('Septic shock, active bleeding from line site', 'شۆکی سێپتیک، خوێنبەربوون', 'صدمة إنتانية، نزف فعال'),
    requestedById: 'SYN-STF-007', requestedIso: todayAt('08:30'), requiredBy: todayAt('09:00'), status: 'issued', sampleId: 'SYN-SPC-26G102', antibodyScreen: 'negative',
    unitIds: ['SYN-BU-26-00116'], hb: '7.4',
  },
  {
    id: 'XM-26-1203', patientId: 'SYN-PAT-0106', component: 'RBC', units: 2, priority: 'routine',
    indication: T('Group and save for theatre tomorrow (laparotomy)', 'گروپ و هەڵگرتن بۆ نەشتەرگەریی سبەی', 'تحديد الزمرة والحفظ لعملية الغد'),
    requestedById: 'SYN-STF-008', requestedIso: todayAt('06:50'), requiredBy: `${demoDate(-1)}T08:00:00+03:00`, status: 'crossmatching', sampleId: 'SYN-SPC-26G103', antibodyScreen: 'negative',
    unitIds: ['SYN-BU-26-00112'], hb: '10.8',
  },
  {
    id: 'XM-26-1204', patientId: 'SYN-PAT-0229', component: 'PLT', units: 1, priority: 'urgent',
    indication: T('Platelets 18 ×10⁹/L before central line', 'پلاکێت 18 پێش هێڵی ناوەندی', 'صفيحات 18 قبل الخط المركزي'),
    requestedById: 'SYN-STF-007', requestedIso: todayAt('08:55'), requiredBy: todayAt('10:30'), status: 'ready', sampleId: 'SYN-SPC-26G104', antibodyScreen: 'negative',
    unitIds: ['SYN-BU-26-00303'], hb: null,
  },
  {
    id: 'XM-26-1205', patientId: 'SYN-PAT-0110', component: 'RBC', units: 2, priority: 'urgent',
    indication: T('Possible thrombolysis; group and save', 'لەوانەیە تێکشکاندنی تەڵە؛ گروپ و هەڵگرتن', 'احتمال إذابة خثرة؛ تحديد الزمرة والحفظ'),
    requestedById: 'SYN-STF-016', requestedIso: todayAt('09:12'), requiredBy: todayAt('10:00'), status: 'sample-awaited', sampleId: null, antibodyScreen: 'pending',
    unitIds: [], hb: null,
  },
  {
    id: 'XM-26-1206', patientId: 'SYN-PAT-0214', component: 'RBC', units: 2, priority: 'routine',
    indication: T('Post-operative Hb 7.8 g/dL', 'Hb دوای نەشتەرگەری 7.8', 'Hb بعد الجراحة 7.8'),
    requestedById: 'SYN-STF-008', requestedIso: todayAt('07:45'), requiredBy: todayAt('14:00'), status: 'problem', sampleId: 'SYN-SPC-26G105', antibodyScreen: 'positive',
    unitIds: [], hb: '7.8',
  },
  {
    id: 'XM-26-1207', patientId: 'SYN-PAT-0221', component: 'RBC', units: 1, priority: 'routine',
    indication: T('Paediatric: sickle cell crisis, Hb 6.2', 'منداڵ: قەیرانی سیکڵ سێڵ، Hb 6.2', 'طفل: نوبة فقر الدم المنجلي، Hb 6.2'),
    requestedById: 'SYN-STF-006', requestedIso: todayAt('08:10'), requiredBy: todayAt('12:00'), status: 'grouping', sampleId: 'SYN-SPC-26G106', antibodyScreen: 'pending',
    unitIds: [], hb: '6.2',
  },
  {
    id: 'XM-26-1208', patientId: 'SYN-PAT-0108', component: 'RBC', units: 1, priority: 'routine',
    indication: T('Chronic kidney disease, Hb 7.1', 'نەخۆشیی درێژخایەنی گورچیلە، Hb 7.1', 'مرض كلوي مزمن، Hb 7.1'),
    requestedById: 'SYN-STF-016', requestedIso: daysAgoAt(0, '06:30'), requiredBy: todayAt('10:00'), status: 'issued', sampleId: 'SYN-SPC-26G107', antibodyScreen: 'negative',
    unitIds: ['SYN-BU-26-00109'], hb: '7.1',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Transfusion reactions (haemovigilance)
// ---------------------------------------------------------------------------------------------------------

export type ReactionType = 'febrile' | 'allergic' | 'taco' | 'trali' | 'haemolytic';
export type ReactionSeverity = 'mild' | 'moderate' | 'severe';
export type ReactionStatus = 'investigating' | 'reported' | 'closed';

export interface Reaction {
  readonly id: string;
  readonly patientId: string;
  readonly unitId: string;
  readonly onsetIso: string;
  readonly type: ReactionType;
  readonly severity: ReactionSeverity;
  readonly signs: Text3;
  readonly action: Text3;
  readonly status: ReactionStatus;
  readonly reportedById: string;
}

export const REACTIONS: readonly Reaction[] = [
  {
    id: 'HV-26-041', patientId: 'SYN-PAT-0213', unitId: 'SYN-BU-26-00087', onsetIso: daysAgoAt(2, '16:30'), type: 'febrile', severity: 'mild',
    signs: T('Temperature 38.4 °C at 40 minutes, rigors', 'پلەی گەرمی 38.4 لە 40 خولەکدا، لەرزین', 'حرارة 38.4 بعد 40 دقيقة، قشعريرة'),
    action: T('Stopped, paracetamol, cultures sent; resumed with a new unit', 'ڕاگیرا، پاراسیتامۆل، چاندن نێردرا', 'أوقف، باراسيتامول، أرسلت مزارع'),
    status: 'reported', reportedById: 'SYN-STF-009',
  },
  {
    id: 'HV-26-042', patientId: 'SYN-PAT-0205', unitId: 'SYN-BU-26-00093', onsetIso: daysAgoAt(1, '20:15'), type: 'allergic', severity: 'moderate',
    signs: T('Urticaria and itching, no wheeze', 'خورشت و گەزگەز، بێ فیکەی سنگ', 'شرى وحكة، بلا أزيز'),
    action: T('Stopped, chlorphenamine IV; observation 2 h', 'ڕاگیرا، chlorphenamine ناو دەمار؛ چاودێری 2 کاتژمێر', 'أوقف، كلورفينامين وريدي؛ مراقبة ساعتين'),
    status: 'investigating', reportedById: 'SYN-STF-019',
  },
  {
    id: 'HV-26-039', patientId: 'SYN-PAT-0230', unitId: 'SYN-BU-26-00071', onsetIso: daysAgoAt(9, '03:10'), type: 'taco', severity: 'severe',
    signs: T('Breathlessness, SpO₂ 86%, raised JVP after the second unit', 'هەناسەتەنگی، SpO₂ 86%', 'ضيق نفس، تشبع 86%'),
    action: T('Stopped, furosemide IV, oxygen; ICU review', 'ڕاگیرا، furosemide، ئۆکسجین؛ پشکنینی ICU', 'أوقف، فوروسيميد، أكسجين؛ مراجعة العناية'),
    status: 'closed', reportedById: 'SYN-STF-015',
  },
];

/** Bedside check items: each must be confirmed by both nurses. */
export const BEDSIDE_CHECKS = ['chkIdentity', 'chkWristband', 'chkUnitNumber', 'chkGroup', 'chkExpiry', 'chkBag', 'chkConsent', 'chkObs'] as const;
export type BedsideCheck = (typeof BEDSIDE_CHECKS)[number];
