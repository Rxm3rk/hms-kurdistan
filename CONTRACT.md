# HMS Kurdistan clickable prototype: contract for screen builders

Throwaway demo outside the product repository. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.

- App: `C:\Users\Surface\hms-demo\frontend\apps\demo` (package `@hms/demo`; React 19, TypeScript strict,
  Vite 8, TanStack Router, react-aria-components 1.22, react-intl).
- Prototype code: `apps/demo/src/proto/` (all paths below are relative to `apps/demo/src/`).
- Fixed demo clock: **Monday 19 October 2026, 09:30, Asia/Baghdad**. Never use `Date.now()` / `new Date()`
  for "now"; use `DEMO_NOW` / `DEMO_NOW_ISO` from the data module.

## 1. Folder ownership

| Who | May edit |
|---|---|
| Each screen builder | **only** `src/proto/screens/<id>/` for the screen ids assigned to them (add any files or sub-folders there) |
| Nobody (scaffold-owned, read-only) | `src/proto/shell/`, `src/proto/ui/`, `src/proto/data/`, `src/proto/i18n/`, `src/main.tsx`, `src/app/`, `src/patient/`, `src/routing/`, `src/frame/`, `src/demo/`, `vite.config.ts`, `tsconfig.json`, everything under `frontend/packages/`, other screens' folders |

Screen ids and routes (already registered; do not touch the router):

| id | path | patient-scoped | exported component (keep the name) |
|---|---|---|---|
| home | `/` | no | `HomeScreen` |
| patients | `/patients` | no | `PatientsScreen` |
| outpatient | `/outpatient` | no | `OutpatientScreen` |
| ward | `/ward` | no | `WardScreen` |
| chart | `/chart` | **yes** | `ChartScreen` |
| orders | `/orders` | **yes** | `OrdersScreen` |
| emar | `/emar` | **yes** | `EmarScreen` |
| lab | `/lab` | **yes** | `LabScreen` |
| billing | `/billing` | **yes** | `BillingScreen` |
| admin | `/admin` | no | `AdminScreen` |

Each folder already has a stub: `index.tsx` (exports the component, no props), `messages.ts`, `<id>.css`.
Keep the export name and file `index.tsx`; replace the body. Need something shared that is missing? Write
your own copy inside your folder; do not edit shared files.

Patient-scoped screens render **under** the real PatientBanner (the clinical layout draws it, sticky, with
"Change patient" and "Close patient record"). When no patient is open the layout shows the patient chooser
instead of your screen, so your component always has a patient.

## 2. Imports (relative, with extensions)

From `src/proto/screens/<id>/index.tsx`:

```ts
import { /* data */ } from '../../data/index.ts';
import { useT, useFormat, defineMessages } from '../../i18n/use-t.ts';
import { /* UI helpers */ } from '../../ui/index.ts';
import { /* hooks */ } from '../../shell/index.ts';
import { Bdi, Message, PatientIdentity, ClinicalNumber } from '@hms/design-system';
import './<id>.css';
import { messages } from './messages.ts';
```

TypeScript settings that bite: `exactOptionalPropertyTypes` (never pass `prop={undefined}` to an optional
prop; use `{...(x === undefined ? {} : { prop: x })}`), `noUncheckedIndexedAccess` (`arr[i]` is
`T | undefined`), `verbatimModuleSyntax` (`import type` for types), relative imports carry `.ts`/`.tsx`.
No new npm packages, no network, no external URLs, fonts or images, no emoji.

## 3. Texts: messages, `useT`, formatters

Every visible string exists in en, ckb (Sorani, Arabic script) and ar. ckb and ar are AI drafts (unreviewed);
write natural Sorani with its own letters (ێ ۆ ڕ ڵ ە پ چ ژ گ ڤ), Arabic in Iraqi usage.

