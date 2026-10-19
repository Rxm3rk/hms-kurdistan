"""Render a Markdown planning document to a print-quality PDF.

Markdown is parsed in the browser (marked), Mermaid blocks are rendered to SVG,
and the installed Chrome prints the result through Playwright with page numbers
and PDF bookmarks. Library files are read from the paths given on the command line.
"""

import argparse
import html
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

CSS = r"""
@page { size: A4; margin: 13mm 13mm 15mm 13mm; }
@page landscape { size: A4 landscape; margin: 11mm 13mm 14mm 13mm; }
section.landscape-page { page: landscape; }
section.landscape-page h3 { margin-top: 0; }
section.landscape-page figure.diagram { margin: 2pt 0 0; }
section.landscape-page figure.diagram svg { width: 100% !important; max-height: 168mm; }
.diagram-caption { font-size: 9pt; color: #4a6a86; margin: 0 0 4pt; font-weight: 600; }
table.short-first td:first-child, table.short-first th:first-child { white-space: nowrap; }
html {
  font-family: "Segoe UI", Calibri, Arial, "Noto Naskh Arabic", sans-serif;
  font-size: 9.4pt; line-height: 1.42; color: #1b1f24;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
body { margin: 0; }
a { color: #0b4f8a; text-decoration: none; }
h1, h2, h3, h4 { color: #0b3d63; line-height: 1.22; break-after: avoid; page-break-after: avoid; }
main h2 {
  font-size: 15.5pt; margin: 0 0 8pt; padding-bottom: 3pt;
  border-bottom: 2px solid #0b3d63; break-before: page; page-break-before: always;
}
main h3 { font-size: 11.6pt; margin: 13pt 0 5pt; }
main h4 { font-size: 10pt; margin: 10pt 0 4pt; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 6pt; padding-left: 15pt; }
li { margin: 1.4pt 0; }
li > ul, li > ol { margin: 1pt 0 2pt; }
strong { color: #0f2a42; }
hr { display: none; }
code {
  font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.9em;
  background: #eef2f6; padding: 0 2pt; border-radius: 2pt;
}
pre { white-space: pre-wrap; background: #f5f7fa; padding: 6pt; border-radius: 3pt; }
table {
  width: 100%; border-collapse: collapse; margin: 5pt 0 10pt;
  font-size: 7.5pt; line-height: 1.3;
}
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td {
  border: 0.6pt solid #b9c5d1; padding: 2.4pt 3.6pt; vertical-align: top;
  text-align: left; overflow-wrap: break-word; hyphens: auto;
}
th { background: #e6edf5; color: #0f2a42; font-weight: 600; }
tbody tr:nth-child(even) td { background: #f7f9fb; }
td ul, td ol { padding-left: 10pt; margin: 1pt 0; }
figure.diagram { margin: 8pt 0 12pt; text-align: center; break-inside: avoid; page-break-inside: avoid; }
figure.diagram svg { max-width: 100% !important; height: auto; }
figure.diagram.wide svg { width: 100% !important; }

#cover {
  height: 255mm; display: flex; flex-direction: column; justify-content: center;
  padding: 0 6mm; break-after: page; page-break-after: always;
}
.cover-kicker { font-size: 10pt; letter-spacing: 0.08em; text-transform: uppercase; color: #4a6a86; }
.cover-title { font-size: 34pt; margin: 6pt 0 4pt; color: #0b3d63; border: 0; }
.cover-subtitle { font-size: 16pt; color: #22415c; margin-bottom: 22pt; line-height: 1.3; }
.cover-rule { height: 4px; width: 70mm; background: #0b3d63; margin: 0 0 18pt; }
.cover-meta div { font-size: 10.5pt; margin: 3pt 0; }
.cover-meta b { display: inline-block; min-width: 34mm; color: #0f2a42; }
.cover-note {
  margin-top: 26pt; font-size: 10pt; padding: 9pt 11pt; border-left: 4px solid #c8102e;
  background: #fbf3f4; color: #3a2a2c; line-height: 1.45;
}

#toc { break-after: page; page-break-after: always; }
#toc h2 { font-size: 15.5pt; border-bottom: 2px solid #0b3d63; padding-bottom: 3pt; margin: 0 0 8pt; color: #0b3d63; }
#toc ol { list-style: none; padding-left: 0; margin: 0; }
#toc > ol { columns: 2; column-gap: 9mm; font-size: 8.4pt; }
#toc > ol > li { break-inside: avoid; margin: 0 0 4pt; }
#toc > ol > li > a { font-weight: 600; color: #0b3d63; }
#toc li li { padding-left: 9pt; margin: 0.6pt 0; }
#toc li li a { color: #2c3e50; }
"""

