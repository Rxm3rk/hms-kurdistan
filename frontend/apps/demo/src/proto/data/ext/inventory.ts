/**
 * Stores and supplies: the main store and its sub-stores, stock by batch with expiry (first-expiry,
 * first-out), ward requisitions, purchase orders (procurement-lite) and the consumption-to-charge leakage
 * view. SYNTHETIC DATA ONLY. Supplier names are invented; product and drug names are Latin script.
 */
import { daysAgoAt, demoDate, todayAt } from '../clock.ts';
import type { Currency, Text3 } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export interface Store {
  readonly id: string;
  readonly name: Text3;
  readonly parentId: string | null;
  readonly keeper: Text3;
}

export const STORES: readonly Store[] = [
  { id: 'ST-MAIN', name: T('Main store', 'کۆگای سەرەکی', 'المخزن الرئيسي'), parentId: null, keeper: T('Basement, block C', 'ژێرزەمین، بلۆکی C', 'الطابق السفلي، المبنى C') },
  { id: 'ST-PHARM', name: T('Pharmacy store', 'کۆگای دەرمانخانە', 'مخزن الصيدلية'), parentId: 'ST-MAIN', keeper: T('Ground floor', 'نهۆمی خوارەوە', 'الطابق الأرضي') },
  { id: 'ST-OT', name: T('Theatre sub-store', 'کۆگای لاوەکیی نەشتەرگەری', 'مخزن العمليات الفرعي'), parentId: 'ST-MAIN', keeper: T('Floor 2', 'نهۆمی 2', 'الطابق 2') },
  { id: 'ST-ICU', name: T('ICU sub-store', 'کۆگای لاوەکیی ICU', 'مخزن العناية الفرعي'), parentId: 'ST-MAIN', keeper: T('Floor 3', 'نهۆمی 3', 'الطابق 3') },
  { id: 'ST-WA', name: T('Medical Ward A sub-store', 'کۆگای لاوەکیی قاوشی A', 'مخزن ردهة الباطنية A'), parentId: 'ST-MAIN', keeper: T('Floor 1', 'نهۆمی 1', 'الطابق 1') },
  { id: 'ST-WB', name: T('Surgical Ward B sub-store', 'کۆگای لاوەکیی قاوشی B', 'مخزن ردهة الجراحة B'), parentId: 'ST-MAIN', keeper: T('Floor 1', 'نهۆمی 1', 'الطابق 1') },
  { id: 'ST-LAB', name: T('Laboratory store', 'کۆگای تاقیگە', 'مخزن المختبر'), parentId: 'ST-MAIN', keeper: T('Floor 1, lab wing', 'نهۆمی 1، باڵی تاقیگە', 'الطابق 1، جناح المختبر') },
];

export type ItemCategory = 'consumable' | 'drug' | 'iv-fluid' | 'surgical' | 'reagent' | 'linen';

export interface Batch {
  readonly batch: string;
  readonly expiresOn: string | null;
  readonly qty: number;
}

export interface StockItem {
  readonly code: string;
  /** Latin product name. */
  readonly name: string;
  readonly category: ItemCategory;
  readonly unit: string;
  readonly storeId: string;
  readonly batches: readonly Batch[];
  readonly reorderLevel: number;
  readonly unitCostIqd: number;
  /** Charged to the patient when used. */
  readonly chargeable: boolean;
}

function item(code: string, name: string, category: ItemCategory, unit: string, storeId: string, reorderLevel: number, unitCostIqd: number, chargeable: boolean, batches: readonly [string, number | null, number][]): StockItem {
  return {
    code,
    name,
    category,
    unit,
    storeId,
    reorderLevel,
    unitCostIqd,
    chargeable,
    batches: batches.map(([batch, daysToExpiry, qty]) => ({ batch, expiresOn: daysToExpiry === null ? null : demoDate(-daysToExpiry), qty })),
  };
}

