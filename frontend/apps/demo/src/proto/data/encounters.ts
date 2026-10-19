/**
 * Encounters (admissions and today's clinic visits) and today's outpatient appointments. SYNTHETIC DATA ONLY.
 */
import { DEMO_TODAY, daysAgoAt, demoDate, todayAt } from './clock.ts';
import { CENSUS_GROUPS } from './patients.ts';
import { BEDS } from './wards.ts';
import type { Appointment, DepartmentId, Diagnosis, Encounter, Text3, WardId } from './types.ts';

function dx(code: string, en: string, ckb: string, ar: string, primary = false): Diagnosis {
  return { code, text: { en, ckb, ar }, primary };
}

// ---------------------------------------------------------------------------------------------------------
// Curated admissions
// ---------------------------------------------------------------------------------------------------------

const CURATED_ADMISSIONS: readonly Encounter[] = [
  {
    id: 'SYN-ENC-0101',
    patientId: 'SYN-PAT-0101',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(2, '10:15'),
    endIso: null,
    departmentId: 'internal-medicine',
    attendingId: 'SYN-STF-001',
    wardId: 'med-a',
    bedId: 'A-04',
    reason: { en: 'Fever, productive cough and breathlessness for 4 days', ckb: 'تا، کۆکەی بەڵغەمدار و هەناسەتەنگی بۆ 4 ڕۆژ', ar: 'حمى وسعال منتج وضيق نفس منذ 4 أيام' },
    diagnoses: [
      dx('J18.9', 'Community-acquired pneumonia, right lower lobe', 'هەوکردنی سییەکان، بەشی خوارەوەی ڕاست', 'التهاب رئوي مكتسب من المجتمع، الفص السفلي الأيمن', true),
      dx('E11.9', 'Type 2 diabetes mellitus', 'شەکرەی جۆری 2', 'داء السكري من النوع الثاني'),
    ],
    expectedDischargeOn: demoDate(-2),
  },
  {
    id: 'SYN-ENC-0102',
    patientId: 'SYN-PAT-0102',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(4, '14:30'),
    endIso: null,
    departmentId: 'internal-medicine',
    attendingId: 'SYN-STF-001',
    wardId: 'med-a',
    bedId: 'A-11',
    reason: { en: 'Worsening breathlessness and leg swelling', ckb: 'زیادبوونی هەناسەتەنگی و ئاوسانی قاچ', ar: 'تفاقم ضيق النفس وتورم الساقين' },
    diagnoses: [
      dx('I50.9', 'Heart failure, decompensated', 'لاوازیی دڵ، تێکچوو', 'قصور القلب اللامعاوض', true),
      dx('N18.4', 'Chronic kidney disease, stage 4', 'نەخۆشیی درێژخایەنی گورچیلە، قۆناغی 4', 'مرض الكلى المزمن، المرحلة الرابعة'),
      dx('E87.5', 'Hyperkalaemia', 'زیادبوونی پۆتاسیۆم', 'فرط بوتاسيوم الدم'),
    ],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0103',
    patientId: 'SYN-PAT-0103',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '14:40'),
    endIso: null,
    departmentId: 'paediatrics',
    attendingId: 'SYN-STF-006',
    wardId: 'paeds',
    bedId: 'P-02',
    reason: { en: 'Jaundice on day 1 of life', ckb: 'زەردوویی لە یەکەم ڕۆژی ژیاندا', ar: 'يرقان في اليوم الأول من العمر' },
    diagnoses: [dx('P59.9', 'Neonatal jaundice, under phototherapy', 'زەردوویی کۆرپە، لەژێر چارەسەری ڕووناکیدا', 'يرقان الوليد، تحت العلاج الضوئي', true)],
    expectedDischargeOn: demoDate(-1),
  },
  {
    id: 'SYN-ENC-0104',
    patientId: 'SYN-PAT-0104',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '21:10'),
    endIso: null,
    departmentId: 'paediatrics',
    attendingId: 'SYN-STF-006',
    wardId: 'paeds',
    bedId: 'P-05',
    reason: { en: 'Vomiting and diarrhoea for 2 days, reduced drinking', ckb: 'ڕشانەوە و سکچوون بۆ 2 ڕۆژ، کەمبوونەوەی خواردنەوە', ar: 'تقيؤ وإسهال منذ يومين، قلة الشرب' },
    diagnoses: [
      dx('A09', 'Acute gastroenteritis', 'هەوکردنی توندی گەدە و ڕیخۆڵە', 'التهاب المعدة والأمعاء الحاد', true),
      dx('E86', 'Moderate dehydration', 'وشکبوونەوەی مامناوەند', 'جفاف متوسط'),
    ],
    expectedDischargeOn: demoDate(-1),
  },
  {
    id: 'SYN-ENC-0105',
    patientId: 'SYN-PAT-0105',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '16:30'),
    endIso: null,
    departmentId: 'internal-medicine',
    attendingId: 'SYN-STF-001',
    wardId: 'med-a',
    bedId: 'A-20',
    reason: { en: 'Cough for 6 weeks, night sweats, weight loss', ckb: 'کۆکە بۆ 6 هەفتە، ئارەقەکردنەوەی شەوانە، دابەزینی کێش', ar: 'سعال منذ 6 أسابيع وتعرق ليلي وفقدان وزن' },
    diagnoses: [dx('A15.0', 'Pulmonary tuberculosis, suspected', 'سیلی سییەکان، گومانلێکراو', 'سل رئوي، مشتبه به', true)],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0106',
    patientId: 'SYN-PAT-0106',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '07:00'),
    endIso: null,
    departmentId: 'general-surgery',
    attendingId: 'SYN-STF-005',
    wardId: 'surg-b',
    bedId: 'B-03',
    reason: { en: 'Elective laparoscopic cholecystectomy', ckb: 'نەشتەرگەریی پلاندانراوی لابراسکۆپی بۆ زراو', ar: 'استئصال المرارة بالمنظار، عملية مجدولة' },
    diagnoses: [dx('K80.2', 'Gallstones; day 1 after laparoscopic cholecystectomy', 'بەردی زراو؛ ڕۆژی 1 دوای نەشتەرگەری', 'حصى المرارة؛ اليوم الأول بعد استئصال المرارة بالمنظار', true)],
    expectedDischargeOn: DEMO_TODAY,
  },
  {
    id: 'SYN-ENC-0107',
    patientId: 'SYN-PAT-0107',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(3, '15:20'),
    endIso: null,
    departmentId: 'general-surgery',
    attendingId: 'SYN-STF-005',
    wardId: 'surg-b',
    bedId: 'B-07',
    reason: { en: 'Fall at home, unable to stand', ckb: 'کەوتن لە ماڵەوە، ناتوانێت ڕابوەستێت', ar: 'سقوط في المنزل، لا يستطيع الوقوف' },
    diagnoses: [dx('S72.0', 'Fracture of neck of right femur; day 2 after hemiarthroplasty', 'شکانی ملی ڕانی ڕاست؛ ڕۆژی 2 دوای نەشتەرگەری', 'كسر عنق الفخذ الأيمن؛ اليوم الثاني بعد تبديل نصف المفصل', true)],
    expectedDischargeOn: demoDate(-3),
  },
  {
    id: 'SYN-ENC-0109',
    patientId: 'SYN-PAT-0109',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(2, '03:20'),
    endIso: null,
    departmentId: 'intensive-care',
    attendingId: 'SYN-STF-007',
    wardId: 'icu',
    bedId: 'ICU-03',
    reason: { en: 'Fever, confusion and low blood pressure', ckb: 'تا، تێکچوونی هۆش و نزمی پەستانی خوێن', ar: 'حمى وتشوش ذهني وانخفاض ضغط الدم' },
    diagnoses: [
      dx('R57.2', 'Septic shock, urinary source', 'شۆکی ژەهراویبوونی خوێن، سەرچاوەی میز', 'صدمة إنتانية، مصدر بولي', true),
      dx('J96.0', 'Acute respiratory failure, ventilated', 'لاوازیی توندی هەناسەدان، لەسەر ئامێر', 'فشل تنفسي حاد، على جهاز التنفس'),
    ],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0110',
    patientId: 'SYN-PAT-0110',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '22:45'),
    endIso: null,
    departmentId: 'general-surgery',
    attendingId: 'SYN-STF-005',
    wardId: 'surg-b',
    bedId: 'B-12',
    reason: { en: 'Right lower abdominal pain since yesterday', ckb: 'ئازاری لای ڕاستی خوارەوەی سک لە دوێنێوە', ar: 'ألم أسفل البطن الأيمن منذ الأمس' },
    diagnoses: [dx('K35.8', 'Acute appendicitis; after laparoscopic appendicectomy', 'هەوکردنی توندی ڕیخۆڵەکوێرە؛ دوای نەشتەرگەری', 'التهاب الزائدة الحاد؛ بعد استئصال الزائدة بالمنظار', true)],
    expectedDischargeOn: demoDate(-1),
  },
  {
    id: 'SYN-ENC-0112',
    patientId: 'SYN-PAT-0112',
    type: 'inpatient',
    status: 'active',
    startIso: daysAgoAt(1, '19:05'),
    endIso: null,
    departmentId: 'internal-medicine',
    attendingId: 'SYN-STF-001',
    wardId: 'med-a',
    bedId: 'A-07',
    reason: { en: 'Vomiting, abdominal pain, high glucose', ckb: 'ڕشانەوە، ئازاری سک، بەرزیی شەکرە', ar: 'تقيؤ وألم بطني وارتفاع السكر' },
    diagnoses: [dx('E10.1', 'Diabetic ketoacidosis, type 1 diabetes', 'ترشبوونی کیتۆنی شەکرە، شەکرەی جۆری 1', 'الحماض الكيتوني السكري، سكري النوع الأول', true)],
    expectedDischargeOn: demoDate(-2),
  },
];

