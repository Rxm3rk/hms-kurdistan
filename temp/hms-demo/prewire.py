# Pre-wire the 18 extra prototype screens (stubs) so parallel builders type-check against real ids.
import json, re, pathlib
F = pathlib.Path(r'C:/Users/Surface/hms-demo/frontend')
P = F / 'apps/demo/src/proto'
NEW = [
 # id, path, icon, clinical, Component, en, ckb, ar (nav label), subtitle en
 ('appointments','/appointments','calendar',False,'Appointments','Appointments & queue','نۆرەکان و ڕیز','المواعيد والدور','Clinic calendars, bookings and token queues'),
 ('emergency','/emergency','alert',False,'Emergency','Emergency','فریاکەوتن','الطوارئ','Triage, tracking board and pathway clocks'),
 ('nursing','/nursing','thermometer',False,'Nursing','Nursing worklist','لیستی کاری پەرستاری','قائمة عمل التمريض','Shift worklist: due, overdue, escalations'),
 ('theatre','/theatre','clock',False,'Theatre','Operating theatres','هۆڵەکانی نەشتەرگەری','غرف العمليات','Theatre lists, WHO checklist and intra-op record'),
 ('icu','/icu','heart',False,'Icu','Intensive care','چاودێری چڕ','العناية المركزة','ICU beds, flowsheet and severity'),
 ('maternity','/maternity','users',False,'Maternity','Maternity & newborns','لەدایکبوون و ساوایان','الولادة وحديثو الولادة','Labour ward, deliveries and newborn registration'),
 ('labworklist','/lab-worklist','flask',False,'LabWorklist','Lab worklist','لیستی کاری تاقیگە','قائمة عمل المختبر','Accessioning, analysers, QC and critical calls'),
 ('radiology','/radiology','scan',False,'Radiology','Radiology','تیشک','الأشعة','Imaging worklist, protocols and reports'),
 ('pharmacy','/pharmacy','pill',False,'Pharmacy','Pharmacy','دەرمانخانە','الصيدلية','Verification, dispensing, retail sales and narcotics'),
 ('bloodbank','/blood-bank','droplet',False,'BloodBank','Blood bank','بانکی خوێن','بنك الدم','Blood units, cross-match and bedside verification'),
 ('inventory','/inventory','building',False,'Inventory','Stores & inventory','کۆگا و کاڵاکان','المخازن والمخزون','Stock, expiry (FEFO), requisitions and purchasing'),
 ('cashier','/cashier','money',False,'Cashier','Cashier','سندوق','الصندوق','Dual-currency drawer, deposits and shift close'),
 ('insurance','/insurance','shield',False,'Insurance','Insurance & corporate','بیمە و کۆمپانیاکان','التأمين والشركات','Pre-approvals, credit limits, claims and ageing'),
 ('dashboard','/dashboard','activity',False,'Dashboard','Management dashboard','داشبۆردی بەڕێوەبردن','لوحة الإدارة','Revenue, collections, occupancy and safety KPIs'),
 ('quality','/quality','check-circle',False,'Quality','Quality & safety','کوالیتی و سەلامەتی','الجودة والسلامة','Incidents, RCA and accreditation KPIs'),
 ('staff','/staff','user',False,'Staff','Staff & rosters','کارمەندان و خشتەی کار','الموظفون والجداول','Practitioner registry, privileges and duty rosters'),
 ('reports','/reports','printer',False,'Reports','Reports & returns','ڕاپۆرت و ناردنەکان','التقارير والإحصاءات','Statutory returns, notifiable diseases and reports'),
 ('messaging','/messaging','phone',False,'Messaging','Patient messaging','نامەی نەخۆشان','رسائل المرضى','WhatsApp, Viber and SMS templates and links'),
]
GROUPS = [
 ('hospital', ['home','patients','appointments','outpatient','emergency','ward','nursing','theatre','icu','maternity']),
 ('services', ['labworklist','radiology','pharmacy','bloodbank','inventory']),
 ('record', ['chart','orders','emar','lab','billing']),
 ('finance', ['cashier','insurance']),
 ('management', ['dashboard','quality','staff','reports','messaging']),
 ('system', ['admin']),
]
GROUP_TEXT = {'services': ('Clinical services','خزمەتگوزارییە پزیشکییەکان','الخدمات السريرية'),
              'finance': ('Finance','دارایی','المالية'),
              'management': ('Management','بەڕێوەبردن','الإدارة')}
def cap(s): return s[0].upper()+s[1:]

# 1. screens.ts
p = P/'shell/screens.ts'; t = p.read_text(encoding='utf-8')
if "'appointments'" not in t:
    m = re.search(r"export const SCREEN_IDS = \[(.*?)\] as const;", t)
    t = t.replace(m.group(0), m.group(0).replace(m.group(1), m.group(1) + ', ' + ', '.join(f"'{n[0]}'" for n in NEW)))
    entries = ''.join(f"  {i}: {{ id: '{i}', path: '{path}', navKey: 'proto.nav.{i}', icon: '{icon}', clinical: {str(c).lower()} }},\n" for i,path,icon,c,*_ in NEW)
    t = t.replace("  admin: { id: 'admin'", entries + "  admin: { id: 'admin'")
    t = t.replace("readonly id: 'hospital' | 'record' | 'system'", "readonly id: 'hospital' | 'services' | 'record' | 'finance' | 'management' | 'system'")
    groups = ''.join(f"  {{ id: '{g}', screens: [{', '.join(repr(s) for s in sc)}] }},\n" for g,sc in GROUPS)
    t = re.sub(r"(export const NAV_GROUPS[^\n]*\n)(.*?)(\];)", lambda m: m.group(1)+groups+m.group(3), t, count=1, flags=re.S)
    t = t.replace("/** Navigation groups, in order: the hospital-wide screens, the patient record, administration. */",
                  "/** Navigation groups, in order: patient flow, clinical services, the patient record, finance, management, administration. */")
    p.write_text(t, encoding='utf-8')

