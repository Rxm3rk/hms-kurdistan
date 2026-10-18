# ADR-013: Trust Plane: Keycloak and OpenFGA with mandatory Policy and Audit SDKs
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §7.6, §10; BP §7.2, §7.7; R07 §5, §9.1 #1–#2; R08 §12.5; BUILD-PROMPT §0, §2.1 (SI-20, SI-21), §2.2 rule 7, §4.1 (Identity and authorisation), §5.2, §6.1, §6.3, §7 item 2, §13, §21 (WP-0.4), §4.2

## Context

**The question.** How identity, authorisation, consent and audit are enforced for every data access on every channel.

**The research** (R07 §9.1 #1–#2). Build a "Trust Plane" as shared platform services that every module must use: identity, policy (RBAC + ABAC + care relationship + sensitivity labels + consent), audit (BALP AuditEvent pipeline, tamper-evident store, SIEM streaming, patient access log), keys, residency, retention and de-identification. No module talks to a data store without the Policy and Audit SDKs. "Retrofitting segmentation and audit later is the most expensive mistake HMS vendors make." Sensitivity labels and purpose-of-use come from day one. R08 §12.5 recommends Keycloak (federation) plus OpenFGA (relationship-based access).

**Sources.** K keeps BP's ADR-013 text (K §7.2). BUILD-PROMPT §13 builds the controls baseline (R07 §5) in Phase 0 because of the retrofit warning. Not marked [P].

## Decision

**Trust Plane:** Keycloak + OpenFGA; mandatory Policy and Audit SDKs for all data access.

**Detail** (BUILD-PROMPT §4.1, §5.2, §7 item 2, §13):
- **Identity and authorisation:** Keycloak (OIDC, WebAuthn/passkeys, federation to the hospital IdP) and OpenFGA (relationship-based checks such as care relationships), both wrapped by the Trust Plane SDK.
- **Modules:** `trust-identity` (users, sessions, authenticators, badge and PIN, device registrations), `trust-policy` (roles, ABAC attributes, care relationships, consent, sensitivity labels, purpose-of-use, break-the-glass), `trust-audit` (BALP AuditEvents in a hash-chained WORM store; SIEM stream; access reports), `trust-keys` (ADR-008).
- **The SDK** is a shared kernel library under `backend/platform/` (`trust-sdk`, BUILD-PROMPT §6.1). Every module reaches its data store only through repositories wrapped by the Policy and Audit SDKs (BUILD-PROMPT §5.2).
- **One policy decision point** (AZ-1): RBAC + ABAC + care relationship + sensitivity labels + purpose-of-use + consent, enforced server-side on every API, search, report, print and export. Break-the-glass with reason capture, privacy-office notification and review within one working day (AZ-4).
- **Audit** (AU-1 to AU-3): BALP AuditEvents for every view, write, print and export, in a hash-chained WORM store that tenant admins cannot disable. Chain heads are anchored to the object-lock store and the DR site, never to a public service (BUILD-PROMPT §3.7).
- **Identity controls:** phishing-resistant MFA (passkeys, FIDO2, smartcards; never SMS codes) for remote, privileged and vendor access; badge tap-and-go ≤2 s; badge plus PIN for co-signature, controlled drugs and break-the-glass; no shared accounts (BUILD-PROMPT §7 item 2, §13.1).

## Consequences (including safety and licence impact)

**Safety and privacy.**
- Enforcing policy and audit below the API makes every channel equal (constitution rule 7) and is the mechanism for SI-20 (residency) and SI-21 (sensitivity labels and purpose-of-use), addressing H13 and H14. It is how 100% of PHI access is audited (bar #5).
- Badge tap-and-go and fast user switching reduce the shared-session wrong-patient risk (H1) without the one-chart-per-workstation rule (BUILD-PROMPT §2.1).

**Performance.** Every access passes the policy decision point, so policy checks count against the p95 budgets (BFF ≤300 ms; BUILD-PROMPT §0).

**Licence.** Keycloak and OpenFGA are Apache-2.0 (BUILD-PROMPT §4.1). They are foundation-hosted but sit on the critical path, so the upstream-licence-change trigger in the dependency scorecard applies to them (BP §7.7; ADR-022).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** ArchUnit: no repository access without the SDK.

**Where and when.** The rule belongs in the ArchUnit rule library `backend/platform/arch-rules` (created in WP-0.1). It can only bite once the SDK exists: WP-0.4 builds the Trust Plane, and its exit evidence is "ArchUnit proves no repository access without the SDK; every PHI read in the test suite produces an AuditEvent". It runs in the fast tier's architecture tests.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
