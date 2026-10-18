# ADR-008: Keys: per-tenant envelope keys with crypto-shredding, sealed on site and escrowed at the DR site
Status: accepted
Date: 2026-10-18   Source: K §7.2, §7.8, §10; BP §7.2; R07 §9.1 #1; R08 §3.5, §5; BUILD-PROMPT §4.1 (Secrets and keys), §4.3, §6.4, §13.1 (DP-2, DP-3, IA-7), §13.2, §16.1, §21 (WP-0.4, WP-1.13), A.2 (TRU-KEY-01), §4.2

## Context

**The question.** Who holds the keys that protect each tenant's data, and how data is made unrecoverable when the law requires it.

**BP** (BP §7.2): per-tenant envelope keys with crypto-shredding; in KSA and the UAE, keys under customer control in an external KMS/HSM (HYOK), with a data-key caching and lease policy with its own hazard analysis, customer KMS obligations, an SLA carve-out for customer-KMS outages and joint key-recovery drills.

**What K changed** (K §7.2, "Changed"). On site, keys are held in a small HSM or a TPM-sealed KMS, escrowed at the DR site under dual control; off-site copies are encrypted under hospital-held keys. BP's customer-KMS (HYOK) integration is not needed. The backlog note on `TRU-KEY-01` reads "HSM/TPM KMS, no HYOK (ADR-008)". K §10 adds encrypted disks with keys sealed to the TPM and escrowed at the DR site.

**The research.** Keys are part of the Trust Plane every module must use (R07 §9.1 #1). Crypto-shredding is the usual way to meet erasure duties when records are append-only (R08 §3.5). Per-tenant databases make per-tenant keys natural (R08 §5).

**[P] marks.** The key custody model is K's. BUILD-PROMPT §4.1 marks as [P] the secrets and KMS product (OpenBao) and the development stand-ins (swtpm, SoftHSM2).

## Decision

**Keys:** per-tenant envelope keys with crypto-shredding; on site, keys sealed to the TPM or held in a small HSM, escrowed at the DR site under dual control; off-site copies encrypted under hospital-held keys.

**Detail** (BUILD-PROMPT §4.1, §6.4, §13.1, §16.1):
- **Secrets and the KMS [P]:** OpenBao. Never HashiCorp Vault (BSL, denylisted). Development stand-ins: swtpm for the TPM and SoftHSM2 over PKCS#11 for the HSM.
- **Envelope encryption** with per-tenant keys for documents, images and designated fields, so crypto-shredding works; encrypted volumes with keys sealed to the TPM (BUILD-PROMPT §6.4).
- **DP-2:** AES-256 at rest for every store, including indexes, caches, queues, logs, backups and analytics copies. **DP-3:** per-tenant envelope keys, rotation, crypto-shredding.
- **Physical security** (BUILD-PROMPT §16.1, §13.2): encrypted disks with TPM-sealed keys escrowed at the DR site; no local admin accounts; tamper alerts; remote wipe for a stolen node.
- **Key operations** require step-up authentication (IA-7).
- **Signing keys** in development and CI are a local `cosign` key pair (git-ignored); production keys and any transparency log need an ADR and a [HUMAN] decision (BUILD-PROMPT §4.3; ADR-022).

## Consequences (including safety and licence impact)

**Safety and privacy.**
- Crypto-shredding reconciles the never-updated journal (ADR-004) with erasure duties. It is never automatic: records are never auto-deleted, the retention floor is 25 years and legal holds override schedules (BUILD-PROMPT §2.3). Shredding is a governed action, not a background job.
- Lost keys mean lost data (H6). Escrow at the DR site under dual control and a key-rotation runbook (BUILD-PROMPT §20) are the mitigation.
- Off-site copies are ciphertext under hospital-held keys, which is what SI-20 requires of anything off-site (H13).
- Without HYOK there is no customer-KMS outage path to design for, so the data-key lease hazard BP needed does not arise in Kurdistan.

**Licence.** OpenBao is MPL-2.0 and SoftHSM2 is BSD (BUILD-PROMPT §4.1). HashiCorp Vault is excluded (BSL).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Key-rotation and shredding tests.

**Where and when.**
- WP-0.4 (`TRU-KEY-01` base): per-tenant envelope keys and crypto-shredding, tested against the swtpm and SoftHSM2 stand-ins, as merge-tier integration tests (BUILD-PROMPT §19.1).
- WP-1.13 (`TRU-KEY-01` full): TPM sealing on the cell and escrow at the DR site.
- Real TPMs and HSMs on the reference cell are [HUMAN: hardware].

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

A Kurdistan rule changes key custody.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
