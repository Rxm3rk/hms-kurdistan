"""Builds the HMS work-package demonstration page from the gathered material (gather.json)."""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
IMG = HERE / "img"
data = json.loads((HERE / "gather.json").read_text(encoding="utf-8"))["result"]
by_wp = {w["wp"]: w for w in data}
STAMP = sys.argv[1] if len(sys.argv) > 1 else "19 Oct 2026"


def e(s):
    return html.escape(str(s or ""), quote=False).replace("\"", "&quot;")


def clean_svg(svg):
    svg = re.sub(r"<script.*?</script>", "", svg, flags=re.S | re.I)
    svg = re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.I)
    svg = re.sub(r"(href|xlink:href)\s*=\s*\"(?!#)[^\"]*\"", "", svg)
    return svg


STATE_LABEL = {"done": "Done", "in-progress": "In progress", "waiting": "Waiting", "not-started": "Not started"}


def chip(state):
    return f'<span class="chip s-{e(state)}">{e(STATE_LABEL.get(state, state))}</span>'


def img_path(p):
    name = Path(p).name
    local = IMG / name
    return str(local if local.exists() else p).replace("\\", "/")


def showcase(s):
    out = [f'<figure class="show"><figcaption><b>{e(s["title"])}</b></figcaption>']
    k = s["kind"]
    if k == "svg" and s.get("svg"):
        out.append(f'<div class="svgbox">{clean_svg(s["svg"])}</div>')
    elif k == "image" and s.get("image_path"):
        out.append(f'<div class="imgbox"><img src="{e(img_path(s["image_path"]))}" alt="{e(s["title"])}"></div>')
    elif k == "code" and s.get("code"):
        src = f'<div class="src">{e(s.get("code_source", ""))}</div>' if s.get("code_source") else ""
        out.append(f'<pre><code>{e(s["code"])}</code></pre>{src}')
    elif k == "table" and s.get("table"):
        t = s["table"]
        head = "".join(f"<th>{e(h)}</th>" for h in t["headers"])
        rows = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in t["rows"])
        out.append(f'<div class="tbl"><table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>')
    out.append(f'<p class="cap">{e(s["caption"])}</p></figure>')
    return "".join(out)


GALLERY = {
    "WP-0.7": [
        ("ds-banner-en.png", "English: the banner shows who the patient is (photo, name in Kurdish, Arabic and Latin, MRN, date of birth) and the safety facts (allergies in red, code status, isolation, weight)."),
        ("ds-banner-ckb.png", "Sorani Kurdish: the whole screen flips right-to-left; the Latin name and the numbers keep their direction."),
        ("ds-banner-ar.png", "Arabic, right-to-left."),
        ("ds-compact-palette.png", "Compact density and the command palette (search for screens and patients from the keyboard)."),
    ]
}

WHERE = {
    "WP-0.1": "Windows laptop (lead)",
    "WP-0.2": "Windows laptop (Linux copy)",
    "WP-0.3": "Windows now → MacBook",
    "WP-0.5": "Windows now → MacBook",
    "WP-0.7": "Windows laptop",
    "WP-0.8": "Windows laptop",
}
STATUS = {"WP-0.1": "done", "WP-0.2": "in-progress", "WP-0.3": "in-progress", "WP-0.5": "in-progress",
          "WP-0.7": "in-progress", "WP-0.8": "in-progress", "WP-0.4": "not-started", "WP-0.6": "not-started",
          "WP-0.9": "not-started"}
SHORT = {"WP-0.1": "Foundation & safety gates", "WP-0.2": "Server cell", "WP-0.3": "Core libraries",
         "WP-0.4": "Login, permissions, audit", "WP-0.5": "Clinical state machines", "WP-0.6": "Test data & benchmarks",
         "WP-0.7": "Design system & banner", "WP-0.8": "Printing & documents", "WP-0.9": "Safety registry & release"}