PAGE_JS = r"""
(async () => {
  const md = JSON.parse(document.getElementById('md-source').textContent);
  marked.setOptions({ gfm: true, breaks: false });
  const main = document.getElementById('content');
  main.innerHTML = marked.parse(md);

  const firstH1 = main.querySelector('h1');
  if (firstH1) firstH1.remove();

  main.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const src = code.textContent;
    const fig = document.createElement('figure');
    fig.className = 'diagram';
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = src;
    fig.appendChild(div);
    const pre = code.parentElement;
    if (/^\s*gantt/.test(src)) {
      fig.classList.add('wide');
      pre.replaceWith(fig);
      return;
    }
    // Flowcharts are wide: give each its own landscape page, keeping its heading with it.
    const section = document.createElement('section');
    section.className = 'landscape-page';
    const prev = pre.previousElementSibling;
    pre.replaceWith(section);
    if (prev && /^H[2-4]$/.test(prev.tagName)) {
      section.appendChild(prev);
    } else {
      let h = section.previousElementSibling;
      while (h && !/^H[2-3]$/.test(h.tagName)) h = h.previousElementSibling;
      const cap = document.createElement('div');
      cap.className = 'diagram-caption';
      cap.textContent = (h ? h.textContent + ': ' : '') + 'diagram';
      section.appendChild(cap);
    }
    section.appendChild(fig);
  });

  main.querySelectorAll('table').forEach((t) => {
    const firstCells = Array.from(t.rows).map((r) => (r.cells[0] ? r.cells[0].textContent.trim() : ''));
    if (firstCells.length && firstCells.every((s) => s.length <= 8)) t.classList.add('short-first');
  });

  const toc = document.getElementById('toc-list');
  let currentLi = null, sub = null, n = 0;
  main.querySelectorAll('h2, h3').forEach((h) => {
    const id = 'sec-' + (n++);
    h.id = id;
    const a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = h.textContent;
    if (h.tagName === 'H2') {
      currentLi = document.createElement('li');
      currentLi.appendChild(a);
      toc.appendChild(currentLi);
      sub = null;
    } else if (currentLi) {
      if (!sub) { sub = document.createElement('ol'); currentLi.appendChild(sub); }
      const li = document.createElement('li');
      li.appendChild(a);
      sub.appendChild(li);
    }
  });

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
    themeVariables: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '13px' },
    flowchart: { useMaxWidth: true, htmlLabels: true, wrappingWidth: 200, nodeSpacing: 28, rankSpacing: 42 },
    gantt: { useMaxWidth: true, barHeight: 17, barGap: 5, fontSize: 11, sectionFontSize: 12,
             leftPadding: 150, rightPadding: 40, topPadding: 40, gridLineStartPadding: 40 }
  });
  try {
    await mermaid.run({ querySelector: '.mermaid' });
  } catch (e) {
    document.body.setAttribute('data-mermaid-error', String(e && e.message || e));
  }
  document.body.setAttribute('data-diagrams', String(document.querySelectorAll('figure.diagram svg').length));
  window.__ready = true;
})();
"""


def build_html(md_text, args, marked_js, mermaid_js):
    meta_rows = "".join(
        f"<div><b>{html.escape(k.strip())}</b>{html.escape(v.strip())}</div>"
        for k, _, v in (m.partition("|") for m in args.meta)
    )
    cover = (
        '<section id="cover">'
        f'<div class="cover-kicker">{html.escape(args.kicker)}</div>'
        f'<h1 class="cover-title">{html.escape(args.title)}</h1>'
        f'<div class="cover-subtitle">{html.escape(args.subtitle)}</div>'
        '<div class="cover-rule"></div>'
        f'<div class="cover-meta">{meta_rows}</div>'
        + (f'<div class="cover-note">{args.note}</div>' if args.note else "")
        + "</section>"
    )
    md_json = json.dumps(md_text).replace("</", "<\\/")
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>{html.escape(args.title)} - {html.escape(args.subtitle)}</title>"
        f"<style>{CSS}</style></head><body>"
        f'{cover}<nav id="toc"><h2>Contents</h2><ol id="toc-list"></ol></nav>'
        '<main id="content"></main>'
        f'<script id="md-source" type="application/json">{md_json}</script>'
        f"<script>{marked_js}</script><script>{mermaid_js}</script>"
        f"<script>{PAGE_JS}</script></body></html>"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("markdown")
    ap.add_argument("pdf")
    ap.add_argument("--marked", required=True)
    ap.add_argument("--mermaid", required=True)
    ap.add_argument("--html-out")
    ap.add_argument("--kicker", default="")
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--meta", action="append", default=[], help="'Label|value'")
    ap.add_argument("--note", default="")
    ap.add_argument("--footer", default="")
    ap.add_argument("--channel", default="chrome")
    args = ap.parse_args()

    md_text = pathlib.Path(args.markdown).read_text(encoding="utf-8")
    marked_js = pathlib.Path(args.marked).read_text(encoding="utf-8")
    mermaid_js = pathlib.Path(args.mermaid).read_text(encoding="utf-8")
    page_html = build_html(md_text, args, marked_js, mermaid_js)

    html_path = pathlib.Path(args.html_out or pathlib.Path(args.pdf).with_suffix(".html"))
    html_path.write_text(page_html, encoding="utf-8")

    footer = (
        '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:7.5px;color:#5b6b7a;'
        'width:100%;padding:0 13mm;display:flex;justify-content:space-between;">'
        f"<span>{html.escape(args.footer)}</span>"
        '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(channel=args.channel, headless=True)
        page = browser.new_page(viewport={"width": 900, "height": 1200})
        page.goto(html_path.resolve().as_uri(), wait_until="load")
        page.wait_for_function("window.__ready === true", timeout=120_000)
        err = page.get_attribute("body", "data-mermaid-error")
        diagrams = page.get_attribute("body", "data-diagrams")
        if err:
            print(f"MERMAID ERROR: {err}", file=sys.stderr)
        page.pdf(
            path=args.pdf,
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=footer,
            margin={"top": "13mm", "bottom": "15mm", "left": "13mm", "right": "13mm"},
            prefer_css_page_size=True,
            outline=True,
            tagged=True,
        )
        browser.close()
    print(f"diagrams rendered: {diagrams}; html: {html_path}; pdf: {args.pdf}")


if __name__ == "__main__":
    main()