```ts
// messages.ts
import { defineMessages } from '../../i18n/use-t.ts';
export const messages = defineMessages({
  en:  { title: 'Ward & beds', free: '{count, plural, one {# bed free} other {# beds free}}', lead: 'Charge nurse {name}' },
  ckb: { title: 'قاوش و جێگاکان', free: '{count, plural, one {# جێگە بەتاڵە} other {# جێگە بەتاڵن}}', lead: 'سەرپەرشتیاری پەرستاری {name}' },
  ar:  { title: 'الردهات والأسرّة', free: '{count, plural, zero {لا أسرّة شاغرة} one {سرير واحد شاغر} two {سريران شاغران} few {# أسرّة شاغرة} many {# سريراً شاغراً} other {# سرير شاغر}}', lead: 'الممرضة المسؤولة {name}' },
});
// index.tsx
const t = useT(messages);
t('title');                       // string (also for aria-label, placeholder, title)
t('free', { count: 3 });          // ICU MessageFormat: plural, select, {placeholders}
t.rich('lead', { name: <StaffName member={m} /> });   // ReactNode with elements in placeholders
t.locale;                          // 'en' | 'ckb' | 'ar'
```

`defineMessages` fails type checking when ckb or ar lacks a key of en (or has an extra one). Plural
categories: en/ckb use `one`/`other`; Arabic uses `zero one two few many other` (always include `other`).

Formatting (all Asia/Baghdad, Western digits 0-9 in every locale, as the design system's locale setup does;
24-hour times):

```ts
const f = useFormat();
f.text(ward.name)            // the current locale's form of any Text3 from the data
f.iqd(1310000)               // en "IQD 1,310,000" · ckb "1,310,000 دینار" · ar "1,310,000 دينار"
f.usd(1250.5)                // en "USD 1,250.50" · ckb "1,250.50 دۆلار" · ar "1,250.50 دولار"
f.money(amount, 'IQD'|'USD')
f.number(1234.5), f.percent(0.76)
f.date(iso)                  // en "19 Oct 2026" · ckb "19 تشرینی یەکەم 2026" · ar "19 تشرين الأول 2026"
f.date(iso, 'long')          // "Monday, 19 October 2026" / "دووشەممە، 19 تشرینی یەکەم 2026" / "الاثنين، 19 تشرين الأول 2026"
f.date(iso, 'short')         // "19/10/2026"   ·  f.date(iso, 'iso') → "2026-10-19"
f.time(iso)                  // "09:30"
f.dateTime(iso)              // "19 Oct 2026, 09:30"
f.weekday(iso), f.relative(iso) // "in 30 min", "2 h ago" (from the demo clock)
f.age(patient.dob)           // "55 y" / "55 ساڵ" / "55 سنة"; months under 2 years, days under 1 month
```

The same helpers exist as plain functions taking a locale: `formatIQD, formatUSD, formatMoney, formatNumber,
formatPercent, formatDate, formatTime, formatDateTime, formatWeekday, formatRelative, formatAge, pickText`
(exported from `../../i18n/use-t.ts`). `useLocale()` and `useIsRtl()` are there too.

Catalogue keys (`@hms/i18n`) are only for the shell and the design system; screens use their own messages.
You may render existing catalogue texts with `<Message id="sign.action" />` (typed keys), e.g. banner
labels, `clinical.value.missing`, `patientContext.*`, `proto.nav.<screen id>` (the screen names).

## 4. Data module (`../../data/index.ts`)

Read-only, in memory. To "change" data (sign, give a dose, take a payment, acknowledge a result) keep the
change in your own React state (e.g. `useState<Set<string>>`); nothing is written back. All types are
exported (`Patient`, `Bed`, `Order`, `MarDose`, `LabResult`, `Invoice`, `Text3`, `Tone`, …; see
`src/proto/data/types.ts`, fully commented).

