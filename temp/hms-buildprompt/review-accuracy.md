# Accuracy and consistency review: BUILD-PROMPT.assembled.md

Independent review, 18 October 2026. Line numbers (L) refer to `BUILD-PROMPT.assembled.md`. Sources: `BLUEPRINT-KURDISTAN.md` v1.1 (K, read in full), `BLUEPRINT.md` v1.2.1 (BP, §4–§7 checked) and research R03, R08, R09 and R15 where a claim needed checking.

**Result: 19 findings (0 critical, 7 major, 12 minor).**

**Where the problems are:**
- three spec texts contradict SI-01, SI-05, SI-13 or SI-15;
- one readiness-gate item (RG1) is scoped wrongly;
- four K rules are missing from the build instructions:
  - the "no partial loop" rule;
  - the W2-K wedge path;
  - the never-descope lists;
  - DP#1's wedge topology.

**Checked and consistent (no action needed):**
- SI-01…SI-21 text and hazard links, against BP §5.1 and K §5.1.
- Control sets A, B and D, against K §4.2 and §5.6. Control set C is wrong only at RG1 and in R2b (finding 2).
- ADR-001 criteria, weights and thresholds (they sum to 100), against K §7.4.
- ADR-006, -008, -009, -012, -015, -021, -026, -027 and -028, against K §7.2.
- The RPO/RTO and SLO tables, against K §7.9–§7.10.
- RG2–RG4 and the Level-3 rollback triggers, against K §13.3.
- The release months in the §21 headings, against K §4.2 and §15.2.
- Appendix A totals, recomputed: R1 110 features / 1,606 eng-weeks; MVP 153 / 2,032; all 234 / 3,182. These match A.18.
- Every R1–P3 ID in Appendix A appears in the matching §21 phase.
- NEWS2 response bands, against R03 §8.
- The IEC 62304 class table, against R15 §2.3.
- Mock thresholds and the 1,000-bed day, against R15 §7.4 and §9.5.
- G1–G16 numbering, against R09 §5.4.
- CDS "fail open with a banner except hard stops" is sourced (BP §7.11; R08 §12).

---

## Major

### 1. Appendix B.3: the worked medication-administration spec lets an override bypass SI-01, SI-12, SI-13 and SI-15

- **Prompt.** App. B.3, L2723:
  `{from: scheduled, on: GiveWithOverride, guard: "override reason entered (never defaulted) AND witness if high-alert", to: completed}`
- **Sources.**
  - The prompt's own §8.4 (L688) keeps every check on the override path: "Active verified order or documented override with a non-defaulted reason (SI-02); wristband scan with two identifiers (SI-01); … high-alert independent double check (SI-13); unverified patient-supplied product unscannable (SI-12); offline only for orders verified before the outage (SI-15)".
  - K §5.1: SI-01, SI-12 (Kurdistan extension), SI-13 and SI-15.
  - K §6.6: "Administration is allowed only against orders verified before an outage."
- **What is wrong.**
  - §8.4 (L650) says to "generate property-test models" from each YAML spec.
  - B.3 is the worked example for the highest-risk state machine.
  - Its override transition needs no patient identification and swaps the recorded independent double check for a "witness".
  - It is also allowed offline without a pre-outage verified order, and it could be used to give an unverified family-bought medicine.
  - Property tests generated from this spec would accept all of these.
- **Fix.** Replace the line with:
  `{from: scheduled, on: GiveWithOverride, guard: "override reason entered (never defaulted) AND two identifiers confirmed (wristband scan, or a recorded manual two-identifier check with reason) AND (not high-alert OR independent double check recorded) AND (online OR order verified before the outage) AND (not patient-supplied OR received, identified and relabelled by pharmacy)", to: completed}`
  
  Then add the comment: `# An override replaces only the failed product scan or the missing verification (SI-02); it never waives SI-01, SI-12, SI-13 or SI-15.`

### 2. RG1 and the R2b work packages scope the stewardship control set (C) to Core sites only

