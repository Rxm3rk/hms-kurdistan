import sys
sys.path.insert(0, r"C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-406132fc\backend\satellites\document-renderer")
from hms_docrender.fetcher import OfflineResolver
try:
    OfflineResolver({}).resolve("data:base64,U1lO")
except Exception as e:
    print("resolver:", type(e).__name__, e)
from tests.support import html_document, make_request
from hms_docrender.render import render
try:
    render(make_request(html_document('<img src="data:base64,SYN-SECRET-NAME">')))
except BaseException as e:
    print("render escaped:", type(e).__mro__[:3], str(e)[:200])
