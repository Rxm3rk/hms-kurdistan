"""Updates KA-001 and KA-002 in docs/program/KNOWN-ANOMALIES.md for the provisioned host (18 Oct 2026)."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/KNOWN-ANOMALIES.md"
lines = p.read_text(encoding="utf-8").split("\n")
out = []
for line in lines:
    if line.startswith("| KA-001 |"):
        line = (
            "| KA-001 | The agent session and the canonical checkout run on the Windows host, not inside Linux as "
            "BUILD-PROMPT \"How to run it\" step 3 and \"Before the first session\" expect: the agent host (T3 Code) "
            "opens the repository on the Windows file system. The Linux build host now exists (WSL2 with Ubuntu 24.04, "
            "DN-001 to DN-004). **Compensating control:** every gate of record (`tools/ci/run`, `tools/doctor`) runs in "
            "the clone `~/src/hospitalmanagementsystem` in the WSL file system, at a committed SHA, and its evidence names "
            "the host. Runs on the Windows checkout are the editing inner loop: they are labelled \"Windows host\" and are "
            "not evidence of record. Until 18 October 2026 the host had no WSL2, container engine or k3d at all "
            "| None directly (no product behaviour); evidence-labelling rule §3.5 | none (programme) | 2026-10-18 | mitigated |"
        )
    elif line.startswith("| KA-002 |"):
        line = (
            "| KA-002 | The JDK and Gradle are project-local in `.tools/` (git-ignored), not system installs: on the Windows "
            "checkout Temurin 25.0.4.1 and Gradle 9.8.1 (DN-006, confirmed by the human); the WSL clone gets its own from "
            "`tools/bootstrap`. The Gradle distribution was fetched from the Aliyun mirror and verified against the "
            "official SHA-256, because services.gradle.org is slow from this network. **Compensating control:** "
            "`tools/bootstrap` verifies every download against its vendor's SHA-256 before use, the Gradle wrapper "
            "verifies the distribution against `distributionSha256Sum`, and `tools/doctor` checks the toolchain "
            "| None directly | none (programme) | 2026-10-18 | mitigated |"
        )
    out.append(line)
p.write_text("\n".join(out), encoding="utf-8", newline="\n")
print("ok")
