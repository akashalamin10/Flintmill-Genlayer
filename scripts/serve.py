#!/usr/bin/env python3
from __future__ import annotations
import http.server, os, posixpath
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1] / "public"
PORT = int(os.environ.get("PORT", "8080"))

ALIASES = {
    "/ledger": "/pages/ledger.html",
    "/mill": "/pages/mill.html",
    "/strike": "/pages/strike.html",
    "/setup": "/pages/setup.html",
    "/verify": "/pages/verify.html",
    "/flint": "/pages/flint.html",
    "/spark": "/pages/spark.html",
    "/board": "/pages/mill.html",
    "/dashboard": "/pages/ledger.html",
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path.endswith((".css", ".js")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        raw = unquote(parsed.path)
        raw = ALIASES.get(raw, raw)
        if raw.endswith("/"):
            raw = raw + "index.html"
        candidate = Path(super().translate_path(raw))
        if not candidate.is_file():
            plus_html = Path(str(candidate) + ".html")
            if plus_html.is_file():
                return str(plus_html)
        return str(candidate)

if __name__ == "__main__":
    os.chdir(ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Flintmill local server: http://127.0.0.1:{PORT}")
    server.serve_forever()
