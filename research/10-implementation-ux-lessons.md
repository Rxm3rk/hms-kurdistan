# 10. Usability & Clinician Experience, Implementation Methodology, and Lessons from Global Successes and Failures

**Track:** Usability and clinician experience (CX), implementation methodology, and global case studies
**Prepared:** 2026-10-16
**Audience:** HMS product, design, engineering, and implementation-services leadership
**Status:** Research input. This is not a final design specification.

> **Method and evidence-quality note.**
> Sources were prioritized in this order: peer-reviewed literature (JAMA Network, JAMIA, Annals of Family Medicine, Mayo Clinic Proceedings, BMJ, Pediatrics); KLAS Arch Collaborative reports from 2023 to 2026; ASTP/ONC; NIST; ECRI; US GAO and VA; and national-program documentation.
> About 95 primary-source fetches were made. The session's shared web-search quota ran out early, so only a few keyword searches were executed. As a result:
> - The **post-go-live performance of VA's 2026 deployment waves** could not be verified.
> - Some non-English audit reports (Danish Rigsrevisionen, Queensland Audit Office, ACT Audit Office) could not be read in full.
>
> Each claim affected by these gaps carries a flag.
>
> **Pass-2 verification (2026-10-16).** About 30 claims were re-checked against primary sources: abstracts via Europe PMC, the VA schedule, the VA OIG and GAO reports, KLAS report pages, ECRI, ONC, NIST, W3C, CRS, and Synapxe. Corrections were made in place, and `‡` tags were removed where a claim is now verified. See the verification log at the end of the document.
>
> **Conventions:**
> - **[n]** = numbered source in Section 11.
> - **‡** = analyst knowledge or secondary reporting that was **not re-verified in this session**. Verify it before external use.
> - **Est.** = analyst estimate or industry heuristic, not a measured value.

---

## 1. Executive summary

1. **EHR usability is poor, and that harms clinicians.**
   - US physicians gave their EHRs a mean System Usability Scale (SUS) score of **45.9**. That is a grade of "F" and in the bottom 9% of software studied [1].
   - US nurses gave **57.6**, also an "F" [2].
   - Each 1-point SUS improvement is associated with **3% lower odds of burnout for physicians and 2% for nurses** [1][2]. Usability is therefore a workforce-retention issue, not a cosmetic one.
2. **EHR work consumes a large share of the clinical day.**
   - Family physicians spent **5.9 hours of an 11.4-hour workday** in the EHR, including **86 minutes after hours** [4].
   - From 2019 to 2023, per 8 scheduled hours, total EHR time rose **7.8%**, inbox time **24.4%**, and order time **58.9%**. Patient advice requests rose **55.5%** [5].
3. **Much of the burden comes from documentation norms, not from the software alone.** On the same vendor platform, US clinicians compared with non-US clinicians:
   - spent **90.2 vs 59.1 minutes per day** in the EHR;
   - had **77.5% vs 60.8%** of note text auto-generated;
   - received **33.8 vs 12.8** in-basket messages per day [8].

   **Implication:** our documentation model must be configurable by jurisdiction, not hard-wired to US billing norms.
4. **Note bloat is systemic.**
   - At Penn, **50.1% of all note text was duplicated** from earlier notes, rising from 33% in 2015 to 54% in 2020 [13].
   - At OHSU, median note length grew **60%** in a decade. **56% of note text was templated** and only 29% was typed [12].
5. **Alert fatigue persists.**
   - Clinicians override drug alerts in **49% to 96%** of cases [14].
   - In one outpatient study, **52.6%** of alerts were overridden, and only about **53%** of those overrides were judged appropriate [15].
   - In 2018, hospital CPOE systems still caught only **65.6%** of potentially harmful test orders on the Leapfrog evaluation tool [17].
6. **Usability defects cause harm.**
   - In 1.735 million safety reports, **557 explicitly implicated EHR usability**. The main categories were data entry (27%), alerting (22%), and interoperability (18%) [16].
   - ECRI's **2026** Top 10 Health Technology Hazards ranks:
     - **#1:** misuse of AI chatbots;
     - **#2:** "digital darkness," meaning a sudden loss of electronic systems;
     - **#9:** "health technology implementations that prompt unsafe clinical workflows" [21].
7. **The best organizations do more than pick a vendor.** KLAS's dataset of more than 700,000 clinician responses shows that satisfaction rests on a fast, reliable system plus training, personalization, and governance.
   - Physicians satisfied with initial training agree **176% more often** that the EHR is easy to learn [30].
   - Physicians satisfied with ongoing training agree **124% more often** that it makes them efficient [30].
   - At Level 6 ("Elite") organizations, **70%** of physicians say the EHR enables efficiency, compared with **26%** at Levels 1–3 [31].
8. **Implementations are getting harder, not easier.**
   - Only **38%** of organizations say their recent implementation "hit the mark."
   - **73%** of newly live organizations (n=22) had below-average Net EHR Experience Scores (NEES).
   - **75%** of *individual clinicians* who were dissatisfied with their implementation still reported low overall EHR satisfaction two or more years later [28].
9. **Ambient AI is the clearest recent improvement for physicians, but only with training.**
   - In a six-system study, burnout fell from **51.9% to 38.8%** after 30 days of ambient scribe use. This was a before/after quality-improvement study with no control group, 263 clinicians analyzed, and 186 in the burnout analysis [18].
   - In KLAS data, AI users scored a NEES of **72.2** vs **64.9** for non-users.
   - Fewer than **25%** of AI adopters say they were adequately trained.
   - Among ambient users, NEES ranges from **46.7 to 89.7** depending on whether they know how to optimize the tool [39].
10. **Nurses are the under-served majority of users.**
    - **79%** of more than 80,000 acute-care nurses report losing time to unproductive charting.
    - Removing fields works. Mercy saved **32 minutes per nurse per day**. Wooster removed **96 fields** and saved **more than 15,000 hours a year** [37].
11. **VA–Oracle status, verified against the VA schedule dated 15 Sep 2026.**
    - After a three-year pause, **11 VA medical centers went live** in 2026:
      - 4 in Michigan on 11 Apr;
      - 4 in Ohio and Kentucky on 6 Jun;
      - 3 in Indiana on 22 Aug.
    - **Anchorage and Cleveland are scheduled for 24 Oct 2026.**
    - **26 sites are planned for 2027**, with all 170 by November 2031 [48].
    - The latest cost estimate is **about $37 billion** [50].
    - In August 2026 VA added three option years and **$17 billion** to the Oracle contract, raising its total value to **just under $27 billion** [84].
    - **Post-go-live performance of the 2026 waves:** no independent assessment (OIG, GAO, or press) had been found as of 16 Oct 2026. VA calls clinician feedback at the Michigan sites "exceptionally positive," but that is VA's own report [85]. Treat performance as **unverified** (‡).
12. **Nordic programs show the failure pattern.**
    - Norway's **Helseplattformen** (Epic) received the Auditor General's most serious criticism, *"sterkt kritikkverdig,"* in October 2024. Total preparation, development and rollout costs across health trusts, municipalities and GPs were estimated at **about NOK 6.7 billion** by Oct 2024, against an **original budget frame of NOK 4.1 billion** [93]. *(Reconciled 2026-10-16: NOK 1.7B was the original system acquisition-cost estimate [61], not the programme budget. See the cost table in `01` §9.2.)*
    - **Västra Götaland** (Sweden) halted Oracle's Millennium three days after its November 2024 go-live. It paused the program indefinitely in February 2025 and **terminated the contract in August 2026, paying Oracle SEK 657 million**. Region Skåne cancelled its plans in March 2026 [62].
13. **Successes share a profile:**
    - executive and clinician ownership;
    - an enterprise-standard "one system" design;
    - heavy investment in training and superusers;
    - continuous optimization;
    - patience with a multi-year effort.

    Examples include Kaiser, Mayo, MGB, Singapore NGEMR, KFSH&RC, Dubai Health, and SNUBH [28][29][32][64][67][68][69].
14. **Maturity models serve as procurement checklists and product roadmaps,** especially in the Middle East and Asia. The main ones are HIMSS EMRAM (stages 0–7) and China's EMR grading (levels 0–8). Our product should support **EMRAM Stage 7 and China EMR Level 6+ capabilities natively**.
15. **Implications for our build:**
    - Treat **speed as a feature**.
    - Design for **team-based work**.
    - Support **nurse documentation-by-exception**.
    - Make all CDS **governed and measured**.
    - Build in **ambient AI with provenance**.
    - Ship **telemetry plus embedded surveys** from day one.
    - Ship an opinionated **"foundation" content model**.
    - Sell an implementation service built on **readiness gates rather than dates**, **certified customer analysts**, and **fees partly tied to outcomes**.

---

## 2. Usability evidence

### 2.1 Usability evidence table

| # | Study / source | Year | Population / data | Key finding |
|---|---|---|---|---|
| 1 | Melnick et al., *Mayo Clin Proc* [1] | 2020 | 870 US physicians (national survey) | Mean SUS **45.9** (grade F; bottom 9%). Burnout odds ratio **0.97 per SUS point**, with a dose-response relationship. |
| 2 | Melnick et al., *JMIR* [3] | 2020 | Same cohort | Task load **mediates** the link between poor usability and burnout. |
| 3 | Melnick et al., *JAMIA* [2] | 2021 | 8,638 US nurses | Mean SUS **57.6** (grade F; bottom 24%). Burnout odds ratio **0.98 per point**. |
| 4 | Sinsky et al., *Ann Intern Med* [6] | 2016 | 57 US physicians in 4 specialties, 430 h of direct observation | **27%** of office time was direct face time and **49.2%** was EHR and desk work, or about 2 hours of EHR/desk work per hour with patients. Plus 1–2 hours of after-hours work. |
| 5 | Arndt et al., *Ann Fam Med* [4] | 2017 | 142 family physicians, EHR logs | **5.9 h** in the EHR per 11.4-h day. **86 min** after hours. Inbox **85 min/day** (23.7%). Clerical tasks **44.2%** of EHR time. |
| 6 | Arndt et al., *Ann Fam Med* [5] | 2024 | 141 academic PCPs, 2019 vs 2022–23 | Per 8 h scheduled: total EHR time **+7.8%**, inbox **+24.4%**, orders **+58.9%**. Patient advice requests **+55.5%**. Ambulatory clinical FTE (aFTE) fell 5.2%, from 0.66 to 0.63. |
| 7 | Downing, Bates, Longhurst, *Ann Intern Med* [7] ‡ | 2018 | Vendor (Epic) data | US notes are about **4× longer** than notes in other countries, which the authors tie to US documentation and billing rules. |
| 8 | Holmgren et al., *JAMA Intern Med* [8] | 2021 | 371 health systems, Epic metadata | US vs non-US: **90.2 vs 59.1 min/day** total EHR time. Notes 40.7 vs 30.7 min. Auto-generated text 77.5% vs 60.8%. Inbox **33.8 vs 12.8 msgs/day**. After hours 26.5 vs 19.5 min. |
| 9 | Holmgren et al., *JAMIA* [9] | 2022 | 366 US health systems on Epic (ambulatory), Dec 2019–Dec 2020 | Patient messages rose to **157%** of the pre-pandemic average and stayed elevated through Dec 2020, when the study ended. Each additional patient message was associated with **2.32 min** more *total* EHR time per day. |
| 10 | Rotenstein et al., *JAMA Intern Med* [10] | 2021 | Epic ambulatory specialties | Active EHR time per day: **PCPs 115 min**, medical specialists 85.7 min, surgeons 45.6 min. PCPs receive 5× the patient messages and 15× the Rx messages of surgeons. |
| 11 | Rotenstein et al., *JAMA Netw Open* [11] | 2023 | 307 PCPs at MGH/BWH | **36.2 min** of EHR time per visit. Having a pharmacy technician was associated with **−7.9 min/visit**. Above-median team contribution to orders with **−3.8 min/visit**. |
| 12 | Rule et al., *JAMA Netw Open* [12] | 2021 | 2.7 million notes, OHSU 2009–18 | Median note length **+60%** (401 → 642 words). Redundancy 47.9% → **58.8%**. Text in 2018: 29.4% typed, 14.7% copied, 55.9% templated. |
| 13 | Steinkamp et al., *JAMA Netw Open* [13] | 2022 | 104 million notes, Penn 2015–20 | **50.1% of all text was duplicated**, rising from 33.0% (2015) to 54.2% (2020). **45.9%** was copied from a *different* author. |
| 14 | Moy et al., *JAMIA* [19] | 2021 | Scoping review of 35 studies | Physicians spend about 2× as much time on documentation as on direct care. Nurses spend more than half their shift on EHR data entry and retrieval. **No validated burden measure exists.** |
| 15 | van der Sijs et al., *JAMIA* [14] | 2006 | Review of 17 studies | Drug safety alerts are overridden in **49–96%** of cases. |
| 16 | Nanji et al., *JAMIA* [15] | 2014 | 157,483 outpatient medication alerts | **52.6%** overridden. Only **53%** of overrides were appropriate, ranging from 12% for renal alerts to 92% for allergy alerts. |
| 17 | Classen et al., *JAMA Netw Open* [17] | 2020 | 2,314 hospitals, Leapfrog CPOE tool 2009–18 | Overall score rose from 53.9% to **65.6%**. Advanced CDS **46.1%**; drug–diagnosis checks only **33.2%**. Vendor alone explained **9.9%** of the variation in scores, and **14.6%** with hospital characteristics added. The authors attribute most of the remainder to how hospitals implement and configure their systems. |
| 18 | Howe, Ratwani et al., *JAMA* [16] | 2018 | 1.735 million safety reports, 2013–16 | **557** reports implicated EHR usability: data entry 27%, alerting 22%, interoperability 18%, display 9%. 38% involved ordering and 37% medication administration. |
| 19 | Sparnon & Marella, *PA Patient Safety Advisory* [27] ‡ | 2012 | About 3,100 EHR-related event reports in Pennsylvania | Wrong-dose, wrong-time, and wrong-patient errors were linked to data entry, defaults, and display. Most events reached the patient without harm. |
| 20 | Ash, Berg, Coiera, *JAMIA* [24] | 2004 | Qualitative study, US/NL/AU | Identified "silent errors" in (a) entering and retrieving information and (b) communication and coordination. |
| 21 | Koppel et al., *JAMA* [25] | 2005 | One tertiary teaching hospital (261 house staff surveyed) | Found **22 types** of medication-error risk facilitated by CPOE, such as fragmented displays and misleading defaults. |
| 22 | Han et al., *Pediatrics* [23] | 2005 | Children's Hospital of Pittsburgh; 1,942 children admitted by interfacility transport | Mortality rose from **2.80% (39/1,394) to 6.57% (36/548)** after CPOE was rolled out hospital-wide over 6 days. The adjusted odds ratio was 3.28. The rise was attributed to workflow disruption, for example orders allowed only after patient arrival (that detail is from the paper body ‡). |
| 23 | Adelman et al., *JAMA* (RCT) [26] | 2019 | 3,356 clinicians; 12.1 million orders | Limiting clinicians to 1 open record instead of up to 4 did **not** change wrong-patient order rates. Strong patient-identity cues matter more than hard limits. |
| 24 | Barnett, Mehrotra, Jena, *BMJ* [77] | 2016 | 17 US hospitals with inpatient EHR go-lives in 2011–12, compared with 399 control hospitals (Medicare data) | No significant change in 30-day mortality, readmissions, or PSI-90 adverse events in the 90 days before vs after go-live (difference-in-differences). The study is observational and small, but it suggests well-run go-lives can be safe. |
| 25 | KLAS, *EHR Implementations 2025* [28] | 2025 | Arch Collaborative | **38%** say the implementation hit the mark. **73%** of 22 newly live organizations had below-average NEES. **75%** of individually dissatisfied clinicians remain dissatisfied two or more years later. **57%** of clinicians said the organization and IT did not support the implementation well. Nurses' agreement that initial training was sufficient fell **24 points** after go-live. |
| 26 | KLAS, *Physician Guidebook 2025* [30] | 2025 | More than 35,000 physicians | **47%** say the EHR is slower than expected. **25%** say it is unreliable. **51%** say ongoing training is insufficient. |
| 27 | KLAS, *Epic Signal Data 2023* [38] | 2023 | More than 5,500 providers, 16 organizations | Telemetry **cannot predict** satisfaction: scheduled-hours EHR time explains only r² = 0.03 of NEES. |
| 28 | KLAS, *Reducing Nursing Documentation Burden 2025* [37] | 2025 | 80,147 nurses, 179 organizations | **79%** lose time to unproductive charting. Fixes work: Mercy −32 min/nurse/day; Wooster −96 fields and 15,000+ h/yr; Seattle Children's NEES **+71.4**. |
| 29 | KLAS, *Message Burden 2025* [35] | 2025 | Six organizations (early insight) | **60%** of physician messages come from patients. **48%** of ambulatory physicians say half their messages could be handled by other team members. |
| 30 | Olson et al., *JAMA Netw Open* [18] | 2025 | 263 clinicians analyzed (186 in the burnout analysis), 6 US systems, before/after at 30 days, Feb–Oct 2024 | Burnout **51.9% → 38.8%** (adjusted OR 0.26). After-hours documentation **−0.90 h**. Focused attention on patients improved. No control group. |
| 31 | KLAS, *AI Insights 2026* [39] | 2026 | 12 Epic organizations | NEES **72.2** for AI users vs **64.9** for non-users. Fewer than 25% feel adequately trained on AI output. |
| 32 | ECRI Top 10 Health Technology Hazards [21] | 2026 | Expert hazard ranking | #1 AI chatbot misuse; #2 digital darkness; #8 legacy-device cybersecurity; #9 implementations that prompt unsafe workflows. |