- **Prompt.**
  - §18.13 RG1 (L2066): "control set A and 24×7 pharmacist cover confirmed (Clinical Safety sites) or the transcription double check (Core sites); control sets B and C configured (Core)".
  - §9.10 (L1003): "R2a … (control sets B and C); **R2b the closed loop** (… with control set A)".
  - WP-3.1 and WP-3.2 (L2204–2205) list control set A but not C.
- **Sources.**
  - K §5.2: "every site runs a stewardship control set: restricted antimicrobials need an indication and an approver at order entry (Clinical Safety sites) or at transcription (Core sites); a mandatory 48–72 h time-out task …; a hospital stewardship lead is named at RG1."
  - K §13.3 RG1: "stewardship lead named; Core transcription control set configured (Core sites)".
  - The prompt's own A.19 (L2638): "R2a (Core sites at transcription; Clinical Safety sites at order entry)".
- **What is wrong.**
  - Hospital A takes Core and Clinical Safety in one big bang at M37 (K §13.1), and CLN-AMS-01 does not arrive until P2 (≈M50).
  - As written, RG1 never checks control set C at a Clinical Safety site.
  - "Stewardship lead named" has been dropped from RG1.
  - No R2b work package builds the order-entry side of C (time-out task, stop/review date, DDD/DOT from CPOE orders).
- **Fix.**
  - **RG1 cell:** "…control set A and 24×7 pharmacist cover confirmed (Clinical Safety sites) or the transcription double check (Core sites); control set C configured and a hospital stewardship lead named (every site); control set B configured (Core sites); …".
  - **§9.10:** "R2b the closed loop (… with control set A, and control set C at order entry)".
  - **WP-3.1 exit evidence, add:** "control set C at order entry: indication and approver for restricted antimicrobials; 48–72 h time-out task; stop/review date on every antimicrobial order; DDD/DOT report including CPOE orders".

### 3. NICU and paediatric text implies the system does dose arithmetic before the Dose Engine

- **Prompt.**
  - §9.17 (L1148): "weight-based dosing displayed with appropriate decimal precision (for example 0.1 mL/h) but **computed only under control set A** … until the Dose Engine".
  - SAC-13 (L1924): "Paediatric doses use defined decimal rounding and corrected age | SI-05". It has no phase qualifier, unlike SAC-12.
- **Sources.**
  - K §5.1 SI-05: "dose arithmetic only in the Dose Engine". The Dose Engine is P2.
  - K §5.6, fallback item 2: "with the KB output shown verbatim and no local arithmetic".
  - BP §5.6: "the system itself does no dose arithmetic".
  - The prompt's §10.3 A1: "The system performs no dose arithmetic".
  - The prompt's §10.4 puts "rounding" inside `reg-dose` (P2).
  - K §4.3 still lists "paediatric weight-based rounding" under MVP nursing. That is left over from BP, where the Dose Engine was in the MVP.
- **What is wrong.** Both texts read as "the system calculates or rounds paediatric and neonatal doses in the MVP while control set A runs". That contradicts SI-05 and fitness function #1, and it is the 10× hazard the fallback exists to prevent. The agent must either build arithmetic outside `reg-dose` or weaken the static-analysis rule.
- **Fix.**
  - **§9.17:** "…weight-based doses are never calculated, converted or rounded by the system before the Dose Engine. The KB range is shown verbatim, the pharmacist records an independently calculated dose under control set A, and the screen displays the entered value and unit (for example 0.1 mL/h precision) without recomputing it."
  - **SAC-13:** "Paediatric dose rounding only inside `reg-dose` from P2. Until then, corrected age is displayed and rounding is the pharmacist's documented decision under control set A | SI-05".
  - **A.20:** record K §4.3's "paediatric weight-based rounding" as a source conflict, resolved in favour of SI-05.

### 4. K-24's "no partial loop" is stated as rollout advice but never engineered

