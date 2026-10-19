import sys
W, H = 960, 670
BLUE, GREEN, AMBER, RED = "#4C7BD9", "#2E9E6B", "#D98E04", "#C2453D"
levels = [
    ("Vendor foundation", "shipped with the product"),
    ("Kurdistan pack", "regional defaults (KRI)"),
    ("Tenant", "the hospital group"),
    ("Legal entity", "the legal organisation"),
    ("Facility", "one hospital"),
    ("Department", "for example, medicine"),
    ("Unit", "for example, a ward"),
    ("User", "personal preference"),
]
LX = [262, 486, 710]
LW = 210
def ry(i): return 120 + 52 * i
out = []
a = out.append
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Configuration chain from vendor to user, with locks" font-family="system-ui, -apple-system, Segoe UI, sans-serif">')
a('<title>Configuration chain: vendor, Kurdistan pack, tenant, legal entity, facility, department, unit, user; a lock stops every level below it from overriding</title>')
a(f'<text x="20" y="32" font-size="19" font-weight="700" fill="currentColor">Where a setting gets its value</text>')
a(f'<text x="20" y="54" font-size="13" fill="currentColor" fill-opacity="0.8">The most specific level wins, unless a level above it has locked the setting.</text>')
# left arrow
a(f'<line x1="28" y1="128" x2="28" y2="522" stroke="currentColor" stroke-width="2" stroke-opacity="0.6"/>')
a(f'<path d="M21 516 L28 530 L35 516 Z" fill="currentColor" fill-opacity="0.6"/>')
a(f'<text x="0" y="0" font-size="11" fill="currentColor" fill-opacity="0.7" transform="translate(16 330) rotate(-90)" text-anchor="middle">more specific</text>')
# lane headers
heads = [("Ordinary setting", "most specific value wins"),
         ("Locked at the hospital", "a governed lock, by approved change"),
         ("Vendor-locked safety setting", "e.g. a safety-invariant limit")]
for x, (t, s) in zip(LX, heads):
    a(f'<text x="{x+LW/2}" y="92" font-size="13.5" font-weight="700" text-anchor="middle" fill="currentColor">{t}</text>')
    a(f'<text x="{x+LW/2}" y="109" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity="0.75">{s}</text>')
a(f'<text x="144" y="109" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity="0.75">level (general to specific)</text>')
for i, (t, s) in enumerate(levels):
    y = ry(i)
    a(f'<rect x="44" y="{y+4}" width="200" height="40" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.45"/>')
    a(f'<text x="56" y="{y+21}" font-size="13.5" font-weight="600" fill="currentColor">{t}</text>')
    a(f'<text x="56" y="{y+37}" font-size="10.5" fill="currentColor" fill-opacity="0.7">{s}</text>')

def lock(x, y):
    a(f'<path d="M{x+4} {y+9} v-3 a5 5 0 0 1 10 0 v3" fill="none" stroke="{AMBER}" stroke-width="2.2"/>')
    a(f'<rect x="{x+1}" y="{y+9}" width="16" height="11" rx="2" fill="{AMBER}"/>')
    a(f'<circle cx="{x+9}" cy="{y+14.5}" r="1.6" fill="#ffffff"/>')

def noentry(x, y):
    a(f'<circle cx="{x+8}" cy="{y+8}" r="7" fill="none" stroke="{RED}" stroke-width="1.8"/>')
    a(f'<line x1="{x+3}" y1="{y+13}" x2="{x+13}" y2="{y+3}" stroke="{RED}" stroke-width="1.8"/>')

