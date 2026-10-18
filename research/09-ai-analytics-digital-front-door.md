# 09 — AI, Analytics/Data Platforms, and the Patient-Facing Digital Front Door

*State of the art as of 16 October 2026, and what a new top-tier Hospital Management System (HMS = HIS/EHR + hospital ERP/operations) should include.*

**Track:** AI · analytics and data platforms · digital front door · clinician mobile
**Audience:** HMS product, architecture, clinical-safety and go-to-market leads
**Type:** Pure research input (no code)

> **Method and confidence note.** I built this from primary sources read directly during the session: peer-reviewed papers, regulator pages, standards-body pages and vendor announcements. A small number of web searches supplemented them. The session's shared web-search quota ran out early: I completed 6 searches, not the 35+ planned. I therefore did the remaining verification through roughly 50 direct fetches of primary URLs, including the FDA's January 2026 CDS guidance PDF, which I parsed in full.
>
> Tags used in this document:
> - **(AK)** = analyst knowledge (training data through mid-2026). I believe these facts are accurate but could not re-check them in this session. Re-verify before external use.
> - **(est.)** = an estimate.
> - **(vendor)** = a vendor's own claim, not independently validated.
> - **[n]** = a numbered source in §10.
>
> No facts were invented. Where sources disagree, both figures are shown.
>
> **Pass 2 (16 October 2026).** A fact-check pass re-verified about 30 claims against primary sources: FDA PDFs and CSV files, the Federal Register API, eCFR, CMS, EU, state-legislature, PubMed and Europe PMC records, and vendor pages. It corrected or updated several time-sensitive items: Joint Commission AI certification (now launched), Colorado AI Act (repealed and replaced), HHS Section 504 dates (extended), Medicare telehealth (extended to end-2027), HTI-5 status and the EU AI Act Omnibus. New sources are [71]–[89]. See the verification log at the end.

---

## 0. Executive summary

1. **GenAI is now table stakes inside the EHR, and EHR vendors are absorbing it.** Epic announced Art (clinicians), Emmie (patients) and Penny (revenue cycle) at UGM in August 2025 [1][2][3]. It made native ambient "AI Charting" generally available in February 2026, when 85% of Epic customers were live with at least one GenAI feature [4]. By UGM 2026 (August 2026), Epic reported:
   - 84 new AI tools shipped in a year;
   - "Chart with Art" live in 60+ organizations and 70+ specialties;
   - 120+ configurable AI features plus custom agents through "Agent Factory";
   - an orchestration layer ("Ergo") with "a November ship date" (the source gives no year; read as November 2026), piloted at Ochsner [5][6].

   A new HMS that launches without native AI will be uncompetitive on day one.
2. **Ambient documentation is the fastest-adopted clinical AI ever, but the evidence shows benefits that are real and modest.**
   - In the UCLA three-arm randomized trial (RCT), Nabla cut time-in-note by 9.5%; Microsoft DAX did not reach significance [17].
   - A 2026 *JAMA* difference-in-differences cohort study (Rotenstein et al.; 8,581 clinicians, 1,809 adopters, five academic institutions) found 16.0 fewer documentation minutes per 8 scheduled patient hours, 13.4 fewer total EHR minutes and +0.49 weekly visits, with no significant change in after-hours EHR time; heavy users (≥50% of visits) saved about 27 minutes (as reported) [20][71].
   - Burnout falls consistently: from 51.9% to 38.8% in a six-system Abridge study [19].
   - Financial ROI is unclear [13].
   - Payers now worry that AI documentation raises coding intensity. PHTI's October 2026 work, as covered by Becker's and HIT Consultant, cites established-patient Level 4/5 visits up 7%/5%, about $1,004 per provider per month [16][82]. *Provenance caveat (pass 2):* the underlying dataset is not named in the coverage; similar figures reportedly appear in a KLAS-validated vendor (Suki) ROI brief, and a peer-reviewed single-system study found a smaller coding shift (Level 4 +3.8%) [83].
3. **The market is crowded and commoditizing.**
   - About 60 scribe vendors [14].
   - About $600M of ambient-scribe spend in 2025, up 2.4×. Estimated shares: Microsoft 33%, Abridge 30%, Ambience 13% (Menlo, est.) [12].
   - EHR-native options are compressing prices.

   Lesson: own the workflow, context and governance. Do not own the speech or LLM model.
4. **In-basket draft replies reduce cognitive burden but do not save time.**
   - Stanford: drafts used about 20% of the time, with less task load and work exhaustion, but no time change [22].
   - UC San Diego (UCSD): read time rose 21.8% and replies got 17.9% longer [23].
   - In simulation, physician assessors judged that unedited drafts risked severe harm in 7.1% (11/156) of cases and death in one (0.6%) [24].
5. **Summaries score close to physicians on global metrics but contain more omissions.**
   - Discharge narratives (UCSF): similar overall quality, but more errors per summary (2.91 vs 1.82) [26].
   - Patient-friendly rewrites (NYU): readability fell from grade 11 to grade 6, but 18% of reviews raised safety concerns [25].

   Design rule: every generated summary is a source-linked draft that a clinician must review.
6. **Agentic AI is the 2025–26 frontier, concentrated in revenue cycle and patient access.**
   - 200+ organizations use Epic Penny, with about 20% fewer coding-related denials (vendor; February 2026) [4][87]. Penny now autonomously codes radiology and ED visits [5].
   - Epic's real-time prior-authorization checks are live at 4 systems, with 19 payers testing (UnitedHealthcare, Aetna, Network Health and 16 more) [5].
   - Patient-facing assistants such as Emmie are spreading [8].
   - Payers are deploying AI too, including CMS's WISeR model from January 2026 [59]. This is an arms race.
7. **Predictive models: vendor AUROC does not equal local benefit.**
   - The Epic Sepsis Model scored AUROC 0.63 on external validation. It missed 67% of sepsis cases and alerted on 18% of hospitalizations [30].
   - Head-to-head on deterioration, eCART scored 0.895 against the Epic Deterioration Index's 0.808, with PPV of 17.3% vs 6.3% at matched sensitivity [34].
   - Outcome benefit has been shown only where model, workflow and measurement were co-designed, as with TREWS and COMPOSER (both observational/quasi-experimental) [32][33].
8. **US regulation has sharpened in one specific way.** The FDA's Clinical Decision Support guidance of 29 January 2026 states plainly that software which detects a life-threatening condition such as sepsis or stroke and raises an alert is a device function [41]. So is software that analyzes hourly SpO₂ and heart rate to flag deterioration. Any HMS that ships its own sepsis or deterioration alarms must plan an FDA pathway or partner with cleared products. *(Reconciled 2026-10-16 with `03`, `07` and `08`. v1 ships NEWS2/PEWS as transparent published-score calculators on nurse-entered vitals with escalation tasks. They are versioned as a regulated module and released first in non-US markets. Sepsis screening is non-interruptive and rule-based, and it shows its inputs. v1 has no automated continuous alarms from device streams. US deployments, and predictive deterioration/sepsis scores everywhere, use cleared partners (Phase 2, §9.2).)*
9. **FDA's AI-enabled device list:** 1,614 authorizations through 29 June 2026, 1,230 (76.2%) of them radiology, per a direct count of FDA's downloadable list in pass 2 [37][72]. FDA says it will tag foundation-model and LLM-based devices [37]. Imaging and pathology AI are categories to integrate or partner on, not build.
10. **Governance has moved from principles to auditable controls.** The key instruments:
    - Joint Commission–CHAI *Responsible Use of AI in Healthcare* (RUAIH) guidance (17 September 2025) [45].
    - CHAI governance playbooks with 8 domains (27 May 2026). These are the framework for Joint Commission's voluntary **RUAIH certification, launched 1 June 2026** for US hospitals and health systems (it certifies organizations' governance, not products) [46][75].
    - CHAI AI Intake Playbook and Common Intake Controls (1 October 2026; a *draft* set of 57 controls in 11 domains, being piloted) [47].
    - ONC HTI-1 decision-support transparency requirements (in force since 2024), which ASTP/ONC's HTI-5 *proposed* rule (December 2025) would cut back by removing the AI "model card" (source-attribute) requirements; no final rule had been published as of 16 October 2026 [43][73].
    - EU AI Act high-risk obligations, now dated 2 December 2027 (Annex III) and 2 August 2028 (Annex I, medical devices), as enacted by the Digital Omnibus on AI, Regulation (EU) 2026/1744, in force since July 2026 [48][76].

    **The platform must ship governance as product features:** model registry, model cards, monitoring, override capture, and AI safety-event reporting.
11. **Data platform: the winning pattern** is a transactional EHR with near-real-time change-data-capture (CDC) into a governed lakehouse, which then feeds:
    - FHIR and OMOP projections;
    - CQL-based quality measures;
    - a de-identified research and network tier.

    Network-scale data is becoming the moat. Epic Cosmos covers 310M patients across 2,358 hospitals [10]. Truveta covers 140M+ [63]. Cosmos-trained generative "medical event" models such as Curiosity (320M patients, 23B encounters; in-EHR release March 2027) [5] show where it is heading. *(Reconciled 2026-10-16: these are two model generations. **CoMET** (arXiv v1, Aug 2025, renamed "Curiosity" in the v3 revision of 7 Nov 2025) was pretrained on 118M patients and about 115B events (151B tokens) [90]. The **UGM 2026 "Cosmos Curiosity"** was trained on 320M patients and 23B encounters [5]. The coverage does not link it to the paper, so treat it as a later, larger generation. See `01` §2.2.)*
12. **Digital front door, US adoption (2024):** 65% of people accessed a portal; 57% did so via an app; proxy access stood at 51%; 59% had multiple portals [54]. Patients overwhelmingly want results immediately (95.7%), and only 7.5% report more worry as a result [55]. The benchmark is MyChart plus:
    - Hello World (texting without an account);
    - Emmie (AI);
    - MyChart Central (one login across Epic organizations) [3][8].
13. **Hospital-at-home is durable in the US.** The CMS Acute Hospital Care at Home waiver was extended five years, through 30 September 2030, in the Consolidated Appropriations Act, 2026 (signed 3 February 2026), which also extended Medicare telehealth flexibilities through 31 December 2027 [56][80]. In an RCT, home hospitalization cost 38% less, with fewer 30-day readmissions (7% vs 23%) [57]. Outcome-based payment (the CMS ACCESS model, a 10-year model that began 5 July 2026) rewards tech-enabled chronic care [58].
14. **In emerging markets the front door is WhatsApp/SMS plus national digital health IDs** (ABHA/ABDM in India, Sehhaty/NPHIES in Saudi Arabia, NHS App/NHS login in the UK) (AK). An HMS must plug into national rails rather than force a proprietary app.
15. **Build thesis:** an AI-native architecture made of:
    - a bitemporal append-only clinical journal with CDC to the lakehouse (reconciled 2026-10-16: this replaces "event-sourced clinical record", per `08` §3.5/§3.11; full event sourcing only for order/MAR aggregates, by ADR);
    - a FHIR-first external/partner API, over a domain-owned core (reconciled 2026-10-16; see `06` §7.1 and `08` §4.6);
    - a grounded-context (retrieval) service;
    - a model gateway;
    - an evaluation and monitoring plane;
    - a human-in-the-loop UX kit.

    Ship ambient documentation, summaries, in-basket drafts, coding assistance and patient messaging first, through pluggable partners. Treat governance and evaluation as first-class product.

---

## 1. Generative AI inside the EHR

### 1.1 The 2026 landscape: EHR-native vs best-of-breed

| Vendor | Flagship AI (2025–26) | Status and key numbers | Notes |
|---|---|---|---|
| **Epic** | **Art** (clinician copilot: pre-visit insights, AI Charting/"Chart with Art", in-basket drafts, end-of-shift and handoff notes); **Emmie** (patient AI in MyChart); **Penny** (RCM: coding, appeals); **Ergo** (cross-agent orchestration); **Agent Factory** (configure 120+ features, build custom agents); **Cosmos** models (CoMET, Curiosity) | <ul><li>Aug 2025: 160–200 AI projects in flight [2]</li><li>Feb 2026: AI Charting released broadly on 4 Feb 2026 (at least 7 orgs live on day one); 85% of customers live on GenAI [4][87]</li><li>Aug 2026: 84 tools shipped in 12 months; Chart with Art in 60+ orgs and 70+ specialties; Penny autonomously codes radiology and ED [5]</li><li>OLVG (Amsterdam, Dutch) pediatricians: −31% note-writing time per appointment; total chart time −27%, from almost 17 to just over 12 min per appointment ("early" results; design not stated) [7]</li><li>Ergo Visit pilot live at Ochsner since 3 Aug 2026 (four family/internal medicine clinicians at first) [6]</li></ul> | <ul><li>AI Charting built with Microsoft [1]</li><li>Reported leadership departures before UGM 2026, possibly tied to a build-vs-partner debate; Epic denies the link [5]</li><li>FTC reportedly probing Epic's non-competes and data blocking [5]</li></ul> |
| **Microsoft** | **Dragon Copilot** (announced Mar 2025; AK): ambient (multi-party, multilingual), dictation, nursing ambient into flowsheets, radiology report drafting (preview), cited information retrieval, task automation, partner agents | <ul><li>Physician product: US, CA, UK, IE, FR, DE, AT, BE, NL, CH</li><li>Nursing: US only, via Epic Rover/desktop</li><li>Intermountain: 2,500+ users, −27% time in notes per appointment (vendor) [11]</li></ul> | Embedded in Epic and also sold standalone. About 33% ambient share (est.) [12] |
| **Oracle Health** | Clinical AI Agent (ambient notes, chart Q&A, order proposals); new AI-first EHR on Oracle Cloud Infrastructure (AK) | Vendor pages were inaccessible (HTTP 403) during research | Strategy is AI-native, re-platformed EHR (AK) |
| **MEDITECH** | Expanse with Google Cloud search and summarization; ambient through partners (AK) | — | Mid-market / community-hospital benchmark |
| **Abridge** | Enterprise ambient; "context-aware clinical intelligence"; inpatient CDI/coding claim review (14 Sep 2026) [64] | <ul><li>VA enterprise contract (22 Sep 2026)</li><li>UT System enterprise-wide agreement (8 Oct 2026)</li><li>WashU/BJC: 4,000 clinicians (2 Sep 2026) [64]</li><li>About 30% share (est.) [12]</li><li>Best in KLAS ambient 2025 (AK)</li></ul> | Moving from scribe toward revenue-cycle intelligence |
| **Ambience, Suki, Nabla, DeepScribe, Commure** | Ambient + coding (Ambience); assistant/voice (Suki); lightweight ambient (Nabla); specialty/oncology (DeepScribe); ambient + RCM (Commure, which acquired Augmedix) (AK) | Ambience about 13% share (est.) [12]. Nabla won the UCLA RCT's primary endpoint [17] | Best-of-breed vendors are pivoting to specialties, inpatient, nursing and RCM as EHR-native ambient spreads |

**Strategic read.** The market is converging on platform plus marketplace:

- The EHR owns the context (the longitudinal chart), the workflow surfaces, identity and permissions, orchestration and governance.
- Model vendors compete on accuracy, specialty depth and language coverage.

Epic's move from "ambient partner" (2023–25) to "native AI Charting plus Agent Factory" (2026) is the clearest signal [4][5]. For a new HMS, the defensible assets are:

1. a clean, real-time, well-coded clinical data substrate;
2. a grounding/context service any model can call;
3. workflow surfaces designed for AI drafts;
4. built-in governance.

### 1.2 Ambient clinical documentation (physician and nursing)

**What it is.** The system captures the clinician–patient conversation on a phone or room device. It transcribes it with speaker attribution, then generates a structured note (HPI, ROS, exam, assessment and plan, patient instructions). Increasingly it also proposes orders, diagnoses or problems, codes and follow-ups. 2026 systems add:

- pre-visit context, for example Epic Ergo surfacing source-linked chart insights [6];
- in-visit retrieval that "anticipates what the clinician may need to look up" [6];
- post-visit draft orders queued for sign-off before the visit ends [6].

**Evidence on time.** Savings are modest, and they depend on usage and specialty.

- **UCLA pragmatic three-arm RCT** (238 physicians, 14 specialties, about 72,000 encounters, Nov 2024–Jan 2025) [17]:
  - Nabla cut time-in-note by **9.5%** vs control (95% CI −17.2% to −1.8%), or about 41 s per note (4:30 → 3:49).
  - DAX's −1.7% was not significant.
  - Usage was only 30–34% of visits, and about 15% of physicians in the AI arms never used the tool.
  - Caveat: Epic Signal time-in-note does not count time spent editing drafts outside the note.
- **2026 *JAMA* multisite study** (Rotenstein et al., *JAMA* 2026;335(16):1408–1417; five US academic institutions incl. MGB, Emory, UCSF, Yale New Haven, UC Davis; AI scribes introduced June 2023–August 2025) [71], with secondary coverage [20]:
  - longitudinal cohort of **8,581 ambulatory clinicians, 1,809 of them adopters**; difference-in-differences design (not randomized; adoption was opt-in at 4 of 5 sites);
  - **16.0 min less documentation time** (95% CI 13.7–18.3) and **13.4 min less total EHR time** per 8 scheduled patient hours; **+0.49 weekly visits**;
  - **EHR time outside work hours did not change significantly**;
  - gains were largest for primary care, advanced practice clinicians, female clinicians and users with ≥50% of visits on the scribe (about **27.3 min** documentation saved, per secondary coverage [20]).
- **Kaiser Permanente, Northern California (TPMG), one year** [21]: "over 2.5 million uses" (confirmed from the article title); more than 7,000 physicians and about 15,800 clinician hours saved (author estimate) remain AK.
- **PHTI synthesis (March 2025)** [13][14]: scribes clearly reduce cognitive load but "don't uniformly reduce pajama time." An Atrium Health study of 112 physicians found no overall efficiency gain. Uptake is highest in primary care and weakest in procedural or "silent" specialties.
- **Vendor and customer claims:** Intermountain −27% time in notes [11]; OLVG −31% note time [7]. These come from pre/post designs and are labeled (vendor).

**Evidence on burnout and well-being.** This is the most consistent benefit.

- **Six health systems, Abridge, 263 ambulatory clinicians, 30-day pre/post** [19]:
  - burnout fell from **51.9% to 38.8%** (adjusted OR 0.26);
  - note-related cognitive load fell from 7.10 to 4.46 on a 10-point scale;
  - after-hours documentation fell from 4.95 to 4.05 h/week;
  - limitations: no control group and self-report.
