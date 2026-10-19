import sys
sys.path.insert(0, r"C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-406132fc\backend\satellites\document-renderer")
from tests.support import html_document, make_request
from hms_docrender.render import render, RenderRefused, RenderFailed
for body in ['<img src="data:image/png,SYN-SECRET-NAME-Shilan">',
             '<img src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><text>SYN-SECRET-NAME</text>">']:
    try:
        render(make_request(html_document(body))); print("RENDERED")
    except (RenderRefused, RenderFailed) as e:
        print(e.code, "|", e.detail.encode('ascii','replace').decode()[:300])