def cell(lane, i, kind, line1="", line2="", tag=""):
    x, y = LX[lane], ry(i)
    if kind == "empty":
        a(f'<rect x="{x}" y="{y+4}" width="{LW}" height="40" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-dasharray="4 4"/>')
        a(f'<text x="{x+LW/2}" y="{y+28}" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity="0.45">no value set</text>')
        return
    if kind == "value":
        a(f'<rect x="{x}" y="{y+4}" width="{LW}" height="40" rx="6" fill="{BLUE}" fill-opacity="0.15" stroke="{BLUE}"/>')
        tx = x + 12
    elif kind == "win":
        a(f'<rect x="{x}" y="{y+4}" width="{LW}" height="40" rx="6" fill="{GREEN}" fill-opacity="0.2" stroke="{GREEN}" stroke-width="2.2"/>')
        tx = x + 12
    elif kind == "lock":
        a(f'<rect x="{x}" y="{y+4}" width="{LW}" height="40" rx="6" fill="{AMBER}" fill-opacity="0.18" stroke="{AMBER}" stroke-width="2.2"/>')
        lock(x + 9, y + 13)
        tx = x + 34
    elif kind == "refused":
        a(f'<rect x="{x}" y="{y+4}" width="{LW}" height="40" rx="6" fill="{RED}" fill-opacity="0.08" stroke="{RED}" stroke-dasharray="5 3"/>')
        noentry(x + 9, y + 16)
        tx = x + 32
    if line2:
        a(f'<text x="{tx}" y="{y+21}" font-size="12.5" font-weight="600" fill="currentColor">{line1}</text>')
        a(f'<text x="{tx}" y="{y+37}" font-size="10.5" fill="currentColor" fill-opacity="0.75">{line2}</text>')
    else:
        a(f'<text x="{tx}" y="{y+29}" font-size="12.5" font-weight="600" fill="currentColor">{line1}</text>')
    if tag:
        a(f'<rect x="{x+LW-48}" y="{y+13}" width="40" height="18" rx="9" fill="{GREEN}"/>')
        a(f'<text x="{x+LW-28}" y="{y+26}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#ffffff">{tag}</text>')

# lane 1: ordinary
cell(0, 0, "value", "vendor default")
cell(0, 1, "value", "Kurdistan default")
cell(0, 2, "empty"); cell(0, 3, "empty")
cell(0, 4, "value", "hospital's value")
cell(0, 5, "empty")
cell(0, 6, "win", "ward's value", "used: the most specific value")
cell(0, 7, "empty")
# lane 2: lock at facility
cell(1, 0, "value", "vendor default")
cell(1, 1, "value", "Kurdistan default")
cell(1, 2, "empty"); cell(1, 3, "empty")
cell(1, 4, "lock", "value locked here", "used by every level below")
for i in (5, 6, 7):
    cell(1, i, "refused", "cannot override", "refused; ignored if found")
# lane 3: vendor fixed
cell(2, 0, "lock", "safety value, fixed", "used everywhere; vendor only")
for i in range(1, 8):
    cell(2, i, "refused", "cannot be set", "refused; ignored if found")
# legend / notes
ly = 556
lock(22, ly - 2)
a(f'<text x="48" y="{ly+12}" font-size="11.5" fill="currentColor">Lock: no level below it may set its own value. A hospital lock is lifted only at its own level or above, by an approved change.</text>')
noentry(23, ly + 20)
a(f'<text x="48" y="{ly+33}" font-size="11.5" fill="currentColor">An override below a lock is refused when written, and ignored if one is ever found in storage.</text>')
a(f'<rect x="22" y="{ly+43}" width="18" height="14" rx="3" fill="{GREEN}" fill-opacity="0.2" stroke="{GREEN}" stroke-width="2"/>')
a(f'<text x="48" y="{ly+54}" font-size="11.5" fill="currentColor">Green: the value in use (amber when that value is locked). A vendor lock is part of the product code; no hospital setting removes it.</text>')
a(f'<text x="48" y="{ly+75}" font-size="11.5" fill="currentColor">Not drawn: tighten-only safety settings, where a lower level may make the value stricter but never looser.</text>')
a(f'<text x="48" y="{ly+96}" font-size="10.5" fill="currentColor" fill-opacity="0.65">Source: docs/specs/modules/platform-tenancy.md sections 5.1 to 5.6 (rules W-4, W-5, W-7; property R-L). Specified, not yet coded. Illustrative values.</text>')
a('</svg>')
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out))
