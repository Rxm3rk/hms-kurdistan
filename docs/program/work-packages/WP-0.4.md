# WP-0.4: Trust Plane v1
Phase / release: Phase 0 Foundation / no clinical go-live (features first run in R1)   Features: `TRU-IAM-01`, `TRU-IAM-02`, `TRU-IAM-03`, `TRU-PRV-01`, `TRU-AUD-01`, `TRU-KEY-01` (base)
Read first: BUILD-PROMPT §2.1 (SI-20, SI-21); §4.1 (identity and authorisation, secrets and keys); §4.2 (ADR-008, ADR-013); §5.2 (Trust Plane modules and dependency rules); §6.2 (PHI-safe logging); §6.3; §6.8 (items 4 and 5); §7 item 2; §12.6; §12.8 (badge tap rule); §13.1–§13.3; §13.6. Research: R11 in full (§8); R07 §5, §6, §8, §9; K §10
Depends on: WP-0.3   Simulators needed: the hospital's identity provider (federation, §3.7); a simulated badge reader (§21)
Entry criteria:
- WP-0.3 merged, or reviewed and stacked (§3.6, §21).
- The identity-provider and badge-reader simulators exist under `tools/simulators/<party>` with contract fixtures (§3.7).
- Not met yet: waits on WP-0.3, which waits on WP-0.2.
Deliverables:
- Keycloak federation with the (simulated) hospital identity provider; passkeys/WebAuthn; phishing-resistant MFA for remote, privileged and vendor access, never SMS codes (`TRU-IAM-01`; IA-1, IA-2).
- The badge-and-PIN flow against a simulated reader: reader → shell → Keycloak step-up bound to the workstation certificate → session swap in under 2 s; badge plus PIN for co-signature, controlled drugs and break-the-glass (§12.8; IA-3, IA-7).
- The policy decision point: RBAC + ABAC + OpenFGA care relationships + sensitivity labels + purpose-of-use, one PDP for every channel (`TRU-IAM-02`; AZ-1, AZ-2, AZ-7). Labels: HIV, mental health, reproductive and sexual health, gender-based violence, forensic/MLC, VIP (`TRU-PRV-01`; SI-21; AZ-3).
- Policy enforcement for API, print and export (SI-21).
- Break-the-glass with reason capture, privacy-office notice and a review queue (review within one working day) (`TRU-IAM-03`; AZ-4).
- BALP AuditEvents to a hash-chained WORM store that tenant admins cannot disable, with integrity reports; chain heads anchored to the object-lock store and the DR site, never to a public service (`TRU-AUD-01`; AU-1–AU-3; §3.7).
- Per-tenant envelope keys and crypto-shredding, with the development stand-ins swtpm (TPM) and SoftHSM2 over PKCS#11 (HSM) (`TRU-KEY-01` base; ADR-008; §4.1).
- PHI-safe logging: a logging API with a field allowlist; free text and identifiers never logged; canary synthetic identities and a scan that fails if a canary value appears in logs, traces or metrics (§6.2; §6.8 item 5).
- The Trust Plane Policy and Audit SDKs and the ArchUnit rule "no repository access without the SDK" (ADR-013; §6.8 item 4).
Exit criteria (evidence required):
- ArchUnit proves no repository access without the SDK.
- Every PHI read in the test suite produces an AuditEvent.
- Tampering with the audit chain is detected.
- Canary values never appear in logs, traces or metrics.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- H13 privacy egress (SI-20; PHI-safe logging and the canary scan).
- H14 unlawful disclosure of a restricted or sensitivity-labelled record (SI-21; labels and purpose-of-use at the PEP).
- H6 data loss or corruption, for the audit trail (tamper-evident hash chain).
[HUMAN] gates:
- None in §21. Federation with a real hospital identity provider happens per customer later, not in this work package.