- **UCLA RCT secondary outcomes** [17]: Mini-Z improved by about 2.7–2.8 points in both arms; task load and work exhaustion improved (not hypothesis-tested).
- **PHTI-reported pilots** [14]: MGB −40% burnout (6-week pilot); MultiCare −63%.
- **Afshar et al., *NEJM AI* 2025;2(12)** (UW Health; same issue as the UCLA trial) [18]: 24-week stepped-wedge, individually randomized pragmatic trial; 66 practitioners; 71,487 notes, 38% ambient-generated. Work exhaustion/interpersonal disengagement fell significantly (−0.44 on a 5-point scale); professional fulfillment rose non-significantly; time on notes fell 0.36 h/day; the drop in work outside work was not robust to outlier removal; diagnostic billing codes increased (abstract verified via PubMed in pass 2).

**Evidence on quality and safety.**

- **UCLA RCT** [17]:
  - physicians reported clinically significant inaccuracies "occasionally" (mean about 2.7–2.8 on a 5-point frequency scale);
  - error types: omissions, unnecessary content, pronoun errors, speaker-attribution errors, occasional hallucinations;
  - one grade-1 adverse event (counseling omitted from the plan); no serious events.
- **Sentence-level safety framework** (Asgari et al., npj Digital Medicine 2025; 12,999 clinician-annotated sentences across 18 configurations) [29]: hallucination 1.47% and omission 3.45% of sentences (verified from the abstract). A meaningful share of hallucinations was judged "major" (AK). Note that the authors were employees of Tortus AI, an ambient-scribe vendor.

**Financial and market effects.**

- **ROI:** PHTI's task force saw no significant financial improvement [13].
- **Coding intensity:** better documentation can raise reimbursement, "potentially offsetting expenses — but also leading to unintended downstream consequences" [13]. By October 2026 this had become a policy issue:
  - coverage of PHTI's October 2026 work reports established-patient Level 5/4 visits up 5%/7% after scribe deployment, adding about **$1,004/provider/month** [16][82]. Becker's (via search summary) attributes this to a KLAS analysis; HIT Consultant attributes it to PHTI-cited "recent clinical implementations" without naming the dataset. Treat the exact figures as provenance-uncertain: a KLAS-validated vendor (Suki) ROI brief reportedly gives a $1,004 *net* monthly gain at one site (per search results; brief not fetched), and the peer-reviewed McLeod Health study found Level 4 established-patient visits +3.8% (P=.05), with a projected $2,629/provider/month revenue gain driven mainly by +8.5% visit volume [83];
  - health plans report coding-intensity jumps and are deploying their own outlier algorithms [16];
  - PHTI argues administrative AI "entrenches inefficient workflows and drives inflationary billing" under fee-for-service [15].

**Cost per clinician (est.).**

| Option | Price / effect (est.) |
|---|---|
| Enterprise ambient scribes, 2024–25 | Typically about **$150–$600 per clinician per month**, depending on volume, specialty and bundled features (AK, est.) |
| Prosumer tools | About $99–$150/month (AK, est.) |
| EHR-native bundling (Epic AI Charting, Dragon Copilot in suites) | Pushing enterprise prices down (est.) |

The marginal LLM and speech-to-text inference cost per encounter is cents to low dollars (est.). For our build, the cost floor is inference plus support. Margin must come from workflow, coding and governance value, not from the transcript.

**Adoption.**

- Menlo estimates **$600M** of ambient-scribe spend in 2025 (up 2.4×), within about $1.4B of total health-system GenAI spend [12].
- Epic reported that 85% of its customers were live on GenAI (any feature) by February 2026 [4].
- Enterprise-wide roll-outs are now common: VA, UT System, WashU/BJC [64].
- PHTI counted about 60 scribe products in 2025 [14].
- Overall clinician use of some form of AI rose sharply in 2024–25 (AK).

**Nursing ambient.** This is earlier-stage and structurally harder.

- Dragon Copilot's nursing ambient (US only) turns spoken observations into flowsheet rows for review [11].
- Epic advertises "Nurses Write Notes 85% Faster with Epic AI" (vendor) [9].
- Abridge lists a nursing product on its site; no dated press release for it was found [64].

Nursing documentation is mostly structured (vitals, assessments, LDAs, I&O, care plans), so the hard problem is speech-to-structured-flowsheet mapping with validation, not prose generation. Peer-reviewed outcome evidence for nursing ambient remains thin; no large RCTs are known to me (AK). The opportunity is large because documentation consumes a substantial share of nursing shift time (est.).

**Implications.**

- Ambient is mandatory at launch, but should be **partner-pluggable**: at least two certified partners plus an optional native engine.
- The differentiators to build are:
  - structured outputs (problems, orders, codes, flowsheet rows) with **source-span provenance**;
  - specialty templates;
  - multilingual capture (English, Spanish, Arabic, Hindi and regional languages);
  - an edit-capture telemetry loop;
  - a coding-integrity guardrail, i.e. automated documentation–code concordance checks to defend against upcoding allegations.

### 1.3 In-basket draft replies

| Study | Design | Key results |
|---|---|---|
| **Stanford** (Garcia et al., *JAMA Netw Open* 2024) [22] | GPT-4 drafts for portal messages; 162 clinicians (primary care, GI/hepatology); 5 weeks; prospective single-group | <ul><li>Mean draft utilization **20%**</li><li>Task load fell (61.3 → 47.3)</li><li>Work exhaustion fell (1.95 → 1.62)</li><li>**No significant change** in read, reply or write time</li></ul> |
| **UCSD** (Tai-Seale et al., *JAMA Netw Open* 2024) [23] | Randomized waiting-list QI design (June–Aug 2023); 52 PCPs (25 immediate, 27 delayed) plus 70 contemporary controls | <ul><li>Read time **+21.8%**</li><li>Reply time −5.9% (not significant)</li><li>Replies **17.9% longer**</li><li>Physicians liked the empathy but found drafts wordy and too quick to recommend a visit</li></ul> |
| **Simulation** (Chen et al., *Lancet Digit Health* 2024;6(6):e379–e381) [24] | Physicians edited GPT-4 drafts to simulated oncology patient messages | Assessors judged unedited drafts to pose a risk of severe harm in 11/156 (7.1%) responses and death in 1 (0.6%), mostly from misjudged acuity; LLM-assisted responses converged on the draft's content, suggesting anchoring and automation bias (verified via PMC full text) |

**Takeaways.** In-basket AI is a burden reducer, not a time saver. Drafts must be:

- grounded in the chart: recent results, medications and the care plan;
- short by default;
- governed by routing rules: some message classes get no draft, e.g. new chest pain, suicidality or abnormal critical results, which are escalated instead;
- clearly disclosed where law requires. California AB 3030, effective 2025, requires a disclaimer on GenAI-generated patient clinical communications unless a licensed clinician reviews them (AK).

### 1.4 Chart summarization, handoffs, discharge summaries, patient-friendly translation

- **Clinical text summarization** [27]: in a 10-physician reader study across four task types (radiology reports, patient questions, progress notes, doctor–patient dialogue), the best-adapted LLM summaries were judged equivalent (45%) or superior (36%) to medical-expert summaries in most cases (verified from the abstract). Epic's Ergo Visit links each summary point to its source note [6]. **Source-linking should be mandatory in our design.**
- **Discharge summaries** (UCSF; Williams et al., *JAMA Intern Med* 2025; 100 encounters; 22 blinded attendings) [26]:
  - overall quality similar (3.67 vs 3.77);
  - LLM narratives more concise and coherent but **less comprehensive**;
  - **more errors per summary (2.91 vs 1.82)**, mostly omissions;
  - overall harm low but higher for LLM narratives (0.84 vs 0.36).
- **Patient-friendly discharge translation** (NYU; Zaretsky et al., *JAMA Netw Open* 2024) [25]:
  - Flesch-Kincaid grade fell from 11.0 to 6.2;
  - understandability rose from 13% to 81%;
  - but only 54% of outputs were fully accurate and 56% complete;
  - **18% of reviews raised safety concerns**, mostly omissions; hallucinations were 8.7% of inaccuracies;
  - the authors require physician review before patient use.
- **Handoffs and end-of-shift notes:** Epic Art drafts end-of-shift notes and handoffs [9]. Evidence is mostly vendor and pre/post.
- **Patient-facing result explanation:** Memorial Hermann uses an Epic AI tool to help patients understand test results (Sep 2026) [8]. This directly addresses the anxiety created by Cures Act immediate release (§7.3).

**Design rules.**

1. Summaries are drafts with per-sentence citations to source documents.
2. Omissions are the dominant failure mode. Use checklists ("required elements present?") and structured-field cross-checks against meds, allergies, pending results and follow-ups.
3. Patient-facing text needs a reading-level target, translation, and clinician sign-off unless policy explicitly allows auto-release for low-risk content.

### 1.5 Coding/CDI, prior authorization, and agentic revenue cycle

- **Coding.** General-purpose LLMs are poor coders when unaided. In one benchmark (Soroush et al., *NEJM AI*, April 2024; citation confirmed via Crossref), GPT-4 exact-match rates were about 46% for ICD-9-CM, about 34% for ICD-10-CM and about 50% for CPT (figures AK) [28]. Production autonomous coding works through:
  - retrieval of code sets plus payer and NCCI rules;
  - confidence thresholds with fall-back to human coders;
  - narrow scope first: radiology, ED, pathology and professional E/M are highly templated.

  Market evidence:
  - Penny is used by 200+ organizations, with about 20% fewer coding-related denials (vendor; February 2026) [4][87];
  - Penny autonomously codes radiology and ED [5];
  - Abridge reviews inpatient claims for CDI before submission [64];
  - Menlo sizes coding and billing automation at about **$450M** (2025) [12].
- **Prior authorization (PA).**
  - **CMS-0057-F:** impacted payers have to meet certain provisions from 1 January 2026, notably decision timeframes. API requirements, including a FHIR Prior Authorization API, apply "primarily January 1, 2027" [61].
  - **Drugs next (proposed):** a CMS/ONC proposed rule of 14 April 2026 would extend the electronic prior-authorization and API requirements to **drugs** for MA, Medicaid/CHIP and FFE QHP payers, require reporting of API endpoints and usage metrics, and adopt HL7 FHIR as a HIPAA standard for prior-authorization and eligibility transactions (comments closed 15 June 2026; not final as of this pass) [88].
  - **HTI-4 (2025):** adds certification criteria for electronic prior authorization on the provider side. It was finalized inside the FY 2026 IPPS final rule (90 FR 36536, 4 August 2025), which "finalizes certain updates to the ONC Health IT Certification Program" [44][74] (criterion detail AK).
  - **Epic:** real-time PA checks are live at 4 systems, with UnitedHealthcare, Aetna, Network Health and 16 other payers testing [5].
  - **Market:** PA-automation spend is about $100M+, growing about 10× (est.) [12].
  - **Payer side:** CMS's **WISeR** model (1 Jan 2026 – 31 Dec 2031; NJ, OH, OK, TX, AZ, WA) uses AI/ML vendors plus clinician review for PA on selected Original Medicare services [59].
  - **Implication:** the HMS must speak Da Vinci CRD/DTR/PAS (FHIR) natively and pre-assemble documentation packets with AI.
- **Other agentic RCM:**
  - eligibility and benefits calls, claim-status calls and payer phone trees (voice agents);
  - denial triage and appeal drafting (Penny drafts appeals [1]);
  - charge capture from documentation;
  - patient-estimate generation.

  These are high-volume, rules-bound and measurable (denial rate, days in A/R, cost-to-collect), which makes them ideal for agents with human checkpoints.

### 1.6 Order and queue suggestions, chart Q&A, agentic scheduling, voice

- **Order suggestions:** Ergo drafts orders during the visit for review before the visit ends [6]. Dragon Copilot captures orders from conversation [11]. Risk: automation complacency on order sign-off. UX must show *why* each order is proposed (the transcript span) and must never auto-sign.
- **Chart search and Q&A:** "chat with the chart" with citations. Examples:
  - Dragon Copilot retrieves information with citations [11];
  - Epic Art surfaces "insights" [6];
  - Stanford deployed its own chart-chat tool ("ChatEHR") enterprise-wide in 2025 (AK).

  Key requirements:
  - permission-aware retrieval that honors break-the-glass, sensitive-note segmentation and 42 CFR Part 2;
  - citations to the source;
  - refusal when evidence is absent.
- **Agentic scheduling and access:**
  - texting and calling outreach (Epic Hello World helps patients "keep millions of appointments") [8];
  - AI voice agents for scheduling, refills and FAQs (many vendors; AK);
  - waitlist auto-fill (MyChart Fast Pass, AK).

  Menlo estimates patient engagement and front-door AI at about $100M+, growing about 20× (est.) [12].
- **Operations agents:** bed placement, discharge-barrier tracking, OR block release, staffing suggestions. Evidence is mostly vendor case studies (AK).
- **Voice assistants:** dictation is converging with ambient (Dragon Copilot unifies Dragon Medical One and DAX) [11]. In-room voice for nurses ("document vitals", "page pharmacy") is emerging (AK).
- **Customer-built agents:** Epic Agent Factory's "build-a-thon" had health-system staff building their own agents (Sep 2026) [8]. Brown University Health reports 24+ agents built on Dragon Copilot (vendor) [11]. **Low-code agent building inside the governed platform is now a competitive feature.**

### 1.7 Risks of GenAI in the EHR, and platform mitigations

| Risk | How it shows up | Platform mitigation (what we build) |
|---|---|---|
| **Hallucination** | Fabricated exam findings, medications or history; invented citations | Grounded generation only (retrieval from chart plus transcript); per-claim source spans; "unsupported statement" detector; hard block on fabricated vitals, doses or allergies; red-team test suites |
| **Omission** (most common [17][25][26]) | Missing counseling, pending results or allergies in summaries | Required-element checklists per note type; structured-data cross-check (meds, allergies, pending labs); "what changed" diff vs the prior note |
| **Speaker or attribution errors** | Patient statement recorded as clinician finding; pronoun/sex errors [17] | Diarization confidence display; patient-context checks (sex, age); highlight low-confidence spans |
| **Automation complacency** | Signing drafts unread; accepting proposed orders | Friction proportional to risk (e.g. orders need explicit per-item acceptance); random "attention checks" in audits; time-to-sign analytics; FDA notes automation bias rises in time-critical use [41] |
| **Bias and inequity** | Worse transcription for accents or non-English speakers; biased language in notes; biased triage | Stratified evaluation by language, accent, age, sex and race/ethnicity where lawful; stigmatizing-language detector; Section 1557 §92.210 duty to identify and mitigate discrimination risk in patient-care decision-support tools (in force; compliance from 1 May 2025) [53][81] |
| **Coding inflation / fraud exposure** | Higher E/M levels without supporting work [16] | Documentation–code concordance checks; E/M level audit sampling; payer-facing audit trail |
| **Privacy and consent** | Recording without consent; sensitive data (Part 2, adolescents, reproductive health) leaking into drafts | Consent capture per encounter, plus state two-party-consent logic; local or region-pinned processing; zero data retention with model vendors; sensitive-segment filtering |
| **Liability ambiguity** | Who is responsible for AI-drafted content | Clinician remains the signer; immutable audit of AI vs human edits; disclosure banners where law requires (California AB 3030, AK; Texas TRAIGA, in effect from 1 January 2026, requires providers to disclose AI use in health care services or treatment no later than the date of service, except in emergencies [78]) |
| **Model drift and silent vendor updates** | Behavior changes after a model swap | Model/version pinning in the registry; regression evaluation before promotion; canary roll-outs; change logs to customers |
| **Security** | Prompt injection via patient messages or documents; data exfiltration by agents | Treat all patient-supplied text as untrusted; tool-permission scoping; output filtering; agent action allow-lists; human approval for writes |

### 1.8 How to evaluate GenAI features

1. **Pre-deployment, offline:**
   - curated local "golden" encounter sets per specialty and language;
   - rubric scoring (e.g. PDQI-9 for notes);
   - error taxonomy (hallucination, omission, attribution, clinical significance);
   - LLM-as-judge only when calibrated against clinicians;
   - safety red-teaming;
   - CHAI's ambient-AI implementation playbook and testing framework (v1.0) is a useful template [47].
2. **Silent or shadow mode:** generate but don't show; compare with clinician-authored output.
3. **Pilot, online metrics:**
   - usage rate and abandonment;
   - edit distance and percent of draft retained;
   - time-in-note and after-hours EHR time (Signal-like telemetry);
   - patient-safety event reports;
   - patient experience;
   - coding distribution shift.
4. **Rigorous comparison:** stepped-wedge or randomized roll-out where feasible. The UCLA RCT shows this is practical in eight weeks [17].
5. **Equity slices:** language, interpreter use, accent, age, visit type.
6. **Continuous monitoring:** drift alerts on edit distance and error flags; re-run the golden set on every model or prompt change.

---

## 2. Predictive analytics and machine learning

### 2.1 Sepsis: the cautionary tale and the success stories

- **Epic Sepsis Model (ESM), external validation** (Michigan; 38,455 hospitalizations; Wong et al., *JAMA Intern Med* 2021) [30]:
  - hospitalization-level **AUROC 0.63**, vs developer-reported 0.76–0.83;
  - at score ≥6: sensitivity 33%, PPV 12%;
  - **67% of sepsis cases missed**; alerts fired in **18% of all hospitalizations**;
  - calibration poor.
- **Later work** (Kamran et al., *NEJM AI*, February 2024; citation confirmed via Crossref) [31]: performance fell to roughly chance when restricted to predictions made *before* clinicians had already recognized sepsis, e.g. before cultures or antibiotics were ordered. The model was largely "learning the clinician" (figures AK).
- **TREWS** (Johns Hopkins / Bayesian Health; Adams et al., *Nat Med* 2022) [32]: prospective cohort, five hospitals, 590,736 patients monitored; analysis of 6,877 septic patients flagged before antibiotics. When providers confirmed an alert within 3 hours, in-hospital mortality was **3.3 points lower in absolute terms (18.7% relative)** (adjusted, observational, not randomized; verified from the abstract). The design emphasized clinician confirmation and workflow.
- **COMPOSER** (UC San Diego Health; Boussina et al., *npj Digit Med* 2024) [33]: deep-learning sepsis model in two EDs (6,217 septic patients) driving a nurse-facing Best Practice Advisory, with conformal "I don't know" outputs to reduce false alarms (AK). Before/after quasi-experimental analysis found a **1.9-point absolute (17% relative) reduction in in-hospital sepsis mortality** and a 5.0-point (10% relative) increase in bundle compliance (verified from the abstract).
- **Regulatory context:**
  - the FDA's January 2026 CDS guidance lists "software ... to detect a life-threatening condition, such as stroke or sepsis, and generate an alarm or an alert" as a **device** [41];
  - an AI sepsis diagnostic (Prenosis Sepsis ImmunoScore) received FDA De Novo authorization (DEN230036, granted 2 April 2024; product code SAK) [86].