// ---------------------------------------------------------------------------------------------------------
// Census admissions: a diagnosis from each ward's pool
// ---------------------------------------------------------------------------------------------------------

const POOL: Readonly<Record<WardId, readonly Diagnosis[]>> = {
  'med-a': [
    dx('J44.1', 'COPD with acute exacerbation', 'نەخۆشیی درێژخایەنی سییەکان، تێکچوون', 'الانسداد الرئوي المزمن مع تفاقم حاد', true),
    dx('I63.9', 'Ischaemic stroke', 'جەڵتەی مێشک', 'سكتة دماغية إقفارية', true),
    dx('N39.0', 'Urinary tract infection', 'هەوکردنی ڕێڕەوی میز', 'التهاب المسالك البولية', true),
    dx('L03.1', 'Cellulitis of the leg', 'هەوکردنی پێستی قاچ', 'التهاب النسيج الخلوي في الساق', true),
    dx('K92.2', 'Upper gastrointestinal bleeding', 'خوێنبەربوونی بەشی سەرەوەی هەرس', 'نزيف الجهاز الهضمي العلوي', true),
    dx('D64.9', 'Anaemia for investigation', 'کەمخوێنی بۆ پشکنین', 'فقر دم قيد الاستقصاء', true),
    dx('N17.9', 'Acute kidney injury', 'زیانی توندی گورچیلە', 'إصابة كلوية حادة', true),
    dx('I50.9', 'Heart failure', 'لاوازیی دڵ', 'قصور القلب', true),
  ],
  'surg-b': [
    dx('K35.8', 'Acute appendicitis', 'هەوکردنی توندی ڕیخۆڵەکوێرە', 'التهاب الزائدة الحاد', true),
    dx('K56.6', 'Small bowel obstruction', 'گیرانی ڕیخۆڵەی باریک', 'انسداد الأمعاء الدقيقة', true),
    dx('K40.9', 'Inguinal hernia repair', 'چاککردنەوەی فەتقی گەدە', 'إصلاح فتق إربي', true),
    dx('L97.5', 'Diabetic foot ulcer', 'برینی پێی شەکرە', 'قرحة القدم السكرية', true),
    dx('S82.2', 'Fracture of tibia', 'شکانی ئێسکی لووتەقاچ', 'كسر عظم الظنبوب', true),
    dx('K27.5', 'Perforated peptic ulcer', 'کونبوونی برینی گەدە', 'قرحة هضمية مثقوبة', true),
    dx('E04.2', 'Thyroidectomy for goitre', 'لابردنی ڕژێنی دەرەقی', 'استئصال الغدة الدرقية لتضخمها', true),
  ],
  paeds: [
    dx('J21.9', 'Bronchiolitis', 'هەوکردنی بۆرییە وردەکانی سی', 'التهاب القصيبات', true),
    dx('J18.9', 'Pneumonia', 'هەوکردنی سییەکان', 'التهاب رئوي', true),
    dx('R56.0', 'Febrile seizure', 'گرژبوونی تا', 'اختلاج حروري', true),
    dx('J45.9', 'Acute asthma', 'ڕەبوی توند', 'نوبة ربو حادة', true),
    dx('N39.0', 'Urinary tract infection', 'هەوکردنی ڕێڕەوی میز', 'التهاب المسالك البولية', true),
    dx('A09', 'Gastroenteritis', 'هەوکردنی گەدە و ڕیخۆڵە', 'التهاب المعدة والأمعاء', true),
  ],
  icu: [
    dx('I21.9', 'Acute myocardial infarction', 'جەڵتەی دڵ', 'احتشاء عضلة القلب الحاد', true),
    dx('S06.9', 'Head injury', 'برینداربوونی سەر', 'إصابة الرأس', true),
    dx('J96.0', 'Respiratory failure', 'لاوازیی هەناسەدان', 'فشل تنفسي', true),
    dx('Z48.8', 'Monitoring after major surgery', 'چاودێری دوای نەشتەرگەریی گەورە', 'مراقبة بعد جراحة كبرى', true),
    dx('I61.9', 'Intracerebral haemorrhage', 'خوێنبەربوونی ناو مێشک', 'نزيف داخل المخ', true),
    dx('E10.1', 'Severe diabetic ketoacidosis', 'ترشبوونی کیتۆنی توندی شەکرە', 'حماض كيتوني سكري شديد', true),
  ],
};

