# 12 — Build Program and Business Plan: Team, Budget, Timeline, Go-to-Market, Pricing, Funding

**Track:** Vendor-side program sizing and business plan (gap-filling report)
**As of:** 16 October 2026
**Author role:** Senior health-IT research analyst
**Audience:** Founders, product, engineering, finance and go-to-market leads for our Hospital Management System (HMS)

---

## How to read this document

- **Inline `[n]`** points to the numbered Sources list at the end. Those sources were fetched or searched in this research cycle.
- **[S]** means a secondary source or search-result extract that was not fetched in full (for example a funding aggregator, a vendor blog or a tender-guide site). Use it directionally.
- **[E]** means my estimate. The derivation is shown or summarized next to it.
- **[K]** means background knowledge I could not re-verify in this session. Treat it as a hypothesis.
- **(NN §x)** cross-references another file in this research pack, for example (01 §9.2) = `01-global-vendor-landscape.md`, section 9.2.
- **Report 14 is missing.** The brief asks for a bottom-up estimate "using the reconciled MVP from report 14". No file 13 or 14 existed in the research folder when this was written. Section 4 therefore defines a **provisional reconciled MVP** drawn from 03 §2, 04 §8, 05 §0, 06 §8, 07 §9, 08 §14 and 09 §9.2. Re-baseline the person-month table when report 14 lands. The structure is built to make that a mechanical update.
- **Currency assumptions [E]:** US$1 ≈ ₹88 ≈ SAR 3.75 ≈ AED 3.6725 ≈ PLN 3.7 ≈ ¥150; €1 ≈ US$1.15. These are planning rates, not market quotes. All budget figures are in US$.
- **Search budget:** All 12 allowed WebSearch calls were used. Later facts come from direct fetches of primary pages. Some primary pages (Oracle newsroom, Saudi MoF, Bird & Bird, DPIIT, ABDM sandbox, Korea Biomedical Review) blocked fetching. Where that matters, the text says so.

---

## 0. Executive summary

1. **The pack describes a five-year, US$80–90M program, not a 12-month build.** Base case [E]:
   - **1,055–1,645 squad person-months (PM)** for the provisional MVP;
   - **~140 FTE** at the first inpatient go-live and **~345 FTE** by year 5;
   - **five-year operating cost of ~US$105M** against **~US$36M of revenue**;
   - **cumulative net burn of ~US$69M**, so raise **US$80–90M** including a 20–25% buffer.

   A lean variant (India-first, narrower MVP, partner-led delivery) needs **US$45–50M**. An aggressive variant (three markets in parallel, deep native ancillaries, EU preparation) needs **US$130–150M** (§6).
2. **Full-scope hospital systems take years, even for well-funded teams:**
   - **Henry (Japan):** founded May 2018, began hospital deployments in **February 2023** (about 57 months later), passed 50 facilities by July 2025, had 139 staff in March 2026 and has raised about ¥5.7B in equity [27][28].
   - **Avelios:** built "under the radar … for four years" on €5M before its €30M Series A, when it had 12 customers [14]. It now has about 200 staff and about 15 customers covering more than 70 hospitals (01 §3.4).
   - **Oracle:** went from teasing its new EHR (October 2024) to ambulatory availability (August 2025) in about 10 months. Its **acute** version is still unreleased two years after the teaser [30][31].
   - **MediMind (Georgia):** two founders plus AI tooling went from idea to a 25-hospital contract in 13 months on Medplum. That is the AI-era outlier, and it started with lab and imaging, not inpatient care [17].
3. **Capital efficiency in this market splits in two:**
   - Indian HIS vendors scale on single-digit millions at commodity prices. KareXpert raised about US$7M, has about 190 staff and claims 300–500+ hospitals [21][S].
   - US/EU venture-scale players raise US$50–800M+. Elation raised US$108.5M [8][S]; Commure raised about US$750M at a US$7B valuation [12].

   Our plan sits deliberately between the two. An India cost base funds the build, and GCC prices fund the business.
4. **The conflicting dates in 01, 07 and 10 measure three different clocks (§3):**
   - **Product clock:** M0 to the first full inpatient go-live is **M20–M24**. Doc 07's "M12" survives only as **first production PHI through a wedge go-live at M12–M14** (OPD, billing, pharmacy and lab at the design partner).
   - **Implementation clock:** 9–15 months for customers #1–#3, as in doc 10. Doc 01's 6–12 months applies only from about customer #10.
   - **Certification clock:** NABH HIS/EMR certification requires **three operational Indian deployments plus ABDM M3** [23], so it cannot land before about **M28–M32**.
5. **Milestones (base case):**
   - 3 live hospitals, including the first in KSA: **M26–M30**
   - 10 live hospitals: **M36–M42**
   - first HIMSS EMRAM Stage 6 validation: **M36–M44**
   - 2–3 Stage 6/7 reference sites: **M54–M66**
6. **MVP scope for 50–800-bed private hospitals in India and the GCC must include native pharmacy, a native LIS core and a "RIS-lite".** These buyers expect one system. Doc 03's "interface-only" LIS/RIS stance is a US/Epic pattern that does not fit them.
   - **Phase 2 (+325–495 PM):** microbiology, anatomic pathology, non-US blood bank, perioperative/AIMS, ICU, maternity and the UAE pack.
   - **Integrate rather than build:** PACS, BECS (US) and drug knowledge bases (04 §8.2).
7. **Team shape:**
   - 11 domain squads at MVP peak.
   - Staffing ratios: one clinical informaticist per two squads; one QA/SDET per five engineers; one SRE per 8–10 engineers; security at about 4% of headcount; 6–10 implementation FTE per concurrent mid-size hospital project [E].
   - Locations: an India hub with 65–70% of R&D, a Riyadh entity for delivery, compliance and Saudization, and a small EU cell for security, clinical safety and regulatory work.
8. **Loaded cost per FTE [E], derived from Levels.fyi medians [35]–[39] plus on-costs:**

   | Location | Loaded cost per FTE |
   |---|---|
   | India engineer | US$45–60K |
   | KSA expatriate engineer | US$80–100K |
   | UAE | US$110–125K |
   | Germany | US$115–130K |
   | Poland | US$80–95K |
   | **Planning blend** | **US$75–85K** |

9. **Non-labor costs are small early but grow quickly:**
   - Security attestations (SOC 2, ISO 27001, penetration tests) run about US$150–400K a year (07 §3.3).
   - The NABH HIS/EMR certification fee is only ₹1.5 lakh plus GST [23]. The real cost of that certification is the three deployments it requires.
   - Sovereign hosting must stay at or below 10–12% of revenue. That means at most about US$3–4 per bed per month in India and US$10–18 in the GCC [E].
   - AWS's Saudi region was still only "announced" in October 2026 [51], which constrains our KSA cloud choices.
10. **Doc 01's pricing anchor of US$1.5–6K per bed per year is wrong for India and right only at the GCC's low end:**
    - Commodity Indian HMS SaaS works out to about **₹800–1,000 per bed per month** at 100–500 beds [47][E].
    - Proposed India enterprise bundle: **₹2,400–3,700 (≈US$28–43) per bed per month**.
    - Proposed GCC bundle: **US$110–170 per bed per month**.
    - Implementation: fixed fee with a 10–20% outcome-linked holdback (§12).
11. **Go-to-market:**
    - **Ideal customer:** 150–500-bed private hospitals and groups of 3–15 hospitals.
    - **Sales cycles [E]:** India 4–15 months; GCC private sector 9–18 months; GCC public sector 18–36 months.
    - **Saudi government entities** cannot contract with foreign firms that lack a Saudi regional headquarters (RHQ) unless an exemption is filed through Etimad. Non-RHQ bids are accepted only if they are the sole compliant bid or at least 25% cheaper than the next-best [43]. Local-content price preferences also apply [45][S].
    - **Recommendation:** stay out of public tenders in years 1–3.
12. **Funding market:**
    - US digital-health venture funding was **US$14.2B in 2025**, with 54% going to AI-enabled companies, an average deal of US$29.3M and a median of US$12M [32].
    - **H1 2026:** US$7.4B, a US$14M median, 45% of capital in mega-deals and no IPOs [33].
    - **Plan:** seed of US$8–10M; Series A of US$20–25M at gate G2/G3; Series B of US$40–50M at G4/G5. Add one GCC and one Indian **strategic minority investor**, following the Avelios–SAP–Fresenius pattern [16]. Keep these stakes non-exclusive.
13. **Unit-economics targets [E]:**
    - subscription gross margin of 70–75% by year 5 and at least 78% at steady state;
    - services at or below 40% of revenue by year 5;
    - net revenue retention of at least 115%;
    - CAC payback within 24 months by year 5;
    - **GCC customers delivering at least 60% of ARR.** India alone cannot carry the cost base.
14. **Top business risks:**
    - vendor-viability perception;
    - failure at the reference site;
    - key-person risk (CMIO, chief architect);
    - regulatory change or delay (NPHIES/SBS, ABDM, DPDP);
    - a **funding gap between the first go-live (G3) and three live sites (G4)**, when spend peaks and references are still thin (§14).
15. **Decisions needed now:**
    - commit to the three-clock plan;
    - sign a **3+-hospital Indian group** as design partner #1, which also meets the NABH three-deployment rule;
    - sign a KSA private group as design partner #2 by M15;
    - pick the Base or Lean funding path before the seed closes (§15).

---

## 1. What this report adds to the pack

The pack sets out a very large product scope:
- 48 canonical clinical modules (03 §2)
- native LIS, RIS and pharmacy (04 §8.2)
- localized revenue cycle (RCM) and a hospital sub-ledger and ERP (05 §0)
- an AI control plane (09 §9.1)
- India, KSA and UAE adapters (06 §8)
- a long certification list (07 §3.3, §9.2)

None of the reports sizes what the *vendor* has to spend. Doc 01 §9 and §12.3 cover only the customer's price, and doc 10 §4.12 and §9 cover only the customer's implementation cost. This report adds:
- external benchmarks;
- a reconciled timeline;
- a bottom-up effort estimate;
- an organization plan, budget, go-to-market plan, price sheet, funding plan and risk register.

---

## 2. Benchmarks: how others built EHR/HIS products

### 2.1 Benchmark table

