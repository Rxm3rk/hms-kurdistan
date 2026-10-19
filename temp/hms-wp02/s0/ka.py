"""S0: KNOWN-ANOMALIES.md rows KA-014 to KA-023 and the updates of KA-003, KA-006 and KA-008."""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)


rep(
    "No tier reports a pass it did not run (§19.1); the merge rule this implies is DN-011 |",
    "No tier reports a pass it did not run (§19.1); the merge rule this implies is DN-011. **WP-0.2 (planned 19 October 2026; none built yet):** the fast tier gains `cell-lint`; the merge tier's `integration-tests` becomes runnable (Testcontainers; the tests themselves come with WP-0.3) and gains `cell-charts`; the nightly tier's `cell-check` is built and its single `chaos` step is split into `chaos-node-kill`, `chaos-db-failover` and `chaos-restart` (built in WP-0.2) and the NOT-BUILT drills of KA-016; the release tier's `cell-check` and `helm-charts` are built, while `signed-images` and `cosign-signatures` stay with WP-0.9 (OQ-127). After WP-0.2 the merge, nightly and release tiers still fail overall, and each WP-0.2 step must pass |",
)
rep(
    "one per SI-21 sensitivity label (27 entries), each mapped to the seeded hazards its SI names (H7, H9, H11 and H15 have no entry yet, KA-008)",
    "one per SI-21 sensitivity label (27 entries), each mapped to the seeded hazards its SI names (H9, H11 and H15 have no entry yet, KA-008); WP-0.2 added HAZ-0028 and HAZ-0029, whose controls are also `planned`",
)
rep(
    "The hazard log has no entry for H7 unavailability, H9 alarm not delivered, H11 cutover double dose and H15 cross-system seam failure, which no SI maps,",
    "The hazard log has no entry for H9 alarm not delivered, H11 cutover double dose and H15 cross-system seam failure, which no SI maps (H7 unavailability has had one since WP-0.2: HAZ-0028, for node loss in the cell),",
)
rep("| H7, H9, H11, H15; the 22 SACs listed |", "| H9, H11, H15; the 22 SACs listed |")

rows = [
    "| KA-014 | The lite cell runs on one WSL VM: its three nodes share one kernel, disk, clock and power supply, and `docker kill` keeps the page cache. Its node-kill tests therefore cannot show durability against a power cut, a disk or network-card loss, clock skew between nodes or real network latency, and its RTOs are indicative, never SLO evidence (§3.5, §5.1). Every lite result is labelled \"lite\" | H6, H7 (HAZ-0028) | `PLT-OPS-04`, `PLT-SITE-01` | 2026-10-19 | open | DN-005 options 2 or 3 (a host that runs the dev cell, or the reference cell, DN-009); hardware fault modes in WP-1.13 |",
    "| KA-015 | The dev profile (three Kafka brokers, larger PostgreSQL buffers, Argo CD core in pull mode) has never run as a whole: the 10 GB VM fits only the lite cell. WP-0.2 plans to render it and validate it with a server-side dry run on the lite cell, and to run Argo CD once on the lite cell only if the measured headroom is at least 1 GiB | H7 | `PLT-OPS-01`, `PLT-OPS-02` | 2026-10-19 | open | DN-005 options 2 or 3 |",
    "| KA-016 | Chaos drills that WP-0.2 does not build fail closed as NOT-BUILT, each naming its owner (OQ-127): broker loss and \"assert alarms ≤5 min\" (WP-0.3 [P]), WAN cut and power cut (WP-1.13), clock skew between nodes (WP-1.13 [P]; ADR-026) and the slow terminology service (WP-1.1). Until WP-0.2 splits it, the whole nightly `chaos` step is NOT-BUILT (KA-003) | H6, H7, H9 | `PLT-OPS-04`, `PLT-SITE-01`, `PLT-PWR-01` | 2026-10-19 | open | WP-0.3, WP-1.1 and WP-1.13, step by step |",
    "| KA-017 | The cell's OpenTelemetry collector exports to a local debug sink: no central site exists. Its allowlist is tested only by showing that one attribute not on the list is absent from the output; the PHI canary scan of logs, traces and metrics comes with WP-0.4 (§21) | H13 | `PLT-OPS-05` | 2026-10-19 | open | WP-0.4 (canary scan); the central site's telemetry intake when it is built |",
    "| KA-018 | The compose dev stack verifies image signatures with cosign only before `up`; nothing checks them when a container restarts, because compose has no admission control. The compose stack never ships, and the cell is the enforced path (ADR-030) | None directly (development only); §4.3 | none (programme) | 2026-10-19 | open | No work package: a limit of compose, accepted for the inner loop |",
    "| KA-019 | Image contents are not scanned for licences or vulnerabilities until WP-0.9. The conditional parts of the cell's images must be in the licence register before that scan: OpenJDK inside the Kafka, Strimzi and Keycloak images (`openjdk-runtime` rule) and the OS packages of their base images (Red Hat UBI for Keycloak and Strimzi, OQ-133) | §4.3 | `TRU-SEC-01` | 2026-10-19 | open | WP-0.9 (container and licence scans, SBOM) |",
    "| KA-020 | The cell's local registry serves plain HTTP on the cell's Docker bridge, so Kyverno verifies with `allowInsecureRegistry`. Image content and signatures are still checked by digest and by the cosign signature; the transport is neither encrypted nor authenticated | None directly; §4.3 | none (programme) | 2026-10-19 | open | No work package named in §21; a TLS registry with the on-site packaging (WP-1.13 [P]) |",
    "| KA-021 | While Kyverno is down, every pod creation in the checked namespaces is refused (`failurePolicy: Fail`): fail-closed by design (ADR-030). The time to recover is to be measured by the node-kill test of the node that holds Kyverno (scenario N3) | H7 | `PLT-OPS-01` | 2026-10-19 | open | No closure planned: by design; the dev and on-site profiles run 3 replicas (ADR-030) |",
    "| KA-022 | Every WSL termination (idle shutdown, `wsl --shutdown`, a Windows restart) stops all three lite-cell nodes at once: a whole-cell power cut. It wrecked the WP-0.2 prototype (DN-015). Planned compensating controls: the keeper process during cell sessions, fixed node addresses (OQ-122) and the restart test R1 (CTRL-0028-3); none is built yet | H6, H7 (HAZ-0028) | `PLT-SITE-01` | 2026-10-19 | open | DN-015; this becomes `mitigated` when fixed addresses and R1 pass |",
    "| KA-023 | The rule that a cancelled synchronous wait is a failed commit exists only in WP-0.2's test probe. PostgreSQL reports a commit whose synchronous wait was cancelled (for example by `statement_timeout`) as success with a warning, while the commit is on the primary only. The product's database access layer does not exist yet; it must never cancel the wait and must treat that warning as failure (CTRL-0028-4, OQ-126) | H6 (HAZ-0028) | `PLT-CORE-01` | 2026-10-19 | open | WP-0.3 (CTRL-0028-4) |",
]
s = s.rstrip("\n") + "\n" + "\n".join(rows) + "\n"
open(p, "w", encoding="utf-8", newline="\n").write(s)
