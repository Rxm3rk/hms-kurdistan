### Review-added control sets (no IDs; +15 squad PM in total; K §4.1)

| Control set | Phase | Scope | Source |
|---|---|---|---|
| Core transcription control set | R2a | Pharmacists alone transcribe, attaching the signed-order image; KB screening plus the dosing double check; ordering practitioner mandatory; second check on high-alert and paediatric orders; no MAR or "active medicines" view; 50 orders audited monthly | K §4.2; KDV-16 |
| Stewardship control set | R2a | Indication and approver for restricted antimicrobials (at order entry on Clinical Safety sites, at transcription on Core sites); 48–72 h time-out; stop or review date; monthly DDD/DOT; lead named at RG1 | K §4.2, §5.2 |
| Patient-supplied medicine workflow | R2a | Pharmacy receives, identifies, expiry-checks, relabels and flags "patient-supplied"; unverified outside medicines cannot be scanned; no payment rule delays a time-critical dose | K §4.2, §12.1; SI-12 |
| KB ≥10× hard stop | R2b | A drug-KB result ≥10× the maximum dose is a Tier A hard stop; KB output shown verbatim, no local arithmetic | K §5.6 item 2 |
| Pharmacist-cover alarm | R2b | Alarm if no pharmacist is logged in to the verification queue for >30 min; review within 4 h of any dose given before verification | K §5.6 item 4 |

The base **extended Dose Engine fallback control set** runs until the engine is active at a site (≈M50). It has three parts: a system-enforced pharmacist double check on every weight- or BSA-based dose, high-alert infusion and neonatal order; seeded 10× and unit errors in every test cycle; and 24×7 pharmacist cover as an RG1 obligation. Core sites apply the double check at transcription (R2a); Clinical Safety sites run the whole set (R2b). It is costed in K's −26 PM Dose Engine/stewardship line, not in the +15 (K §4.1, §5.6).

## 3. Totals

Per-feature sums of the rows above. KRI-ID-01 counts at +12 net; PLT-SITE-01 counts at 28 because PLT-OPS-02 has its own row.

| Phase | IDs | ew | Note or K's stated figure |
|---|---|---|---|
| R1 | 98 | 1,496 | — |
| R1.1 | 2 | 11 | Most R1.1 content is sub-functions of R1 rows |
| R2a | 10 | 111 | — |
| R2b | 23 | 238 | — |
| R2.1 | 6 | 55 | — |
| MVP? | 14 | 121 | — |
| **MVP** | **153** | **2,032**; **2,048** with +16 ew of kept BP in-ID additions (calendars 4; R03 §19/R11 §15 items 12) | ≈2,060 ew before control sets; **≈1,372 PM** incl. +15 PM control sets (K §4.1) |
| P2 | 48 | 558 (incl. 3 ew scheme part) | 543 ew, ≈400 PM (K §14.2) |
| P3 | 19 | 266 | 258 ew, ≈190 PM (K §14.2) |
| DROPPED-K | 14 | 326 (incl. 3 ew PHR part); also NPHIES claim types 8, DLT 4, DX-LAB-04 −12 | K §4.1: −99 rails, −40 market additions. K §14.2: −8 e-Rx, −150 US/EU, −50 compatibility engine |
| **All** | **234** (BP 222 + 12 K-new) | 3,182 | — |

