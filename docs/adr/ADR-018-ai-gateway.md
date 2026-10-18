# ADR-018: AI gateway and control plane (P2)
Status: accepted
Date: 2026-10-18   Source: K §7.2, §11.2, §11.3, K-23, Appendix A.2 (KDV-6); BP §7.2, §11; R09 §5.4, §9.1; R08 §1 #15, §11; BUILD-PROMPT §2.1 (SI-07, SI-19, SI-20, SI-21), §2.2 rule 10, §2.3, §4.3, §5.2 (ai-gateway), §13.1 (AI-2 to AI-5), §17.2, §17.3, §21 (Phase 5), §4.2

## Context

**The question.** How AI features, when they come, reach models without putting patients, the record or residency at risk.

**The research** (R09 §9.1; R08 §1 #15). All GenAI features call a grounding service that returns a permission-filtered, source-cited context bundle; none query the database directly. A model gateway routes to several models and vendors with region pinning, zero-retention contracts, cost and latency budgets, PHI redaction, version pinning and fallback, and is never hard-wired to one vendor. An AI control plane provides the registry, model cards, evaluation harness, monitoring, policy engine, provenance and kill switch. Every AI output is a draft with provenance that needs explicit human sign-off.

**BP** (BP §7.2): in-region inference, zero retention, `draft-ai` state; no database access for models.

**What K changed** (K §7.2; K-23, "Changed"; KDV-6). AI moves to P2, after company gate G3; nothing is in the MVP, because commercial speech recognition for Sorani and Badini is not proven [L]. Region pinning is limited to providers that counsel has approved; an on-site small-model option is evaluated. Cross-border inference needs a counsel opinion and hospital approval. Not marked [P].

## Decision

**AI gateway and control plane (P2):** counsel-approved region pinning, zero retention, PHI minimisation, version pinning, kill switch, `draft-ai` state; an on-site small-model option evaluated; no model touches the database.

**Detail** (BUILD-PROMPT §17.2, §17.3, §13.1; K §11.2, §11.3):
- **When:** P2, starting only after company gate G3 (hospital A's 90-day stabilisation and independent assessment, exit ≈M40; AI work from ≈M42; K-23). In this build that is Phase 5 (`AI-GW-01`, `AI-GOV-01` and the first products). Nothing AI-related is in the MVP.
- **Components:** the AI gateway; the grounding service; the control plane (registry, model cards, evaluation harness, monitoring, provenance); the human-in-the-loop UX kit; a model gateway that is multi-vendor and never hard-wired to one. The `ai-gateway` satellite (`backend/satellites/`) uses public APIs only, never the database (BUILD-PROMPT §5.2).
- **Control-plane requirements G1–G16** (R09 §5.4) are MUST at AI GA (BUILD-PROMPT §17.3): among them a registry with version pinning (G1), immutable provenance (G3), no AI output entering the record, reaching a patient or executing an order or claim without an accountable human (G4), per-feature, per-site kill switch and rollback (G9), PHI minimisation with counsel-approved region pinning and no vendor retention or training (G12), least-privilege agent tool scopes with approval for writes and prompt-injection defences (G13), and a classification record per feature in the Boundary Register (G14).
- **Rules:** output stays `draft-ai` until signed (SI-07); per-sentence citations; unsourced diagnoses or treatments are blocked; evaluation sets in English, Arabic and Sorani gate every model or prompt release; every AI feature degrades to "unavailable" with the manual path intact, including during internet shutdowns. Cross-border inference needs a counsel opinion, hospital approval and a Safety Board processor entry (SI-20). Patient-language instructions come only from approved templates, never free machine translation (BUILD-PROMPT §2.3).

## Consequences (including safety and licence impact)

**Safety.**
- AI never signs orders, files results or messages patients (SI-07; BUILD-PROMPT §2.3), which addresses H10.
- No PHI goes to an external model without a data processing agreement, a counsel opinion and the SI-20 processor entry approved by the Safety Board [HUMAN] (AI-4), which addresses H13. The grounding service enforces sensitivity labels and break-the-glass rules (SI-21; H14).
- Every AI feature has a kill switch (SI-19; G9).

**Scope.** Deferring AI to P2 keeps it away from the inpatient go-live, the cognitive-load peak (K-23).

**Licence.** We never build foundation or LLM models (BUILD-PROMPT §2.3); models come from partners under contracts. Licences with AI-ingestion clauses are denylisted for our own dependencies (BUILD-PROMPT §4.3).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** DB-credential scanner; `draft-ai` tests.

**Where and when.**
- **Database-credential scanner:** it is also constitution rule 10's CI check (BUILD-PROMPT §2.2). BUILD-PROMPT §21 does not assign it to a work package. It has to exist before any agent, plugin or the `ai-gateway` satellite does, so no later than Phase 5.
- **`draft-ai` tests:** with the clinical note lifecycle's `draft-ai` state (BUILD-PROMPT §8.4) and the AI products in Phase 5.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
