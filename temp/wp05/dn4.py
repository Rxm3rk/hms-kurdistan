from pathlib import Path
p = Path("docs/program/DECISIONS-NEEDED.md"); s = p.read_text(encoding="utf-8")
old = "  3. Use of additional subscription accounts for parallel agents: \"Yes, use all three\".\n- **What it changes:**"
assert s.count(old) == 1
new = ("  3. Use of additional subscription accounts for parallel agents: \"Yes, use all three\".\n"
       "  4. On 2026-10-19 at about 12:15, unprompted, in chat: \"I want you to abolish most of the reviews just too many of them not needed so we accelerate further work\". This replaces decision 2. It is a deviation from BUILD-PROMPT §3.2 step 7 (\"after any slice with safety impact 'yes', and at least every five sessions\"): reviews now happen once per work package, at its end.\n"
       "- **What it changes:**")
s = s.replace(old, new)
old2 = s[s.index("- **Review policy (decision 2):**"):]
old2 = old2[:old2.index("\n")+1]
new2 = ("- **Review policy (decision 4, which replaces decision 2 from 12:15 on 2026-10-19):** no spec, slice or fix-verification reviews and no multi-lens panels. The automated gates stay: unit and property tests, lints, `tools/hms repo check`, the fast tier and gitleaks. The lead runs one automated review of the whole package at its end (§22 item 10), covering correctness and clinical safety together and reporting critical and major findings only; those are fixed before the package counts as done. Before decision 4, WP-0.5 ran under decision 2: the eight machine drafts had one round of two-lens review (6 critical and about 85 major findings, all addressed in the drafts), and the generator and the harness had one pass each (5 major findings, all being fixed as known bugs, without a further review). The reports are in the build lead's working notes (`%TEMP%\wp05\reviews\`) and go to `docs/program/reviews/WP-0.5.md`.\n")
s = s.replace(old2, new2)
p.write_text(s, encoding="utf-8", newline="\n")