- **Prompt.**
  - §6.6 (L551): "Configuration chain: … facility → department → unit → user. The most specific value wins unless a parent has locked it. Safety invariants and Tier 2 activation are vendor-locked."
  - §9.5 (L892): "inpatient CPOE, activated site-wide only, never unit by unit"; §9.10 (L1033): "Rollout is site-wide only".
  - No section defines the Core / Clinical Safety tier as a single locked setting.
- **Sources.**
  - K-24: "Two tiers, no partial loop: • Core HIS: clinical orders on paper. • Clinical Safety: CPOE, verification, eMAR/BCMA and transfusion, activated site-wide only."
  - K-21: "Unit-by-unit BCMA and a mixed paper/electronic MAR are unsafe (R15 §10.3; RL #11)."
- **What is wrong.** Unit-level configuration plus per-feature flags lets someone enable CPOE, eMAR/BCMA or transfusion verification for one unit, or CPOE without BCMA. That creates the mixed paper/electronic MAR K forbids. Rollout prose does not prevent a configuration change made after go-live.
- **Fix.** Add to §6.6 and §9.10:
  > **Clinical tier** (`CORE` | `CLINICAL_SAFETY`) is a facility-level setting, vendor-locked against department, unit and user override.
  > - `CLINICAL_SAFETY` turns on CPOE, pharmacist verification, eMAR/BCMA and transfusion together for every inpatient area of the facility (T1 always; T2 where the Register allows). That includes ED, OT/PACU, L&D, ICU and NICU/PICU. None of these can be enabled alone.
  > - `CORE` exposes no MAR, schedule or active-medicines view (control set B).
  > - Changing the tier is a governed change that needs RG1–RG4 evidence.
  > - Tests: no configuration state allows a facility with CPOE but not eMAR/BCMA, or a MAR on any unit of a `CORE` facility.

### 5. The W2-K wedge (K's default) and W3-K are missing from the build sequence

- **Prompt.**
  - §21 Phase 2 heading (L2189): "R2a inpatient Core (code-complete M24; first live M27)".
  - WP-2.6 (L2198): "W2-K hazard-analysis evidence prepared [HUMAN: DP#1's CSO]".
  - §23 Q-K1 (L2266): "Support both wedges …".
- **Sources.**
  - K-20: "W2-K (if DP#1 has none): Core HIS across hospital A at ≈M24 … R2a is pulled forward to code-complete at M21, and a W2-K hazard analysis is signed before RG1."
  - K §4.2: "Code-complete M24 (M21 if W2-K)".
  - K §19.2 Q-K1, default if unanswered: "W2-K: Core HIS across hospital A at ≈M24".
  - K §13.1 W3-K: "OPD-only at hospital A, with lab and imaging staying on legacy … with its order and result seam controls".
  - K §13.1, seam hazard analysis: "completed before G1 and signed by DP#1's CSO before wedge RG1".
- **What is wrong.**
  - Under W2-K, the first go-live is R1 plus R2a across hospital A.
  - Phase 2 must therefore be complete by the first RG1 at M21, and the W2-K hazard analysis must be signed before that RG1. It belongs there, not in R2a hardening.
  - W3-K and the W1-K/W3-K seam hazard analysis are not mentioned anywhere.