NOT_STARTED = [
    ("WP-0.4", "Login, permissions and audit (the Trust Plane)",
     "Who may see and do what. Hospital login with passkeys and badge-and-PIN, permissions by role and by care relationship (a nurse sees her ward's patients), \"break the glass\" for emergencies with a review queue, a tamper-evident audit trail of every look at a patient record, and encryption keys per hospital.",
     "Waits for the core libraries."),
    ("WP-0.6", "Synthetic test data and performance benchmarks",
     "Generates realistic made-up hospital populations and simulated 300-bed and 1,000-bed days, then measures whether the design holds up (speed, offline medication scanning conflicts, message-bus footprint) before real hospitals depend on it.",
     "Waits for login/permissions and the state machines."),
    ("WP-0.9", "Safety registry and release evidence",
     "The hazard log as a service, the list of third-party software (SOUP/SBOM), signed releases, and the Release Evidence Pack that blocks a release when any safety control for a feature in it is not verified.",
     "Waits for all other foundation packages."),
]


def dep_map():
    # Boxes: (wp, x, y)
    pos = {"WP-0.1": (6, 70), "WP-0.2": (166, 70), "WP-0.3": (326, 70), "WP-0.4": (494, 10),
           "WP-0.5": (494, 70), "WP-0.8": (494, 130), "WP-0.6": (668, 40), "WP-0.9": (842, 70), "WP-0.7": (326, 170)}
    w, h = 150, 46
    col = {"done": "var(--success)", "in-progress": "var(--info)", "not-started": "var(--muted-foreground)"}
    edges = [("WP-0.1", "WP-0.2"), ("WP-0.2", "WP-0.3"), ("WP-0.3", "WP-0.4"), ("WP-0.3", "WP-0.5"), ("WP-0.3", "WP-0.8"),
             ("WP-0.4", "WP-0.6"), ("WP-0.5", "WP-0.6"), ("WP-0.6", "WP-0.9"), ("WP-0.8", "WP-0.9"), ("WP-0.1", "WP-0.7"),
             ("WP-0.7", "WP-0.9")]
    parts = ['<svg viewBox="0 0 1000 230" width="100%" role="img" aria-label="Foundation work packages and their order">',
             '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
             '<path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.5"/></marker></defs>']
    for a, b in edges:
        ax, ay = pos[a]; bx, by = pos[b]
        x1, y1 = ax + w, ay + h / 2
        x2, y2 = bx, by + h / 2
        if a == "WP-0.1" and b == "WP-0.7":
            x1, y1, x2, y2 = ax + w / 2, ay + h, bx, by + h / 2
            parts.append(f'<path d="M{x1},{y1} V{y2} H{x2 - 2}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" marker-end="url(#ar)"/>')
            continue
        if a == "WP-0.7" and b == "WP-0.9":
            x1, y1, x2, y2 = ax + w, ay + h / 2, bx + w / 2, by + h
            parts.append(f'<path d="M{x1},{y1} H{x2} V{y2 + 2}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" marker-end="url(#ar)"/>')
            continue
        mx = (x1 + x2) / 2
        parts.append(f'<path d="M{x1},{y1} C{mx},{y1} {mx},{y2} {x2 - 2},{y2}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" marker-end="url(#ar)"/>')
    for wp, (x, y) in pos.items():
        st = STATUS[wp]
        c = col[st]
        dash = ' stroke-dasharray="4 3"' if st == "not-started" else ""
        early = wp in ("WP-0.3", "WP-0.5", "WP-0.8")
        parts.append(f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{c}" fill-opacity="0.12" stroke="{c}" stroke-width="1.6"{dash}/>'
                     f'<text x="{x + 10}" y="{y + 19}" font-size="12" font-weight="700" fill="currentColor">{wp.replace("WP-", "")} · {e(STATUS_LBL[st])}</text>'
                     f'<text x="{x + 10}" y="{y + 36}" font-size="11.5" fill="currentColor" opacity="0.85">{e(SHORT[wp])}</text>'
                     + (f'<text x="{x + w - 8}" y="{y + 19}" font-size="10" text-anchor="end" fill="{c}">early</text>' if early else "")
                     + '</g>')
    parts.append('</svg>')
    return "".join(parts)


STATUS_LBL = {"done": "done", "in-progress": "building", "not-started": "not started"}


