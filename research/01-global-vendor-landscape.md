# 01 — Global Commercial Vendor Landscape for Hospital Information Systems (HIS/EHR + Hospital ERP)

**Track:** Global commercial vendor landscape, market data, business models
**As of:** 16 October 2026
**Author role:** Senior health-IT market research analyst
**Audience:** Product, architecture and go-to-market leads for our Hospital Management System (HMS) build

---

## How to read this document

- **Citations** are inline as `[n]` and point to the numbered Sources list at the end.
- **Confidence labels:**
  - Plain cited statements come from sources fetched or searched in this research cycle (2024–2026 material).
  - **[E]** marks an estimate, either from an analyst firm or derived by me, with the derivation shown.
  - **[U]** marks background analyst knowledge that I could not re-verify in this session. Treat it as a hypothesis to confirm before relying on it externally.
- **Research constraints:** The shared web-search quota ran out partway through this research. After that point I relied on direct fetches of primary pages. KLAS full datasets are paywalled, so KLAS figures come from public abstracts and trade-press coverage. Several trade sites (Becker's, Healthcare IT News, Fierce) blocked direct fetches, so their content is taken from search-result extracts. Gaps are flagged where they matter.
- **Verification pass 2 (16 October 2026):** About 40 claims were re-checked against primary or cited sources. Corrections are marked "Correction (pass 2)" in the text, new sources are numbered [160]–[174], and the full results are in the verification log at the end.

---

## 1. Executive summary

1. **Epic now holds the US acute-care market.** At the end of 2025 Epic had **43.7% of US acute-care hospitals and 56.9% of beds**. Oracle Health had 21.9% / 20.4% and MEDITECH 14.7% / 12.5% (KLAS, May 2026) [1][2][4]. Definitive Healthcare's methodology gives similar results (Epic 43.9% in April 2026) [7]. Epic has a **net gain of 568 hospitals since 2021**, while Oracle Health has a **net loss of 173** [1][4].
2. **US EHR buying has collapsed.** The number of hospitals affected by EHR purchase decisions fell **about 40% versus 2024 and about 50% versus 2023** [1][2]. Budgets are moving to AI and efficiency tools. Epic was the **only vendor chosen by large (>10-hospital) systems** in 2025 [2].
3. **Oracle Health is mid-transition and losing customers.** It lost a net 56 hospitals in 2025, its third straight year as the biggest loser, and "all but three" went to Epic [1][4]. About **30% of sampled Oracle customers say Oracle is not in their long-term plans** [1]. Its new OCI-native, "voice-first" AI EHR is **ambulatory-only** (ONC-certified November 2025). Acute care was promised for 2026 but was still unreleased as of August 2026 [15][17][18]. KLAS calls the new EHR a "pivotal proofpoint" [1].
4. **The VA program is back on track for now.** The VA restarted its Oracle EHR rollout in 2026: Michigan in April, Ohio/Kentucky in June and Indiana in August, which puts **11 of 13 planned 2026 sites** live by late August. The last two 2026 sites, **Anchorage and Cleveland, are scheduled for 24 October 2026**, and the VA schedule lists **26 sites for 2027** [161]. Trade press cites a lifecycle cost estimate of about **US$37B**, described as "a recent cost estimate provided to lawmakers." The VA says full deployment could come "as early as 2031" [22][23][24][25][26].
5. **Epic's moat now comes from AI and data network effects.** At UGM 2025 Epic introduced **Art (clinician), Emmie (patient) and Penny (revenue cycle)** agents and said it has about 200 AI features in development. It also announced **CoMET** medical-event foundation models, pretrained on 118M patients and about **115B discrete medical events (151B tokens)** [8][9][10][160]. A later, larger generation, **"Cosmos Curiosity"**, was presented at UGM 2026: trained on **320M patients and 23B encounters**, with in-EHR release planned for March 2027 [175]. *(Reconciled 2026-10-16: these are two model generations; see `09` §0 #11.)* **Cosmos** now covers **310M patients, 2,358 hospitals and 52.5K clinics** [12].
6. **MEDITECH is a credible #3 and the community-hospital specialist.** In 2025, **84% of deciding legacy MEDITECH customers chose Expanse**, up from 30% in 2023 [2]. HCA has 72 hospitals live on Expanse across its US and UK networks [35][172]. MEDITECH-as-a-Service (MaaS) runs on Google Cloud, and MEDITECH reports **more than 260 licensed MaaS customers** (February 2026) [34][35]. MEDITECH won Best in KLAS for small hospitals (77.1) [31].
7. **Global buying fell sharply, and local vendors won most of it.** KLAS says the number of purchasing *decisions* fell to an almost five-year low. The volume of *hospitals and beds* involved was the lowest KLAS has tracked in at least a decade: **447 hospitals and 81,261 beds** outside the US in 2025 [45][46][171]. **Local and regional vendors won 66% of hospital wins**, against 34% for multiregional mega-vendors [46]. Epic's international growth runs almost entirely through **Community Connect** (7 contracts, 34 hospitals) [46].
8. **Europe has a structural replacement wave.** SAP's IS-H exit (mainstream maintenance to 2027, extended to 2030) affects **more than 500 DACH hospitals** [49][50]. Dedalus (about €460M DACH revenue, 850 German ORBIS sites), CGM (about 20% German share), Nexus, Meierhofer, Mesalvo and AMC are competing for that wave. So are newcomers **Epic**, which won the €200M Charité deal [61][63], and **Avelios**, a cloud/AI-native startup backed by Sequoia, SAP and Fresenius [53][59][60].
9. **Big-bang monolith projects keep failing in public European systems.** Sweden's Västra Götaland region **scrapped Oracle Millennium**. It spent about SEK 3.8B, paid a SEK 657M exit fee, and is now pursuing a **modular** strategy [83][84]. Norway's Epic-based Helseplattformen ran two years late, with 78% of doctors dissatisfied [75][76]. Denmark and Finland had similar problems [74]. European buyers increasingly want **modularity, sovereignty and EU-hosted support** [53][79].
10. **The UK market is consolidating.** Oracle Health leads with about 25% share. System C is second, Epic is at **9.7% (+3.5 pts)** with about 18 trusts, and Nervecentre is rising [71][72]. By May 2025, **94% of NHS acute trusts had an EPR**, so the market is now about replacement and convergence [71].
11. **The Middle East is the most active greenfield and brownfield market.** Saudi Arabia is restructuring delivery into 20 health clusters [88]. IQVIA won multiple MoH cluster decisions in 2025 [45], and Oracle Health won multi-hospital groups in Saudi Arabia and the UAE [46]. Buyers require **NPHIES/SeHE interoperability and in-country delivery capacity**, and vendors without these "may be eliminated" [88].
12. **APAC splits between national platforms and domestic champions.** InterSystems TrakCare won Best in KLAS in **Asia, Oceania and France** [31]. Singapore (NGEMR) and NSW (SDPR, about A$969M) chose Epic. NSW **phased and scaled back** its next rollout tranche in August 2026 [132][135]. China's vendors are in a downturn (Winning Health 2025 revenue −24%, net loss ¥374M) [114]. Japan is building a **government standard cloud EMR** [123]. India is highly fragmented, with local vendors holding about 70% [125].
13. **Latin America is MV's region.** MV runs **894 hospitals** in LatAm, Philips Tasy about 500 [138]. Philips sold Tasy to Bionexo (Brazil) for about **€161M**, announced 30 December 2025 as ≈R$1.05B. The deal closed after CADE approval and was announced complete on 4 May 2026. Exame put the price at R$940M at closing, a difference that looks like FX movement [139][140][164].
14. **Africa is mostly government-mandated, often open-source national platforms.** Examples are Kenya's **Taifa Care**, mandatory for SHA claims at Level 4 public hospitals since 29 June 2026 [149][150], and Rwanda's e-Ubuzima [151]. Ghana is a warning case: its vendor-run national EHR, LHIMS, was **discontinued** after the contract expired in December 2024 and is being replaced by the state-owned **GHIMS** [154]. Private groups build on licensed European engines, such as Netcare CareOn on Deutsche Telekom iMedOne [146][147].
15. **Market-size estimates are unreliable.** The global EHR market is about **US$28–37B in 2025** at a **5–8% CAGR** [155][156]. "HIS" estimates range from about $30B to $185B because analysts define the scope differently [157][158]. The best opportunity for a new entrant is **mid-size and emerging-market hospitals**. They need an affordable, cloud-native, modular HIS+ERP with deep local payer and regulatory integration, fast implementations and native AI. Epic is too expensive for them and most local incumbents are technically dated.

---

## 2. United States

### 2.1 Market share snapshot

| Vendor | KLAS: % of acute hospitals (end-2025) | KLAS: % of beds | Definitive HC: % of hospital installs (Apr 2026) | 2025 trend |
|---|---|---|---|---|
| Epic | 43.7% [1][4] | 56.9% | 43.9% [7] | +77 hospitals / +18,679 beds; only vendor chosen by >10-hospital systems [2] |
| Oracle Health (Cerner) | 21.9% | 20.4% | 18.9% | −56 hospitals / −14,676 beds; third straight year of largest net loss [2] |
| MEDITECH | 14.7% | 12.5% | 10.7% | Record retention: 84% of deciders chose Expanse [2] |
| TruBridge (ex-CPSI) | 7.6% (KLAS, via trade-press coverage) [3][4][6] | n/a | 4.3% | Small/rural. Confirmed in pass 2 from search extracts of KLAS coverage. |
| Altera (Sunrise/Paragon) | 2.9% (KLAS, via trade-press coverage) [3][4][6] | n/a | n/a | Renewals, but shrinking [37][38] |
| WellSky, VistA, Netsmart, MEDHOST | n/a | n/a | 3.4%, 1.7%, 1.7%, 1.6% [7] | Niche (post-acute, behavioral, VA legacy) |

**Year-on-year context.** A year earlier, KLAS put Epic at 42.3% of hospitals and Oracle Health at 22.9% [3][4]. KLAS warns that Oracle Health counts are estimates, especially for small hospitals. Oracle did not supply a 2025 wins list, so some small-hospital Oracle wins may be missing [3][4].

**Why the two counts differ.** KLAS counts *validated contracts* for acute-care hospitals. Definitive counts *installations* from its Atlas/HospitalView data, which includes specialty, behavioral and paper-based facilities [7]. Over a five-year horizon the two sources agree closely.

**Market dynamics in 2025–2026:**
- **Fewer decisions.** KLAS attributes the drop to policy uncertainty, health systems shifting money to AI and efficiency tools, and Oracle customers deferring decisions while they wait for clarity [1].
- **Epic's growth moved down-market.** In 2025 Epic added 49 hospitals from smaller health systems. Seven standalone hospitals joined via Community Connect [2][4]. The main driver was regional data exchange with existing Epic partners [2].
- **Oracle's base is fragile.** About 30% of sampled Oracle customers say Oracle is not part of their long-term plans, and 35% are "vulnerable" [1].

### 2.2 Epic Systems (Verona, Wisconsin)

**Company facts:**
- Private and founder-led (Judy Faulkner).
- About 14,000 employees.
- Revenue of about **US$6.7B in 2025**. This figure comes from Forbes via Wikipedia; Epic does not publish financials [13].
- Epic says more than 325M patients have an Epic record, and MyChart has about 150M US users [13].

**Module taxonomy.** These are Epic's widely documented product names. The list is [U] as a whole, but it is standard industry knowledge.

| Domain | Epic application(s) |
|---|---|
| Inpatient clinical | EpicCare Inpatient (ClinDoc nursing, CPOE/Orders), Rover (mobile nursing), Grand Central (ADT, bed management, transport, EVS) |
| Ambulatory clinical | EpicCare Ambulatory, Haiku/Canto (physician mobile/tablet) |
| Emergency | ASAP |
| Perioperative | OpTime (OR) + Anesthesia |
| Specialty | Beacon (oncology), Cupid (cardiology), Stork (obstetrics), Kaleidoscope (ophthalmology), Wisdom (dental), Bones (orthopedics), Phoenix (transplant), Willow (inpatient and ambulatory pharmacy) |
| Diagnostics | Beaker (clinical and anatomic pathology lab), Radiant (radiology RIS) |
| Access and revenue cycle | Cadence (scheduling), Prelude (registration/eligibility), Resolute Hospital Billing and Professional Billing, Claims/Remittance, HIM/coding |
| Patient engagement | MyChart (portal and app), Welcome (kiosk), Hello World (texting), Emmie (AI concierge, 2026) |
| Population health and payer | Healthy Planet, Tapestry (managed care / payer platform), Payer Platform |
| Data and analytics | Chronicles (operational DB), Clarity (relational reporting), Caboodle (data warehouse), Cogito (analytics suite), Nebula (cloud AI/analytics platform), **Cosmos** (multi-org de-identified dataset) |
| Interoperability | Care Everywhere (exchange with Epic and non-Epic), Epic Nexus (TEFCA QHIN), open.epic / FHIR APIs |
| Distribution and ecosystem | **Community Connect** (host-affiliate model), Epic Hosting, Showroom (successor to App Orchard; third-party app marketplace) |
| Client technology | Hyperspace (legacy thick client), Hyperdrive (web-based client) |

**UGM 2025 AI announcements** (August 2025, "Sci-Fi" theme) [8][9][10]:
- **Art** is a clinician-facing agent. It preps visits, pulls trends, updates history and queues orders. Its ambient note drafting uses **Microsoft Dragon** technology. The scribe feature was due in early 2026, with more Art capabilities slated for around November 2026.
- **Emmie** is a MyChart concierge. It explains results, proposes appointment times, builds pre-visit agendas and sends reminders. Its to-do list reportedly rolled out in February 2026, but OCHIN-type community health centers get these features on an estimated 6–18-month lag (secondary source) [11].
- **Penny** is a generative-AI assistant for revenue cycle (coding, denial appeals). One non-Epic source gives a November 2026 general-availability date; this is unconfirmed [11].
- **Cosmos AI / CoMET** are generative "medical event" models pretrained on **118M patients and about 115B discrete medical events (151B tokens)**, per Epic's arXiv paper. Pass 1 wrote "151B events", which conflated tokens with events. A November 2025 revision of the paper calls the model family "Curiosity" [160]. Epic offered the models via the Cosmos AI Lab from February 2026 [8][10]. **Second generation (UGM, Aug 2026):** "Cosmos Curiosity" trained on 320M de-identified patients and 23B encounters. Twenty organizations were validating it ahead of a March 2027 in-EHR release [175]. The UGM coverage does not link it to the 2025 paper, so treat it as a later, larger generation. *(Reconciled 2026-10-16 with `09` §0 #11 and §6.)*
- Epic says it has **about 200 AI features** in development [8].

**Regulatory and legal headwinds:**
- **Particle Health antitrust suit**, filed September 2024. A judge allowed it to proceed in September 2025 [13].
- **CureIS antitrust suit**, filed May 2025 [13].
- **Texas Attorney General monopoly suit**, filed December 2025 [13].

These suits target Epic's control of data exchange and its ecosystem. They are the most important external risk to Epic's model and a narrative opening for open-platform competitors.

### 2.3 Oracle Health (formerly Cerner; Kansas City / Austin / Nashville)

**Platform naming.** Millennium is now marketed as the **Oracle Health Foundation EHR** [19][46]. Oracle's US$28.3B Cerner acquisition closed in June 2022 [21].

**New AI EHR:**
- Announced 13 August 2025 [15][16]. It was built on **Oracle Cloud Infrastructure (OCI) from the ground up, not on the Millennium codebase** [15].
- It is "voice-first" with embedded agentic AI. Customers can build their own agents or plug in third-party ones [16].
- **ONC certification and EPCS compliance** came on 18 November 2025, for **ambulatory** use [17].
- Acute-care functionality was promised for 2026, with mid-2026 originally signalled. On 12 August 2026 Oracle still described the EHR as ambulatory-only, with an acute launch "this year" [18]. The September 2026 nursing-agent launch runs inside the existing Foundation EHR, not the new EHR [19]. **Pass 2 (16 October 2026) again found no announcement of acute general availability.**
- An oncology EHR variant has been announced [U, from search-result extract].

**Clinical AI Agent:**
- Launched for physicians around late 2024. Oracle claims it saved more than **400,000 documentation hours** [19].
- A **nursing** version became generally available on 14 September 2026 for the inpatient Foundation EHR. Features include voice-to-discrete vitals, shift summaries and voice chart search. BayCare is the named evaluator [19].

**Customer sentiment.** KLAS's 2025 report on Oracle Health found unmet promises, weaker communication and departures of "several large, well-known customers." The Clinical AI Agent was the first visible bright spot [20].

**Federal: VA EHR Modernization (EHRM):**
- The VA paused deployments in April 2023 after six sites went live [23].
- It restarted with a regional "market" approach:
  - **Michigan (4 sites), 11 April 2026** [22][23]
  - **Ohio/Kentucky (4 sites), 6–7 June 2026** [22][26]
  - **Indiana (3 sites), August 2026** [22]
  - **Anchorage (Alaska VA HCS) and Cleveland (Louis Stokes VAMC)** are scheduled for **24 October 2026**, which is after this document's date. The 2027 schedule lists **26 sites** in waves from January to November 2027 [161].
- The VA says it has made about 1,500 fixes, had no system-wide outage in 10 of 12 months, and is hiring 400 staff [26].
- Lifecycle cost is about **US$37B**, per "a recent cost estimate provided to lawmakers." For comparison, the 2018 contract was US$10B, later revised to over US$16B. Other published estimates range from about US$16B to nearly US$50B, depending on scope [24] (the range comes from search-result extracts). The VA says full rollout could come "as early as 2031" [22]. GAO and VA Inspector General reports still flag low staff confidence and incomplete corrective actions [25][26].

**Federal: DoD MHS GENESIS.** Cerner, Leidos and Accenture won a 10-year, US$4.3B contract in 2015 [21]. Enterprise deployment was completed in 2024, and the DoD, VA, Coast Guard and NOAA share a single "Federal EHR" instance [U]. Pass 2 could not confirm the completion date: the health.mil MHS GENESIS page still uses the phrase "when fully deployed," which may simply be out of date.

**International.** Oracle won large deals in Canada, an English trust, Austria and two Middle East multi-hospital groups in 2025. It also lost 34 hospitals, more than half of them in Sweden's VGR [46]. Skåne (Sweden) postponed its Millennium go-live again in January 2026 [21].

**Strategic uncertainty.** German trade press (January 2026, citing CIO and TD Cowen) reported speculation that Oracle **might consider selling Cerner** because of AI data-center capital needs. Oracle has not commented [53]. Treat this as rumor, but it feeds buyer hesitancy.

### 2.4 MEDITECH (Westwood/Canton, Massachusetts)

- Serves more than 2,000 organizations in about 28 countries. Its core is US community and critical-access hospitals, with sizable presence in Canada, the UK/Ireland and South Africa [35][36].
- **Expanse** (web-based, launched 2018) has a mobile companion, Expanse Now. MEDITECH-as-a-Service runs on **Google Cloud**. MEDITECH reports **more than 260 licensed MaaS customers**, with 23 hospitals signed for MaaS in 2026 (February 2026) [34]. Health System CIO's "100+" figure [35] understates this. MEDITECH's AI work with Google focuses on chart search and summarization; ambient documentation comes via partners [35].
- **HCA Healthcare** had **72 hospitals live on Expanse across its US and UK networks** as of the August 2026 wave. Capital and North Florida (34 hospitals) are the first two of HCA's 15 US divisions to go fully live. The first large wave (22 hospitals) went live in 2025, and the next wave is planned for October 2026 [35][172]. HCA's enterprise commitment is said to date from 2022 [35]; MEDITECH's release does not give that date. MEDITECH was named a **Leader in the 2026 Gartner Magic Quadrant for Enterprise EHR** (25 August 2026) [173].
- It won Best in KLAS for Acute Care EHR & Patient Accounting, Small (1–150 beds) at **77.1/100**, two years running [31][34].
- KLAS-reported weaknesses: interoperability gaps and a need for more native breadth, for example **capacity management** [2].

### 2.5 Other US vendors

| Vendor | Position (2025–2026) | Notes |
|---|---|---|
| **Altera Digital Health** (Harris/Constellation) | Sunrise (acute), Paragon (small hospital), TouchWorks (ambulatory), dbMotion | Formed when Allscripts sold its hospital business to Harris in 2022 [38]. **Sunrise 25.1** shipped with about 700 enhancements, the first major release in three years. 14 clients renewed in February 2026 [37][38]. Leadership reshuffled in October 2026 [37]. Employee reviews describe attrition and client losses (anecdotal). |
| **TruBridge** (formerly CPSI) | Rural and community hospitals; RCM services | KLAS-derived share of about 7.6% (secondary) [6]. Business mix leans toward RCM outsourcing [U]. |
| **athenahealth** | Ambulatory and independent practices; cloud-native, multi-tenant | **Overall Best in KLAS for Independent Physician Practice Suite for the third consecutive year** [30][39]. Has no acute-care hospital EHR. |
| **eClinicalWorks** | Private; large ambulatory footprint | Ambulatory and FQHC strength; cloud/AI (Sunoh ambient) [U]. Not a meaningful acute-care vendor. |
| **NextGen Healthcare** | Ambulatory specialty | Taken private by Thoma Bravo: announced September 2023 at about US$1.8B enterprise value, completed around November 2023 [169]. |
| **Veradigm** (ex-Allscripts) | Ambulatory EHR, payer and life-sciences data | **Suspended from Nasdaq on 29 February 2024** for failing to file its FY2022 annual report and 2023 quarterly reports. It now trades on the OTC Expert Market (MDRX) [170]. A strategic-alternatives review was reported but not verified in pass 2 [U]. A cautionary tale of portfolio fragmentation. |
| **Abridge, Microsoft Dragon Copilot, Ambience** etc. | The AI documentation layer | **Abridge won Best in KLAS for Ambient Speech (94.7)** [31]. Epic's native Art scribe is a direct threat to standalone scribes. |
| **Canvas Medical, Elation** | API-first and small-practice EHRs | Best in KLAS winners in specialty and small practice [31]. They show API-first architecture can win satisfaction. |
| **Workday** | Large-hospital ERP | Best in KLAS ERP for hospitals with more than 300 beds [31]. Epic does not provide ERP, so a separate ERP is the norm in the US. |

### 2.6 Best in KLAS 2026: EHR-relevant results

| Segment | Winner | Score |
|---|---|---|
| Overall Health System Suite | Epic (16th consecutive year) [30] | — |
| Acute Care EHR & Patient Accounting, Large (>400 beds) | Epic (EpicCare Inpatient / Resolute HB) | 89.7 [29][33] |
| Acute Care EHR & Patient Accounting, Midsize (151–400 beds) | Epic (EpicCare Inpatient / Resolute HB) [29][31] | 88.3 [29] |
| Acute Care EHR & Patient Accounting, Small (1–150 beds) | MEDITECH Expanse/MaaS | 77.1 [29][31][34] |
| Ambulatory EHR, Health-System Owned | Epic | 90.0 [29][33] |
| Independent Physician Practice Suite | athenahealth (3rd year) [30] | — (segment scores: 85.4 for 11–75 physicians; 87.7 for >75 physicians, tied with Epic [29]) |
| Ambient Speech | Abridge | 94.7 [29][33] |
| ERP (>300 beds) | Workday HCM/Financials/Supply Chain [31] | 91.3 [29] |

**The structural takeaway for us:** in the US, satisfaction scores, market share and network effects all point the same way. A new entrant cannot dislodge Epic in large US health systems in this decade.

---

## 3. Europe

### 3.1 Overview

Europe has no continental winner. Each country has a mix of local champions, public-sector buying cycles and language and regulatory moats.

**KLAS Best in KLAS 2026 global acute-care EHR winners in Europe** [31][32]:

| Region | Winner | Score |
|---|---|---|
| UK/Ireland | Epic | 86.6 |
| Northern Europe | Epic | 86.1 |
| DACH | Dedalus ORBIS | 73.5 |
| France | InterSystems TrakCare | 76.5 |
| Southern Europe | Dedalus Care (HCIS) | 75.4 |

Pass 2 confirmed all five scores on KLAS's public Global Software page [32]. For comparison, the other 2026 global acute-care winners are: Canada, Epic 88.9; Asia, TrakCare 86.3; Middle East/Africa, IQVIA HIS 82.0; Latin America, MV SOUL 80.0; Oceania, TrakCare 74.0. KLAS warns that scores in emerging markets with few live clients can change significantly [32].

The DACH and Southern Europe scores are much lower than Epic's US scores. That is a satisfaction gap a better product could exploit.

**2025 buying activity:**
- KLAS's global report found large European decisions went to **Nexus AG, Softway Medical, Numih France and Cambio**. Oracle Health and Mesalvo had large contracts **canceled** [45].
- Post-COVID public funding in France and Italy has largely been used up [45][46].

### 3.2 Epic's European footprint

| Country | Customers / status | Economics and issues |
|---|---|---|
| **UK** | About 18 NHS trusts, including Cambridge University Hospitals, Manchester (MFT), Guy's and St Thomas'/King's, many London trusts and Royal Devon [14][72]. **£222M** federated contract with four Somerset and Dorset trusts (March 2026) [72]. UK share **9.7%, up 3.5 pts** (May 2025) [71]. Bristol HQ campus approved [13]. | Cambridge cost about £200M (2014). Its go-live was followed by emergency designations and executive resignations [74]. |
| **Netherlands** | UMC Groningen, Elisabeth-TweeSteden (Tilburg) and others [14]. A new Dutch hospital-group win in 2025 [46]. | Dutch market leader is ChipSoft HiX [U]. Dutch Epic sites were among the first users of Epic's AI patient summaries (May 2024) [14]. |
| **Denmark** | Sundhedsplatformen (Capital Region and Region Zealand) [79] | **DKK 2.8B**. Nearly one-third of physicians were deeply dissatisfied years after launch, with mistranslated prompts among the complaints [74]. |
| **Norway** | Helseplattformen (Central Norway): 9 hospitals, 34 municipalities, about 40K daily users [75][76] | About NOK 3B for the specialist-care rollout plus NOK 522M regional. The total may exceed NOK 5B against NOK 3.7B planned [76][77]. That is the specialist-care scope. The whole-programme cost (trusts, municipalities, GPs) was about **NOK 6.7B by Oct 2024, against a NOK 4.1B original frame** [176] *(reconciled 2026-10-16; see the cost table in §9.2)*. The Auditor General found patient-safety risk (2024). 78% of doctors are unhappy [76]. A parliamentary proposal to scrap it was opposed by the regional board, which estimates a replacement would take about 7 years [75]. |
| **Finland** | Apotti (Helsinki/HUS/Vantaa-Kerava; about 1.6M people) [80][81] | Selected 2015, implementation from 2018. Cost is cited as **€408M** in PLOS [74] versus about **€625M by November 2022** in Finnish reporting (Helsingin Sanomat, 5 Nov 2022, via Wikipedia). The figures conflict. *(Reconciled 2026-10-16: Apotti's own FAQ gives a €407M investment cost "in its current scope", undated [177]. That matches the PLOS figure. The €625M figure's scope is unclear, so both stay marked as conflicting, here and in `10`.)* Fewer than 10% of clinicians agreed it improved care quality [74]. |
| **Switzerland** | LUKS Lucerne (2019), Insel Gruppe Bern (March 2024) [U-partial] | Insel reported **CHF 182.5M** total (licenses, consulting, internal staff, infrastructure), well above early estimates. This figure is from search-result extracts; primary source not fetched. |
| **Belgium** | Second active Epic hospital footprint signed in 2025 [46] | — |
| **Germany** | **Charité Berlin**, December 2025: Epic's first German customer [61][62] | About **€200M over 10 years** covering licenses, infrastructure and implementation. Full rollout targeted for end-2029. Charité needed a **law change to borrow the money itself** through a bank consortium, because it had been limited to investments of up to €20M in depreciable major equipment. The supervisory board approved the loan financing, as kma reported on 10 July 2026 [63]. kma gives the ~€200M frame (licenses, infrastructure, implementation support) but no contract term; the "10 years" comes from [61]. Dedalus was excluded on a formal error after a legal fight [62]. |

**What Europe teaches about Epic.** A peer-reviewed 2026 analysis in PLOS Digital Health argues that Epic's European troubles come from a mismatch between US-designed workflows and governance and European health-system conditions. It also cautions that large EHR change is hard for any vendor [74]. European Epic customers (Region H, Apotti, Lucerne) jointly asked Epic for an **EU-based support center** over data-transfer concerns [79]. Pass 2 removed the [13] citation because the Wikipedia article does not mention this. Data sovereignty is a real buying criterion.

### 3.3 United Kingdom (NHS England and devolved nations)

- **Coverage:** By May 2025, **94% of NHS acute trusts** had an EPR, under the Frontline Digitisation program, which runs to March 2026 [71].
- **2025 supplier shares** (Digital Health Intelligence) [71]:
  - **Oracle Health 25% (+1.4 pts)**
  - **System C** second (−1.4 pts)
  - **Epic 9.7% (+3.5 pts)**
  - Alcidion, Altera, MEDITECH and Nervecentre each +0.7 pts
  - Dedalus −0.7 pts
- **Population coverage:** Epic and Oracle together cover about 45% of the population served by acute trusts [72].
- **Nervecentre:** Claims it is now "#2 by beds" after a 10-year Mid Yorkshire deal. This comes from a secondary blog and is **unverified** [73].
- **Market dynamics:** Trusts are "converging" onto shared instances across ICS footprints, for example Somerset and Dorset [72]. Each convergence displaces PAS and EPR incumbents such as System C, TPP SystmOne, EMIS/Optum, IMS MAXIMS and InterSystems PAS [72].
- **Openness signals:** Better (openEHR) for e-prescribing and clinical data repositories, and IMS MAXIMS (open-source EPR) [U].

### 3.4 DACH (Germany, Austria, Switzerland): the SAP IS-H shock

**The trigger.** In October 2022 SAP announced it would stop developing **IS-H** (patient management and billing) and **leave the market**. The maintenance timeline is [49][50][52]:
- Mainstream maintenance on ECC to end-2027
- Paid extended maintenance to end-2030
- After that, only customer-specific maintenance

**i.s.h.med**, the clinical layer on IS-H that Cerner owned and Oracle now owns, has support extended to **2035**. That extension requires moving to **Oracle "i.s.h.med hosting" in Oracle's EU Sovereign Cloud** [49][55]. INFORMATICS adds that SAP's RISE program could stretch the underlying ECC support to 2032, but the i.s.h.med options on that path are uncertain [49]. More than 500 DACH hospitals depend on IS-H, according to Natuvion (July 2025) [50].

**Successor paths:**
- **SAP-ecosystem licensed successors:** S4.health (T-Systems Austria and partners; chosen by Tübingen University Hospital in November 2025) [57] and GS-H in Switzerland [66]. The German SAP user group DSAG criticized these for requiring S/4HANA [52].
- **Full KIS replacement or billing-only replacement** by German vendors [53][54].
- **Hybrid:** SAP S/4HANA for ERP with a clinical KIS on top [49].

**Progress is slow.** Natuvion reported in 2025 that there were "little more than a few pilot projects" [50]. kma expects a **tender wave in 2026** [53].

**The German KIS market in 2026** (kma-online, mostly vendor-reported figures) [53]:

| Vendor | HQ / owner | Flagship | Scale (2025) | Notes |
|---|---|---|---|---|
| **Dedalus** | Milan; Ardian about 92% | ORBIS; **ORBIS U** (web-based, cloud-capable, built with AWS) | DACH revenue about €460M; Germany €420M (+11%); **850 German ORBIS installs**, about 900 in DACH | Market leader since buying Agfa HealthCare IT (2020). Lost Charité. Ardian reportedly exploring a sale again (2026, unconfirmed) [67][68]. A secondary source claims 43% of DACH acute signings and about 450 ORBIS U facilities [69]. |
| **CompuGroup Medical (CGM)** | Koblenz; Gotthardt family 50.12%, CVC 27.78%; delisted June 2025 | CGM CLINICAL (ex-Cerner/Siemens Medico, Soarian) | Hospital (HIS) segment revenue €353M (+10%); group €1.21B | Claims about 20% of German KIS market. |
| **Nexus AG** | Donaueschingen; TA Associates about 95%; delisted November 2025 | NEXUS KIS | Revenue €288.6M (+10.4%); 326 German clinics; 11 hospital switches in 2025 | Sweet spot is 400–800-bed hospitals. Won large 2025 European decisions (KLAS) [45]. |
| **Meierhofer** | Munich; owner-managed | M-KIS, M-KIS Billing (IS-H replacement) | €41M revenue; about 260 DACH customers | Sovereign cloud via StackIT (Schwarz Digits). |
| **Mesalvo** | Formed 2021 (i-Solutions, Meona, Datapec, E.care) | HealthCentre (cloud), Meona | €49.4M (2024); about 150 German hospitals; Helse Vest (Norway) project of about 8,000 beds | A large contract was canceled (KLAS), and an Austrian client recommitted to Oracle after Mesalvo "couldn't deliver needed functionality" [45][46]. |
| **AMC Holding** | Hamburg | Clinixx (web-based since 2004) | 70+ clinics; 7 new in 2025 | Targets smaller hospitals. |
| **Deutsche Telekom** | Bonn | iMedOne | About 260 sites; 300+ hospitals served with IT services | Also the engine for Netcare's CareOn in South Africa [146]. |
| **Oracle Health** | — | i.s.h.med (on SAP IS-H) | Says it has done 70+ KHZG projects for 20 customer organizations (2022–2025); AMEOS has 30+ clinics on i.s.h.med Model System [55][70] | No German date for the new platform; support to 2035 if customers move to Oracle cloud hosting [53][55][56]. |
| **Avelios Medical** | Munich; founded 2020 | Modular, AI-native KIS | About 15 customers, more than 70 hospitals (5 university hospitals, Sana); about 200 staff | €30M Series A led by **Sequoia** (2025) [59]. **SAP strategic investment and partnership** (February 2026). Avelios describes itself as "SAP's recommended successor to IS-H"; the investment amount was not disclosed [58][60]. **Fresenius** strategic investment around May 2026; Fresenius Helios runs about 140 facilities [60]. Targets 18–24-month full replacement. Rumored implementation problems, which Avelios denies [53]. |
| **Epic** | Verona | Epic | Charité (first German site) | — |

**KHZG effect.** The Hospital Future Act provided €4.3B in funding; about €3B was approved by February 2025. The most-funded project categories were digital documentation (1,533 projects), patient portals (1,130) and medication management (937) [64]. The **DigitalRadar** maturity score rose from 33.5 (2021) to 42.4 (2024) to **about 55 (2026, third survey)** [64][65]. KHZG projects are now largely complete, so vendor revenue tailwinds are fading just as the IS-H replacement cycle peaks [53].

**What it means for us.** **Avelios is the closest analogue to our ambition.** It is a modern, modular, AI-native HIS that went from startup to more than 70 hospitals in about five years. It did that by exploiting a forced migration (the IS-H exit) and gaining strategic backing from incumbents in adjacent markets (SAP for ERP, Fresenius as a hospital operator).

### 3.5 Nordics

- **Sweden.** Västra Götaland (VGR) went live with Millennium on 12 November 2024 and **rolled back within days**. The go-live was halted after three days. VGR formally ended the program on 17 February 2026. The regional board unanimously approved a settlement with Oracle in late August 2026: VGR pays **SEK 657M** as termination compensation for Oracle's lost future revenue, and Oracle keeps payments already received. About SEK 3.8B had already been spent [84][85]. VGR will now build a **modular** environment, estimated at SEK 5.5–11B, and keep legacy systems for up to eight more years at about SEK 40M a year [83][84][85]. Skåne's Millennium go-live keeps slipping [21][86]. **Cambio (COSMIC)** won large decisions in 2025 [45] and bought ambient-scribe startup LeapScribe in May 2025 [87].
- **Norway.** Helseplattformen uses Epic (see 3.2). The other regions mostly use **DIPS Arena** [U]. Mesalvo is on a Helse Vest project [53].
- **Denmark.** Sundhedsplatformen uses Epic. Other regions use Systematic and Cambio solutions [U].
- **Finland.** Apotti uses Epic. Many wellbeing services counties use Tietoevry Lifecare and other domestic systems [U]. Tietoevry's healthcare-software ownership and structure changed during 2024–2025 [U].

### 3.6 France, Southern Europe, Benelux, others

- **France.** KLAS 2026 winners and active vendors include InterSystems TrakCare (Best in KLAS France), **Softway Medical** (Hopital Manager) and **Numih France** (public-sector cooperative), both of which won large 2025 decisions [31][45]. Dedalus (DxCare, ORBIS; for example AP-HP [U]) and **Maincare** are also active [U]. Funding from the Ségur numérique program has been used up [45].
- **Italy.** Dedalus is the home-market leader, with domestic players such as GPI and Engineering [U]. Funding has been used up [45].
- **Spain.** Regional public systems are often built in-house (for example Andalusia's Diraya) [U]. Dedalus HCIS was the Southern Europe Best in KLAS winner [32]. CGM Selene came from Cerner via CGM [53]. Avelios is in talks with a Spanish chain [53].
- **Portugal.** **ALERT** (ALERT EHR, Porto) is an internationally exported, though now smaller, vendor. The public SNS uses SPMS-built tools (SClínico) [U].
- **Netherlands.** ChipSoft HiX dominates, with Epic in several academic and teaching hospitals [14][U].
- **openEHR.** Better (Slovenia) is the most commercially visible openEHR platform vendor in Europe. The EU **European Health Data Space (EHDS)** regulation will mandate EHR interoperability and portability [74]. **Regulation (EU) 2025/327** was published on 5 March 2025 and entered into force on 26 March 2025. Most obligations apply from **March 2029**, including cross-border exchange of patient summaries and ePrescriptions. Medical images, lab results and discharge reports follow in **March 2031** [167]. That favors open, standards-based architectures.

### 3.7 European vendor comparison

| Vendor | HQ | Flagship | Architecture / tech notes | Target segment | Notable customers | Strengths | Weaknesses |
|---|---|---|---|---|---|---|---|
| Epic | US | EpicCare (Hyperspace/Hyperdrive) | Single DB (Chronicles on InterSystems IRIS) [U]; Azure-based Nebula | Academic, large public regions | Charité, CUH, MFT, Apotti, Region H, Helse Midt | Integration, KLAS, Cosmos/MyChart | Cost, localization, US workflow fit, sovereignty |
| Oracle Health | US | Millennium/Foundation EHR; i.s.h.med | Moving to OCI; new AI EHR is US-only | Large public, DACH i.s.h.med base | UK trusts, AMEOS, Austria region | Breadth, OCI, AI agent | VGR failure, roadmap uncertainty |
| Dedalus | IT | ORBIS / ORBIS U; DxCare; HCIS | ORBIS U is web/cloud (AWS) | DACH, FR, IT, ES public and private | 850 German sites; AP-HP [U] | Installed base, localization | Low KLAS scores (73.5); PE exit pressure |
| CGM | DE | CGM CLINICAL | Legacy Medico/Soarian heritage | DE mid-size | — | DE billing and telematics | Aging stack |
| Nexus | DE | NEXUS KIS | Modular; AI acquisitions | 400–800 beds DACH, CH | Berlin hospitals | Growth, modularity | Mostly DACH |
| Cambio | SE | COSMIC | Modular; ambient (LeapScribe) | Nordic regions, UK | Swedish regions | Nordic fit | Smaller scale |
| Avelios | DE | Avelios KIS | Cloud- and AI-native, modular | University hospitals and chains | Sana, MHH, LMU | Speed, SAP/Fresenius backing | Young, delivery risk |
| Better | SI | Better Platform (openEHR) | openEHR CDR, low-code | Regions and national programs | UK, Slovenia [U] | Open data model | Not a full HIS |
| System C / Nervecentre | UK | CareFlow / Nervecentre EPR | Mobile-first (Nervecentre) | NHS trusts | NHS | NHS fit, price | UK-only |
| InterSystems | US | TrakCare / IntelliCare | IRIS; single code base | National and regional programs | France (KLAS winner) | Interop pedigree | Smaller EHR share in Europe |

---

## 4. Middle East

**Context.** The Gulf is the world's most active EHR market by value per decision. Drivers include Saudi Arabia's **Vision 2030 corporatization**, with care moving from the MoH to **Health Holding Company (HHC)** and its **20 regional clusters** [88][89], UAE emirate-level HIE mandates, and a large private sector. Black Book ranked Saudi Arabia **#1 among next-wave EHR markets** (July 2026) [88].

**Saudi Arabia:**
- **Buying signals.** In 2025 **IQVIA's Hospital Information System** was chosen in **multiple MoH cluster decisions**. Adaptive TechSoft, Epic and Oracle also won significant contracts [45]. IQVIA HIS is also the **Middle East/Africa Best in KLAS** winner (82.0) [32].
- **Black Book (128 Saudi IT leaders, 2026).** Oracle Health and InterSystems lead a close top tier. Oracle is strongest in cluster scalability and Saudi delivery capacity; InterSystems is strongest in **NPHIES/SeHE interoperability**. 98% of respondents rate NPHIES, SeHE and interoperability as critical, and vendors without working Saudi integrations "may be eliminated" [88].
- **Epic.** Johns Hopkins Aramco Healthcare was Epic's first Saudi site [91]. King Fahd Medical City in Riyadh was the second [92]. **Correction (pass 2):** pass 1 said some sources link King Faisal Specialist Hospital & Research Centre (KFSHRC) to Epic. The primary evidence instead shows KFSHRC on **Cerner Millennium**, now Oracle Health. In 2015 KFSHRC's CIO credited "the Cerner Millennium® EHR" when KFSHRC reached HIMSS Stage 7 [165]. **Harmonized wording (reconciled 2026-10-16, same as `10` §6.1):** Cerner Millennium (now Oracle Health), per 2015 primary evidence. Later evidence is a 2020 KFSH&RC press release on its Millennium upgrade [178] and 2022 reports of Oracle Cerner transplant-workflow work and an AI MoU [179]. There is no evidence of Epic, and the current platform has not been re-confirmed for 2024–2026. Action: confirm it in the proposed beachhead-market report, because KFSHRC is a regional reference site.
- **Oracle.** Alrajhi Medicine (January 2026) is the first Saudi private group on Oracle Health EHR plus Oracle Fusion ERP as a single platform [90]. That is a notable **EHR+ERP bundle** precedent.
- **Korea's ezCaretech (BESTCare 2.0):** It deployed across six National Guard (MNGHA) hospitals and about 70 clinics via the **SKHIC joint venture** (MNGHA, Seoul National University Bundang Hospital, SK Telecom, ezCaretech) starting in 2016 [94][95]. In 2026 it won its **first Saudi private-sector deal**: Care Med, **four hospitals with about 1,300 beds plus two clinics for about US$6.96M** [93]. That price point is roughly **US$5K per bed** [E: derived as $6.96M / 1,300 beds; excludes the clinics and customer internal costs]. ezCaretech is also in talks with HHC [93].

**United Arab Emirates:**
- **HIE mandates.** Each health record exchange requires source EMRs to meet coding and data standards:
  - **Malaffi** (Abu Dhabi, 2019): 100% of hospitals connected; **3.5B clinical records** (August 2025); SNOMED CT implementation from November 2025 [96].
  - **Riayati** (MOHAP/EHS, federal and Northern Emirates) [97].
  - **NABIDH** (Dubai) [U].
- **SEHA/PureHealth (Abu Dhabi public).** Long-time **Cerner** customer, with Oracle Cerner revenue cycle live across all facilities [98][99]. EHS's Riayati source systems are reportedly Cerner-based [U]. **Dubai Health's Salama EMR is Epic** (former DHA programme, 2015–18). Contemporary press reporting DHA's IT director in Apr 2017 says Salama staff were trained "by the international company EPIC" [180]. No DHA or Epic primary press release was fetched, and there is no evidence that Salama is Cerner-based. *(Reconciled 2026-10-16: this previously said Salama was Cerner-based [U]. It now uses the same wording as `10` §6.1.)*
- **Other providers:**
  - **Cleveland Clinic Abu Dhabi:** Epic, partially verified. A 2016 US-UAE Business Council report says CCAD "reportedly" uses Epic, and CCAD sits inside Cleveland Clinic's enterprise Epic upgrade [166]. CCAD's anatomic pathology lab runs on parent Mubadala's Cerner system [166].
  - **American Hospital Dubai and King's College Hospital Dubai:** Oracle Cerner, KCH on Oracle cloud [100]
  - **Mediclinic Middle East:** InterSystems **TrakCare** across 7 hospitals and 24 clinics [103]
  - **Medcare (Aster):** MoU to be the **first EMEA IntelliCare** site, around June 2026 [102]
- **Partnerships.** Oracle has a co-development partnership with Cleveland Clinic and G42 (UAE AI) [101]. M42 and Oracle Health announced a partnership in November 2025 (scope unclear) [105].

**Qatar.** **Hamad Medical Corporation** has run **Cerner since 2012** across public hospitals, linked with PHCC primary care and Qatar Biobank [104].

**Egypt and others.** **Health Insights for Software Design** was selected in Egypt in 2025 [45]. Balsam United/OASIS was one of eight vendors that met the inclusion criteria for Black Book's Saudi scorecard [88]. Black Book does not itself call it a local vendor.

| Vendor | Middle East flagship clients | Strength | Weakness |
|---|---|---|---|
| Oracle Health | SEHA, HMC Qatar, KFSHRC (Cerner per 2015 primary evidence, also 2020–2022 [165][178][179]; not re-confirmed for 2024–2026), EHS (Cerner) [U], Alrajhi | Installed base, Arabic, local delivery, EHR+ERP bundle | US turmoil, cost |
| Epic | JHAH, KFMC, Dubai Health/Salama (2017 press [180]; reconciled 2026-10-16), CCAD (partially verified [166]) | Brand among US-affiliated hospitals | Price; few local implementation resources |
| InterSystems | Mediclinic ME, Medcare | Interop (NPHIES/HIE), IntelliCare EU MDR IIa [102][106] | Smaller enterprise footprint |
| IQVIA HIS | Saudi MoH clusters [45] | Best in KLAS ME/Africa (82.0) [32] | Limited global brand as an HIS |
| ezCaretech | MNGHA, Royal Commission, Care Med | Price per bed, Korean engineering | Brand, scale |
| Local vendors (Balsam/OASIS, etc.) | Private clinics and hospitals | Price, Arabic, NPHIES | Depth for tertiary care |

---

## 5. Asia-Pacific

### 5.1 InterSystems: the APAC incumbent

- **TrakCare** won Best in KLAS Acute Care EHR in **Asia (86.3), Oceania and France** [31][32][108].
- **IntelliCare**, launched at HIMSS25, is TrakCare plus IRIS for Health plus generative AI: ambient documentation, an AI assistant and AI-assisted coding. InterSystems says its EHRs are used in **more than 600 hospitals in 29 countries** and cover "100M+" patients. Pack-wide wording: "InterSystems EHRs (TrakCare/IntelliCare): 600+ hospitals, 29 countries (vendor claim)" (reconciled 2026-10-16; `03` and `08` now match). **Correction (pass 2):** the product page gives these figures for InterSystems EHRs generally (TrakCare plus IntelliCare), not for IntelliCare alone. InterSystems says its EHR solutions hold **EU MDR Class IIa** certification and CE marking, and markets IntelliCare as the first unified AI EHR with that certification [102][106][107].
- **Customers:** EMC Healthcare (Indonesia, 8 hospitals) was the first IntelliCare site [110]. iKang (China) uses TrakCare (August 2026) [111]. Gateway Health (Australia) went live on TrakCare in 2026 [137].
- **Company:** Revenue is above US$1.1B (2024), privately owned [109].

### 5.2 China

**Market structure.** China is a closed, domestic-vendor market (Neusoft, Winning Health/卫宁, DHC/东华, B-soft/创业慧康, iMedway, Kingdee, Yonyou, and others) [119][120]. IDC's 2025 core-hospital-systems share report exists but is paywalled [112]. Grand View Research puts China's HIS market at **US$2.18B in 2025** with a **9.9% CAGR** to 2033 [113]. Other analysts estimate far higher (for example about $8B), depending on scope [U, Insights10].

**Vendors are in a downturn:**
- **Winning Health 2025:** revenue ¥2.106B (**−24.3%**), net loss ¥374M. Software and services revenue fell 19.4%. It blames deferred demand and the slow monetization of its new **WiNEX** platform during upgrades [114][116]. Pass 2 confirmed the figures [114]. The 2025 loss was also driven by impairments (including goodwill), back taxes and late fees, and rigid personnel costs that did not fall with revenue. Note that [114] is an AI-generated summary of the filing.
- **DHC Software 2025:** group revenue ¥12.93B (−3.0%) [115].
- **Causes:** constrained hospital budgets, delayed tenders and year-end-weighted procurement [114]. The 2023-onward healthcare anti-corruption campaign is a further likely factor [U].

**Regulatory grading systems.** These determine product roadmaps in China.
- **EMR application-level grading** (电子病历系统应用水平分级评价) has run since 2018 (levels 0–8). Earlier policy required tertiary hospitals to reach **Level 4 by 2020** and secondary hospitals Level 3 [117][118]. Level 5 and above require provincial plus national audit [118].
- **The 2025 revision is renamed 智慧医疗分级评价 ("smart-healthcare grading").** It applies to secondary-and-above hospitals and covers levels **1–8 (Level 0 removed)**. It pushes requirements down: clinical pathways and **regional data sharing are now required at Level 4**. It adds **信创 (domestic IT stack / localization) and OFD document** requirements [117].
- **Companion national ratings [U]:**
  - **Interoperability maturity** (医院信息互联互通标准化成熟度测评; levels up to 5A/5B, with 4A as a common target)
  - **Smart-service** and **smart-management** gradings
  - Ratings feed into **tertiary public hospital performance assessment** (三级公立医院绩效考核)

**Implication.** China is practically closed to foreign HIS vendors because of data localization, xinchuang requirements and procurement norms. It is not a target market for us. Its **grading frameworks** are still an excellent maturity blueprint for our product design.

### 5.3 Japan

- **Market concentration.** Fujitsu (HOPE/HOPE LifeMark) is about **38%** of hospital EMR share, followed by Software Service Inc. (SSI) about 19%, CSI about 13% and NEC (MegaOak) about 9%. These are 2020 white-paper figures [121]. A study of 2015 data found 76% of systems came from four vendors and **interoperability was very low because of heavy per-hospital customization** [122].
- **Government standardization.**
  - The government is pushing a **standard cloud-native EMR (標準型電子カルテ)**.
  - A **Digital Agency council** formed in FY2026 includes Fujitsu, NEC, IBM Japan, Kameda, RESCO and **startup Henry** [123].
  - The **EMR Information Sharing Service** specification uses **HL7 FHIR** (June 2026 vendor guide) [123].
  - Fujitsu launched **HOPE Smart Cloud Karte** for small and mid-size hospitals in September 2025 [123].
  - The government's Medical DX roadmap (June 2023) aims to have EMRs that can share patient information in "almost all medical institutions" **by 2030 at the latest**. This is an adoption goal, not a legal mandate. The MHLW will certify products as "standard-type EMR" against a national specification, with scheme details due by summer 2026 [174].
- **Implication.** Japan is shifting from customized on-premise systems to certified standard cloud EMRs. It is hard for foreigners to enter, but it confirms the global direction: **standardized, cloud, FHIR-native**.

### 5.4 South Korea

- EMR adoption is very high. Most top-tier hospitals run **self-developed** systems [U]. Examples are Samsung Medical Center's in-house platform, Asan's AMIS and **Seoul National University Hospital's BESTCare**, which was commercialized by **ezCaretech**. Korea runs a national EMR certification scheme [U].
- **ezCaretech** is Korea's main HIS exporter. Its Saudi Arabia record is in section 4 [93][94][95]. Its pricing (about US$5K per bed) is a useful benchmark for emerging markets [E].

### 5.5 India

**Market size and fragmentation:**
- Ken Research puts India's **EHR market at about US$730M (2025)** with an 8.2% CAGR to 2032 [124]. It puts **healthcare IT at about US$760M**, growing at **25.5%** [125]. The two definitions overlap inconsistently, so treat both as indicative.
- The market is "**highly fragmented**," with **local players holding about 70%** and no vendor holding material national share [125].

**Notable vendors:**
- **KareXpert** (Gurugram; Jio-backed): 300+ hospitals in India and 15+ overseas; NABH "Advanced" HIS/EMR certification for 2026 [126]
- **Insta by Practo:** 500+ clients and 1,200+ facilities [124]
- **Akhil Systems** and **Aosta:** KLAS reports both "grew rapidly" in 2025 [45]
- **Athma** (Narayana Health's spin-off): 45+ hospitals, 13M+ patients; **AIRA** AI records tool launched August 2025 for India, Malaysia, the Gulf, Kenya and the Cayman Islands [127][128]
- Others: Suvarna, Birlamedisoft, MocDoc, HealthPlix, Attune [124]
- **eHospital (NIC):** government-built, free for public hospitals [124]

**Large private chains.** Apollo runs its HIS/EMR on Nutanix infrastructure across 72 hospitals; the application vendor is not disclosed [129]. Max and Fortis choices were **not verified** in this research. Several chains (Narayana, Apollo) build in-house. Indian IT majors such as TCS mainly act as systems integrators rather than HIS product leaders [U].

**Buyer criteria** [124]:
- **ABDM** integration (ABHA ID, health information exchange)
- **NABH**-ready workflows
- GST billing
- **TPA/insurance** and PM-JAY claims
- FHIR compliance

**Implication.** India is a high-volume, low-price-per-bed market. It rewards mobile-first SaaS, deep insurance/TPA workflows and ABDM compliance. It is a strong candidate as a **build-and-prove market** for our product.

### 5.6 Singapore

- **NGEMR** is the national, Epic-powered EMR built by Synapxe [130]:
  - **NUHS** went live in February 2022 (10,000+ users)
  - **NHG** followed
  - **SingHealth** is phased to **2028** [131]
- SAF military medical systems will integrate by 2028 [131]. Private hospitals must connect to the national NEHR [U].

### 5.7 Australia and New Zealand

- **New South Wales SDPR:**
  - **Correction (pass 2):** The Epic contracts were finalized in **mid-October 2023**, not August 2023. eHealth NSW announced them in the week before 23 October 2023 [132][163]. The price was first reported as "just over A$1B" for software and services over 10 years. The current contract value is **A$969M** [162].
  - In November 2025 the NSW Audit Office found the 2021 business case "inaccurate." It said the case did not cost integration with legacy systems that remain in use, which is likely to be "significant." A performance audit is planned for 2026–27 [162].
  - It is hosted on **AWS**, and RLDatix Galen has a separate A$83M archive contract [133].
  - Scope: 220+ hospitals, 150+ pathology collection centres, 65 labs and about 600 community health centres. It replaces 9 EMRs, 10 PAS and 5 LIS, rolled out in five stages, with completion targeted for 2028 [136]. iTnews counts six PAS rather than ten [162].
  - The first go-lives were in April–May 2026 (Justice Health, Pathology, Hunter New England) [134].
  - **On 20 August 2026 NSW confirmed it would phase the next tranche** after the Tranche B go-live readiness assessment and lessons from the first rollout. Only Northern Beaches Hospital is now scheduled, for November 2026 [135].
- **Other states:**
  - **Queensland's** statewide ieMR is **Oracle Cerner**, not Epic as the brief assumed. It cost **more than A$1.45B over 10+ years** [21].
  - Victoria is mixed (Epic at the Parkville precinct and Royal Children's; Cerner elsewhere) [U].
  - South Australia runs Sunrise EPAS (Altera) [U].
  - ACT runs Epic [U].
  - Western Australia's statewide EMR procurement status was **not verified**.
- **Oceania buying.** **MEDITECH** won the only validated Oceania contract in 2025 [45]. TrakCare is Best in KLAS Oceania [31].
- **New Zealand.** **Orion Health** (Auckland) is strong in HIE, portals and population health but is not a full hospital EHR leader. Health NZ is centralizing [U].

### 5.8 Southeast Asia

- **Indonesia.** EMC runs IntelliCare [110]. The national **SATUSEHAT** platform and an EMR mandate for all facilities create demand [U].
- **Thailand.** Many public hospitals run **HOSxP** (low-cost, community-developed) [U].
- **Vietnam.** The government ordered EMR deployment in hospitals with 2025 deadlines, which domestic vendors (FPT, Viettel, VNPT) are serving [U].
- **Malaysia and Philippines.** Mixed: MOH programs plus private groups on TrakCare, Oracle Cerner and local systems [U].
- **Regional growth.** KLAS reports **Origin Integrated Studios** and **Amalga** grew in Southeast Asia in 2025 [45].

### 5.9 APAC comparison

| Vendor | HQ | Flagship | Architecture | Segment | Notable customers | Strengths | Weaknesses |
|---|---|---|---|---|---|---|---|
| InterSystems | US | TrakCare / IntelliCare | IRIS, single code base, regional cloud | National and private groups | EMC (ID), Mediclinic ME, iKang | Interop, KLAS Asia/Oceania | Fewer US references |
| Epic | US | EpicCare | Chronicles | National programs, academic | Singapore NGEMR, NSW SDPR | Integration | Cost; NSW phasing |
| Oracle Health | US | Millennium | OCI | State-wide | Queensland ieMR | Scale | Cost, uncertainty |
| Winning / DHC / Neusoft / B-soft | CN | WiNEX etc. | Xinchuang stack | Chinese public hospitals | — | Grading compliance | Downturn, closed market |
| Fujitsu / SSI / NEC | JP | HOPE / MegaOak | Moving to standard cloud | Japanese hospitals | — | Local fit | Heavy customization legacy |
| ezCaretech | KR | BESTCare 2.0 | Web-based, Korean | Tertiary, export | SNUH, MNGHA | Price per bed | Brand |
| KareXpert / Insta / Akhil / Athma | IN | Cloud HIMS | SaaS, mobile | Indian hospitals, chains | Narayana, many mid-size | Price, ABDM, TPA | Depth, scale, quality variance |

---

## 6. Latin America

**KLAS 2025 hospital counts, all LatAm** [138][141]:

| Vendor | Hospitals |
|---|---|
| **MV** (SOUL MV, Recife) | 894 |
| **Philips Tasy** | about 500 |
| SP DATA | 203 |
| Dedalus | 148 |
| TOTVS | 35 |

- **MV** is ranked the **5th-largest hospital EHR vendor globally** by KLAS and is the 2026 LatAm Best in KLAS winner (**MV SOUL, 80.0**) [32][138]. Brazil accounted for more than 80% of LatAm contract activity in 2024 [138].
- **Tasy changed hands.** Philips agreed on 30 December 2025 to sell Tasy to **Bionexo**, a Brazilian procurement and RCM marketplace, for about **€161M (≈R$1.05B at announcement)**. The buyer is backed by Bain Capital and Prisma. After CADE approval, completion was announced on **4 May 2026**, and the business now operates as **Bionexo Tasy** in seven LatAm countries. Exame reported the price as R$940M at closing [139][140][164]. About two months after closing, Bionexo Tasy laid off about 120 staff (search-result extract, not fetched).
  - Tasy revenue is reported at **about R$300M a year** (search-result extracts; not in the Exame article). Exame says Tasy is installed in "more than 2,000 health institutions" [139]. Other reports at announcement said about 1,000 institutions, so the client count is **inconsistent across sources**. The KLAS figure of about 500 counts hospitals only [141].
  - That implies average revenue of about **R$150K (≈US$27K) per client per year** [E: R$300M / ~2,000 clients; mixes hospitals and clinics; the revenue figure is unverified, and with ~1,000 clients the average would be about R$300K]. This is a useful but soft **emerging-market price anchor**.
  - The acquisition process slowed Tasy's 2025 sales [45]. **Rede D'Or**, Brazil's largest hospital operator, expanded Tasy in August 2025 [142].
- **Oracle Cerner in Brazil.** **Hospital Israelita Albert Einstein**, ranked #1 in LatAm, has run Millennium since around 2013–2015 under a **R$180M** deal [143][144].
- **Other vendors:** **Wareline** (30+ years), **TOTVS Saúde** (ERP-centric) and Pixeon are in the market [141]. InterSystems and MEDITECH expanded beyond Brazil in 2025 [45]. No Epic LatAm hospital deployments were found [U].
- **Market size.** Brazil HIS is forecast at about **15.3% CAGR** for 2025–2035, but this comes from a low-reliability analyst [145].

**Implication.** LatAm is a regional duopoly in transition. Tasy's new owner is focused on procurement and RCM, and MV is dominant. That creates an opening for a modern cloud HIS in Spanish-speaking markets such as Mexico, Colombia, Chile and Peru, where neither MV nor Tasy is entrenched [U].

---

## 7. Africa

| Country | Public sector | Private sector |
|---|---|---|
| **South Africa** | Provincial systems (mixed) [U] | The "big three" (Netcare, Life, Mediclinic) hold about 83% of private beds [148]. **Netcare CareOn** runs on Deutsche Telekom **iMedOne** plus Apple, Micromedex and Philips Capsule. It went live in all acute hospitals (45 hospitals, 13,000+ iPads) after a 2019 pilot, and Netcare calls it its "highest risk project ever" [146][147]. Mediclinic Southern Africa and Life Healthcare EHR vendors were **not verified**. MEDITECH has had a South African office since 1982 [U]. |
| **Kenya** | **Taifa Care HMIS** is KenyaEMR rebuilt on **OpenMRS** and relaunched in 2025 [149]. Since **29 June 2026, all Level 4 public hospitals must submit SHA (insurance) claims only via Taifa Care**. Providers must integrate within three months or risk losing SHA contracts [150]. | Private hospitals must integrate with SHA/Taifa Care. Commercial HIS vendors include Indian and local players [U]. |
| **Rwanda** | **e-Ubuzima** is a home-grown national EMR linked through a national HIE to insurance, labs and pharmacy, keyed on national ID. The target was paper-free public facilities by end-2025; whether that was achieved is not verified [151]. | Small |
| **Ghana** | **LHIMS** (Lightwave E-Healthcare) was reported to cover about 61% of public facilities and about 21M records, with a formal national launch in October 2024 [152][153]. **Resolved in pass 2:** the December 2025 *Ghana Medical Journal* paper (59(4):177–180) confirms the Ministry of Health **discontinued LHIMS**. Its phase II contract, running since March 2019, expired in December 2024. The paper cites failure to digitize the targeted 950 facilities despite extensions, deficient hardware procurement, outages that forced hospitals back to paper, and concerns about cloud hosting in India. The vendor disputes some claims. The MoH is replacing it with the state-owned **Ghana Health Information Management System (GHIMS)**. The author urges a standards-based (HL7 FHIR, ICD-11, SNOMED CT), multi-vendor accreditation model instead of a single state system [154]. | Local and Indian vendors [U] |
| **Nigeria** | No verified national HIS. A mix of OpenMRS/DHIS2 programs and state initiatives [U] | Local SaaS and Indian vendors [U] |
| **Egypt** | Universal Health Insurance rollout. **Health Insights for Software Design** was selected in 2025 [45]. | Mixed |

**Pattern.** Governments increasingly make **interoperability with the national insurance or claims platform a condition of payment**, as in Kenya. They often prefer open-source or locally built public systems. Single-vendor national systems are fragile: Ghana's LHIMS was dropped in favor of a state-owned successor [154]. Commercial opportunity sits in **private hospitals and faith-based networks** that must integrate with those platforms, and in **standards-accredited multi-vendor** models where governments adopt them.

---

## 8. Market sizing

Analysts disagree mainly on **scope**: EHR only, versus "hospital information system" including RCM, PACS and ERP, versus all "healthcare information systems".

| Market definition | Analyst | 2025 value | Forecast | CAGR | Notes |
|---|---|---|---|---|---|
| Global EHR | Grand View Research [155] | US$35.9B | US$53.1B (2033) | 5.1% (2026–33) | North America 43%; **APAC fastest at 8.0%**; cloud/web 83.7% of revenue; hospital end-use 52.8% |
| Global EHR | Precedence Research [156] | US$28.86B | US$46.40B (2035) | 4.86% | North America about 46%; APAC fastest. Internal inconsistency on the page. |
| Global HIS | IMARC [157] | US$29.6B | US$61.8B (2034) | 8.5% | North America >45.8% |
| Global HIS (implied) | Grand View Research [113] | ~US$54.6B **[E]** | — | — | Derived: China HIS $2.184B is stated as 4.0% of global, so global ≈ $54.6B |
| Global "hospital information system" (broad) | Precedence Research [158] | US$185.25B | US$778.8B (2034) | 17.3% | Very broad scope; **treat as an outlier** |
| Global healthcare IS (very broad) | MarketsandMarkets [159] | US$290.4B (2022) | US$547.2B (2030) | 8.2% | Includes hardware and services; dated |
| China HIS | Grand View Research [113] | US$2.18B | US$4.62B (2033) | 9.9% | Cloud about 48% |
| China EHR | GlobeNewswire / R&M [120] | US$3.6B (2026) | US$7.1B (2031) | 14.5% | — |
| India EHR | Ken Research [124] | US$730M | US$1.27B (2032) | 8.2% | — |
| India healthcare IT | Ken Research [125] | US$760M | US$3.73B (2032) | 25.5% | Local players 70% |
| Japan EMR | Spherical / openPR (low reliability) [123] | about US$1.2B (2024) | US$2.6B (2035) | ~7% | — |
| Brazil HIS | Spherical Insights [145] | n/a | — | 15.3% | Low reliability |

**My working view [E]:**
- The **addressable global HIS/EHR software and services market is about US$30–55B in 2025**, growing **5–9% a year**.
- North America is about 40–46% of it but is **a slow-growth replacement market dominated by Epic**.
- **Growth hotspots** are the Gulf (Saudi clusters, UAE), India, Southeast Asia (Indonesia, Vietnam), DACH (IS-H forced migration through 2030), Eastern Europe and Spanish-speaking LatAm. Also growing are **adjacent layers**. Black Book expects interoperability, analytics, patient access, virtual care and workflow technology to grow faster than the core acute-care EHR market in Saudi Arabia through 2030 [88]. **Correction (pass 2):** the Black Book release does not single out AI. The view that AI layers such as ambient documentation, coding and RCM automation will grow fastest is my own [E], supported by US budget shifts [1].
- Unit-economics anchors from verified deals vary widely per bed: about **US$5K/bed** (ezCaretech in Saudi Arabia) and about **US$27K per client per year** (Tasy average), against hundreds of thousands to millions per hospital for Epic-class programs (section 9).

---

## 9. Business and pricing models

### 9.1 Model taxonomy

| Model | How it works | Who uses it | Pros (vendor / buyer) | Cons |
|---|---|---|---|---|
| **Perpetual license + annual maintenance** | Upfront license (per user, bed, module or site) plus about 18–22% a year maintenance [43][U] | Epic (self-hosted), Dedalus, CGM, Nexus, many legacy vendors | Vendor: cash upfront. Buyer: capex-friendly where public budgets favor capex (e.g., KHZG). | High entry cost; upgrade lock-in |
| **Vendor-hosted subscription** | License plus hosting bundled monthly | **Epic Hosting**, Oracle (OCI; i.s.h.med hosting) [55], **MEDITECH MaaS on Google Cloud (260+ licensed customers)** [34] | Lower IT burden | Still large, multi-year commitments |
| **Multi-tenant SaaS, per user per month** | Per provider or user | athenahealth (often priced as **% of collections** [U]), Canvas, Indian HIMS SaaS | Fast deployment, opex | Hard to fit to acute-care complexity |
| **Per bed per month / per facility** | Flat per licensed bed | Common in India, the Middle East and Africa SaaS HIMS [U] | Predictable; scales with hospital size | Under-monetizes large outpatient volumes |
| **Per encounter / % of net patient revenue** | Fee tied to throughput or collections | RCM outsourcing (TruBridge, athena) [U] | Aligns with revenue | Margin risk; hard for public hospitals |
| **Host–affiliate ("Community Connect")** | A large Epic customer hosts smaller hospitals and clinics on its instance and charges them per user or provider. Third-party estimates are about US$100–500 per user per month [44]. US Stark/AKS EHR donation rules require recipients to pay at least 15% of donated costs. Pass 2 confirmed this in the Stark exception, 42 CFR 411.357(w)(4): the physician must pay 15% of the donor's cost before receiving the initial or replacement donation, and the exception has no sunset [168]. The parallel AKS safe harbor (42 CFR 1001.952(y)) was not re-checked. | Epic: **all but one of its seven 2025 international contracts** [46]; 7 standalone US hospitals [2] | Regional network effects; cheaper for spokes | Spokes lose autonomy |
| **National / regional enterprise contracts** | Government buys one platform for a state or nation | NSW SDPR (Epic, ~A$969M), Singapore NGEMR, Helse Midt, Apotti, VA | One record | Mega-project risk |
| **Government-provided / open source** | Free core plus paid support and integration | Kenya Taifa Care (OpenMRS), India eHospital (NIC), Ghana GHIMS (state-owned successor to the discontinued vendor-run LHIMS [154]) | Zero license | Support quality, funding fragility |
| **App marketplace / platform fees** | Third-party apps pay for listing, APIs or revenue share | Epic **Showroom** (formerly App Orchard), Oracle partner programs | Ecosystem lock-in | Gatekeeping criticism (antitrust suits) [13] |
| **Data monetization / research networks** | De-identified, aggregated EHR data | **Epic Cosmos** (310M patients; Epic positions it for care and research, not data sales) [12]; **Truveta** ("built with and owned by US health systems"; **140M+ patients**; serves pharma, medical device, public-health and government customers, and cites regulatory projects with US and global agencies) [40] | New revenue; drives AI | Trust, consent, regulation (GDPR/EHDS, PDPL) |

### 9.2 Documented implementation costs and timelines

| Program | Vendor | Cost (as reported) | Timeline | Notes |
|---|---|---|---|---|
| Kaiser Permanente (KP HealthConnect) | Epic | **>US$6B** per Wikipedia [41]; ~US$4B is often cited elsewhere [U] (conflict) | About 6 years across 8 regions (~2004–2010) | More than US$0.5M per physician [41] |
| Partners / Mass General Brigham | Epic | **US$1.2B** initially reported (Boston Globe headline cited in [42]); **~US$1.6B** total by 2018, mostly lost revenue [181] (reconciled 2026-10-16; see the cost table below) | Launched 2015 | — |
| Mayo Clinic | Epic | ~US$1.5B [U] | 2018 go-live | Still unverified in pass 2. A 2016 Minneapolis/St. Paul Business Journal headline cited on Wikipedia calls the program (the "Plummer Project") a "$1B tech project," which conflicts with the figure. |
| US VA EHRM | Oracle Health | **~US$37B** lifecycle estimate [25] | 2018 to about 2031 | Paused 2023–2026 |
| Queensland ieMR | Cerner | **>A$1.45B** [21] | 10+ years | — |
| NSW SDPR | Epic | **A$969M** contract value (first reported as just over A$1B over 10 years); Audit Office warns integration costs were omitted [162] | October 2023 to 2028; phased in August 2026 [135] | AWS-hosted |
| Cambridge University Hospitals | Epic | **£200M** [74] | 2014 | Post-go-live crisis |
| Somerset & Dorset (4 trusts) | Epic | **£222M** [72] | Signed March 2026 | Federated instance |
| Charité Berlin | Epic | **~€200M over 10 years** [61][63] (one commentary says €250M) | 2025–2029 | Special borrowing law needed |
| Insel Gruppe Bern | Epic | **CHF 182.5M** total, including internal staff [U-partial] | Go-live March 2024 | Above early estimates |
| Helseplattformen (Norway) | Epic | Specialist-care scope: NOK ~3B rollout plus NOK 522M; may exceed NOK 5B against NOK 3.7B planned [76][77]. Whole programme: ~NOK 6.7B by Oct 2024 against a NOK 4.1B frame [176] (reconciled 2026-10-16) | 2022–2025 (2 years late) | 78% of doctors dissatisfied |
| Sundhedsplatformen (Denmark) | Epic | **DKK 2.8B** [74] | 2016–2017 | — |
| Apotti (Finland) | Epic | €408M [74] (Apotti FAQ: €407M investment cost [177]) vs ~€625M by Nov 2022 (Helsingin Sanomat via Wikipedia) (conflict; scopes differ) | 2018–2022+ | — |
| VGR (Sweden) | Oracle Millennium | **SEK ~3.8B sunk + SEK 657M exit**; modular replacement SEK 5.5–11B [83][84] | 2018–2026, failed | Rolled back in 3 days |
| Albert Einstein (Brazil) | Cerner | **R$180M** [143] | ~2013–2015 | — |
| Care Med (Saudi), 4 hospitals, ~1,300 beds | ezCaretech | **~US$6.96M** [93] | 2026– | ~US$5K per bed [E] |

**Reconciled cost table (2026-10-16), shared with `10` §4.12/§5.1/§6.1.** Reported figures often mix scopes. This table separates the vendor/system contract, total programme cost (including internal labour) and lost revenue, each with its date.

| Program | Vendor / system contract | Total programme cost (incl. internal) | Lost revenue | Status of evidence |
|---|---|---|---|---|
| Helseplattformen (Norway, Epic) | Original acquisition-cost estimate **NOK 1.7B** over an 18-year life (Sunnmørsposten, 3 Apr 2024, via Norwegian Wikipedia) | Original frame **NOK 4.1B**; **~NOK 6.7B** "so far" for preparation, development and rollout across health trusts, municipalities and GPs (NRK, 24 Oct 2024, reporting on the Riksrevisjonen report) [176]. Specialist-care scope: ~NOK 3B + NOK 522M, may exceed NOK 5B vs NOK 3.7B planned (Helse Midt-Norge, 2025) [76][77] | Not quantified | Riksrevisjonen, Dokument 3:3 (2024–2025), 24 Oct 2024: "sterkt kritikkverdig"; costs higher than planned and future costs uncertain. The summary page gives no figures [182] |
| Apotti (Finland, Epic) | Not separately reported | **€407M** investment cost "in its current scope" (licences, development incl. integrations, technical environment, training; Apotti FAQ, undated) [177], ≈ PLOS €408M [74]. **€625M** "by Nov 2022" (Helsingin Sanomat, 5 Nov 2022, via Wikipedia; scope unclear) | Not reported | **Conflicting; scopes not reconciled.** Use €407M for investment cost and flag €625M as unverified scope |
| Mass General Brigham (US, Epic) | Software payments **< US$100M** (New Yorker, 5 Nov 2018) [181] | **US$1.2B** initially reported (Boston Globe, 16 May 2016) [42]; **~US$1.6B** total by 2018 [181] | **Most of the US$1.6B** was lost patient revenue [181] | Secondary (press via Wikipedia) |

**Total cost of ownership (TCO) observations:**
1. **Internal costs often equal or exceed vendor fees.** Insel's breakdown is CHF 101.6M external, CHF 52.5M internal staff and CHF 28.4M infrastructure [U-partial]. Most public programs overran their original budgets: Helse Midt, Apotti, Insel and VGR.
2. **Exit costs are real and contractual.** VGR's SEK 657M exit fee is one example. Norwegian commentators note Helseplattformen has "no real exit agreement" with Epic [U, opinion piece].
3. **The timeline floor for an enterprise big-bang is about 18–24 months per wave.** Charité plans four years to full rollout and NSW five years. A modular entrant (Avelios) still targets 18–24 months for full replacement [53].
4. **Emerging-market price points are one to two orders of magnitude lower per bed** than Western mega-programs [E: compare ~US$5K/bed in Saudi Arabia (Care Med) with Charité's ~€200M across roughly 3,000 beds (≈€65K/bed over 10 years); the Charité bed count is approximate, [U]].

---

## 10. Why winners win, and why others lost

### 10.1 Epic's dominance: the mechanics

1. **One database, one code base, one patient record** across inpatient, ambulatory, ED, OR, pharmacy, lab, revenue cycle and portal. That makes cross-domain workflows, decision support and analytics native rather than integrated. It also makes Epic sellable to the **CFO** (revenue capture through integrated charge capture and billing) as well as the CMIO.
2. **Implementation methodology as a product.** The **Foundation System** gives a pre-built content and configuration baseline. Customer staff are **certified analysts**, and Epic runs prescriptive go-live playbooks [U, widely documented]. Customers own the build, so they are invested in success.
3. **Network effects on four layers:**
   - **Care Everywhere** for record exchange among Epic sites, the main driver of Community Connect decisions in 2025 [2]
   - **MyChart**, with about 150M patients and one app across many providers [13]
   - **Cosmos**, with 310M patients powering benchmarks, CoMET and AI [12]
   - **Community Connect**, which turns every large customer into a regional distributor [2][46]
4. **Reputation flywheel.** Epic has won Best in KLAS Overall Suite for 16 straight years [30]. Boards buy the low-risk choice, and a lost Epic deal is rare.
5. **Private, patient capital and organic R&D.** Epic has not grown through acquisitions, so it has not had to integrate portfolios. That contrasts sharply with competitors (10.2).
6. **AI built into the workflow.** Art, Emmie and Penny ship inside the EHR [8][9]. Bolt-on AI vendors now face a "free and integrated" competitor.

**Epic's vulnerabilities, which are our openings:**
- **Cost.** Charité needed a legal change to finance its deal [63].
- **Usability complaints in Europe.** Satisfaction among Norwegian doctors is low [76].
- **Localization failures.** Denmark had mistranslated prompts [74].
- **Closed-ecosystem antitrust litigation** from Particle Health, CureIS and the Texas AG [13].
- **Slow AI trickle-down to smaller customers**, with an estimated 6–18-month lag for some community sites [11].
- **Little to no presence in price-sensitive markets:** India, Africa, most of LatAm and SE Asia.
- **No ERP.** US customers pair Epic with Workday, Oracle Fusion or Infor [31].

### 10.2 Why others lost ground

| Vendor | What happened | Lesson for us |
|---|---|---|
| **Cerner → Oracle Health** | Acquisition distraction; VA/DoD program strain; slow cloud re-platforming; announced a *new* EHR instead of evolving Millennium, which froze buyers; customer satisfaction declined [20]; VGR and Skåne failures [21][83]; sale rumors [53] | Platform discontinuity kills renewals. A clear, credible single roadmap matters as much as features. |
| **Allscripts → Altera + Veradigm** | Portfolio assembled by acquisition (Eclipsys Sunrise, McKesson Paragon); hospital unit sold to Harris in 2022; Veradigm reporting problems [37][38][U] | Multi-product portfolios without a unified data model lose to integrated suites. |
| **Siemens Soarian, GE Centricity, McKesson Horizon** | Sold, sunset or folded into others (Soarian to Cerner, then DE/ES to CGM) [53][U] | Conglomerates rarely sustain HIS R&D. |
| **SAP IS-H** | Exited the market (no S/4HANA successor) [49] | Even giants exit when the vertical is not core. Hospitals fear "orphaned platforms," so vendor durability is a buying criterion. |
| **Mesalvo (selected cases)** | Austrian client recommitted to Oracle; large contract canceled [45][46] | Functional depth gaps in acute care are fatal at go-live. Don't oversell breadth. |
| **Dedalus** | Market leader, but low KLAS scores (73.5 DACH) and repeated PE ownership churn [32][67][68] | Installed base without satisfaction is vulnerable to a better product. |

### 10.3 Market gaps and complaints

1. **Cost and financing.** Tier-1 EHR programs cost hundreds of millions to billions and need special financing (Charité) or overrun budgets (Norway, Finland, Switzerland).
2. **Usability and clinician burden.** Dissatisfaction runs from one-third (Denmark) to 78% (Norway, doctors) [74][76]. AI documentation is the first real relief, and buyers now spend on it ahead of EHR replacement [1].
3. **Closed ecosystems and data control.** Antitrust suits against Epic [13], European sovereignty demands [79], and the EHDS portability mandate [74].
4. **Big-bang failure risk.** VGR now explicitly prefers **modular** systems over "one big monolithic system" [83][84].
5. **Poor fit for emerging markets.** Western suites lack TPA/insurance workflows (India), national claims integration (NPHIES, SHA Kenya, NHIA Ghana, ABDM), multi-currency and cash-pay billing, Arabic RTL, low-bandwidth or offline tolerance, and per-bed pricing at US$1–10K per bed.
6. **Mid-size hospitals are underserved.** In the US, MEDITECH's KLAS score in the small-hospital segment is 77.1 against Epic's 89.7 in large hospitals [31][33]. In DACH, 400–800-bed hospitals face forced IS-H migration with weak options [53]. Local incumbents in India, the Middle East and SE Asia have aging stacks.
7. **Fragmented EHR/ERP.** Hospitals stitch clinical EHR to SAP, Oracle Fusion or Workday for supply chain, finance and HR. Alrajhi Medicine's unified Oracle EHR+ERP deal shows demand for a bundle [90]. Clinical–operational integration (cost per case, inventory-to-patient charging, staffing to acuity) is a weak point in most stacks.
8. **Legacy migration.** IS-H and i.s.h.med (500+ DACH hospitals), Tasy's ownership change (reported at roughly 1,000 to more than 2,000 institutions; sources conflict), Altera's and Oracle's uncertain bases, and MEDITECH legacy platforms all mean **millions of beds face a forced or likely migration this decade**.
9. **AI governance and regulation.** Buyers want transparent AI (Oracle labels data sources and limitations [16]). CDS may be a regulated medical device (IntelliCare EU MDR IIa [106]).

---

## 11. Market gaps and opportunities for a new entrant

| # | Opportunity | Evidence | Size / urgency | Fit for a new entrant |
|---|---|---|---|---|
| 1 | **Private multi-hospital groups in GCC, India and SE Asia** (50–800 beds) needing modern HIS+ERP | Saudi clusters and private groups; ezCaretech's Care Med deal; India local 70% share; KLAS shows Akhil/Aosta/Origin/Amalga growth [45][88][93][125] | High growth; buyers open to non-US vendors | **Strong** |
| 2 | **Forced-migration windows**: SAP IS-H in DACH (to 2030), Tasy owner change, Oracle and Altera uncertainty | [49][53][139][1][37] | Large but demands deep localization (DE billing, DRG, telematics, ISiK) | **Medium.** DACH needs a German team and certification. Avelios shows it can be done. |
| 3 | **Modular, sovereign platforms for European public buyers** after big-bang failures | VGR modular strategy (SEK 5.5–11B), EHDS [74][84] | Large, slow procurement | **Medium/long-term** via openEHR/FHIR components |
| 4 | **Insurance and claims-integrated HIS for UHC markets** (Kenya SHA, Ghana NHIA, India PM-JAY/ABDM, Egypt UHI, Saudi NPHIES) | Kenya mandates claims through Taifa Care [150] | High volume, low price | **Strong** if built with integration adapters from day one |
| 5 | **AI-native workflow layer** that can also run *on top of* incumbents (ambient, coding, discharge summaries, bed management, nurse documentation) | Buyers shifting budget to AI [1]; Abridge 94.7 [31]; Epic's AI lag for small sites [11] | Fast revenue; Epic competes for its own base | **Strong** as a wedge product, weaker as a moat |
| 6 | **Spanish-speaking LatAm mid-market** | No dominant modern cloud HIS outside Brazil [U][138] | Medium | **Medium** |
| 7 | **Hub-and-spoke "community connect" for hospital groups and their affiliated clinics** in emerging markets | Epic's international growth is almost all Community Connect [46] | Medium | **Strong.** Multi-tenant SaaS makes this natural. |

---

## 12. Implications for our build (opinionated)

### 12.1 Positioning

- **Primary segment.** **Private and mixed-ownership hospitals and hospital groups of 50–800 beds in fast-growing, non-US markets.** Start with **GCC (Saudi Arabia, UAE), India and SE Asia (Indonesia, Vietnam, Malaysia)**, then East Africa and Spanish-speaking LatAm.
  - These buyers have rising digital mandates (HIEs, national claims, accreditation), are underserved by Epic on price and delivery, and run aging local incumbents.
  - **Sequencing (reconciled 2026-10-16 to the pack's single market roadmap, `06` §8):**
    - **Wave 1:** India + KSA.
    - **Wave 1b:** UAE.
    - **Wave 2:** *one* of Indonesia, Kenya or another SE Asian market (Vietnam/Malaysia). DACH enters only through a partner.
    - **US:** a Phase 3 go/no-go.
    - Other regulated high-income markets (UK, EU, Australia, Canada) are Wave 3 candidates.
- **Value proposition.** *"An Epic-grade single-record HIS with a natively joined clinical-operational ERP, at emerging-market prices, AI-native and open by default."* *(Reconciled 2026-10-16: "live in 6–12 months" is now a **mature-product target for <150-bed hospitals on foundation content**. Most 100–300-bed hospitals need 12–18 months (`10` §4.2/§4.12). The first design-partner go-live is set by the critical-path build plan in the proposed business-plan report (12), realistically around M18–24 or later.)*
- **Not first:** US acute care (Epic lock-in, ONC certification, KLAS reference moat) and China (closed). Treat **DACH** as an opportunistic second wave via an IS-H replacement or billing module with a German partner, following Avelios's playbook.

### 12.2 Must-have capabilities to be credible

Tables stakes come from the winners' playbooks and buyer criteria [2][53][88][124].

1. **A single longitudinal patient record and a single transactional data model across clinical, revenue and clinical-operational ERP.** This is Epic's core advantage. Do not ship a portfolio of loosely integrated apps; that is the Allscripts and Oracle lesson. *(Reconciled 2026-10-16: enterprise ERP functions such as payroll/HCM, enterprise GL and full procure-to-pay are integrated by connectors where the customer runs an ERP; see #4 and `05` §9.1.)*
2. **Acute clinical depth:**
   - ADT and bed management/capacity (a gap MEDITECH customers flag [2])
   - CPOE with order sets and **closed-loop medication** (eMAR + barcode/BCMA)
   - Nursing documentation and flowsheets
   - ED, OR/anesthesia, ICU charting with device integration
   - Clinical pathways
   - Lab (LIS) and radiology (RIS) with PACS/DICOM integration, pharmacy, blood bank
   - *(Reconciled 2026-10-16: "credible" here means reference-site maturity. The interim MVP for a 100–300-bed private multispecialty hospital in India/KSA covers the following; see `03` §2/§21 and `04` §11 #15. The proposed requirements catalogue (report 14) is still to be written.)*
     - *ED;*
     - *native clinical-pathology LIS and RIS;*
     - *OT scheduling and a basic intra-op record;*
     - *ICU vitals feed (lite);*
     - *bedside transfusion verification with an interface to an external blood bank;*
     - *microbiology and anatomic pathology as interfaces.*

     *Full AIMS, ICU device-integrated charting and smart-pump interoperability are P2 unless a design partner requires them.*
3. **Revenue cycle localized per market:** NPHIES (Saudi Arabia), DHA/DoH e-claims (UAE), ABDM/PM-JAY and TPA (India), SHA (Kenya), NHIA (Ghana), DRG and grouper engines (DACH, Gulf), cash, deposit and package billing, multi-currency and VAT/GST.
4. **Clinical-operational ERP natively joined to clinical events** *(reconciled 2026-10-16 to the `05` §9.1 split; native payroll dropped)*:
   - **Native:** patient ledger; clinical supply chain and inventory with point-of-use charging; pharmacy stores; biomedical asset management (CMMS); acuity data and basic rostering; costing per case.
   - **Native "lite" for emerging-market tenants:** procurement (PR→PO→GRN) and a lightweight GL/AP/AR/fixed-asset module.
   - **Integrate:** payroll/HCM (regulated and country-specific), enterprise GL and full procure-to-pay where the customer already runs an ERP (Workday/Oracle/SAP/Infor/Dynamics/Odoo).

   This is the differentiator versus EHR-only vendors: a clinical-operational ERP joined to clinical events, not a full ERP. The precedents are Alrajhi Medicine's EHR+ERP bundle [90] and Bionexo's procurement-plus-Tasy thesis [139].
5. **Patient app (a "MyChart-class" portal and app):** booking, payments, results and telehealth, in Arabic RTL and other local languages and scripts. *(Reconciled 2026-10-16: the MVP has a basic patient app, WhatsApp/SMS engagement, national rails and an OPD token queue for India/KSA. The full MyChart-class portal is P2; see `03` §2 and `09` §9.2.)*
6. **Interoperability:**
   - HL7 v2, **FHIR R4** (national profiles: ABDM, NPHIES, ISiK, AU Core)
   - IHE XDS/XCA, DICOM, SNOMED CT/ICD-10/11, LOINC
   - Plug-in adapters for national HIEs (Malaffi, Riayati, NABIDH, SATUSEHAT)
   - An **openEHR-compatible** clinical data repository option for European public buyers
7. **AI natively in the workflow, with governance:** ambient documentation (any language), coding assistance, discharge summaries, nurse voice charting (Oracle's September 2026 move [19]), and denial prediction. Show AI provenance and limitations, as Oracle does [16]. Plan for **EU MDR / SaMD** classification of CDS [106].
8. **Multi-tenant cloud with in-country data residency:** AWS, Azure, GCP and sovereign or regional clouds such as StackIT or Saudi/UAE regions. Include **offline and low-bandwidth tolerance** for district hospitals, plus documented downtime and business-continuity procedures.
9. **Implementation accelerators:** a pre-built "foundation" configuration per country (order sets, charge masters, payer rules), data-migration toolkits for common incumbents, a configuration-not-code admin console, and a certification program for customer and partner analysts. That last item is Epic's methodology moat, rebuilt for partners.
10. **Analytics:** an operational data store plus warehouse, regulatory and accreditation reporting (JCI, NABH, CBAHI), and benchmarking across tenants (a Cosmos-like dataset with explicit consent and governance).

### 12.3 Business model recommendations

- **Subscription priced per licensed bed per month** for inpatient, plus **per provider** for ambulatory, with transparent tiers. Use emerging-market anchors of roughly **US$1.5–6K per bed per year all-in** [E, triangulated from ezCaretech at ~US$5K per bed one-time and Tasy at ~US$27K per client per year]. Validate with pilots.
- **Fixed-fee implementation packages.** Target 6–12-month go-lives for <150-bed hospitals on foundation content once the product is mature, and 12–18 months for 150–500 beds (`10` §4.2). Avoid open-ended time-and-materials. *(Reconciled 2026-10-16: this previously said "6–12-month go-lives for 100–300-bed hospitals".)*
- **A hub-and-spoke "Group Connect" model.** Hospital groups host their affiliated clinics and smaller hospitals on their tenant, with revenue sharing. This copies Epic's most effective growth engine [46].
- **Open APIs and an app marketplace with no gatekeeping fees** for basic FHIR access. Turn Epic's antitrust exposure [13] into our positioning.
- **No sale of identifiable data.** Any research or benchmarking network should be opt-in and governed like Truveta, with health systems as co-owners [40].

### 12.4 Pitfalls to avoid

1. **Big-bang go-lives without readiness gates.** VGR rolled back in three days [83]. NSW phased its tranche after a readiness assessment [135]. Build go-live readiness scoring and fast rollback into the product.
2. **Under-localizing.** Danish mistranslations [74] and the Austrian "couldn't deliver needed functionality" case [46] show the risk. Localization covers workflow, billing and regulation, not just strings.
3. **Over-customization per customer.** Japan's customization led to near-zero interoperability [122]. Keep **one code base**, with configuration and an extension SDK.
4. **Breadth before depth.** Acute nursing, medication and OR workflows must be excellent at first go-live. Clinician dissatisfaction is the number-one reason projects fail politically (Norway, Finland).
5. **Platform discontinuity.** Never force customers through a "new EHR" rewrite as Oracle did. Design for **evergreen** continuous delivery from day one.
6. **Vendor-viability perception.** SAP's exit and Oracle's sale rumors make buyers ask whether we will be around. Counter with escrow, data portability guarantees, strategic investors or partners (the SAP and Fresenius pattern with Avelios [58][60]) and published reference sites.
7. **Security and resilience.** Hospitals are top ransomware targets, and Oracle had a 2025 breach of legacy Cerner servers [21]. Build in zero-trust, immutable backups and tested downtime modes.

### 12.5 Top five recommendations (summary)

1. **Target non-US private hospital groups (50–800 beds) in GCC, India and SE Asia first.** Use India for scale and price discipline and the Gulf for margin and reference value. Reconciled 2026-10-16 sequence: Wave 1 India + KSA, Wave 1b UAE, then one SE Asian market or Kenya (`06` §8).
2. **Build one integrated record and data model spanning clinical, revenue cycle and clinical-operational ERP**, with native national-claims adapters. The main differentiator against both Epic (no ERP) and local incumbents (shallow clinical depth) is a clinical-operational ERP natively joined to clinical events, not a full ERP. Payroll/HCM and enterprise GL are integrated (reconciled 2026-10-16; `05` §9.1).
3. **Make implementation speed a product feature.** Ship country foundation content, migration tooling, readiness gates and a partner certification program. The target is 6–12-month go-lives for <150-bed hospitals once the product is mature, and 12–18 months for mid-size hospitals (reconciled 2026-10-16; `10` §4.12).
4. **Be AI-native and open by default.** Embed ambient, coding and nursing AI with provenance. Provide FHIR/openEHR APIs and a free-access marketplace, and position directly against closed ecosystems.
5. **Use multi-tenant, sovereign-cloud SaaS with per-bed pricing and a hub-and-spoke group model.** Optionally add an AI-workflow "wedge" product that can sit on top of incumbents to win early revenue and references.

---

## Sources

**United States**
1. KLAS Research, "US Acute Care EHR Market Share 2026: Market Uncertainty Significantly Cuts Buying Decisions" (May 2026). https://klasresearch.com/report/us-acute-care-ehr-market-share-2026-market-uncertainty-significantly-cuts-buying-decisions/3956
2. HIT Consultant, "KLAS 2026 EHR Market Share Report: Epic Gains as Oracle Health Faces Third Year of Losses" (14 May 2026). https://hitconsultant.net/2026/05/14/klas-2026-ehr-market-share-report/
3. Fierce Healthcare, "Epic grows EHR footprint among small health systems even as overall market sales decline in 2025." https://www.fiercehealthcare.com/health-tech/epic-continues-grow-ehr-market-share-it-makes-gains-small-health-systems
4. Health System CIO, "Epic Expands Reach Among Smaller Hospitals as Oracle Health Losses Mount, KLAS Finds" (14 May 2026). https://healthsystemcio.com/2026/05/14/acute-care-ehr-market-share-2026/
5. Healthcare IT News, "Epic gains ground as acute care EHR purchasing slows." https://www.healthcareitnews.com/news/epic-gains-ground-acute-care-ehr-purchasing-slows
6. SPRY, "Top EMR Software Companies 2026" (secondary source citing KLAS). https://www.spryhealth.ai/blog/top-emr-software-companies
7. Definitive Healthcare, "Most common hospital EHR systems by market share" (April 2026). https://www.definitivehc.com/blog/most-common-inpatient-ehr-systems
8. CNBC, "Epic UGM 2025: Epic touts new AI tools" (20 Aug 2025). https://www.cnbc.com/2025/08/20/epic-ugm-2025-epic-touts-new-ai-tools.html
9. Healthcare IT News, "Epic unveils AI agents, showcases new foundational models." https://www.healthcareitnews.com/news/epic-unveils-ai-agents-showcases-new-foundational-models
10. Fierce Healthcare, "Epic unveils AI solutions for clinicians, patients and RCM, gives sneak peek at Cosmos AI." https://www.fiercehealthcare.com/health-tech/epic-unveils-major-ai-features-ai-charting-microsoft-cosmos-ai-risk-prediction-and-rcm
11. FQHC Talent, "Epic's 2026 AI Rollout (Art, Emmie, Penny) Reaches OCHIN, But on a 6–18 Month Lag" (secondary). https://www.fqhctalent.com/intel/epic-art-emmie-penny-ugm-2025-2026-rollout
12. Epic Cosmos (statistics accessed Oct 2026). https://cosmos.epic.com/
13. Wikipedia, "Epic Systems" (accessed Oct 2026). https://en.wikipedia.org/wiki/Epic_Systems
14. Epic, "Innovators Convene at Epic's Inaugural European Group Meeting" (June 2024). https://www.epic.com/epic/post/innovators-convene-at-epics-inaugural-european-group-meeting-to-address-global-healthcare-challenges/
15. Oracle, "Oracle Ushers in New Era of AI-Driven Electronic Health Records" (13 Aug 2025). https://www.oracle.com/news/announcement/oracle-ushers-in-new-era-of-ai-driven-electronic-health-records-2025-08-13/
16. Healthcare Dive, "Oracle launches AI-backed EHR." https://www.healthcaredive.com/news/oracle-new-ehr-artificial-intelligence-ai/757588/
17. Oracle, "ONC Certification of Oracle's AI-Powered EHR Marks Turning Point" (18 Nov 2025). https://www.oracle.com/news/announcement/onc-certification-oracle-ehr-marks-turning-point-for-healthcare-industry-2025-11-18/
18. Healthcare Dive, "Oracle launches AI-driven patient portal" (Aug 2026). https://www.healthcaredive.com/news/Oracle-launches-AI-driven-patient-portal/827656/
19. HIT Consultant, "Oracle Health Clinical AI Agent for Nurses Expands Inpatient EHR Automation" (14 Sep 2026). https://hitconsultant.net/2026/09/14/oracle-health-launches-clinical-ai-agent-for-nurses-inpatient-ehr-documentation/
20. KLAS Research, "Oracle Health 2025: How Are Customers Faring Three Years Post-Acquisition?" https://klasresearch.com/report/oracle-health-2025-how-are-customers-faring-three-years-post-acquisition/3827
21. Wikipedia, "Oracle Health" (accessed Oct 2026). https://en.wikipedia.org/wiki/Oracle_Health
22. VA Digital, EHR Modernization news releases (accessed Oct 2026). https://digital.va.gov/ehr-modernization/news-releases/
23. Healthcare Dive, "VA deploys Oracle EHR at four Michigan medical centers" (Apr 2026). https://www.healthcaredive.com/news/veterans-affairs-va-medical-centers-michigan-oracle-ehr/817470/
24. Nextgov/FCW, "VA resumes EHR rollouts at four Michigan medical sites" (Apr 2026). https://www.nextgov.com/modernization/2026/04/va-resumes-ehr-rollouts-four-michigan-medical-sites/412807/
25. Federal News Network, "VA EHR rollout resumes after three-year pause" (Apr 2026). https://federalnewsnetwork.com/it-modernization/2026/04/va-ehr-rollout-resumes-after-three-year-pause/
26. VA News, "VA's Federal EHR rollout success continues in Southern Ohio" (Jun 2026). https://news.va.gov/147501/vas-federal-ehr-rollout-success-continues-in-southern-ohio/
27. ExecutiveGov, "VA to Restart Oracle-Cerner EHR Rollout With 2026 Regional Go-Lives." https://www.executivegov.com/articles/va-ehr-launch-oracle-cerner-13-sites
28. U.S. House VA Committee, testimony of S. Verma (15 Dec 2025). https://docs.house.gov/meetings/VR/VR11/20251215/118749/HHRG-119-VR11-Wstate-VermaS-20251215.pdf
29. KLAS Research, "2026 Best in KLAS Awards — Software & Services." https://klasresearch.com/report/2026-best-in-klas-awards-software-and-services/3906
30. KLAS press release, "Epic, athenahealth, Chartis, Optimum Healthcare IT and Impact Advisors win 2026 Overall Best in KLAS Awards." https://engage.klasresearch.com/press-release/epic-athenahealth-chartis-optimum-healthcare-it-and-impact-advisors-win-2026-overall-best-in-klasawards/
31. HIT Consultant, "2026 Best in KLAS Awards: The Full List of Software & Services Winners" (4 Feb 2026). https://hitconsultant.net/2026/02/04/2026-best-in-klas-winners-full-list-software-services/
32. KLAS Research, "2026 Best in KLAS Awards — Global Software." https://klasresearch.com/report/2026-best-in-klas-awards-global-software/3907
33. Becker's Hospital Review, "Best in KLAS 2026: Who's winning in ambient AI, EHRs, revenue cycle and more." https://www.beckershospitalreview.com/healthcare-information-technology/ehrs/best-in-klas-2026-whos-winning-in-ambient-ai-ehrs-revenue-cycle-and-more/
34. MEDITECH, "MEDITECH secures Best in KLAS for a 12th consecutive year." https://ehr.meditech.com/news/meditech-secures-best-in-klas-for-a-12th-consecutive-year
35. Health System CIO, "Meditech Expanse Now Runs 72 HCA Healthcare Hospitals" (15 Sep 2026). https://healthsystemcio.com/2026/09/15/hca-meditech-expanse-72-hospitals/
36. MEDITECH, "About MEDITECH." https://ehr.meditech.com/about/meditech
37. Altera Digital Health, "Executive Leadership Transitions" (Oct 2026). https://www.alterahealth.com/newsroom/executive-leadership-transitions/
38. Becker's Hospital Review, "14 health systems extend EHR contracts with Altera Digital Health" (Feb 2026). https://www.beckershospitalreview.com/healthcare-information-technology/ehrs/14-health-systems-extend-ehr-contracts-with-altera-digital-health/
39. athenahealth, "2026 Best in KLAS Award Recognitions." https://www.athenahealth.com/about/awards/best-in-klas-recognitions
40. Truveta (accessed Oct 2026). https://www.truveta.com/
41. Wikipedia, "Kaiser Permanente" (KP HealthConnect section). https://en.wikipedia.org/wiki/Kaiser_Permanente
42. Wikipedia, "Mass General Brigham" (citing "Partners' $1.2b patient data system seen as key to future"). https://en.wikipedia.org/wiki/Mass_General_Brigham
43. Topflight Apps, "Epic EHR Pricing 2026" (third-party estimates). https://topflightapps.com/ideas/epic-ehr-cost/
44. Mindbowser, "Epic Community Connect: The Complete Guide" (third-party estimates). https://www.mindbowser.com/epic-community-connect-guide/

**Global and Europe**

45. KLAS Research, "Global Hospital EHR Market Share 2026: Purchasing Decisions Drop to Almost Five-Year Low" (7 Jul 2026). https://klasresearch.com/report/global-hospital-ehr-market-share-2026-purchasing-decisions-drop-to-almost-five-year-low/3955
46. HIT Consultant, "KLAS Releases Global Hospital EHR Market Share 2026 Report" (8 Jul 2026). https://hitconsultant.net/2026/07/08/klas-global-hospital-ehr-market-share-2026/
47. Healthcare IT News, "KLAS: Epic grows global EHR market share, Oracle sees both gains and losses abroad." https://www.healthcareitnews.com/news/klas-epic-grows-global-ehr-market-share-oracle-sees-both-gains-and-losses-abroad
48. KLAS Research, "Global Acute Care EHR Market Share 2025." https://klasresearch.com/report/global-acute-care-ehr-market-share-2025-large-regional-decisions-impact-a-broad-number-of-hospitals/3725
49. INFORMATICS, "The future of SAP IS-H and i.s.h.med — paths to 2035." https://www.informatics.at/en/news/zukunftschancen-durch-wandel/
50. Natuvion, "SAP IS-H has been retired. Now what?" https://www.natuvion.com/newsroom/sap-ish-now-what/
51. seppmed, "SAP IS-H discontinued in 2030" (Jan 2026). https://www.seppmed.com/2026/01/26/hospital-it-sap-is-h-discontinued-in-2030/
52. The Register, "SAP user group calls for support deadline reprieve" (Sep 2023). https://www.theregister.com/2023/09/06/sap_users_group_support_deadline_reprieve/
53. kma-online, "KIS-Markt 2026: Trends, Anbieter und Strategien im Überblick." https://www.kma-online.de/aktuelles/it-digital-health/detail/kis-markt-2026-trends-anbieter-und-strategien-im-ueberblick-55364
54. Krankenhaus-IT Journal, "Marktübersicht IS-H Nachfolge 2024." https://www.krankenhaus-it.de/category.94/marktuebersicht-ish-nachfolge-2024.html
55. E-HEALTH-COM, "Über 70 Digitalisierungsprojekte erfolgreich umgesetzt: Oracle Health…" (12 Feb 2026; pass 1 listed this as October 2026). https://e-health-com.de/details-unternehmensnews/ueber-70-digitalisierungsprojekte-erfolgreich-umgesetzt-oracle-health-unterstuetzt-kliniken-bei-der-m/
56. Oracle Deutschland, "Gemeinsam erfolgreich" (DMEA 2025 blog). https://www.oracle.com/de/news/announcement/blog/together-we-thrive-oracle-health-dmea-2025-04-08/
57. SAP News, "Universitätsklinikum Tübingen setzt auf S4.health als Nachfolgelösung für IS-H" (Nov 2025). https://news.sap.com/germany/2025/11/universitaetsklinikum-tuebingen-setzt-auf-s4-health-als-nachfolgeloesung-fuer-is-h-von-sap/
58. Avelios, "IS-H Nachfolge: SAP & Avelios schließen strategische Partnerschaft." https://www.avelios.com/en/is-h-nachfolge
59. TechCrunch, "Avelios nabs $31M led by Sequoia" (6 Feb 2025). https://techcrunch.com/2025/02/06/avelios-nabs-31m-led-by-sequoia-to-fix-the-ailing-world-of-healthcare-it/
60. Munich Startup, "Fresenius invests in Munich-based healthtech startup Avelios Medical" (2026). https://www.munich-startup.de/en/120509/fresenius-invests-in-avelios/
61. HTN, "Epic wins Germany's largest university hospital" (16 Dec 2025). https://htn.co.uk/2025/12/16/epic-wins-germanys-largest-university-hospital/
62. heise online, "Epic Systems: US provider wins Charité tender." https://www.heise.de/en/news/Epic-Systems-US-provider-wins-Charite-tender-11114132.html
63. kma-online, "Charité: KIS-Finanzierung von Epic steht" (2026). https://www.kma-online.de/aktuelles/it-digital-health/detail/charite-kis-finanzierung-von-epic-steht-55963
64. DigitalRadar Krankenhaus, press release on second survey results (9 Jan 2025). https://www.digitalradar-krankenhaus.de/pressemitteilung-zur-auswertung-der-ersten-ergebnisse-der-zweiten-datenerhebung-9-januar-2025/
65. DigitalRadar Krankenhaus, press release on third survey first results (Jun 2026). https://www.digitalradar-krankenhaus.de/pressemitteilung-zu-den-ersten-ergebnissen-der-dritten-erhebung/
66. Swisscom, "SAP IS-H is being replaced by GS-H." https://www.swisscom.ch/en/business/enterprise/offer/health/gsh.html
67. Ardian, "Ardian strengthens its commitment to Dedalus…" (2023). https://www.ardian.com/news-insights/press-releases/ardian-strengthens-its-commitment-dedalus-driving-next-phase-growth
68. Inforcapital, "Ardian Explores Sale of Dedalus Healthtech Stake" (2026; single source). https://inforcapital.com/news/ardian-studia-la-cessione-di-dedalus-leader-europeo-nel-software-sanitario/
69. Medizinio, "Orbis Krankenhaus — das führende KIS von Dedalus" (secondary). https://medizinio.de/p/dedalus-orbis-praxissoftware
70. Oracle, "AMEOS Group deploys Oracle Health i.s.h.med Model System in more than 30 clinics." https://www.oracle.com/customers/ameos-group/
71. Digital Health, "94% of NHS acute trusts have an EPR in place, finds report" (May 2025). https://www.digitalhealth.net/2025/05/94-of-nhs-acute-trusts-have-an-epr-in-place-finds-report/
72. Hospital Management, "Epic secures a £222m federated EPR contract across Somerset and Dorset" (Mar 2026). https://www.hospitalmanagement.net/analyst-comment/epic-secures-federated-epr-contract/
73. Healthcare.Digital, "System C: Potential Acquirers" (secondary; Nervecentre claim unverified). https://www.healthcare.digital/single-post/system-c-potential-acquirers
74. Abulibdeh R. et al., "A problem of Epic proportion," *PLOS Digital Health* 5(3): e0001143 (23 Mar 2026). https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0001143
75. Helse Midt-Norge RHF, "Advarte mot avvikling av Helseplattformen under høring" (Apr 2026). https://www.helse-midt.no/nyheter/2026/advarte-mot-avvikling-av-helseplattformen-under-horing/
76. Helse Midt-Norge RHF, board paper 060-2025, "Statusrapport Helseplattformen." https://ekstranett.helse-midt.no/1001/Sakspapirer/sak%20060-2025%20Statusrapport%20Helseplattformen.pdf
77. NRK, "MDG la fram forslag om å avvikle Helseplattforma." https://www.nrk.no/trondelag/mdg-la-fram-forslag-om-a-avvikle-helseplattforma_-_-pa-tide-a-skjaere-bort-denne-it-svulsten-1.17795671
78. Sykepleien, "Leger og sykepleiere skiller lag om Helseplattformen før stortingsbehandling" (May 2026). https://sykepleien.no/2026/05/leger-og-sykepleiere-skiller-lag-om-helseplattformen-stortingsbehandling
79. Version2, "EU-dom presser Sundhedsplatformen: Region H til krisemøde med europæiske Epic-kunder." https://www.version2.dk/artikel/eu-dom-presser-sundhedsplatformen-region-h-til-krisemoede-med-europaeiske-epic-kunder
80. Apotti, "Frequently asked questions." https://www.apotti.fi/en/apotti/frequently-asked-questions/
81. Castrén & Snellman, "Epic Systems Corporation — Apotti client and patient data system." https://www.castren.fi/cases/epic-systems-corporation-apotti-client-and-patient-data-system/
82. Lemonmint, "Epic in Europe: A New Era in Healthcare — or a Risky System Change?" (Mar 2026). https://lemonmint.org/2026/03/11/epic-in-europe-a-new-era-in-healthcare-or-a-risky-system-change/
83. SVT, "Politikerna överens: Millennium ska stoppas." https://www.svt.se/nyheter/lokalt/vast/politikerna-overens-millennium-ska-stoppas
84. 100.se, "Millennium skrotas — Oracle får 657 miljoner" (27 Aug 2026). https://www.100.se/artiklar/analys/millennium-skrotas-oracle-far-657-miljoner
85. Västkom, "Millennium avslutas — så påverkas kommunerna" (27 Aug 2026). https://www.vastkom.se/2026/08/27/millennium-avslutas-sa-paverkas-kommunerna/
86. Taight, "The Other Millennium Bug: How Two Swedish Multi-Billion-SEK EHR Procurements Failed." https://taight.net/insights/other-millennium-bug
87. Wikipedia, "Cambio Healthcare Systems." https://en.wikipedia.org/wiki/Cambio_Healthcare_Systems

**Middle East**

88. Black Book Research via Newswire, "Saudi Arabia Ranks No. 1 Among Next-Wave EHR Markets as National Buying Cycle Accelerates" (30 Jul 2026). https://www.newswire.com/news/saudi-arabia-ranks-no-1-among-next-wave-ehr-markets-as-national-buying-22835899
89. World Health Expo, "Spotlight: Saudi MoH introduces Health Holding Company." https://www.worldhealthexpo.com/insights/healthcare-management/spotlight-saudi-moh-introduces-health-holding-company
90. Oracle, "Alrajhi Medicine to Digitize its Healthcare Operations with Oracle" (27 Jan 2026). https://www.oracle.com/news/announcement/alrajhi-medicine-to-digitize-its-healthcare-operations-with-oracle-2026-01-27/
91. Healthcare IT News, "Epic EHR now live at Johns Hopkins Aramco Healthcare in Saudi Arabia." https://www.healthcareitnews.com/news/epic-ehr-now-live-johns-hopkins-aramco-healthcare-saudi-arabia
92. Saudi Gazette, "KFMC taps Epic for comprehensive health record system." https://saudigazette.com.sa/article/558829
93. Korea Biomedical Review, "ezCaretech signs $6.9 million next-generation HIS deal with Saudi healthcare group Care Med" (2026). https://www.koreabiomed.com/news/articleView.html?idxno=32612
94. SKHIC (Saudi Korean Health Informatics Company), "About us." https://skhic.com.sa/en/about-us/
95. ezCaretech, "BESTCare EMR solution." https://bestcare.ezcaretech.com/ezcaretech-bestcare-emr-solution/
96. Malaffi, "History and milestones." https://www.malaffi.ae/what-is-malaffi/history-and-milestones/
97. EMR Magazine, "Understanding Riayati System Requirements" (Jun 2025). https://emrmagazine.com/2025/06/20/riayati-system-requirements/
98. Arabian Business, "Abu Dhabi's SEHA continues Cerner HIT roll out." https://www.arabianbusiness.com/business/abu-dhabi-s-seha-continues-cerner-hit-roll-out-18417
99. Cerner/Oracle Middle East blog, "Multiple Expansions, Go Lives, and Awards for Oracle Cerner Clients in Middle East, Africa." https://www.cerner.com/ae/en/blog/multiple-expansions-go-lives-and-awards-for-oracle-cerner-clients-in-middle-east-africa
100. Healthcare IT News, "American Hospital Dubai recruits Oracle and Cerner for major digital overhaul." https://www.healthcareitnews.com/news/emea/american-hospital-dubai-recruits-oracle-and-cerner-major-digital-overhaul
101. Fierce Healthcare, "Oracle Health, Cleveland Clinic, UAE's G42 to co-develop health AI platform." https://www.fiercehealthcare.com/health-tech/oracle-health-cleveland-clinic-uaes-g42-co-develop-health-ai-platform
102. Gulf Business, "Medcare becomes first in EMEA to deploy AI-first EHR platform with InterSystems" (2026). https://gulfbusiness.com/en/2026/health-care/medcare-becomes-first-in-emea-to-deploy-ai-first-electronic-health-record-platform-with-intersystems/
103. Gulf News, "Mediclinic Middle East and InterSystems celebrate the completion of EMR implementation across the whole network in the UAE." https://gulfnews.com/business/corporate-news/mediclinic-middle-east-and-intersystems-celebrate-the-completion-of-emr-implementation-across-the-whole-network-in-the-uae-1.1660741209351
104. Oracle, "Integration of Oracle Cerner EHR across Hamad Medical Corporation and Qatar Biobank" (Jun 2023). https://www.oracle.com/news/announcement/cerner-integration-hamad-medical-and-qatar-biobank-helps-accelerate-scientific-research-2023-06-20/
105. US-UAE Business Council, "U.A.E. Healthcare and Life Sciences Report 2026" (Nov 2025). https://usuaebusiness.org/wp-content/uploads/2024/01/U.A.E.-Healthcare-and-Life-Sciences-Report-2026.pdf

**Asia-Pacific**

106. InterSystems, "InterSystems IntelliCare EHR." https://www.intersystems.com/products/intellicare/
107. Fierce Healthcare, "HIMSS25: InterSystems launches new EHR with built-in AI features." https://www.fiercehealthcare.com/health-tech/himss25-intersystems-launches-new-ehr-built-ai-features
108. InterSystems, "InterSystems Awarded Four Best in KLAS Recognitions." https://www.intersystems.com/klas/
109. Wikipedia, "InterSystems." https://en.wikipedia.org/wiki/InterSystems
110. InterSystems, "EMC Healthcare Deploys AI-powered InterSystems IntelliCare." https://www.intersystems.com/success-stories/emc-healthcare-intersystems-intellicare-enhance-effciency-patient-care/
111. Yahoo Finance / press release, "iKang Outpatient Deploys InterSystems TrakCare" (Aug 2026). https://finance.yahoo.com/healthcare/articles/ikang-outpatient-deploys-intersystems-trakcare-040000604.html
112. IDC, "市场份额：中国医疗核心业务系统市场份额，2025" (Jul 2026; abstract). https://my.idc.com/getdoc.jsp?containerId=CHC53828526
113. Grand View Research Horizon, "China Hospital Information System Market Size & Outlook." https://www.grandviewresearch.com/horizon/outlook/hospital-information-system-market/china
114. Sina Finance, "卫宁健康2025年报解读" (Apr 2026). https://finance.sina.cn/2026-04-14/detail-inhunpms4729301.d.html?vt=4
115. DHC Software (东华软件), 2025 Annual Report (Apr 2026). https://static.cninfo.com.cn/finalpage/2026-04-10/1225090051.PDF
116. Winning Health (卫宁健康), 2025 Half-Year Report Summary. https://static.cninfo.com.cn/finalpage/2025-08-23/1224557517.PDF
117. Sohu, "智慧医疗分级评价方法及标准（2025版）." https://www.sohu.com/a/899059818_121124365
118. HIT180, "《电子病历系统应用水平分级评价工作规程》正式发布." https://www.hit180.com/49500.html
119. Black Book Market Research, "Global HIT & EHR" (China ratings). https://blackbookmarketresearch.com/global-hit-and-ehr
120. GlobeNewswire, "China EHR Market Analysis Report 2026–2031" (25 Sep 2026). https://www.globenewswire.com/news-release/2026/09/25/3368893/28124/en/china-ehr-market-analysis-report-2026-2031-hospital-digitization-interoperability-and-ai-driven-care-unlock-new-growth-opportunities.html
121. note.com, "Electronic Medical Record Adoption Status and Market Share in Japan" (citing 2020 white paper). https://note.com/tsubo828/n/na96e124ed980?hl=en
122. ScienceDirect, "Impact of electronic medical records (EMRs) on hospital productivity in Japan." https://www.sciencedirect.com/science/article/abs/pii/S1386505618306154
123. Hakky Handbook, "Comparison of 7 Electronic Medical Record (EMR) Manufacturers: How to Choose and Migrate in 2026" (secondary; plus related openPR/Spherical market notes). https://book.st-hakky.com/en/industry/electronic-medical-record-manufacturers-comparison-2026
124. Ken Research, "India Electronic Health Records (EHR) Market Report 2026–2032." https://www.kenresearch.com/industry-reports/india-ehr-market
125. Ken Research, "India Healthcare IT Market Report 2025–2032." https://www.kenresearch.com/industry-reports/india-healthcare-it-market
126. NABH, "KareXpert Technologies" (software certification listing). https://nabh.co/software/karexpert-technologies/
127. Athma (Narayana Health). https://athma.health/
128. Business Standard, "Narayana Health unveils AIRA by Athma" (Aug 2025). https://www.business-standard.com/companies/news/narayana-health-unveils-aira-athma-ai-tool-patient-data-management-125082201456_1.html
129. Nutanix, "Apollo Hospitals customer story." https://www.nutanix.com/company/customers/apollo-hospitals
130. Synapxe, "About Next Generation Electronic Medical Record (NGEMR)." https://www.synapxe.sg/healthtech/national-programmes/next-generation-electronic-medical-record-ngemr
131. GovInsider, "Singapore's health tech and defence tech agencies partner on interoperable health records." https://govinsider.asia/intl-en/article/singapores-health-tech-and-defence-tech-agencies-partner-on-interoperable-health-records
132. eHealth NSW, "SDPR contract signed." https://www.ehealth.nsw.gov.au/news/sdpr-contract-signed
133. IDM, "$A83M contract backs NSW digital patient record rollout." https://idm.net.au/article/0015430-a83m-contract-backs-nsw-digital-patient-record-rollout
134. Pulse+IT, "SDPR go-lives begin across NSW" (9 Apr 2026). https://www.pulseit.news/australian-digital-health/sdpr-begins-go-lives-across-nsw/
135. Pulse+IT, "NSW Health confirms SDPR scale back" (20 Aug 2026). https://www.pulseit.news/australian-digital-health/nsw-health-confirms-sdpr-scale-back/
136. NSW Health, "New milestone for the Single Digital Patient Record" (17 Nov 2025). https://www.health.nsw.gov.au/news/Pages/20251117_00.aspx
137. HHM Global, "New InterSystems TrakCare Community Solution Goes Live at Gateway Health" (2026). https://www.hhmglobal.com/industry-updates/press-releases/new-intersystems-trakcare-community-solution-goes-live-at-gateway-health

**Latin America**

138. MV, "MV se torna a 5ª maior fornecedora global de prontuário eletrônico hospitalar" (citing KLAS 2025). https://mv.com.br/imprensa/mv-se-torna-a-5a-maior-fornecedora-global-de-prontuario-eletronico-hospitalar
139. Exame, "Os próximos passos da brasileira que vendia remédio para hospital e agora movimenta R$ 45 bilhões" (2026). https://exame.com/negocios/os-proximos-passos-da-brasileira-que-vendia-remedio-para-hospital-e-agora-movimenta-r-45-bilhoes/
140. ACATE, "Philips vende por R$ 1 bilhão software desenvolvido em SC" (2026). https://www.acate.com.br/noticias/philips-vende-software-desenvolvido-em-sc/
141. Futuro da Saúde, "Possível venda do Tasy entra no radar do mercado." https://futurodasaude.com.br/philips-tasy-mercado/
142. Philips Brasil, "Philips expande acesso ao Tasy EMR na Rede D'Or" (19 Aug 2025). https://www.philips.com.br/a-w/about/news/archive/standard/news/press/2025/20250819-philips-expands-access-to-tasy-emr-in-rede-d-or-improving-patient-care.html
143. PPTA Saúde, "Cerner fatura R$ 180 milhões com Einstein." https://www.pptasaude.com.br/noticias/773/cerner-fatura-rs-180-milhoes-com-einstein/
144. Baguete, "Cerner chega bem no Brasil." https://www.baguete.com.br/noticias/cerner-chega-bem-no-brasil
145. Spherical Insights, "Brazil Healthcare Information System Market Size Report 2035." https://www.sphericalinsights.com/reports/brazil-healthcare-information-system-market

**Africa**

146. Netcare, "Pioneering electronic medical record system 'a game changer' for hospital." https://www.netcare.co.za/News-Hub/Articles/pioneering-electronic-medical-record-system-a-game-changer-for-hospital
147. ITWeb, "A tale of two hospitals." https://www.itweb.co.za/article/a-tale-of-two-hospitals/4r1lyMR9Je57pmda
148. Daily Maverick, "'Who Owns South Africa' report points to 'commodification' of healthcare in private sector" (Oct 2025). https://www.dailymaverick.co.za/article/2025-10-02-report-points-to-commodification-of-healthcare-in-sasprivate-sector/
149. Palladium, "Building a New Era for Digital Health in Africa." https://thepalladiumgroup.com/news/Building-a-New-Era-for-Digital-Health-in-Africa
150. The Star (Kenya), "SHA rolls out Taifa Care HMIS for Level 4 public hospitals" (1 Jul 2026). https://www.the-star.co.ke/news/2026-07-01-sha-shifts-level-4-public-hospitals-to-taifa-care-hmis
151. Digital Health Africa, "Rwanda hopes to ditch paper health records by December with e-Ubuzima rollout." https://digitalhealth-africa.org/rwanda-hopes-to-ditch-paper-health-records-by-december-with-e-ubuzima-rollout/
152. MyJoyOnline, "LHIMS: Harnessing Ghana's digital healthcare management system." https://www.myjoyonline.com/lhims-harnessing-ghanas-digital-healthcare-management-system/
153. medRxiv, "Determinants of healthcare providers' satisfaction with EMR systems in public healthcare facilities in the Ashanti region of Ghana" (Dec 2025 preprint). https://www.medrxiv.org/content/10.64898/2025.12.03.25341569.full.pdf
154. Ofori-Adjei Y.A., "Beyond a single system: Lessons from Ghana's discontinued national EHR and the imperative for an interoperable digital health ecosystem," *Ghana Medical Journal* 59(4):177–180 (1 Dec 2025). Full text retrieved in pass 2 via Europe PMC: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12877703/fullTextXML (also https://pmc.ncbi.nlm.nih.gov/articles/PMC12877703/)

**Market sizing**

155. Grand View Research, "Electronic Health Records Market" (accessed Oct 2026). https://www.grandviewresearch.com/industry-analysis/electronic-health-records-ehr-market
156. Precedence Research, "Electronic Health Records Market" (accessed Oct 2026). https://www.precedenceresearch.com/electronic-health-records-market
157. IMARC Group, "Hospital Information System Market" (accessed Oct 2026). https://www.imarcgroup.com/hospital-information-system-market
158. Precedence Research, "Hospital Information System Market" (accessed Oct 2026). https://www.precedenceresearch.com/hospital-information-system-market
159. MarketsandMarkets, "Healthcare Information System Market" (2022 base). https://www.marketsandmarkets.com/Market-Reports/healthcare-information-system-market-87720487.html

**Added in verification pass 2 (16 Oct 2026)**

160. Waxler S. et al., "Generative Medical Event Models Improve with Scale," arXiv:2508.12104 (v1 16 Aug 2025: CoMET, 118M patients, ~115B events / 151B tokens; revised 7 Nov 2025, where the models are called "Curiosity"). https://arxiv.org/abs/2508.12104
161. VA Digital, "EHR Deployment Schedule" (accessed 16 Oct 2026; Anchorage and Cleveland 24 Oct 2026; 26 sites in 2027). https://digital.va.gov/ehr-modernization/ehr-deployment-schedule/
162. iTnews, "NSW' $969m single digital patient record at risk of cost overruns" (27 Nov 2025). https://www.itnews.com.au/news/nsw-969m-single-digital-patient-record-at-risk-of-cost-overruns-622072
163. Medical Republic, "Epic to supply NSW patient record system" (23 Oct 2023); see also Pulse+IT, "$1 billion price tag for NSW's Epic single digital patient record" (6 Nov 2023). https://www.medicalrepublic.com.au/epic-to-supply-nsw-patient-record-system/18186
164. Startupi, "Bionexo conclui aquisição do Tasy por € 161 milhões…" (4 May 2026). https://startupi.com.br/bionexo-conclui-aquisicao-do-tasy-por-161-milhoes/
165. Health IT Outcomes, "King Faisal Specialist Hospital & Research Centre Achieves Highest Level Of Health Care IT Adoption" (12 Oct 2015; quotes KFSH&RC CIO on Cerner Millennium). https://www.healthitoutcomes.com/doc/king-faisal-specialist-hospital-adoption-0001
166. US-UAE Business Council, "The U.A.E. Healthcare Sector: An Update" (Sep 2016), and Healthcare IT News, "UAE-based Mubadala Healthcare launches Cerner integrated information system" (via search-result extracts only). https://usuaebusiness.org/wp-content/uploads/2017/05/Healthcare-Report-Final-1.pdf
167. European Commission, "European Health Data Space Regulation (EHDS)" (accessed Oct 2026). https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en
168. 42 CFR 411.357(w), Electronic health records items and services (Cornell LII). https://www.law.cornell.edu/cfr/text/42/411.357
169. Wikipedia, "NextGen Healthcare" (accessed Oct 2026). https://en.wikipedia.org/wiki/NextGen_Healthcare
170. Wikipedia, "Veradigm" (accessed Oct 2026; citing the company's 28 Feb 2024 Nasdaq delisting-notice release). https://en.wikipedia.org/wiki/Veradigm
171. KLAS Research, "Global Hospital EHR Market Share 2026" abstract, as summarized in [46]: decisions at an "almost five-year low"; deployment volume the "lowest… in at least a decade." (Same report as [45].)
172. MEDITECH, "MEDITECH Expanse EHR live across first full U.S. divisions of HCA Healthcare" (14 Sep 2026). https://ehr.meditech.com/news/meditech-expanse-ehr-live-across-first-full-us-divisions-of-hca-healthcare
173. MEDITECH News, "MEDITECH recognized as a Leader in the 2026 Gartner Magic Quadrant for Enterprise Electronic Health Records" (25 Aug 2026; headline only). https://ehr.meditech.com/news
174. GemMed, standard-type EMR certification and the 2030 adoption goal under the Medical DX roadmap (13 Mar 2026). https://gemmed.ghc-j.com/?p=73387

**Added during reconciliation (2026-10-16)**
175. Digital Health Wire, "Blue Ribbons and AI Agents at Epic UGM" (24 Aug 2026; "Cosmos Curiosity is a new generative model trained on 320M deidentified patients and 23B encounters"; March 2027 in-EHR release). https://digitalhealthwire.com/blue-ribbons-and-ai-agents-at-epic-ugm/
176. NRK, "Riksrevisjonen legger fram resultatene fra undersøkelse om Helseplattformen" (24 Oct 2024; ~NOK 6.7B total so far; original frame NOK 4.1B). https://www.nrk.no/trondelag/riksrevisjonen-legger-fram-resultatene-fra-undersokelse-om-helseplattformen-1.17092919
177. Apotti, "Frequently asked questions" ("The investment cost of the Apotti system in its current scope is 407 million euros"; undated). https://www.apotti.fi/en/apotti/frequently-asked-questions/
178. KFSH&RC press release via Zawya, "King Faisal Specialist Hospital & Research Centre progresses transformation program by virtually upgrading its Integrated Clinical Information System" (2020; Cerner Millennium upgrade). https://www.zawya.com/en/press-release/king-faisal-specialist-hospital-amp-research-centre-progresses-transformation-program-by-virtually-upgrading-cnct4bvf
179. Hospitals Magazine, "Multiple Expansions, Go Lives, and Awards for Oracle Cerner Clients in Middle East, Africa" (2022 recap; KFSH&RC transplant workflow and AI MoU with Oracle Cerner). https://hospitalsmagazine.com/multiple-expansions-go-lives-and-awards-for-oracle-cerner-clients-in-middle-east-africa/
180. Khaleej Times, "Electronic medical record system now live in UAE" (8 Apr 2017; DHA IT director; staff "trained in the UAE and in the US by the international company EPIC"). https://www.khaleejtimes.com/uae/electronic-medical-record-system-now-live-in-uae
181. Wikipedia, "Epic Systems" (MGB: "initially reported to cost $1.2 billion", citing the Boston Globe of 16 May 2016; "$1.6 billion" total by 2018, mostly lost patient revenue, with software under $100M, citing Gawande, *The New Yorker*, 5 Nov 2018; Apotti €625M citing Helsingin Sanomat, 5 Nov 2022). https://en.wikipedia.org/wiki/Epic_Systems
182. Riksrevisjonen, "Helseplattformen i Midt-Norge", Dokument 3:3 (2024–2025), 24 Oct 2024. https://www.riksrevisjonen.no/rapporter-mappe/no-2024-2025/helseplattformen-i-midt-norge/
183. Companion reports used in the reconciliation: `03` §2/§21, `04` §11, `05` §9.1/§9.4, `06` §8, `09` §0/§6, `10` §4.2/§4.12/§6.1; see `RECONCILIATION-LOG.md`.

---

### Open verification items (recommended follow-ups)

- Status of Oracle Health's **acute-care** version of the new AI EHR (general availability and certification). Still not announced as of 16 October 2026 (pass 2).
- Outcome of the VA's **24 October 2026** go-lives (Anchorage, Cleveland). The 2027 plan (26 sites) is now published [161].
- Saudi **HHC cluster** EHR awards by vendor (IQVIA, Oracle, Epic, Adaptive TechSoft): which clusters, and contract values.
- Western Australia statewide EMR decision; Tasmania; current Victorian footprint.
- EHR vendors for India's large chains (Apollo, Max, Fortis, Manipal) and for Mediclinic Southern Africa and Life Healthcare.
- ~~Ghana LHIMS "discontinued" status~~. Resolved in pass 2: LHIMS was discontinued and is being replaced by the state-owned GHIMS [154]. Open follow-up: GHIMS rollout status.
- KFSHRC's current EHR platform: Cerner Millennium (now Oracle Health) per 2015 primary evidence [165], with later evidence from 2020–2022 [178][179]. There is no evidence of Epic, and it has not been re-confirmed for 2024–2026. Action for the proposed beachhead-market report: confirm the current platform, because KFSHRC is a regional reference site (reconciled 2026-10-16).
- Dubai Health / Salama EMR vendor: Epic per 2017 contemporary press [180]. A primary DHA or Epic release is still needed (reconciled 2026-10-16).
- Apotti total cost: €407M investment cost (Apotti FAQ [177]) vs €625M (Helsingin Sanomat, Nov 2022). Find the primary Finnish source that defines the €625M scope.
- Original sources for Mayo (~US$1.5B vs a "$1B" 2016 headline), Kaiser (~US$4B vs >US$6B) and Insel (CHF 182.5M).
- Tasy client count (about 1,000 vs 2,000+ institutions) and the R$300M revenue figure.
- China EMR grading level counts (number of hospitals at Levels 5, 6 and 7) and IDC 2025 vendor shares.

---

## Verification log (pass 2, 2026-10-16)

| Claim | Verdict | Source | Note |
|---|---|---|---|
| Epic 43.7% of US acute hospitals / 56.9% of beds; Oracle Health 21.9% / 20.4%; MEDITECH 14.7% / 12.5% (end-2025) | Confirmed | [1][3][4] (search extracts of KLAS coverage) | The KLAS abstract is paywalled, but Health System CIO, Fierce and Becker's all carry the same figures. A year earlier Epic had 42.3% and Oracle 22.9%. |
| Epic net +568 hospitals since 2021; Oracle net −173 | Confirmed | [3][4] (search extracts) | — |
| 2025: Epic +77 hospitals / +18,679 beds; Oracle −56 / −14,676; 84% of MEDITECH deciders chose Expanse | Confirmed | [2] | MEDITECH retention was 30% in 2023 and 63% in 2024. Epic was the only vendor picked by >10-hospital systems, but only two such systems decided in 2025. |
| US decisions down ~40% vs 2024 and ~50% vs 2023 | Confirmed | [1][2] | Quoted in the KLAS abstract. |
| ~30% of Oracle customers say Oracle is not in their long-term plans; 35% "vulnerable" | Confirmed | [2][3] | [2] says "nearly one-third". |
| TruBridge 7.6% and Altera 2.9% of US acute hospitals | Confirmed (upgraded) | [3][4][6] | Pass 1 had flagged these as secondary-only; they are KLAS 2026 figures. |
| Definitive HC (Apr 2026): Epic 43.9%, Oracle 18.9%, MEDITECH 10.7%, TruBridge 4.3% | Confirmed | [7] | — |
| Global 2025 decisions: 447 hospitals, ~81K beds; "10-year low" | Corrected | [45][46][171] | Decisions were at an "almost five-year low". Hospital and bed volume (81,261 beds) was the lowest KLAS has tracked in at least a decade. |
| Local/regional vendors won 66% of global wins; Epic 7 international contracts / 34 hospitals, 6 of 7 via Community Connect | Confirmed | [46] | — |
| Oracle lost 34 hospitals abroad, more than half in VGR; won in Canada, England, Austria and two ME groups | Confirmed | [46] | — |
| Cosmos: 310M patients, 2,358 hospitals, 52.5K clinics | Confirmed | [12] | — |
| CoMET trained on 118M patients and "151B events" | Corrected | [160] | It is 115B discrete events, or 151B tokens. A Nov 2025 revision of the paper renames the models "Curiosity". |
| New Oracle AI EHR is ambulatory-only; acute promised for 2026 | Confirmed | [18], search extracts | No acute GA announcement found as of 16 Oct 2026. |
| ONC certification of the new Oracle EHR, 18 Nov 2025 | Confirmed (secondary) | [17] blocked; Advisory Board extract | Oracle newsroom returned 403. |
| Oracle Clinical AI Agent for nurses: US availability 14 Sep 2026; BayCare; 400K physician hours | Confirmed | [19] | The agent runs inside the Foundation EHR (formerly Millennium), not the new EHR. The 400K hours figure is Oracle's own. |
| VA restart: Michigan 11 Apr, Ohio/KY 6–7 Jun, Indiana (VA release 24 Aug 2026); 11 of 13 sites | Confirmed | [22][24] | — |
| VA Anchorage and Cleveland "October 2026, status unverified" | Corrected (updated) | [161] | Scheduled for 24 Oct 2026, after this document's date. The 2027 schedule lists 26 sites. |
| VA lifecycle cost ~US$37B; full deployment "as early as 2031" | Confirmed | [24][22] | Nextgov: "a recent cost estimate provided to lawmakers". |
| MHS GENESIS deployment completed 2024; shared Federal EHR | Still unverified | health.mil | The health.mil page still says "when fully deployed". |
| Epic revenue US$6.7B (2025), ~14,000 staff, 325M patients, MyChart ~150M; Particle (Sep 2024; allowed to proceed Sep 2025), CureIS (May 2025), Texas AG (Dec 2025) suits | Confirmed (secondary) | [13] | Wikipedia/Forbes. Epic publishes no financials. |
| European Epic customers asked for an EU support center [13][79] | Corrected (citation) | [79] | [13] does not mention it, so the citation was removed. |
| Best in KLAS 2026 US: Epic 89.7 (large), MEDITECH 77.1 (small), Epic ambulatory 90.0, Abridge 94.7; Epic 16th year; athenahealth 3rd year | Confirmed | [29][30][31] | Added: Epic midsize 88.3 and Workday ERP 91.3. |
| Best in KLAS 2026 global: UK/I Epic 86.6, N. Europe Epic 86.1, DACH ORBIS 73.5, France TrakCare 76.5, S. Europe Dedalus 75.4, Asia TrakCare 86.3, ME/A IQVIA 82.0, LatAm MV 80.0 | Confirmed | [32] | Added: Oceania TrakCare 74.0 and Canada Epic 88.9. |
| MEDITECH MaaS on Google Cloud "100+ customers" | Corrected | [34] | MEDITECH reports more than 260 licensed MaaS customers, with 23 hospitals signed in 2026. |
| HCA 72 hospitals live on Expanse | Confirmed (refined) | [172] | The 72 includes UK sites. Capital and North Florida (34 hospitals) are the first full divisions. The 2022 commitment date is not in the release. |
| MEDITECH a Leader in 2026 Gartner MQ for Enterprise EHR (Aug 2026) | Confirmed | [173] | Headline only, dated 25 Aug 2026. |
| NextGen taken private by Thoma Bravo in 2023 | Confirmed | [169] | ~US$1.8B EV, closed around Nov 2023. |
| Veradigm "Nasdaq delisting 2024 over delayed filings and a strategic review" | Corrected (refined) | [170] | Suspended 29 Feb 2024 for missing FY2022 and 2023 filings; now on the OTC Expert Market. The strategic review remains unverified. |
| SAP IS-H mainstream maintenance to 2027, paid extended to 2030; >500 DACH hospitals | Confirmed | [50][51] | INFORMATICS notes that RISE could reach 2032 [49]. |
| i.s.h.med support to 2035 requires Oracle EU Sovereign Cloud hosting | Confirmed | [55] | The [55] date is 12 Feb 2026, not Oct 2026 (corrected). |
| German KIS figures (Dedalus ~€460M DACH / 850 ORBIS; CGM HIS €353M; Nexus €288.6M; Avelios 15 customers / 70+ hospitals / ~200 staff; Oracle–Cerner sale rumor via TD Cowen) | Confirmed | [53] | Mostly vendor-reported. |
| Avelios: SAP investment Feb 2026; Fresenius investment (12 May 2026); Helios ~140 facilities | Confirmed | [58][60] | Added: Avelios calls itself "SAP's recommended successor to IS-H". |
| Charité–Epic ~€200M; law change to self-borrow; financing ~July 2026; full rollout end-2029 | Confirmed | [63] | Previously capped at €20M for major equipment. kma gives no contract term. |
| VGR: SEK 657M "pre-agreed exit fee", ~SEK 3.8B sunk, halted after 3 days, settled Aug 2026, legacy +8 years at ~SEK 40M/yr | Confirmed (wording refined) | [84][85] | The 657M is compensation for Oracle's lost future revenue. "Pre-agreed" is not stated in [84]. |
| Somerset & Dorset £222M federated Epic contract; 18 Epic trusts; Epic + Oracle cover ~45% of population | Confirmed | [72] | — |
| UK: 94% of acute trusts have an EPR; Epic share 9.7% (+3.5 pts) | Still unverified (not re-fetched) | [71] | The source returned 403 in pass 2. Retained from pass 1. |
| KFSHRC associated with Epic [U] | Refuted / Corrected | [165] | KFSHRC used Cerner Millennium (2015 primary quote). No Epic evidence found. |
| Cleveland Clinic Abu Dhabi on Epic [U] | Plausible (partially verified) | [166] (search extracts) | The 2016 report says "reportedly". CCAD's pathology lab is on Mubadala's Cerner. |
| Black Book Saudi (30 Jul 2026): 128 IT leaders; Oracle and InterSystems lead; 98% rate NPHIES/SeHE critical; "may be eliminated"; 20 clusters | Confirmed | [88] | — |
| Black Book expects "AI layers" to outgrow core EHR; Balsam/OASIS a "local" vendor | Corrected | [88] | The adjacent categories Black Book names are interoperability, analytics, patient access, virtual care and workflow. Balsam is one of eight scorecard vendors. |
| Malaffi: 100% of AD hospitals (Sep 2021), 3.5B records (Aug 2025), SNOMED CT (Nov 2025) | Confirmed | [96] | — |
| IntelliCare "deployed in 600+ hospitals, 29 countries" | Corrected | [106] | These figures cover InterSystems EHRs generally, not IntelliCare alone. The MDR Class IIa certification is confirmed. |
| Winning Health 2025: revenue ¥2.106B (−24.3%), net loss ¥374M; software & services −19.4% | Confirmed | [114] | [114] is an AI-generated summary. Added causes: impairments, back taxes, rigid costs. |
| Japan targets near-universal EMR adoption by 2030 [U] | Confirmed | [174] | The Medical DX roadmap (Jun 2023) says "by 2030 at the latest… almost all medical institutions". It is a goal, not a mandate. |
| NSW SDPR ~A$969M [U-partial]; contract signed Aug 2023 | Value confirmed; date corrected | [162][163] | Contracts finalized mid-Oct 2023. Originally reported as just over A$1B. The Audit Office (Nov 2025) flagged missing integration costs. |
| NSW phased the next tranche (20 Aug 2026); only Northern Beaches in Nov 2026 | Confirmed | [135] | — |
| SDPR scope: 220+ hospitals, 65 labs, ~600 community centres; 9 EMR / 10 PAS / 5 LIS; 2028 | Confirmed | [136] | iTnews counts six PAS [162]. |
| Tasy sold to Bionexo for ~€161M (≈R$1.05B), closing ~Q2 2026; ~2,000 clients, R$300M revenue | Corrected (refined) | [139][164] | Announced 30 Dec 2025; completion announced 4 May 2026 after CADE approval. Exame reports R$940M at close. The client count (1,000 vs 2,000+) and revenue are unverified. |
| Kenya: Level 4 public hospitals must claim via Taifa Care from 29 Jun 2026; 3-month integration deadline | Confirmed | [150] | SHA threatens to de-contract non-compliant facilities. |
| Ghana LHIMS "discontinued" status uncertain | Corrected (resolved) | [154] | Discontinued after the contract expired Dec 2024; replaced by the state-owned GHIMS. |
| Grand View global EHR US$35.9B (2025), US$53.1B (2033), 5.1% CAGR; NA 43%; APAC 8.0%; cloud 83.7% | Confirmed | [155] | — |
| Stark EHR donation: recipient pays ≥15% [U] | Confirmed | [168] | 42 CFR 411.357(w)(4); no sunset. |
| Truveta 140M+ patients; owned by US health systems | Confirmed | [40] | Customer types refined. |
| EHDS mandates EHR interoperability (dates not given) | Confirmed and expanded | [167] | Reg. (EU) 2025/327: in force 26 Mar 2025; most obligations Mar 2029; images/labs/discharge Mar 2031. |
| Mayo Epic ~US$1.5B [U] | Still unverified | Wikipedia (citation titles) | A 2016 headline says "$1B tech project", which conflicts. |
| Oracle–Cerner US$28.3B (closed Jun 2022); Queensland ieMR >A$1.45B; Skåne postponed again Jan 2026; Feb 2025 legacy Cerner breach | Confirmed (secondary) | [21] | Wikipedia. |