export const STOCK: readonly StockItem[] = [
  item('SUP-0101', 'Nitrile examination gloves, M', 'consumable', 'box of 100', 'ST-MAIN', 80, 7500, false, [['NG-2611', 540, 210], ['NG-2603', 300, 45]]),
  item('SUP-0102', 'IV cannula 20G (pink)', 'consumable', 'piece', 'ST-MAIN', 400, 650, true, [['CN-2588', 61, 180], ['CN-2620', 720, 900]]),
  item('SUP-0103', 'IV cannula 22G (blue)', 'consumable', 'piece', 'ST-WA', 150, 650, true, [['CN-2590', 75, 96]]),
  item('SUP-0104', 'Syringe 5 mL, Luer lock', 'consumable', 'piece', 'ST-MAIN', 1000, 150, true, [['SY-2601', 900, 3400]]),
  item('SUP-0105', 'Urinary catheter, Foley 16 Fr', 'consumable', 'piece', 'ST-WB', 30, 2750, true, [['FC-2540', 22, 14], ['FC-2610', 410, 40]]),
  item('SUP-0106', 'Surgical mask, 3-ply', 'consumable', 'box of 50', 'ST-MAIN', 60, 4000, false, [['SM-2622', 680, 34]]),
  item('IVF-0201', 'Sodium chloride 0.9% 1000 mL', 'iv-fluid', 'bag', 'ST-MAIN', 300, 2250, true, [['NS-2551', 85, 220], ['NS-2609', 400, 600]]),
  item('IVF-0202', "Ringer's lactate 1000 mL", 'iv-fluid', 'bag', 'ST-MAIN', 200, 2500, true, [['RL-2560', 40, 120], ['RL-2612', 380, 300]]),
  item('IVF-0203', 'Glucose 5% 500 mL', 'iv-fluid', 'bag', 'ST-WA', 60, 1750, true, [['DW-2549', 18, 24], ['DW-2611', 360, 70]]),
  item('DRG-0301', 'ceftriaxone 1 g vial', 'drug', 'vial', 'ST-PHARM', 200, 3000, true, [['CF-2557', 45, 60], ['CF-2618', 500, 340]]),
  item('DRG-0302', 'paracetamol 1 g/100 mL infusion', 'drug', 'bottle', 'ST-PHARM', 150, 3500, true, [['PI-2542', 12, 30], ['PI-2601', 290, 210]]),
  item('DRG-0303', 'enoxaparin 40 mg/0.4 mL syringe', 'drug', 'syringe', 'ST-PHARM', 120, 6500, true, [['EN-2580', 130, 95]]),
  item('DRG-0304', 'omeprazole 40 mg vial', 'drug', 'vial', 'ST-PHARM', 100, 4500, true, [['OM-2520', -3, 12], ['OM-2604', 410, 180]]),
  item('DRG-0305', 'insulin glargine 100 U/mL pen', 'drug', 'pen', 'ST-PHARM', 40, 10400, true, [['IG-2577', 70, 22]]),
  item('SRG-0401', 'Suture polyglactin 2-0, 70 cm', 'surgical', 'pack of 12', 'ST-OT', 20, 54000, true, [['PG-2533', 160, 8]]),
  item('SRG-0402', 'Sterile surgical gown, L', 'surgical', 'piece', 'ST-OT', 100, 5500, true, [['GW-2598', 720, 260]]),
  item('SRG-0403', 'Laparotomy sponge 45×45 cm', 'surgical', 'pack of 5', 'ST-OT', 60, 6000, true, [['LS-2590', 500, 44]]),
  item('SRG-0404', 'Chlorhexidine 2% skin prep 250 mL', 'surgical', 'bottle', 'ST-OT', 40, 4800, false, [['CH-2551', 26, 18], ['CH-2615', 600, 30]]),
  item('ICU-0501', 'Central venous catheter kit, triple lumen', 'consumable', 'kit', 'ST-ICU', 10, 68000, true, [['CV-2573', 240, 6]]),
  item('ICU-0502', 'Closed suction catheter 14 Fr', 'consumable', 'piece', 'ST-ICU', 30, 9500, true, [['CS-2580', 330, 41]]),
  item('ICU-0503', 'Arterial blood gas syringe', 'consumable', 'piece', 'ST-ICU', 60, 3200, true, [['AB-2547', 9, 25], ['AB-2618', 360, 80]]),
  item('LAB-0601', 'EDTA tube 3 mL (lavender)', 'reagent', 'rack of 100', 'ST-LAB', 20, 18000, false, [['ED-2562', 95, 14]]),
  item('LAB-0602', 'Creatinine reagent cassette (c 311)', 'reagent', 'cassette', 'ST-LAB', 4, 245000, false, [['CR-2588', 52, 1]]),
  item('LAB-0603', 'Blood culture bottle, aerobic', 'reagent', 'bottle', 'ST-LAB', 50, 7800, true, [['BC-2559', 33, 36]]),
  item('LIN-0701', 'Disposable bed sheet', 'linen', 'piece', 'ST-MAIN', 200, 1250, true, [['DS-2600', null, 160]]),
];