### 2.2 Synthesis

**Time in the EHR and "pajama time."** Ambulatory physicians routinely spend 1.5 to 2 hours in the EHR for every hour of patient contact [4][6]. After-hours work, called "pajama time" or "work outside work," persists:
- 86 minutes per day among family physicians [4];
- 26.5 minutes per day across US Epic users [8];
- about 6 minutes *per visit* in a large academic primary-care cohort [11].

EHR time **kept growing after the pandemic**, driven by orders and inbox volume [5]. Specialty matters a great deal: primary care carries about 2.5× the EHR time of surgery [10]. Team design is the strongest lever. Pharmacy technicians and team-entered orders each removed several minutes per visit [11].

**Inbox burden.** Patient portal messages jumped to about 157% of the pre-pandemic level and were still elevated when the study ended in Dec 2020 [9]. Later data show patient advice requests still rising through 2023 [5]. Every extra patient message per day is associated with about 2.3 more minutes of total EHR time [9]. In KLAS data, 48% of ambulatory physicians say half their messages could be handled by others [35]. The message is a workflow-routing problem as much as a UI problem. Organizations profiled by KLAS are responding with [35]:
- nurse inbox pools and protocols;
- message templates;
- auto-closing threads after 14 days;
- telling patients about possible charges for some responses;
- AI filtering, routing, and (experimentally) AI-drafted replies.

**Documentation burden and note bloat.** US notes are about 4× longer than international notes [7] and contain more auto-generated text [8]. Inside organizations, half or more of note text is duplicated [12][13]. Two forces drive this:
- billing and regulatory rules, which the US partly relaxed with the 2021 E/M office-visit changes ‡;
- tooling that makes copying and templating cheaper than synthesis.

The **25×5** initiative set a goal of cutting documentation burden to 25% of its current level by 2025. It began as a Columbia DBMI symposium series in Jan–Feb 2021, funded by NLM, and AMIA took over leadership in Dec 2021 [20]. It produced an action agenda but no validated measurement standard. Moy et al. likewise found **no validated burden metric** [19].

**Alert fatigue.** Override rates of 49–96% have held for two decades [14][15]. Many alerts are low-value: in one study only 12% of renal-dosing overrides were appropriate, while 92% of allergy overrides were [15]. At the same time, CPOE safety performance is incomplete. Hospitals caught about 66% of dangerous orders on the Leapfrog test, and **local configuration mattered more than vendor choice** [17]. So "fewer alerts" alone is not the answer. The answer is **better-targeted alerts with measured positive predictive value**.

**Burnout links.** Poor usability is independently associated with burnout in both physicians and nurses, with a dose-response relationship [1][2]. Task load mediates the effect [3]. KLAS data show that a third of physicians still report burnout [30]. Clinicians in Oceania cite the EHR as a burnout contributor more often than clinicians in any other region, and Middle East clinicians cite it least often [32].

**Nursing.** Nurses spend more than half of each shift on EHR data entry and retrieval [19]. They ask for streamlined charting twice as often as any other enhancement [37]. Flowsheets and care plans are the top targets. Critical care and labor & delivery have the highest unproductive-charting levels [37].

**Patient harm from usability.** Evidence is consistent across sources:
- data-entry and alerting design flaws contribute to harm [16];
- CPOE implementations can facilitate error [23][25];
- "silent errors" emerge in entry, retrieval, and coordination [24].

NIST classifies the critical use errors as:
- wrong patient (commission or omission);
- wrong treatment;
- wrong medication;
- delay of treatment;
- unintended treatment, such as confusing test and production modes [43].

Mode errors are a classic example. NISTIR 7804 describes a **100-fold vasoactive overdose** caused by confusing weight-based (mcg/kg/min) and direct (mcg/min) dosing [43].

**ECRI hazards.** ECRI's 2026 list places two EHR-adjacent items in its top ten:
- **#2:** unpreparedness for "digital darkness," or a sudden loss of access to electronic systems;
- **#9:** implementations that prompt unsafe workflows.

AI chatbot misuse is **#1** [21]. ECRI has also published commentary on digital darkness [79] and an advocacy piece arguing that siloed records harm patients ("one patient, one record") [80].

---

## 3. What great clinical UX looks like

### 3.1 What the KLAS Arch Collaborative data say

- **Foundation first.** KLAS's "EHR House of Success" puts a **fast, reliable system** at the base, with **education, personalization, and governance** as pillars [30][31].
  - **47%** of physicians say their EHR is slower than expected [30].
  - Training cannot compensate for slow logins [31]. KLAS gives "waiting 60 seconds to log in" as an example of unacceptable performance [40].
- **Training is the largest controllable lever.**
  - Satisfaction with initial training brings 176% higher agreement that the EHR is easy to learn. Satisfaction with ongoing training brings 124% higher agreement that it is efficient [30].
  - Recommended minimums:
    - onboarding: at least 3 hours, with the most satisfied clinicians receiving at least 11 hours;
    - ongoing: 3–5 hours per year [32];
    - spread initial training over about 90 days [29].
- **Personalization.** Clinicians who personalize their workflows (order favorites, note templates, speech recognition, ambient AI) report the highest satisfaction. Direct typing is the least satisfying documentation method (KLAS deep dive, cited in [30]).
- **Governance and trust.** Clinicians' trust in organization and IT leadership has the strongest effect on NEES (KLAS Executive Scorecard and Guidebook material [30]). Only **45%** of physicians agree their organization implemented, trains on, and supports the EHR well [30]. KLAS recommends:
  - a clinician-led council structure;
  - a single request-intake path with transparent scoring;
  - a 30-day loop closure on every request;
  - "you asked, we acted" communications [34].
- **Benchmarks.**
  - Average NEES is **47.3 for nurses** and **23.4 for physicians**. Pinnacle thresholds are 75 for nurses and 60 for physicians [28][32].
  - 22% of organizations reach Level 6 for physicians and 12% for nurses [29].
  - 2025 Pinnacle winners [29]:
    - **Nurses:** CHOP, Connecticut Children's, Dayton Children's, Houston Methodist, **King Faisal Specialist Hospital & Research Centre**, UT MD Anderson, and **Dubai Academic Health Corporation**.
    - **Physicians:** Dubai Academic Health Corporation, Dayton Children's, Franciscan Health, MetroHealth, Parkview Health, and Reid Health.
    - Dubai Academic Health Corporation won for both groups. KFSH&RC won for nurses only.
- **Region.** The Middle East is KLAS's model region. It has the highest adoption of personalization tools and the lowest EHR-attributed burnout [32].
- **Organizational priority matters.** Organizations whose CMIOs and CNIOs rank clinician experience as their top priority score more than 10 NEES points above average. Those ranking cost reduction first report more burnout [41].

### 3.2 Standards and regulatory expectations for clinical UX

| Standard / guidance | What it requires or recommends | Relevance to us |
|---|---|---|
| **NISTIR 7804** (Feb 2012) [43] | EHR Usability Protocol (EUP) in three steps: (1) application analysis; (2) expert review; (3) summative validation testing with **15–20 participants per distinct user group**. The 15–20 figure draws on the FDA's minimum of 15 per user group for device validation. Defines critical use-error categories and risk parameters. | Adopt as our internal usability-assurance method for safety-critical workflows. |
| **NISTIR 7804-1** (2015) [44] | Empirically based use cases for validating safety-enhanced usability. | Source of test scenarios for ordering, medications, and results. |
| **NISTIR 7742** (customized Common Industry Format) [45][46] | Reporting template: participants, tasks, success/failure rates, task time with SD, satisfaction rating. | Format for our summative test reports. |
| **ONC §170.315(g)(3) Safety-Enhanced Design** [46] | A user-centered design (UCD) process must be applied to the capabilities in (a)(1)–(5), (a)(9) until it expires, (a)(14), (b)(2), (b)(3), and (b)(11). In practice these are CPOE (meds, lab, imaging), drug–drug/drug–allergy checks, demographics, the implantable device list, clinical information reconciliation, e-Rx, and CDS/DSI. Any UCD process is acceptable; ISO 9241-210, ISO/IEC 62366, and NISTIR 7741 are examples. Requires **at least 10 test participants** per capability. *(Problem, medication, and allergy lists were dropped from this list after the Cures Update.)* | Mandatory if we pursue US certification. Use 15–20 per user group in practice. |
| **ISO 9241-11:2018 / 9241-210:2019** ‡ | Usability defined as effectiveness, efficiency, and satisfaction in a specified context of use. Human-centred design process. | Process backbone, recognized by ONC [46]. |
| **IEC 62366-1** ‡ | Usability engineering for medical devices. | Applies to any HMS component regulated as SaMD (e.g., dose calculators, some CDS). |
| **SAFER Guides (2025 edition; PDFs released Jan–Jun 2025)** [47] | Eight guides (the earlier System Configuration and System Interfaces guides were merged into System Management): High Priority Practices; Organizational Responsibilities (now with AI guidance); Contingency Planning; System Management; Patient Identification; CPOE with Decision Support; Test Results Reporting & Follow-Up; Clinician Communication. | Use as a product-design checklist and as the customer go-live safety checklist. |
| **WCAG 2.2** (W3C Recommendation; current edition dated 12 Dec 2024; first published Oct 2023 ‡) [78] | Adds nine success criteria. Six of them are at Level A or AA: Focus Not Obscured (Minimum) 2.4.11, Dragging Movements 2.5.7, **Target Size (Minimum) 2.5.8**, Consistent Help 3.2.6, **Redundant Entry 3.3.7**, and **Accessible Authentication (Minimum) 3.3.8**. Removes 4.1.1 Parsing. | AA conformance is required. "Redundant Entry" (3.3.7) is effectively an anti-duplicate-documentation rule. |
| **AMA EHR usability priorities** (2014) ‡ | Eight priorities: (1) enhance physicians' ability to provide high-quality care; (2) support team-based care; (3) promote care coordination; (4) offer product modularity and configurability; (5) reduce cognitive workload; (6) promote data liquidity; (7) facilitate digital and mobile patient engagement; (8) expedite user input into product design and post-implementation feedback. | Still a valid north star. Items 2, 5, and 8 are the most neglected in the market. |

### 3.3 UX design principles checklist for our product

Each principle includes a measurable acceptance target. Targets marked Est. are proposed internal SLOs, not industry standards.

| # | Principle | Concrete requirement | Rationale / evidence | Acceptance metric |
|---|---|---|---|---|
| 1 | **Speed is a feature** | Badge-tap/SSO login; warm session resume; prefetch of the likely next patient; pagination-free virtualized lists | 47% of physicians say their EHR is slow [30]. KLAS calls 60-second logins "unacceptable" [40]. | Login under 5 s (Est.). p95 screen transition under 1 s (Est.). p99 order-sign under 2 s (Est.). |
| 2 | **Reliability and downtime readiness** | Active-active hosting; read-only business-continuity access (local cache with MAR, allergies, active orders, last 72 h notes); downtime-to-uptime reconciliation workflow | ECRI 2026 #2 "digital darkness" [21]. SAFER Contingency Planning [47]. | 99.95%+ availability (Est.). Business-continuity data under 15 min old. Quarterly downtime drills. |
| 3 | **One patient, one record, one timeline** | Longitudinal record with de-duplicated external data, source provenance badges, and reconciliation workflows | 47% of clinicians cannot quickly find outside data, and 47% sift through duplicates [29]. Even at Level 6, only 63–67% agree external data is seamless [31]. | Number of duplicate items shown per chart open. External-data reconciliation time. |
| 4 | **Information density with a clear hierarchy** | Clinician-tunable density (compact/comfortable); glanceable summary header (allergies, code status, isolation, weight, renal function, active alerts); progressive disclosure | Data entry and visual display make up 36% of usability-harm reports [16]. | Task time and error rate in summative tests (NISTIR 7742 format). |
| 5 | **Minimal clicks; keyboard-first** | Global command palette; typo-tolerant order/med search with synonyms and brand↔generic matching; full keyboard navigation; macros and smart phrases | Clinicians using personalization tools are the most satisfied [30]. | Clicks and keystrokes per top-50 task, tracked as a regression metric each release. |
| 6 | **Consistent patterns** | One design system: same list, filter, sign, and cosign patterns everywhere; no modal stacks; consistent placement of patient identity | Consistency lowers cognitive workload (AMA priority 5) ‡. WCAG 3.2.6 Consistent Help [78]. | Design-system lint coverage. Heuristic review score. |
| 7 | **Safe, smart defaults** | Defaults never select a dose, route, or patient. Explicit units with weight-vs-direct dosing mode cues and hard stops on 10×/100× deviations | NIST mode-error example (100× overdose) [43]. Koppel's misleading defaults [25]. | Zero high-risk defaults in clinical-safety review. Dose-range CDS on all high-alert meds. |
| 8 | **Wrong-patient protection** | Persistent patient banner (name, MRN, DOB, photo) on every screen, including mobile; colour or texture change on context switch; ID re-verification at signing when the context changed recently | Patient identification is a SAFER guide [47]. Limiting open records alone did not reduce errors [26]. | Retract-and-reorder rate per 100,000 orders, trending down. |
| 9 | **Tiered, governed CDS** | Passive or inline guidance by default. Interruptive alerts only for high-severity, high-specificity rules. Every rule has an owner, evidence link, PPV, and override reasons, and is auto-flagged for review when overrides exceed a threshold | 49–96% override [14]. 53% appropriate overrides [15]. CPOE catch rate 66% [17]. | Interruptive alerts per 100 orders. Per-rule override rate and PPV. Leapfrog CPOE score. |
| 10 | **Documentation as synthesis, not accumulation** | Notes compose from structured data with provenance. Copied or imported text is visually marked with source and author. "What changed since last note" diff view. Soft length budgets and a bloat indicator | 50% duplicated text [13]. 60% note growth [12]. | Median note length. Percentage of note text that is copied, templated, or typed. Duplicate fraction. |
| 11 | **Native ambient AI and drafting with human sign-off** | Ambient scribe, chart summarization, and in-basket drafts. Mandatory review step. AI-generated spans tagged with provenance. Specialty-tuned templates | Burnout −13 points [18]. NEES 72.2 vs 64.9 [39]. SAFER 2025 AI guidance [47]. | Adoption. Edit distance before sign. Time-in-notes. After-hours time. Safety-event tagging for AI content. |
| 12 | **Team-based inbox** | Pools; rules-based routing by message type; intake forms; auto-acknowledgement with expected response time; auto-close; delegate signing | 48% say half of messages could go to others [35]. Team order entry −3.8 min/visit [11]. | Messages per clinician per day. Percentage handled by the team. Time-to-close. After-hours inbox time. |
| 13 | **Role-based workspaces** | Workspaces for physician, nurse, pharmacist, therapist, ward clerk, bed manager, revenue cycle, and so on. Each has a home "what needs me now" queue. **No unowned queues** | VA "unknown queue" harm [54][83]. GAO trouble-ticket findings [53]. | Orphaned or unrouted work items = 0, alarmed in real time. |
| 14 | **Multi-patient and single-patient views** | Census boards, unit boards, ED tracking, OR boards, and team lists with configurable columns, plus a deep single-patient chart. Seamless pivot between them while keeping identity cues | Adelman RCT: multiple open records are acceptable if identity is clear [26]. | Task time for handoff and rounding scenarios. |
| 15 | **Nursing documentation-by-exception** | Charting by exception against unit-specific normal definitions; flowsheet field analytics; tag each field as *regulatory*, *quality measure*, or *local preference*; one-click retirement through governance | Mercy −32 min/day; Wooster −96 fields [37]. | Fields per shift. Documentation minutes per shift. Percentage of fields never viewed downstream. |
| 16 | **Personalization built in, not bolted on** | User-level favorites, preference lists, smart phrases, layouts, filters, and shareable "personalization packs" by specialty | Personalization is a KLAS pillar [30][31]. | Percentage of users with one or more personalization artifacts at 30, 60, and 90 days. |
| 17 | **In-product learning** | Contextual tips; release notes in the flow of work; guided "show me" walkthroughs; proficiency nudges driven by telemetry | Training is the biggest satisfaction lever [30]. Fewer than 25% feel trained on AI [39]. | Training completion. Proficiency score. NEES training items. |
| 18 | **Accessible by default** | WCAG 2.2 AA, including target size, redundant entry, and accessible authentication. Full screen-reader support. Colour never the sole signal | [78] | Automated and manual accessibility audits each release. |
| 19 | **Localization and terminology** | Full professional translation of clinical content, with clinician-reviewed terminology per language and locale; local coding systems | Danish Epic go-live had untranslated elements, and physicians resorted to Google Translate [60]. | Zero untranslated strings in clinical paths. Local-clinician sign-off. |
| 20 | **Usability regression testing** | Every release runs scripted task-time tests and EUP-style summative tests for changed safety-critical workflows | NISTIR 7804 EUP [43]. ONC (g)(3) [46]. | Release blocked if task time worsens by more than 10% or a new critical use error appears (Est.). |