# 2. routes.tsx
p = P/'shell/routes.tsx'; t = p.read_text(encoding='utf-8')
if 'AppointmentsScreen' not in t:
    imps = ''.join(f"import {{ {comp}Screen }} from '../screens/{i}/index.tsx';\n" for i,_,_,_,comp,*_ in NEW)
    assert "import { ProtoClinicalLayout }" in t
    t = t.replace("import { ProtoClinicalLayout }", imps + "import { ProtoClinicalLayout }")
    comps = ''.join(f"  {i}: {comp}Screen,\n" for i,_,_,_,comp,*_ in NEW)
    assert "  admin: AdminScreen,\n};" in t
    t = t.replace("  admin: AdminScreen,\n};", comps + "  admin: AdminScreen,\n};")
    p.write_text(t, encoding='utf-8')

# 3. frame.tsx group labels
p = P/'shell/frame.tsx'; t = p.read_text(encoding='utf-8')
old = "const GROUP_LABEL = { hospital: 'navGroupHospital', record: 'navGroupRecord', system: 'navGroupSystem' } as const;"
if old in t:
    t = t.replace(old, "const GROUP_LABEL = { hospital: 'navGroupHospital', services: 'navGroupServices', record: 'navGroupRecord', finance: 'navGroupFinance', management: 'navGroupManagement', system: 'navGroupSystem' } as const;")
    p.write_text(t, encoding='utf-8')

# 4. shell/messages.ts group texts (en, ckb, ar blocks in order)
p = P/'shell/messages.ts'; t = p.read_text(encoding='utf-8')
if 'navGroupServices' not in t:
    out = []; k = 0
    for ln in t.split('\n'):
        out.append(ln)
        if re.match(r"\s*navGroupSystem:", ln):
            ind = re.match(r"(\s*)", ln).group(1)
            for g,texts in GROUP_TEXT.items():
                out.append(f"{ind}navGroup{cap(g)}: '{texts[k]}',")
            k += 1
    assert k == 3, k
    p.write_text('\n'.join(out), encoding='utf-8')

# 5. i18n catalogues
for loc, idx in (('en',5),('ckb',6),('ar',7)):
    p = F/f'packages/i18n/src/messages/{loc}.json'; d = json.loads(p.read_text(encoding='utf-8'))
    for n in NEW: d[f'proto.nav.{n[0]}'] = n[idx]
    p.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for loc in ('ckb','ar'):
    p = F/f'packages/i18n/src/messages/review/{loc}.json'; d = json.loads(p.read_text(encoding='utf-8'))
    for n in NEW: d[f'proto.nav.{n[0]}'] = 'unreviewed'
    p.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 6. stub screens
MSG = '''/** Texts of the {en} screen (en, ckb, ar). AI-drafted ckb and ar, unreviewed. */
import {{ defineMessages }} from '../../i18n/use-t.ts';

export const messages = defineMessages({{
  en: {{
    title: {en_j},
    subtitle: {sub_j},
    placeholder: "This screen is being built.",
    placeholderBody: "The screen builder fills this in.",
  }},
  ckb: {{
    title: {ckb_j},
    subtitle: {sub_j},
    placeholder: "ئەم پەڕەیە لە دروستکردندایە.",
    placeholderBody: "دروستکەری پەڕەکە ئەمە پڕ دەکاتەوە.",
  }},
  ar: {{
    title: {ar_j},
    subtitle: {sub_j},
    placeholder: "هذه الشاشة قيد الإنشاء.",
    placeholderBody: "سيكمل منشئ الشاشة هذا الجزء.",
  }},
}});
'''
IDX = '''/**
 * The {en} screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type {{ ReactNode }} from 'react';
import {{ useT }} from '../../i18n/use-t.ts';
import {{ EmptyState, PageHeader }} from '../../ui/index.ts';
import './{i}.css';
import {{ messages }} from './messages.ts';

export function {comp}Screen(): ReactNode {{
  const t = useT(messages);
  return (
    <div className="{i}-screen">
      <PageHeader icon="{icon}" title={{t('title')}} subtitle={{t('subtitle')}} />
      <EmptyState icon="{icon}" title={{t('placeholder')}} body={{t('placeholderBody')}} />
    </div>
  );
}}
'''
for i,path,icon,c,comp,en,ckb,ar,sub in NEW:
    d = P/'screens'/i; d.mkdir(parents=True, exist_ok=True)
    if not (d/'index.tsx').exists():
        (d/'messages.ts').write_text(MSG.format(en=en, en_j=json.dumps(en), ckb_j=json.dumps(ckb, ensure_ascii=False), ar_j=json.dumps(ar, ensure_ascii=False), sub_j=json.dumps(sub)), encoding='utf-8')
        (d/f'{i}.css').write_text(f'.{i}-screen {{\n  display: grid;\n  gap: var(--hms-space-4, 16px);\n}}\n', encoding='utf-8')
        (d/'index.tsx').write_text(IDX.format(en=en, i=i, comp=comp, icon=icon), encoding='utf-8')
print('prewired', len(NEW))
