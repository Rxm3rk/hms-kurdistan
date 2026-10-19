import sys

p = sys.argv[1]
s = open(p, encoding='utf-8').read()
R = []


def r(old, new):
    R.append((old, new))


r('''- **P2:** transfer centre, kiosks, RTLS ingestion, same-gender clinician preference.
- **P3:** predictive discharge (K §4.3, §6.7).''',
  '''- **P2:** transfer centre, kiosks, RTLS ingestion (K §4.3); same-gender clinician preference (K §6.7).
- **P3:** predictive discharge (K §4.3).''')

r('''- **P2:** patient app, teleconsultation, referrer portal (no commission features), English dictation structuring.''',
  '''- **P2:** patient app, teleconsultation, referrer portal (no commission features), English dictation structuring (K §4.3).''')

r('''- **P2:** MCI/disaster mode; rule-based sepsis screen (Regulated Module #2).''',
  '''- **P2:** MCI/disaster mode; rule-based sepsis screen (Regulated Module #2) (K §4.3).''')

r('''- **R2a:** ADT and bed board, ward census, downtime, inpatient billing (deposits, packages, running bill, discharge billing).''',
  '''- **R2a:** ADT and bed board, ward census, downtime, inpatient billing (deposits, packages, running bill, discharge billing) (K §4.2).''')

r('''- **P2:** transfer centre; RTLS; English AI discharge drafts.''',
  '''- **P2:** transfer centre; RTLS; English AI discharge drafts (K §4.3).''')

r('''- **R1:** OPD orders.
- **R2b:** inpatient CPOE, site-wide only.
- **R2a Core:** orders on paper; pharmacy transcribes (module 7) (K §4.2, K-24).''',
  '''- **R1:** OPD orders (K §4.2).
- **R2b:** inpatient CPOE, site-wide only (K §4.2, K-24).
- **R2a Core:** orders on paper; pharmacy transcribes (module 7) (K §4.2).''')

r('''- **R1:** OP pharmacy POS (retail, dual currency, narcotics registers).
- **R2a Core:** IP dispensing against transcribed paper orders under the Core transcription control set; stewardship control set; receipt of patient-supplied medicines.''',
  '''- **R1:** OP pharmacy POS (retail, dual currency, narcotics registers) (K §4.2).
- **R2a Core:** IP dispensing against transcribed paper orders under the Core transcription control set; stewardship control set; receipt of patient-supplied medicines (K §4.2).''')

r('''- **P2:** Dose Engine; pumps (one vendor, orders never commands, only once BCMA ≥95%); ADC (I); chemotherapy; Ramadan mode (fasting-aware timing templates).
- **P3:** IV compounding (K §4.3, K-09, §6.7).''',
  '''- **P2:** Dose Engine; pumps (one vendor, orders never commands, only once BCMA ≥95%); ADC (I); chemotherapy (K §4.3, K-09); Ramadan mode (fasting-aware timing templates) (K §6.7).
- **P3:** IV compounding (K §4.3).''')

r('''- **R2b:** ICU flowsheet with nurse-validated vitals.''',
  '''- **R2b:** ICU flowsheet with nurse-validated vitals (K §4.2).''')

r('''- **P2:** severity scores; IHE ACM.''',
  '''- **P2:** severity scores; IHE ACM (K §4.3).''')

r('''- **R2a:** OT scheduling and OT billing.
- **R2b:** WHO checklist.''',
  '''- **R2a:** OT scheduling and OT billing (K §4.2).
- **R2b:** WHO checklist (K §4.2).''')

r('''- **R1:** OPD notes.
- **R2b:** inpatient notes; legal health record with manual ROI register.''',
  '''- **R1:** OPD notes (K §4.2).
- **R2b:** inpatient notes; legal health record with manual ROI register (K §4.2).''')

r('''- **P2:** dictation structuring; discharge drafts.''',
  '''- **P2:** dictation structuring; discharge drafts (K §4.3).''')

r('''MEOWS where the Register allows.''',
  '''MEOWS where the Register allows (K §4.2).''')

bad = []
for i, (old, new) in enumerate(R):
    c = s.count(old)
    if c != 1:
        bad.append((i, c, old[:70]))
if bad:
    for b in bad:
        print("NO-UNIQUE-MATCH", b)
    sys.exit(1)
for old, new in R:
    s = s.replace(old, new)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("applied", len(R), "replacements")