| Company | Founded | Capital (as disclosed) | Headcount | First live product / first site | Time to ~10 sites | Scope at first go-live |
|---|---|---|---|---|---|---|
| **Epic** | 1979 [1] | US$70K from friends and family; never took VC or PE [1][3] | 3 half-time staff at founding [2]; about 14,000 in 2025 [1] | Early products were scheduling and practice systems [K] | Not disclosed; inpatient EHR maturity came in the 2000s, e.g., Kaiser's selection around 2003 [K] (01 §9.2) | Departmental/ambulatory first [K] |
| **Cerner** | 1979 [4] | Bootstrapped by three Arthur Andersen alumni; **IPO 1986** [4] | 26,400 (2020) [4] | **PathNet (lab) in 1984**, about 5 years after founding [4] | **70 client sites by 1987**, mostly PathNet; 120 by 1988; 250 by 1990 [4] | One department (laboratory); Millennium suite only in 1997 [4] |
| **MEDITECH** | 1969 [5] | **US$500K from EG&G** [5] | Not disclosed; revenue US$493.8M (2019) [5] | MIIS-based hospital systems in the early 1970s [5][K] | Not disclosed | Departmental and administrative first [K]; web-based Expanse only in 2018 [5] |
| **athenahealth** | 1997 (as a birthing-centre business) [6] | VC before its **2007 IPO**; amount not in source [6] | 6,000+ (2019) [6] | First client live on **athenaCollector (billing) in 2000** [6] | Practices, not hospitals | RCM only; never built an acute EHR (01 §2.5) |
| **Elation Health** | about 2010 [7] | US$63M by its Series C (Dec 2020) [7]; **US$108.5M** after a US$50M Series D (Jul 2022) [8][S] | n/a | Ambulatory primary-care EHR | n/a (practices) | Ambulatory only |
| **Canvas Medical** | 2015 [K] | US$17M Series A (Apr 2021); US$24M Series B led by M13 (Jul 2022); US$44–64M in total depending on source [9][S] | n/a | API-first ambulatory EHR | n/a | Ambulatory only |
| **Akido Labs** | 2015 [K] | **US$60M Series B (May 2025)** led by Oak HC/FT; YC alumnus [10] | n/a | Runs its own care network (≈100 clinics, 240 providers) plus ScopeAI [10] | n/a | AI-assisted ambulatory visits, not an HIS |
| **Commure / Athelas** | Merged October 2023 at about US$6B [S] | US$200M growth financing from GC's Customer Value Fund (Jun 2025) [11]; **US$70M at a US$7B post-money valuation (May 2026)**; about US$750M raised in total [12] (Sacra: ~US$823M [13]) | n/a; ARR about US$105M (Mar 2024, Sacra estimate) [13] | RCM, remote monitoring and enterprise apps; ambient AI via the Augmedix acquisition [S] | n/a | Not an EHR; a layer on top of Epic/Meditech customers such as HCA [13] |
| **Avelios Medical** | 2020 [14][15] | €5M seed over about 4 years; **€30M Series A (Feb 2025, Sequoia)** [14]; SAP strategic investment (Feb 2026) and Fresenius (May 2026), amounts undisclosed [16] | **About 200** (01 §3.4) | Modular landing at German hospitals: LMU Munich, MHH, Sana (56 facilities) [14][15][S] | **12 customers at Series A** [14]; about 15 customers and 70+ hospitals by 2026 (01 §3.4) | Modular: EHR, billing, lab results, portal, research collaboration [14] |
| **Medplum** | 2021 [18][S] | YC S22; under US$1M disclosed [18][S] | 11–23 [18][S] | Platform only; ONC-certified December 2025 (02 §4.1) | n/a | Headless FHIR platform with no inpatient apps (02 §4.1) |
| **MediMind** (on Medplum) | about 2024 [E] | GEL 150K grant from Georgia's GITA [17] | **2 founders plus an "AI code factory"** [17] | Lab (15 analyzer lines live in 3 weeks), then imaging; on-premises [17] | Contract with a **25-hospital network** 13 months after the idea; first modules live [17] | Lab and imaging first; pharmacy, beds, billing and HR follow [17] |
| **OHC CARE** | 2020 (COVID volunteer project) [19] | Philanthropy: Michael & Susan Dell Foundation, ACT, eGov Foundation and others; MIT licence [19] | n/a | COVID bed and ICU coordination, then TeleICU, then HMIS [19] (02 §2.10) | 200+ tele-ICUs, per a third-party quote [19] | Public-sector coordination first |
| **Narayana Athma** | 2010s, from Narayana Health [K] (10 §8) | Corporate-funded | n/a | Narayana's own hospitals [K] | "200+ facilities globally" [20]; pack says 45+ hospitals (01 §5.5) | Full HIS: EMR, ADT, LIS, RIS, OT, pharmacy, blood bank [20] |
| **KareXpert** | 2014 or 2018, depending on source [21][S] | **About US$7M in total**, including Reliance Jio (RIIHL) ₹30 crore in 2018 [21][S] | About 192 [21][S] | SaaS HIS | Claims 500+ hospitals; Inc42 says 350+ facilities [21][S] | Full HIS and EMR; NABH "Advanced" HIS+EMR certification valid 2026–2028 [22] |
| **Insta by Practo** | Acquired by Practo around 2015 [K] | Part of Practo | n/a | Indian HMS | 500+ clients and 1,200+ facilities (01 §5.5) | HMS: billing, pharmacy, lab, EMR [K] |
| **ezCaretech / BESTCare** | **2001** [25] | KOSDAQ-listed [K] | n/a | BESTCare at SNUH/SNUBH; SNUBH reached **HIMSS Stage 7 in 2010**, revalidated in 2016, 2019 and 2024 [26] | KSA via the SKHIC JV: KASCH 2014, KAMC Riyadh 2015, five more MNGHA sites 2016, Jubail 2018, UAE 2019, Yanbu 2020 [25] | Full EMR, exported as a complete product; Care Med deal ≈US$5K per bed (01 §4) |
| **Henry (Japan)** | **May 2018** [27] | Series A ¥730M (2022); Series B ¥1B (2025); Series C ¥3B (May 2026); **about ¥5.7B in total (≈US$38M [E])** [27][28], plus ¥1.2B of regional-bank venture debt [29][S] | **139 (March 2026)**; 150 per a June 2026 listing [27] | Integrated EMR, ordering and claims for hospitals; **hospital deployments began February 2023** [27] | **50+ facilities by July 2025**, about 29 months after the first deployment, mostly ~100-bed hospitals [27] | Full core for small hospitals; first 300+-bed adoption decided in 2026 [27] |
| **Oracle new AI EHR** | Teased October 2024 [30] | Corporate (Cerner had 26,400 staff in 2020 [4]) | Not disclosed | **Ambulatory available August 2025** [30]; ONC certification November 2025 (01 §2.3) | n/a | **Ambulatory only.** Acute still "this year" as of August 2026 [31], with no general availability by October 2026 (01 §2.3, 08 §15) |

### 2.2 What the benchmarks imply

1. **Even well-run, well-funded teams take three to five years to reach a full-scope inpatient go-live.** Henry took about 57 months from founding to its first hospital deployments [27]. Avelios spent four years building before its Series A [14]. Oracle, with Cerner's workforce behind it, shipped the ambulatory EHR in about 10 months but has not shipped acute care in 24 [30][31]. In this market, acute care is where timelines go to die.
2. **Successful entrants land narrow first.** Cerner started in the lab [4], athenahealth in billing [6], MediMind in the lab [17] and CARE in ICU coordination [19]. Avelios "land[s] modularly" [14]. That supports a **wedge go-live at M12–M14** (§3) before the full inpatient go-live.
3. **Hospital counts scale through groups.** Avelios's ~15 customers equal more than 70 hospitals (01 §3.4), and MediMind's single contract covers 25 hospitals [17]. Our first design partner should therefore be a **multi-hospital group**.
4. **Capital-efficient Asian builders are the closest analogues to our cost structure.** Henry (about US$38M, 139 staff, 50+ hospitals) [27] and KareXpert (about US$7M, ~190 staff) [21][S] get there by pairing low-cost engineering with domestic regulatory depth: Japanese claims engines, NABH and ABDM.
5. **Strategic investors validate hospital software.** Avelios's SAP and Fresenius rounds [16] and KareXpert's Jio backing [21][S] show that incumbents in adjacent markets buy in once product credibility exists. Their stakes did not replace Series A venture capital; they came after it.
6. **Pricing innovation exists.** Henry has moved to a fee **linked to the hospital's medical-fee revenue** [27]. Outcome- or revenue-linked pricing is credible for hospitals in self-pay and insurance-heavy markets (§12).

---

## 3. Reconciling the conflicting timelines (01, 07, 10)

### 3.1 The three clocks

| Source | Claim | What it actually measures | Reconciled position |
|---|---|---|---|
| 01 §12.3, §12.5 | "6–12-month go-lives for 100–300-bed hospitals" | Implementation time per customer once the product and foundation content are mature | **Target for customer #10 onward (≈M36+).** Customers #1–#3 take 9–15 months. |
| 07 §9.2 | "First design-partner hospital live" by M12 (exit of Phase 1) | Compliance milestone; assumes the product exists | **Re-scope as first production PHI by M12–M14 through a wedge go-live**, which starts the SOC 2 Type II evidence window. The full inpatient go-live is at **M20–M24**. |
| 10 §4.2, §4.12 | 9–12 months (small), 12–18 (mid-size), 18–24+ (large, per wave) | Implementation per customer, with foundation content | **Contractual baseline for customers #1–#10**, compressing to 6–9 / 9–12 / 15–18 months by year 4 as content matures. |
| 03 §2 | MVP vs P2 ("12–24 months") | Product scope waves | **P2 modules ship M24–M36**, after go-live #1. |
| 06 §8 | India and GCC first; UAE adapters; Indonesia or Kenya next | Market sequence | **India first (M20–M24), KSA second (M26–M30), UAE third (M30–M36).** Indonesia or Kenya only after a Series B. |
| NABH programme [23] | Certification needs **≥3 operational Indian deployments plus an ABDM M3 certificate** | Certification clock | **NABH HIS/EMR certification ≈M28–M32** at the earliest. |

### 3.2 Why M12 is unrealistic for a full inpatient go-live

The provisional MVP is about 1,350 PM at its midpoint (§4). Squad engineering can realistically ramp from about 12 FTE at M4 to about 70 FTE at M18 (§5). That ramp delivers roughly 650–750 PM by M18 and about 1,000 PM by M21. With a 15–20% productivity gain from AI coding tools, effective capacity reaches about 1,150–1,250 PM by M21 [E].

The binding constraints are not coding hours. They are:
1. clinical validation of the orders, medications and eMAR boundary (08 §14.3);
2. three integrated test cycles plus a performance test, a downtime drill and a penetration test (10 §4.2);
3. training to readiness-gate thresholds (10 §10.2).

None of these compresses with more engineers. Henry's 57 months and Oracle's 24-plus months for acute care [27][31] show that **M20–M24 for the first full inpatient go-live is aggressive but defensible**.

### 3.3 The wedge go-live (M12–M14)

At the design-partner hospital, go live first with:
- registration, scheduling and the OPD queue;
- OPD clinician chart;
- outpatient pharmacy;
- **LIS core** (clinical pathology, analyzers through middleware);
- patient accounting with TPA/PM-JAY pre-authorization and claims;
- the ABDM M1–M2 milestones.

This exercises the platform, Trust Plane, integration hub, billing and the India pack in production. It also produces revenue and SOC 2 Type II evidence. It avoids inpatient medication safety risk, which is the highest-hazard scope. MediMind's lab-first route [17] and Cerner's PathNet start [4] are the precedents.

---

## 4. Provisional reconciled MVP and bottom-up estimate

### 4.1 MVP definition (provisional, pending report 14)

**Scope:** a first live **inpatient, ED and OPD** site in a 150–400-bed private Indian hospital, followed by a KSA private hospital. It reconciles:
- doc 03's MVP list (03 §1.14, §2);
- doc 04's "build" decisions, narrowed for MVP: LIS core yes; microbiology, anatomic pathology and blood bank later (04 §8.2);
- doc 05's patient sub-ledger principle (05 §0.12);
- doc 08's platform-first items (08 §14);
- doc 09's P0 AI list, trimmed to non-device features (09 §9.2);
- doc 07's Trust Plane and v1 downtime tooling (07 §9.1).

**Deliberate departure from doc 03:** native **pharmacy, LIS core and RIS-lite are in the MVP.** Indian and Gulf private-hospital buyers evaluate one integrated HIS that includes lab, radiology worklists, pharmacy and stores. Indian vendors certified by NABH sell exactly this bundle [24].

**Integrate rather than build:** PACS and viewer, analyzer middleware, the drug knowledge base, ADCs and pumps, and BECS (US only) (04 §8.2).

### 4.2 Person-months per epic [E]

PM covers squad engineers, embedded QA/SDET and squad designers. It **excludes** clinical informatics, content, regulatory, implementation, management and G&A, which are sized in §5. Ranges reflect uncertainty about scope depth, not about team quality.

