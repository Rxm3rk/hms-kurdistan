import sys
from pathlib import Path
p = Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
def rep(old, new):
    global t
    assert t.count(old) == 1, old
    t = t.replace(old, new)
rep("A confirmation never opens inside a confirmation.",
    "A confirmation never opens inside a confirmation. A HAL capture that waits for a device (a photo, a document scan, an ID read, a signature) holds the guard as a modal does (§2.2, §6).")
rep("| Re-verification window | 60 000 ms, inclusive | Vendor-locked; a tenant may lengthen it, never shorten it (CTRL-0016-1); a constant until the WP-0.3 configuration chain |",
    "| Re-verification window | 60 000 ms, inclusive (DN-new-7) | Vendor-locked; a tenant may lengthen it, never shorten it (CTRL-0016-1); a constant until the WP-0.3 configuration chain |")
rep("Neither changes this specification. This document holds English text only; the `ckb` and `ar` catalogue text is slice S2's work.",
    "Neither changes this specification. This document holds English text only; the `ckb` and `ar` catalogue text is slice S2's work.\n\n"
    "**Readings of safety invariants are the CSO's decisions.** Where this specification has to read SI-01, SI-05 or SI-16 more precisely than the plan states, the reading is not the agent's to decide (§3.4 items 1 and 8): each is a decision entry for the CSO [HUMAN], DN-new-7 to DN-new-13, with options. The default in use is the stricter reading wherever one reading is stricter, and every default that adds to an invariant is recorded as a tightening in the control's `notes` and in the \"Tightenings\" table of `docs/safety/README.md`. One default leaves a stricter option open: a missing name form is flagged on the banner but does not block signing (DN-new-13). SI-16 sets no blocking rule for it, so this does not narrow the invariant, but the stricter option is put to the CSO.")
p.write_text(t, encoding="utf-8", newline="\n"); print("ok")