Conventions: user-visible text is `Text3 { en, ckb, ar }` (show with `f.text(x)`); instants are ISO strings
with `+03:00`; clinical numbers are decimal strings + UCUM unit (show with `<Qty>`); money is integer IQD
(convert with `iqdToUsd`); drug names are Latin strings (wrap in `<Code>` or `<Bdi dir="ltr">`); ids start
with `SYN-`.

| Export | What |
|---|---|
| `DEMO_NOW`, `DEMO_NOW_ISO`, `DEMO_TODAY`, `DEMO_TIME_ZONE`, `todayAt('14:00')`, `daysAgoAt(n,'08:00')`, `demoDate(n)`, `minutesFromNow(iso)`, `isToday(iso)` | the demo clock |
| `HOSPITAL` (`name`, `shortName`, `address`: Text3; `product`, `phone`, `beds`) | the fictional hospital |
| `EXCHANGE_RATE` `{ usdToIqd: 1310, asOf, note: Text3 }`, `iqdToUsd(iqd)`, `usdToIqd(usd)` | fixed demo rate |
| `PATIENTS` (54), `CURATED_PATIENTS` (14), `CENSUS_PATIENTS` (40), `CENSUS_GROUPS`, `findPatient(id)`, `getPatient(id)`, `hasAllergy(p, 'SYN-ALG-PENICILLIN')`, `bannerDataOf(p)` | patients |
| `STAFF`, `getStaff(id)`, `findStaff(id?)`, `DEMO_USERS` (role → staff id), `DEPARTMENTS`, `getDepartment(id)`, `CLINICS`, `getClinic(id)`, `PAYERS`, `getPayer(id)` | organisation |
| `WARDS`, `WARD_IDS`, `getWard(id)`, `BEDS` (56), `bedsOfWard(id)`, `bedOfPatient(pid)`, `bedCounts(wardId?)`, `occupancy(wardId?)`, `locationOf(pid)` → `{ ward, bedId }` | wards: Medical Ward A 20, Surgical Ward B 16, Paediatrics 12, ICU 8; states available / occupied / cleaning / blocked / reserved |
| `ENCOUNTERS`, `currentEncounter(pid)`, `encountersOf(pid)`, `lengthOfStayDays(enc)` | admissions and today's clinic visits (diagnoses with ICD-10 codes) |
| `APPOINTMENTS` (14 today), `appointmentsOf(pid)`, `appointmentsOfClinic(clinicId)` | outpatient day: booked, arrived (waiting), in consultation, completed, no-show, cancelled; queue numbers |
| `ORDERS` (51), `ordersOf(pid)`, `findOrder(id)` | lab, imaging, medication (with `medication: MedicationSpec`), nursing, diet, referral; `alerts` |
| `MAR` (36 doses today), `marOf(pid)` | statuses given, due, overdue, scheduled, held, refused, running; witness for high-alert |
| `SPECIMENS`, `RESULTS`, `specimensOf(pid)`, `resultsOf(pid)`, `resultsOfSpecimen(id)`, `unacknowledgedCriticals()` | lab; results carry `refLow/refHigh`, `flag`, `history`, `critical` |
| `VITALS`, `vitalsOf(pid)` (6 sets, every 4 h), `latestVitals(pid)`, `NOTES`, `notesOf(pid)` | chart data (curated inpatients) |
| `INVOICES`, `invoicesOf(pid)`, `invoiceTotals(inv)` → `{ grossIqd, payerShareIqd, patientShareIqd, paidIqd, balanceIqd }`, `paymentIqd(p)`, `paymentsToday()`, `cashTodayByCurrency()` | billing |
| `todaysFigures()`, `TRENDS` (7-day series), `TREND_DAYS`, `AUDIT_EVENTS` | dashboards and admin |
| Labels and tones: `ROLE_LABEL`, `STAFF_ROLE_LABEL`, `GOVERNORATE_LABEL`, `SEX_LABEL`, `SEVERITY_LABEL`, `ISOLATION_LABEL`, `BED_STATE_LABEL`/`_TONE`, `ENCOUNTER_TYPE_LABEL`, `APPOINTMENT_STATUS_LABEL`/`_TONE`, `ORDER_CATEGORY_LABEL`, `ORDER_STATUS_LABEL`/`_TONE`, `PRIORITY_LABEL`/`_TONE`, `ROUTE_LABEL`, `MAR_STATUS_LABEL`/`_TONE`, `SPECIMEN_STATUS_LABEL`/`_TONE`, `CONTAINER_LABEL`, `RESULT_FLAG_LABEL`/`_TONE`, `NOTE_KIND_LABEL`, `INVOICE_STATUS_LABEL`/`_TONE`, `PAYMENT_METHOD_LABEL`, `CHARGE_CATEGORY_LABEL` | `Record<code, Text3>` / `Record<code, Tone>`: use them so every screen says the same thing |

