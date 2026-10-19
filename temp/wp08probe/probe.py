import base64, sys, re, zlib, pathlib
sys.path.insert(0, r"C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-406132fc\backend\satellites\document-renderer")
from tests.support import html_document, make_request, pdf_objects, FONT_FACES
from hms_docrender.render import render, RenderRefused, RenderFailed

def fonts_in(pdf):
    return sorted({n.split(b"+",1)[-1].decode() for n in re.findall(rb"/BaseFont\s*/([A-Za-z0-9+_-]+)", pdf_objects(pdf))})

arial = base64.b64encode(pathlib.Path(r"C:\Windows\Fonts\arial.ttf").read_bytes()).decode()
cjk_css = base64.b64encode("p::after{content:'\4E2D'}".encode()).decode()
plain = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body><p>Hello SYN</p></body></html>'
cases = {
 "A data: font (arial) as png type": html_document(f'<style>@font-face{{font-family:Evil;src:url(data:image/png;base64,{arial})}} .e{{font-family:Evil}}</style><p class="e">Hello SYN</p>'),
 "B data:text/css content uncovered": html_document(f'<link rel="stylesheet" href="data:text/css;base64,{cjk_css}"><p>x</p>'),
 "C svg style foreign-content breakout": html_document('<svg><style><p>\u4e2d\u6587</p></style></svg>'),
 "C2 svg title breakout": html_document('<svg><title><p>\u4e2d\u6587</p></title></svg>'),
 "E attr() uncovered": html_document('<style>p::after{content:attr(data-x)}</style><p data-x="\u4e2d">x</p>'),

 "F arabic with latin only": '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>@font-face{font-family:L;src:url(hms-font:noto-sans-regular)} body{font-family:L}</style></head><body><p>\u0634\u06cc\u0644\u0627\u0646</p></body></html>',
 "G local() font": html_document('<style>@font-face{font-family:Loc;src:local("Arial")} .l{font-family:Loc}</style><p class="l">x</p>'),
 "H a rel=attachment data": html_document('<a rel="attachment" href="data:text/plain,SYN-secret">att</a>'),
 "I input value uncovered": html_document('<input value="\u4e2d">'),
 "J list-style string uncovered": html_document('<ul style="list-style-type:\'\4E2D\'"><li>x</li></ul>'),
}
for label, html in [(k,v) for k,v in cases.items() if k[0] in sys.argv[1]]:
    try:
        r = render(make_request(html))
        objs = pdf_objects(r.pdf)
        print(f"{label}: RENDERED fonts={fonts_in(r.pdf)} embeddedfile={b'/EmbeddedFile' in objs} pages={r.page_count}")
    except (RenderRefused, RenderFailed) as e:
        print(f"{label}: {type(e).__name__} {e.code}: {e.detail[:200]}")