| # | Epic | MVP scope | PM low | PM high | Needed for go-live #1 |
|---|---|---|---|---|---|
| **A** | **Platform and Trust** | | **360** | **565** | |
| A1 | Cloud platform, cells and tenancy, CI/CD, GitOps, observability, environments | 08 §5, §12.3 | 60 | 90 | Yes |
| A2 | Clinical fact platform: bitemporal journal, provenance, amend/entered-in-error, outbox | 08 §14.2 | 30 | 45 | Yes |
| A3 | Trust Plane: IAM/SSO/MFA, ABAC + consent + sensitivity labels, BALP audit, keys/BYOK, break-glass, support-access log | 07 §9.1 | 45 | 70 | Yes |
| A4 | Configuration system and content tooling: typed registry, inheritance, change sets, promotion | 08 §14.6 | 35 | 55 | Yes |
| A5 | Terminology and licence-entitlement services | 06 §7.3 | 15 | 25 | Yes |
| A6 | Integration hub: HL7 v2 engine, FHIR R4/SMART façade, MLLP/TLS, outbound device/analyzer agent, acknowledgement and replay console | 06 §8, 08 §14.4 | 50 | 80 | Yes |
| A7 | Workstation shell, design system, forms and report builder, ZPL wristbands and labels | 08 §14.5 | 35 | 55 | Yes |
| A8 | Downtime and business continuity: read-only copy, downtime print, back-entry | 07 §9.1.5 | 15 | 25 | Yes |
| A9 | Data platform: CDC to lakehouse, MIS and regulatory reports | 09 §6.2 | 30 | 50 | Partial |
| A10 | AI scaffolding: gateway, grounding service, draft and provenance states, evaluation harness, control-plane MUST items | 09 §9.1 | 35 | 55 | Partial |
| A11 | Performance and safety harness: Synthea "1,000-bed day", restore drills | 08 §14.13 | 10 | 15 | Yes |
| **B** | **Patient access and clinical core** | | **480** | **740** | |
| B1 | EMPI, registration, ADT, bed board, transfers | 03 §3 | 40 | 60 | Yes |
| B2 | Scheduling, referrals, OPD tokens and queues | 03 §3.3 | 25 | 40 | Yes |
| B3 | Clinician workspace and chart | 03 §2 #7 | 35 | 50 | Yes |
| B4 | CPOE and order management: order sets, lifecycle, order-to-result tracking | 03 §7 | 45 | 70 | Yes |
| B5 | CDS engine plus drug-KB integration (interaction, allergy, dose), alert telemetry | 03 §8 | 25 | 40 | Yes |
| B6 | Physician documentation, handoff, medication reconciliation, discharge summary | 03 §6 | 35 | 55 | Yes |
| B7 | Nursing documentation, flowsheets, care plans, worklists, risk scores | 03 §10 | 40 | 60 | Yes |
| B8 | eMAR/BCMA on web and mobile, with offline-safe administration | 03 §9, 08 §1.10 | 30 | 45 | Yes |
| B9 | Pharmacy: inpatient verification, dispensing, formulary, outpatient/retail pharmacy, stores link | 04 §5 | 45 | 70 | Yes |
| B10 | ED: triage, tracking board, time-critical pathways | 03 §5 | 20 | 30 | Yes |
| B11 | OPD visit: rooming, e-prescribing, visit summary | 03 §4 | 20 | 30 | Yes (wedge) |
| B12 | Results inbox and closed-loop critical results | 03 §1.12, 04 §0.4 | 15 | 25 | Yes |
| B13 | LIS core: accessioning, specimens, middleware-connected analyzers, autoverification, basic QC | 04 §2 | 45 | 70 | Yes (wedge) |
| B14 | RIS-lite: orders, MWL/MPPS broker, worklists, report templates, PACS launch via IID | 04 §4 | 20 | 35 | Yes |
| B15 | OT scheduling plus surgical package billing (lite) | 03 §12, 05 §2.5 | 15 | 25 | Yes (private-hospital revenue driver) |
| B16 | HIM/MRD basics: deficiencies, scanning, release of information | 03 §2 #43 | 15 | 20 | Yes |
| B17 | Bedside specimen labelling and transfusion administration (not BECS) | 03 §1.11 | 10 | 15 | Yes |
| **C** | **Revenue and operations** | | **135** | **220** | |
| C1 | Patient accounting: CDM, tariffs, price lists, packages, deposits, interim bills, discounts, multi-payer, tax, cashiering | 05 §2.5, §8 | 50 | 80 | Yes (wedge) |
| C2 | Inventory, procurement and stores, with point-of-use charging | 05 §3.3 | 35 | 55 | Yes |
| C3 | Finance sub-ledger and GL connectors (Tally, Zoho, SAP, Oracle) | 05 §0.12 | 15 | 25 | Yes |
| C4 | Patient app/portal (lite) plus WhatsApp/SMS | 09 §7.7 | 20 | 35 | Partial |
| C5 | P0 AI features: ambient-partner integration, chart summary, discharge-summary draft | 09 §9.2 | 15 | 25 | Partial |
| **D** | **Country packs** | | **80** | **120** | |
| D1 | India: ABDM M1–M3, NHCX, PM-JAY/TPA pre-auth and claims, GST e-invoicing, NABH indicators | 06 §4.5 | 30 | 45 | Yes |
| D2 | KSA: NPHIES (eligibility through payment reconciliation), SBS/ICD-10-AM, Wasfaty, ZATCA e-invoicing [K], Arabic RTL and Hijri calendar, CBAHI reports | 05 §2.2, 06 §8 | 40 | 60 | For go-live #3 |
| D3 | Localization infrastructure: i18n, RTL, calendars, multi-currency | 08 §14.14 | 10 | 15 | Yes |
| | **Total MVP** | | **1,055** | **1,645** | |

**Phase 2 additions (not in MVP) [E]:**

| Module | PM |
|---|---|
| UAE pack (Malaffi/NABIDH/Riayati, DHA/DoH e-claims) | 35–50 |
| Full perioperative care plus AIMS | 50–80 |
| ICU with device integration | 40–60 |
| Maternity and neonatal | 35–50 |
| Microbiology | 30–45 |
| Non-US blood bank | 35–55 |
| HR, rostering and payroll connectors | 30–50 |
| Command centre | 20–30 |
| Oncology | 30–45 |
| Inpatient and nursing ambient AI | 20–30 |
| **Total** | **≈325–495** |

### 4.3 Converting PM to time and money [E]

- **Cost per squad PM:** about US$4.0–5.5K in India, US$7–10K in KSA and US$8–10K in the EU. The planned mix (about 80% of squads in India) blends to roughly US$5–6K.
- **MVP squad engineering cost:** US$5.5–9.5M.
- **Fully loaded cost through go-live #1:** applying a factor of about 1.8 for clinical, platform-adjacent, product, QA-central, regulatory and G&A roles gives **US$10–17M**. That is consistent with the US$6.5M (year 1) plus about US$9M (M12–M21) in the base budget (§6).
- **AI-assisted development:** assume a **15–20% PM reduction** on coding-heavy epics (A1, A4, A6, A7, C1–C4) and **0%** on validation-heavy epics (B4–B9, B13, D1–D2). Do not plan on MediMind-style compression [17] for inpatient medication workflows.

---

## 5. Team plan: composition, ratios, locations and cost

### 5.1 Phased organization (headcount at the end of each phase) [E]