export const CATEGORY_LABEL: Readonly<Record<ItemCategory, Text3>> = {
  consumable: T('Consumable', 'کەرەستەی بەکاربردن', 'مستهلكات'),
  drug: T('Medicine', 'دەرمان', 'دواء'),
  'iv-fluid': T('IV fluid', 'شلەی ناو دەمار', 'سوائل وريدية'),
  surgical: T('Surgical', 'نەشتەرگەری', 'جراحي'),
  reagent: T('Lab reagent', 'ڕیئەجێنتی تاقیگە', 'كاشف مختبر'),
  linen: T('Linen', 'ڕاخەر', 'بياضات'),
};

// ---------------------------------------------------------------------------------------------------------
// Ward requisitions
// ---------------------------------------------------------------------------------------------------------

export type RequisitionStatus = 'submitted' | 'approved' | 'picking' | 'issued' | 'rejected';

export interface Requisition {
  readonly id: string;
  readonly fromStoreId: string;
  readonly requestedById: string;
  readonly requestedIso: string;
  readonly urgent: boolean;
  readonly status: RequisitionStatus;
  readonly lines: readonly { readonly code: string; readonly qty: number }[];
}

export const REQUISITIONS: readonly Requisition[] = [
  { id: 'REQ-26-2210', fromStoreId: 'ST-ICU', requestedById: 'SYN-STF-015', requestedIso: todayAt('08:40'), urgent: true, status: 'submitted', lines: [{ code: 'ICU-0501', qty: 4 }, { code: 'ICU-0503', qty: 40 }, { code: 'IVF-0202', qty: 40 }] },
  { id: 'REQ-26-2209', fromStoreId: 'ST-WA', requestedById: 'SYN-STF-010', requestedIso: todayAt('07:55'), urgent: false, status: 'submitted', lines: [{ code: 'SUP-0103', qty: 100 }, { code: 'IVF-0201', qty: 60 }, { code: 'SUP-0101', qty: 10 }] },
  { id: 'REQ-26-2208', fromStoreId: 'ST-OT', requestedById: 'SYN-STF-009', requestedIso: todayAt('07:30'), urgent: false, status: 'approved', lines: [{ code: 'SRG-0401', qty: 6 }, { code: 'SRG-0403', qty: 20 }] },
  { id: 'REQ-26-2207', fromStoreId: 'ST-WB', requestedById: 'SYN-STF-009', requestedIso: daysAgoAt(1, '16:20'), urgent: false, status: 'picking', lines: [{ code: 'SUP-0105', qty: 10 }, { code: 'SUP-0102', qty: 80 }] },
  { id: 'REQ-26-2206', fromStoreId: 'ST-LAB', requestedById: 'SYN-STF-011', requestedIso: daysAgoAt(1, '11:05'), urgent: true, status: 'issued', lines: [{ code: 'LAB-0601', qty: 6 }] },
  { id: 'REQ-26-2205', fromStoreId: 'ST-WA', requestedById: 'SYN-STF-019', requestedIso: daysAgoAt(1, '22:10'), urgent: false, status: 'rejected', lines: [{ code: 'SUP-0106', qty: 40 }] },
  { id: 'REQ-26-2204', fromStoreId: 'ST-PHARM', requestedById: 'SYN-STF-012', requestedIso: daysAgoAt(2, '09:30'), urgent: false, status: 'issued', lines: [{ code: 'DRG-0301', qty: 200 }, { code: 'DRG-0303', qty: 60 }] },
  { id: 'REQ-26-2211', fromStoreId: 'ST-ICU', requestedById: 'SYN-STF-015', requestedIso: todayAt('09:20'), urgent: false, status: 'submitted', lines: [{ code: 'ICU-0502', qty: 20 }] },
];

// ---------------------------------------------------------------------------------------------------------
// Suppliers and purchase orders
// ---------------------------------------------------------------------------------------------------------

export interface Supplier {
  readonly id: string;
  readonly name: string;
  readonly city: Text3;
  readonly currency: Currency;
}

export const SUPPLIERS: readonly Supplier[] = [
  { id: 'SUPL-01', name: 'Zagros Medical Supplies (synthetic)', city: T('Erbil', 'هەولێر', 'أربيل'), currency: 'IQD' },
  { id: 'SUPL-02', name: 'Nishtiman Pharma Trading (synthetic)', city: T('Sulaymaniyah', 'سلێمانی', 'السليمانية'), currency: 'USD' },
  { id: 'SUPL-03', name: 'Gali Zakho Medical (synthetic)', city: T('Duhok', 'دهۆک', 'دهوك'), currency: 'IQD' },
  { id: 'SUPL-04', name: 'Hawler Diagnostics (synthetic)', city: T('Erbil', 'هەولێر', 'أربيل'), currency: 'USD' },
];