**Lesson:** sepsis value comes from the model, a threshold tuned to staffing capacity, a nurse- or pharmacist-in-the-loop confirmation workflow, bundle order sets, and outcome measurement. The model alone delivers none of it.

### 2.2 Clinical deterioration

- **Head-to-head comparison** (Yale New Haven Health, 7 hospitals, 362,926 ward encounters, March 2019–November 2023; 4.6% had a deterioration event; Edelson et al., *JAMA Netw Open* 2024) [34]:

  | Score | AUROC for ICU transfer/death ≤24 h | PPV at sensitivity matched to NEWS ≥5 (about 51%; exact sensitivity AK) |
  |---|---|---|
  | **eCART** | **0.895** | **17.3%** |
  | NEWS2 | 0.831 | 8.7% |
  | NEWS | 0.829 | 9.5% |
  | Rothman Index | 0.828 | 6.9% |
  | **Epic Deterioration Index** | 0.808 | 6.3% |
  | MEWS | 0.757 | 8.2% (lower sensitivity) |

  The proprietary EDI did no better than free, simple scores (NEWS/NEWS2), while a validated ML score (eCART) nearly doubled PPV.
- **Kaiser Permanente Advance Alert Monitor:** a remote-nurse-mediated deterioration program, deployed in staggered fashion across 19 hospitals (2016–2019), was associated with lower 30-day mortality after an alert (adjusted relative risk 0.84, 95% CI 0.78–0.90; observational comparison) (Escobar et al., *NEJM* 2020;383:1951–1960; verified from the PubMed abstract [89]). This is another example of model plus centralized response team.
- **Regulatory:** FDA's example 24 says software analyzing hourly SpO₂/HR from the EHR "to identify signs of patient deterioration and alert an HCP" is a device function [41]. Some deterioration scores (e.g. eCART, Rothman Index) hold FDA clearances (AK).

### 2.3 Readmission, no-show, length of stay and discharge, capacity

| Use case | State of the art 2026 | Evidence and lessons |
|---|---|---|
| **30-day readmission** | Logistic/GBM models on EHR plus social data; LACE/HOSPITAL scores as baselines; EHR-vendor models | Typical AUROC about 0.65–0.75 (AK, est.). Value depends entirely on the intervention (transitions nurse, pharmacy reconciliation, follow-up within 7 days). Many deployments show no readmission change without a funded intervention (AK) |
| **No-show prediction** | GBM on prior no-shows, lead time, distance, weather, payer | AUROC about 0.75–0.85 (AK, est.). **Equity trap:** overbooking based on no-show risk can systematically give Black patients longer waits [68]. Use predictions for *outreach* (reminders, transport, telehealth conversion) before *overbooking*, and audit by group |
| **LOS / expected discharge date** | Daily-updated predictions of discharge within 24–48 h; barrier extraction from notes | Supports capacity huddles; benefit comes from discharge-before-noon and barrier workflows (AK) |
| **Capacity forecasting** | ED arrivals, admissions, census by unit, OR and infusion scheduling optimization | Mature operations-research and ML methods. Command centers (e.g. Johns Hopkins) report throughput gains (vendor/AK). An HMS needs a real-time event stream and a forecasting service |
| **Cost/utilization risk** | Population-health risk stratification | Classic bias case: using cost as a proxy for need under-identified Black patients' needs [69]. Choose labels carefully |

### 2.4 Other inpatient prediction: AKI, falls, pressure injury, others

- **AKI:** DeepMind and the VA predicted 55.8% of inpatient AKI episodes up to 48 h early, at about 2 false alerts per true alert (Tomašev et al., *Nature* 2019) [35]. Real-world benefit still depends on nephrotoxin stewardship and fluid workflows (AK).
- **Falls and pressure injury:** ML risk scores outperform Morse/Braden modestly in retrospective studies. Computer-vision fall detection in "smart rooms" is spreading. Outcome evidence is mixed (AK).
- **Other common ones:** clinical deterioration in pediatrics (PEWS plus ML), C. difficile, VTE, opioid overdose risk, suicide risk (VA REACH VET), malnutrition, delirium (AK).

### 2.5 Imaging and pathology AI