| Function | Phase 0: Foundation (M0–M4) | MVP build (M4–M18) | Design-partner go-live and first 3 (M18–M30) | Scale (M30–M48) |
|---|---|---|---|---|
| Leadership (CEO, CTO, CPO, COO/CFO, CMIO-exec) | 5 | 6 | 7 | 9 |
| Architecture / staff engineers | 4 | 6 | 6 | 8 |
| **Domain squads** (engineers + embedded QA + designer) | 10 (2 seed squads) | **66 (11 squads × 6)** | 84 (14 squads) | 120 (20 squads) |
| Platform / SRE / DevEx | 3 | 9 | 12 | 18 |
| Security (AppSec, SecOps, GRC; CISO from M9) | 1 | 4 | 6 | 10 |
| Central QA and test automation (performance, safety regression, E2E) | 1 | 5 | 7 | 10 |
| Clinical informatics (CMIO, CNIO, pharmacists, nurses, lab, radiology, RCM SME) | 3 | 9 | 13 | 18 |
| Content factory (order sets, templates, CDM/tariffs, formulary mapping) | 0 | 4 | 8 | 14 |
| Localization (clinical Arabic plus vendors) | 0 | 2 | 3 | 5 |
| Regulatory / QMS / Clinical Safety Officer / DPO | 1 | 3 | 4 | 7 |
| Product management and UX research | 2 | 7 | 9 | 12 |
| Implementation consultants | 0 | 5 | 25 | 45 (+ partners) |
| Support (L1–L3; 24×7 from go-live #1) | 0 | 2 | 12 | 30 |
| Pre-sales, sales, partner management, marketing | 1 | 5 | 12 | 22 |
| G&A (finance, HR/recruiting, legal, internal IT) | 2 | 7 | 10 | 16 |
| **Total** | **33** | **≈140** | **≈218** | **≈344** |

*Note:* phase-end totals are planning envelopes. The year-end budget headcounts in §6.1 (100, 165, 220, 285, 345) phase the same plan by fiscal year. The Lean case holds the M18–M30 column at about 170 until G3 passes.

**Squads at MVP peak (11):**
1. Identity, ADT and scheduling
2. Chart and documentation
3. Orders, CPOE and CDS
4. Medications (pharmacy + eMAR/BCMA)
5. Nursing and ED
6. Diagnostics (LIS/RIS)
7. Patient accounting and claims
8. Inventory and sub-ledger
9. Integration hub plus India pack
10. KSA pack plus localization
11. Patient app plus AI features

The Phase 2 squads (12–14) take periop/ICU, maternity/microbiology and the UAE pack.

### 5.2 Ratios we should hold [E]

| Ratio | Target | Rationale |
|---|---|---|
| Clinical informaticists : domain squads | 1 : 2 (and a pharmacist embedded in the Medications squad) | Clinician–developer proximity is how SNUBH and Narayana succeeded (10 §8) |
| QA/SDET : engineers | 1 : 5 embedded, plus a central team at about 7% of R&D | Safety-critical regression and performance gates (08 §14.13) |
| SRE : engineers | 1 : 8–10 early, 1 : 12 at scale | Cell-based, multi-region operations (07 §9.1.3) |
| Security : total headcount | ≈4% | ISO/SOC 2, penetration-test remediation, JIT PAM (07 §9.1) |
| Implementation FTE : concurrent mid-size project | 6–10 vendor FTE per 150–500-bed project (customer provides 10–25 analysts) | Consistent with 10 §4.3 for S/M hospitals with foundation content |
| Support : live hospitals | ≈1 L1/L2 FTE per 2–3 live hospitals in year 1 after go-live; 1 per 5 at maturity | 24×7 coverage starts with go-live #1 |
| Content FTE : market | 3–4 per launch market (India, KSA) | Foundation content is "our second product" (10 §10.1) |
| R&D : total headcount | ≥60% during build; ≈45% at scale | Comparable to Epic's stated 35% of operating expense in R&D [2], which is lower because Epic is mature |

### 5.3 Hiring locations

| Location | Share of headcount (M18 → M48) | Roles | Notes |
|---|---|---|---|
| **India** (Bengaluru, Hyderabad or Pune) | 70% → 62% | Squads, platform, QA, content factory, L2/L3 support, India implementation, Indian clinical informatics | Deepest HIS talent pool (NABH-certified vendors cluster here [24]) |
| **KSA** (Riyadh) | 8% → 15% | Implementation, pre-sales, Arabic clinical informatics, L1 support, DPO/compliance, NPHIES specialists | **Nitaqat applies.** Engineering roles requiring Saudi Council of Engineers accreditation face a **30% Saudization rate with a SAR 8,000 minimum counting wage**, applying from 30 June 2026 (Decision 93483) [40][41]. A separate decision raises technical engineering professions to 30% gradually over five years from July 2025 [42][S]. Plan for at least 30–40% Saudi nationals in the KSA entity by year 3 [E]. Software-developer roles fall under the general Nitaqat bands [K]. |
| **UAE** (Dubai or Abu Dhabi) | 2% → 5% | GCC sales leadership, UAE implementation from year 3 | Needed for the UAE in-country data posture (07 §1.9) |
| **EU** (Poland, Portugal or Germany) | 5% → 6% | Security architecture, clinical safety/regulatory (DCB0129, MDR, IEC 62304), selected staff engineers | Positions the company for later EU/UK entry (06 §8 Phase 2; 07 §9.2) |
| Other (US/UK advisors, executives) | ≤5% | Board-level product and clinical leadership | Keep small |

### 5.4 Loaded cost per FTE by location [E]

| Location | Market base (median total compensation, software engineer) | Loading factor [E] | Loaded annual cost [E] |
|---|---|---|---|
| India | ₹3.03M nationally; ₹3.86M in Bengaluru [35] (≈US$34–44K) | 1.3–1.4× (benefits, gratuity, office, equipment, attrition backfill) | **US$45–60K** mid-level; US$80–120K staff or architect; clinical informaticists US$30–60K [K]; implementation consultants US$25–45K [K] |
| KSA | SAR 204K nationally; SAR 240K in Riyadh [36] (≈US$54–64K) | 1.4–1.6× (GOSI, expatriate levy of about SAR 800 a month [K], iqama, medical insurance, end-of-service, relocation) | **US$80–100K** expatriate; Saudi nationals US$55–110K depending on role (engineering roles must pay at least SAR 8,000 a month to count [40]) |
| UAE | AED 344K (≈US$94K) [37] | 1.2–1.3× | **US$110–125K** |
| Germany | €84.6K (Munich €86.6K) [38] | 1.25–1.3× (employer social contributions) | **US$115–130K** |
| Poland | PLN 267K (Warsaw PLN 341K) [39] | 1.15–1.25× | **US$80–95K** |
| **Blended plan** | | | **US$85K in year 1** (senior-heavy) **falling to US$75K by year 5** |

*Caveat:* Levels.fyi over-represents technology-company respondents, so these figures sit at the upper-middle of each market. Indian health-IT vendors pay less, which is part of how KareXpert operates on about US$7M [21][S].

---

## 6. Budget, burn rate and scenarios

### 6.1 Base case, five years [E]

| | Year 1 (M0–12) | Year 2 (M12–24) | Year 3 | Year 4 | Year 5 |
|---|---|---|---|---|---|
| Headcount, end of year / average | 100 / 55 | 165 / 140 | 220 / 190 | 285 / 250 | 345 / 315 |
| Blended loaded cost per FTE | US$85K | US$80K | US$77K | US$75K | US$75K |
| **Labor** | US$4.7M | US$11.2M | US$14.6M | US$18.75M | US$23.6M |
| **Non-labor** (§7) | US$1.8M | US$4.05M | US$6.0M | US$8.5M | US$11.5M |
| **Operating cost** | **US$6.5M** | **US$15.25M** | **US$20.6M** | **US$27.25M** | **US$35.1M** |
| Hospitals live (end of year) | 0 (wedge at M12–14) | 2 | 10 | 28 | 55 |
| Beds live (average 220) | 0 | 440 | 2,200 | 6,160 | 12,100 |
| ARR, end of year | ≈0 | US$0.2M (design-partner discounts) | US$2.0M | US$6.8M | US$13.3M |
| Revenue: subscription (recognized) | 0 | US$0.1M | US$1.1M | US$4.4M | US$10.0M |
| Revenue: implementation services | 0 | US$0.4M | US$3.0M | US$6.7M | US$10.0M |
| **Total revenue** | **0** | **US$0.5M** | **US$4.1M** | **US$11.1M** | **US$20.0M** |
| **Net burn** | US$6.5M | US$14.75M | US$16.5M | US$16.15M | US$15.1M |
| Cumulative net burn | US$6.5M | US$21.25M | US$37.75M | US$53.9M | **US$69.0M** |
| Average monthly burn | US$0.54M | US$1.23M | US$1.38M | US$1.35M | US$1.26M |

**Revenue assumptions [E]:**
- By beds, the mix is 55% India and 45% GCC.
- India bundle: US$30 per bed per month. GCC bundle: US$140 per bed per month.
- Add-ons (AI, ambulatory, analytics) add 15%, giving a blended **≈US$1,100 ARR per bed per year**.
- Design partners pay 40–50% of list in years 1–3.
- Implementation fees average US$150K per Indian hospital and US$700K per GCC hospital (≈US$370K blended).

**Breakeven:** about year 6–7, at roughly US$35–45M ARR (about 35–40K beds live) with services at or below 30% of revenue.

### 6.2 Scenarios [E]

| | **Lean** | **Base** | **Aggressive** |
|---|---|---|---|
| Strategy | India first, KSA from year 3, UAE from year 4; MVP without UAE, microbiology or anatomic pathology; partner-led implementation from customer #3; ≥75% of staff in India | §6.1 | India, KSA and UAE in parallel from year 2; native microbiology, anatomic pathology and non-US blood bank, plus periop/ICU/maternity in year 2; ISO 13485/MDR preparation in years 4–5; in-house implementation workforce |
| First inpatient go-live | M22–M26 | M20–M24 | M18–M22 (needs ~90 squad engineers by M12) |
| Headcount in year 5 | ≈200 | ≈345 | ≈550 |
| Five-year operating cost | ≈US$60M | ≈US$105M | ≈US$170M |
| Five-year revenue | ≈US$22M | ≈US$36M | ≈US$60M |
| Cumulative net burn | ≈US$38M | ≈US$69M | ≈US$110M |
| **Capital to raise (with buffer)** | **US$45–50M** | **US$80–90M** | **US$130–150M** |
| Hospitals live in year 5 | 30–35 | 50–60 | 90–110 |
| Main risk | Too slow for GCC buyers; weak references | Funding gap between G3 and G4 | Execution sprawl, as in the Mesalvo and Oracle failure patterns (01 §10.2) |

**Recommendation:** fund the **Base** case but **operate to Lean** until gate G3 passes. Release the Base hiring plan for M21–M30 only when go-live #1 meets its readiness and stabilization gates.

---

## 7. Non-labor costs

### 7.1 Certification and compliance

| Item | Indicative cost | Timing | Source / note |
|---|---|---|---|
| SOC 2 Type I, then Type II | US$40–120K a year audit + US$20–60K a year GRC tooling | Type I ≈M9; Type II ≈M15–M18 (needs the production window from the wedge) | 07 §3.3 |
| ISO 27001 + 27701/27017/27018 | US$30–100K first cycle + US$30–100K optional consultancy | M12–M15 | 07 §3.3 |
| Penetration tests (CREST/CHECK), two a year; red team from year 3 | US$30–100K per test; red team US$80–250K | First by M11 (before go-live #1) | 07 §3.3 |
| **NABH Digital Health Standards, HIS/EMR** | **₹50K–1.5 lakh + 18% GST for two years** (Basic ₹75K or Advanced ₹1.5 lakh for HIS+EMR) | **Only after ≥3 operational Indian deployments + ABDM M3** | [23] |
| ABDM certification incl. WASA / Safe-to-Host audit by a CERT-In-empanelled auditor | Audit ≈US$3–10K a year [E]; 3–6 months of engineering and testing | M10–M16 | 06 §4.5; KareXpert's WASA certificate runs for one year [22] |
| NPHIES onboarding and SBS conformance (KSA) | No public fee found; engineering plus conformance testing, often with an accredited integrator [K] | M14–M24 | 06 §4.1; 05 §0.9 |
| NCA ECC/CCC alignment (KSA), CST-registered cloud | US$30–100K advisory and audit | M14–M24 | 07 §3.3 [U there] |
| ADHICS mapping (Abu Dhabi), UAE cell | US$20–60K | Years 3–4 | 07 §3.3 |
| Later: HITRUST i1/r2; ONC; ISO 13485 + IEC 62304; EU MDR notified body; DCB0129 safety case; FDA 510(k) | i1 US$50–120K; r2 US$100–300K+; ONC US$50–200K fees plus multiple FTE-years; ISO 13485 US$150–500K; MDR €50–150K notified-body fees; DCB0129 = 0.5–1 FTE CSO; 510(k) US$250K–1M+ | Year 4+ and only on a market decision | 07 §3.3, §9.2 |

**Implication.** Compliance fees are not what makes this expensive. Two things are: **gating conditions**, where NABH needs three sites and NPHIES needs working integrations before award (01 §4 citing Black Book), and the **engineering time** to pass them.

### 7.2 Content and terminology licensing

| Item | Cost model | Planning number [E] | Source |
|---|---|---|---|
| SNOMED CT | Free in member territories (India, KSA, UAE, Qatar are members); non-members pay an MLDS fee by World Bank band | Zero in launch markets; price it into deals in non-member countries | 06 §5 |
| AMA CPT (needed in the UAE) | Distribution licence per product; about US$18.50 per user (CPT Standard 2026, unconfirmed) | US$10–40K a year at early UAE scale | 06 §5 |
| IHACPA ICD-10-AM/ACHI (KSA SBS lineage) | Vendor Electronic Code List licence of about A$2,000–11,250 plus about A$2,000 per code list; country licence is government-to-government | US$5–15K a year | 06 §5 |
| Drug knowledge base (FDB, Medi-Span, Lexidrug, MIMS/CIMS; regional drug files) | Not published; usually a minimum annual fee plus per-bed or per-site royalties [K] | **US$50–150K a year minimum** plus **US$5–20 per bed per year** [E]; SFDA and other national drug files are generally free (06 §5) | 04 §8.2 ("License. Never build.") |
| Analyzer middleware, PACS | Customer-paid in most private-hospital deals [K] | Pass through | 04 §8.2 |
| Medplum (if adopted) | Self-hosted Community edition is free; cloud tiers US$2K/US$6K per month | Self-host | 02 §4.1 |

### 7.3 Sovereign-cloud hosting per bed [E]

- **Regions:**
  - **India:** AWS Mumbai/Hyderabad, Azure and GCP; MeitY-empanelled providers for government work (07 §1.9).
  - **UAE:** Azure UAE North/Central, AWS me-central-1, Oracle or Core42 sovereign options (07 §1.4).
  - **KSA:** AWS lists the Kingdom as an **announced, not yet live** region in October 2026 [51]. In-Kingdom options today are CST-registered providers such as Google Cloud (Dammam, via a local JV), Oracle (Jeddah/Riyadh), STC Cloud and others [K]. That favors a **cloud-portable Kubernetes/PostgreSQL stack** (08 §12.5).
- **Cost targets:**

  | Item | India | GCC |
  |---|---|---|
  | Production hosting per bed per month, shared cells, HA plus DR plus immutable backups | **US$2.5–4** | **US$10–18** (sovereign premium) |
  | Share of subscription revenue | ≤12% | ≤12% |
  | Hospitals per production cell | 10–20 (250 beds each) | 10–20 (250 beds each) |
  | Pooled small-hospital tier | Below 100 beds (08 §1.8) | Below 100 beds (08 §1.8) |
  | Year-5 cloud budget, including dev/test and DR | ≈US$3M total (§6.1) | (included in total) |

- **Comparator:** commodity Indian HMS vendors charge about ₹800–1,000 per bed per month all-in [47][E]. They cannot afford HA, a DR region and a lakehouse, and that is part of our differentiation. It also caps how heavy our India cell can be.

### 7.4 AI partner costs

- **Ambient scribes:** enterprise pricing is about **US$150–600 per clinician per month** (09 §1.2, estimate). Prosumer tools list at **US$39–119 per clinician per month** [50].
- **Plan [E]:** pass ambient costs through with at least 30% margin. In India, target a **₹2,500–5,000 (US$28–57) per clinician per month** price point using the model gateway, regional speech-recognition partners and commodity LLM routing (09 §9.1.4). Budget US$0.05–0.30 of LLM/ASR cost per encounter [E].

### 7.5 Insurance, legal, entities

| Item | Planning number [E] | Note |
|---|---|---|
| Cyber plus technology E&O / product liability | US$25–80K a year before go-live #1, rising to US$250–600K a year for US$5–10M+ limits | Hospital RFPs ask for cyber limits of US$5–10M+ (07 §3.2) |
| KSA entity, legal, licensing | US$150–300K a year | RHQ licensing only if bidding for government work (§10.4); RHQ obligations [K] include a minimum resident headcount |
| Source-code escrow (tri-party) | US$2–10K a year per beneficiary [K] | Viability counter-measure (§12.3) |

### 7.6 Non-labor line items by year [E]

| Line (US$M) | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|---|---|---|---|---|---|
| Cloud (dev, test, production, DR) | 0.35 | 0.70 | 1.20 | 2.00 | 3.00 |
| Security and compliance | 0.25 | 0.45 | 0.50 | 0.60 | 0.80 |
| Content and terminology licences | 0.07 | 0.25 | 0.50 | 0.80 | 1.20 |
| Insurance | 0.08 | 0.20 | 0.30 | 0.40 | 0.50 |
| Legal and entities | 0.25 | 0.30 | 0.30 | 0.30 | 0.40 |
| Offices and equipment | 0.35 | 0.60 | 0.80 | 1.00 | 1.20 |
| Recruiting | 0.30 | 0.50 | 0.50 | 0.50 | 0.50 |
| Travel (on-site implementation) | 0.15 | 0.40 | 0.60 | 0.80 | 0.90 |
| Sales and marketing programmes | 0.00 | 0.50 | 1.00 | 1.50 | 2.00 |
| AI partners and LLM | 0.00 | 0.15 | 0.30 | 0.60 | 1.00 |
| **Total** | **1.80** | **4.05** | **6.00** | **8.50** | **11.50** |

---

## 8. Critical path and gate plan

### 8.1 Critical path from M0 to the first inpatient go-live

| Months | Workstream | Dependency / why it is critical |
|---|---|---|
| M0–M4 | ADR-001 to ADR-010; platform skeleton; Trust Plane design; hazard log; CSO appointed; ISMS scope (08 §14.1; 07 §9.2) | Everything depends on the clinical fact platform and the Trust Plane (08 §14.2; 07 §9.1.1) |
| **M2–M6** | **Design partner #1 signed** (Indian group with 3+ hospitals; LOI by M3, co-development agreement by M6) | Clinical SMEs, workflows, data and the NABH three-site path all depend on it |
| M3–M9 | Drug-KB selection (M3–M6) and integration (by M9) | Gates CDS (B5) and pharmacy (B9) |
| M4–M14 | Orders, medications and eMAR state machines, designed with pharmacists and nurses before UI (08 §14.3) | **Longest clinical chain**; highest-hazard scope |
| M6–M16 | India foundation content: order sets, CDM/tariffs/packages, formulary mapping, NABH forms (10 §10.1) | Gates training and integrated testing |
| M6–M16 | Patient accounting plus TPA/PM-JAY/NHCX and ABDM M1–M3; WASA audit M14–M16 (06 §4.5) | Revenue at the wedge and go-live |
| M8–M16 | Integration at the partner: analyzer middleware, PACS/IID, legacy data migration | Customers judge go-live by integration (08 §14.4) |
| **M12–M14** | **Wedge go-live** (OPD, billing, outpatient pharmacy, LIS core) | First production PHI; starts the SOC 2 Type II window; first revenue |
| M15–M19 | Three integrated test cycles; performance test (1,000-bed day); downtime drill; penetration test | Exit criteria per 10 §4.2 |
| M17–M20 | Role-based training; readiness gates at T-90/-60/-30 (10 §10.2) | ≥95% completion and ≥85% proficiency |
| **M20–M24** | **Inpatient + ED go-live at hospital #1**, then 90-day stabilization | Gate G3 |

**Parallel KSA track:**
- KSA entity: M9–M12
- design partner #2 signed: M12–M15
- KSA cell and NPHIES/SBS onboarding: M14–M22
- Arabic clinical content: M12–M22
- **KSA go-live: M26–M30**

### 8.2 Gates (each is a go/no-go and a funding trigger)

| Gate | Target | Exit criteria | Linked decision |
|---|---|---|---|
| **G0** | M0 | Seed closed (US$8–10M); founding CTO and CMIO; the first five ADRs | Start Phase 0 |
| **G1** | M4–M6 | Design partner #1 contract; Trust Plane and clinical fact platform demonstrated; hazard log live; drug KB chosen | Ramp to 11 squads |
| **G2** | M12–M15 | **Wedge live with production PHI**; SOC 2 Type I; ISO stage-1 audit; ≥5 qualified pipeline accounts including 1 GCC LOI | **Series A (US$20–25M)** |
| **G3** | M20–M24 | **First inpatient go-live** passes readiness gates; 90-day stabilization exit (tickets back to baseline, safety KPIs within tolerance; 10 §10.3) | Release the Base hiring plan |
| **G4** | M26–M30 | **3 live hospitals including 1 in KSA**; NPHIES in production; ARR ≥US$1.5M; independent operational assessment (10 §10.2.2) | **Series B (US$40–50M)**; partner-led implementations begin |
| **G5** | M36–M42 | **10 live hospitals**; NABH HIS/EMR certified (Advanced); first EMRAM Stage 6 validation scheduled; services ≤60% of revenue | Open the UAE; P2 modules GA |
| **G6** | M54–M66 | **2–3 Stage 6/7 reference sites** (first Stage 7 at the design partner); ARR ≥US$12M; subscription gross margin ≥70% | Growth round or path to profitability; EU/UK option (06 §8 Phase 2) |

**EMRAM timing rationale [E][K].** Stage 6 requires closed-loop medication administration, structured documentation and CDS in routine use, which typically comes 12–24 months after a stable go-live. Stage 7 requires sustained paperless operation and analytics. SNUBH reached Stage 7 in 2010 [26] after opening as a paperless hospital in 2003 [K].

---

## 9. The anchor and co-development hospital model

### 9.1 Who

- **Design partner #1 (India):** a NABH-accredited private group with **3+ hospitals**, a 150–400-bed flagship, a credible CMIO and CNO, and an insurance-heavy payer mix (TPA, PM-JAY).
  - A group satisfies NABH's three-deployment rule within one relationship [23].
  - Hospital counts scale through groups, as with Avelios and MediMind [17] (01 §3.4).
- **Design partner #2 (KSA):** a private group with 2–6 hospitals and 200–500 beds, under NPHIES/SBS and ZATCA pressure, with a JCI or CBAHI agenda.
- **Optional academic adviser:** a teaching hospital as a clinical-content and safety reviewer, not as a go-live site. Academic go-lives inflate scope.

### 9.2 Commercial terms (term-sheet hypothesis) [E]

| Term | Proposal | Why |
|---|---|---|
| Subscription | 50–60% off list for years 1–3; list minus 20% from year 4; price lock for 7 years | Compensates for co-development effort and risk |
| Implementation | Vendor bears its own implementation cost for go-live #1; hospital funds its internal team | Shared risk; matches doc 10's TCO split (10 §9.1) |
| Co-development staffing | Hospital commits named SMEs with protected time: CMIO 0.5, CNIO 1.0, pharmacist 1.0, nurses 2.0, lab 0.5, billing/RCM 1.0 FTE. Vendor pays a **backfill stipend of US$100–300K a year** or offsets it through the discount. | Clinician–developer proximity (10 §8); superusers need protected time (10 §10.2.6) |
| IP | All product IP belongs to the vendor. The hospital gets a perpetual, royalty-free right to content it authored for internal use and is credited as a "founding clinical partner". | Avoids IP fights that block resale |
| Upside | Either (a) **0.5–2% equity or warrants** vesting at G3 and G4, or (b) a **5–10% referral share** of first-year subscription from referred customers | Aligns the anchor with references and Group Connect (01 §12.3) |
| Reference obligations | Up to 6 site visits a year, case studies, KLAS/HIMSS participation, joint conference talks | References are the scarcest asset (§14) |
| Go-live discipline | Go-live only on readiness gates, not dates. Pre-agreed rollback and slow-down triggers (10 §10.2.7). | VGR, Helseplattformen and VA lessons (10 §1.11–1.12) |
| Downside protection for the hospital | If G3 is not met by M26, the hospital may terminate with a refund of prepaid fees, and the vendor funds up to 6 months of legacy-system extension (capped) | Credibility with the board |
| Data | DPA; de-identified data for product improvement only under governance; no model training on PHI without explicit approval (09 §9.1.5) | DPDP/PDPL alignment (07 §0.8–0.9) |
| Exit | Free FHIR Bulk plus full database export; source-code escrow (§12.3) | Counters vendor-viability fear |

---

## 10. Go-to-market

### 10.1 Ideal customer profile

| Attribute | India | GCC (KSA first, then UAE) |
|---|---|---|
| Type | Private multi-specialty hospitals of 150–500 beds; regional chains of 3–15 hospitals; PE-backed platforms doing roll-ups | Private groups of 2–10 hospitals (200–600 beds per flagship); PPP operators (HHC runs 19 PPP projects worth US$2.9B, with >100 projects worth US$12.8B expected; plans to privatize 290 hospitals [46]) |
| Triggers | NABH 6th edition and Digital Health Standards; ABDM/DHIS incentives (software vendors receive 25% of facility incentives; 06 §4.5); TPA/PM-JAY/NHCX claims friction; expansion or M&A integration | NPHIES/SBS conformance (vendors without working integrations "may be eliminated"; 01 §4); ZATCA e-invoicing [K]; CBAHI/JCI; PDPL; UAE HIE mandates (Malaffi, NABIDH, Riayati) |
| Incumbent | Local HIS (KareXpert, Insta, Suvarna, Akhil, others) [24]; in-house systems at the largest chains (01 §5.5) | Oracle Health, InterSystems, IQVIA, Epic (top tier); ezCaretech; local vendors (01 §4) |
| Our wedge | Clinical depth (CPOE, eMAR/BCMA) plus TPA automation plus AI at ≤2× local price | One HIS+ERP at below-Oracle TCO, in-Kingdom hosting and team, NPHIES-native, Arabic-first |
| Avoid (years 1–3) | Government/state HMIS tenders (lowest price wins; SI-led) [K] | Public cluster tenders without an RHQ; national mega-deals |

### 10.2 Buying committee

- **India:** promoter or managing director (often decides), CEO/COO, CFO, medical director or CMO, nursing director, head of insurance/TPA desk, NABH quality coordinator, IT head, pharmacy and lab heads. In PE-owned groups, add the operating partner.
- **GCC:** board or executive committee, CEO, CFO, CIO, CMIO, CNO, revenue-cycle head (NPHIES), procurement committee, DPO/CISO (PDPL, NCA). Global advisers (Big Four) often run the selection [K].

### 10.3 Sales-cycle benchmarks [E]

| Segment | Cycle (first meeting to signature) | Notes |
|---|---|---|
| India, single 150–300-bed hospital | 4–9 months | Reference visit to a live site is decisive [K] |
| India, 3–15-hospital chain | 9–15 months | Pilot at one hospital common; NABH certification lowers risk after G5 |
| GCC private group | 9–18 months | RFP; Saudi integration proof before award (01 §4) |
| GCC public / cluster / PPP | 18–36 months | Etimad; RHQ; local content (§10.4) |

KLAS reports buying activity at a near five-year low outside the US, with local and regional vendors winning 66% of hospital decisions (01 §1.7). That favors regional entrants but also lengthens cycles.

### 10.4 Tender mechanics

**Saudi Arabia**
- **Etimad** is the government e-procurement platform. The RHQ exemption service went live on Etimad in **November 2025** [43].
- **RHQ rule (in force since early 2024):** government entities, authorities and state-affiliated funds may not contract with foreign companies whose regional HQ is outside KSA.
  - Contracts of **SAR 1M or less** are exempt.
  - Bids from non-RHQ companies may be accepted only if there is **no more than one technically compliant bid**, or if the bid is among the best technically and **at least 25% cheaper than the second-best** bid.
  - Exemptions must be requested before the tender is launched [43].
  - More than 700 multinationals had moved regional HQs to Riyadh by early 2026 [43].
- **LCGPA local content (secondary sources):** a 10% price preference for national products; for high-value contracts of SAR 25M or more, an evaluation weighting of 60% price and 40% local content plus capital-market listing; a 10% SME preference in some contract types; a mandatory list. The new procurement law lets an LCGPA representative sit on bid committees [45][S]. The primary MoF regulation could not be fetched [44].
- **NUPCO** centralizes procurement of medicines, devices and supplies, with prequalification [46]. It is relevant to the drug files and stores modules, not to HIS procurement.
- **Local agent:** not required, but a local partner is "strongly recommended" [46]. The KSA entity's Nitaqat band affects eligibility and visas [K].
- **Implication:** the **private sector first** route needs no RHQ. Decide on an RHQ by M18 only if HHC clusters or PPP operators become targets.

**UAE [K]**
- Emirate-level procurement; In-Country Value (ICV) certificates are scored in many Abu Dhabi and federal tenders.
- In-country hosting is mandatory for health data (07 §1.9).
- The HIE integration (Malaffi, NABIDH, Riayati) is a hard gate (06 §8).

**India [K]**
- Central and state purchasing runs through GeM and state portals.
- The Public Procurement (Preference to Make in India) Order favors "Class-I local suppliers" (high local content) and restricts non-local suppliers below the global-tender threshold. An India-incorporated, India-engineered company qualifies.
- State HMIS tenders are typically lowest-price (L1) and system-integrator-led. They are not our ICP until after G5.

### 10.5 Partner and channel strategy

| Category | Shortlist (illustrative; verify capacity and conflicts) | Role | Commercial model [E] |
|---|---|---|---|
| Global advisers/SIs | Deloitte, PwC, KPMG, EY, Accenture (GCC health practices) [K] | Selection influence; programme management for large groups | Non-exclusive; no fees for inclusion; joint delivery at their rates |
| Indian SIs | TCS, Infosys, Wipro, HCLTech, Tech Mahindra [K] | Implementation capacity from customer #4; GCC delivery with Arabic teams | Partner keeps services revenue; we keep subscription; certification academy (10 §10.2.3) |
| Gulf integrators / national champions | Elm, solutions by stc, Al Moammar Information Systems (MIS), Lean Business Services (PIF-owned health-tech) [K]; Waseel (NPHIES connectivity/RCM) [K]; UAE: Core42/G42, e& enterprise [K] | Local content, in-Kingdom delivery, NPHIES operations, sovereign hosting | Reseller margin 20–30% of first-term subscription, or referral fees of 10–15% of first-year ACV |
| Cloud partners | AWS, Microsoft, Google (KSA via local JV), STC Cloud, Core42 [K] | Sovereign regions, co-sell, marketplace listing, credits | Marketplace fee 3–5% [K]; co-sell incentives |
| Local distributors (India tier-2/3 cities) | Regional HIS resellers [K] | Hospitals of 50–150 beds on the pooled tier | 20–25% margin; we run L2/L3 |
| Clinical-content partners | Drug-KB vendor; order-set content providers [K] | Foundation content | Royalty pass-through |
| Group Connect hosts | Our anchor groups | Host affiliated hospitals and clinics on their tenant (01 §12.3) | 10–20% revenue share of spoke subscriptions |

**Rule:** at most one deeply integrated SI per country in years 1–3, so the methodology stays ours. Partners must pass our certification before leading a go-live.

---

## 11. Unit economics [E]

| Metric | India hospital (220 beds) | GCC hospital (300 beds) | Target |
|---|---|---|---|
| ACV (subscription, list) | 220 × US$30 × 12 ≈ **US$79K** | 300 × US$140 × 12 ≈ **US$504K** | — |
| Implementation fee | US$100–250K | US$450K–900K (US$1.5–3K per bed) | Services GM 15–25% |
| Hosting plus licences | ≈US$12–18K (15–22% of ACV early) | ≈US$55–80K (11–16%) | ≤12% at scale |
| Steady-state CAC | US$40–80K | US$150–300K | Blended CAC ratio ≤1.0 by year 5 |
| CAC payback on subscription gross margin (65%) | 9–19 months | 5–11 months | ≤24 months including early-year inefficiency |
| Logo churn | — | — | <3% a year (HIS replacement cycles run 7–15 years [K]) |
| NRR | — | — | ≥115% (beds, modules, AI add-ons, Group Connect) |

At the company level, year-3 sales and marketing (≈US$3M) against ≈US$1.9M of new ARR gives a CAC ratio of about 1.6. Year 5 (≈US$6M against ≈US$6.5M of new ARR) gives about 0.9.

**Gross margin path:**
- subscription: 55–60% in year 3, 70–75% in year 5, 78–80% at steady state;
- blended (with services): about 45–55% in year 5.

**Services mix:** about 70% of revenue in year 3, which is normal during a build-out. Target ≤40% in year 5 and ≤25% by year 7 by moving implementation to certified partners.

**The structural point.** One GCC hospital brings in about 6.4× the subscription of an Indian hospital of similar scale. **India is the build-and-prove market (01 §5.5); the GCC is the economic engine.** If GCC customers are below about 50% of ARR at G5, the Base case does not reach breakeven by year 7.

---

## 12. Pricing benchmarks, price sheet and contract terms

### 12.1 Benchmarks

| Benchmark | Figure | Basis / caveat | Source |
|---|---|---|---|
| Indian commodity HMS SaaS | ₹3–12 lakh a year (25–100 beds); ₹12–50 lakh+ a year (100–500+ beds), ≈**₹800–1,000 per bed per month** at 100–500 beds [E]; implementation adds 20–40%; "add 25–40%" to quotes for real first-year cost | Vendor blog survey | [47] |
| ezCaretech, Care Med (KSA) | US$6.96M for 4 hospitals and ≈1,300 beds plus 2 clinics, ≈**US$5K per bed** (one-time contract) | Excludes customer internal cost | 01 §4 |
| Philips/Bionexo Tasy | ≈US$27K per client per year average | Soft: unverified revenue, client count in conflict | 01 §5/§6 |
| Epic hosted / licence | Hosted from ≈**US$200 per user per month**; hospital licences US$10–30M+ upfront plus US$1.5–3M a year | Third-party estimates, not Epic prices | [48] |
| Epic Community Connect | Salinas Valley board packet: **US$7.0M over 5 years**, of which practices pay ≈US$1.2M; host can subsidize up to 85% (Stark 15% minimum; 01 §9.1) | One public board document; no per-user list price on the cited guide | [48][49] |
| Henry (Japan) | Fee linked to the hospital's medical-fee revenue | Company commentary, no amounts | [27] |
| Ambient AI | US$39–119 prosumer; US$150–600 enterprise per clinician per month | Public list plus pack estimate | [50]; 09 §1.2 |
| Medplum platform | US$2K / US$6K per month cloud tiers | Platform, not an HIS | 02 §4.1 |

**Revision to doc 01 §12.3.** "US$1.5–6K per bed per year all-in" is about 4–16× above what Indian private hospitals pay for HMS today. For India, use **US$0.3–0.5K per bed per year** for an enterprise bundle. For the GCC, use **US$1.3–2.0K per bed per year** for SaaS plus a separate implementation fee.

### 12.2 Price sheet hypothesis (v0.1, to validate with design partners) [E]

**India (INR, per operational bed per month, annual commitment, 5-year term)**

| Tier | Contents | Price |
|---|---|---|
| Core HIS | Registration/ADT, OPD/IPD, billing and packages, TPA/PM-JAY/NHCX, pharmacy, LIS core, RIS-lite, stores, MIS, ABDM | ₹1,200–1,800 |
| Clinical Plus | CPOE plus CDS, nursing, eMAR/BCMA, ED, OT, HIM | +₹800–1,200 |
| Enterprise | ERP sub-ledger connectors, costing, Group Connect, analytics lakehouse | +₹400–700 |
| **Bundle** | All of the above | **₹2,400–3,700 (≈US$28–43)** |
| Minimum | Per hospital | ₹1.5 lakh a month |
| AI add-ons | Ambient (per clinician per month); chart and discharge drafts included in Clinical Plus | ₹2,500–5,000 |
| Implementation | Fixed fee for a 100–500-bed hospital | ₹15–60 lakh; **10–20% held back against outcomes at 12 months** (10 §10.2.10) |

**GCC (US$)**

| Tier | Price |
|---|---|
| Enterprise bundle including NPHIES/SBS (KSA) or HIE/e-claims (UAE) | **US$110–170 per bed per month** (≈US$1.3–2.0K per bed per year) |
| Ambulatory-only facilities | US$250–400 per provider per month |
| Ambient AI | US$150–300 per clinician per month |
| Implementation (fixed fee) | US$1.5–3K per bed, with milestone billing and a 10–20% outcome holdback |
| Group Connect (spokes on a group tenant) | 60–70% of list; host receives a 10–20% revenue share |

### 12.3 Contract terms we should standardize [E]

| Term | Standard position | Notes |
|---|---|---|
| Term and uplift | 5–7 years; annual uplift CPI-linked, capped at 3–5% | Indian buyers report 20–40% renewal hikes from incumbents [47]. Capped uplift is a selling point. |
| Payment | Subscription annually or quarterly in advance. Implementation milestones 30/30/30/10, with the outcome holdback released at month 12. | |
| SLAs | 99.9% monthly for the platform; **99.95% target for T0 clinical functions in-region** (07 §6.2); RPO ≤5 min cross-region; cyber-recovery objective 72 h (07 §9.1.6) | |
| Service credits | 5% / 10% / 25% of monthly fee at 99.9 / 99.5 / 99.0% breach bands; termination right after 3 breaches in 6 months | |
| Liability cap | 12 months of fees (general); **super-cap of 2–3× for data-protection breach**; uncapped for fraud and wilful misconduct; IP indemnity | Matches GCC/India enterprise norms [K] |
| Source-code escrow | Tri-party; release on insolvency, cessation of support, or uncured material breach of support obligations; deposit verified annually | Directly counters SAP/Oracle-style "orphan" fear (01 §10.2) |
| Data portability | **Free** FHIR Bulk export plus full database extract on request and at exit; 90–180 days of transition assistance at rate card; certificate of deletion | EHDS-style posture; Epic antitrust contrast (01 §2.2) |
| Clinical safety | Shared hazard log; vendor safety case per release; customer clinical-safety officer named | 07 §9.2 |
| Subprocessors | In-country list with change notice; support access logged and customer-visible | 07 §9.1.4 |

---

## 13. Funding strategy

### 13.1 Market benchmarks (US data; India and GCC venture markets are much smaller [K])

| Period | Funding | Deals | Size | Concentration | Exits | Source |
|---|---|---|---|---|---|---|
| 2025 | **US$14.2B** (+35%) | 482 | Average US$29.3M; median US$12M | 54% to AI-enabled companies; 26 mega-deals = 42% of funding. Series A averaged US$24.1M with a16z/General Catalyst on the cap table, US$18.9M without. | 5 IPOs, 195 M&A deals | [32] |
| H1 2026 | **US$7.4B** | 244 | Median US$14M | 20 mega-deals = 45% of capital | **No IPOs**; 115 M&A deals (RCM most active) | [33] |
| Q3 2026 | US$3.7B (YTD US$11.1B) | 114 | — | — | — | [34] |

Rock Health also observes that Epic is giving customers more ways to build their own AI and that "a strong SaaS product isn't the moat it once was". It notes that buyers want proven ROI, and that startups are responding with forward-deployed engineers [33]. That supports our **co-development model** and the case for **owning the record** rather than selling a bolt-on.

### 13.2 Round plan (Base case) [E]

| Round | Timing / gate | Size | Use | Proof points investors will want |
|---|---|---|---|---|
| Seed | G0 (M0) | US$8–10M | Phase 0 and early MVP; ~100 FTE by M12 | Team (CTO, CMIO, chief architect); anchor LOI; architecture spikes (Medplum/HAPI load test; 02 §10.1) |
| Series A | G2 (M12–M15) | US$20–25M | MVP completion; go-live #1; KSA entity; first KSA partner | Wedge live with PHI; SOC 2 Type I; design partner #2 LOI; pipeline |
| Series B | G4 (M26–M30) | US$40–50M | Scale to 10–30 hospitals; P2 modules; partner academy; UAE | 3 live hospitals incl. KSA; ARR ≥US$1.5M; stabilization metrics; NPS/NEES at sites |
| Series C / growth or strategic | G5–G6 (M42–M60) | US$40–80M | Path to breakeven; optional EU/UK | 25–55 hospitals; ARR US$7–13M; Stage 6 references; services ≤40% |

**Total equity:** seed through Series B is about **US$68–85M**, which matches the Base-case need of US$80–90M once venture debt or a modest extension is added. Series C (US$40–80M) is growth capital toward breakeven in years 6–7, and it can be smaller, or skipped in favor of a strategic deal, if the revenue ramp beats plan. Venture debt (Henry's ¥1.2B regional-bank facility is an example [29][S]) can bridge between G3 and G4 once ARR exists.

### 13.3 Strategic investors (the Avelios pattern)

- **The precedent:** Avelios added an adjacent-market software incumbent (SAP, February 2026) and a hospital operator (Fresenius, May 2026) **after** its Sequoia-led Series A [14][16].
- **GCC candidates [K]:** PIF-linked technology companies (Elm; Lean Business Services in health); HHC or its PPP vehicles; PureHealth (Abu Dhabi); M42 (Mubadala/G42); Gulf private hospital groups.
- **India candidates [K]:** hospital chains, following KareXpert's Jio precedent [21][S]; conglomerates with health platforms; strategic insurers.
- **Rules:**
  - minority stakes (≤10–15%);
  - **no exclusivity** and no information rights over competitor hospitals' data or pipelines;
  - commercial agreements at arm's length, so rival hospital groups can still buy;
  - strategic money at Series A or B, not at seed, when price discovery is poorest.

---

## 14. Business risk register

| # | Risk | Likelihood / impact | Leading indicator | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | **Vendor-viability perception:** "Will you exist in 10 years?" (SAP IS-H exit, Oracle sale rumors; 01 §12.4) | High / High | Lost deals citing size; procurement asks for parent guarantees | Escrow; free portability; strategic minority investor; published references; transparent funding; ISO/SOC 2 early | CEO |
| 2 | **Reference-site failure** at go-live #1 | Medium / Critical | Readiness-gate slippage; training below threshold; Sev-1 count | Readiness gates not dates; independent operational assessment; wedge first; rollback triggers; vendor-funded at-the-elbow support | COO / CMIO |
| 3 | **Key-person risk:** CMIO, chief architect, Medications squad lead | Medium / High | Attrition signals; bus factor of 1 on the meds boundary | Deputies for every critical role; documented ADRs; equity vesting; two pharmacists on the meds squad | CEO / CTO |
| 4 | **Regulatory change or delay:** NPHIES/SBS versions, ABDM spec changes (V3 to v7 bundles), DPDP 13 May 2027, ZATCA phases | High / Medium | Spec bulletins; partner audit failures | Country packs as owned products (08 §14.14); effective-dated rules (05 §0.15); regulatory watch (07 §9.3) | CPO |
| 5 | **Certification gating:** NABH needs 3 Indian sites [23]; NPHIES needs working integrations before award | High / Medium | Design-partner group size; NPHIES test status | 3+-hospital design partner; NPHIES sandbox from M14 | CPO |
| 6 | **Funding gap between G3 and G4** (peak burn, thin references) | Medium / Critical | Runway under 15 months at G3 | Raise Series A at G2 sized to reach G4 + 6 months; venture debt; operate to Lean until G3 | CFO |
| 7 | **Scope creep and customization** at design partners | High / High | Deviation log above 20%; per-customer code branches | One code base; governed deviations (10 §10.1.2); co-development terms limit custom work | CPO |
| 8 | **Clinical safety incident** (wrong patient, medication error, orphaned results) | Low–medium / Critical | Safety dashboard; orphaned work items above 0 (10 §10.3) | Hazard log; safety invariants (11 §15); CSO sign-off per release; device-grade logic segregated (07 §9.1.7) | CMIO / CSO |
| 9 | **Cyber incident** (vendors are the fastest-growing ransomware target; 07 §0.11) | Medium / Critical | Phishing tests; privileged-access anomalies | Trust Plane; phishing-resistant MFA; immutable backups; 72 h recovery drill; cyber insurance | CISO |
| 10 | **Hiring and Saudization** (Arabic informatics, NPHIES specialists; 30% engineering rule [40]) | High / Medium | Time-to-fill above 90 days in KSA | Early KSA entity; graduate programmes; partner staffing; Indian Arabic-speaking hires [K] | COO |
| 11 | **Indian price compression** (commodity HMS at ₹800–1,000 per bed per month [47]) | High / Medium | Discount depth above 30% | Sell clinical depth and outcomes; minimum fees; pooled tier for small hospitals; GCC carries margin | CRO |
| 12 | **Incumbent response** (Oracle/IQVIA/InterSystems in KSA; local vendors bolting on AI) | Medium / Medium | Losses to bundled EHR+ERP deals | EHR+ERP single record (01 §12.5); in-Kingdom team; faster go-lives | CEO |
| 13 | **Drug-KB and content licensing** (cost, regional coverage, liability) | Medium / Medium | No regional KB for Gulf brands | Abstraction layer (04 §8.2); dual-source evaluation by M6 | CMIO |
| 14 | **Dependency risk** (Medplum single-company steward, licence changes; 02 §10.1.9) | Medium / Medium | Upstream licence or roadmap change | Port/adapter boundary; contribute upstream; fork readiness | CTO |
| 15 | **FX and collections** (INR depreciation; public-sector payment delays) | Medium / Medium | DSO above 90 days | USD/SAR pricing for GCC; advance billing; private-sector focus | CFO |

---

## 15. Implications for our build (opinionated)

1. **Adopt the three-clock plan and stop quoting 6–12-month go-lives.**
   - Commit internally to: first production PHI at **M12–M14** (wedge); first inpatient go-live at **M20–M24**; 3 live hospitals at **M26–M30**; 10 live at **M36–M42**; 2–3 Stage 6/7 references at **M54–M66**.
   - Doc 01's 6–12-month implementation claim is a target for customer #10 onward. Doc 10's 9–18-month ranges are our contractual baseline until then.
2. **Fund the Base case (US$80–90M over five years) but run Lean until G3.** Raise seed at US$8–10M now. Size the Series A at G2 (US$20–25M) so it reaches **G4 plus six months**, which removes the most dangerous funding gap. If the seed cannot be raised at that size, run the **Lean case**: India-first, partner-led delivery, about US$45–50M.
3. **India builds and proves; the GCC pays.** Put 65–70% of R&D in India and sign an Indian 3+-hospital design partner first. Make the **KSA private sector** the second market by M15 and plan for GCC customers to supply **≥60% of ARR by year 5**. If GCC ARR is below 50% at G5, cut costs or re-price.
4. **Re-scope the MVP for how India and GCC private hospitals buy.**
   - **In the MVP:** native pharmacy, LIS core, RIS-lite, OT scheduling with surgical packages, patient accounting, stores, and the India and KSA packs.
   - **Phase 2:** microbiology, anatomic pathology, non-US blood bank, ICU/periop/maternity and the UAE pack.
   - **Integrate:** PACS, BECS, the drug knowledge base, ADCs and pumps.
   - Re-baseline the 1,055–1,645 PM table when report 14 lands.
5. **Insist on a group as design partner #1.** It satisfies NABH's three-deployment rule [23], multiplies hospitals per contract, and provides the Group Connect proof that Epic used internationally (01 §1.7).
6. **Hold the ratios.** Keep one clinical informaticist per two squads, a pharmacist inside the Medications squad, one QA per five engineers, SRE at 1:8–10, and security at about 4%. Cutting clinical informatics to save money is the false economy that produces Mesalvo-style "couldn't deliver functionality" outcomes (01 §10.2).
7. **Build implementation capacity in two steps.**
   - Customers #1–#3 are delivered in-house by our best people.
   - From customer #4, certified partners lead (an Indian SI for scale, a Gulf integrator for local content), with our people in QA and safety roles.
   - Target services at ≤40% of revenue by year 5.
8. **Publish a transparent price sheet and turn contract terms into a weapon.** Offer capped uplifts, free FHIR and database export, tri-party escrow, outcome-linked implementation holdbacks and in-country support. These answer the first objection every buyer will raise: vendor viability.
9. **Run the KSA public-sector route only on purpose.** Private groups need no RHQ. Decide on an RHQ by M18 only if HHC clusters or PPP operators become explicit targets. The RHQ rule's "25% cheaper" exception [43] makes bidding without an RHQ a losing strategy.
10. **Spend on certifications in the order buyers demand them:**
    - SOC 2 Type I (M9), ISO 27001 (M12–M15) and a penetration test before go-live #1;
    - ABDM M1–M3 and WASA (M10–M16);
    - NPHIES/SBS production (M22–M28);
    - NABH HIS/EMR Advanced (M28–M32);
    - KSA NCA alignment by the first KSA go-live.
    - Defer HITRUST, ONC, ISO 13485, MDR and DCB0129 to a market decision in year 4 or later (07 §9.2).
11. **Price AI as an add-on with margin and keep the economics per encounter.** Route through our gateway (09 §9.1.4) and pass partner costs through at ≥30% margin. India needs a sub-US$60-per-clinician-per-month ambient offer to scale.
12. **Take strategic money only after product proof.** Add one GCC and one Indian strategic minority investor at Series A or B, with no exclusivity and no data rights, following Avelios (SAP, then Fresenius, after Sequoia) [14][16].
13. **Buy insurance before go-live #1, not after.** Hold US$5–10M of combined cyber and technology E&O cover by M18. RFPs will ask for it (07 §3.2), and it signals maturity.
14. **Instrument the business like the product.** Every gate has numeric exit criteria (§8.2). Readiness, stabilization, NEES/SUS and revenue-cycle KPIs (10 §10.3) are investor metrics as well as customer metrics.
15. **Kill or pivot criteria:**
    - If G2 slips beyond M18, narrow the MVP to an India "HIS core + LIS + RCM" product and delay inpatient medications. That is the KareXpert/Henry route.
    - If G3 slips beyond M28, stop GCC expansion and fix the reference site first.

---

## 16. Uncertainty register (verify before relying)

| Item | Status | How to verify |
|---|---|---|
| Report 14 reconciled MVP | **Missing at time of writing**; §4 is provisional | Re-baseline the PM table when 14 lands |
| Avelios headcount (~200) and customers (~15) | From pack (01 §3.4, kma-online); TechCrunch gives 12 customers at Feb 2025 [14] | Avelios press kit / LinkedIn |
| Henry hospital count after July 2025 (~70 reported by one aggregator) | Company last disclosed "50+" (Jul 2025) [27] | Henry press releases |
| KareXpert funding and hospital count | Aggregators only [21][S] | MCA filings; company disclosures |
| Medplum funding and headcount | Aggregators disagree [18][S] | Company |
| Elation total of US$108.5M; Canvas totals | Search extracts [8][9][S] | Company press releases |
| Saudi local-content percentages (10%, 60/40) and new procurement law implementing regulations | Secondary [45][S]; MoF PDF blocked [44] | LCGPA/MoF primary texts; local counsel |
| RHQ obligations (minimum staff, incentives) | [K] | MISA RHQ programme documents |
| Software-developer Saudization rate | [K]; engineering (SCE-accredited) 30% confirmed [40][41] | HRSD / Qiwa occupation codes |
| Drug-KB pricing (FDB, Medi-Span, Lexidrug, MIMS) | Not public [K] | Vendor quotes by M6 |
| Cloud hosting cost per bed | [E] | 6–8-week load/cost spike (02 §10.1.1; 08 §14.13) |
| Indian PPP-MII thresholds; UAE ICV scoring | [K] | DPIIT order text; ICV programme |
| Oracle new-EHR team size | Not disclosed | — |
| Epic early product and first-hospital dates | [K] | Epic history materials; trade-press archives |
| India/GCC sales-cycle lengths | [E] | Win/loss data from the first 20 opportunities |
| Loaded cost factors by country | [E]; base salaries from Levels.fyi [35]–[39] | Local payroll providers (EOR quotes) |

---

## Sources

1. Wikipedia, "Epic Systems." https://en.wikipedia.org/wiki/Epic_Systems
2. Epic, "About Epic." https://www.epic.com/about/
3. Wikipedia, "Judith Faulkner." https://en.wikipedia.org/wiki/Judith_Faulkner
4. Wikipedia, "Cerner." https://en.wikipedia.org/wiki/Cerner
5. Wikipedia, "Meditech." https://en.wikipedia.org/wiki/Meditech
6. Wikipedia, "Athenahealth." https://en.wikipedia.org/wiki/Athenahealth
7. Fierce Healthcare, "Elation Health nabs $40M series C to ramp up support for independent primary care practices" (Dec 2020). https://www.fiercehealthcare.com/practices/elation-health-nabs-40m-series-c-to-ramp-up-support-for-independent-primary-care ; PR Newswire release: https://www.prnewswire.com/news-releases/elation-health-announces-40m-series-c-to-power-independent-primary-care-301189974.html
8. Tracxn, "Elation Health: Funding Rounds & List of Investors" (aggregator; Series D, US$108.5M total via search extract) [S]. https://tracxn.com/d/companies/elation-health/__nQOmogf2D4iobq2x8v3dRS5r6YBfgj8XIZ5C1Nxddo0/funding-and-investors
9. Tracxn, "Canvas Medical" (aggregator) [S]. https://tracxn.com/d/companies/canvas-medical/__VYaEfQpPFHhgGrHsY4995MtXx612eQ0OrxnqXs52M68 ; StartupIntros, "Canvas Medical": https://startupintros.com/orgs/canvas-medical
10. HIT Consultant, "Akido Labs Secures $60M to Expand AI-Powered ScopeAI" (16 May 2025). https://hitconsultant.net/2025/05/16/akido-labs-secures-60m-to-expand-ai-powered-scopeai/ ; press release via Yahoo Finance: https://finance.yahoo.com/news/akido-raises-60-million-series-164200320.html
11. Commure, "Commure Secures $200M to Accelerate AI-Powered Healthcare Transformation" (Jun 2025). https://www.commure.com/blog/commure-secures-200m-to-accelerate-ai-powered-healthcare-transformation
12. MobiHealthNews, "Commure raises $70M, boosting post-money valuation to $7B" (May 2026). https://www.mobihealthnews.com/news/commure-raises-70m-boosting-post-money-valuation-7b
13. Sacra, "Commure revenue, valuation & funding" (estimates). https://sacra.com/c/commure/
14. TechCrunch, "Avelios nabs $31M led by Sequoia to fix the ailing world of healthcare IT" (6 Feb 2025). https://techcrunch.com/2025/02/06/avelios-nabs-31m-led-by-sequoia-to-fix-the-ailing-world-of-healthcare-it/
15. Munich Startup, "Series A: Avelios Medical secures €30 million" (Feb 2025) [S]. https://munich-startup.de/en/107846/avelios-medical-series-a-finanzierung ; HTGF: https://www.htgf.de/en/avelios-medical-series-a/
16. Munich Startup, "Fresenius invests in Munich-based healthtech startup Avelios Medical" (12 May 2026). https://www.munich-startup.de/en/120509/fresenius-invests-in-avelios/
17. Medplum blog, "MediMind case study" (Aug 2026; self-reported figures). https://www.medplum.com/blog/medimind-case-study
18. PitchBook, "Medplum company profile" [S]. https://pitchbook.com/profiles/company/501328-54 ; Tracxn, "Medplum" [S]: https://tracxn.com/d/companies/medplum/__ZgTrlyRWbhLFCtZOy2yVGFB_E3s1uppKI_o8YinjRgA
19. Open Healthcare Network (OHC), home page. https://ohc.network/
20. Athma (Narayana Health), home page. https://athma.health/
21. Tracxn, "KareXpert" [S]. https://tracxn.com/d/companies/karexpert/__DMjabtxLCceHfP3x1BmYISydbXPDFnfk8OoFnfPB0KE ; Inc42 cap table [S]: https://inc42.com/company/karexpert-technologies-pvt-ltd-/captable/ ; PitchBook [S]: https://pitchbook.com/profiles/company/229014-46
22. NABH, "KareXpert Technologies" certified-software listing (WASA, HIS and EMR Advanced certificates). https://nabh.co/software/karexpert-technologies/
23. NABH, "Digital Health Standards HIS/EMR Systems" programme page (fees, eligibility: ≥3 Indian deployments + ABDM M3). https://nabh.co/programmes/digital-health-standards-his-emr-systems/
24. NABH, "NABH Certified Healthcare Software" (list of certified HIS/EMR vendors). https://nabh.co/nabh-certified-healthcare-software/
25. SKHIC (Saudi Korean Health Informatics Company), "About us." https://skhic.com.sa/en/about-us/
26. Wikipedia, "Seoul National University Bundang Hospital" (BESTCare, EMRAM Stage 7 2010, revalidations). https://en.wikipedia.org/wiki/Seoul_National_University_Bundang_Hospital
27. TechGym, "ヘンリーの評判は？病院向けクラウド電子カルテの開発、採用・働き方を公開情報で整理【2026年】" (founding, deployments since Feb 2023, 50+ facilities Jul 2025, 139 staff, funding history, fee model). https://techgym.jp/column/startup/henry-hyoban/
28. Sogyotecho (創業手帳), "病院向け基幹システム「Henry」…30億円調達" (15 May 2026). https://sogyotecho.jp/news/20260515henry/
29. Nikkei, "クラウド電子カルテのヘンリー、12億円調達 地方病院への営業強化" (Oct 2026; search extract) [S]. https://www.nikkei.com/article/DGXZQOUC05AR80V01C26A0000000/
30. Healthcare Dive, "Oracle launches AI-backed EHR" (14 Aug 2025). https://www.healthcaredive.com/news/oracle-new-ehr-artificial-intelligence-ai/757588/
31. Healthcare Dive, "Oracle launches AI-driven patient portal" (12 Aug 2026). https://www.healthcaredive.com/news/Oracle-launches-AI-driven-patient-portal/827656/
32. Rock Health, "2025 year-end digital health funding overview: A tale of two markets." https://rockhealth.com/insights/2025-year-end-digital-health-funding-overview-a-tale-of-two-markets/
33. Rock Health, "H1 2026 funding and market overview: Durable roots, shifting routes." https://rockhealth.com/insights/h1-2026-funding-and-market-overview-durable-roots-shifting-routes/
34. Rock Health, "Q3 2026 funding: $3.7B raised across 114 deals." https://rockhealth.com/rock-weekly/q3-2026-funding-3-7b-raised-across-114-deals/
35. Levels.fyi, "Software Engineer Salary in India." https://www.levels.fyi/t/software-engineer/locations/india
36. Levels.fyi, "Software Engineer Salary in Saudi Arabia." https://www.levels.fyi/t/software-engineer/locations/saudi-arabia
37. Levels.fyi, "Software Engineer Salary in United Arab Emirates." https://www.levels.fyi/t/software-engineer/locations/united-arab-emirates
38. Levels.fyi, "Software Engineer Salary in Germany." https://www.levels.fyi/t/software-engineer/locations/germany
39. Levels.fyi, "Software Engineer Salary in Poland." https://www.levels.fyi/t/software-engineer/locations/poland
40. Saudi Press Agency, "Human Resources Ministry Announces New Saudization Measures for Engineering and Procurement Professions" (Jan 2026). https://www.spa.gov.sa/en/w2481165
41. Qoyod, "Engineering Professions Saudization: The 30%" (Decision 93483; SAR 8,000; application 30 Jun 2026) [S]. https://www.qoyod.com/en/learn/engineering-professions-saudization/
42. HRSD, "Procedural Manual for the Saudization Resolution of Technical Engineering Professions" (Resolution 103105; search extract) [S]. https://www.hrsd.gov.sa/sites/default/files/2025-03/Procedural%20Manual%20for%20the%20Saudization%20Resolution%20of%20Technical%20Engineering%20Professions.pdf
43. Asharq Al-Awsat, "Saudi Arabia Allows Contracting Exceptions for Firms without Regional HQ" (19 Feb 2026). https://english.aawsat.com/business/5242696-saudi-arabia-allows-contracting-exceptions-firms-without-regional-hq
44. Saudi Ministry of Finance, "Regulations on Preference for Local Content and Local SMEs and Companies Listed on the Capital Market in Business and Procurement Transactions" (PDF; access denied during this session). https://www.mof.gov.sa/en/docslibrary/RegulationsInstructions/Documents/Regulations%20on%20Preference%20for%20Local%20Content%20and%20Local%20SMEs%20and%20Companies%20Listed%20on%20the%20Capital%20Market%20in%20Business%20and%20Procurement%20Transactions2.pdf
45. Mutabiq, "Saudi local content preference in government tenders: the 10%, 40% and mandatory-list rules" (tender-guide site, updated Oct 2026) [S]. https://mutabiq-sa.vercel.app/en/guides/local-content-preference-government-tenders/
46. U.S. International Trade Administration, "Saudi Arabia — Healthcare" (Country Commercial Guide). https://www.trade.gov/country-commercial-guides/saudi-arabia-healthcare
47. OneCity, "Hospital Management Software Cost in India (2026): Complete Pricing Guide by Hospital Size" (vendor blog). https://onecity.co.in/blog/hospital-management-software-cost-india/
48. Topflight Apps, "Epic EHR Pricing 2026" (third-party estimates; Salinas Valley board packet). https://topflightapps.com/ideas/epic-ehr-cost/
49. Mindbowser, "Epic Community Connect: The Complete Guide" (no per-user prices on the page as fetched; contradicts the figure attributed to it in 01 §9.1). https://www.mindbowser.com/epic-community-connect-guide/
50. Freed, "Pricing" (ambient scribe list prices). https://www.getfreed.ai/pricing
51. AWS, "Regions and Availability Zones" (Saudi Arabia listed as announced). https://aws.amazon.com/about-aws/global-infrastructure/regions_az/

**Pack cross-references used:** `01-global-vendor-landscape.md`, `02-open-source-and-platforms.md`, `03-clinical-modules-and-workflows.md`, `04-diagnostics-pharmacy-devices.md`, `05-revenue-cycle-erp-operations.md`, `06-interoperability-standards.md`, `07-security-privacy-regulation.md`, `08-architecture-and-technology.md`, `09-ai-analytics-digital-front-door.md`, `10-implementation-ux-lessons.md`, `11-canonical-domain-model.md`.

**Note for the 01 maintainers.** Doc 01 §9.1 attributes "about US$100–500 per user per month" for Epic Community Connect to Mindbowser [01: 44]. The page as fetched on 16 October 2026 contains no per-user figures [49]. The closest public anchors are Topflight's "hosted from about US$200 per user per month" estimate and the Salinas Valley board packet [48].