def section(wp):
    w = by_wp[wp]
    st = STATUS[wp]
    items = "".join(f'<li>{chip(i["state"])}<span class="it"><b>{e(i["label"])}</b><br><span class="ev">{e(i["evidence"])}</span></span></li>'
                    for i in w["progress_items"])
    nums = "".join(f'<div class="num"><div class="v">{e(n["value"])}</div><div class="l">{e(n["label"])}</div></div>' for n in w["numbers"])
    shows = "".join(showcase(s) for s in w["showcases"])
    gal = ""
    if wp in GALLERY:
        gal = '<div class="gallery">' + "".join(
            f'<figure class="shot"><img src="{e(str(IMG / f).replace(chr(92), "/"))}" alt=""><figcaption>{e(c)}</figcaption></figure>'
            for f, c in GALLERY[wp]) + '</div>'
    nxt = "".join(f"<li>{e(x)}</li>" for x in w["next_steps"])
    hum = "".join(f"<li>{e(x)}</li>" for x in w["needs_human"]) or "<li>Nothing right now.</li>"
    return f'''
<details class="wp" id="{wp}" {"open" if wp in ("WP-0.7", "WP-0.8") else ""}>
<summary><span class="wpid">{wp}</span><span class="wpt">{e(w["title_plain"])}</span>{chip(st)}<span class="where">{e(WHERE.get(wp, ""))}</span></summary>
<div class="body">
<p class="purpose">{e(w["purpose_plain"])}</p>
<p class="statusline">{e(w["status_line"])}</p>
{gal}
<div class="grid2">
  <div><h4>What exists, with evidence</h4><ul class="items">{items}</ul></div>
  <div><h4>In numbers</h4><div class="nums">{nums}</div></div>
</div>
<h4>See it</h4>
{shows}
<div class="grid2 small">
  <div><h4>Next</h4><ul>{nxt}</ul></div>
  <div><h4>Needs a person</h4><ul>{hum}</ul></div>
</div>
</div>
</details>'''


ns = "".join(f'<div class="ns"><div class="nsh"><span class="wpid">{wp}</span><b>{e(t)}</b>{chip("not-started")}</div><p>{e(p)}</p><p class="ev">{e(wait)}</p></div>'
             for wp, t, p, wait in NOT_STARTED)

CSS = """
.wrap{font-family:var(--font-sans);color:var(--foreground);line-height:1.45;font-size:14px}
h1{font-size:19px;margin:0 0 4px}
.sub{color:var(--muted-foreground);margin:0 0 14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:0 0 16px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px}
.stat .v{font-size:20px;font-weight:700}
.stat .l{font-size:12px;color:var(--muted-foreground)}
.map{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin:0 0 6px;color:var(--card-foreground)}
.legend{font-size:12px;color:var(--muted-foreground);margin:0 0 18px}
details.wp{border:1px solid var(--border);border-radius:var(--radius);margin:0 0 10px;background:var(--card);color:var(--card-foreground)}
details.wp>summary{cursor:pointer;list-style:none;padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
details.wp>summary::-webkit-details-marker{display:none}
details.wp>summary::before{content:'▸';color:var(--muted-foreground);width:10px}
details.wp[open]>summary::before{content:'▾'}
.wpid{font-family:var(--font-mono);font-size:12px;background:var(--secondary);color:var(--secondary-foreground);border-radius:6px;padding:1px 6px}
.wpt{font-weight:700;font-size:15px}
.where{font-size:12px;color:var(--muted-foreground);margin-inline-start:auto}
.body{padding:0 16px 16px}
.purpose{margin:4px 0 6px}
.statusline{margin:0 0 12px;color:var(--muted-foreground)}
.chip{font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap;display:inline-block}
.s-done{background:var(--success);color:var(--success-foreground)}
.s-in-progress{background:var(--info);color:var(--info-foreground)}
.s-waiting{background:var(--warning);color:var(--warning-foreground)}
.s-not-started{background:var(--secondary);color:var(--secondary-foreground)}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
@media (max-width:640px){.grid2{grid-template-columns:1fr}}
h4{margin:14px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-foreground)}
ul.items{list-style:none;padding:0;margin:0}
ul.items li{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)}
ul.items li .chip{margin-top:2px;min-width:74px;text-align:center}
.ev{font-size:12px;color:var(--muted-foreground)}
.nums{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.num{background:var(--background);border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:8px 10px}
.num .v{font-weight:700;font-size:13.5px}
.num .l{font-size:11.5px;color:var(--muted-foreground)}
figure.show{margin:0 0 16px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--background)}
figure.show figcaption{margin:0 0 8px}
.cap{font-size:12.5px;color:var(--muted-foreground);margin:8px 0 0}
.svgbox{color:var(--foreground);overflow-x:auto}
.svgbox svg{max-width:100%;height:auto;display:block;margin:0 auto}
.imgbox{text-align:center;background:#fff;border-radius:6px;padding:10px}
.imgbox img{max-width:100%;height:auto}
pre{background:var(--code-background);color:var(--code-foreground);border-radius:6px;padding:10px 12px;overflow-x:auto;font-size:12px;margin:0}
.src{font-family:var(--font-mono);font-size:11px;color:var(--muted-foreground);margin-top:4px}
.tbl{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{border-bottom:1px solid var(--border);padding:5px 8px;text-align:start;vertical-align:top}
th{color:var(--muted-foreground);font-weight:600}
.gallery{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 4px}
@media (max-width:640px){.gallery{grid-template-columns:1fr}}
.shot{margin:0}
.shot img{width:100%;border:1px solid var(--border);border-radius:6px;display:block}
.shot figcaption{font-size:12px;color:var(--muted-foreground);margin-top:4px}
.small ul{margin:0;padding-inline-start:18px;font-size:13px}
.ns{border:1px dashed var(--border);border-radius:var(--radius);padding:12px 14px;margin:0 0 10px}
.nsh{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ns p{margin:6px 0 0}
.foot{font-size:12px;color:var(--muted-foreground);margin-top:16px;border-top:1px solid var(--border);padding-top:10px}
"""