- **FDA AI-enabled device list:** FDA states the list "is not a comprehensive resource" and that it plans to "identify and tag medical devices that incorporate foundation models" [37]. Third-party counts of the public list:

  | As of | Total authorizations | Radiology | Other panels | Source |
  |---|---|---|---|---|
  | July 2025 | 1,247 | 956 (77%) | Cardiovascular 116 (9%) | [38] |
  | End of 2025 | 1,430–1,451 (sources differ); the June 2026 FDA file contains 1,433 entries dated on or before 31 Dec 2025 | about 76% | Cardiovascular 136 (9.5%) per [39] | [39][40][72] |
  | **29 June 2026** | **1,614** (pass-2 count of FDA's CSV) | **1,230 (76.2%)** | Cardiovascular 154 (9.5%); Neurology 73 (4.5%); no other panel above 100 | [72] |

  Pathways (pass-2 count of the June 2026 file): 96.2% 510(k) (1,553), 2.5% De Novo (40), 1.3% PMA (21) [72], consistent with about 96%/3%/1% reported earlier [38].
- **Clinical evidence highlights:**
  - **MASAI** (Sweden, RCT, 105,934 women): AI-supported mammography screening matched or exceeded double reading in cancer detection and cut screen-reading workload by about 44% at interim analysis (Lång et al., *Lancet Oncol* 2023) [36]. The full screening-performance analysis found a 29% higher cancer-detection rate (6.4 vs 5.0 per 1,000) [84]. The primary-endpoint paper (*Lancet* 2026) found a **non-inferior interval-cancer rate** (1.55 vs 1.76 per 1,000), higher sensitivity (80.5% vs 73.8%) and identical specificity (98.5%) [85].
  - Stroke large-vessel-occlusion triage, pulmonary embolism and intracranial-hemorrhage triage, and fracture detection are widely deployed (AK).
- **Pathology AI:** digital pathology adoption is the gating factor. FDA authorizations exist for prostate-cancer detection and some other tasks (AK).
- **HMS implication:** don't build imaging or pathology models. Build an AI orchestration and results-integration layer:
  - DICOM SR / FHIR ImagingStudy and DiagnosticReport ingestion;
  - worklist prioritization;
  - display of AI findings with provenance;
  - performance monitoring by device and site;
  - integration with PACS/VNA and AI marketplaces.

### 2.6 Regulation of predictive CDS (US focus)

The FDA's **CDS guidance of 29 January 2026** supersedes a 6 January 2026 version [41] (docket FDA-2017-D-6569). Pass 2 re-read the PDF: its guidance-history table describes the 29 January revision as a Level 2 "minor correction on p.13 & 14 to delete reference to time-critical decision-making for alignment with January 6, 2026, update", so **the substantive policy dates from 6 January 2026**. It keeps the four statutory non-device CDS criteria (§520(o)(1)(E)):

1. no image or signal analysis;
2. uses medical information;
3. supports or provides recommendations to an HCP;
4. lets the HCP independently review the basis.

What it adds:

- **Enforcement discretion when "only one option is clinically appropriate."** Example: a cardiovascular-risk calculator from standard inputs.
- **Short-horizon or time-critical prediction stays a device.** The same calculator predicting events "in the next 24 hours" is a device; so are in-hospital mortality predictions from near-real-time physiology "intended to guide immediate escalation."
- **Sepsis and stroke alarms and deterioration alerts are devices.**
- **Automation bias:** FDA weighs the level of automation and the time-critical nature of the decision under Criterion 4.

The guidance does not explicitly address LLMs. My reading of the full text found no generative-AI references.

Related FDA instruments:

- **Predetermined Change Control Plans** (final guidance, December 2024) allow pre-specified model updates for AI-enabled devices [42].
- The FDA list's foundation-model tagging signals growing LLM-device oversight [37].

**Practical meaning for us:**

| Category | Regulatory status |
|---|---|
| Documentation, summarization, administrative and RCM AI; clinician-reviewable risk scores with long horizons | Generally non-device |
| Inpatient sepsis/deterioration alarms; image/signal analysis; patient-facing diagnosis or triage | Device territory. Partner with cleared products, or run a QMS (ISO 13485, IEC 62304, ISO 14971) and file |

### 2.7 Validation, calibration and monitoring lessons

1. **Never trust developer metrics.** Validate locally, retrospectively and then in silent mode, against an outcome definition that excludes "clinician already acted" leakage [30][31].
2. **Report what the bedside sees:** PPV, alerts per patient-day, alerts per nurse per shift, lead time, and number needed to evaluate. AUROC is not enough. The ESM needed 8 evaluations per sepsis case with one alert per patient, and 109 with repeated alerts [30].
3. **Calibrate locally** (recalibration or Platt/isotonic) and choose thresholds by response capacity.
4. **Co-design the response:** who receives the alert, what bundle follows, and how dismissal is captured (TREWS/COMPOSER/AAM pattern) [32][33].
5. **Monitor continuously:** input drift (lab-assay changes, new order sets), performance drift as outcomes arrive, alert fatigue (override rates), and subgroup performance.
6. **Measure outcomes,** not just accuracy: mortality, time to antibiotics, ICU transfers, length of stay. Decommission models that don't help.
7. **Use tooling:** Epic open-sourced "seismometer" for local model validation [67]. Our platform should ship an equivalent natively.

---

## 3. AI use-case catalog (for our HMS)

*Maturity: Mature = widely deployed with evidence; Scaling = broad roll-out with emerging evidence; Early = pilots. Evidence: High (RCTs or large prospective studies), Moderate (multisite observational), Low (case studies or vendor). Risk = patient-safety, financial and regulatory exposure. Priority: P0 = must have at general availability; P1 = within 12 months of GA; P2 = later or opportunistic.*

| # | Use case | Primary users | Maturity 2026 | Evidence | Risk | Build / Partner / Buy | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Ambient documentation (outpatient) | Physicians, APPs | Scaling → Mature | Moderate–High (RCTs on time and burnout; modest) [17][19][20] | Medium (omissions, coding intensity) | **Partner** (2+ vendors) + **build** workflow, structured outputs and telemetry; native engine optional later | **P0** |
| 2 | Ambient documentation (ED/inpatient) | Hospitalists, ED | Scaling | Low–Moderate | Medium–High | Partner + build | P1 |
| 3 | Nursing ambient → flowsheets | Nurses | Early | Low (vendor) [9][11] | Medium | Build structured mapping; partner for speech | P1 |
| 4 | Dictation (radiology and other reports) | Radiologists, pathologists | Mature | Moderate | Low–Medium | Buy/partner (PowerScribe-class) | P0 (integration) |
| 5 | Chart summary / pre-visit brief with citations | Clinicians | Scaling | Moderate (reader studies) [27] | Medium | **Build** (core platform capability) | **P0** |
| 6 | Handoff / end-of-shift summaries | Nurses, residents | Scaling | Low–Moderate | Medium | Build | P1 |
| 7 | Discharge summary drafting | Hospitalists | Scaling | Moderate (blinded comparison) [26] | Medium–High | Build | P1 |
| 8 | Patient-friendly translation (discharge, results, notes) | Patients, nurses | Scaling | Moderate [25] | Medium–High | Build | **P0** (results explanation), P1 (discharge) |
| 9 | In-basket draft replies | Clinicians, nurses | Mature | Moderate (burden ↓, time ↔) [22][23] | Medium | Build | **P0** |
| 10 | Message triage/routing (urgency, intent) | Nurses, MAs | Scaling | Low–Moderate | Medium–High (missed urgency) | Build | **P0** |
| 11 | Chart Q&A ("ask the chart") | Clinicians | Early → Scaling | Low | Medium | Build | P1 |
| 12 | Order and diagnosis suggestions from conversation | Clinicians | Early | Low [6] | High (complacency) | Build, behind strong UX controls | P2 |
| 13 | Coding assistance / CAC (pro-fee, outpatient) | Coders | Mature | Moderate (vendor denials data) [4] | Medium (compliance) | Build on rules + LLM, or partner | **P0** |
| 14 | Autonomous coding (radiology, ED, pathology) | HIM | Scaling | Low–Moderate [5] | Medium–High | Partner or build narrow | P1 |
| 15 | CDI query generation (inpatient) | CDI specialists | Scaling | Low–Moderate [64] | Medium (query compliance) | Build | P1 |
| 16 | Prior-auth packet assembly + Da Vinci PAS | Access/RCM staff | Scaling | Low (vendor) [5] | Medium | **Build** (FHIR CRD/DTR/PAS) | **P0** (US), P1 elsewhere |
| 17 | Denial prediction, triage, appeal drafting | RCM | Scaling | Low–Moderate | Low–Medium | Build | P1 |
| 18 | Voice agents for payer calls / eligibility | RCM | Early → Scaling | Low (vendor) | Low | Partner | P2 |
| 19 | Patient AI assistant in portal (grounded Q&A, navigation) | Patients | Early → Scaling | Low [8] | High (patient-facing advice) | Build orchestration; partner models; strict scope | P1 |
| 20 | Self-scheduling + waitlist auto-fill + reminder optimization | Patients, schedulers | Mature | Moderate | Low | **Build** | **P0** |
| 21 | Voice/chat agents for access (scheduling, refills, FAQs) | Patients, call center | Scaling | Low (vendor) | Medium | Partner (pluggable) | P1 |
| 22 | No-show prediction → targeted outreach | Access | Mature | Moderate [68] | Medium (equity) | Build | P1 |
| 23 | Deterioration early warning | Nurses, RRT | Mature | High (eCART comparison; AAM) [34] | **High** (device) | **Partner** with FDA-cleared score; build response workflow | P1 |
| 24 | Sepsis early warning | Clinicians | Mature (but contested) | Mixed: negative ESM [30]; positive TREWS/COMPOSER [32][33] | **High** (device) | **Partner** (cleared) + build bundle workflow and monitoring | P1 |
| 25 | Readmission risk + transitions workflow | Care managers | Mature | Moderate (intervention-dependent) | Medium | Build (with local training) | P1 |
| 26 | LOS / expected discharge date / barriers | Case mgmt, bed mgmt | Scaling | Low–Moderate | Low–Medium | Build | P1 |
| 27 | Capacity forecasting (ED, census, OR) | Operations | Mature | Moderate | Low | Build (forecasting service) | P1 |
| 28 | AKI, falls, pressure-injury, delirium risk | Nurses, pharmacists | Scaling | Moderate (retrospective) [35] | Medium | Build or partner; validate locally | P2 |
| 29 | Imaging AI (triage/detection) | Radiology | Mature | High in some tasks [36] | High (device) | **Buy/partner**; build orchestration layer | P1 (integration) |
| 30 | Pathology AI | Pathology | Early → Scaling | Moderate | High (device) | Buy/partner | P2 |
| 31 | Population-health risk stratification | Care management | Mature | Moderate (bias lessons) [69] | Medium (equity) | Build | P1 |
| 32 | Low-code agent builder (customer-built agents) | IT, informatics | Early → Scaling | Low [5][8] | Medium–High (governance) | Build, gated by governance workflow | P2 |
| 33 | Generative patient-trajectory models (Cosmos-style) | Clinicians, researchers | Early | Low (in validation) [5] | High | Defer; partner/research | P2 |
| 34 | Clinical-trial matching and registry abstraction | Research, quality | Scaling | Moderate | Low–Medium | Build (LLM abstraction with human verification) | P2 |
| 35 | Quality-measure abstraction (chart-abstracted measures) | Quality | Scaling | Low–Moderate | Low–Medium | Build | P1 |

---

## 4. Evidence summary: key studies

| # | Citation | Design | Main finding |
|---|---|---|---|
| E1 | Lukac et al., *NEJM AI* 2025 (UCLA) [17] | Pragmatic 3-arm RCT; 238 physicians; DAX vs Nabla vs usual care | Nabla −9.5% time-in-note (significant); DAX −1.7% (not significant); modest burnout and task-load improvements; occasional clinically significant inaccuracies; 1 mild adverse event |
| E2 | Olson et al., *JAMA Netw Open* 2025 [19] | QI pre/post; 263 clinicians; 6 health systems; Abridge | Burnout 51.9% → 38.8% (aOR 0.26); cognitive load −2.64/10; after-hours documentation −0.9 h/week |
| E3 | Rotenstein et al., *JAMA* 2026;335(16):1408–1417 (five academic institutions) [71][20] | Longitudinal cohort, difference-in-differences; 8,581 clinicians (1,809 adopters) | 16.0 min less documentation and 13.4 min less EHR time per 8 scheduled patient hours; +0.49 weekly visits; no significant change in after-hours EHR time; 27.3 min for users with ≥50% of visits on the scribe (secondary report) |
| E4 | Afshar et al., *NEJM AI* 2025;2(12) (UW Health) [18] | 24-week stepped-wedge, individually randomized pragmatic trial; 66 practitioners | Work exhaustion/disengagement −0.44 (5-point scale, significant); fulfillment not significantly changed; time on notes −0.36 h/day; billing diagnostic codes increased |
| E5 | Tierney et al., *NEJM Catalyst* 2025 (KP) [21] | One-year enterprise evaluation | More than 2.5M uses (title confirmed); about 15,800 hours saved (est.); high clinician satisfaction (AK) |
| E6 | PHTI, March 2025 [13][14] | Expert task force (8 systems, 10 vendors) | Burnout likely improves; financial ROI unclear; best fit in primary care |
| E7 | Garcia et al., *JAMA Netw Open* 2024 (Stanford) [22] | Prospective QI; 162 clinicians | 20% draft use; task load and exhaustion fell; no time savings |
| E8 | Tai-Seale et al., *JAMA Netw Open* 2024 (UCSD) [23] | Randomized waiting-list; 52 PCPs | Read time +21.8%; reply length +17.9%; reply time unchanged |
| E9 | Chen et al., *Lancet Digit Health* 2024 [24] | Simulation; 6 radiation oncologists, 100 GPT-4-generated cancer-patient scenarios | Unedited LLM drafts judged to risk severe harm in 7.1% (11/156) and death in 0.6% (1/156); evidence of anchoring |
| E10 | Williams et al., *JAMA Intern Med* 2025 (UCSF) [26] | Blinded comparison; 100 discharge narratives | Quality similar; LLM less comprehensive; 2.91 vs 1.82 errors per summary; low harm |
| E11 | Zaretsky et al., *JAMA Netw Open* 2024 (NYU) [25] | Cross-sectional; 50 summaries | Grade 11 → 6 readability; 18% of reviews raised safety concerns (mostly omissions) |
| E12 | Van Veen et al., *Nat Med* 2024 [27] | Reader study (10 physicians, 4 summarization tasks) | Best-adapted LLM summaries equivalent (45%) or superior (36%) to expert summaries in most cases |
| E13 | Wong et al., *JAMA Intern Med* 2021 (Michigan) [30] | External validation; 38,455 hospitalizations | ESM AUROC 0.63; sensitivity 33%; PPV 12%; 67% of sepsis missed; 18% alert rate |
| E14 | Kamran et al., *NEJM AI* 2024 [31] | Retrospective; prediction timing | ESM near chance before clinician recognition (figures AK; citation confirmed) |
| E15 | Adams et al., *Nat Med* 2022 (TREWS) [32] | Prospective multisite observational; 590,736 monitored | Alert confirmation within 3 h linked to 3.3-point absolute (18.7% relative) adjusted mortality reduction |
| E16 | Boussina et al., *npj Digit Med* 2024 (COMPOSER) [33] | Before/after quasi-experimental; 6,217 septic patients | 1.9-point absolute (17% relative) reduction in in-hospital sepsis mortality; +5.0 points (10% relative) bundle compliance |
| E17 | Edelson et al., *JAMA Netw Open* 2024 [34] | Retrospective; 362,926 encounters | eCART 0.895 > NEWS2 0.831 ≈ NEWS ≈ Rothman > EDI 0.808 > MEWS 0.757 |
| E18 | Tomašev et al., *Nature* 2019 [35] | Retrospective (VA) | AKI predicted up to 48 h early (55.8%); 2:1 false-to-true alerts |
| E19 | Lång et al., *Lancet Oncol* 2023 (MASAI) [36]; follow-ups [84][85] | RCT (screening; 105,934 women) | AI-supported reading non-inferior or better on detection; −44% reading workload; +29% cancer detection (2025); non-inferior interval-cancer rate with higher sensitivity and equal specificity (*Lancet* 2026) |
| E20 | Obermeyer et al., *Science* 2019 [69] | Algorithm audit | Cost-as-label algorithm under-identified Black patients' needs |
| E21 | Samorani et al., *M&SOM* 2022 [68] | Modeling/simulation | No-show-based overbooking increases waits for Black patients; fairness-aware scheduling fixes this |
| E22 | Steitz et al., *JAMA Netw Open* 2023 [55] | Survey; 8,139 respondents; 4 AMCs | 95.7% prefer immediate results release; 7.5% more worried (16.5% with abnormal results) |
| E23 | ONC Data Brief 77 (HINTS 2024) [54] | National survey | 65% accessed a portal; 57% via app; proxy access 51%; 59% have multiple portals; 7% use an aggregator |
| E24 | Levine et al., *Ann Intern Med* 2020 [57] | RCT, home hospital; 91 adults at 2 sites | 38% (95% CI 24–49%) lower direct cost; fewer labs, imaging and consultations; 30-day readmissions 7% vs 23% |

---

## 5. AI governance in a hospital system, and what the HMS must provide

### 5.1 The landscape (as of October 2026)

| Instrument | Scope | Key obligations or expectations | What it means for an HMS vendor |
|---|---|---|---|
| **ONC/ASTP HTI-1: Decision Support Interventions** (§170.315(b)(11)); final rule effective 11 Mar 2024 [43] | Certified health IT (US) | <ul><li>"First of its kind" algorithm transparency [43]</li><li>Source attributes: about 13 for evidence-based DSIs, **31 for predictive DSIs** (intended use, cautioned uses, development data, fairness, external validation, update and monitoring processes, etc.)</li><li>User feedback</li><li>Intervention risk management (risk analysis, mitigation, governance), with summaries published</li></ul>(attribute counts AK; 31 predictive attributes corroborated by HTI-5 coverage). **Pending change:** the **HTI-5 proposed rule** (released 22 Dec 2025; 90 FR 60970, 29 Dec 2025) would remove 34 of 60 certification criteria, revise 7, and narrow the DSI criterion to "fully remove the artificial intelligence (AI) 'model card' requirements". Comments closed 27 Feb 2026. A Federal Register API check on 16 Oct 2026 found **no HTI-5 final rule** [73] | Ship **model cards bound to every DSI**, editable by the customer for locally built models; a feedback button. If HTI-5 is finalized as proposed, the federal certification mandate for source attributes goes away. **Design for the transparency requirement regardless**: CHAI Applied Model Cards, Joint Commission RUAIH certification, EU AI Act instructions for use and customer procurement all still expect it |
| **ONC HTI-4** (finalized in the FY 2026 IPPS final rule, 90 FR 36536, 4 Aug 2025) [44][74] | Certified health IT | ePrescribing updates, real-time prescription benefit, electronic prior-authorization criteria (criterion detail AK) | Native Da Vinci PAS/CRD/DTR |
| **FDA CDS guidance** (29 Jan 2026, a minor correction of the 6 Jan 2026 revision) [41]; PCCP guidance (Dec 2024) [42]; AI-enabled device list [37] | Software as a medical device | <ul><li>Non-device CDS criteria</li><li>Time-critical and alarm functions are devices</li><li>PCCPs for model updates</li></ul> | Product-classification process per AI feature; QMS for any device module; or partner |
| **HHS §1557, 45 CFR 92.210** (May 2024) [53] | Covered entities using patient-care decision-support tools | Reasonable efforts to identify and mitigate discrimination risk from tools that use race, color, national origin, sex, age or disability. Compliance with §92.210(b)–(c) was due "within 300 days of July 5, 2024", i.e. 1 May 2025 (eCFR 45 CFR 92.1). The October 2025 *Tennessee v. Kennedy* vacatur covered only the gender-identity provisions; HHS states that "the other provisions of the Section 1557 Rule remain in force" (91 FR 32887, 2 Jun 2026) [81] | Input-variable disclosure (does the model use race/sex/age?); subgroup performance reports |
| **Joint Commission–CHAI RUAIH guidance** (17 Sep 2025) [45] | US hospitals (voluntary; accreditation-adjacent) | Seven elements: governance and policies; patient privacy and transparency; data security and data-use protections; ongoing quality monitoring; voluntary blinded reporting of AI safety events; risk and bias assessment; education and training (element list AK; guidance and release date confirmed [45]) | Governance workflows, monitoring dashboards, AI-event reporting, training-attestation tracking |
| **Joint Commission RUAIH certification** (launched 1 Jun 2026) [75] | US hospitals, critical access hospitals and health systems (Joint Commission-accredited or otherwise compliant with federal law); voluntary | Standards in five areas: governance; data management; risk and bias mitigation; ongoing monitoring and validation of AI performance and safety; transparency, education and workforce training. It **does not certify individual AI products**; it assesses organizational governance [75] | Customers seeking certification need product evidence: registry exports, monitoring reports, event logs, training records. Ship a certification-evidence pack |
| **CHAI governance playbooks** (27 May 2026) [46] | Health systems | Eight domains: AI Policy; Organizational Structures; Organizational Resources; Responsible AI Lifecycle Management and Use; Risk and Impact Assessments; Responsible Data Management and Use; **Third-Party Management**; Education, Training and Feedback. The playbooks "provide a framework to achieve the voluntary certification" from Joint Commission, which launched days later [46][75] | Map platform controls to the 8 domains; publish a vendor "control map" so customers can certify |
| **CHAI AI Intake Playbook + Common Intake Controls** (1 Oct 2026; **draft**, being piloted); Applied Model Card; public registry; work groups incl. Ambient AI testing framework and Agentic AI [47] | Health systems and vendors | Risk-based shared intake for vendor AI: 57 draft yes/no controls across 11 domains, distilled from 800+ questions in about 16 health-system questionnaires. Requirements scale with risk; about 40% of controls can be met by vendor attestation [47] | Pre-fill CHAI intake controls and Applied Model Card for every shipped AI feature; track revisions after the pilot |
| **NIST AI RMF 1.0** + **Generative AI Profile (NIST AI 600-1, 2024)** [50][51] | Voluntary (US) | Govern, Map, Measure, Manage; GenAI-specific risks (confabulation, data privacy, information integrity, etc.) | Align the internal secure-development lifecycle and risk register to the RMF |
| **ISO/IEC 42001:2023** (AI management system) [52] | Organizations (certifiable) | AI policy, risk and impact assessment, lifecycle controls, supplier management | Vendor should **certify to 42001** (alongside ISO 27001/27701); a strong procurement differentiator |
| **EU AI Act** [48], as amended by the **Digital Omnibus on AI, Regulation (EU) 2026/1744** (politically agreed 7 May 2026; published in the OJ 24 Jul 2026; in force July 2026, per law-firm coverage) [76] | Providers and deployers in the EU | <ul><li>Prohibitions and AI literacy since 2 Feb 2025. The Omnibus softened Art. 4 so that providers and deployers must *support* staff AI literacy (final wording not read directly) [76]</li><li>GPAI obligations since 2 Aug 2025</li><li>General application 2 Aug 2026, incl. Art. 50 transparency (users must know they're talking to AI; AI-generated content marked). Systems already on the market before 2 Aug 2026 have until **2 Dec 2026** for Art. 50(2) machine-readable marking [48][76]</li><li>New Art. 5 prohibitions (non-consensual intimate imagery, CSAM) from 2 Dec 2026 [76]</li><li>**High-risk** obligations: Annex III from **2 Dec 2027**; Annex I (incl. MDR/IVDR medical-device AI) from **2 Aug 2028**. These are now fixed dates, replacing the proposal's standards-linked trigger. Systems already on the market are caught only if substantially modified afterwards; the Commission may limit AI Act requirements where sectoral law (e.g. medical devices) imposes equivalent obligations [48][76]</li><li>Deployers (hospitals): use per instructions, competent human oversight, input-data relevance, monitoring, log retention, incident reporting, worker information; FRIA for public bodies (AK)</li></ul> | <ul><li>Provider-side: technical documentation, logging, human-oversight design, post-market monitoring for device-grade modules</li><li>Deployer-support features: logs, oversight UI, instructions for use, incident reporting</li><li>Chatbot disclosure in patient-facing AI</li></ul> |
| **EHDS Regulation** (in force 26 Mar 2025) [49] | EU EHR systems and data | Primary-use exchange: patient summaries and ePrescriptions/eDispensations by **Mar 2029**; images, labs and discharge reports by **Mar 2031**. Secondary use via health data access bodies and permits from Mar 2029 for most data categories, and from Mar 2031 for the rest (incl. genomic data). Harmonised EHR-system requirements with compliance certification [49] (dates re-confirmed in pass 2) | European EHR exchange format readiness; secure processing environment compatibility; EHR-system conformity |
| **UK NHS England ambient-scribing guidance** (Apr 2025) [70] | NHS organizations | Clinical safety (DCB0129/0160), DTAC, DPIA; products that summarize likely need MHRA Class I medical-device registration (AK) | UKCA/MHRA registration plan for ambient; DCB0129 safety case |
| **US state laws** | Varies | <ul><li>California AB 3030 (GenAI patient-communication disclaimer) and SB 1120 (physician makes medical-necessity decisions) (AK)</li><li>**Texas TRAIGA** (HB 149, effective 1 Jan 2026): a provider must disclose AI use "in relation to health care service or treatment" no later than the date the service is first provided, except in emergencies [78]</li><li>**Colorado:** the original AI Act (SB 24-205) never took effect. It was **repealed and re-enacted by SB 26-189** (signed 14 May 2026) as a narrower automated-decision-making-technology (ADMT) transparency law covering consequential decisions including health care. Developer documentation, consumer notice, data-correction and human-review rights apply mainly from **1 Jan 2027**, with AG enforcement and a 60-day cure period before 2030 [77]</li></ul> | Jurisdiction-aware disclosure and consent engine; ADMT notice and human-review workflow for Colorado from 2027 |
| **India / Middle East** | National | India: DPDP Act 2023 and Rules (notified 2025, phased), ICMR AI ethics guidelines, CDSCO SaMD rules (AK). Saudi Arabia: SDAIA AI ethics, SFDA AI/ML device guidance. UAE: DoH Abu Dhabi AI policies (AK) | Data residency (in-country hosting), consent artifacts, local language support |

### 5.2 What a hospital AI governance program needs (operating model)

1. **An AI governance committee** (CMIO/CNIO, quality and safety, legal/compliance, privacy, IT security, health equity, patient representative) with a risk-tiered approval path.
2. **An intake and inventory** of every AI tool: vendor, embedded EHR feature, or home-grown. CHAI's intake playbook offers a standard set of controls [47].
3. **Pre-deployment local validation,** proportionate to risk.
4. **Monitoring:** performance, drift, equity and usage, plus AI safety-event reporting [45].
5. **Transparency to clinicians** (model cards) and to patients (disclosure and consent where appropriate) [45].
6. **Third-party management:** contract clauses on data use, model updates, notification, audit rights and indemnity [46].
7. **Training** and AI-literacy attestation. This remains a legal duty in the EU under Art. 4, softened by the 2026 Omnibus to an obligation to support staff AI literacy [48][76]. It is also a focus area of the Joint Commission RUAIH certification [75].
8. **Decommissioning** criteria.

### 5.3 What the HMS platform must build to support governance

The platform must make governance cheap. If every hospital has to bolt on spreadsheets and third-party monitors, it will struggle to earn the Joint Commission RUAIH certification (launched June 2026) [75] or to meet the EU deployer obligations. The core is an **AI Control Plane**, with these components:

- **Model and agent registry:** every AI artifact (vendor or local) with version, owner, intended use, risk tier, approval status, and the deployment scope (sites, units, roles).
- **Model card / source-attribute store:** HTI-1 DSI attributes, CHAI Applied Model Card fields, and EU AI Act instructions for use, rendered in context through an "i" button on every AI output.
- **Evaluation harness:**
  - golden datasets;
  - silent-mode runner;
  - a seismometer-like local validation report (calibration, PPV at thresholds, subgroup metrics) [67];
  - LLM regression suites run on every model or prompt change.
- **Runtime monitoring:**
  - input-distribution drift;
  - outcome-linked performance as labels arrive;
  - override and dismissal rates;
  - edit distance for GenAI;
  - latency and cost;
  - subgroup dashboards.
- **Human-in-the-loop UX kit:** standard components for AI drafts (source citations, confidence, "AI-generated" badges, accept/edit/reject with reason codes, per-item acceptance for orders), so every feature behaves consistently.
- **Override and feedback capture:** structured reasons ("not clinically relevant," "already addressed," "incorrect") feeding monitoring and vendor feedback (HTI-1 feedback loop) [43].
- **AI safety-event reporting:** integrated with the incident-reporting module, with confidential and blinded reporting options per RUAIH [45].
- **Immutable provenance and audit:** for every AI-touched artifact, record:
  - model and version;
  - prompt template version;
  - retrieved sources;
  - the raw output;
  - human edits;
  - signer and time.

  This supports liability defense, payer audits and EU log retention.
- **Policy engine:** jurisdiction-aware disclosure (e.g. AB 3030, TRAIGA), consent requirements (recording consent), sensitive-data segmentation, and feature toggles by site, role and patient population.
- **Kill switch and rollback:** per model, per site, instantly.
- **Bias and equity toolkit:** stratified performance reports; flags for protected-attribute inputs (§1557) [53].

### 5.4 AI governance requirements checklist (platform)

**MUST (at GA)**

| # | Requirement |
|---|---|
| G1 | Central **registry** of all AI models, prompts and agents, with version pinning, owner, intended use, risk tier and approval status |
| G2 | **Model cards / source attributes** per HTI-1 DSI for every predictive and evidence-based DSI, viewable in workflow; customer-editable for local models [43]. Keep this even if HTI-5 removes the federal certification requirement [73], because CHAI, Joint Commission and the EU AI Act all expect equivalent transparency |
| G3 | **Provenance** on every AI-generated artifact (model, version, sources, output, edits, signer), immutable and exportable |
| G4 | **Human-in-the-loop by default:** no AI output enters the legal record, reaches a patient, or executes an order/claim without an accountable human action, unless a governed policy explicitly authorizes autonomy for a narrow, monitored use (e.g. low-risk autonomous coding with sampling QA) |
| G5 | **Override and feedback capture** with structured reasons on alerts and drafts |
| G6 | **Local validation tooling:** retrospective and silent-mode evaluation with calibration, PPV/sensitivity at thresholds, alert burden and subgroup metrics |
| G7 | **Runtime monitoring** of drift, performance, usage, edit distance, override rates and subgroup gaps, with alert thresholds |
| G8 | **AI safety-event reporting** integrated with incident management (incl. blinded option) [45] |
| G9 | **Per-feature, per-site enable/disable and instant rollback** (kill switch) |
| G10 | **Disclosure engine:** patient-facing AI identifies itself (EU AI Act Art. 50; state laws); AI-drafted patient communications are labeled per jurisdiction [48] |
| G11 | **Recording consent** workflow for ambient capture, with state and country rules and opt-out honored |
| G12 | **Privacy controls:** PHI minimization, region-pinned inference, zero retention or no training by model vendors unless contracted, segmentation of sensitive data (42 CFR Part 2, adolescent, reproductive and behavioral health) |
| G13 | **Security controls for agents:** least-privilege tool scopes, write actions require approval, prompt-injection defenses, full action logs |
| G14 | **Regulatory classification record** per AI feature (non-device CDS vs device; EU risk class), with evidence [41] |
| G15 | **Change management:** regression evaluation before any model or prompt update; customer release notes; PCCP for device modules [42] |
| G16 | **Equity:** declaration of protected-attribute inputs; stratified performance reports (§1557) [53] |

**SHOULD (within 12–18 months)**

| # | Requirement |
|---|---|
| G17 | Pre-filled **CHAI Applied Model Card** and **Common Intake Controls** for every shipped feature [47] |
| G18 | **Control map** to CHAI's 8 governance domains and the five RUAIH certification focus areas, so customers can certify [46][75] |
| G19 | Vendor **ISO/IEC 42001** certification and NIST AI RMF alignment statement [50][52] |
| G20 | **Outcome-linkage dashboards** connecting AI usage to clinical and operational outcomes (e.g. sepsis mortality, LOS, denials) |
| G21 | **Coding-integrity monitor:** E/M distribution shifts after AI roll-out; documentation–code concordance sampling [16] |
| G22 | **Low-code agent builder** that forces registry entry, risk tiering, evaluation and approval before production [5] |
| G23 | **Patient-facing transparency page** listing AI tools in use, as hospitals increasingly publish |
| G24 | **Federated or benchmark evaluation**: anonymized cross-customer performance benchmarks for shipped models |
| G25 | **EU AI Act deployer pack**: log retention, instructions for use, FRIA templates, incident-reporting workflows [48] |
| G26 | **AI-literacy training tracking** per role (EU Art. 4 as amended; RUAIH education element and certification focus area) [45][48][75][76] |

---

## 6. Data and analytics platform

### 6.1 Patterns: operational reporting vs EDW vs lakehouse; the Epic model

| Layer | Purpose | Epic analog | Lessons |
|---|---|---|---|
| **Operational (real-time) reporting** | In-workflow lists, dashboards, census, worklists; seconds-fresh | Chronicles (hierarchical OLTP) with Reporting Workbench and Radar (AK) | Must run on live transactional data without hurting OLTP performance |
| **Relational reporting replica** | Ad-hoc SQL, detailed reporting; daily refresh | **Clarity**: nightly ETL into a very large relational schema (thousands of tables) (AK) | Nightly latency is no longer acceptable for operations and AI. Huge schemas need a semantic layer |
| **Dimensional EDW** | Curated star schemas for BI, quality, finance; integrates non-EHR data | **Caboodle** (AK) | Curated dimensional models remain valuable for self-service BI |
| **Cross-customer network** | De-identified research, benchmarking, "patients like mine," model training | **Cosmos**: 310M patients, 2,358 hospitals, 52.5K clinics; 250 publications [10]. Feeds Best Care Choices, Look-Alikes, growth charts [10] and generative models: CoMET/Curiosity v1 (2025 paper, 118M patients [90]) and the UGM-2026 Curiosity (320M patients, 23B encounters) [3][5] (two generations; reconciled 2026-10-16) | Network scale is a moat. Requires a contractual data-sharing model and de-identification at scale |
| **Cloud AI/data platform** | Model hosting, feature store, GenAI services | Epic's cloud AI platform (AK) | EHR vendors are building AI platforms tightly coupled to their data |

**Modern alternative:** a lakehouse (open table formats such as Delta or Iceberg, object storage, SQL plus Spark/Python engines) fed by CDC from the transactional system. It holds bronze/silver/gold layers, FHIR and OMOP projections, a semantic layer, a feature store and vector indexes. Cloud vendors now ship healthcare-specific accelerators: FHIR-to-OMOP pipelines, DICOM ingestion, de-identification (AK).

### 6.2 Reference design for our HMS

```
                         ┌───────────────────────────────────────────────────────────┐
                         │                 CONSUMERS / SURFACES                      │
  Clinician apps · Patient app/portal · Ops command center · BI/self-service · Research│
  workbench · Quality reporting · Payers/HIEs/national rails · Partner AI apps         │
                         └───────────▲───────────────▲────────────────▲──────────────┘
                                     │               │                │
   ┌─────────────────────────────────┴───┐   ┌───────┴────────┐  ┌────┴──────────────────┐
   │  REAL-TIME SERVICES                 │   │ SEMANTIC LAYER │  │ AI CONTROL PLANE      │
   │  - FHIR R4/R5 API (US Core, IPS)    │   │ metrics, dims, │  │ registry · model cards│
   │  - CDS Hooks / SMART on FHIR v2     │   │ governed KPIs  │  │ eval harness · monitor│
   │  - FHIR Subscriptions / webhooks    │   └───────▲────────┘  │ policy · provenance   │
   │  - Grounding/context service (RAG)  │           │           │ model gateway (LLMs,  │
   │  - Feature store (online)           │           │           │ ASR, ML) · kill switch│
   │  - Streaming analytics (CEP rules,  │           │           └────▲──────────────────┘
   │    early-warning scoring, capacity) │           │                │
   └──────────────▲──────────────────────┘           │                │
                  │ events (Kafka-class log)          │                │
   ┌──────────────┴──────────────────────────────────┴────────────────┴──────────────┐
   │  GOVERNED LAKEHOUSE (open table formats; region-pinned)                          │
   │  Bronze: raw CDC + HL7v2/FHIR/DICOM metadata/device streams/claims/ERP/PGHD      │
   │  Silver: conformed canonical model + terminology normalization (SNOMED, LOINC,   │
   │          RxNorm, ICD-10, CPT/OPCS/ICHI, local codes)                             │
   │  Gold:   (a) dimensional marts (finance, ops, quality, workforce)                │
   │          (b) FHIR projection (Bulk $export source)                               │
   │          (c) OMOP CDM v5.4 projection (research, OHDSI tools)                    │
   │          (d) measure engine outputs (CQL eCQMs/dQMs, HEDIS, NHS/NABH indicators) │
   │          (e) registry extracts (NCDR, STS, NHSN, cancer, national audits)        │
   │          (f) ML training sets + offline feature store + vector indexes           │
   │  De-identified tier: Safe Harbor / Expert Determination / EHDS-ready SPE export   │
   └──────────────▲───────────────────────────────────────────────────────────────────┘
                  │ CDC (log-based, sub-minute)
   ┌──────────────┴───────────────────────────────────────────────────────────────────┐
   │  TRANSACTIONAL HMS (bitemporal journal-backed clinical + ERP domains)            │
   │  orders · results · documentation · meds · ADT · scheduling · billing · supply   │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

**Design principles.**

1. **Bitemporal append-only clinical journal and log-based CDC.** Analytics and AI see changes in seconds, not overnight. This avoids Clarity-style nightly-ETL latency. *(Reconciled 2026-10-16: this replaces "event-sourced core". The journal is written in the same transaction as current-state tables and doubles as the outbox (`08` §3.5/§3.11). Full event sourcing is limited to order/MAR aggregates, by ADR.)*
2. **One canonical model, multiple projections:** FHIR for exchange and apps, OMOP for research, dimensional for BI. Generate the projections from the same conformed silver layer so numbers reconcile.
3. **Terminology services as infrastructure.** Every measure, model and summary depends on correct codes: SNOMED CT, LOINC, RxNorm, ICD-10-CM/PCS and national variants, CPT/HCPCS, plus local maps.
4. **Measure engine on CQL:**
   - eCQMs today, CMS's digital quality measures (FHIR-based) tomorrow (AK);
   - HEDIS via NCQA's digital HEDIS (AK);
   - configurable national indicators: NHS (e.g. national clinical audits, SUS+ submissions, GIRFT metrics), Indian NABH quality indicators (accreditation requires monthly KPI monitoring; AK), JCI international quality measures.
5. **Self-service BI** over a **governed semantic layer** (certified metrics, row-level security by facility, department and role). Natural-language querying ("text-to-SQL") is appearing in BI. Only expose it over the semantic layer, with certified definitions, never raw tables.
6. **Real-time streaming analytics** for capacity (bed state, ED boarding, OR status), early-warning scoring, device-alarm analytics and sepsis bundle timers.
7. **Bulk data:** FHIR Bulk Data `$export` (system, group and patient level) with SMART Backend Services authorization [65], for payers, ACOs, HIEs, registries and research.
8. **Research tier:** OMOP CDM v5.4 with OHDSI tooling (ATLAS, Achilles, Data Quality Dashboard, HADES) [62] (tools AK). This makes each customer instantly network-ready (OHDSI, EHDEN, N3C-style) (AK).

### 6.3 De-identification, secondary use, networks, federated learning

- **HIPAA de-identification** has two routes [66] (AK):
  - **Safe Harbor:** remove 18 identifiers, including dates more specific than year (except year), geographic units smaller than state (the 3-digit ZIP exception applies if population > 20,000), and ages over 89. The entity must have no actual knowledge of re-identifiability.
  - **Expert Determination:** a qualified statistician certifies very small re-identification risk. This allows date-shifting and richer data; it is the approach networks typically use.
  - The platform should ship both, plus tokenization (privacy-preserving record linkage) for cross-dataset linkage.
- **EU EHDS secondary use:** data holders must make data available to health data access bodies under permits, processed in secure processing environments, with no download of personal data. Rules apply from March 2029, and from March 2031 for genomic data [49]. The HMS needs dataset catalogs (metadata in the EU's HealthDCAT-AP style; AK), extraction pipelines and opt-out handling.
- **Data networks as product strategy:**
  - **Epic Cosmos:** 310M patients [10]; models trained on it, e.g. Curiosity [5].
  - **Truveta:** 140M+ patients, "updated daily", "built with US health systems" [63]. The homepage no longer states a member count; "about 30 systems" is AK.
  - **OHDSI:** global federated OMOP network [62].

  A new HMS cannot match Cosmos on day one. It can design for **opt-in, governed federation**: standardized OMOP and FHIR, federated query, and privacy-preserving linkage. It can also partner with existing networks rather than compete.
- **Federated learning and analytics:** train or validate models across hospitals without centralizing data. This is useful for local-validation benchmarks and multi-site model development. It needs a common data model (OMOP), a secure aggregation framework, and governance agreements (AK).
- **Synthetic data:** useful for development and testing. It is not a substitute for real-world validation (AK).

### 6.4 Registries, population health, benchmarking

- **Registries:** automated extraction for cardiology (NCDR), cardiac surgery (STS), stroke (Get With The Guidelines), infection surveillance (NHSN), cancer registries, trauma (NTDB), and national audits (UK). LLM-assisted abstraction with human verification is an emerging P1 capability (AK).
- **Population health:** attribution, risk stratification (with bias safeguards [69]), care gaps (HEDIS/CQL), outreach campaigns that connect to the digital front door, and value-based contract performance. CMS's ACCESS model, with outcome-aligned payments from 5 July 2026 over 10 years [58], increases the value of outcome tracking.
- **Benchmarking:** opt-in, de-identified cross-customer benchmarks: LOS by DRG, denial rates, AI-model performance, portal adoption. Cosmos-style network effects begin here.

---

## 7. Digital front door and patient engagement

### 7.1 Adoption: where patients are (US 2024 baseline)

From ONC Data Brief 77 (HINTS 7, 2024 data, n = 7,278; published July 2025) [54] (all figures below re-confirmed in pass 2):

| Measure | 2024 value |
|---|---|
| Offered online access by a provider or insurer | **77%** |
| Accessed a portal or online record (25% in 2014) | **65%** |
| Accessed it if managing a chronic condition (offered 81%) | 69% |
| Accessed it with a recent cancer diagnosis (offered 86%) | 76% |
| Used an app to access records (38% in 2020) | **57%** |
| Web-only access (60% in 2020) | 42% |
| Proxy/caregiver access (24% in 2020) | **51%** |
| Had multiple portals (50% in 2022) | **59%** |
| Used an aggregator app (2% in 2022) | 7% |
| Accessed, among those encouraged by a provider | **87%** |
| Accessed, among those not encouraged | 57% |

**Implications:**

- mobile-first;
- proxy and caregiver flows are core, not edge cases;
- aggregation and single login are real pain points (cf. MyChart Central [3], Happy Together (AK));
- staff-driven activation at registration and discharge moves adoption more than features do.

### 7.2 Benchmark capabilities (MyChart and peers, 2026)

The MyChart family, per Epic [3][8] and AK:

- Records: results, notes, medications, immunizations, problem lists. Share Everywhere (AK).
- Secure messaging with AI-assisted routing and drafts on the clinician side.
- Self-scheduling (direct, ticket/order-based, open scheduling for new patients).
- Fast Pass waitlist offers (AK).
- E-check-in: demographics, insurance card capture, consents, questionnaires, co-pay.
- Questionnaires and PROMs.
- Bill pay, payment plans and price estimates (AK).
- Proxy access with adolescent-confidentiality rules.
- Video visits and e-visits.
- Happy Together aggregation across organizations (AK).
- **MyChart Central** single login across Epic organizations (announced for November 2025) [3].
- **Hello World**: text/voice engagement without a portal account. Newest feature: verified caller ID showing the health system [8].
- **Emmie / "Ask Emmie"**: grounded answers from the patient's own history (past visits, results), proposes appointment times and suggests screenings [1][8]. Adopted by Reid Health, Community Health Network and others in 2026 [8].
- AI-assisted results explanations (Memorial Hermann) [8].
- MyChart Bedside for inpatients (AK).

**Other benchmarks (AK):**

| Area | Benchmark products |
|---|---|
| Consumer scheduling and provider search | Zocdoc, Kyruus |
| Engagement and AI agents | Luma Health, Notable |
| Intake and kiosks | Phreesia |
| Patient financial experience | Cedar, Flywire |
| Wayfinding | Gozio |
| European scheduling | Doctolib |
| National apps | NHS App, Sehhaty |
| India PHR / ABHA apps | Eka Care, Apollo 24|7 |

### 7.3 Cures Act information-blocking rules, open notes and immediate results

The 21st Century Cures Act information-blocking rules (from April 2021) push US organizations to release notes and results to patients without delay, subject to narrow exceptions (AK). Evidence:

- **95.7%** of 8,139 surveyed patients across four academic medical centers wanted immediate release even before clinician review. That held at 95.3% among those with abnormal results [55].
- Only **7.5%** felt more worried; **45.9%** felt less worried. Worry was higher with abnormal results (16.5% vs 5.0%) [55].
- The by-product is a surge in portal messages after results release (AK), which in turn drives demand for in-basket AI (§1.3) and patient-facing result explanation [8].

**HMS requirements:**

- release rules engine with exception handling (preventing-harm exception, with documentation);
- plain-language explanations: AI-drafted and either reviewed or templated;
- an "expect a call" flag for sensitive results;
- message routing.

### 7.4 Access: self-scheduling, waitlists, AI agents

- **Self-scheduling** with decision-tree triage (visit type, provider rules, referral requirements), plus **waitlist auto-fill** that texts patients when earlier slots open. These are proven, low-risk, high-ROI features (AK).
- **Automated outreach** (texts and calls for reminders, care gaps, pre-visit prep) "helps patients keep millions of appointments" at Epic customers (vendor) [8].
- **Conversational AI agents** (chat and voice) for scheduling, rescheduling, refill requests, directions, billing questions and FAQs. Patient-facing AI is the fastest-growing AI segment by Menlo's estimate (about 20×) [12]. Requirements:
  - strict scope;
  - identity verification;
  - escalation to humans;
  - red-flag symptom detection with routing to triage nurses, never AI diagnosis;
  - disclosure (EU Art. 50 [48]; state laws).
- **Consumer AI is becoming a front door in its own right.** Major general-purpose AI assistants launched health features in early 2026 that let consumers connect their own records through patient-access APIs (AK). Our FHIR patient-access API and SMART app support determine whether patients can bring our data to those tools. The CMS Health Technology Ecosystem pledges (2025) push in the same direction: "kill the clipboard," conversational assistants (AK), plus "enabling modern identity on Medicare.gov" and a National Provider Directory (confirmed on the CMS page) [60].

### 7.5 On-site digital experience: kiosks, wayfinding, payments

- **Kiosks / tablet check-in:** identity verification, insurance card OCR, consents, co-pay collection, queue tokens. In India, ABDM "Scan and Share" QR-based OPD registration cuts queues (AK).
- **Wayfinding:** blue-dot indoor navigation integrated with appointments ("navigate to my 2 pm appointment"), parking and accessibility routes (AK).
- **Digital payments:**
  - price estimates (US hospital price-transparency rules; Good Faith Estimates under the No Surprises Act);
  - card-on-file, payment plans, financing;
  - UPI in India; mada/Apple Pay in Saudi Arabia; Pix in Brazil (AK).
- **Queue and status boards:** OPD queue status by SMS or WhatsApp; family updates on surgical status (AK).

### 7.6 Virtual care: telehealth, RPM, hospital-at-home, virtual nursing, smart rooms

- **Telehealth:** post-pandemic, telehealth has settled at a single-digit share of US outpatient claims nationally, far higher in behavioral health (AK, est.). Medicare telehealth flexibilities lapsed for 43 days during the October–November 2025 shutdown. They were then extended **through 31 December 2027** by §6209 of the Consolidated Appropriations Act, 2026 (H.R. 7148, signed 3 February 2026), which also delays the in-person requirement for telemental health to that date and requires CMS to create new telehealth billing modifiers by 1 January 2027 [80]. Required features:
  - integrated video (no separate app download);
  - interpreter three-way calls;
  - e-visits (asynchronous questionnaires);
  - virtual waiting rooms;
  - cross-border licensing logic.
- **Remote patient monitoring (RPM):**
  - device integration: BLE, cellular hubs, Apple HealthKit, Google Health Connect;
  - alert triage queues;
  - time tracking for billing.
  - US 2026 billing codes now include shorter monitoring periods (AK).
  - Outcome-based ACCESS model payments reward outcomes over activity [58]. The model began 5 July 2026, runs 10 years and has four initial tracks:
    - early cardio-kidney-metabolic: hypertension, dyslipidemia, obesity/overweight, prediabetes;
    - cardio-kidney-metabolic: diabetes, CKD stage 3a/3b, ASCVD;
    - musculoskeletal: chronic MSK pain;
    - behavioral health: depression and anxiety.

    Heart failure and COPD tracks start 1 April 2027 (re-confirmed on the CMS page in pass 2).
- **Hospital-at-home:**
  - **Policy:** the CMS Acute Hospital Care at Home waiver lapsed during the October 2025 shutdown, was restored in November 2025, and was **extended five years, through 30 September 2030**, by §6210 of the Consolidated Appropriations Act, 2026, signed 3 February 2026 [56][80]. Health systems such as MGB entered "growth mode" after the extension [56].
  - **Evidence:** a two-site RCT (91 adults) found 38% lower direct cost, fewer labs, imaging and consultations, and 30-day readmissions of 7% vs 23% [57]. The national Hospital at Home Quality Registry covers 46 hospitals in 18 systems and more than 39,000 patients (January 2026) [56].
  - **HMS needs:**
    - home-hospital ADT (virtual units/beds);
    - logistics for nurses, paramedics, pharmacy, DME and meals;
    - continuous-monitoring device integration;
    - two in-person visits per day;
    - escalation pathways;
    - CMS reporting.
- **Virtual nursing:**
  - remote nurses handle admissions, discharge education, med reconciliation, mentoring, and observation (virtual sitting with computer-vision fall detection);
  - adoption expanded rapidly in 2023–26 (AK);
  - evidence is mostly single-site pre/post, reporting better discharge timeliness, nurse satisfaction and fewer falls; rigorous controlled evidence remains limited (AK).
  - **HMS needs:**
    - a virtual-nurse role and worklist;
    - two-way room A/V integration;
    - documentation attribution (who did what, remote vs bedside);
    - task hand-off.
- **Interactive bedside and smart rooms:**
  - patient TV/tablet showing the care team, schedule, education, meal ordering, requests;
  - environmental controls;
  - digital whiteboards auto-populated from the EHR;
  - RTLS for staff and assets;
  - ambient sensors and cameras for falls and virtual sitting (MyChart Bedside, Get Well, Sonifi, Caregility, Artisight, care.ai/Stryker; AK).

### 7.7 Emerging markets and national apps: integrate, don't compete

| Region | Patient channel reality | National rails an HMS must integrate (AK unless cited) |
|---|---|---|
| **India** | WhatsApp is the dominant channel; UPI payments; Hindi plus regional languages; high OPD volumes and walk-ins | **ABDM:** ABHA ID creation/verification, Health Facility Registry, Healthcare Professionals Registry, consent-managed record sharing (HIP/HIU flows; "M1–M3" milestones), Scan and Share OPD; the Digital Health Incentive Scheme for certified HMIS; DPDP Act consent. Order of magnitude: hundreds of millions of ABHA IDs created (est.); verify on the ABDM dashboard |
| **Saudi Arabia** | High smartphone penetration; Arabic first; government super-apps | **Sehhaty** (MoH patient app), Seha Virtual Hospital, **NPHIES** (national insurance and health-information exchange, FHIR-based), Wasfaty e-prescribing, Nafath digital ID |
| **UAE** | Multilingual (Arabic, English, Hindi/Urdu, Tagalog) expat population | HIEs: **Malaffi** (Abu Dhabi), **NABIDH** (Dubai), **Riayati** (Northern Emirates); UAE Pass ID; DoH/DHA licensing and claims (eClaimLink/Shafafiya) |
| **UK** | NHS App as the national front door; NHS login | NHS App integration (appointments, messaging, records, prescriptions); NHS login; GP Connect; e-Referral Service; NHS England's 10-Year Plan positions the NHS App as the primary digital front door (2025) |
| **Africa (e.g. Kenya, Nigeria)** | Mobile money; SMS/USSD for feature phones; WhatsApp | Kenya Digital Health Act 2023 and national HIE/client registry; M-Pesa payments; OpenHIE/DHIS2 reporting |
| **Latin America (e.g. Brazil, Mexico)** | WhatsApp ubiquitous; Pix payments (Brazil) | Brazil **RNDS** (FHIR-based national network) and Meu SUS Digital; TISS (supplementary health exchange) |

**Design consequence: a channel-agnostic engagement engine.** The same journeys (reminders, pre-registration, results notification, payment links, PROMs, discharge follow-up) must render to:

- native app;
- web;
- SMS;
- WhatsApp Business Platform;
- RCS;
- IVR/voice;
- national apps.

It needs per-channel consent, templates and delivery receipts. Hospitals in these markets will not adopt a portal that ignores WhatsApp or the national ID.

### 7.8 Accessibility, multilingual support, PROMs/PREMs, patient-generated data

- **Accessibility:** WCAG 2.2 AA as the target. US HHS's Section 504 rule (May 2024) adopts WCAG 2.1 AA for web and mobile of HHS-funded recipients. An HHS interim final rule (91 FR 25496, 11 May 2026; effective 7 May 2026) **pushed compliance back one year**: to **11 May 2027** for recipients with 15 or more employees (was 11 May 2026) and **10 May 2028** for smaller recipients (was 10 May 2027) [79]. Section 1557 requires language assistance and accessible ICT (AK) [53]. Also needed: screen-reader support, large text, low-bandwidth mode, cognitive-accessibility (plain language), and caregiver modes.
- **Multilingual:** full UI localization (incl. right-to-left Arabic), patient-preferred language stored and honored across channels, AI translation with human-verified templates for clinical content, interpreter scheduling, and multilingual ambient capture [11].
- **PROMs/PREMs:**
  - PROMIS computer-adaptive tests and ICHOM sets;
  - automated scheduling by episode (e.g. pre/post arthroplasty);
  - results flowing to the clinician view and registries;
  - CMS hip/knee arthroplasty PRO-PM reporting is phasing into the Hospital Inpatient Quality Reporting program (AK);
  - PREMs (HCAHPS-adjacent pulse surveys, NHS Friends & Family Test).
- **Patient-generated health data (PGHD):** ingestion from Apple HealthKit, Google Health Connect, connected BP cuffs, glucometers and CGMs, with clinician-review queues, normalization (LOINC/UCUM), and rules that stop raw streams flooding the chart. FDA treats continuous sampling (e.g. CGM streams) as a "pattern/signal" whose analysis can make software a device [41].

### 7.9 Digital front door feature matrix

| # | Feature | Benchmark product(s) | MVP / Later |
|---|---|---|---|
| F1 | Patient identity + account (incl. national ID: NHS login, ABHA, Nafath/UAE Pass), MFA, passkeys | MyChart, NHS App | **MVP** |
| F2 | Single login across affiliated orgs / record aggregation | MyChart Central, Happy Together | Later (federation-ready at MVP) |
| F3 | Records: results, notes, meds, allergies, immunizations, problems, imaging reports; download/share (FHIR, IPS) | MyChart, NHS App | **MVP** |
| F4 | Immediate results release + plain-language explanation | MyChart + AI explanations [8] | **MVP** (templated); AI explanation P1 |
| F5 | Secure messaging with intent/urgency triage | MyChart | **MVP** |
| F6 | Self-scheduling (rules-based) + reschedule/cancel | MyChart, Zocdoc, Doctolib | **MVP** |
| F7 | Waitlist auto-fill (earlier-slot offers) | MyChart Fast Pass | **MVP** |
| F8 | Reminders and outreach via SMS/WhatsApp/voice without an account | Hello World [8], Luma | **MVP** |
| F9 | E-check-in: demographics, insurance card OCR, consents, questionnaires, co-pay | MyChart, Phreesia | **MVP** |
| F10 | Price estimates + Good Faith Estimates | MyChart, Cedar | MVP (US); Later elsewhere |
| F11 | Bill pay, payment plans, local payment rails (UPI, Pix, mada) | Cedar, Flywire | **MVP** |
| F12 | Proxy/caregiver access with adolescent-confidentiality rules | MyChart | **MVP** |
| F13 | Video visits (browser-based, interpreter add-in) + e-visits | MyChart Video, Teladoc-class | **MVP** (video); e-visits P1 |
| F14 | Prescription refill requests + pharmacy selection + e-Rx status | MyChart, NHS App | **MVP** |
| F15 | Questionnaires/PROMs (PROMIS CAT, ICHOM) | MyChart, specialized PRO platforms | **MVP** (forms); CAT later |
| F16 | PGHD connections (HealthKit, Health Connect, devices) | MyChart, Apple Health Records | Later (P1) |
| F17 | RPM enrolment, device logistics, alert-triage queues | Specialized RPM vendors | Later (P1) |
| F18 | Hospital-at-home patient app (schedule, vitals, contact) | HaH platforms | Later (P1–P2) |
| F19 | Patient AI assistant (grounded Q&A, navigation, scheduling) with disclosure and escalation | Emmie [8] | Later (P1), after governance |
| F20 | Voice/chat agents for call-center deflection | Various (AK) | Later (P1) |
| F21 | Inpatient bedside app (care team, schedule, education, requests, meals) | MyChart Bedside, Get Well | Later (P1) |
| F22 | Wayfinding (appointment-aware), parking | Gozio | Later (P2) |
| F23 | Kiosk check-in + queue tokens (incl. QR "scan and share") | Phreesia, ABDM Scan and Share | **MVP** for emerging markets; P1 elsewhere |
| F24 | Multilingual UI (incl. RTL) + preferred-language routing | NHS App, Sehhaty | **MVP** |
| F25 | Accessibility WCAG 2.2 AA, low-bandwidth mode | — | **MVP** |
| F26 | National app / HIE integration (NHS App, ABDM, Sehhaty/NPHIES, Malaffi/NABIDH) | National platforms | **MVP** per launch market |
| F27 | Consent management (data sharing, research, recording, communication preferences) | ABDM consent manager, EHDS opt-outs | **MVP** |
| F28 | Patient access API (SMART on FHIR) for third-party apps and consumer AI | Cures Act APIs | **MVP** |
| F29 | Education content (condition, procedure, discharge), reading-level adapted | MyChart, Healthwise-class | **MVP** (library); AI personalization later |
| F30 | Surgical/ED status updates for families | Various | Later (P1) |
| F31 | Advance care planning documents, organ donor, care preferences | MyChart | Later (P2) |
| F32 | Research recruitment / trial matching opt-in | MyChart | Later (P2) |

---

## 8. Clinician-facing mobile and productivity

**Benchmarks (AK unless cited):**

| Role / device | Epic | Oracle Health | Others |
|---|---|---|---|
| Physician phone | Haiku | PowerChart Touch/mobile | — |
| Tablet | Canto | — | — |
| Nurse / tech mobile (barcode med admin, specimen collection, vitals, photos, tasks) | Rover; nursing ambient integrates here [11] | CareAware | — |
| Secure chat | Epic Secure Chat | — | Vendor-neutral: TigerConnect, Vocera (Stryker), PerfectServe, Imprivata Cortext, Microsoft Teams |
| On-call scheduling | — | — | Amion, QGenda |
| Alarm management middleware (device alarms to phones) | — | — | Various |

**Capabilities a top-tier HMS should ship:**

1. **Unified mobile clinician app** (phone and tablet):
   - patient lists, results, notes, orders with sign;
   - in-basket;
   - photo and media capture into the chart;
   - barcode workflows;
   - dictation and ambient capture;
   - **AI chart summary** and "ask the chart" with citations.
2. **Clinical communication** built in:
   - patient-context-aware secure chat (conversation linked to the patient and care team);
   - role-based addressing ("Cardiology fellow on call"), driven by integrated on-call schedules;
   - escalation chains and read receipts;
   - critical-result closed-loop acknowledgment;
   - nurse-call and alarm routing.
3. **Paging replacement:** reliable delivery, priority levels, failover (pager or SMS fallback), quiet hours, and audit.
4. **Voice:** hands-free commands for nurses (documenting vitals, calling roles), dictation everywhere, ambient in all note types [11].
5. **Productivity telemetry** (Epic Signal-like):
   - time in EHR, notes and in-basket;
   - after-hours time;
   - message volumes per clinician.

   This is needed to measure AI ROI (the UCLA trial's primary endpoint used it [17]) and to manage burnout.
6. **Shared-device and security:** fast badge-tap or biometric login, MDM, offline-tolerant critical workflows (read-only downtime views), data-loss prevention.
7. **Team-based in-basket:** pools, delegation, AI pre-triage, standardized responses, and analytics on message burden.

---

## 9. Implications for our build (opinionated)

### 9.1 AI-native architecture choices

1. **Bitemporal append-only clinical journal with CDC to a sub-minute lakehouse.** Every AI feature needs current context. Nightly ETL (the Clarity pattern) is a structural handicap for summaries, early warning and operations agents. Design the data platform in §6.2 from day one. *(Reconciled 2026-10-16: this replaces "event-sourced clinical core", adopting `08` §3.5/§3.11 "event sourcing lite". The freshness requirement is met without full event sourcing.)*
2. **FHIR-first external/partner API (R4 now, R5/R6-ready), with SMART on FHIR v2 and CDS Hooks.** The same API serves partner AI, patient-access apps and third-party apps. Our own apps may use it or the domain APIs. Use FHIR Subscriptions or event webhooks for agents.

   **Cross-report note (reconciled 2026-10-16).** This item previously said "FHIR-first *internal* API". The pack's ADR-001 posture (`06` §7.1, `08` §3.11/§4.6, `11` §0) is a domain-owned PostgreSQL core: clinical facts are FHIR-shaped JSONB, and a generated FHIR R4 projection serves reads, `$export`, IPS and Subscriptions. Writes go through domain commands. `02`'s FHIR-native alternative (Medplum/HAPI JPA) is being tested in a spike. The AI requirements here (scoped APIs, Subscriptions, structured FHIR outputs) are met by the projection/façade.
3. **A grounding/context service** as a shared platform primitive. Given a patient, task and user, it returns a permission-filtered, source-cited context bundle (problems, meds, results, notes, transcripts). It enforces sensitive-data segmentation and break-the-glass rules. All GenAI features and partner models call it; none query the database directly.
4. **A model gateway (multi-model, multi-vendor).** It routes to frontier LLMs, specialty models, speech engines and our own ML, with:
   - region pinning (EU, India, KSA, US);
   - zero-retention contracts;
   - cost and latency budgets;
   - PHI redaction where possible;
   - version pinning;
   - fallback.

   Never hard-wire one LLM vendor.
5. **An AI Control Plane** (§5.3): registry, model cards, evaluation harness, monitoring, policy engine, provenance and kill switch. Ship it as product, not internal tooling. It is our answer to Joint Commission certification, HTI-1 and the EU AI Act, and it is a sales differentiator.
6. **A human-in-the-loop UX kit:** a single design system for AI drafts, citations, confidence, accept/edit/reject with reasons, and per-item order acceptance. Consistency reduces automation-complacency risk and training cost.
7. **Structured outputs over prose.** Ambient and summarization should produce problems, orders, codes, flowsheet rows and follow-ups as typed FHIR resources with source spans. Prose notes are just one rendering. This enables coding integrity, quality measures and analytics.
8. **Agent framework with guardrails:** tool scopes, approval steps for writes, simulation and sandbox modes, full action logs, and per-agent KPIs. Start with internal agents (RCM, access). Expose low-code agent building to customers only after the governance path is enforced in product (cf. Epic Agent Factory [5]).
9. **Telemetry by design:** capture time-in-note, edit distance, usage, overrides and downstream outcomes for every AI feature, so customers can prove ROI. PHTI and payers now demand outcomes [15].
10. **Regulatory partitioning:** keep device-grade functions (sepsis/deterioration alarms, image/signal analysis, patient-facing triage) in a separately versioned module under a medical-device QMS, or delegate them to cleared partners via standard integration. Never let them leak into the general platform [41].

### 9.2 What to ship first (sequencing)

**Phase 1: GA (P0).** Highest adoption pull, non-device, demonstrable value.

1. Ambient documentation (outpatient) via 2+ certified partners, with structured outputs, multilingual capture, consent workflow and telemetry.
2. Source-cited chart summary / pre-visit brief.
3. In-basket: AI triage and routing plus grounded draft replies (short, cited, with red-flag no-draft rules).
4. Patient-friendly results explanations (templated first, AI-drafted under review), alongside immediate-release rules.
5. Coding assistance (pro-fee/outpatient) with documentation–code concordance checks.
6. Prior-auth packet assembly for the launch markets' pre-authorization rails (NPHIES in KSA, NHCX/PM-JAY in India). *(Reconciled 2026-10-16: **Da Vinci CRD/DTR/PAS (US)** moved to the US go/no-go phase (Phase 3 in the pack roadmap, `06` §8). The launch sequence is Wave 1 India + KSA, then Wave 1b UAE.)*
7. Digital front door core (F1, F3–F9, F11–F14, F24–F28), including WhatsApp/SMS engagement and national-rail integration for each launch market. *(Reconciled 2026-10-16: `03` §2 now puts the OPD token queue and a basic patient app/WhatsApp/SMS with national rails in the clinical MVP for India/KSA. The full MyChart-class portal is P2. This is interim until the proposed requirements catalogue (report 14) is written.)*
8. AI Control Plane MUST items G1–G16.
9. Lakehouse with FHIR Bulk export, CQL measure engine, operational dashboards and self-service BI on a semantic layer.

**Phase 2: GA + 12 months (P1).**

- Inpatient/ED ambient and nursing ambient to flowsheets.
- Discharge summary and handoff drafts.
- CDI queries.
- Autonomous coding for radiology and ED.
- Denial and appeal agents.
- Capacity forecasting and LOS/discharge prediction.
- Partner-integrated FDA-cleared deterioration and sepsis scores with our response workflows and local validation.
- Imaging AI orchestration.
- Patient AI assistant (narrow scope).
- Voice/chat access agents.
- RPM and hospital-at-home modules.
- OMOP research tier.
- CHAI control map and ISO 42001.

**Phase 3 (P2).**

- Order suggestions from conversation.
- Customer low-code agents.
- Federated benchmarking network.
- Generative trajectory models (partner or research).
- Pathology AI integration.
- Wayfinding.
- Trial matching.

### 9.3 What to avoid

1. **Don't build your own speech recognition or foundation LLM.** These are commoditizing fast (Menlo: $600M ambient market with three players holding about 76% [12]; Epic going native [4]). Compete on context, workflow and governance.
2. **Don't ship black-box predictive alerts.** The ESM experience (AUROC 0.63, 67% missed, 18% alert rate [30]) poisoned clinician trust industry-wide. Every model ships with local validation tooling, silent mode and a model card.
3. **Don't inadvertently ship unregulated medical devices.** Sepsis and stroke alarms and vitals-based deterioration alerts are device functions under FDA's January 2026 guidance [41]. Partner or file. *(Reconciled 2026-10-16: v1's NEWS2/PEWS calculators and rule-based sepsis screening are scoped as described under §0 #8. They are transparent, non-interruptive for sepsis, regulated-module versioned and non-US first, with no device-stream alarms.)*
4. **Don't let AI auto-write to the legal record, auto-sign orders, or auto-message patients** without a governed autonomy policy and monitoring.
5. **Don't sell AI on "time saved" alone.** Evidence shows modest minutes [17][20] and stronger burnout and cognitive-load effects [19]. Promise measurable burden reduction, quality and revenue integrity, and instrument it.
6. **Don't ignore coding-intensity scrutiny.** Ship coding-integrity monitoring with ambient, or customers will face payer audits [16].
7. **Don't build a portal that ignores WhatsApp, SMS and national IDs** in India, the Middle East, Africa or Latin America.
8. **Don't use no-show or cost predictions to ration access** without equity audits [68][69].
9. **Don't lock analytics behind nightly ETL or a proprietary query language.** Expose open formats (Parquet/Delta/Iceberg), SQL, FHIR Bulk and OMOP.
10. **Don't treat governance as documentation.** If the registry, monitoring and event reporting aren't in the product, customers can't meet Joint Commission, HTI-1 or EU AI Act expectations, and we lose enterprise deals.

### 9.4 Positioning statement (for product strategy)

> *"The first HMS designed for AI from the data layer up: real-time, standards-native data (FHIR/OMOP/CQL), a governed AI control plane that makes Joint Commission/CHAI, HTI-1 and EU AI Act compliance a configuration rather than a project, best-of-breed AI partners plugged into one human-in-the-loop experience, and a channel-agnostic digital front door that meets patients on WhatsApp, national apps and the web."*

---

## 10. Sources

*Accessed during this session (16 Oct 2026) unless marked "not directly accessed." AK = analyst knowledge, cited for orientation.*

1. Healthcare IT News — "Epic unveils AI agents, showcases new foundational models" (Aug 2025). https://www.healthcareitnews.com/news/epic-unveils-ai-agents-showcases-new-foundational-models
2. CNBC — "Epic UGM 2025: Epic touts new AI tools" (20 Aug 2025). https://www.cnbc.com/2025/08/20/epic-ugm-2025-epic-touts-new-ai-tools.html
3. Healthcare IT Today — "A Deep Dive Into the Announcements at Epic UGM 2025" (21 Aug 2025) (CoMET, Cosmos AI Lab, MyChart Central). https://www.healthcareittoday.com/2025/08/21/a-deep-dive-into-the-announcements-at-epic-ugm-2025/
4. Fierce Healthcare — "Epic's AI scribe goes live as EHR giant touts strong adoption of built-in AI features" (Feb 2026) (85% customers live; Penny 200+ orgs, >20% fewer coding denials). Content via search summary; direct fetch blocked (403). https://www.fiercehealthcare.com/ai-and-machine-learning/epic-rolls-out-ai-charting-and-more-built-automation-clinicians-and
5. Digital Health Wire — "Blue Ribbons and AI Agents at Epic UGM" (24 Aug 2026) (Ergo, Agent Factory, Chart with Art 60+ orgs, Penny autonomous coding, Curiosity, real-time PA checks). https://digitalhealthwire.com/blue-ribbons-and-ai-agents-at-epic-ugm/
6. Epic — "Ochsner Health First to Use Epic's Ergo Visit" (Aug 2026). https://www.epic.com/epic/post/ochsner-health-first-to-use-epics-ergo-visit/
7. Epic — "AI Helps OLVG Clinicians Reduce Note-Writing Time By Over 30%" (2 Sep 2026) (pediatricians; −31% note-writing time; −27% total chart time). https://www.epic.com/epic/post/ai-helps-olvg-clinicians-reduce-note-writing-time-by-over-30/
8. Epic Newsroom (Aug–Oct 2026 posts: Emmie adoptions at Reid Health and Community Health Network; Memorial Hermann results-explanation tool; Agent Factory Build-A-Thon; Hello World outreach). https://www.epic.com/epic/newsroom
9. Epic — AI overview page ("Nurses Write Notes 85% Faster with Epic AI"; Art end-of-shift notes). https://www.epic.com/software/ai/
10. Epic Cosmos — homepage statistics (310M patients; 2,358 hospitals; 52.5K clinics; 250 publications). https://cosmos.epic.com/
11. Microsoft — Dragon Copilot product page (capabilities, availability, customer metrics). https://www.microsoft.com/en-us/health-solutions/clinical-workflow/dragon-copilot
12. Menlo Ventures — "2025: The State of AI in Healthcare" (spend, ambient market share, category sizes). https://menlovc.com/perspective/2025-the-state-of-ai-in-healthcare/
13. Peterson Health Technology Institute — "Adoption of Artificial Intelligence in Healthcare Delivery Systems: Early Applications and Impacts" (25 Mar 2025). https://www.phti.org/ai-adoption-early-applications-impacts/
14. PHTI — announcement "Leading Health Systems: AI-Powered Scribes Alleviate Clinician Burnout; Financial Impact Unclear" (Mar 2025); details via coverage (Fierce Healthcare, Healthcare Dive, Axios). https://www.phti.org/announcement/ai-scribes-reduce-clinician-burnout/
15. PHTI — "Driving Adoption of High-Value AI in Healthcare" (14 Oct 2026; page shows "Last updated October 15, 2026"; contains the quote "entrenches inefficient workflows and drives inflationary billing"). https://www.phti.org/research-insight/driving-adoption-of-high-value-ai-in-healthcare/
16. Becker's Hospital Review — "AI scribes, billing tools drive up healthcare costs: Report" (Oct 2026) (KLAS analysis: Level 5/4 +5%/+7%, ≈$1,004/provider/month). Content via search summary; direct fetch blocked again in pass 2 (403); provenance of figures uncertain, see [82][83]. https://www.beckershospitalreview.com/healthcare-information-technology/digital-health/ai-scribes-billing-tools-drive-up-healthcare-costs-report/
17. Lukac PJ, et al. "Ambient AI Scribes in Clinical Practice: A Randomized Trial." *NEJM AI* 2025;2(12). doi:10.1056/AIoa2501000. https://ai.nejm.org/doi/abs/10.1056/AIoa2501000 · PMC full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC12768499/
18. Afshar M, et al. "A Pragmatic Randomized Controlled Trial of Ambient Artificial Intelligence to Improve Health Practitioner Well-Being." *NEJM AI* 2025;2(12). doi:10.1056/AIoa2500945 (abstract verified via PubMed, PMID 41625485, in pass 2). https://ai.nejm.org/doi/full/10.1056/AIoa2500945
19. Olson KD, et al. "Use of Ambient AI Scribes to Reduce Administrative Burden and Professional Burnout." *JAMA Netw Open* 2025;8(10):e2534976. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2839542
20. Textbook of Digital Health (news, 18 May 2026) — summary of a *JAMA* five-AMC ambient scribe study (16 min/8 h; 27.3 min heavy users). Primary article identified in pass 2 as [71]. https://www.textbookofdigitalhealth.com/news/2026-05-18-jama-scribe-study.html
21. Tierney AA, et al. Kaiser Permanente ambient AI one-year evaluation. *NEJM Catalyst Innovations in Care Delivery* 2025 (title "Ambient Artificial Intelligence Scribes: Learnings after 1 Year and over 2.5 Million Uses", 16 Apr 2025, confirmed via Crossref; other figures AK). https://catalyst.nejm.org/doi/full/10.1056/CAT.25.0040
22. Garcia P, et al. "Artificial Intelligence–Generated Draft Replies to Patient Inbox Messages." *JAMA Netw Open* 2024;7(3):e243201. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2816494
23. Tai-Seale M, et al. "AI-Generated Draft Replies Integrated Into Health Records and Physicians' Electronic Communication." *JAMA Netw Open* 2024;7(4):e246565. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2817615
24. Chen S, et al. "The effect of using a large language model to respond to patient messages." *Lancet Digit Health* 2024;6(6):e379–e381 (full text verified via PMC11829255 in pass 2). https://doi.org/10.1016/S2589-7500(24)00060-8
25. Zaretsky J, et al. "Generative Artificial Intelligence to Transform Inpatient Discharge Summaries to Patient-Friendly Language and Format." *JAMA Netw Open* 2024;7(3):e240357. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2815868
26. Williams CYK, et al. "Physician- and Large Language Model–Generated Hospital Discharge Summaries." *JAMA Intern Med* 2025;185(7):818–825. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2833228
27. Van Veen D, et al. "Adapted large language models can outperform medical experts in clinical text summarization." *Nat Med* 2024;30:1134–1142 (abstract verified via PubMed, PMID 38413730, in pass 2). https://www.nature.com/articles/s41591-024-02855-5
28. Soroush A, et al. "Large Language Models Are Poor Medical Coders." *NEJM AI* 2024 (25 Apr 2024; citation confirmed via Crossref; figures AK). https://ai.nejm.org/doi/full/10.1056/AIdbp2300040
29. Asgari E, et al. "A framework to assess clinical safety and hallucination rates of LLMs for medical text summarisation." *npj Digit Med* 2025 (abstract verified via PubMed, PMID 40360677, in pass 2; authors were Tortus AI employees). https://www.nature.com/articles/s41746-025-01670-7
30. Wong A, et al. "External Validation of a Widely Implemented Proprietary Sepsis Prediction Model in Hospitalized Patients." *JAMA Intern Med* 2021;181(8):1065–1070. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2781307
31. Kamran F, et al. "Evaluation of Sepsis Prediction Models before Onset of Treatment." *NEJM AI* 2024 (22 Feb 2024; citation confirmed via Crossref; direct fetch blocked; figures AK). https://ai.nejm.org/doi/10.1056/AIoa2300032
32. Adams R, et al. "Prospective, multi-site study of patient outcomes after implementation of the TREWS machine learning-based early warning system for sepsis." *Nat Med* 2022;28:1455–1460 (abstract verified via PubMed, PMID 35864252, in pass 2). https://www.nature.com/articles/s41591-022-01894-0
33. Boussina A, et al. "Impact of a deep learning sepsis prediction model on quality of care and survival." *npj Digit Med* 2024;7:14 (abstract verified via PubMed, PMID 38263386, in pass 2). https://www.nature.com/articles/s41746-023-00986-6
34. Edelson DP, et al. "Early Warning Scores With and Without Artificial Intelligence." *JAMA Netw Open* 2024;7(10):e2438986. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2824885
35. Tomašev N, et al. "A clinically applicable approach to continuous prediction of future acute kidney injury." *Nature* 2019;572:116–119 (AK). https://www.nature.com/articles/s41586-019-1390-1
36. Lång K, et al. "Artificial intelligence-supported screen reading versus standard double reading in the Mammography Screening with Artificial Intelligence trial (MASAI)." *Lancet Oncol* 2023;24(8):936–944 (AK). https://doi.org/10.1016/S1470-2045(23)00298-X
37. U.S. FDA — "Artificial Intelligence-Enabled Medical Devices" list (latest decisions to 29 Jun 2026; foundation-model tagging statement). https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/list-artificial-intelligence-enabled-medical-devices
38. AuntMinnie — "Radiology drives July FDA AI-enabled medical device update" (Jul 2025). https://www.auntminnie.com/imaging-informatics/artificial-intelligence/article/15750598/radiology-drives-july-fda-aienabled-medical-device-update
39. AIMOCS — "FDA-cleared AI devices by year and specialty" tracker. https://aimocs.com/guides/fda-ai-enabled-device-list-statistics-tracker
40. IntuitionLabs — "FDA's AI Medical Device List: Stats, Trends & Regulation." https://intuitionlabs.ai/articles/fda-ai-medical-device-tracker
41. U.S. FDA — "Clinical Decision Support Software: Guidance for Industry and FDA Staff" (issued 29 Jan 2026; supersedes 6 Jan 2026; docket FDA-2017-D-6569). Full PDF parsed; re-parsed in pass 2 (PDF: https://www.fda.gov/media/109618/download). https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
42. U.S. FDA — "Marketing Submission Recommendations for a Predetermined Change Control Plan for AI-Enabled Device Software Functions" (final, Dec 2024) (AK). https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence
43. ASTP/ONC — HTI-1 Final Rule overview (algorithm transparency; effective 11 Mar 2024). https://www.healthit.gov/topic/laws-regulation-and-policy/health-data-technology-and-interoperability-certification-program
44. ASTP/ONC — Certification of Health IT page (HTI-4 overview; DSI resource guide). https://www.healthit.gov/topic/certification-ehrs/certification-health-it
45. CHAI — "Joint Commission and Coalition for Health AI (CHAI) Release Initial Guidance" (RUAIH, 17 Sep 2025). https://www.chai.org/news/joint-commission-and-coalition-for-health-ai-chai-release-initial-guidance
46. CHAI — "CHAI Releases Comprehensive Governance Playbooks" (27 May 2026). https://www.chai.org/news/coalition-for-health-ai-chai-releases-comprehensive-governance-playbooks-to
47. CHAI — AI Intake Playbook and Common Intake Controls (1 Oct 2026); homepage (Applied Model Card, registry, work groups incl. Ambient AI testing framework, Agentic AI). https://www.chai.org/news/coalition-for-health-ai-chai-releases-ai-intake-playbook-and-common-intake · https://www.chai.org/
48. EU AI Act — Implementation Timeline (updated 31 Aug 2026; high-risk Annex III 2 Dec 2027; Annex I 2 Aug 2028). https://artificialintelligenceact.eu/implementation-timeline/
49. European Commission — European Health Data Space Regulation (EHDS) page. https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en
50. NIST — AI Risk Management Framework (AI RMF 1.0) (AK). https://www.nist.gov/itl/ai-risk-management-framework
51. NIST — AI 600-1, Generative AI Profile (Jul 2024) (AK). https://doi.org/10.6028/NIST.AI.600-1
52. ISO — ISO/IEC 42001:2023 Artificial intelligence — Management system (AK). https://www.iso.org/standard/81230.html
53. HHS — Nondiscrimination in Health Programs and Activities (Section 1557) Final Rule, 89 FR 37522 (6 May 2024), incl. 45 CFR 92.210 (text and compliance date verified via eCFR in pass 2; see also [81]). https://www.federalregister.gov/documents/2024/05/06/2024-08711/nondiscrimination-in-health-programs-and-activities
54. ASTP/ONC — Data Brief No. 77: "Individuals' Access and Use of Patient Portals and Smartphone Health Apps, 2024" (Jul 2025). https://www.healthit.gov/data/data-briefs/individuals-access-and-use-patient-portals-and-smartphone-health-apps-2024
55. Steitz BD, et al. "Perspectives of Patients About Immediate Access to Test Results Through an Online Patient Portal." *JAMA Netw Open* 2023;6(3):e233572. https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2802672
56. Hospital at Home Users Group — News headlines (waiver lapse Oct 2025, restoration Nov 2025, five-year extension in the spending package signed 3 Feb 2026, to 2030) and homepage (National Hospital at Home Quality Registry). https://www.hahusersgroup.org/news/ · https://www.hahusersgroup.org/
57. Levine DM, et al. "Hospital-Level Care at Home for Acutely Ill Adults: A Randomized Controlled Trial." *Ann Intern Med* 2020;172(2):77–85 (abstract verified via PubMed, PMID 31842232, in pass 2). https://www.acpjournals.org/doi/10.7326/M19-0600
58. CMS Innovation Center — ACCESS Model (began 5 Jul 2026; outcome-aligned payments). https://www.cms.gov/priorities/innovation/innovation-models/access
59. CMS Innovation Center — WISeR Model (1 Jan 2026 – 31 Dec 2031; AI-assisted prior authorization in 6 states). https://www.cms.gov/priorities/innovation/innovation-models/wiser
60. CMS — Health Technology Ecosystem. https://www.cms.gov/health-technology-ecosystem
61. CMS — Interoperability and Prior Authorization Final Rule (CMS-0057-F). https://www.cms.gov/priorities/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f
62. OHDSI — Data Standardization (OMOP CDM, standardized vocabularies). https://www.ohdsi.org/data-standardization/
63. Truveta — homepage (140M+ patients; daily updates; health-system count not stated on the page as of pass 2). https://www.truveta.com/
64. Abridge — Press page (VA enterprise contract, UT System, WashU/BJC, inpatient CDI/coding, nursing product). https://www.abridge.com/press
65. HL7 — FHIR Bulk Data Access Implementation Guide (AK). https://hl7.org/fhir/uv/bulkdata/
66. HHS OCR — Guidance Regarding Methods for De-identification of PHI (Safe Harbor; Expert Determination) (direct fetch blocked; AK). https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html
67. Epic — "seismometer" open-source AI model validation tool (AK). https://github.com/epic-open-source/seismometer
68. Samorani M, et al. "Overbooked and Overlooked: Machine Learning and Racial Bias in Medical Appointment Scheduling." *Manufacturing & Service Operations Management* 2022 (AK). https://doi.org/10.1287/msom.2021.0999
69. Obermeyer Z, et al. "Dissecting racial bias in an algorithm used to manage the health of populations." *Science* 2019;366:447–453 (AK). https://www.science.org/doi/10.1126/science.aax2342
70. NHS England — "Guidance on the use of AI-enabled ambient scribing products in health and care settings" (Apr 2025) (page did not render in fetch; AK). https://www.england.nhs.uk/long-read/guidance-on-the-use-of-ai-enabled-ambient-scribing-products-in-health-and-care-settings/

*Sources added in pass 2 (16 Oct 2026):*

71. Rotenstein LS, et al. "Changes in Clinician Time Expenditure and Visit Quantity With Adoption of Artificial Intelligence-Powered Scribes: A Multisite Study." *JAMA* 2026;335(16):1408–1417. doi:10.1001/jama.2026.2253 (PubMed abstract, PMID 41920565). https://pubmed.ncbi.nlm.nih.gov/41920565/
72. U.S. FDA — AI-Enabled Medical Devices list, CSV download (1,614 rows; final decisions 29 Sep 1995 – 29 Jun 2026), counted directly in pass 2. https://www.fda.gov/media/178541/download
73. Federal Register — "Health Data, Technology, and Interoperability: ASTP/ONC Deregulatory Actions To Unleash Prosperity" (HTI-5) proposed rule, doc. 2025-23896, 29 Dec 2025 (90 FR 60970). ASTP/ONC HTI-5 page (22 Dec 2025: "remove 34 and revise seven" criteria; "fully remove the artificial intelligence (AI) 'model card' requirements"). A Federal Register API query on 16 Oct 2026 returned no HTI-5 final rule. https://www.federalregister.gov/d/2025-23896 · https://healthit.gov/resources/health-data-technology-and-interoperability-astp-onc-deregulatory-actions-to-unleash-prosperity-hti-5-proposed-rule/
74. Federal Register — FY 2026 IPPS/LTCH PPS final rule, doc. 2025-14681, 90 FR 36536 (4 Aug 2025; effective 1 Oct 2025), which "finalizes certain updates to the ONC Health IT Certification Program" (HTI-4). https://www.federalregister.gov/d/2025-14681
75. Joint Commission — "Joint Commission Releases First of Its Kind … Voluntary Responsible Use of AI in Healthcare Certification" (1 Jun 2026). Direct fetch blocked (403); launch date and focus areas via search results and Hooper Lundy, "Joint Commission Launches AI Governance Certification for Health Care" (12 Jun 2026). https://www.jointcommission.org/en-us/knowledge-library/news/2026-05-responsible-use-of-ai-in-healthcare-certification · https://hooperlundy.com/joint-commission-launches-ai-governance-certification-for-health-care/
76. Regulation (EU) 2026/1744 (Digital Omnibus on AI) amending Regulation (EU) 2024/1689. The EUR-Lex page did not render. Content via Orrick, "EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes" (29 Jul 2026), and Gibson Dunn, "EU AI Act Omnibus Agreement" (2026; written before formal adoption). OJ publication and entry-into-force dates come from search results. https://eur-lex.europa.eu/eli/reg/2026/1744/oj · https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes · https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/
77. Colorado General Assembly — SB26-189 "Automated Decision-Making Technology" (repeals and re-enacts SB24-205; Governor signed 14 May 2026). https://leg.colorado.gov/bills/sb26-189
78. Texas Legislature — HB 149 (89R), Texas Responsible Artificial Intelligence Governance Act, enrolled text (Bus. & Com. Code §552.051(f); effective 1 Jan 2026). https://capitol.texas.gov/tlodocs/89R/billtext/html/HB00149F.htm
79. HHS — Interim final rule "Extension of Compliance Dates for Nondiscrimination on the Basis of Disability; Accessibility of Web Content and Mobile Applications…", 91 FR 25496 (11 May 2026; effective 7 May 2026). https://www.federalregister.gov/documents/2026/05/11/2026-09266/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web
80. AMA — "Feb. 6, 2026: National Advocacy Update" (Consolidated Appropriations Act, 2026, H.R. 7148: §6209 telehealth through 31 Dec 2027; §6210 AHCaH waiver five years through 2030). The 30 Sep 2030 end date and 3 Feb 2026 signing come from law-firm summaries (e.g. Baker Donelson) in search results. https://www.ama-assn.org/health-care-advocacy/advocacy-update/feb-6-2026-national-advocacy-update · https://www.bakerdonelson.com/medicare-telehealth-waivers-extended-for-several-more-years
81. HHS — "Notice of Vacatur Regarding Certain Provisions of the 2024 Nondiscrimination in Health Programs and Activities Final Rule", 91 FR 32887 (2 Jun 2026); eCFR 45 CFR 92.1 and 92.210 (as of Sep 2026). https://www.federalregister.gov/documents/2026/06/02/2026-11015/notice-of-vacatur-regarding-certain-provisions-of-the-2024-nondiscrimination-in-health-programs-and · https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-92
82. HIT Consultant — "PHTI Releases Landmark Framework to Scale High-Value Clinical AI Over Administrative Waste" (14 Oct 2026). https://hitconsultant.net/2026/10/14/phti-report-driving-adoption-high-value-ai-healthcare-caroline-pearson-roadmap-payment-reform/
83. McLeod Health. "Selecting, Scaling, and Measuring the Value of Ambient AI in a Nonacademic Health System: Multiphase Pilot Study." *JMIR Med Inform* 2026. doi:10.2196/87450 (PubMed PMID 42361272). https://pubmed.ncbi.nlm.nih.gov/42361272/
84. Hernström V, Lång K, et al. "Screening performance and characteristics of breast cancer detected in the MASAI trial." *Lancet Digit Health* 2025 (3 Feb 2025). doi:10.1016/S2589-7500(24)00267-X (Europe PMC abstract; author list AK). https://doi.org/10.1016/S2589-7500(24)00267-X
85. "Interval cancer, sensitivity, and specificity comparing AI-supported mammography screening with standard double reading without AI in the MASAI study." *Lancet* 2026. doi:10.1016/S0140-6736(25)02464-X (Europe PMC abstract). https://doi.org/10.1016/S0140-6736(25)02464-X
86. U.S. FDA — De Novo DEN230036, Sepsis ImmunoScore (Prenosis, Inc.), granted 2 Apr 2024. https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=DEN230036
87. TechTarget — "Epic's AI Charting goes live" (5 Feb 2026) (rollout announced Wednesday 4 Feb 2026; at least 7 orgs live; Penny 200+ orgs, coding-related denials −20%). https://www.techtarget.com/searchhealthit/news/366638795/Epics-AI-Charting-goes-live
88. Federal Register — CMS proposed rule "Interoperability Standards and Prior Authorization for Drugs for Medicare Advantage Organizations, Medicaid Managed Care Plans, State Medicaid Agencies, CHIP … and Issuers of QHPs on the FFEs", 91 FR 19890 (14 Apr 2026; comments closed 15 Jun 2026). https://www.federalregister.gov/documents/2026/04/14/2026-07205/medicare-and-medicaid-programs-patient-protection-and-affordable-care-act-interoperability-standards
89. Escobar GJ, et al. "Automated Identification of Adults at Risk for In-Hospital Clinical Deterioration." *N Engl J Med* 2020;383(20):1951–1960. doi:10.1056/NEJMsa2001090 (PubMed PMID 33176085). https://pubmed.ncbi.nlm.nih.gov/33176085/
90. Waxler S. et al., "Generative Medical Event Models Improve with Scale," arXiv:2508.12104 (v1 16 Aug 2025; v3 7 Nov 2025 names the models "Curiosity"; pretrained on 118M patients, 115B events / 151B tokens). Fetched 16 Oct 2026 during reconciliation. https://arxiv.org/abs/2508.12104
91. Companion reports used in the 2026-10-16 reconciliation: `01` §2.2, `03` §2/§21, `06` §7.1 and §8, `07` §9.1/§9.4, `08` §1 #14, §3.5, §3.11, §4.6, `11` §0; see `RECONCILIATION-LOG.md`.

---

*Research limitations:*

- The shared web-search quota ran out after 6 searches. I did the remaining verification by fetching known primary URLs directly. Several publisher sites blocked automated access: NEJM AI/Catalyst, Nature, Lancet, PubMed, Oracle, Joint Commission, NHS Digital, ABDM.
- Figures from those sources are marked (AK) and should be re-verified before external publication. This applies especially to:
  - ~~current Medicare telehealth flexibility end dates~~ (resolved in pass 2: through 31 Dec 2027 [80]);
  - ONC/ASTP deregulatory (HTI-5) changes to DSI requirements (pass 2: still only proposed; no final rule in the Federal Register as of 16 Oct 2026 [73]; re-check before publication);
  - national-app user counts (NHS App, ABHA, Sehhaty);
  - ambient pricing;
  - the provenance of the "Level 5 +5% / Level 4 +7% / $1,004" coding-intensity figures [16][82][83].

---

## Verification log (pass 2, 2026-10-16)

*Scope: about 50 claims, prioritizing items tagged AK, regulatory dates and status, market numbers and vendor launch status. "Confirmed (secondary)" means a reputable secondary source was read directly but the primary was blocked. Seven WebSearch calls were used; everything else was direct fetches of primary or official URLs and APIs (FDA, Federal Register, eCFR, PubMed/Europe PMC, Crossref).*

| Claim | Verdict | Source | Note |
|---|---|---|---|
| FDA CDS guidance issued 29 Jan 2026, superseding 6 Jan 2026 | Confirmed (nuanced) | [41] (PDF cover and guidance-history table) | The 29 Jan version is a Level 2 "minor correction on p.13 & 14"; the substantive policy dates from 6 Jan 2026. Docket FDA-2017-D-6569 |
| CDS guidance: sepsis/stroke alarm = device; Example 24 (hourly SpO₂/HR deterioration alert) = device; 24-h CV-risk variant = device; "only one option" enforcement discretion; automation bias weighed under Criterion 4; no generative-AI references | Confirmed | [41] | Text quoted from the parsed PDF; zero matches for "generative"/"language model" |
| FDA AI-enabled device list: about 1,614 through 29 Jun 2026, about 76% radiology (third-party counts) | Confirmed (upgraded) | [72] FDA CSV | Direct count: 1,614 rows; radiology 1,230 (76.2%); cardiovascular 154; neurology 73; 510(k) 96.2%, De Novo 2.5%, PMA 1.3% |
| End-2025 FDA list total 1,430–1,451 | Confirmed (range) | [39][40][72] | The current FDA file holds 1,433 entries dated on or before 31 Dec 2025; the list is revised retroactively |
| EU AI Act high-risk dates: Annex III 2 Dec 2027; Annex I 2 Aug 2028 | Confirmed (status strengthened) | [48][76] | Now law via Regulation (EU) 2026/1744 (OJ 24 Jul 2026, per secondary sources; EUR-Lex did not render). Fixed dates, not standards-linked |
| EU AI Act Art. 4 AI literacy "is a legal duty" | Corrected (nuance) | [76] | Omnibus softened it to providers/deployers having to *support* staff AI literacy; final wording not read directly |
| EU AI Act Art. 50 transparency from 2 Aug 2026 | Confirmed; detail added | [48][76] | Art. 50(2) marking grace period to 2 Dec 2026 for systems already on the market |
| Joint Commission voluntary AI certification is "forthcoming" | **Corrected** | [75] | RUAIH certification launched 1 Jun 2026; five focus areas; certifies organizations, not products |
| Joint Commission–CHAI RUAIH guidance released 17 Sep 2025 | Confirmed | [45] | Seven-element list still AK (Joint Commission site returns 403) |
| CHAI governance playbooks, 27 May 2026, 8 named domains, framework for JC certification | Confirmed | [46] | Domain names match exactly |
| CHAI AI Intake Playbook + Common Intake Controls, 1 Oct 2026 | Confirmed; detail added | [47] | Draft: 57 controls in 11 domains, from 800+ questions; about 40% attestable by the vendor; in pilot |
| HTI-1 final rule effective 11 Mar 2024 | Confirmed | [43] | 31 predictive source attributes corroborated via HTI-5 coverage; "13 evidence-based" remains AK |
| ONC/ASTP deregulatory (HTI-5) changes to DSI | **Corrected / updated** | [73] | Proposed rule 90 FR 60970 (29 Dec 2025): remove 34 of 60 criteria and the AI "model card" requirements. Comments closed 27 Feb 2026. **No final rule** in the Federal Register API as of 16 Oct 2026 |
| HTI-4 (2025) adds e-prior-auth certification criteria | Confirmed (vehicle clarified) | [74] | Finalized inside the FY 2026 IPPS final rule (90 FR 36536, 4 Aug 2025; effective 1 Oct 2025); criterion-level detail AK |
| CMS-0057-F: some provisions 1 Jan 2026; APIs "primarily January 1, 2027" | Confirmed | [61] | Also added the 14 Apr 2026 proposed rule extending PA/API requirements to drugs [88] |
| WISeR: 1 Jan 2026 – 31 Dec 2031; NJ, OH, OK, TX, AZ, WA | Confirmed | [59] | — |
| ACCESS model from 5 Jul 2026; tracks "hypertension, diabetes, MSK pain, depression"; HF/COPD from Apr 2027 | Corrected (track list) | [58] | 10-year model; four tracks (eCKM, CKM, MSK, behavioral health incl. anxiety); HF and COPD from 1 Apr 2027 |
| Hospital-at-home waiver extended five years to 2030 (law signed 3 Feb 2026) | Confirmed; precision added | [56][80] | §6210 CAA 2026; end date 30 Sep 2030 (law-firm summaries) |
| Medicare telehealth flexibilities "extended … verify current end date" | **Corrected / resolved** | [80] | §6209: through 31 Dec 2027; 43-day lapse in the 2025 shutdown |
| Colorado AI Act "delayed to mid-2026" | **Refuted / corrected** | [77] | SB 24-205 never took effect; repealed and re-enacted by SB 26-189 (signed 14 May 2026) as an ADMT transparency law, mainly from 1 Jan 2027 |
| Texas TRAIGA: AI disclosure in health care from 2026 | Confirmed | [78] | Bus. & Com. Code §552.051(f); effective 1 Jan 2026; emergency exception |
| HHS Section 504 web/app accessibility (WCAG 2.1 AA) compliance dates 2026–27 | **Corrected** | [79] | IFR of 11 May 2026: now 11 May 2027 (15+ employees) and 10 May 2028 (<15) |
| §1557 / 45 CFR 92.210 compliance from May 2025 | Confirmed | [81] eCFR | "Within 300 days of July 5, 2024" = 1 May 2025; the 2025 partial vacatur did not affect §92.210 |
| EHDS: in force 26 Mar 2025; Mar 2029 / Mar 2031 milestones | Confirmed | [49] | Genomic and other remaining secondary-use categories from Mar 2031 |
| Epic Cosmos: 310M patients, 2,358 hospitals, 52.5K clinics, 250 publications | Confirmed | [10] | — |
| Truveta: 140M+ patients, daily refresh, about 30 health systems | Partly confirmed | [63] | 140M+ and daily refresh confirmed; member count not on the page (now AK) |
| Menlo 2025: $600M ambient (2.4×); Microsoft 33% / Abridge 30% / Ambience 13%; coding $450M; PA $100M+ (10×); engagement $100M+ (20×) | Confirmed | [12] | Also total $1.4B GenAI spend. Menlo does not give a scribe-vendor count (the "about 60" figure is from PHTI [14]) |
| Epic UGM 2026: 84 tools; Chart with Art 60+ orgs and 70+ specialties; 120+ features; Penny autonomous radiology and ED coding; PA checks at 4 systems with 19 payers; Curiosity 320M patients / 23B encounters, March 2027 | Confirmed (secondary) | [5] | Ergo has "a November ship date" with no year stated; leadership departures and FTC probe are reported, not confirmed |
| Epic AI Charting GA Feb 2026; 85% of customers live on GenAI; Penny 200+ orgs, >20% fewer coding denials | Confirmed (secondary) | [87] | Rollout 4 Feb 2026, at least 7 orgs live. TechTarget says "20%" (not ">20%"). The 85% figure is via Fierce (search summary; Fierce blocked) |
| Ergo Visit live at Ochsner since 3 Aug 2026 | Confirmed | [6] | Pilot with four clinicians |
| OLVG: −31% note-writing time; chart time 17 → 12 min | Confirmed; clarified | [7] | Pediatricians; total chart time −27%; "early" results |
| Abridge: VA enterprise contract, UT System deal, WashU/BJC 4,000 clinicians, inpatient CDI | Confirmed (dates added) | [64] | 22 Sep, 8 Oct, 2 Sep and 14 Sep 2026; nursing product has no dated release |
| Dragon Copilot availability (10 countries for physicians; nursing US only); Intermountain 2,500+ users, −27%; Brown 24+ agents | Confirmed | [11] | Vendor claims |
| *JAMA* 2026 five-AMC scribe study: 16 min/8 h; 13.4 min EHR; 27.3 min for heavy users | Confirmed (primary located) | [71] | Rotenstein et al.; difference-in-differences cohort of 8,581 clinicians; +0.49 visits/week; no after-hours change. The 27.3-min figure comes from secondary coverage only |
| UCLA RCT (Lukac): 238 physicians, Nabla −9.5% (CI −17.2 to −1.8), DAX −1.7% NS, 1 grade-1 AE | Confirmed | [17] (PMC) | Usage 33.5% (DAX) and 29.5% (Nabla) of visits; about 72,369 encounters |
| Olson: burnout 51.9% → 38.8%, aOR 0.26, 263 clinicians, 6 systems | Confirmed | [19] | 263 analyzed of 451 enrolled |
| Afshar *NEJM AI* 2025 (details AK) | Confirmed (details added) | [18] PubMed | Stepped-wedge RCT, 66 practitioners; work exhaustion −0.44; notes −0.36 h/day |
| Chen *Lancet Digit Health* 2024: about 7% severe-harm risk (AK) | Confirmed | [24] PMC | 11/156 (7.1%) severe harm; 1 (0.6%) death; cancer-patient scenarios |
| Van Veen *Nat Med* 2024: 45% equivalent / 36% superior (AK) | Confirmed | [27] PubMed | 10-physician reader study |
| Asgari *npj Digit Med* 2025: hallucination about 1.5%, omission about 3.5% (AK) | Confirmed | [29] PubMed | 1.47% / 3.45%; vendor-employed authors; "major" share still AK |
| TREWS: 3.3-point absolute, 18.7% relative mortality reduction (AK) | Confirmed | [32] PubMed | 590,736 monitored; observational |
| COMPOSER: about 17% relative sepsis-mortality reduction (AK) | Confirmed | [33] PubMed | 1.9-point absolute; bundle compliance +5.0 points |
| Kaiser AAM: 19 hospitals, lower 30-day mortality (AK) | Confirmed | [89] | aRR 0.84 (0.78–0.90) |
| Levine home-hospital RCT: about 38% lower cost, fewer readmissions (AK) | Confirmed | [57] PubMed | 38% (24–49%); readmissions 7% vs 23% |
| MASAI: later publications reported higher detection (AK) | Confirmed; updated | [84][85] | +29% detection (2025); non-inferior interval cancers, sensitivity 80.5% vs 73.8% (*Lancet* 2026) |
| Prenosis Sepsis ImmunoScore De Novo 2024 (AK) | Confirmed | [86] | DEN230036, 2 Apr 2024 |
| Edelson 2024 deterioration-score AUROCs and PPVs | Confirmed | [34] (Europe PMC abstract) | PPVs matched at NEWS ≥5 sensitivity; exact "51%" not verified |
| Tai-Seale 2024 design: 52 PCPs + 70 controls | Confirmed | [23] | Randomized waiting-list QI: 25 immediate, 27 delayed |
| ONC Data Brief 77 portal figures | Confirmed | [54] | All table values match |
| Hospital at Home Quality Registry: 46 hospitals, 18 systems, 39,000+ patients (Jan 2026) | Confirmed | [56] | — |
| KLAS: established-patient Level 4/5 +7%/+5%, $1,004/provider/month | Still unverified (provenance) | [16][82][83] | HIT Consultant attributes it to PHTI-cited "implementations"; a similar $1,004 reportedly appears in a KLAS-validated Suki brief as *net* gain (search results only); McLeod peer-reviewed study shows L4 +3.8% |
| Kamran 2024 (ESM near chance pre-treatment) and Soroush 2024 (GPT-4 coding exact-match) figures | Still unverified | Crossref | Citations, dates and authors confirmed; NEJM AI blocked, so figures remain AK |
| NHS England ambient-scribing guidance (Apr 2025; MHRA Class I likely) | Still unverified | [70] | Page blocked by bot challenge |
| California AB 3030 disclaimer rule (effective 2025) | Still unverified | — | leginfo returned 403; remains AK |
| CMS Health Technology Ecosystem pledges ("kill the clipboard", conversational assistants) | Partly confirmed | [60] | The CMS page confirms Medicare.gov modern identity and the National Provider Directory; the slogans are not on the page |