Example:

```tsx
const f = useFormat();
const { patient } = useClinicalPatient();
const doses = marOf(patient.id);
<Badge tone={MAR_STATUS_TONE[d.status]}>{f.text(MAR_STATUS_LABEL[d.status])}</Badge>
<Qty value={result.value} unit={result.unit} />
<Money amount={invoiceTotals(inv).balanceIqd} />   <Money amount={iqdToUsd(x)} currency="USD" />
```

Demo stories already in the data (build on them):

- **Critical potassium 6.8 mmol/L, unacknowledged**: Gulala Osman Rashid `SYN-PAT-0102` (elderly, year-only
  approximate DOB 1938, DNACPR, fall risk), specimen `SYN-SPC-260001`; her spironolactone is on hold and its
  08:00 dose held; her 08:00 bisoprolol is **overdue**. `unacknowledgedCriticals()` returns it.
- **Penicillin allergy conflict**: Karwan Tahir Bakr `SYN-PAT-0101` (severe penicillin anaphylaxis; photo;
  pneumonia + diabetes) has `SYN-ORD-0102` amoxicillin-clavulanate *awaiting signature* with a danger alert.
- **Isolation**: Aso Kamaran Yousif `SYN-PAT-0105` (airborne, suspected TB, room A-20); Mohammed …
  al-Dulaimi `SYN-PAT-0109` (contact/MRSA, ICU-03, ventilated, Arabic own script).
