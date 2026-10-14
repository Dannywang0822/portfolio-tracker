#!/usr/bin/env python3
"""持仓跟踪 H5 · 本地静态服务 + Yahoo 行情代理

用法:
  python3 serve.py
  浏览器打开 http://127.0.0.1:8765/
  手机同一 Wi‑Fi: http://<本机局域网IP>:8765/

仅依赖 Python 3 标准库。
"""
from __future__ import annotations

import json
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8765
HOST = "0.0.0.0"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
YAHOO_CHART_HOSTS = (
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
)

# Short TTL cache: portfolio refreshes every 15m; avoids Yahoo 429
QUOTE_CACHE: dict[str, tuple[float, int, bytes, str]] = {}
CACHE_TTL_SEC = 60.0


def local_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and ip not in ips:
            ips.insert(0, ip)
    except OSError:
        pass
    return ips


def fetch_yahoo(symbol: str) -> tuple[int, bytes, str]:
    """Return (status, body_bytes, content_type)."""
    symbol = symbol.strip()
    cached = QUOTE_CACHE.get(symbol)
    if cached and (time.time() - cached[0]) < CACHE_TTL_SEC:
        return cached[1], cached[2], cached[3]
    if not symbol or len(symbol) > 32:
        return 400, json.dumps({"error": "invalid symbol"}).encode(), "application/json"
    # Basic allowlist: letters, digits, dots, equals, dash, caret
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-=^")
    if any(c not in allowed for c in symbol):
        return 400, json.dumps({"error": "invalid symbol chars"}).encode(), "application/json"

    enc = urllib.parse.quote(symbol, safe=".=^-")
    last_status = 502
    last_msg = "unknown"
    for host in YAHOO_CHART_HOSTS:
        url = f"{host}/v8/finance/chart/{enc}?interval=1d&range=1d"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": UA,
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.9",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = resp.read()
                ctype = resp.headers.get("Content-Type", "application/json")
                ctype = ctype.split(";")[0].strip() or "application/json"
                QUOTE_CACHE[symbol] = (time.time(), 200, body, ctype)
                return 200, body, ctype
        except urllib.error.HTTPError as e:
            err_body = e.read() if hasattr(e, "read") else b""
            last_msg = err_body.decode("utf-8", errors="replace")[:500] if err_body else str(e)
            last_status = e.code
            # try next host on rate-limit / server errors
            if e.code in (429, 500, 502, 503):
                continue
            return e.code, json.dumps({"error": "yahoo_http", "status": e.code, "detail": last_msg}).encode(), "application/json"
        except Exception as e:  # noqa: BLE001
            last_status = 502
            last_msg = str(e)
            continue
    return last_status, json.dumps({"error": "yahoo_http", "status": last_status, "detail": last_msg}).encode(), "application/json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # CORS for safety (same-origin normally; helps if opened oddly)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/quote":
            symbols = qs.get("symbol") or qs.get("symbols")
            if not symbols:
                self._json(400, {"error": "missing symbol query param"})
                return
            status, body, ctype = fetch_yahoo(symbols[0])
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/quotes":
            raw = (qs.get("symbols") or [""])[0]
            symbols = [s.strip() for s in raw.split(",") if s.strip()]
            if not symbols:
                self._json(400, {"error": "missing symbols query param"})
                return
            results = {}
            errors = {}
            for sym in symbols[:40]:
                status, body, _ = fetch_yahoo(sym)
                try:
                    data = json.loads(body.decode("utf-8"))
                except Exception:
                    data = {"error": "bad_json", "raw_status": status}
                if status == 200 and isinstance(data, dict) and data.get("chart"):
                    results[sym] = data
                else:
                    errors[sym] = data if isinstance(data, dict) else {"error": "failed", "status": status}
            self._json(200, {"quotes": results, "errors": errors})
            return

        # Static files from ROOT
        super().do_GET()

    def _json(self, status: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    ips = local_ips()
    print("=" * 56)
    print("持仓跟踪 H5 · 本地服务已启动")
    print(f"  本机:     http://127.0.0.1:{PORT}/")
    for ip in ips:
        print(f"  局域网:   http://{ip}:{PORT}/")
    if not ips:
        print("  （未能自动检测局域网 IP，请在系统网络设置里查看）")
    print()
    print("手机请连同一 Wi‑Fi，用上面「局域网」地址打开。")
    print("不要用 file:// 直接打开 HTML，否则行情无法更新。")
    print("按 Ctrl+C 停止。")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()


if __name__ == "__main__":
    main()
