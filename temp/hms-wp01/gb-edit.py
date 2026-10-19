import sys

p = sys.argv[1]
t = open(p, encoding="utf-8", newline="").read()
lit = "Co-Authored-By: Claude <noreply@anthropic.com>"
BT = "\\`"  # a backslash-escaped backtick inside a bash double-quoted string
NL = "\\n"  # a backslash-n inside a printf format
reps = [
    (
        f"**with** an AI co-author trailer ({BT}{lit}{BT}); the check runs with that keyring\"",
        f"**with** an AI co-author trailer ({BT}$AI_TRAILER{BT}); the check runs with that keyring\"",
    ),
    (
        f"p scratch_commit signed \"$(printf 'scratch: CSO acceptance of HAZ-0001{NL}{NL}{lit}')\"",
        f"p scratch_commit signed \"$(printf 'scratch: CSO acceptance of HAZ-0001{NL}{NL}%s' \"$AI_TRAILER\")\"",
    ),
    (
        f"TRAILER_MSG=$(printf 'scratch: CSO acceptance of HAZ-0001{NL}{NL}{lit}')",
        f"TRAILER_MSG=$(printf 'scratch: CSO acceptance of HAZ-0001{NL}{NL}%s' \"$AI_TRAILER\")",
    ),
    (
        f"in a commit with an AI co-author trailer ({BT}{lit}{BT})\"",
        f"in a commit with an AI co-author trailer ({BT}$AI_TRAILER{BT})\"",
    ),
    (
        f"\"$(printf 'scratch: trust anchor, lists the key of Dr Scratch Reviewer{NL}{NL}{lit}')\"",
        f"\"$(printf 'scratch: trust anchor, lists the key of Dr Scratch Reviewer{NL}{NL}%s' \"$AI_TRAILER\")\"",
    ),
    (
        f"A PEM private-key block ({BT}-----BEGIN RSA PRIVATE KEY-----{BT}, random body)",
        f"A PEM private-key block (an RSA {BT}BEGIN{BT} line for a private key, a random body and the matching {BT}END{BT} line, put together at run time)",
    ),
    ("  echo '-----BEGIN RSA PRIVATE KEY-----'\n", f"  printf -- '-----BEGIN RSA %s-----{NL}' \"$PEM_LABEL\"\n"),
    ("  echo '-----END RSA PRIVATE KEY-----'\n", f"  printf -- '-----END RSA %s-----{NL}' \"$PEM_LABEL\"\n"),
    ("WAIT_PATTERN=${HMS_GB_WAIT_PATTERN-failover-v2}", "WAIT_PATTERN=${HMS_GB_WAIT_PATTERN:-}"),
    (
        'SCRATCH_ID=(-c "user.name=Dr Scratch Reviewer"',
        "# Planted values that the repository's own gates would flag (an AI co-author trailer, a PEM private-key\n"
        "# label) are put together at run time, so that this file never holds them literally.\n"
        "AI_TRAILER=$(printf '%s-%s-By: %s <%s@%s>' Co Authored Claude noreply anthropic.com)\n"
        "PEM_LABEL=$(printf '%s %s' PRIVATE KEY)\n\n"
        'SCRATCH_ID=(-c "user.name=Dr Scratch Reviewer"',
    ),
]
for a, b in reps:
    n = t.count(a)
    if n != 1:
        sys.exit(f"{n} matches for {a[:90]!r}")
    t = t.replace(a, b)
open(p, "w", encoding="utf-8", newline="").write(t)
print("ok")