**Reconciliation with K's figures.**
- **MVP 2,048 vs ≈2,060.** −20: K §4.1 costs the AI gateway and control plane at 20 ew; R14 sizes AI-GW-01 + AI-GOV-01 at 40. +8: INT-IPS-01 is in the MVP here (per K §4.3 and §9), but K §4.1 does not move it.
- **P2 558 vs 543.** +20 (the same AI sizing); −8 (INT-IPS-01); −8 (AI-NUR-01 moved to P3); +11 (K's unnamed "KSA and UAE P2 items").
- **P3 266 vs 258.** +8 (AI-NUR-01).
- **R1 share.** First-release attribution puts R1+R1.1 at ≈74% of per-feature MVP ew. K §4.2 puts the wedge at ≈48% of MVP effort (≈660 of ≈1,372 PM), and BP §4.2 counted platform features as only "partly exercised" in the wedge.
- **Release PM** (K §4.2): R1 ≈660 (≈560 + ≈100 in R1.1); R2a ≈85; R2b ≈540; R2 ≈625; R2.1 ≈80; Iraq pack ≤40.

**Lineage.**
- R14: 140 / 54 / 20 = 214 IDs; 1,875 / 611 / 400 ew. Only the MVP ew is stated in R14; P2 and P3 ew are computed from Appendix A.
- BP: 154 / 47 / 21 = 222 IDs; 2,149 / 523 / 450 ew.
- K: computed here as 153 / 48 / 19 plus 14 dropped = 234. K states no feature counts.

**K's ID-level changes.**
- **Dropped (14).** From the MVP: ACC-OPD-02, INT-ABDM-01, INT-SEHE-01, INT-UAE-01, RCM-NAT-01/02/03, MED-TNT-01, RCM-GRP-01. From P2: MED-ERX-01. From P3: RCM-US-01, INT-EU-01, INT-US-01, DX-BB-03b.
- **Out of the MVP.** To P2: AI-GW-01, AI-GOV-01, AI-DCS-01, MED-DOSE-01, CLN-AMS-01. To P3: AI-AMB-01.
- **Into the MVP from P2.** PLT-OPS-02; INT-IPS-01 (K §4.3 only).
- **P2 → P3.** AI-NUR-01 (K §4.3 only).
- **New (12).** The eight KRI-* IDs, plus PLT-SITE-01, PLT-PWR-01, MED-KRI-01 and DX-BB-KRI-01.
- **Content replaced at the same size.** ACC-ID-02, TRU-SEC-03, RCM-TAX-01, CLN-QI-01, MED-CS-01, OPS-STAT-01.
- **Re-scoped, not re-sized.** PLT-UX-03, RCM-CSH-01, RCM-INS-01, DFD-PAY-01, MED-OPP-01, RCM-COD-01, SPC-MAT-01, SPC-DTH-01, IMP-FND-01.
- **Trimmed.** RCM-SCH-01 (scheme part to P2); DFD-REC-01 (PHR push dropped).
- **Kept with Kurdistan content.** OPS-STAT-02.

## 4. Could not place, and conflicts

**MVP features with an undeterminable release (14):** PLT-UX-04, TRU-SEC-02, TRU-SEC-03, CLN-CDS-03, CLN-DOC-02, CLN-IPC-01, CLN-ACP-01, CLN-INC-01, CLN-QI-01, MED-KRI-01, DX-BB-02, DFD-BOK-01, IMP-TEL-01, KRI-LOC-02.

**Items with no feature ID:**
- **K's first AI SKUs and platform parts (all P2):** dictation structuring, insurer document-pack assembly, template-based patient instructions, no-show outreach, grounding service, HITL UX kit (K §4.3, §11.2).
- **Iraq federal pack:** federal returns, insurance adapter, practitioner fields, Arabic-first review (K §4.2).
- **Placed, but without IDs:**
  - P2: IHE ACM reporter/consumer; referrer portal with no commission features; Ramadan mode and same-gender preference (K §6.7); cross-referenced group identities (ADR-006); regional-cloud ciphertext backups (K §7.8).
  - R2b: chaperone documentation and guardian consent (K §6.7).
  - P3: federated benchmarking; app marketplace; partner-only triage AI.
- **Not attributable to one release:** BP's kept in-ID additions (+16 ew).
- **Unidentifiable:** K §14.2's "KSA and UAE P2 items (11)". No KSA/UAE-only P2 ID remains in Appendix A once BP moved RCM-GRP-01 to the MVP. BP §4.3's P2 lists Hajj/Umrah surge mode, the Seha/Sehhaty exchange and UAE PASS login without IDs.

**Conflicts and ambiguities:**
1. **AI platform size.** K §4.1 moves "AI gateway and control plane (20)" to P2, but R14 App. A sizes AI-GW-01 L + AI-GOV-01 L = 40 ew.
2. **INT-IPS-01.** MVP "from day one" (K §4.3, §9) vs no move in K §4.1 and an unchanged P2 total (K §14.2).
3. **AI-NUR-01.** P3 (K §4.3) vs P2 arithmetic unchanged (K §14.2).
4. **CLN-CDS-07.** P2 (K §4.3) vs P3 "AI-3 device-grade" (K §11.2).
5. **OPS-PRD-01.** Predictive discharge P3 (K §4.3) vs capacity and length-of-stay forecasts P2 (K §11.2 AI-0).
6. **OPS-RTL-01.** P3 in the R14/BP/K counts vs "RTLS ingestion" P2 (BP §4.3; K §4.3, §9.2).
7. **DX-BB-02.** Kept in K §4.1 arithmetic vs "no interface assumed" (K §9.1) and relabelling instead (K §4.3).
8. **ACC-ID-02 vs KRI-ID-01.** ACC-ID-02 is kept at M (K §4.1) while KRI-ID-01 is L "+12 net over ACC-ID-02"; K does not say whether ACC-ID-02 survives as a separate ID.
9. **DFD-MSG-01.** K §4.1 drops BP's +4 as "DLT template governance", but BP §4.1's +4 also covered OTP/expiring-link release, which K §4.2 and §9.2 keep.
10. **DX-LAB-04.** Back to M (K §4.1) vs K §4.3 keeping EQA, rejection register, amended-report audit and TAT per test (BP §4.1 NABL-pack items).
11. **DEV-GW-01.** R14 makes it a dependency of SPC-ICU-01; K puts the ICU flowsheet in R2b but the validated monitor feed in R2.1.
12. **TRU-AUD-02.** Privacy-monitoring analytics is a MUST at GA (K §10) vs privacy monitoring in P2 (K §4.3).
13. **ERP-IMP-01.** Consignment is in MVP procurement-lite (K §12.2) vs ERP-IMP-01, which includes consignment, at P2.
14. **IMP-CRT-01.** Academy live by M36 (K-30; K §13.7) vs the P2 window M38–M54 (K §4.3).
15. **PLT-OPS-03.** K §4.3 drops BP's P3 "edge cell" vs the multi-site edge cell staying P3 (K §7.8; KDV-2; K §14.2).
16. **CLN-DOC-02.** BP §4.2 put the bloat indicator in R2.1; K §4.2 R2.1 omits it, while K §4.3 keeps copy-forward provenance in the MVP.
17. **Omissions from K §4.3.** These IDs are missing from K §4.3 but kept by K §14.2 arithmetic. P2: DX-RIS-03, ERP-FIN-03, AI-SUM-01, AI-PAT-01, DFD-CRM-01, INT-PH-01. P3: DEV-SDC-01, AI-INB-01.
18. **Citations.** K §4.1 cites R14 "replace", "market-gated" and "re-scope" lists. R14 has no replace or re-scope list; its market-gated IDs appear only in §1 #2 and the §5 YAML.