### 3.4 Nursing-specific UX

- **Design around the shift, not the encounter.**
  - Brain-sheet and worklist views showing what is due, overdue, PRN-eligible, and changed since last check.
  - Medication administration with barcode scanning at the bedside.
  - Device integration (vitals, pumps) so nurses validate data rather than transcribe it.
- **Flowsheet governance tooling** is a product feature. Provide:
  - field-usage heat maps;
  - "who reads this field" lineage;
  - regulatory-source tags;
  - a deprecation workflow.

  KLAS shows that frontline nurse involvement, quick wins (removing redundant fields), and a predictable change cadence drive improvement [37].
- **Care plans:** collapse redundant problem, goal, and intervention charting. Link care-plan items to the flowsheet rows that evidence them.
- **Handoff:** structured I-PASS/SBAR handoff summary generated from the chart, with AI shift summaries as an option. KLAS reports shift summaries as a top nursing AI use case [39].

### 3.5 Mobile, voice, and ambient

- **Mobile** is for:
  - quick review;
  - result and alert acknowledgement;
  - photo capture into the chart;
  - secure chat;
  - barcode med administration on handhelds;
  - ambient capture.

  The same identity banner and safety rules apply as on desktop.
- **Voice and ambient:**
  - Provide ambient documentation natively or through open APIs to third parties such as Microsoft Dragon Copilot, Abridge, and Ambience. KLAS's 2025 sample covered more than 900 providers at 24 organizations [36]:
    - 18 organizations used Microsoft DAX Copilot, now part of Dragon Copilot;
    - 3 used Abridge;
    - 1 each used Ambience, DeepScribe, and Nabla.
  - Expose the encounter context, structured problem list, and orders so AI drafts are grounded.
  - Note that 96% of the KLAS ambient sample was on Epic [36]. Deep EHR integration is the differentiator, and a non-Epic vendor must match it.

### 3.6 Measuring usability continuously

- **Telemetry, similar to Epic Signal or Oracle "Lights On" ‡, should cover:**
  - time in system per 8 scheduled hours;
  - time in notes, orders, inbox, and chart review;
  - after-hours time;
  - note composition (typed, templated, copied, AI);
  - inbox volume by type;
  - turnaround times;
  - task-level click and keystroke counts;
  - latency percentiles.
- **Caveat:** KLAS found that **Signal metrics cannot predict satisfaction**. EHR time explained r² = 0.03 of NEES [38]. Telemetry must be paired with **in-product micro-surveys** (SUS or NEES-style items) and periodic full surveys. Encourage customers to join the KLAS Arch Collaborative for external benchmarks.
- **Standardized metrics:** Sinsky et al. proposed seven core ambulatory EHR-use metrics (*JAMIA* 2020) [81]:
  - total EHR time;
  - work outside work;
  - documentation time;
  - prescription time;
  - inbox time;
  - teamwork on orders;
  - undivided attention.

  Our telemetry should compute these natively, normalized per 8 hours of scheduled patient time.

---

## 4. Implementation methodology

### 4.1 How the major vendors implement

**Epic.** The description below is assembled from public sources and practitioner knowledge ‡.
- **Foundation System and "adopt the model."** Epic ships a pre-built, best-practice configuration (the Foundation System). It pushes customers to accept most of it and to justify deviations through governance. This compresses build time and keeps customers close to standard content, which makes upgrades and shared improvements easier.
- **Credentialed staff.**
  - Customer analysts must earn Epic application certification before build.
  - "Principal trainers" are certified to train customer "credentialed trainers," who in turn deliver end-user training.
  - Epic incentivizes adherence to its methodology. Its "Good Install" programme ‡ and "Gold Stars" adoption levels ‡ are examples.
- **Workflow walkthroughs and validation sessions.** Operational subject-matter experts review Foundation workflows end to end and decide on changes.
- **Build → testing.** Testing runs through unit, application, and multiple rounds of integrated testing. These are followed by **technical dress rehearsals** (devices, printers, interfaces, security) and **go-live readiness assessments** at set intervals before go-live.
- **Cutover.** Includes:
  - pre-load abstraction of allergies, medications, problems, and appointments;
  - conversion of active inpatient orders by pharmacists and clinicians;
  - a timed sequence of system switch-overs.
- **Go-live command center and at-the-elbow (ATE) support,** followed by **stabilization** of about 90 days.
- **Post-live programmes.** Epic runs optimization programmes, including Refuel-style assessments and Sprint-style intensive personalization ‡. The published UCHealth "optimization sprints" approach is an example [75]. An 11-person team spent 2 weeks on site per clinic. Across 6 clinics, clinician Net Promoter Score for the EHR rose from −15 to +12, and burnout fell from 39% to 34%.

**Oracle Health (Cerner).**
- Model content and accelerated-implementation approaches ‡.
- Hosted "CommunityWorks" for smaller hospitals ‡.
- "Lights On Network" operational telemetry ‡.

The VA experience shows the limits of a vendor-led model when the customer is not ready for heavy change management. GAO found VA's change management only *partially* consistent with 7 of 8 leading practices, and *not* consistent on workforce skills [53].

**MEDITECH Expanse.** Pre-built content and SaaS ("MaaS") options aimed at community hospitals ‡. KLAS's 2025 implementation case studies include **Ozarks Healthcare (Expanse)**. There, physicians' agreement that their initial training was sufficient rose 19 percentage points after six hours of workflow-specific training [28].

### 4.2 Implementation playbook: phases, activities, artifacts, durations, roles

Durations are **estimates (Est.)** for a full-suite clinical, revenue, and ERP-light implementation. They assume our "foundation content" and a cloud-hosted deployment.
- **S** = small hospital (<150 beds, single site).
- **M** = mid-size (150–500 beds or 2–5 hospitals).
- **L** = large academic medical center or multi-hospital system (>500 beds or more than 5 hospitals). L durations are per wave.

| Phase | Key activities | Artifacts / gates | Duration S / M / L (Est.) | Lead roles |
|---|---|---|---|---|
| 0. Strategy & contracting | Business case; scope; governance charter; benefits targets; budget incl. backfill and productivity loss; vendor reference visits | Charter; benefits register with baseline KPIs; RACI; risk register | 1–3 / 2–4 / 3–6 months | CEO/COO sponsor, CFO, CMIO, CNIO, CIO |
| 1. Mobilize & plan | Program office; hire and backfill analysts; analyst certification; principal-trainer certification; baseline measurement (NEES/SUS survey, time-motion, KPIs); change-impact assessment | Integrated plan; staffing plan; certification tracker; baseline report | 1–2 / 2–3 / 3–4 | Program director, PMO, HR, change lead |
| 2. Design (validate foundation) | Workflow walkthroughs by service line; "adopt the model" decisions; deviation requests through governance; order-set and content review; device, interface, and data-conversion design; security role design | Signed workflow decisions; deviation log (target: adopt at least 80% of foundation, Est.); interface catalog; conversion spec | 2–3 / 3–4 / 4–6 | CMIO/CNIO, clinical content committees, analysts |
| 3. Build | Configure; build interfaces, devices, printers; reports; revenue-cycle build (charge master, payer rules); content localization | Build trackers; unit-test evidence | 2–4 / 4–6 / 6–9 | Certified analysts, integration team |
| 4. Test | Unit → application → integrated testing (2–3 cycles); end-to-end revenue testing (charge-to-claim); performance and load; usability (EUP-style summative tests on top risk workflows); security penetration testing; conversion mock loads | Test scripts and defect logs; exit criteria (zero severity-1 defects, agreed severity-2 count); performance test report | 1–2 / 2–4 / 3–5 | Test lead, analysts, superusers, revenue cycle |
| 5. Train & ready | Role-based, workflow-specific training on **the organization's own build**; proficiency assessment; personalization labs; superuser training; 2–3 technical dress rehearsals; readiness assessments at T-120/-90/-60/-30 days (Est.); downtime drills | Training completion and proficiency (go/no-go threshold e.g. ≥95% completion, ≥85% proficiency pass, Est.); TDR reports; readiness scorecard; cutover runbook | 2–3 / 3–4 / 4–6 (overlaps Test) | Training manager, principal trainers, superusers |
| 6. Cutover & go-live | Data abstraction and pre-load; clinic schedule reduction; inpatient order conversion; 24/7 command center; ATE support; daily safety and operations huddles; rapid-fix change control | Cutover checklist; issue log; daily dashboards (safety, flow, revenue, tickets) | Go-live weekend + 2–4 weeks of intense support | Command center director, CMIO/CNIO, safety officer |
| 7. Stabilize | Ticket burn-down; workflow fixes; targeted retraining; revenue-cycle recovery (DNFB, charge lag, denials); productivity ramp-up | Stabilization exit criteria (ticket volume back to baseline, KPIs within tolerance) | 1–2 / 2–3 / 3 months | Program director, analysts |
| 8. Optimize (continuous) | Optimization sprints (personalization, order sets, documentation trimming); alert tuning; NEES re-measurement at 6, 12, and 24 months; benefits realization review; nursing field rationalization | Optimization backlog; benefits report; NEES trend | Ongoing; first sprint at 3–6 months | CMIO/CNIO, governance councils |
| **Total to go-live** | | | **≈ 9–12 / 12–18 / 18–24+ months per wave (Est.)** | |

### 4.3 Roles and staffing ratios (Est.)

| Role | Function | Typical ratio / sizing (Est. heuristics) |
|---|---|---|
| Executive sponsor (CEO/COO) | Owns outcomes. Chairs the steering committee. Holds go/no-go authority. | One per program |
| CMIO / CNIO (and associate CMIOs/CNIOs) | Lead clinical design and governance. Arbitrate adoption vs deviation. | One CMIO and one CNIO, plus physician and nurse "builders" (0.2–0.5 FTE each) per major service line |
| Certified application analysts | Build and maintain the system | L: hundreds of FTE during build. M: dozens. S: 10–25 with vendor-hosted content. Retain 50–70% after go-live for optimization. |
| Principal / credentialed trainers | Develop curriculum. Train trainers and end users. | About 1 trainer per 75–150 end users during the training window |
| Superusers | Peer support, testing, feedback. Selected for workflow expertise and peer trust, with **protected, paid time** [33] | About 1 per 8–15 end users per unit, covering every shift |
| ATE support | Floor support at go-live | Week 1: about 1 per 3–5 nurses and 1 per 2–4 providers in ED, OR, and clinics. Taper over weeks 2–4. |
| Command center | Triage, fix, communicate | 24/7 for 2–4 weeks, then business hours |
| Patient-safety officer / clinical safety lead | Go-live safety surveillance and safety huddles | Dedicated for 90 days |
| Revenue cycle lead | Charge capture, coding, claims, cash | Dedicated from design through 6 months after go-live |

### 4.4 Big-bang vs phased rollouts: what the evidence says

There are no randomized comparisons. The evidence is observational and drawn from case experience.

| Approach | Pros | Cons | Evidence / examples |
|---|---|---|---|
| **Big bang (all modules, one site or region at once)** | No hybrid paper/electronic or old/new system seams. Single training push. Faster benefits. Fewer temporary interfaces. | Concentrated risk. Requires excellent readiness and support. | Most US Epic hospital go-lives use this approach ‡. Observational Medicare data from 17 US hospital go-lives (2011–12) showed no significant rise in mortality, readmissions, or adverse events [77]. CUH's big-bang Epic go-live (2014) became unstable, with pathology-result problems [63] and reported ambulance diversion ‡. |
| **Phased by site (waves)** | Each wave learns from the previous one. The enterprise build is proven early. Support teams can be reused. | Long period with mixed systems across the network, and patient records split across systems. | **VA's 2026 regional "market" waves** were adopted explicitly so neighboring sites do not run different systems [48][52]. Alberta used staged "launches" from 2019 to consolidate more than 1,300 systems [66]. DoD MHS GENESIS went live at its initial operational capability sites in 2017, paused after the 2018 operational test, then deployed in waves [86]. |
| **Phased by module** | Smaller change per step | Long-lived hybrid workflows (e.g., e-orders with paper MAR) are a known safety risk. Many temporary interfaces. | Generally discouraged for core clinical modules (‡ practitioner consensus). Acceptable for ERP and back-office modules. |

**Recommendation for our customers:** do a **big bang within a site or care region for all core clinical and revenue modules**, and **sequence sites by region** to avoid seams. Begin with a well-resourced, *non-flagship* pilot that has strong leadership. Gate every wave on readiness metrics, not dates. GAO criticized VA for lacking satisfaction targets and an independent operational assessment before expanding [53].

**Cross-report note (reconciled 2026-10-16): within-site rollout.** `03` §21.2 previously said "pilot on one inpatient unit, ED and two clinics, then expand hospital-wide". The pack now standardizes on this section. Go big bang per site for all core clinical and revenue modules. The first site is a well-resourced, non-flagship design partner. Unit-level piloting is limited to a pre-production **"model unit"** or dress rehearsal (technical dress rehearsals, simulated shifts) before the site-wide go-live. Live unit-by-unit rollout is avoided because partial closed loops and mixed paper/electronic MARs are dangerous, which is a point `03` also makes. `03` §21.2 has been edited to match.

### 4.5 Governance

- **Structure:** executive steering committee → clinical, operational, and revenue design councils → specialty content groups (order sets, documentation, CDS, nursing flowsheets).
  - Each group has defined decision rights.
  - Members get protected time [28][34].
  - KLAS's 2025 implementation report names multi-level governance with protected time as a top success driver [28].
- **Post-live governance** never ends. It needs:
  - a single intake path;
  - transparent scoring (safety, regulatory, efficiency, reach, cost);
  - a fast track for fixes;
  - 30-day loop closure;
  - a published change calendar with a predictable cadence [34][37].
- **Clinical leadership:**
  - Funded CMIO and CNIO roles with authority.
  - KLAS urges equal attention to nurses [41].
  - Organizations that prioritize clinician experience score better [41].

### 4.6 Data conversion and legacy archiving

These are practitioner norms (‡ / Est.):
- **Discrete conversion:**
  - allergies, active medications, problem list, immunizations;
  - recent lab results (often 2–5 years) and key vitals;
  - future appointments, referrals, and authorizations;
  - patient demographics and identifiers, with master patient index (MPI) clean-up *before* conversion.
- **Clinician abstraction:** a structured chart-prep effort in the 2–4 weeks before go-live for scheduled patients.
- **Documents:** historical notes and reports imported as indexed documents or images, not discrete data.
- **Inpatients at cutover:** active orders re-entered and verified, with pharmacist double checks.
- **Financials:** legacy accounts receivable usually run out in the legacy system for 6–12 months. New charges go into the new system.
- **Legacy archive:** a read-only, searchable archive that can be launched in patient context from the new EHR. Retention follows local law (often 7–10+ years for adults and longer for minors; varies by jurisdiction). Decommission legacy systems only after the run-out and audit.

### 4.7 Training approaches

- Training should be workflow-specific, on the organization's **own build**, and delivered by trainers who know the workflows. Providers often learn best from peers [28].
- Hours:
  - at least 3–6 hours initial for providers and nurses [28];
  - the most satisfied clinicians received at least 11 hours [32];
  - 3–5 hours ongoing per year [32];
  - even 1 hour per year of ongoing education helps [29].
- Stagger onboarding over about 90 days, with check-ins at 30, 60, and 90 days [29][30].
- Run personalization labs before and after go-live.
- Use proficiency testing as a go-live gate.
- Use telemetry-driven targeted coaching. UCSF reported a 21% proficiency gain measured through telemetry [38].
- Virtual and self-directed eLearning can supplement but should not replace hands-on, workflow-specific sessions (KLAS virtual education reports, 2023 and 2025).

### 4.8 Go-live operations and patient-safety monitoring

- **Command center:**
  - tiered support (ATE → superuser → analyst → vendor);
  - issue triage by safety, revenue, and flow;
  - twice-daily leadership huddles;
  - a daily patient-safety huddle.
