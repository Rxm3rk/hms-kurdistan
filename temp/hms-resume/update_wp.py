"""Updates docs/program/WORK-PACKAGES.md for the provisioned host (18 Oct 2026)."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/WORK-PACKAGES.md"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, ("not unique/absent", old[:80])
    s = s.replace(old, new)


rep("| **in-progress** (on the Windows host with the project-local toolchain: KA-001, KA-002, DN-006) |",
    "| **in-progress**: built on the Windows checkout with the project-local toolchain (KA-002); gates of record run in the WSL clone (KA-001) |")
rep("| todo, **blocked** by DN-001, DN-002, DN-003; runs as a lite cell (DN-005), whose two PostgreSQL instances cannot show the single-node-loss criterion as written (OQ-084) |",
    "| todo, **next**: stacked on `wp/0.1-programme-bootstrap` (DN-011); runs as a lite cell (DN-005), whose two PostgreSQL instances cannot show the single-node-loss criterion as written (OQ-084) |")
rep("| todo; web parts can start after WP-0.1; the Tauri shell needs Rust (DN-004); the badge-tap criterion needs WP-0.4 |",
    "| todo; can start after WP-0.1 (Rust and the Tauri 2 Linux prerequisites are installed, DN-004); the badge-tap criterion needs WP-0.4 |")
rep("On this host the dev-cell items can be met only by a lite cell and only after DN-001 to DN-003 (see below and DN-005).",
    "On this host the dev-cell items can be met only by a lite cell (DN-005).")

start = s.index("## Execution order on this host")
end = s.index("## Phases 1 to 6")
s = s[:start] + """## Execution order on this host

Applies §3.4 "When everything left is blocked": if every remaining task in the current work package is blocked by an open DN item or a [HUMAN] gate, move to the next work package that does not depend on it; if there is none, update `STATUS.md`, report and end the session. Never work out of dependency order to stay busy.

The host since 18 October 2026: Windows 11 with WSL2 and Ubuntu 24.04 (DN-001 to DN-004 closed). Code is edited in the Windows checkout; the gates of record run in the WSL clone `~/src/hospitalmanagementsystem` at committed SHAs (KA-001). The WSL VM has 10 GB of memory, so every cell is a lite cell (DN-005).

1. **WP-0.1** closes with its commits, the fast tier green in the WSL clone with stored evidence, the doctor output recorded, and a review report. It cannot merge into `main` until the merge tier passes (DN-011), so it is reviewed and stacked.
2. **WP-0.2 is next,** branched from `wp/0.1-programme-bootstrap` (stacked, §3.6). It runs as a lite cell (DN-005); its three-instance failover criterion stays open on a lite cell until DN-005 is answered (OQ-084). Its k3s image is pinned to a Kubernetes version that kubectl 1.37 supports (DN-003).
3. **WP-0.3, WP-0.4, WP-0.5, WP-0.6, WP-0.8 and WP-0.9 wait on WP-0.2 by dependency** (0.3 depends on 0.2; 0.4, 0.5 and 0.8 on 0.3; 0.6 on 0.4 and 0.5; 0.9 on all others). None of them starts early, even where a part looks container-free (for example the WP-0.5 YAML specifications), because §21's "Depends on" column governs.
4. **WP-0.7 depends only on WP-0.1,** so it may run beside WP-0.2. Its web parts, the Tauri shell (Linux build) and the JavaScript side of the React Native skeleton can all be built here; device builds and Windows packaging need platform SDKs that a human provides ("Before the first session"). "A simulated badge tap switches users in ≤2 s" waits for the badge flow from WP-0.4 (§21: "badge flow: 0.4").

""" + s[end:]
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