const WARD_DEPARTMENT: Readonly<Record<WardId, { readonly department: DepartmentId; readonly attending: string }>> = {
  'med-a': { department: 'internal-medicine', attending: 'SYN-STF-001' },
  'surg-b': { department: 'general-surgery', attending: 'SYN-STF-005' },
  paeds: { department: 'paediatrics', attending: 'SYN-STF-006' },
  icu: { department: 'intensive-care', attending: 'SYN-STF-007' },
};

const CENSUS_REASON: Text3 = {
  en: 'Admitted from the Emergency Department',
  ckb: 'لە بەشی فریاکەوتنەوە خەوێنرا',
  ar: 'أُدخل من قسم الطوارئ',
};

function censusAdmissions(): readonly Encounter[] {
  const encounters: Encounter[] = [];
  let n = 0;
  for (const bed of BEDS) {
    if (bed.patientId === null || !bed.patientId.startsWith('SYN-PAT-02')) {
      continue;
    }
    const pool = POOL[bed.wardId];
    const diagnosis = pool[n % pool.length] ?? pool[0]!;
    const { department, attending } = WARD_DEPARTMENT[bed.wardId];
    const stay = 1 + ((n * 3) % 8);
    encounters.push({
      id: `SYN-ENC-${bed.patientId.slice(-4)}`,
      patientId: bed.patientId,
      type: 'inpatient',
      status: 'active',
      startIso: bed.sinceIso,
      endIso: null,
      departmentId: department,
      attendingId: attending,
      wardId: bed.wardId,
      bedId: bed.id,
      reason: CENSUS_REASON,
      diagnoses: [diagnosis],
      expectedDischargeOn: n % 4 === 0 ? DEMO_TODAY : demoDate(-(1 + (stay % 4))),
    });
    n += 1;
  }
  return encounters;
}