- **Safety dashboard from hour 0.** Use the SAFER guides as the checklist [47]. Track:
  - orders in unrouted, unowned, or error queues. The **target is zero**, informed by the VA "unknown queue" harm [54][83];
  - unacknowledged critical results and overdue result follow-up;
  - retract-and-reorder (wrong-patient) rate;
  - barcode med-administration scanning compliance and overrides;
  - pharmacy verification turnaround;
  - missed or late medication doses;
  - specimen-labeling errors;
  - referral, letter, and outbound-message backlog. Helseplattformen left **about 16,000 patient letters unsent** [60];
  - ED left-without-being-seen rate, boarding, and length of stay;
  - safety-event reports tagged as "IT-related."
- **Escalation rules:** pre-agreed triggers to slow down, add support, or revert specific workflows. Downtime procedures must be rehearsed [21][47].

### 4.9 Productivity and revenue dip

- **Clinical productivity (Est. practice norms ‡):**
  - Ambulatory templates are commonly reduced by **about 25–50% in week 1**, then by about 10–25% through weeks 2–4.
  - Recovery to baseline usually takes **4–12 weeks** in clinics, longer for specialties with heavy templates.
  - EDs and ORs plan for slower throughput and add surge staff.
- **Revenue cycle (‡/Est.):**
  - Expect rising discharged-not-final-billed (DNFB), charge lag, and denials for 1–3 months.
  - Plan for cash reserves or a revenue-anticipation line.
  - Many large organizations report significant total costs that include lost revenue. **MGB's Epic program reached about $1.6 billion by 2018, mostly from lost patient revenue, support, and implementation labor rather than software. Software payments were under $100 million** [60].
- **Satisfaction trajectory:** NEES typically dips after go-live and climbs over years. Organizations measured three or more years after go-live score higher. The quality of implementation management largely determines the recovery slope [28].

### 4.10 Stabilization and optimization

- **Stabilization (0–90 days):** fix defects, retrain, recover revenue, close the ATE.
- **Optimization (3–24 months and beyond):**
  - specialty-based **optimization sprints**, i.e., intensive team-based personalization and build fixes [75] ‡;
  - nursing documentation rationalization [37];
  - alert tuning;
  - inbox redesign [35];
  - ambient AI rollout with training [39].
- **Re-measurement:** NEES or SUS at 6, 12, and 24 months, with a public "you asked, we acted" log [34].

### 4.11 Change-management models

- **ADKAR** (Prosci) ‡: Awareness → Desire → Knowledge → Ability → Reinforcement. It maps well to individual clinician readiness and is the basis for readiness surveys and proficiency gates.
- **Kotter's 8 steps** ‡: urgency → guiding coalition → vision → communicate → empower → short-term wins → consolidate → anchor in culture. It maps to the organizational program.
- KLAS's success drivers translate these into practice [28]:
  - early and continuous change management that targets mindset as well as training;
  - transparent communication and accountability across organization, vendor, and partner.
- The GAO VA review is a cautionary benchmark. VA's change management fell short on 8 of 8 leading practices (7 partially consistent and 1 not consistent) [53].

### 4.12 Typical timelines and costs by hospital size (Est.)

| Segment | Time to go-live | Indicative total implementation cost (Year 0–1) | Reference points |
|---|---|---|---|
| Small community hospital (<150 beds), hosted/SaaS | 9–12 months | US: ~$3–25M including internal labor and backfill. Emerging markets: ~$0.3–3M (Est.) | Vendor community/hosted programmes ‡ |
| Mid-size (150–500 beds / 2–5 hospitals) | 12–18 months | US: ~$25–150M (Est.) | |
| Large academic medical center / multi-hospital system | 18–30 months (first wave) | US: ~$150M to $1.6B+ | MGB: ~$1.2B initially reported (Boston Globe, May 2016); ~$1.6B total by 2018, mostly lost patient revenue, with software payments under $100M (New Yorker, Nov 2018) [60]. Mayo ~$1.5B ‡. Kaiser: more than $6B, or over half a million dollars per physician [64]. Earlier press put it at ~$4B ‡. CUH ~£200M over 10 years incl. infrastructure [63]. |
| National / regional programmes | 5–15 years | Billions | VA ~$37B latest estimate [50]. The contract was originally $10B, revised to above $16B, and raised to just under $27B in Aug 2026 [50][84]. NPfIT ~£10B (‡ PAC 2013; NAO 2006 forecast £12.4B over 10 years) [58][59]. Helseplattformen ~NOK 6.7B total programme cost to Oct 2024, against an original NOK 4.1B frame [93]. Apotti: **conflicting figures**. Apotti's own FAQ gives a €407M investment cost "in its current scope" (undated) [94], while Helsingin Sanomat reported €625M "by Nov 2022", with unclear scope [60]. Sundhedsplatformen ~DKK 2.8B [60]. *(Reconciled 2026-10-16: see the cost table in `01` §9.2, which separates vendor contract, total programme cost and lost revenue.)* |

*Cross-report note (reconciled 2026-10-16): timelines.* These durations assume a **mature product with foundation content**. `01` §12.1/§12.3 promised "6–12-month go-lives for 100–300-bed hospitals". That is now restated as a mature-product target for **<150-bed** hospitals on foundation content. Most 100–300-bed hospitals fall in the M band here (12–18 months). For our *first* design-partner site, implementation (≈12–18 months) comes on top of roughly 12 months of MVP build (`05` §9.3, `03` §21.1), so first go-live is realistically around **M18–24 or later**. The date should come from the critical-path build-and-go-live plan in the proposed business-plan report (12), not from `07` §9.2.

---

## 5. Case studies: failures and troubled programs

### 5.1 Failure / troubled-program table

| Program | Country | Vendor | Cost (reported) | What went wrong | Lesson for us |
|---|---|---|---|---|---|
| **VA EHR Modernization (EHRM)** | USA | Cerner → Oracle Health | Contract $10B (May 2018), later above $16B, then raised by $17B to **just under $27B** in Aug 2026 [50][84]. Latest total program estimate ~$37B. FY26 $3.4B with 30% contingent on performance metrics. FY27 request $4.2B [50]. | First go-live in Spokane (24 Oct 2020). **Four more sites in 2022:** Walla Walla, Columbus, Roseburg, and White City. That made five VA sites live at the April 2023 pause. The joint North Chicago (Lovell) site followed in Mar 2024 [48]. Problems with reliability, pharmacy, and routing. The OIG found that orders went to an "unknown queue" with no owner, causing patient harm. From Oct 2020 to Jun 2021, **more than 11,000 orders** were not delivered, and VHA's clinical review classified **149 adverse events** (OIG report 22-01137-204, 14 Jul 2022) [54][83]. In VA surveys, **79% disagreed that the system enabled quality care and 89% that it made them efficient**. Trouble tickets kept rising. No satisfaction targets [53]. **Paused in April 2023.** | Never ship a routing path without an owner. Set readiness and satisfaction targets before scaling. Get an independent operational assessment. Avoid mixed-system seams by deploying regionally. |
| **VA 2026 resumption** (status as of 15 Sep 2026) | USA | Oracle Health | See above | **Live:** Ann Arbor, Battle Creek, Detroit, Saginaw (11 Apr). Chillicothe, Cincinnati, Fort Thomas (KY), Dayton (6 Jun). Fort Wayne, Marion (IN), Indianapolis (22 Aug). **Planned:** Anchorage and Cleveland (24 Oct 2026). 26 sites in 2027. All 170 by Nov 2031 [48]. VA says it fixed "hundreds of problems" and is hiring 400 more support staff [51]. Lawmakers remain skeptical about cost [50]. All 10 GAO 2023 recommendations were still open as of Sep–Dec 2025: 6 open and 4 "open – partially addressed" [53]. VA describes Michigan clinician feedback as "exceptionally positive," a self-report [85]. **No independent post-go-live assessment of the 2026 waves had been found as of 16 Oct 2026 ‡.** | A troubled program *can* restart with regional waves, more staff, and field involvement. Benefits remain unproven, so watch the 2026–27 waves. |
| **DoD MHS GENESIS** | USA | Cerner/Leidos | $4.3B initial ceiling (awarded to Leidos Partnership for Defense Health, 29 Jul 2015). Raised by $1.2B to more than $5.5B in Jun 2018 [86]. Lifecycle cost is higher. | Initial operational capability at four Pacific Northwest sites in 2017: Fairchild AFB, Oak Harbor, Bremerton, and Madigan. DOT&E's April 2018 report found it **"neither operationally effective nor operationally suitable."** Users completed only 56% of 197 tasks, and usability, training, and help-desk support were poor [86]. The program then stabilized and rolled out in waves to completion, with the final joint go-live at Lovell in Mar 2024 [48][57]. When fully deployed it serves DoD's 9.5M beneficiaries and 205,000 medical providers [57]. | Early sites are learning labs. Freeze the enterprise build and then scale in waves. Measure operational suitability formally. |
| **UK NPfIT** | England | BT, CSC (Lorenzo), Accenture, Fujitsu | Original £2.3B (3 years). NAO 2006: £12.4B over 10 years. Commonly cited ~£10B (‡ PAC 2013) [58][59] | Central mandate with weak clinician engagement. Vendor exits (Accenture 2006) and terminations (Fujitsu 2008). Lorenzo was not live in a single acute trust by 2009. Weak transparency. **Dismantled in 2011** [58]. | Avoid centrally imposed, one-size systems without local ownership. Contracts must reward clinical outcomes. Be transparent. |
| **Sundhedsplatformen** (Capital Region & Region Zealand) | Denmark | Epic | ~DKK 2.8B for 18 hospitals / 2.8M residents [60] | Go-live from 20 May 2016. Chaotic training. **Untranslated content (doctors used Google Translate).** Poor integration with national records. **62% of physicians dissatisfied (end of 2018)**, and a petition calling for removal [60]. Rigsrevisionen criticized the implementation, including productivity loss ‡. | Localization is a patient-safety requirement. Budget for the productivity dip. Integrate with national infrastructure before go-live. |
| **Helseplattformen** (Central Norway) | Norway | Epic (IBM for identity and access) | Original system acquisition-cost estimate NOK 1.7B (18-year life) [61]. Original programme frame NOK 4.1B. **~NOK 6.7B** total for preparation, development and rollout across trusts, municipalities and GPs by Oct 2024 [93] *(reconciled 2026-10-16; see `01` §9.2)*. Consultant (EY) spending of NOK 557M against a NOK 70M framework, found unlawful [61]. | Trondheim municipality went live May 2022 and St. Olavs on 12 Nov 2022. About 16,000 patient letters went unsent, and the project CEO was dismissed in Mar 2023. About 25% of doctors at the main hospital considered quitting, according to NRK about two months after go-live. After a year, **more than 90% of doctors at affected hospitals viewed the system as a threat to patient health**, and there were large protests at seven hospitals [60][61]. **Riksrevisjonen (Oct 2024): "sterkt kritikkverdig,"** citing patient-safety risks, reduced efficiency, cost overruns, and low uptake by GPs and municipalities [61]. Still expanding (Helse Møre og Romsdal, Helse Nord-Trøndelag) [61]. | A combined municipal and hospital scope multiplies complexity. Readiness was poor at both the company and the hospital. Govern consultant spend. |
| **Millennium in Västra Götaland (VGR)** | Sweden | Oracle Health (Cerner) | **SEK 657M paid to Oracle at termination (Aug 2026)** [62]. Total program cost not verified ‡. | Go-live in southern VGR in Nov 2024. **Rollout halted after three days** for serious shortcomings. Indefinite pause in Feb 2025. Working group recommended abandonment (Nov 2025). **Contract terminated Aug 2026.** Region Skåne postponed (Dec 2024) and **decided not to implement (Mar 2026)** [62]. | Even a large regional buyer will walk away after years of investment. Pre-go-live dress rehearsals and safety gates must be real. A modular or best-of-breed alternative is now explicitly on the table in Sweden, which is an opening for new vendors. |
| **Apotti** (Helsinki-Uusimaa: health + social care) | Finland | Epic | **Conflicting:** €407M investment cost "in its current scope" per Apotti's FAQ (undated) [94] vs **€625M by Nov 2022** per Helsingin Sanomat (scope unclear) [60] *(reconciled 2026-10-16; see `01` §9.2)* | Rollout from 2018. The interface was criticized as overly complex. A patient received the wrong chemotherapy drug because of an unclear menu. **619 doctors filed a complaint with the national regulator Valvira (Jul 2022)** [60]. | Menus and selection lists are safety-critical. Integrated health and social care scope raises complexity. |
| **Connect Care** | Canada (Alberta) | Epic | Original budget reported ~CAD 459M ‡ | Replaced **more than 1,300** health information systems from 2019 in staged launches. Now live across all four provincial health agencies plus partners [66]. Clinician productivity concerns were publicly reported during launches ‡. | It succeeded at consolidation, but clinician experience took sustained optimization. Classed as "troubled-to-recovering." |
| **ieMR** | Australia (Queensland) | Cerner | Not verified ‡ | Digital hospital from 2015–16 (Princess Alexandra). The Queensland Audit Office (2018) reported higher-than-planned costs and benefits not yet demonstrated ‡. | Define and baseline benefits before go-live. |
| **ACT Digital Health Record** | Australia (ACT) | Epic | Not verified ‡ | Territory-wide go-live in Nov 2022, with early workflow and reporting problems reported ‡. | Small jurisdictions still need full readiness discipline. |
| **Cambridge University Hospitals (eHospital)** | England | Epic | ~£200M over 10 years incl. HP infrastructure [63] | Go-live 26 Oct 2014, the first Epic site in the UK ‡. After 2.1M records were transferred, the system became unstable. Ambulance diversion for about 5 hours was reported but is not in [63] ‡. Pathology results were hard to communicate, and GPs were told to halt routine bloods at short notice. **CQC placed the trust in special measures (Sep 2015)**, and the CEO and finance director resigned. The claim that CQC cited staffing pressures together with the EHR is ‡. The trust recovered: out of special measures in Jan 2017, Global Digital Exemplar, and HIMSS Stage 6 by Nov 2015 [63]. | Lab interfaces and result-matching are go-live killers. Recovery is possible with sustained leadership. |
| **Children's Hospital of Pittsburgh CPOE** | USA | Commercial CPOE | n/a | Mortality rose from 2.80% to 6.57% after a rapid go-live, with CPOE rolled out hospital-wide over 6 days. The adjusted odds ratio was 3.28 [23]. Workflow constraints, such as entering orders only after patient arrival, delayed critical care (paper body ‡). | Workflow-blind configuration kills. Test time-critical pathways (ICU, ED, transport) end to end. |
| **LMIC national EMR projects** (general pattern) | Various | Various | Various | Heeks' "design–reality gap" model [74] explains failure and success. Heeks finds the evidence base on HIS failure rates weak, but his best estimate is that failure is "an important problem." The claim that *most* systems in developing countries fail totally or partially comes from Heeks' wider work and is ‡. Common causes are pilot proliferation without scale, donor-driven designs, unreliable power and connectivity, and staff turnover ‡. | Offline-first design, low total cost of ownership, local partners, and open standards. |
| **"Digital darkness" events** (ransomware, outages) | Global | Various | Large (e.g., multi-week EHR outages at major US systems, 2024) ‡ | Ransomware and third-party outages (e.g., the 2024 CrowdStrike and Change Healthcare disruptions) left hospitals on paper ‡. ECRI ranks this hazard #2 for 2026 [21][79]. | Business-continuity access, immutable backups, rehearsed downtime, and segmentation are product features. |

### 5.2 Cross-cutting root causes of failure

1. **Readiness defined by date, not by metrics.** Seen at VA, Helseplattformen, CUH, and VGR [53][60][61][62][63].
2. **Weak change management and governance,** including no clinician voice and no protected time [28][53].
3. **Under-localized content.** Examples: translation in Denmark, regulatory fit, local terminology [60].
4. **Interfaces, lab, and pharmacy result routing,** including orphan queues and result mismatches [54][63].
5. **Training on a generic build, too little and too early** [28].
6. **Infrastructure speed and reliability neglected** [30][40].
7. **Hybrid systems across a care network** without a plan to remove the seams [48][52].
8. **Scope inflation:** combined municipal, social, and hospital scope (Norway, Finland) and national centralization (NPfIT) [58][60][61].
9. **Cost under-estimation.** Missing items include backfill, consultants, lost revenue, and sustained optimization [50][60][61].
10. **No independent operational assessment or safety case** before scaling [53].

---

## 6. Case studies: successes

### 6.1 Success case table