- **Look-alike names** (differ only in grandfather's name): `SYN-PAT-0107` (inpatient B-07, hip fracture)
  and `SYN-PAT-0108` (diabetes clinic today, HbA1c 9.1%).
- **Newborn with a long name**: `SYN-PAT-0103` (born 2026-10-18, phototherapy, P-02). **Child**: Rebin
  `SYN-PAT-0104` (7 y, P-05). **Latin-script foreign patient billed in USD**: Anna Maria Kowalska
  `SYN-PAT-0110` (B-12, invoice `SYN-INV-26-0110`). **Long allergy list**: Nasreen `SYN-PAT-0106` (B-03,
  discharge planned today). **DKA**: Hawre `SYN-PAT-0112` (A-07, insulin infusion). **Allergies not assessed**:
  Peyman `SYN-PAT-0114` (surgical clinic, unpaid invoice).

## 5. Patient context (one patient per window)

```ts
import { useClinicalPatient, useCurrentPatient, useOpenPatient, useClosePatient, usePatientChooser, PatientPicker, bannerModelOf } from '../../shell/index.ts';

// on a patient-scoped screen (chart, orders, emar, lab, billing): never null
const { patient, banner, actionsDisabled } = useClinicalPatient();   // Patient, BannerModel, boolean
// anywhere: the patient open in the window, or null
const current = useCurrentPatient();
// open a patient (default screen 'chart'); from a bed card, a worklist row, a search result
const openPatient = useOpenPatient();
openPatient('SYN-PAT-0102', 'lab');
// close the record (patient-scoped screens then show the chooser)
const closePatient = useClosePatient();
// open the "Choose a patient" dialog; the chosen patient opens on the given (or current clinical) screen
const { openChooser } = usePatientChooser();
openChooser('emar');
```

- Opening a patient puts `?patient=<id>` in the address; the window's patient context opens it at once, or
  shows the design system's **"Change patient?"** confirmation when another patient is open. That is the real
  safety behaviour: keep it, do not work around it. Never call the store directly.
- Do **not** render `PatientBanner` yourself. On hospital-wide screens list patients with two identifiers:
  `<PatientInline patient={p} />` (name, MRN, DOB, age, sex), or the design system's
  `<PatientIdentity model={bannerModelOf(p.id)} />` (photo and all three name forms). Never identify a patient
  by bed or room alone.
- `actionsDisabled` is true when the banner is in its error state: disable clinical actions then.
- `<PatientPicker onChoose={(id) => …} />` is the friendly chooser (search, filter, list) if you need it inline.

## 6. Signing

Use the design system's sign pattern through the shell (patient-scoped screens only):

```tsx
import { SignAction, useSign } from '../../shell/index.ts';
<SignAction review={<OrderSummary order={o} />} onSigned={() => setSigned((s) => new Set(s).add(o.id))} />
<SignAction kind="cosign" review={…} label={t('cosignTransfusion')} variant="secondary" />
// or your own button:
const sign = useSign();   // { canSign, blockedByBanner, requestSign({ kind?, review, onSigned? }) }
```

The dialog (review → re-verify the patient if the patient changed in the last 60 s → simulated sign-in →
intent → Sign) is real; the "server" accepts after 0.4 s and stores nothing; a success toast appears and
`onSigned` runs. Co-sign asks for a PIN: any 4 to 8 digits. Sign is disabled automatically when the
patient's identity is incomplete. For an allergy conflict pass `isDisabled` and show a danger `Callout`
saying why.

## 7. Role (`useRole`)

```ts
const { roleId, user, setRole } = useRole();   // 'physician' | 'nurse' | 'cashier' | 'admin'; user: StaffMember
```

Physician Dr. Shilan Kareem `SYN-STF-001`, Nurse Rawa Hassan `SYN-STF-002`, Cashier Dlshad Omer
`SYN-STF-003`, Admin Hemin Aziz `SYN-STF-004`. Adapt emphasis (e.g. home shows the role's worklist), but
every screen must work for every role. Show staff with `<StaffName member={…} />` or `staffName(m, locale)`.

## 8. Navigation

```ts
import { useScreenHref, useGoTo, useCurrentScreen } from '../../shell/index.ts';
const href = useScreenHref();
<LinkButton href={href('ward')} icon="bed">…</LinkButton>      // keeps ?locale= and ?density=
<TextLink href={href('lab', { patient: p.id })}>…</TextLink>   // opens the patient's lab
const goTo = useGoTo();  goTo('billing', { patient: p.id });
```

Never build addresses by hand (you would lose the language). Keep screen-local state (tabs, filters,
selected row) in React state.

## 9. Shared UI helpers (`../../ui/index.ts`; do not edit)

| Component | Props (main) |
|---|---|
| `PageHeader` | `title`, `subtitle?`, `icon?`, `eyebrow?`, `actions?`, `children?` (filter row). One per screen; it renders the h1 |
| `Card` | `title?`, `subtitle?`, `icon?`, `actions?`, `tone?` (coloured inline-start edge), `headingLevel? 2/3/4`, `flush?` (no body padding, for tables), `footer?` |
| `Section` | `title`, `actions?` (h2 without a card) |
| `Grid` | `min?` ('16rem': responsive columns), `gap? sm/md/lg` · `Stack` `direction? column/row`, `gap? xs/sm/md/lg`, `align?`, `justify? start/center/end/between`, `wrap?` · `Toolbar` `label?` |
| `StatTile` | `label`, `value`, `unit?`, `hint?`, `tone?`, `icon?`, `trend?: number[]` + `trendLabel`, `href?` or `onPress?` |
| `Badge` (= `Tag`) | `tone? neutral/info/success/warning/danger/accent`, `icon?`, `strong?` (filled), `size? sm/md`, children · `Dot` `tone` |
| `Button` | `variant? primary/secondary/ghost/danger`, `size? sm/md/lg`, `icon?`, `iconEnd?`, `onPress`, `isDisabled?`, `aria-label?` · `LinkButton` same + `href` · `IconButton` `icon`, `label` (required), `onPress` · `TextLink` `href` |
| `DataTable<T>` | `columns: Column<T>[]` (`id`, `header`, `cell(row)`, `align? start/center/end`, `width?`, `nowrap?`), `rows`, `rowKey(row)`, `caption` (accessible name), `onRowAction?(row)`, `rowTone?(row)`, `selectedKey?`, `emptyText?`, `dense?`, `stickyHeader?` |
| `Tabs` | `items: { id, label, badge?, content, isDisabled? }[]`, `aria-label`, `selectedKey?`/`defaultSelectedKey?`, `onSelectionChange?` |
| `EmptyState` | `title`, `body?`, `icon?`, `action?`, `compact?` · `Callout` `tone?`, `title?`, `icon?`, `actions?`, `role? note/status/alert` (alert only for unacknowledged critical) |
| `Sparkline` | `values`, `label`, `tone?`, `width?`, `height?`, `pointLabels?` · `BarChart` `data: { id, label, value, valueLabel?, tone? }[]`, `label`, `max?`, `orientation? horizontal/vertical`, `height?` · `Meter` `value 0..1`, `label`, `valueLabel`, `tone?`, `showText?` |
| `Qty` | `value` (decimal string), `unit?` (UCUM: mg, g, mL, U, kg, mmol/L, umol/L, g/dL, mg/L, 10*9/L, %, kPa, Cel, mm[Hg], /min, mL/h, U/h, ug/kg/min, mL/min/{1.73_m2} …: `PROTO_UNIT_DISPLAY_MAP`) · `BloodPressure` `systolic`, `diastolic` · `Money` `amount`, `currency? IQD/USD` · `Code` (LTR-isolated code or drug name) |
| `SearchField` | `label`, `value`, `onChange`, `placeholder?`, `hideLabel?`, `autoFocus?` · `TextInput` `label`, `value`, `onChange`, `multiline?`, `dir?`, `inputMode?`, `description?`, `isRequired?` · `SelectField` `label`, `options: {id,label}[]`, `selectedKey`, `onSelectionChange` · `Segmented` `label`, `options`, `value`, `onChange`, `hideLabel?` · `Checkbox` `isSelected`, `onChange`, children · `KeyValueList` `items: { id, label, value }[]`, `columns? 1/2/3` |
| `PatientInline` | `patient`, `secondary?` (second script) · `PatientName` `patient`, `secondary?` · `StaffName` `member` · `Avatar` `name` · `personName(name, locale)`, `staffName(member, locale)` |
| `Dialog` | `isOpen`, `onOpenChange`, `title`, `subtitle?`, `actions?` (safe choice first), `size? md/lg`, `role?` (design-system Modal) |
| `useToast()` | `toast({ tone?, title, body? })` (polite, 6 s) |
| `Icon` | `name` (home, users, user, stethoscope, bed, chart, clipboard, pill, flask, receipt, settings, search, bell, alert, info, check, check-circle, x, clock, calendar, plus, minus, chevron-forward, chevron-back, chevron-down, arrow-forward, arrow-back, heart, activity, droplet, thermometer, printer, filter, more, lock, pen, refresh, money, phone, logout, menu, shield, isolation, scan, building), `size?`. `*-forward` / `*-back` mirror in RTL automatically |

Design-system components you may use directly (`@hms/design-system`): `Bdi` (`dir` required:
`ltr` for MRNs, numbers, codes, drug and Latin names; `rtl` for Sorani/Arabic names), `Message` (`id` typed
catalogue key, `values?`), `ClinicalNumber` (`value`, `unit?`, `unitDisplayMap?`; prefer `Qty`),
`PatientIdentity` (`model: BannerModel`, use `bannerModelOf(id)`), `Modal` (prefer `Dialog`), `GovernedLabel`,
`BannerStatus`, `StatusIcon`. **Only one dialog can be open in the window** (the palette, the sign dialog,
the patient switch confirmation and your dialogs share one slot; in development a second one throws). Close
your dialog before opening a patient.

## 10. CSS conventions

- One stylesheet per screen, `src/proto/screens/<id>/<id>.css`, imported by your `index.tsx` (more files of
  your own are fine). **Class prefix `<id>-`** (root `.<id>-screen`, then `.<id>-bed`, `.<id>-legend`…).
  Never restyle `ui-`, `shell-` or `hms-` classes.
- **Logical properties only**: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
  `border-inline-start`, `inline-size`/`block-size`, `text-align: start|end`. Never `left`, `right`,
  `margin-left`, `float: left`, `text-align: left`. Flex and grid follow the reading direction on their own.
- **Tokens only** (`frontend/packages/design-system/src/tokens.css`): colours `--hms-color-bg|bg-raised|bg-sunken`,
  `--hms-color-text|text-muted|text-link`, `--hms-color-border|border-strong`, `--hms-color-accent-bg|text|border`,
  status pairs `--hms-color-{info,success,warning,danger}-{bg,text,border}`; spacing `--hms-space-1..6`;
  type `--hms-font-size-sm|md|lg|xl`, `--hms-font-weight-regular|bold`; `--hms-radius-sm|md`,
  `--hms-border-width`, `--hms-target-min-size` (keep targets at least this), focus
  `--hms-color-focus`. Prototype extras: `--ui-shadow`, `--ui-shadow-raised`, `--ui-radius-lg`.
- Safety colours: allergies and critical values use the danger tone (with icon + text), cautions the
  warning tone; colour is never the only carrier. No `overflow: hidden` / ellipsis on patient names, MRNs or
  allergy text; let them wrap.
- Layout must hold at 1366 x 768 (side nav open) and on a 1024 px projector; content area is about
  1100 px wide on a laptop. Numbers in tables: `font-variant-numeric: tabular-nums`.
- Charts: time runs left to right in every locale (not mirrored); horizontal bars grow from the inline start.

## 11. Shell facts (for orientation)

- Ribbon "PROTOTYPE · SYNTHETIC DATA · NOT FOR CLINICAL USE" (English plus Sorani/Arabic) is always visible.
- Top bar: hospital, demo clock, command palette (Ctrl+K: every screen, every patient, density, language),
  language (English / کوردی / العربية via `?locale=`), density (comfortable/compact), role switcher.
- Side navigation: Hospital (Home, Patients, Outpatient, Ward & beds), Patient record (current patient card,
  Patient chart, Orders, Medication, Laboratory, Billing), System (Administration); collapsible.
- Dev server (only if the orchestrator asks): `cd apps/demo && ../../node_modules/.bin/vite` on
  http://127.0.0.1:5200 (loopback only).

## 12. Checks

Type-check (about 50 s; run only as often as your instructions allow):

```
cd "C:\Users\Surface\hms-demo\frontend\apps\demo" && ../../node_modules/.bin/tsc --noEmit -p .
```

Build (only if told): `cd "C:\Users\Surface\hms-demo\frontend\apps\demo" && ../../node_modules/.bin/vite build`.
Do not run vitest, playwright or eslint; do not start servers unless told. Never touch `C:\Users\Surface\.t3\`.