wp01 = by_wp["WP-0.1"]
page = f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="wrap">
<h1>How HMS Kurdistan is being built</h1>
<p class="sub">The foundation stage (Phase 0) as of {e(STAMP)}. Everything below is real work from the project, using made-up patients only. Click a package to open or close it.</p>
<div class="stats">
<div class="stat"><div class="v">1</div><div class="l">package done (foundation and safety gates)</div></div>
<div class="stat"><div class="v">5</div><div class="l">packages being built at once</div></div>
<div class="stat"><div class="v">3</div><div class="l">not started (waiting their turn)</div></div>
<div class="stat"><div class="v">1,279</div><div class="l">tests in the official check run, 0 failing</div></div>
<div class="stat"><div class="v">27 / 193</div><div class="l">hazards tracked / safety controls planned</div></div>
<div class="stat"><div class="v">73 of 78</div><div class="l">planted defects caught by the gates (other 5 by design)</div></div>
</div>
<div class="map">{dep_map()}</div>
<p class="legend">Arrows show what each package needs first. "early" = started before the server cell is finished, on its parts that don't need the cell (approved deviation). Green = done, blue = being built, dashed = not started.</p>
{''.join(section(wp) for wp in ["WP-0.7", "WP-0.8", "WP-0.5", "WP-0.3", "WP-0.2", "WP-0.1"])}
<h4>Not started yet</h4>
{ns}
<p class="foot">Honesty notes: only the foundation's check results are official records (run on the Linux build copy). Work in progress is verified on the Windows laptop, which is not evidence of record. Much of the work in progress is still uncommitted files, protected by automatic saves every 10 minutes and an upload to the private GitHub repo. Reviews so far are by AI reviewers; clinical sign-offs are left for named people and none has been filled in.</p>
</div></body></html>"""

(HERE / "page.html").write_text(page, encoding="utf-8")
print(len(page))

# ---- Fallback colours so the page also works opened directly in a browser (outside T3) ----
FALLBACK = {"--background": "#ffffff", "--foreground": "#0f172a", "--muted-foreground": "#64748b", "--card": "#f8fafc",
            "--card-foreground": "#0f172a", "--border": "#e2e8f0", "--secondary": "#e2e8f0", "--secondary-foreground": "#0f172a",
            "--success": "#15803d", "--success-foreground": "#ffffff", "--info": "#1d4ed8", "--info-foreground": "#ffffff",
            "--warning": "#b45309", "--warning-foreground": "#ffffff", "--code-background": "#0f172a", "--code-foreground": "#e2e8f0",
            "--radius": "10px", "--font-sans": "system-ui, 'Segoe UI', 'Noto Sans', 'Noto Sans Arabic', sans-serif",
            "--font-mono": "ui-monospace, Consolas, monospace"}
def with_fallbacks(text):
    return re.sub(r"var\((--[a-z0-9-]+)\)", lambda m: f"var({m.group(1)}, {FALLBACK[m.group(1)]})" if m.group(1) in FALLBACK else m.group(0), text)
def squeeze(text):
    return re.sub(r">\s+<", "><", text)
page2 = squeeze(with_fallbacks(page))
(HERE / "page.html").write_text(page2, encoding="utf-8")
import base64
def inline(m):
    p = Path(m.group(1))
    return 'src="data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() + '"' if p.exists() else m.group(0)
standalone = re.sub(r'src="(C:/[^"]+\.png)"', inline, page2).replace("<head>", "<head><title>HMS Kurdistan: how the build is going</title>", 1)
out = Path(r"C:\Users\Surface\hms-demo\build-status.html")
out.write_text(standalone, encoding="utf-8")
print("page", len(page2), "standalone", len(standalone))

HEAD_NUMS = {"WP-0.1": [0, 1, 6], "WP-0.2": [0, 1, 2], "WP-0.3": [0, 1, 2], "WP-0.5": [0, 1, 2], "WP-0.7": [0, 1, 2], "WP-0.8": [0, 1, 2]}
def card(wp):
    w = by_wp[wp]
    nums = "".join(f'<div class="num"><div class="v">{e(n["value"])}</div><div class="l">{e(n["label"])}</div></div>'
                   for i, n in enumerate(w["numbers"]) if i in HEAD_NUMS[wp])
    extra = ""
    if wp == "WP-0.7":
        extra = '<div class="gallery3">' + "".join(f'<img src="{e(str(IMG / f).replace(chr(92), "/"))}" alt="">' for f in ["ds-banner-en.png", "ds-banner-ckb.png", "ds-banner-ar.png"]) + '</div>'
    if wp == "WP-0.8":
        extra = '<div class="labels">' + "".join(f'<img src="{e(str(IMG / f).replace(chr(92), "/"))}" alt="">' for f in ["selftest-wristband-datamatrix-p1.png", "selftest-receipt-code128-p1.png"]) + '</div>'
    return f"""<div class="card">
