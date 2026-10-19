# Evidence

Stored evidence for every claim of "done" or "passing" (BUILD-PROMPT §3.1, §3.5, §19.1). Nothing counts as passing unless it ran and its record is here.

## Layout

| Directory | Holds | Written by |
|---|---|---|
| `ci/` | One JSON record per `tools/ci/run` run: commands, counts, durations, host, cell and result (§19.1) | `tools/ci/run` (WP-0.1) |
| `doctor/` | `tools/doctor` output: prerequisites and resource limits found and missing | `tools/doctor` (WP-0.1) |
| `backlog/` | Backlog generation and the ten-row spot check against Appendix A | the backlog tool (WP-0.1) |
| `licence/` | Licence-check outputs and the dependency lists they were computed from (§4.3) | `tools/hms licence check` (WP-0.1) |
| `cell/` | Cell and dev-stack records: image mirroring and signing, `cell up`, the smoke test, signature enforcement, egress, the object-store WORM test and its post-restart re-check, the compose smoke test (§4.1, §4.3, §21 WP-0.2) | `sh tools/hms cell …` (WP-0.2) |
| `perf/` | Performance and footprint reports: spike criteria C1–C9, the scaled and 300-bed days, route and bundle budgets (§18.6) | WP-0.6 onward |
| `chaos/` | Chaos and drill reports: node kill, failover, WAN cut, power-cut emulation, clock skew, with measured times (§18.7) | WP-0.2, WP-0.3 onward |
| `restore/` | Backup and restore test reports with measured RPO and RTO (§16.2) | WP-1.13 onward |
| `screenshots/` | Screenshots and visual diffs in `en`, `ckb` and `ar`, including RTL (§3.2, §18.9) | WP-0.7 onward |

## Naming

Each record is named with its date, its tier or test, and the commit it ran on:

`<yyyy-mm-dd>-<tier-or-test>-<shortsha>[-dirty].<ext>`

- `<tier-or-test>` is a CI tier (`fast`, `merge`, `nightly`, `release`) or a test or report name (for example `doctor`, `c2-property`, `node-kill`).
- A qualifier, such as the component and version a test ran against, belongs inside `<tier-or-test>`, after the test name: `cell/2026-10-19-worm-seaweedfs-4.48-1a2b3c4.json` (OQ-129).
- `-dirty` marks a run on a working tree with uncommitted changes; such a run is never the gate for a commit (§19.1 "No shortcuts").
- The two record writers count untracked files differently. The CI runner (`ci/`) counts every untracked file, so the untracked record of an earlier run makes the next `ci/` record `-dirty` (WP-0.1 review observation O-5). The cell's record writer (`tools/hmstools/cell/evidence.py`, which writes `cell/` records today) ignores untracked files under `docs/program/evidence/`, says how many it ignored in `git.untracked_evidence_outputs_ignored`, and still counts untracked files elsewhere and every change to a tracked file, evidence included. Both rules come from one helper, `git_info` in `tools/hmstools/ci/runner.py`; whether `ci/` records take the cell's rule is open (KA-024).
- Example: `ci/2026-10-18-fast-1a2b3c4-dirty.json`.
- A file a record was computed from keeps the record's name with `-<list>-input` added before the extension, where `<list>` names the input rather than a licence scope: for the licence check, `shipped` (the shipped dependencies, checked in the shipped scope) and `all` (every dependency, checked as build-only). For example `licence/2026-10-19-licence-05f159a-shipped-input.json` and `licence/2026-10-19-licence-05f159a-all-input.json` beside `licence/2026-10-19-licence-05f159a.txt`.

## Name the cell behind every number

Every performance, footprint and restore result states where it ran (§3.5, §5.1):

| Where it ran | Label | Counts as evidence for C7, C9, the SLOs and release gates |
|---|---|---|
| The Windows checkout, no cell (KA-001): the editing inner loop, not evidence of record | "Windows host" | no |
| The Linux build host (the WSL clone, or a scratch clone for the gates-bite matrix), no cell: CI-tier, doctor, gates-bite, spot-check and licence evidence of record | "WSL build host, no cell" | no |
| The `docker compose` dev stack, not a cell (WP-0.2) | "indicative (compose stack, not a cell)" | no |
| The dev cell (three-node `k3d`) | "indicative" | no |
| The lite cell (§5.1: one Kafka broker, two PostgreSQL instances, no Argo CD; on this host three PostgreSQL instances, the DN-005 default) | "lite" (also indicative, §3.5; OQ-085) | no |
| The reference cell (three servers, 32 cores, 128 GB, NVMe each) [HUMAN: hardware] | "reference cell" | yes |

A record that does not name its cell is incomplete. Shortened runs are never reported as the gate; records carry the actual sequence counts and durations (§19.1, §18.3).
