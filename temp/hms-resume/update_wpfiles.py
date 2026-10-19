"""Updates the stale host statements in the work-package files and the evidence README (18 Oct 2026)."""
import sys
from pathlib import Path

root = Path(sys.argv[1]) / "docs/program"


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:80])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


rep("work-packages/WP-0.1.md",
    "- On this host: Windows without WSL2, a container engine or k3d, so only container-free work runs here, labelled \"indicative (Windows host, no cell)\" (KA-001), with the project-local toolchain in `.tools/` (DN-006, KA-002).",
    "- On this host: at the start, Windows without WSL2, a container engine or k3d. On the human's instruction the Linux build host was provisioned during WP-0.1 (WSL2 with Ubuntu 24.04; DN-001 to DN-004 closed). The work is edited in the Windows checkout with the project-local toolchain in `.tools/` (DN-006, KA-002), and the gates of record run in the WSL clone at committed SHAs (KA-001).")
rep("work-packages/WP-0.1.md",
    "- `tools/ci/run fast` green on an empty skeleton with stored evidence in `docs/program/evidence/ci/` (on this host labelled \"indicative (Windows host, no cell)\").",
    "- `tools/ci/run fast` green on an empty skeleton with stored evidence in `docs/program/evidence/ci/`, run in the WSL clone at the committed SHA (KA-001).")
rep("work-packages/WP-0.1.md",
    "- Human decisions this work package raises: DN-001, DN-002, DN-003 and DN-006 (\"Blocking now\"); DN-007, DN-008 and DN-010 (later).",
    "- Human decisions this work package raised: DN-001 to DN-004 and DN-006 (closed on 18 October 2026); DN-005 and DN-011 (\"Blocking now\"); DN-007, DN-008, DN-010 and DN-012 (later).")

rep("work-packages/WP-0.2.md",
    "- A Linux build host (DN-001), a container engine (DN-002) and k3d, kubectl and Helm (DN-003). **Not met on this host:** WP-0.2 is blocked.",
    "- A Linux build host (DN-001), a container engine (DN-002) and k3d, kubectl and Helm (DN-003): met on 18 October 2026 (WSL2 with Ubuntu 24.04, Docker Engine 29.9.1, k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1). Pin a k3s image whose Kubernetes version kubectl 1.37 supports; k3d 5.8.3's default (1.31) is outside the skew (DN-003).")
rep("work-packages/WP-0.2.md",
    "- A decision on resources (DN-005). Default: the lite cell, because the host has 15.6 GB RAM and 8 cores, below the 32 GB the dev cell needs.",
    "- A decision on resources (DN-005). Default: the lite cell, because the host has 15.6 GB RAM and 8 cores, below the 32 GB the dev cell needs; the WSL VM has 10 GB of memory and 8 GB of swap. Measure and record what the lite cell uses.")
rep("work-packages/WP-0.2.md",
    "- The host prerequisites are human decisions: DN-001, DN-002, DN-003 and DN-005. The reference cell (DN-009) is not needed for this work package.",
    "- The host prerequisites were human decisions: DN-001, DN-002 and DN-003 are closed; DN-005 is open. The reference cell (DN-009) is not needed for this work package.")

rep("work-packages/WP-0.3.md",
    "- Not met on this host: waits on WP-0.2 (DN-001, DN-002, DN-003).",
    "- Waits on WP-0.2.")

rep("work-packages/WP-0.7.md",
    "- On this host the web parts can start after WP-0.1. The Tauri shell needs Rust and the Tauri 2 prerequisites (DN-004). The badge-tap exit criterion",
    "- On this host the web parts can start after WP-0.1, and the Tauri shell can be built in the WSL build host, which has Rust and the Tauri 2 Linux prerequisites (DN-004, closed). The badge-tap exit criterion")

rep("evidence/README.md",
    "| The Windows build host, no cell (KA-001) | \"indicative (Windows host, no cell)\" | no |",
    "| The Windows checkout, no cell (KA-001): the editing inner loop, not evidence of record | \"Windows host\" | no |\n"
    "| The Linux build host (the WSL clone), no cell: fast-tier and doctor evidence of record | \"WSL build host, no cell\" | no |")
print("ok")