| Organization | Country | System | Outcome / evidence | Key success factors |
|---|---|---|---|---|
| **Kaiser Permanente HealthConnect** | USA | Epic (after an abandoned in-house build with IBM that wrote off ~$452M) | Deployed across all 8 regions over about 6 years. More than 8.6M members by 2010, 12.2M by 2020. Cost reported at more than $6B [64]; earlier press put it at ~$4B ‡. In one region (Kaiser Permanente Northwest, more than 225,000 members), age- and sex-adjusted office visits fell **26.2%** from 2004 to 2007. Scheduled telephone visits rose more than eightfold, and secure messaging nearly sixfold [65]. | Integrated payer and provider incentives. "Buy, not build" after failure. Enterprise standardization. Redesigned care models (virtual care). |
| **Mayo Clinic (Plummer Project)** | USA | Epic, replacing Cerner and GE Centricity | ~$1.5B ‡. Single enterprise record across Rochester, Arizona, Florida, and the Health System, 2017–18 ‡ | "One Mayo" practice convergence. Physician-led design. Disciplined waves. |
| **Mass General Brigham** | USA | Epic, replacing homegrown LMR and others | ~$1.2B initially reported (Boston Globe, May 2016); ~$1.6B total by 2018, mostly lost patient revenue, with software payments under $100M (New Yorker, Nov 2018) [60] *(reconciled 2026-10-16; see `01` §9.2)* | Executive commitment through a large financial dip. Integration of a federated system. |
| **Cleveland Clinic** | USA | Epic (long-term customer) ‡ | Early portal and analytics leader ‡ | Long-term optimization culture. |
| **UTHealth Houston; CommUnityCare** | USA | Epic | UTHealth: NEES at the **97th percentile** three years after go-live. CommUnityCare (FQHC): NEES **70.2** two years after go-live [28] | Workflow-specific training. Nurse focus. Governance [28][31]. |
| **Seattle Children's; Mercy; Wooster** | USA | Epic (Mercy, Seattle Children's) and others | Seattle Children's NEES **+71.4**. Mercy −32 min/nurse/day. Wooster −96 fields and +20.9 NEES [37] | Nursing documentation rationalization with frontline engagement [37]. |
| **Singapore NGEMR** (NHG & NUHS clusters; SingHealth to follow) | Singapore | **Epic.** A Synapxe-run government site describes NGEMR as "powered by the Epic EMR system" [87]. | **37 institutions** live as of Jul 2024. Replaces **close to 90 legacy systems** at NHG and NUHS, whose earlier EMRs were developed in 1998 [67]. NUHS went live first (Feb 2022 ‡) and NHG from Jul 2024 ‡. SingHealth's phased rollout and SAF medical facilities are both due to finish in 2028 [88]. | National IT agency (Synapxe) with cluster governance. Standardized data and workflows. Phased by institution. |
| **King Faisal Specialist Hospital & Research Centre (KFSH&RC)** | Saudi Arabia | **Cerner Millennium (now Oracle Health)**, per 2015 primary evidence [89]. Later evidence: a 2020 KFSH&RC press release on its Millennium upgrade [95], and 2022 reports of Oracle Cerner transplant-workflow work and an AI MoU [96]. **No evidence of Epic.** The current platform has not been re-confirmed for 2024–2026. *The brief said Epic; the sources indicate Cerner* [68]. *(Reconciled 2026-10-16: same wording as `01` §4.)* | On 12 Oct 2015 it became the first health system outside North America at **HIMSS Stage 7 on the ambulatory model (O-EMRAM)**. It had reached inpatient EMRAM Stage 6 in 2012 [89]. Patient-flow command center cut average bed wait from **32 to 6 hours**. 30+ AI tools by 2025 [68]. **KLAS 2025 Pinnacle Award (nurses)** [29] | Sustained investment. In-house informatics and AI centre. Command-center operations. |
| **Dubai Academic Health Corporation (Dubai Health)** | UAE | **Epic**, through the former Dubai Health Authority's "Salama" EMR programme (2015–18). Contemporary press reporting DHA's IT director in Apr 2017 says Salama staff were trained "by the international company EPIC" [97]. No DHA or Epic primary press release was fetched, and there is no evidence that Salama is Cerner-based. *(Reconciled 2026-10-16: same wording as `01` §4, which previously said Cerner [U].)* | KLAS Pinnacle 2025 for **both physicians and nurses**. NEES among the highest KLAS has recorded. 100th percentile for governance agreement [29][32] | Governance, training, personalization (Middle East model) [32]. |
| **Hamad Medical Corporation** | Qatar | **Oracle Cerner**, deployed as HMC's Clinical Information System [90]. In 2022 it moved to an Oracle Cerner managed-technology platform ‡ | 100th percentile in KLAS for nurse training sufficiency and workflow specificity [32]. HIMSS Stage 7 reported ‡ (not confirmed) | National single-system strategy. Heavy training investment. |
| **Seoul National University Bundang Hospital (SNUBH)** | South Korea | **BESTCare** (in-house, later commercialized via ezCaretech ‡) | **First hospital outside the US to reach HIMSS EMRAM Stage 7 (2010).** This is the *inpatient* model; KFSH&RC's 2015 "first outside North America" was on the ambulatory model, so the two claims do not conflict. Revalidated 2016, 2019, and 2024 [69]. BESTCare 2.0 exported to Saudi Arabia ‡ | Paperless from the start. Clinician-developer co-location. Export as a product. |
| **Sheba Medical Center** | Israel | Chameleon (Elad) EHR ‡ plus national HIE ‡ | Newsweek #8 hospital worldwide (2025). ADAMS Center built on the MDClone platform [73]. The EHR vendor is not named in [73] ‡ | Innovation culture (ARC). Strong data layer on top of the EHR. |
| **Estonia national e-health** | Estonia | National platform | **100% of patients** have a countrywide digital record. 2.7M patient queries per month. #1 in the Bertelsmann Foundation 2024 digital health index (as stated by e-Estonia) [70]. Launched 2008, on X-Road ‡ | National digital ID, a legal mandate, and federated data exchange. |
| **Denmark sundhed.dk / MedCom** | Denmark | National portal and messaging standards ‡ | Long-running national portal ‡ | Standards-first national infrastructure. A contrast to the troubled regional EHR rollout. |
| **Rwanda / Kenya OpenMRS** | Rwanda, Kenya | OpenMRS (open source) | Conceived in 2004 at AMPATH (Eldoret). First deployments in 2006 in Kenya and at Rwinkwavu, Rwanda. Country distributions such as **KenyaEMR** [71] | Open source, community governance, HIV-program funding, local developer capacity. |
| **Alberta Connect Care** (partial success) | Canada | Epic | Consolidated more than 1,300 systems into one provincial record [66] | Provincial mandate, phased launches, CMIO-led governance [66]. |
| **Apollo Hospitals; Narayana Health** | India | Mixed. Narayana built its own cloud HIS, **"Athma"** ‡ | Narayana: in-house cloud HIS/ERP across its network, cited as low-cost ‡. Several Indian hospitals hold HIMSS Stage 6/7 ‡ | Cost discipline, in-house engineering, cloud-native design. Independent verification is limited ‡. |

### 6.2 Common success factors

1. **Clinical ownership with executive backing.** CMIO and CNIO authority, protected time, and leaders who round [28][34][41].
2. **One enterprise design, with deviations governed.** "Adopt the model" and practice convergence (Mayo, Kaiser, Singapore) ‡ [67].
3. **Training as a continuous programme:** 11+ hours at onboarding and 3–5 hours a year thereafter [32].
4. **Infrastructure speed and reliability treated as clinical safety** [30][40].
5. **Optimization never stops.** Nursing field rationalization, ambient AI, and sprints [37][39][75].
6. **Measurement:** baseline and repeat NEES, telemetry, and safety dashboards [28][38].
7. **Patience and capital:** multi-year budgets that include lost revenue [60][64].
8. **Fit to context.** Integrated payer–provider (Kaiser), national ID and data exchange (Estonia), open source for low-resource settings (OpenMRS).

---

## 7. Maturity models as product roadmap

### 7.1 HIMSS EMRAM: stage-to-capability mapping

HIMSS criteria pages could not be fetched in this session because HIMSS blocks automated access. The stage summaries below follow the widely published 2018-era EMRAM framework ‡. The **2022 refresh** kept stages 0–7 but rebalanced criteria. It strengthened governance, clinician and patient engagement, security, and outcome evidence, and Stages 6–7 require validation ‡. Exact thresholds must be confirmed against the current HIMSS criteria document. In 2018 about **6% of US hospitals** were at Stage 7 [76].

*Pass-2 note:* HIMSS pages still return HTTP 403 to automated access, so the criteria remain ‡. Hospital validation announcements from 2021 still describe Stage 6 as "technology-enabled medication, blood products & human milk administration; risk reporting; full CDS," which matches the table below. Older HIMSS Analytics material gives these Stage 7 thresholds, which may have changed in the refresh ‡:
- more than 90% CPOE;
- more than 95% closed-loop medication administration;
- more than 95% for blood products, human milk, and specimen collection;
- at least four months of data;
- on-site validation.

| Stage | HIMSS stage theme (cumulative) ‡ | Capabilities our HMS must provide | Typical thresholds / validation ‡ |
|---|---|---|---|
| 0 | Not all three key ancillaries installed (lab, pharmacy, radiology) | — | — |
| 1 | Ancillaries: LIS, pharmacy, RIS/cardiology; PACS; non-DICOM image management | LIS, pharmacy information system, RIS (or certified interfaces); enterprise imaging viewer integration; DICOM and non-DICOM links | Self-reported |
| 2 | Clinical data repository (CDR); internal interoperability; basic security | Single CDR; master patient index; controlled vocabularies (SNOMED CT, LOINC, RxNorm or national drug dictionary, ICD-10/11); role-based access; audit logging | Self-reported |
| 3 | Nursing and allied-health documentation; eMAR; role-based security | Flowsheets, care plans, assessments; eMAR; allied-health documentation | Usage thresholds |
| 4 | **CPOE with CDS**; nursing/allied documentation; basic business continuity | CPOE for all order types; drug–drug, drug–allergy, and dose-range CDS; order sets; downtime business-continuity access | CPOE usage threshold |
| 5 | Physician documentation using structured templates; intrusion/device protection | Structured physician notes (problem-oriented, templates with discrete data); endpoint, network, and device security | |
| 6 | **Technology-enabled (closed-loop) administration of medications, blood products, and human milk**; risk reporting; full CDS | Bedside barcode/RFID (BCMA), transfusion verification, breast-milk tracking; safety-event reporting; advanced CDS (variance, compliance, protocols) | Scanning-compliance thresholds; on-site or virtual validation |
| 7 | **Complete EMR (paperless)**; external HIE; data analytics; governance; disaster recovery; privacy and security | Paperless workflows; HIE (IHE profiles, FHIR R4, national exchange); clinical data warehouse and quality analytics; tested disaster recovery and business continuity; privacy monitoring (e.g., inappropriate-access detection); outcome case studies | Validation plus outcome case studies |

**Other HIMSS models ‡:**
- **O-EMRAM:** outpatient, stages 0–7.
- **AMAM:** analytics maturity, stages 0–7, covering data governance, enterprise analytics, and predictive and prescriptive analytics.
- **INFRAM:** infrastructure, stages 0–7, covering network, security, mobility, collaboration, and data center/cloud.
- **DIAM:** enterprise imaging.
- **CCMM:** continuity of care and interoperability, including patient engagement.
- **DHI:** the Digital Health Indicator.

**Use as a roadmap:** treat EMRAM Stage 7, INFRAM Stage 6+, and AMAM Stage 6+ as release-train acceptance suites. Provide a "**maturity readiness report**" in-product that shows customers their usage metrics against EMRAM thresholds, such as CPOE percentage and BCMA scanning compliance.

### 7.2 China EMR application-level grading (电子病历系统应用水平分级评价) ‡

The National Health Commission standard, notice 国卫办医函〔2018〕1079号 dated 3 Dec 2018, defines **levels 0–8 (nine levels)**. The notice set these targets [92]:
- all tertiary hospitals at **Level 3+ by 2019**;
- all tertiary hospitals at **Level 4+ by 2020**;
- secondary hospitals at **Level 3+ by 2020**.

EMR grade also feeds tertiary public-hospital performance assessment ‡. Related schemes ‡:
- "Smart Service" grading (智慧服务, 0–5);
- "Smart Management" grading (智慧管理, 0–5);
- Interoperability Standardization Maturity assessment (互联互通).

| Level | Description ‡ | HMS capability implication |
|---|---|---|
| 0 | No EMR system | — |
| 1 | Independent departmental systems | Departmental modules |
| 2 | Data exchange within departments | Departmental data sharing |
| 3 | Data exchange between departments; preliminary decision support | Hospital-wide orders and results flow |
| 4 | Hospital-wide information sharing; **primary** decision support | CDR, CPOE, basic CDS |
| 5 | Unified data management; **intermediate** decision support | Enterprise data platform, rules engine |
| 6 | **Closed-loop management of full-process medical data**; **advanced** decision support | Closed-loop medication, transfusion, specimen, and exam tracking; advanced CDS |
| 7 | Medical safety and quality control; **regional** information sharing | Quality dashboards, regional HIE |
| 8 | Health-information integration; continuous safety and quality improvement | Population health and continuous improvement analytics |

### 7.3 How hospitals use maturity models to choose vendors

- **RFP checklists.** Gulf, Asian, Turkish, and Chinese tenders commonly require demonstrated EMRAM (and often INFRAM/AMAM) attainment at reference sites, or contractual support to reach a target stage ‡.
- **Reference visits** to Stage 7 sites. KFSH&RC and SNUBH are regional showcases [68][69].
- **Accreditation linkage:** JCI accreditation and national programmes (China grading, Saudi and UAE digital health strategies) ‡.
- **Implication:** we need two or three **flagship Stage 7 reference customers** in our launch markets within 24–36 months of first go-live (Est.).

---

## 8. In-house build vs buy

| Home-grown system | Organization | Era | Fate | Why it moved (or stayed) |
|---|---|---|---|---|
| **VistA / DHCP** | US VA | From 1977/78. Public domain [72] | VA decided in 2018 to replace it with Cerner (now Oracle) [72] | Aging architecture and interface, burden of sustaining more than 180 applications, interoperability with DoD and community care [72]. The replacement has been harder than expected. |
| **HELP** | Intermountain (LDS Hospital) | From 1967 ‡ | Cerner co-development (iCentra, 2015+). In Sep 2023 Intermountain announced a move to Epic across 33 hospitals and 385 clinics in seven states, targeted for the end of 2025 [91]. Completion not verified ‡ | R&D cost, regulatory certification, and enterprise merger alignment ‡. Intermountain cited one unified platform, cost savings, and interoperability [91]. |
| **LMR / CAS** | Partners (MGB) | 1990s–2015 | Epic (2015–16) [60] | Unified enterprise record, revenue-cycle integration, regulatory burden |
| **StarPanel / WizOrder** | Vanderbilt | 1990s–2017 | Epic ("eStar," 2017) ‡ | Same as above. Academic innovators found it hard to sustain a full-suite product ‡. |
| **RMRS / Gopher / CareWeb** | Regenstrief / Eskenazi | 1970s–2016 | Epic ‡ | Same |
| **In-house CIS with IBM** | Kaiser | 1990s–2002 | Abandoned (~$452M write-off). Then Epic [64] | Build failure at scale |
| **BESTCare** | SNUH / SNUBH | 2000s–present | **Kept and commercialized.** Stage 7 since 2010 [69] | National market with lower regulatory friction. Strong hospital IT organization. Export ambitions. |
| **Athma** | Narayana Health | 2010s–present ‡ | Kept. Cloud-native in-house HIS ‡ | Cost (Indian price points), control, speed ‡ |
| **Chameleon** | Elad / Israeli hospitals ‡ | 2000s–present | Kept and commercialized ‡ | Local market fit |

**Why most US home-grown systems moved to Epic:**
1. The full-suite scope (clinical, revenue cycle, patient portal, analytics, interoperability) outgrew academic budgets.
2. The regulatory treadmill (certification, quality reporting, interoperability rules) consumed developer capacity.
3. Mergers required one enterprise record.
4. Network effects, such as record exchange among customers and shared content.
5. Retaining key-person developers was hard.

**Implications for a new vendor:**
- The winners outside the US market (SNUBH, Narayana, Elad) built *for their own market's price points and regulations*, often from inside a hospital. Their advantages were clinician–developer proximity and low total cost of ownership.
- A new vendor should be **platform-first** (a FHIR-first external/partner API, open APIs, an app ecosystem) to replicate network effects it cannot buy. *(Reconciled 2026-10-16: this previously said "FHIR-native". Cross-report note: being platform-first is about the external contract. The pack's core data posture is a domain-owned PostgreSQL core that stores clinical facts as FHIR-shaped JSONB, with a generated FHIR R4 projection/façade (`06` §7.1, `08` §3.11/§4.6, `11` §0). `02`'s FHIR-native-core option is tested in a spike before ADR-001 is frozen.)*
- It should **ship a full foundation content model** to compete with Epic's Foundation System.
- It should **target markets where incumbents are weak or failing.** Sweden's VGR and Skåne are now explicitly considering modular solutions [62]. Other targets are price-sensitive emerging markets and the Middle East, where maturity models drive buying.
- It should **co-develop with one or two anchor hospitals.** This replicates the home-grown advantage of clinicians sitting next to developers, without the sustainability trap.

