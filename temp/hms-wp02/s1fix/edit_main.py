from pathlib import Path
p = Path("tools/hmstools/cell/__main__.py")
s = p.read_bytes().decode("utf-8")
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
rep('''      --evidence writes cell/<date>-images-<shortsha>[-dirty].json; --evidence-dir writes the same record elsewhere.
"""''', '''      --evidence writes cell/<date>-images-<shortsha>[-dirty].json; --evidence-dir writes the same record elsewhere.
  charts fetch|verify [--json]
      Download each pinned chart and manifest into HMS_CELL_HOME, keeping it only at its pinned SHA-256; verify
      that each is there at that checksum and packages no chart, and names no image, of the excluded vendor.
"""''')
rep('''def main(argv: list[str] | None = None) -> int:''', '''def cmd_charts(args: argparse.Namespace) -> int:
    from . import charts
    from .proc import GuardError

    try:
        ctx = context(args)
        outcomes = (charts.fetch if args.action == "fetch" else charts.verify)(ctx)
    except (GuardError, ConfigError, OSError) as exc:
        print(f"cell charts {args.action}: {exc}", file=sys.stderr)
        return 1
    for o in outcomes:
        state = "OK  " if o.ok else "FAIL"
        print(f"{state}  {o.kind:8} {o.file:60} {o.action or '-':10} {o.detail}".rstrip())
    passed = all(o.ok for o in outcomes)
    verdict = "PASS" if passed else "FAIL"
    noted = sum(o.notes for o in outcomes)
    print(f"charts {args.action} [{len(outcomes)} files; {noted} other mentions of the excluded vendor, not failed]: "
          f"{verdict}")
    if args.json:
        print(json.dumps({"check": f"charts-{args.action}", "ok": passed,
                          "files": [o.to_dict() for o in outcomes]}, ensure_ascii=False))
    return 0 if passed else 1


def main(argv: list[str] | None = None) -> int:''')
rep('''    imgs.set_defaults(func=cmd_images)
''', '''    imgs.set_defaults(func=cmd_images)

    charts_p = sub.add_parser("charts", help="fetch and verify the pinned charts and manifests in HMS_CELL_HOME")
    charts_p.add_argument("action", choices=("fetch", "verify"))
    charts_p.add_argument("--json", action="store_true")
    charts_p.set_defaults(func=cmd_charts)
''')
p.write_bytes(s.encode("utf-8"))
print("ok")