- **Fix.** Add under §21 Phase 1:
  > **Wedge variant (Q-K1).** W1-K (DP#1's polyclinic, live M22) is the plan.
  > - **W2-K.** If DP#1 has no satellite, run W2-K. W2-K is also K's default while Q-K1 is open. Phase 2 (R2a) completes together with Phase 1, code-complete at M21. M21 is the first RG1, and go-live is across hospital A at ≈M24 with clinical orders on paper. DP#1's CSO signs the W2-K hazard analysis (transcription seam, control set B) before that RG1 [HUMAN].
  > - **W3-K.** OPD-only at hospital A, with lab and imaging on legacy. This is the last resort and adds BP's order/result seam controls through `INT-SEAM-01`.
  > - **Seam hazard analysis (W1-K and W3-K).** It covers H15, is completed before G1 and is signed before wedge RG1 [HUMAN].

  Change the Phase 2 heading to "(code-complete M24, or M21 under W2-K; first live M27)". Change the Q-K1 default to "Build for W1-K and keep W2-K buildable; K's default if unanswered is W2-K (§21)".

### 6. K's descope rules are misquoted, and the never-descope lists are missing

- **Prompt.** §21 (L2140): "If capacity falls short, use K's descope rules: nothing in R1.1 or R2.1 is a safety control or statutory register, and every item there has a manual path on go-live day (K §4.2)."
- **Source.** K §14.2, "Descope rules, agreed now":
  - review points at M10, M12, M15, M28 and M32;
  - "Wedge second-line item: report release over WhatsApp and Viber (printed release at the counter on go-live day)";
  - "Never descoped in the wedge: EMPI and the seam controls; referral tracking; the Trust Plane and audit; downtime blocks; the critical-result service; ledger integrity, including dual-currency drawers; narcotics registers, and the KRG statutory items the wedge's services trigger";
  - "Never descoped in the inpatient release: anything in the closed loop; SI-01 to SI-21 and their fallback control sets; the MLC register and birth and death notifications; the downtime suite; readiness tooling; on-site cell resilience";
  - "go-live moves within its window … We never compress test cycles or training."
- **What is wrong.** The text the prompt cites is K §4.2's description of what R1.1 and R2.1 contain; it is not a descope rule. An agent short of capacity has no list of what it must never cut.
- **Fix.** Replace the sentence with:
  > If capacity falls short, apply K §14.2.
  > - **The only pre-agreed wedge descope** is report release over WhatsApp/Viber; on go-live day, reports are released in print at the counter instead.
  > - **Never descope in the wedge:** EMPI and the seam controls; referral tracking; the Trust Plane and audit; downtime blocks; the critical-result service; ledger integrity, including dual-currency drawers; narcotics registers and the KRG statutory items the wedge triggers.
  > - **Never descope in the inpatient release:** anything in the closed loop; SI-01…SI-21 and their fallback control sets; the MLC register and birth and death notifications; the downtime suite; readiness tooling; on-site cell resilience.
  > - **Any other cut** is a [HUMAN] decision recorded in `DECISIONS-NEEDED.md`. Dates move inside their window; test cycles and training never shrink.

### 7. The DP#1 wedge topology (polyclinic attached to hospital A's cell) is missing

- **Prompt.**
  - §5.1 (L381): "Site edge agent | For outpatient-tier sites on the pooled tier …".
  - WP-1.13 exit (L2179): "edge agent for a pooled-tier polyclinic".
- **Sources.**
  - K §7.8: "DP#1: its group tenant runs on a cell installed at hospital A, burn-in tested by M18, before the wedge RG1 at M19, and live at M22. The polyclinic connects over metro links with a site edge agent."
  - K §4.2 R1: "a stand-alone polyclinic uses the pooled tier with a site edge agent".
  - K §15.2 M18: "on-site cell installed at hospital A, serving the polyclinic".
- **What is wrong.** The first go-live runs on hospital A's on-site cell, with the polyclinic attached over metro links. The pooled tier is for stand-alone outpatient customers, the first at ≈M27. WP-1.13 verifies only the pooled-tier case, so the wedge's real topology, and what happens when a metro link fails, is never built or tested.
- **Fix.**
  - **§5.1, Site edge agent row:** "For outpatient-tier sites on the pooled tier, and for a group's outpatient site attached to the group's hospital cell over metro links (DP#1's polyclinic, K §7.8)".
  - **WP-1.13 exit:** replace "edge agent for a pooled-tier polyclinic" with "edge agent for (a) a polyclinic attached to a hospital cell over metro links (DP#1's wedge topology, including metro-link loss with continuity and downtime blocks) and (b) a stand-alone polyclinic on the pooled tier".

---

## Minor

### 8. §10.4 puts `reg-screening` at R2b, contradicting the R1 pull-forward

- **Prompt.**
  - §10.4 (L1448): "`reg-screening` | R2b (R2a at transcription)".
  - §9.10 (L1009), WP-1.5 (L2171) and A.4 (`CLN-CDS-01`/`-02`, "Placed R1: [P]") all run screening in R1.
- **Source.** K §5.6: activation needs a "Drug-KB contract with the vendor's written regulatory position, which may be 'not registered'".
- **What is wrong.** This Tier 2 table tells the agent when to build the sidecar and seed its Register entry, and it says R2b. R1 outpatient screening could therefore land in Tier 1 `cds`, or be activated without a Register entry.
- **Fix.** Change the row to: "R1 (outpatient e-prescribing, [P]); R2a at transcription; R2b full inpatient. A Register entry with the KB vendor's written regulatory position is required before wedge RG1."

### 9. The §9.13 acceptance test checks only one of the statuses that block activation

- **Prompt.** §9.13 (L1096): "a score with care-plan triggers never auto-orders anything while the Register says "not-assessed"".
- **Source.** SI-18 (K §5.1; prompt L160) allows activation only on "cleared" or "not required". §10.2 also lists `required` and `withdrawn`.
- **Fix.** "…never auto-orders anything unless the Register says `cleared` or `not-required` for that tenant (tested for `not-assessed`, `required` and `withdrawn`)."

### 10. Offline "temporary identifiers" conflict with SI-15

- **Prompt.** §15 (L1762): "Offline registrations get temporary identifiers that go to a reconciliation queue."
- **Sources.**
  - SI-15 (K §5.1; BP §5.1): "no identifiers outside pre-allocated blocks".
  - K §7.5: downtime numbers carry a site prefix.
  - The sentence copies R08 §6.3 #3, which does not apply this rule.
- **Fix.** "Offline registrations take identifiers only from the pre-allocated, site-prefixed downtime blocks (SI-15, SAC-06) and go to a reconciliation queue. Nothing generates an MRN or encounter number outside a block."

### 11. AI work is unlocked at go-live (M37) instead of after G3

- **Prompt.**
  - §17.2 (L1842): "Platform (P2, after the Clinical Safety go-live) … MUST at AI GA (§13.6)".
  - The AI items in §21 Phase 5 carry no gate.
- **Sources.**
  - K-23: "AI in P2, after G3". Its rationale: "The inpatient MAR go-live is the cognitive-load peak."
  - K §11.2: "P2 (from ≈M42, after G3)".
  - K §15.1: G3 (exit M40) unlocks "AI work starts".
- **Fix.** "Platform (P2, starting only after G3: hospital A's 90-day stabilisation and independent assessment, ≈M40; work from ≈M42) … MUST at AI GA (§17.3)." Add the same gate to the AI items in Phase 5.

### 12. The tax default omits K's counsel gate before R1

- **Prompt.**
  - §9.21 (L1219): "zero-rate default until Q-K6 is answered".
  - §23 Q-K6: "A configurable tax and receipt engine with zero-rate default".
- **Sources.**
  - K §12.1: "The current treatment of hospital services is confirmed with local tax counsel before R1 (Q-K6)".
  - K §19.2 Q-K6 default: "Configurable tax engine; counsel opinion before R1".
- **Fix.** Q-K6 default: "Configurable tax and receipt engine; the zero rate is a development default only. A tax-counsel opinion is a [HUMAN] prerequisite for R1 go-live and is listed in the wedge RG1 evidence."

### 13. ADR-003 silently moves RCM from a satellite into the monolith

- **Prompt.**
  - ADR-003 (L336): "The Integration Hub, document renderer, AI gateway (P2) and analytics are satellites."
  - §5.2 makes `rcm`, `supply` and `finance-export` in-process Modulith modules.
- **Sources.**
  - BP §7.2 ADR-003: "RCM, Hub, AI gateway, analytics and documents are satellites".
  - K §7.2: ADR-003 keeps BP's text.
- **Fix.** Do one of these:
  - restore "RCM is a satellite" in ADR-003 and §5.2; or
  - mark in-process RCM as [P], with an ADR recording the blast-radius argument (an RCM fault must never stall ADT, order or MAR commands, SI-12) and a `DECISIONS-NEEDED.md` entry.

### 14. ADR-001 and ADR-010 omit the C9 fallback rule

- **Prompt.**
  - ADR-001 (L334): the reopen rule covers C2 only.
  - ADR-010 (L343): "Reopen if: C9 fails …", with no fallback stated.
  - WP-0.6 exit: "or the reopen rule is triggered".
- **Source.** K §7.4: "If C9 fails for Option A, the ADR-009 and ADR-010 fallbacks apply before any reopen: NATS JetStream for Kafka, and lighter workflow persistence."
- **Fix.**
  - **ADR-001 reopen cell, add:** "If C9 fails for Option A, apply the ADR-009 (NATS JetStream) and ADR-010 (lighter workflow persistence) fallbacks and re-run C9 before any ADR-001 reopen."
  - **ADR-010, add:** "Fallback if C9 fails: lighter workflow persistence behind the same `WorkflowPort`."

### 15. §9.25 builds implant recall in the MVP, but ERP-IMP-01 is P2

- **Prompt.**
  - §9.25 Build (L1262): "Implants and recall: … recall workflow (search by GTIN and lot → … notify clinicians)".
  - §9.25 Acceptance (L1269): "a recall finds every patient who received an affected lot".
- **Source.** The prompt's own A.11 places `ERP-IMP-01` ("Implant/UDI capture; consignment; recall trace") in P2, and A.20 says "UDI recall trace in P2".
- **Fix.** Label the recall workflow and that acceptance clause "P2 (`ERP-IMP-01`)". Keep UDI capture on the intra-op record (SAC-40, `SPC-OT-03`) in the MVP. If recall is wanted earlier, mark it [P] and move ERP-IMP-01's recall part in Appendix A.

### 16. AI-PAT-01 keeps BP's "templated then AI" patient text

- **Prompt.** A.14 (L2569): "`AI-PAT-01` | Result explanations | … | Result explanations (templated then AI)".
- **Sources.**
  - K §11.2: patient text comes "from a vetted template library. AI may *suggest* a template; any new text is approved by a bilingual clinician before use … No free machine translation of clinical instructions".
  - K §11.3: "Never: AI that … messages patients".
  - K SI-21: labelled results and pregnancy tests are never released by message.
- **Fix.** Replace the note with: "Kurdistan scope: templated explanations only. AI may suggest a template, never generate patient text. Never used for SI-21-labelled results or pregnancy tests. Released only through the §9.30 rule (G10, SI-07)."

### 17. ADR-004's revert triggers drop "any C1 miss"

- **Prompt.** ADR-004 (L337): "Tooling >8 engineer-weeks; BCMA p95 >500 ms; upcasting >20% of medication capacity".
- **Sources.**
  - BP §7.6: "Revert triggers: … upcasting >20% of the medication squad's capacity; any C1 miss".
  - K §7.2 keeps ADR-004 unchanged.
- **Fix.** Append "; any C1 miss".

### 18. dcm4chee's licence is not on the allowlist the prompt enforces

- **Prompt.**
  - §4.1 (L322): "dcm4chee (MPL-1.1) or an unmodified Orthanc container".
  - §4.3 allowlist: "Apache-2.0, MIT, BSD, ISC, MPL-2.0, LGPL, EPL, OFL".
  - §3.4 #2 makes any non-allowlisted dependency a stop-and-ask, yet WP-1.8 uses "an Orthanc or dcm4chee container".
- **Source.** K §7.6, which inherits the same pair from BP §7.7.
- **Fix.** Add to §4.3: "MPL-1.1 only as an unmodified, separate container (dcm4chee), recorded in the licence register". Alternatively, drop dcm4chee from §4.1.

### 19. Wrong cross-references and IDs

| Line | Now | Change to |
|---|---|---|
| L330 | "until their spike criteria pass in WP-0.5" | "WP-0.6" (the spike harness is WP-0.6, L2154) |
| L1842 | "MUST at AI GA (§13.6)" | "(§17.3)" |
| L1518 | "(ACC/CLN-QI-01)" | "(`CLN-QI-01`)" |