---

## 9. Total cost of ownership and ROI evidence

### 9.1 TCO components (Est.)

| Component | Notes | Indicative share of 5–10-year TCO (Est.) |
|---|---|---|
| Software license / subscription | Perpetual license plus maintenance (often ~18–22% a year ‡) or a per-bed/per-user subscription | 15–30% |
| Vendor implementation services | Often comparable to or larger than first-year software cost | 10–20% |
| Internal labor | Analysts, trainers, clinical builders. **Clinician training time and backfill are often the largest hidden cost.** | 20–35% |
| Infrastructure / hosting | Cloud or data center, end-user devices, Wi-Fi, scanners, printers | 10–15% |
| Interfaces, data conversion, legacy archive | Includes legacy run-out | 5–10% |
| Productivity and revenue loss at go-live | MGB's total cost was dominated by lost revenue, support, and implementation labor, not software [60] | 5–20% (highly variable) |
| Ongoing optimization and upgrades | 50–70% of the build team retained | Recurring |

### 9.2 ROI evidence

- **Care-model transformation (Kaiser Permanente Northwest, 2004–07):** office visits fell 26.2% as telephone and secure-message care grew [65].
- **Clinician-experience ROI:** KLAS interviews link better EHR experience to:
  - lower turnover and recruiting cost;
  - faster chart closure;
  - fewer duplicate tests;
  - better quality and safety;
  - improved patient access.

  The quantified figures sit in charts not reproduced here [42]. Burnout-related physician turnover and reduced clinical hours cost the US about **$4.6B a year**, with a range of $2.6–6.3B, or about $7,600 per employed physician per year (Han et al., *Ann Intern Med* 2019 [82]). Each 1-point SUS gain lowers burnout odds by 2–3% [1][2], which links usability to cost.
- **Documented operational wins:**
  - Mercy: 32 nurse-minutes saved per day across 50 hospitals [37].
  - Wooster: 15,000+ nursing hours a year [37].
  - CHOP: **$21M+ in savings** and +13.3 NEES [37].
  - KFSH&RC: bed waits cut from 32 to 6 hours [68].
- **Ambient AI:**
  - −13 points of burnout prevalence and −0.9 h of after-hours documentation [18];
  - more than 80% of adopters chose *not* to add patients with the saved time [36]. ROI should therefore be framed around retention and well-being, not volume.
- **Caution:** national-programme ROI is largely unproven or negative where implementation failed (NPfIT, VGR) [58][62]. Benefits registers with baselines are rare. Build benefits tracking into the product (Section 10.3).

---

## 10. Implications for our build

### 10.1 Product design principles

1. **Performance budgets are release blockers.**
   - Publish SLOs: login under 5 s; p95 screen transition under 1 s. Availability follows the pack's single NFR table in `08` §12.6: a **99.95% contractual write-path SLA with a 99.99% internal SLO**, and **99.99% for read and continuity paths** (reconciled 2026-10-16).
   - Instrument real-user monitoring per screen and per site.
   - Slow is unsafe and unloved [30][40].
2. **"Foundation content" is our second product.** Ship an opinionated, evidence-based configuration (order sets, flowsheets, note templates, CDS, roles, reports) localized per market. Target **at least 80% adoption** at customers (Est.). Customization goes through governed, versioned "deviation" artifacts that survive upgrades.
3. **Documentation is synthesis.**
   - Structured-data-first notes.
   - Provenance on every span (typed, template, copied, imported, AI).
   - Visible copy-forward marking.
   - "Changes since last note" diffs.
   - Bloat indicators.
   - Jurisdiction-specific documentation profiles, so US billing rules do not shape notes everywhere [8][12][13].
4. **Nursing first-class.** Charting by exception, flowsheet field analytics with regulatory tags, one-click field retirement through governance, shift-based worklists, and AI shift summaries [37][39].
5. **CDS as a governed portfolio.**
   - Passive by default. Interruptive only for high-severity, high-PPV rules.
   - Every rule has an owner, evidence link, override-reason analytics, and an auto-review trigger.
   - Ship an "alert burden" dashboard.
   - Pass the Leapfrog-style CPOE test out of the box [14][15][17].
6. **No orphaned work.**
   - Every order, result, message, referral, and letter has an owner and a service-level timer.
   - Unroutable items raise real-time alarms.
   - This is the single most important lesson from VA's "unknown queue" and Helseplattformen's unsent letters [54][60].
7. **Wrong-patient defenses everywhere.** Persistent identity banner with photo, context-switch cues, and re-verification at sign when context recently changed. Track retract-and-reorder rates [26][47].
8. **Team-based inbox and work queues** with pools, rules-based routing, intake forms, auto-close, and AI triage and drafts [35].
9. **Ambient AI and generative features native, with guardrails.**
   - Mandatory human sign-off.
   - Provenance tagging.
   - Edit-distance and safety telemetry.
   - In-product training. Fewer than 25% of users feel trained, and optimization know-how moves NEES by about 43 points [39].
   - Align with SAFER 2025 organizational AI guidance and decision-support transparency expectations [47].
10. **Keyboard-first, consistent design system, WCAG 2.2 AA.** Command palette, typo-tolerant search, macros, consistent sign/cosign patterns, no modal stacks, target size and redundant-entry compliance [78].
11. **Downtime-proof by design.** Local read-only business-continuity access, downtime forms, reconciliation after recovery, ransomware-resilient backups, and quarterly drill tooling [21][47].
12. **Interoperability as a UX problem.** Outside data is de-duplicated and reconciled into the longitudinal record with clear provenance. External-data usability is the hardest unsolved satisfaction gap, even at Level 6 [31].
13. **Usability engineering built into the software development lifecycle.**
    - NISTIR 7804 EUP for safety-critical workflows.
    - 15–20 participants per user group in summative tests (more than the ONC minimum of 10).
    - NISTIR 7742-format reports.
    - Usability regression tests every release [43][46].
14. **Localization as safety.** Professional translation with clinician review per locale, local terminologies, and local regulatory content. Never ship partially translated clinical paths [60].

### 10.2 Implementation services model

1. **Readiness gates, not dates.** Go/no-go criteria are contractual:
   - training completion of at least 95% and proficiency pass of at least 85% (Est.);
   - zero open severity-1 defects;
   - performance SLOs met in dress rehearsal;
   - downtime drill passed;
   - safety dashboard live;
   - satisfaction and operational targets defined (the GAO VA lesson [53]).
2. **Independent operational assessment** before scaling beyond the first wave, as GAO recommended for VA [53].
3. **Certified customer analysts and trainers.** Run our own certification academy for analysts, principal trainers, and superusers. Customers must certify staff before build, as in Epic's model ‡.
4. **Clinician-led governance blueprint** shipped as an implementation artifact: council charters, intake forms, scoring rubric, 30-day loop closure, communication templates [34].
5. **Training standard:**
   - 6–11 hours of role- and workflow-specific onboarding on the customer's build;
   - personalization labs;
   - a 90-day staged curriculum;
   - 3–5 hours of ongoing training a year;
   - in-product micro-learning [28][29][32].
6. **Superuser programme:** about 1 per 8–15 users per unit and shift, with protected, paid time and advanced training [33] (ratio Est.).
7. **Go-live package:**
   - 24/7 command center for 2–4 weeks;
   - ATE ratios as in Section 4.3;
   - a pre-built safety, flow, revenue, and ticket dashboard;
   - daily safety huddle protocol;
   - pre-agreed rollback and slow-down triggers.
8. **Regional/market waves** for multi-site customers so care networks do not straddle systems [48][52].
9. **Post-live optimization included in the contract:**
   - a 90-day stabilization;
   - optimization sprints at 3–6 and 12 months;
   - an annual nursing documentation rationalization cycle;
   - NEES or SUS re-measurement at 6, 12, and 24 months [28][37][75].