// ---------------------------------------------------------------------------------------------------------
// Today's outpatient appointments
// ---------------------------------------------------------------------------------------------------------

const OP = CENSUS_GROUPS.outpatient;

function op(index: number): string {
  const id = OP[index];
  if (id === undefined) {
    throw new Error(`No census outpatient ${String(index)}`);
  }
  return id;
}

const FOLLOW_UP: Text3 = { en: 'Follow-up visit', ckb: 'سەردانی بەدواداچوون', ar: 'زيارة متابعة' };

export const APPOINTMENTS: readonly Appointment[] = [
  {
    id: 'SYN-APT-0001',
    patientId: op(0),
    clinicId: 'clinic-surg',
    clinicianId: 'SYN-STF-005',
    startIso: todayAt('08:15'),
    durationMin: 15,
    status: 'no-show',
    visitType: 'follow-up',
    reason: { en: 'Wound check after hernia repair', ckb: 'پشکنینی برین دوای چاککردنەوەی فەتق', ar: 'فحص الجرح بعد إصلاح الفتق' },
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0002',
    patientId: 'SYN-PAT-0111',
    clinicId: 'clinic-cardio',
    clinicianId: 'SYN-STF-017',
    startIso: todayAt('08:30'),
    durationMin: 20,
    status: 'completed',
    visitType: 'follow-up',
    reason: { en: 'Palpitations, review of Holter monitor', ckb: 'لێدانی خێرای دڵ، پێداچوونەوەی هۆڵتەر', ar: 'خفقان، مراجعة جهاز هولتر' },
    arrivedIso: todayAt('08:18'),
    queueNumber: 'C-01',
    encounterId: 'SYN-ENC-0111',
  },
  {
    id: 'SYN-APT-0003',
    patientId: op(1),
    clinicId: 'clinic-im',
    clinicianId: 'SYN-STF-008',
    startIso: todayAt('08:45'),
    durationMin: 15,
    status: 'completed',
    visitType: 'follow-up',
    reason: { en: 'Blood pressure review', ckb: 'پێداچوونەوەی پەستانی خوێن', ar: 'مراجعة ضغط الدم' },
    arrivedIso: todayAt('08:35'),
    queueNumber: 'M-01',
    encounterId: null,
  },
  {
    id: 'SYN-APT-0004',
    patientId: op(2),
    clinicId: 'clinic-endo',
    clinicianId: 'SYN-STF-016',
    startIso: todayAt('09:00'),
    durationMin: 20,
    status: 'completed',
    visitType: 'follow-up',
    reason: { en: 'Thyroid function review', ckb: 'پێداچوونەوەی کاری ڕژێنی دەرەقی', ar: 'مراجعة وظائف الغدة الدرقية' },
    arrivedIso: todayAt('08:40'),
    queueNumber: 'D-01',
    encounterId: null,
  },
  {
    id: 'SYN-APT-0005',
    patientId: op(3),
    clinicId: 'clinic-im',
    clinicianId: 'SYN-STF-008',
    startIso: todayAt('09:15'),
    durationMin: 15,
    status: 'in-consultation',
    visitType: 'new',
    reason: { en: 'Tiredness and weight loss', ckb: 'ماندوویی و دابەزینی کێش', ar: 'تعب وفقدان وزن' },
    arrivedIso: todayAt('08:58'),
    queueNumber: 'M-02',
    encounterId: null,
  },
  {
    id: 'SYN-APT-0006',
    patientId: 'SYN-PAT-0108',
    clinicId: 'clinic-endo',
    clinicianId: 'SYN-STF-016',
    startIso: todayAt('09:30'),
    durationMin: 20,
    status: 'arrived',
    visitType: 'follow-up',
    reason: { en: 'Diabetes review, HbA1c result', ckb: 'پێداچوونەوەی شەکرە، ئەنجامی HbA1c', ar: 'مراجعة السكري، نتيجة HbA1c' },
    arrivedIso: todayAt('09:02'),
    queueNumber: 'D-02',
    encounterId: 'SYN-ENC-0108',
  },
  {
    id: 'SYN-APT-0007',
    patientId: op(4),
    clinicId: 'clinic-cardio',
    clinicianId: 'SYN-STF-017',
    startIso: todayAt('09:30'),
    durationMin: 20,
    status: 'arrived',
    visitType: 'new',
    reason: { en: 'Chest pain on exertion', ckb: 'ئازاری سنگ لە کاتی ماندووبوون', ar: 'ألم صدري عند الجهد' },
    arrivedIso: todayAt('09:12'),
    queueNumber: 'C-02',
    encounterId: null,
  },
  {
    id: 'SYN-APT-0008',
    patientId: 'SYN-PAT-0114',
    clinicId: 'clinic-surg',
    clinicianId: 'SYN-STF-005',
    startIso: todayAt('09:45'),
    durationMin: 20,
    status: 'arrived',
    visitType: 'new',
    reason: { en: 'Pre-operative assessment, inguinal hernia', ckb: 'هەڵسەنگاندنی پێش نەشتەرگەری، فەتقی گەدە', ar: 'تقييم ما قبل العملية، فتق إربي' },
    arrivedIso: todayAt('09:20'),
    queueNumber: 'S-01',
    encounterId: 'SYN-ENC-0114',
  },
  {
    id: 'SYN-APT-0009',
    patientId: op(5),
    clinicId: 'clinic-paeds',
    clinicianId: 'SYN-STF-006',
    startIso: todayAt('10:00'),
    durationMin: 15,
    status: 'booked',
    visitType: 'follow-up',
    reason: FOLLOW_UP,
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0010',
    patientId: op(6),
    clinicId: 'clinic-im',
    clinicianId: 'SYN-STF-008',
    startIso: todayAt('10:00'),
    durationMin: 15,
    status: 'booked',
    visitType: 'follow-up',
    reason: { en: 'Results of blood tests', ckb: 'ئەنجامی پشکنینەکانی خوێن', ar: 'نتائج تحاليل الدم' },
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0011',
    patientId: op(7),
    clinicId: 'clinic-endo',
    clinicianId: 'SYN-STF-016',
    startIso: todayAt('10:20'),
    durationMin: 20,
    status: 'booked',
    visitType: 'new',
    reason: { en: 'Newly diagnosed diabetes', ckb: 'شەکرەی تازە دەستنیشانکراو', ar: 'سكري مشخّص حديثاً' },
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0012',
    patientId: 'SYN-PAT-0113',
    clinicId: 'clinic-paeds',
    clinicianId: 'SYN-STF-006',
    startIso: todayAt('11:00'),
    durationMin: 15,
    status: 'booked',
    visitType: 'follow-up',
    reason: { en: 'Asthma review, inhaler technique', ckb: 'پێداچوونەوەی ڕەبو، شێوازی بەکارهێنانی هەڵمژەر', ar: 'مراجعة الربو، طريقة استخدام البخاخ' },
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0013',
    patientId: op(1),
    clinicId: 'clinic-cardio',
    clinicianId: 'SYN-STF-017',
    startIso: todayAt('11:20'),
    durationMin: 20,
    status: 'booked',
    visitType: 'new',
    reason: { en: 'Echocardiogram review', ckb: 'پێداچوونەوەی ئیکۆی دڵ', ar: 'مراجعة تخطيط صدى القلب' },
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
  {
    id: 'SYN-APT-0014',
    patientId: op(2),
    clinicId: 'clinic-surg',
    clinicianId: 'SYN-STF-005',
    startIso: todayAt('11:40'),
    durationMin: 15,
    status: 'cancelled',
    visitType: 'follow-up',
    reason: FOLLOW_UP,
    arrivedIso: null,
    queueNumber: null,
    encounterId: null,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Today's clinic encounters (curated outpatients)
// ---------------------------------------------------------------------------------------------------------

const CLINIC_ENCOUNTERS: readonly Encounter[] = [
  {
    id: 'SYN-ENC-0111',
    patientId: 'SYN-PAT-0111',
    type: 'outpatient',
    status: 'finished',
    startIso: todayAt('08:32'),
    endIso: todayAt('08:55'),
    departmentId: 'cardiology',
    attendingId: 'SYN-STF-017',
    wardId: null,
    bedId: null,
    reason: { en: 'Palpitations', ckb: 'لێدانی خێرای دڵ', ar: 'خفقان' },
    diagnoses: [dx('I47.1', 'Supraventricular tachycardia', 'خێرایی لێدانی دڵی سەرووی سکۆڵەکان', 'تسرع القلب فوق البطيني', true)],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0108',
    patientId: 'SYN-PAT-0108',
    type: 'outpatient',
    status: 'active',
    startIso: todayAt('09:02'),
    endIso: null,
    departmentId: 'endocrinology',
    attendingId: 'SYN-STF-016',
    wardId: null,
    bedId: null,
    reason: { en: 'Diabetes review', ckb: 'پێداچوونەوەی شەکرە', ar: 'مراجعة السكري' },
    diagnoses: [dx('E11.65', 'Type 2 diabetes with poor control', 'شەکرەی جۆری 2 بە کۆنتڕۆڵی لاواز', 'سكري النوع الثاني ضعيف الضبط', true)],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0114',
    patientId: 'SYN-PAT-0114',
    type: 'outpatient',
    status: 'active',
    startIso: todayAt('09:20'),
    endIso: null,
    departmentId: 'general-surgery',
    attendingId: 'SYN-STF-005',
    wardId: null,
    bedId: null,
    reason: { en: 'Pre-operative assessment', ckb: 'هەڵسەنگاندنی پێش نەشتەرگەری', ar: 'تقييم ما قبل العملية' },
    diagnoses: [dx('K40.9', 'Right inguinal hernia', 'فەتقی گەدەی لای ڕاست', 'فتق إربي أيمن', true)],
    expectedDischargeOn: null,
  },
  {
    id: 'SYN-ENC-0113',
    patientId: 'SYN-PAT-0113',
    type: 'outpatient',
    status: 'planned',
    startIso: todayAt('11:00'),
    endIso: null,
    departmentId: 'paediatrics',
    attendingId: 'SYN-STF-006',
    wardId: null,
    bedId: null,
    reason: { en: 'Asthma review', ckb: 'پێداچوونەوەی ڕەبو', ar: 'مراجعة الربو' },
    diagnoses: [dx('J45.9', 'Asthma', 'ڕەبو', 'الربو', true)],
    expectedDischargeOn: null,
  },
];

/** Every encounter: curated admissions, census admissions and today's clinic encounters. */
export const ENCOUNTERS: readonly Encounter[] = [...CURATED_ADMISSIONS, ...censusAdmissions(), ...CLINIC_ENCOUNTERS];

/** The patient's current encounter: the active admission, else today's clinic visit. */
export function currentEncounter(patientId: string): Encounter | undefined {
  const own = ENCOUNTERS.filter((encounter) => encounter.patientId === patientId);
  return (
    own.find((encounter) => encounter.type === 'inpatient' && encounter.status === 'active') ??
    own.find((encounter) => encounter.status === 'active') ??
    own[0]
  );
}

/** Every encounter of a patient. */
export function encountersOf(patientId: string): readonly Encounter[] {
  return ENCOUNTERS.filter((encounter) => encounter.patientId === patientId);
}

/** Today's appointments of a patient. */
export function appointmentsOf(patientId: string): readonly Appointment[] {
  return APPOINTMENTS.filter((appointment) => appointment.patientId === patientId);
}

/** Today's appointments in one clinic, by start time. */
export function appointmentsOfClinic(clinicId: Appointment['clinicId']): readonly Appointment[] {
  return APPOINTMENTS.filter((appointment) => appointment.clinicId === clinicId).toSorted((a, b) =>
    a.startIso.localeCompare(b.startIso),
  );
}

/** Whole days since the encounter started (length of stay so far). */
export function lengthOfStayDays(encounter: Encounter): number {
  return Math.max(0, Math.floor((Date.parse(todayAt('09:30')) - Date.parse(encounter.startIso)) / 86_400_000));
}