<div class="ch"><span class="wpid">{wp}</span><b>{e(w["title_plain"])}</b>{chip(STATUS[wp])}<span class="where">{e(WHERE.get(wp, ""))}</span></div>
<p class="statusline">{e(w["status_line"])}</p>
{extra}
<div class="nums3">{nums}</div>
</div>"""
SCSS = CSS + """
.card{border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--card-foreground);padding:12px 14px;margin:0 0 10px}
.ch{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nums3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
@media (max-width:560px){.nums3{grid-template-columns:1fr}}
.gallery3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.gallery3 img{width:100%;border:1px solid var(--border);border-radius:6px}
.labels{display:flex;gap:10px;align-items:flex-start;background:#fff;border-radius:6px;padding:10px;margin:8px 0;overflow-x:auto}
.labels img{max-height:170px}
"""
summary = f"""<!doctype html><html><head><meta charset="utf-8"><style>{SCSS}</style></head><body><div class="wrap">
<div class="stats">
<div class="stat"><div class="v">1</div><div class="l">package done</div></div>
<div class="stat"><div class="v">5</div><div class="l">being built at once</div></div>
<div class="stat"><div class="v">3</div><div class="l">not started yet</div></div>
<div class="stat"><div class="v">1,279</div><div class="l">official tests, 0 failing</div></div>
<div class="stat"><div class="v">73 / 78</div><div class="l">planted defects caught</div></div>
</div>
<div class="map">{dep_map()}</div>
<p class="legend">Arrows show what each package needs first. "early" = started before the server cell is finished, on the parts that don't need it. Green = done, blue = building, dashed = not started.</p>
{''.join(card(wp) for wp in ["WP-0.7", "WP-0.8", "WP-0.5", "WP-0.3", "WP-0.2", "WP-0.1"])}
</div></body></html>"""
summary = with_fallbacks(summary)
(HERE / "summary.html").write_text(summary, encoding="utf-8")
print("summary", len(summary))