export type PoStatus = 'draft' | 'awaiting-approval' | 'sent' | 'partially-received' | 'received';

export interface PurchaseOrder {
  readonly id: string;
  readonly supplierId: string;
  readonly createdIso: string;
  readonly expectedOn: string;
  readonly status: PoStatus;
  readonly lines: readonly { readonly code: string; readonly qty: number; readonly unitPrice: number }[];
  readonly currency: Currency;
  readonly createdBy: string;
}

export const PURCHASE_ORDERS: readonly PurchaseOrder[] = [
  { id: 'PO-26-0918', supplierId: 'SUPL-04', createdIso: todayAt('08:05'), expectedOn: demoDate(-3), status: 'awaiting-approval', currency: 'USD', createdBy: 'SYN-STF-004', lines: [{ code: 'LAB-0602', qty: 6, unitPrice: 187 }, { code: 'LAB-0603', qty: 100, unitPrice: 6 }] },
  { id: 'PO-26-0917', supplierId: 'SUPL-01', createdIso: daysAgoAt(1, '13:30'), expectedOn: demoDate(-2), status: 'awaiting-approval', currency: 'IQD', createdBy: 'SYN-STF-004', lines: [{ code: 'SUP-0101', qty: 120, unitPrice: 7200 }, { code: 'SUP-0106', qty: 80, unitPrice: 3800 }] },
  { id: 'PO-26-0916', supplierId: 'SUPL-02', createdIso: daysAgoAt(2, '10:00'), expectedOn: demoDate(-5), status: 'sent', currency: 'USD', createdBy: 'SYN-STF-012', lines: [{ code: 'DRG-0305', qty: 60, unitPrice: 7.9 }, { code: 'DRG-0303', qty: 200, unitPrice: 4.8 }] },
  { id: 'PO-26-0915', supplierId: 'SUPL-03', createdIso: daysAgoAt(4, '09:15'), expectedOn: demoDate(1), status: 'partially-received', currency: 'IQD', createdBy: 'SYN-STF-004', lines: [{ code: 'IVF-0201', qty: 1200, unitPrice: 2150 }, { code: 'IVF-0202', qty: 600, unitPrice: 2400 }] },
  { id: 'PO-26-0914', supplierId: 'SUPL-01', createdIso: daysAgoAt(6, '12:00'), expectedOn: demoDate(3), status: 'received', currency: 'IQD', createdBy: 'SYN-STF-004', lines: [{ code: 'SRG-0402', qty: 300, unitPrice: 5300 }] },
  { id: 'PO-26-0919', supplierId: 'SUPL-03', createdIso: todayAt('09:10'), expectedOn: demoDate(-7), status: 'draft', currency: 'IQD', createdBy: 'SYN-STF-004', lines: [{ code: 'ICU-0501', qty: 20, unitPrice: 66000 }] },
];

// ---------------------------------------------------------------------------------------------------------
// Consumption-to-charge leakage (this month)
// ---------------------------------------------------------------------------------------------------------

export interface LeakageRow {
  readonly storeId: string;
  /** Chargeable items issued and recorded as used, IQD. */
  readonly consumedIqd: number;
  /** The same items found on patient bills, IQD. */
  readonly chargedIqd: number;
  readonly topItems: readonly { readonly code: string; readonly unbilledQty: number }[];
}

export const LEAKAGE: readonly LeakageRow[] = [
  { storeId: 'ST-ICU', consumedIqd: 48_600_000, chargedIqd: 39_100_000, topItems: [{ code: 'ICU-0503', unbilledQty: 210 }, { code: 'ICU-0502', unbilledQty: 64 }, { code: 'IVF-0202', unbilledQty: 180 }] },
  { storeId: 'ST-OT', consumedIqd: 72_300_000, chargedIqd: 66_900_000, topItems: [{ code: 'SRG-0403', unbilledQty: 95 }, { code: 'SRG-0401', unbilledQty: 11 }] },
  { storeId: 'ST-WA', consumedIqd: 21_400_000, chargedIqd: 18_200_000, topItems: [{ code: 'SUP-0103', unbilledQty: 640 }, { code: 'IVF-0201', unbilledQty: 300 }] },
  { storeId: 'ST-WB', consumedIqd: 19_800_000, chargedIqd: 18_950_000, topItems: [{ code: 'SUP-0105', unbilledQty: 22 }] },
  { storeId: 'ST-PHARM', consumedIqd: 96_500_000, chargedIqd: 94_800_000, topItems: [{ code: 'DRG-0302', unbilledQty: 140 }] },
];