10. **Outcome-linked commercial terms.** Tie 10–20% of implementation fees (Est.) to measured outcomes at 12 months: availability and latency SLOs, NEES or SUS improvement against baseline, documentation-time and after-hours metrics, and revenue-cycle KPIs.
11. **Transparent cost model** that includes backfill, lost revenue, and optimization. Avoid open-ended consultant frameworks (Helseplattformen's EY overrun) [61].
12. **Size-specific offerings:**
    - **S:** SaaS with foundation content, 9–12 months, remote-first training.
    - **M:** 12–18 months, hybrid.
    - **L:** wave-based programme with a dedicated on-site team and anchor co-development.
    - *(Reconciled 2026-10-16: these durations are for a mature product on foundation content. They do not cover the first design-partner go-live, which also depends on MVP build time; see the note under §4.12.)*

### 10.3 Metrics to instrument from day one

| Domain | Metric (definition) | Source / rationale | Target direction |
|---|---|---|---|
| **Clinician time** | EHR time per 8 h scheduled; work outside work (after-hours and unscheduled days) per 8 h; time in notes, orders, inbox, and chart review per 8 h; undivided-attention proxy | Sinsky core metrics [81] ‡. Arndt [4][5]. Holmgren [8] | ↓ |
| **Documentation quality** | Median note length; share of note text typed, templated, copied, imported, or AI; duplicate fraction vs prior notes; chart-closure time | Rule [12]. Steinkamp [13] | Length and duplication ↓; closure faster |
| **Nursing** | Documentation minutes per shift; flowsheet rows per shift; share of fields never viewed downstream; care-plan charting time | KLAS nursing [37] | ↓ |
| **Inbox** | Messages per clinician per day by type; share handled by team or pool; time-to-close; after-hours inbox minutes; AI-draft use and edit distance | Holmgren [9]. KLAS [35] | Clinician load ↓ |
| **CDS** | Interruptive alerts per 100 orders; override rate and PPV per rule; time-to-dismiss; Leapfrog-style CPOE test score | [14][15][17] | Alerts ↓; PPV ↑; CPOE score ↑ |
| **Safety** | Retract-and-reorder (wrong-patient) rate per 100,000 orders; **orphaned or unrouted work items (target 0)**; overdue critical-result acknowledgements; BCMA scan compliance; IT-tagged safety events | [26][47][54] | ↓ (orphans = 0) |
| **Performance and reliability** | Login time; p50/p95/p99 screen latency per screen and site; availability; unplanned downtime minutes; business-continuity data freshness | KLAS [30][40]. ECRI [21] | Meets SLOs |
| **Experience** | In-product micro-surveys (SUS, NEES-style items) by role and specialty; annual full survey; optional KLAS Arch participation | [1][2][28][38] | ↑ |
| **Adoption** | Personalization artifacts per user at 30/60/90 days; proficiency scores; training completion; feature adoption (order sets, ambient) | [30][39] | ↑ |
| **Implementation health** | Readiness scorecard; TDR defect counts; go-live tickets per user per day; ticket aging over 45 days (a GAO-flagged metric) | [53] | Converge to baseline |
| **Revenue cycle** | DNFB days; charge lag; first-pass claim yield; denial rate; AR days; clinic volume vs baseline | Section 4.9 (‡/Est.) | Return to baseline within 90 days (Est.) |
| **Maturity** | EMRAM-aligned usage (CPOE %, BCMA %, structured physician documentation %, HIE transactions) | Section 7 | ↑ to Stage 7 thresholds |

### 10.4 Pitfalls to avoid

1. **Shipping a "configurable blank slate."** Customers then rebuild everything, implementations take longer, and upgrades break. Ship foundation content instead.
2. **Assuming telemetry equals satisfaction.** It explains only about 3% of the variance [38]. Always pair it with surveys.
3. **Letting copy-forward and templating run unmarked.** The result is 50%+ duplicated text [13].
4. **Adding alerts without retiring any.** Override rates reach 49–96% [14].
5. **Neglecting nurses.** They are the largest user group and the lowest-scoring cohort for Level 6 [29][37].
6. **Routing work to queues without owners.** VA and Helseplattformen both suffered this [54][60].
7. **Under-translating or under-localizing** [60].
8. **Accepting "date-driven" go-lives under political or financial pressure.** VA, Helseplattformen, and VGR all did [53][61][62].
9. **Hybrid systems inside a care network** without a seam-removal plan [48][52].
10. **Under-provisioned infrastructure** at customer sites: Wi-Fi, end-user devices, printers, badge login [31][40].
11. **AI features without training, provenance, or monitoring.** ECRI 2026 #1 is AI chatbot misuse [21][39].
12. **Ignoring downtime,** which is ECRI 2026 #2 [21].
13. **Scope inflation in the first wave.** Combining municipal, social, and hospital scope, or a national big bang, has repeatedly failed [58][60][61].
14. **Open-ended consultant spending and opaque costs** [61].
15. **Treating go-live as the finish line.** Recovery from a poor implementation is slow: 75% of clinicians dissatisfied with their implementation are still dissatisfied two or more years later [28].

### 10.5 What to verify next

These items could not be verified in this session because the search quota ran out:
- Post-go-live performance and safety reporting for the **VA 2026 waves** (Michigan, Ohio/Kentucky, Indiana), and the outcome of the **24 Oct 2026** Anchorage and Cleveland go-lives.
- Current **HIMSS EMRAM 2022 criteria text and thresholds.** Requires HIMSS access.
- Full **Rigsrevisionen** (Denmark), **Queensland Audit Office**, and **ACT Audit Office** findings.
- Alberta Connect Care's final cost and post-implementation reviews.
- ~~Singapore NGEMR's vendor~~ (resolved in pass 2: Epic [87]). Still open: SingHealth's migration start date. Completion is due in 2028 [88].
- **Dubai Health's EHR vendor.** Epic (Salama), per 2017 contemporary press [97]. Still to do: a DHA/Dubai Health or Epic primary press release (reconciled 2026-10-16).
- **KFSH&RC's current platform.** Cerner Millennium is confirmed through 2020–2022 [95][96]. Confirm the 2024–2026 platform in the proposed beachhead-market report, because KFSH&RC is a regional reference site (reconciled 2026-10-16).
- Whether **Intermountain's Epic transition** finished by its end-2025 target.
- Independent evidence on **Narayana Athma** and **Apollo** digital maturity.
- India HIMSS Stage 6/7 hospitals.

---

## 11. Sources

Entries marked **‡** were not re-fetched in this session. Their URLs or DOIs were confirmed to resolve where noted, but content was taken from analyst knowledge. Wikipedia entries are used as secondary summaries of national programmes and cite primary reporting.

1. Melnick ER, Dyrbye LN, Sinsky CA, et al. The Association Between Perceived EHR Usability and Professional Burnout Among US Physicians. *Mayo Clin Proc.* 2020;95(3):476-487. https://mayoclinic.elsevierpure.com/en/publications/the-association-between-perceived-electronic-health-record-usabil/
2. Melnick ER, West CP, Nath B, et al. The association between perceived EHR usability and professional burnout among US nurses. *JAMIA.* 2021;28(8):1632-1641. https://academic.oup.com/jamia/article/28/8/1632/6237199
3. Melnick ER, et al. Perceived EHR Usability as a Predictor of Task Load and Burnout Among US Physicians: Mediation Analysis. *J Med Internet Res.* 2020;22(12):e23382. https://www.jmir.org/2020/12/e23382/
4. Arndt BG, Beasley JW, Watkinson MD, et al. Tethered to the EHR: Primary Care Physician Workload Assessment Using EHR Event Log Data and Time-Motion Observations. *Ann Fam Med.* 2017;15(5):419-426. https://www.annfammed.org/content/15/5/419
5. Arndt BG, et al. More Tethered to the EHR: EHR Workload Trends Among Academic Primary Care Physicians, 2019-2023. *Ann Fam Med.* 2024;22(1):12-18. https://www.annfammed.org/content/22/1/12
6. Sinsky C, Colligan L, Li L, et al. Allocation of Physician Time in Ambulatory Practice: A Time and Motion Study in 4 Specialties. *Ann Intern Med.* 2016;165(11):753-760. https://www.acpjournals.org/doi/10.7326/M16-0961
7. ‡ Downing NL, Bates DW, Longhurst CA. Physician Burnout in the Electronic Health Record Era: Are We Ignoring the Real Cause? *Ann Intern Med.* 2018;169(1):50-51. https://www.acpjournals.org/doi/10.7326/M18-0139
8. Holmgren AJ, Downing NL, Bates DW, et al. Assessment of Electronic Health Record Use Between US and Non-US Health Systems. *JAMA Intern Med.* 2021;181(2):251-259. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2774129
9. Holmgren AJ, Downing NL, Tang M, et al. Assessing the impact of the COVID-19 pandemic on clinician ambulatory EHR use. *JAMIA.* 2022;29(3):453-460. https://academic.oup.com/jamia/article/29/3/453/6458072
10. Rotenstein LS, Holmgren AJ, Downing NL, Bates DW. Differences in Total and After-hours EHR Time Across Ambulatory Specialties. *JAMA Intern Med.* 2021;181(6):863-865. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2777845
11. Rotenstein LS, Holmgren AJ, Horn DM, et al. System-Level Factors and Time Spent on EHRs by Primary Care Physicians. *JAMA Netw Open.* 2023;6(11):e2344713. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2812258
12. Rule A, Bedrick S, Chiang MF, Hribar MR. Length and Redundancy of Outpatient Progress Notes Across a Decade at an Academic Medical Center. *JAMA Netw Open.* 2021;4(7):e2115334. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2782054
13. Steinkamp J, Kantrowitz JJ, Airan-Javia S. Prevalence and Sources of Duplicate Information in the Electronic Medical Record. *JAMA Netw Open.* 2022;5(9):e2233348. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2796664
14. van der Sijs H, Aarts J, Vulto A, Berg M. Overriding of Drug Safety Alerts in Computerized Physician Order Entry. *JAMIA.* 2006;13(2):138-147. https://academic.oup.com/jamia/article-lookup/doi/10.1197/jamia.M1809
15. Nanji KC, Slight SP, Seger DL, et al. Overrides of medication-related clinical decision support alerts in outpatients. *JAMIA.* 2014;21(3):487-491. https://academic.oup.com/jamia/article-lookup/doi/10.1136/amiajnl-2013-001813
16. Howe JL, Adams KT, Hettinger AZ, Ratwani RM. Electronic Health Record Usability Issues and Potential Contribution to Patient Harm. *JAMA.* 2018;319(12):1276-1278. https://jamanetwork.com/journals/jama/fullarticle/2676098
17. Classen DC, Holmgren AJ, Co Z, et al. National Trends in the Safety Performance of EHR Systems From 2009 to 2018. *JAMA Netw Open.* 2020;3(5):e205547. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2766545
18. Olson KD, Meeker D, Troup M, et al. Use of Ambient AI Scribes to Reduce Administrative Burden and Professional Burnout. *JAMA Netw Open.* 2025;8(10):e2534976. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2839542
19. Moy AJ, Schwartz JM, Chen R, et al. Measurement of clinical documentation burden among physicians and nurses using EHRs: a scoping review. *JAMIA.* 2021;28(5):998-1008. https://academic.oup.com/jamia/article/28/5/998/6090156
20. 25×5 Symposium to Reduce Documentation Burden on US Clinicians by 75% by 2025 (Columbia DBMI / AMIA). https://www.dbmi.columbia.edu/25x5/
21. ECRI. Misuse of AI chatbots tops annual list of health technology hazards (2026 Top 10 Health Technology Hazards), 21 Jan 2026. https://home.ecri.org/blogs/ecri-news/misuse-of-ai-chatbots-tops-annual-list-of-health-technology-hazards
22. ECRI. 2026 Top 10 Patient Safety Concerns. https://home.ecri.org/blogs/ecri-news/ai-use-in-diagnostic-care-rural-care-access-and-surge-in-preventable-diseases-top-annual-report-of-patient-safety-concerns
23. Han YY, Carcillo JA, Venkataraman ST, et al. Unexpected Increased Mortality After Implementation of a Commercially Sold CPOE System. *Pediatrics.* 2005;116(6):1506-1512. https://doi.org/10.1542/peds.2005-1287
24. Ash JS, Berg M, Coiera E. Some Unintended Consequences of Information Technology in Health Care. *JAMIA.* 2004;11(2):104-112. https://academic.oup.com/jamia/article-lookup/doi/10.1197/jamia.M1471
25. Koppel R, Metlay JP, Cohen A, et al. Role of Computerized Physician Order Entry Systems in Facilitating Medication Errors. *JAMA.* 2005;293(10):1197-1203. https://doi.org/10.1001/jama.293.10.1197
26. Adelman JS, Applebaum JR, Schechter CB, et al. Effect of Restriction of the Number of Concurrently Open Records in an EHR on Wrong-Patient Order Errors: A Randomized Clinical Trial. *JAMA.* 2019;321(18):1780-1787. https://doi.org/10.1001/jama.2019.3698
27. ‡ Sparnon E, Marella WM. The Role of the Electronic Health Record in Patient Safety Events. *Pa Patient Saf Advis.* 2012;9(4):113-121. http://patientsafety.pa.gov/ADVISORIES/Pages/201212_113.aspx (site unreachable during this session)
28. KLAS Arch Collaborative. EHR Implementations 2025 (Jan 2025). https://klasresearch.com/archcollaborative/report/ehr-implementations-2025/628
29. KLAS Arch Collaborative. Clinician EHR Experience 2026 (Jun 2026). https://klasresearch.com/archcollaborative/report/clinician-ehr-experience-2026/723
30. KLAS Arch Collaborative. Physician Guidebook 2025 (Jul 2025). https://klasresearch.com/archcollaborative/report/klas-arch-collaborative-physician-guidebook-2025/653
31. KLAS Arch Collaborative. Key Drivers of EHR Improvement 2025 (Oct 2025). https://klasresearch.com/archcollaborative/report/key-drivers-of-ehr-improvement-2025/699
32. KLAS Arch Collaborative. Global EHR Satisfaction 2025 (May 2025). https://klasresearch.com/archcollaborative/report/global-ehr-satisfaction-2025/647
33. KLAS Arch Collaborative. Success Pathway: Superusers (Feb 2026). https://klasresearch.com/archcollaborative/report/klas-arch-collaborative-success-pathway-superusers/716
34. KLAS Arch Collaborative. Success Pathway: EHR Shared Ownership & Governance (Feb 2026). https://klasresearch.com/archcollaborative/report/klas-arch-collaborative-success-pathway-ehr-shared-ownership-and-governance/712
35. KLAS Arch Collaborative. Message Burden 2025 (Mar 2025). https://klasresearch.com/archcollaborative/report/message-burden-2025/637
36. KLAS Arch Collaborative. Ambient Speech Outcomes 2025 (Jun 2025). https://klasresearch.com/archcollaborative/report/ambient-speech-outcomes-2025/652
37. KLAS Arch Collaborative. Reducing Nursing Documentation Burden 2025 (Dec 2025). https://klasresearch.com/archcollaborative/report/reducing-nursing-documentation-burden-2025/706
38. KLAS Arch Collaborative. Epic Signal Data 2023 (Nov 2023). https://klasresearch.com/archcollaborative/report/epic-signal-data-2023/548
39. KLAS Arch Collaborative. AI Insights from the Arch Collaborative 2026 (Jul 2026). https://klasresearch.com/archcollaborative/report/ai-insights-from-the-arch-collaborative-2026/724
40. KLAS Arch Collaborative. Success Pathway: EHR Reliability & System Speed (Dec 2024). https://klasresearch.com/archcollaborative/report/klas-arch-collaborative-success-pathway-ehr-reliability-and-system-speed/622
41. KLAS Arch Collaborative. CMIO & CNIO Perspectives on the Clinician Experience 2026 (Apr 2026). https://klasresearch.com/archcollaborative/report/cmio-and-cnio-perspectives-on-the-clinician-experience-2026/719
42. KLAS Arch Collaborative. The ROI for Improving Your Clinicians' Experience 2025 (May 2025). https://klasresearch.com/archcollaborative/report/the-roi-for-improving-your-clinicians-experience-2025/646
43. Lowry SZ, Quinn MT, Ramaiah M, et al. NISTIR 7804: Technical Evaluation, Testing, and Validation of the Usability of Electronic Health Records (Feb 2012). https://nvlpubs.nist.gov/nistpubs/ir/2012/NIST.IR.7804.pdf
44. NIST. NISTIR 7804-1: Technical Evaluation, Testing, and Validation of the Usability of EHRs: Empirically Based Use Cases for Validating Safety-Enhanced Usability (2015). https://www.nist.gov/publications/technical-evaluation-testing-and-validation-usability-electronic-health-records
45. ‡ Schumacher RM, Lowry SZ. NISTIR 7742: Customized Common Industry Format Template for Electronic Health Record Usability Testing (2010). https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir7742.pdf (pass 2: URL resolves to the PDF; contents as referenced by [46])
46. ASTP/ONC. §170.315(g)(3) Safety-enhanced design: Certification Companion Guide / Test Method. https://www.healthit.gov/test-method/safety-enhanced-design
47. ASTP/ONC. SAFER Guides (2025 edition; page updated 27 Feb 2026). https://www.healthit.gov/topic/safety/safer-guides
48. US Department of Veterans Affairs. EHR Deployment Schedule (page dated 15 Sep 2026). https://digital.va.gov/ehr-modernization/ehr-deployment-schedule/
49. US Department of Veterans Affairs. EHR Modernization (updated 20 Feb 2026). https://digital.va.gov/ehr-modernization/
50. Nextgov/FCW. VA resumes EHR rollouts at four Michigan medical sites (13 Apr 2026). https://www.nextgov.com/modernization/2026/04/va-resumes-ehr-rollouts-four-michigan-medical-sites/412807/
51. Healthcare Dive. VA deploys Oracle EHR at four Michigan medical centers (15 Apr 2026). https://www.healthcaredive.com/news/veterans-affairs-va-medical-centers-michigan-oracle-ehr/817470/
52. ExecutiveGov. VA to Restart Oracle-Cerner EHR Rollout With 2026 Regional Go-Lives. https://www.executivegov.com/articles/va-ehr-launch-oracle-cerner-13-sites
53. US GAO. Electronic Health Records: VA Needs to Address Management Challenges with New System (GAO-23-106731, May 2023; recommendation status as of late 2025). https://www.gao.gov/products/gao-23-106731
54. VA Office of Inspector General. The New Electronic Health Record's Unknown Queue Caused Multiple Events of Patient Harm (Report 22-01137-204, 14 July 2022). Retrieved in pass 2; see [83] for the URL.
55. Federal News Network. VA in 2026 looks to get EHR rollout back on track (Dec 2025). https://federalnewsnetwork.com/veterans-affairs/2025/12/va-in-2026-looks-to-get-ehr-rollout-back-on-track-embark-on-health-care-reorganization/
56. Government Executive. Lawmakers question VA health record's costs and batched deployments (Dec 2025). https://www.govexec.com/technology/2025/12/lawmakers-question-va-health-records-costs-and-batched-deployments/410199/
57. Military Health System. MHS GENESIS (fact sheet dated 24 Mar 2026). https://www.health.mil/Military-Health-Topics/Technology/MHS-GENESIS
58. Wikipedia. NHS Connecting for Health (NPfIT history; cites NAO and PAC reports). https://en.wikipedia.org/wiki/NHS_Connecting_for_Health
59. ‡ UK House of Commons Committee of Public Accounts. The dismantled National Programme for IT in the NHS (HC 294, 2013). https://publications.parliament.uk/pa/cm201314/cmselect/cmpubacc/294/294.pdf
60. Wikipedia. Epic Systems (sections on Denmark, Finland, Norway, UK implementations and MGB costs; cites national press). https://en.wikipedia.org/wiki/Epic_Systems
61. Wikipedia (Norwegian). Helseplattformen (cites Riksrevisjonen Oct 2024 and Adresseavisen). https://no.wikipedia.org/wiki/Helseplattformen
62. Wikipedia (Swedish). Millennium (journalsystem) (cites DN 27 Aug 2026 "VGR säger upp Millennium för 657 miljoner"; SVT Feb 2025; Läkartidningen Nov 2025; Sydsvenskan Dec 2024). https://sv.wikipedia.org/wiki/Millennium_(journalsystem)
63. Wikipedia. Cambridge University Hospitals NHS Foundation Trust (eHospital/Epic section). https://en.wikipedia.org/wiki/Cambridge_University_Hospitals_NHS_Foundation_Trust
64. Wikipedia. Kaiser Permanente (KP HealthConnect section). https://en.wikipedia.org/wiki/Kaiser_Permanente
65. Chen C, Garrido T, Chock D, Okawa G, Liang L. The Kaiser Permanente Electronic Health Record: Transforming and Streamlining Modalities of Care. *Health Aff.* 2009;28(2):323-333. https://doi.org/10.1377/hlthaff.28.2.323
66. Alberta Health Services / Connect Care. Connect Care Frequently Asked Questions (4 May 2026). https://www.albertahealthservices.ca/assets/info/cis/if-cis-faq.pdf
67. Synapxe. Next Generation Electronic Medical Record (NGEMR). https://www.synapxe.sg/healthtech/national-programmes/next-generation-electronic-medical-record-ngemr
68. Wikipedia. King Faisal Specialist Hospital and Research Centre (EHR, HIMSS Stage 7, command center, AI). https://en.wikipedia.org/wiki/King_Faisal_Specialist_Hospital_and_Research_Centre
69. Wikipedia. Seoul National University Bundang Hospital (BESTCare, HIMSS EMRAM Stage 7 2010/2016/2019/2024). https://en.wikipedia.org/wiki/Seoul_National_University_Bundang_Hospital
70. e-Estonia. e-Health Record. https://e-estonia.com/solutions/healthcare/e-health-records/
71. Wikipedia. OpenMRS. https://en.wikipedia.org/wiki/OpenMRS
72. Wikipedia. VistA. https://en.wikipedia.org/wiki/VistA
73. Wikipedia. Sheba Medical Center. https://en.wikipedia.org/wiki/Sheba_Medical_Center
74. Heeks R. Health information systems: Failure, success and improvisation. *Int J Med Inform.* 2006;75(2):125-137. https://doi.org/10.1016/j.ijmedinf.2005.07.024
75. Sieja A, Markley K, Pell J, et al. Optimization Sprints: Improving Clinician Satisfaction and Teamwork by Rapidly Reducing EHR Burden. *Mayo Clin Proc.* 2019;94(5):793-802. https://doi.org/10.1016/j.mayocp.2018.08.036
76. Wikipedia. HIMSS (EMRAM description; ~6% of US hospitals at Stage 7 in 2018). https://en.wikipedia.org/wiki/HIMSS
77. Barnett ML, Mehrotra A, Jena AB. Adverse inpatient outcomes during the transition to a new electronic health record system: observational study. *BMJ.* 2016;354:i3835. https://www.bmj.com/content/354/bmj.i3835
78. W3C. Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation. https://www.w3.org/TR/WCAG22/
79. ECRI. Op-Ed: "Hospitals are very online, but what happens when they're plunged into 'digital darkness'?" (24 Apr 2026). https://home.ecri.org/blogs/ecri-news/op-ed-industry-voices-hospitals-are-very-online-but-what-happens-when-theyre-plunged-into-digital-darkness
80. ECRI. Siloed health records are harming patients. "One patient, one record" is the answer (2026). https://home.ecri.org/blogs/ecri-news/siloed-health-records-are-harming-patients-one-patient-one-record-is-the-answer
81. Sinsky CA, Rule A, Cohen G, et al. Metrics for assessing physician activity using electronic health record log data. *J Am Med Inform Assoc.* 2020;27(4):639-643. https://doi.org/10.1093/jamia/ocz223 *(Pass 2 corrected the journal. The first pass cited J Gen Intern Med 2020;35:3348-3354, which is wrong.)*
82. Han S, Shanafelt TD, Sinsky CA, et al. Estimating the Attributable Cost of Physician Burnout in the United States. *Ann Intern Med.* 2019;170(11):784-790. https://doi.org/10.7326/M18-1422

*Sources added in pass 2 (2026-10-16).* In pass 2, abstracts for [4]–[6], [8], [9], [11]–[15], [18], [19], [23], [25], [26], [65], [74], [75], [77], [81], and [82] were checked through the Europe PMC REST API (https://www.ebi.ac.uk/europepmc/webservices/rest/search) or the publisher page.

83. VA Office of Inspector General. The New Electronic Health Record's Unknown Queue Caused Multiple Events of Patient Harm, Report #22-01137-204 (14 Jul 2022). https://www.vaoig.gov/sites/default/files/reports/2022-07/VAOIG-22-01137-204.pdf
84. Washington Technology. VA deploys new EHR at 3 Indiana-based medical facilities (24 Aug 2026). https://www.washingtontechnology.com/contracts/2026/08/va-deploys-new-ehr-3-indiana-based-medical-facilities/415611/
85. Healthcare Dive. VA deploys Oracle EHR to 4 medical centers in Ohio, Kentucky (9 Jun 2026). https://www.healthcaredive.com/news/va-deploys-oracle-ehr-four-medical-centers-ohio-kentucky/822348/
86. Congressional Research Service. MHS Genesis: Background and Issues for Congress (R45987, 28 Oct 2019). https://www.congress.gov/crs-product/R45987 (read via https://www.everycrsreport.com/reports/R45987.html)
87. Synapxe – HealthX Innovation Sandbox. Introduction to NGEMR ("powered by the Epic EMR system"). https://innovation.healthx.sg/introduction-to-ngemr/
88. Synapxe. Next Generation Electronic Medical Record System to be rolled out to SAF Medical Facilities (24 Oct 2025). https://www.synapxe.sg/media-releases/collaboration/ngemr-rolled-out-saf-medical-facilities
89. Cerner press release via Zawya. King Faisal Specialist Hospital & Research Centre Achieves Highest Level of Health Care IT Adoption (12 Oct 2015). https://www.zawya.com/en/press-release/king-faisal-specialist-hospital-amp-research-centre-achieves-highest-level-of-health-care-it-adoption-ryke92ij
90. Hamad Medical Corporation. Integration of Oracle Cerner Electronic Health Record Across Hamad Medical Corporation and Qatar Biobank… (21 Jun 2023). https://hamad.qa/EN/news/2023/June/Pages/Integration-of-Oracle-Cerner-Electronic-Health-Record-Across-Hamad-Medical-Corporation.aspx
91. HIT Consultant. Intermountain to Replace Cerner with Epic Enterprise EHR by 2025 (11 Sep 2023). https://hitconsultant.net/2023/09/11/intermountain-to-replace-cerner-with-epic-enterprise-ehr-by-2025/
92. National Health Commission of the PRC, General Office. 关于印发电子病历系统应用水平分级评价管理办法（试行）及评价标准（试行）的通知, 国卫办医函〔2018〕1079号 (3 Dec 2018). Original at gov.cn (https://www.gov.cn/xinwen/2018-12/09/content_5347261.htm, returned 404 on 2026-10-16). Text read from the reprint at https://www.waizi.org.cn/doc/49207.html
93. NRK (O. M. Trøen). Riksrevisjonen legger fram resultatene fra undersøkelse om Helseplattformen (24 Oct 2024; "samlede kostnadene til forberedelser, utvikling og innføring ... om lag 6,7 milliarder kroner"; "opprinnelige ramma var satt til 4,1 milliarder kroner"). Fetched 2026-10-16 during reconciliation. https://www.nrk.no/trondelag/riksrevisjonen-legger-fram-resultatene-fra-undersokelse-om-helseplattformen-1.17092919
94. Apotti. Frequently asked questions ("The investment cost of the Apotti system in its current scope is 407 million euros"; covers licences, development incl. integrations, technical environment, training; undated). Fetched 2026-10-16. https://www.apotti.fi/en/apotti/frequently-asked-questions/
95. KFSH&RC press release via Zawya. King Faisal Specialist Hospital & Research Centre progresses transformation program by virtually upgrading its Integrated Clinical Information System (2020; Cerner Millennium upgrade). Fetched 2026-10-16. https://www.zawya.com/en/press-release/king-faisal-specialist-hospital-amp-research-centre-progresses-transformation-program-by-virtually-upgrading-cnct4bvf
96. Hospitals Magazine. Multiple Expansions, Go Lives, and Awards for Oracle Cerner Clients in Middle East, Africa (2022 recap, published c. Jan 2023; KFSH&RC transplant workflow and AI MoU with Oracle Cerner). Fetched 2026-10-16. https://hospitalsmagazine.com/multiple-expansions-go-lives-and-awards-for-oracle-cerner-clients-in-middle-east-africa/
97. Khaleej Times. Electronic medical record system now live in UAE (8 Apr 2017; DHA IT director Amani Al Jassmi; staff "trained in the UAE and in the US by the international company EPIC"). Fetched 2026-10-16. https://www.khaleejtimes.com/uae/electronic-medical-record-system-now-live-in-uae
98. Riksrevisjonen. Helseplattformen i Midt-Norge, Dokument 3:3 (2024–2025), published 24 Oct 2024 ("sterkt kritikkverdig"; costs higher than planned and future costs uncertain; no figures on the summary page). Fetched 2026-10-16. https://www.riksrevisjonen.no/rapporter-mappe/no-2024-2025/helseplattformen-i-midt-norge/
99. Companion reports used in the 2026-10-16 reconciliation: `01` §4/§9.2/§12, `03` §21.2, `05` §9.3, `06` §7.1, `07` §9.2, `08` §3.11/§4.6/§12.6, `11` §0; see `RECONCILIATION-LOG.md`.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| VA 2026 waves: 11 sites live (11 Apr, 6 Jun, 22 Aug); Anchorage and Cleveland on 24 Oct 2026; 26 sites in 2027; all 170 by Nov 2031 | Confirmed | [48] (page timestamp 15 Sep 2026) | 2027 waves fall in Jan, Mar, May, Jul, Sep, and Nov. |
| VA pre-pause history: "five more sites through 2022" after Spokane | Corrected | [48][84] | Four more sites went live in 2022 (Walla Walla, Columbus, Roseburg, White City). Five VA sites were live at the Apr 2023 pause, and Lovell (joint) followed in Mar 2024. |
| VA program estimate ~$37B; FY26 $3.4B with 30% contingent; FY27 request $4.2B | Confirmed | [50] | — |
| VA Oracle contract value "$10B, later >$16B" | Corrected (updated) | [84] | In Aug 2026 VA added $17B and three option years, bringing the total to just under $27B. |
| Post-go-live performance of the VA 2026 waves | Still unverified | [85] | VA calls Michigan feedback "exceptionally positive," a self-report. No OIG, GAO, or independent assessment was found. |
| VA OIG unknown queue: "11,000+ orders, 148 veterans harmed" | Corrected | [83] | More than 11,000 orders were undelivered from Oct 2020 to Jun 2021. VHA's review classified 149 adverse events, not "148 veterans." |
| GAO-23-106731: 10 recommendations all open; change management 7/8 partially consistent and 1 not consistent; 79% and 89% negative survey results | Confirmed | [53] | 6 are open and 4 are "open – partially addressed," with statuses dated Sep–Dec 2025. |
| VA fixed "hundreds of problems" and is hiring 400 staff | Confirmed (as VA claim) | [51] | Not independently verified. |
| ECRI 2026 hazards: #1 AI chatbots, #2 digital darkness, #8 legacy-device cybersecurity, #9 unsafe implementations | Confirmed | [21] | Published 21 Jan 2026. |
| Physician SUS 45.9 (bottom 9%, grade F); burnout OR 0.97 per point; n=870 | Confirmed | [1] | — |
| Nurse SUS 57.6 (bottom 24%); OR 0.98; n=8,638 | Confirmed | [2] | — |
| Arndt 2017: 5.9 h of an 11.4-h day; 86 min after hours; inbox 23.7%; clerical 44.2% | Confirmed | [4] | — |
| Arndt 2024: +7.8% total, +24.4% inbox, +58.9% orders, +55.5% advice requests | Confirmed, with wording fix | [5] | The FTE that fell 5.2% is ambulatory FTE (0.66 to 0.63). |
| Holmgren 2021: US vs non-US 90.2 vs 59.1 min; inbox 33.8 vs 12.8; auto-text 77.5% vs 60.8%; 371 systems | Confirmed | [8] | — |
| Holmgren 2022: 157%, "2.32 min of inbox time," "stayed there" | Corrected | [9] | The 2.32 min is *total* EHR time per additional patient message. The data run only to Dec 2020. 366 systems. |
| Steinkamp: 50.1% duplicated text; 33.0% → 54.2%; 45.9% from a different author | Confirmed | [13] | — |
| Rule: note length +60% (401 → 642 words); typed text 29.4% | Confirmed | [12] | — |
| Classen: "vendor ~10%, local configuration the rest" | Corrected (nuance) | [17] | Vendor explained 9.9%, or 14.6% with hospital characteristics. "Local configuration explains the rest" is the authors' interpretation. |
| Howe/Ratwani: 1.735M reports; 557 usability-related; 27/22/18/9% | Confirmed | [16] | — |
| Nanji: 52.6% overridden; 53% appropriate (12% renal to 92% allergy) | Confirmed | [15] | — |
| van der Sijs: overrides of 49–96% | Confirmed | [14] | — |
| Olson 2025 ambient: burnout 51.9% → 38.8% | Confirmed, with sample detail added | [18] | 263 clinicians analyzed, 186 in the burnout analysis, no control group. |
| Sinsky 2016: 27% face time, 49.2% EHR/desk (was ‡) | Confirmed | [6] | ‡ removed. |
| Han 2005: mortality 2.80% → 6.57% (was ‡) | Confirmed | [23] | ‡ removed. The "orders only after arrival" detail is still from the paper body. |
| Koppel 2005: 22 error types (was ‡) | Confirmed | [25] | — |
| Adelman 2019 RCT: 3,356 clinicians, null result (was ‡) | Confirmed | [26] | — |
| Barnett 2016 BMJ: "US hospitals switching EHRs" (was ‡) | Corrected | [77] | 17 hospitals implementing inpatient EHRs in 2011–12, compared with 399 controls. |
| Chen 2009 Kaiser: office visits −26.2% (was ‡) | Confirmed, scoped | [65] | One region (KP Northwest, more than 225,000 members), 2004–07. |
| Han 2019: physician burnout costs ~$4.6B a year (was ‡) | Confirmed | [82] | Range $2.6–6.3B. |
| Sinsky 2020 seven EHR-use metrics, cited as *J Gen Intern Med* | Corrected | [81] | The paper is in *JAMIA* 2020;27(4):639-643 (doi:10.1093/jamia/ocz223). |
| UCHealth optimization sprints (was ‡) | Confirmed | [75] | NPS rose from −15 to +12. Burnout fell from 39% to 34%. |
| ONC (g)(3) applies UCD to "problem/medication/allergy lists"; minimum 10 participants | Corrected (scope); minimum confirmed | [46] | The current scope is (a)(1)–(5), (a)(9), (a)(14), (b)(2), (b)(3), and (b)(11). |
| NISTIR 7804: 15–20 participants per user group; 100-fold vasoactive mode error | Confirmed | [43] | — |
| SAFER Guides 2025: eight guides, with AI added to Organizational Responsibilities | Confirmed | [47] | Page updated 27 Feb 2026. |
| WCAG 2.2: current edition 12 Dec 2024; new criteria | Confirmed | [78] | 4.1.1 Parsing was removed. |
| KLAS Implementations 2025: 38%; 73%; "75% of organizations" | Corrected | [28] | The 75% refers to *individual clinicians*. The 73% is of 22 newly live organizations. |
| KLAS "60-second logins unacceptable" cited to [31][40] | Corrected (attribution) | [40] | The quote appears only in [40]. |
| KLAS 2025 Pinnacle: KFSH&RC and Dubai Academic Health Corporation | Confirmed | [29] | KFSH&RC won for nurses only. DAHC won for both groups. The full lists were added. |
| KLAS global: NEES nurses 47.3, physicians 23.4; training at least 3 h, 11 h, 3–5 h/yr; Middle East best | Confirmed | [32] | — |
| KLAS Level 6 vs Levels 1–3 efficiency (70% vs 26%); external data 63–67% | Confirmed | [31] | — |
| KLAS AI 2026: NEES 72.2 vs 64.9; <25% trained; 46.7–89.7 | Confirmed | [39] | 12 Epic organizations. |
| KLAS nursing 2025: 79%, 80,147 nurses, Mercy −32 min, Wooster 96 fields and 15,000 h, Seattle Children's +71.4, CHOP $21M | Confirmed | [37] | — |
| KLAS Message Burden intervention list ("intake forms," "billing e-visits") | Corrected | [35] | Replaced with what the report actually describes: pools, templates, 14-day auto-close, charge notices, and AI. |
| KLAS ambient: 96% Epic; more than 80% chose not to add patients | Confirmed | [36] | Vendor mix added. |
| KLAS Signal: r² = 0.03; UCSF +21% proficiency | Confirmed | [38] | — |
| Helseplattformen: NOK 1.7B → 6.7B; Riksrevisjonen "sterkt kritikkverdig" (Oct 2024); EY NOK 557M vs 70M, unlawful | **Corrected (reconciliation 2026-10-16)** | [61], [93], [98] | NOK 1.7B was the system acquisition-cost estimate. The programme frame was NOK 4.1B, and NOK 6.7B is total programme cost (trusts, municipalities, GPs) to Oct 2024, per NRK. Riksrevisjonen's Dokument 3:3 (2024–2025) summary confirms the overrun but gives no figures |
| Helseplattformen: 16,000 letters, CEO dismissed, >90% of doctors saw a threat, "torchlight protests" | Confirmed, with wording fix | [60] | CEO dismissed Mar 2023. "Torchlight" replaced with "large protests at seven hospitals." |
| VGR: halted after 3 days (Nov 2024), paused Feb 2025, contract terminated Aug 2026 with SEK 657M to Oracle; Skåne decided against in Mar 2026 | Confirmed | [62] | — |
| Sundhedsplatformen DKK 2.8B, 62% dissatisfied, Google Translate; Apotti €625M and 619 doctors' complaint; MGB $1.2B/$1.6B | Confirmed; **Apotti cost now marked conflicting (reconciliation 2026-10-16)** | [60], [94] | MGB software spend was under $100M. €625M is Helsingin Sanomat (5 Nov 2022) via Wikipedia. Apotti's own FAQ gives €407M investment cost "in its current scope". The scopes differ and are unreconciled |
| Kaiser cost "$4B+ (some estimates >$6B)" | Corrected | [64] | The source says more than $6B. The $4B figure is unverified. |
| KFSH&RC uses Cerner; first outside North America at Stage 7 (2015) | Confirmed; **wording harmonized with `01` (reconciliation 2026-10-16)** | [68][89][95][96] | The Stage 7 is ambulatory (O-EMRAM), dated 12 Oct 2015. This is consistent with SNUBH being first on inpatient EMRAM. Cerner/Oracle Cerner is evidenced through 2020–2022. Not re-confirmed for 2024–2026; no Epic evidence |
| SNUBH first Stage 7 outside the US (2010); revalidated 2016, 2019, 2024 | Confirmed | [69] | — |
| Singapore NGEMR vendor = Epic (was ‡) | Confirmed | [87][88] | 37 institutions live as of Jul 2024. SingHealth's rollout is due to complete in 2028. |
| Dubai Health EHR vendor | **Supported (secondary), reconciliation 2026-10-16** | [97] | Khaleej Times (8 Apr 2017), reporting DHA's IT director, says Salama staff were trained "by the international company EPIC". No Cerner evidence was found for Salama. A primary DHA or Epic release is still not fetched |
| Hamad Medical Corporation uses Cerner (was ‡) | Confirmed | [90] | Its HIMSS Stage 7 status is still unverified. |
| DoD MHS GENESIS: $4.3B contract; DOT&E 2018 "not effective or suitable" (was ‡) | Confirmed | [86] | Ceiling raised to more than $5.5B in 2018. The 9.5M and 205,000 figures describe full deployment [57]. |
| NPfIT: £2.3B original; NAO £12.4B; dismantled 2011 | Confirmed | [58] | The ~£10B PAC 2013 figure is still ‡ (PAC PDF returned 403). |
| CUH: go-live Oct 2014; special measures Sep 2015; out Jan 2017; HIMSS Stage 6 Nov 2015 | Confirmed | [63] | The "5-hour ambulance diversion" is not in the source and was flagged ‡. |
| China EMR grading: levels 0–8; Level 4+ for tertiary and Level 3+ for secondary hospitals by 2020 | Confirmed | [92] | Also Level 3+ for tertiary by 2019. Level descriptions are still ‡. |
| HIMSS EMRAM 2022 refresh and stage criteria | Still unverified | — | HIMSS returns 403. Secondary material supports the Stage 6 descriptor. |
| Intermountain "reported move to Epic" (was ‡) | Confirmed (announcement) | [91] | Announced Sep 2023 for 33 hospitals, targeting end-2025. Completion is unverified. |
| Estonia: 100% coverage; 2.7M queries a month; #1 in Bertelsmann 2024 | Confirmed (as e-Estonia states) | [70] | The 2008 launch and X-Road details are still ‡. |
| Alberta Connect Care: more than 1,300 systems; Epic; all four provincial agencies | Confirmed | [66] | Implementation began in 2019. |
| 25×5 described as "AMIA initiative" | Corrected (attribution) | [20] | It began as a Columbia DBMI symposium in 2021, and AMIA took over leadership in Dec 2021. |
| Sheba: Newsweek #8 (2025); ADAMS Center with MDClone | Confirmed | [73] | The EHR vendor (Chameleon/Elad) is still ‡. |
| VistA: from 1977/78; more than 180 applications; public domain | Confirmed | [72] | — |
| OpenMRS: conceived 2004 at AMPATH; first deployments 2006 (Eldoret, Rwinkwavu) | Confirmed | [71] | — |
