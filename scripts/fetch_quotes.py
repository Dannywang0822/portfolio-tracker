#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SYMBOLS = ["1519.HK", "PDD", "SPY", "USDHKD=X"]
UA = "Mozilla/5.0 (compatible; PortfolioTracker/1.0)"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "quotes.json"


def fetch_one(sym: str) -> dict:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(sym, safe="")
        + "?interval=1d&range=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except Exception:
        url2 = url.replace("query1.", "query2.")
        req2 = urllib.request.Request(url2, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req2, timeout=30) as resp:
            data = json.load(resp)
    meta = data["chart"]["result"][0]["meta"]
    price = meta.get("regularMarketPrice")
    prev = meta.get("previousClose") or meta.get("chartPreviousClose")
    chg = meta.get("regularMarketChangePercent")
    if chg is None and prev not in (None, 0) and price is not None:
        chg = (price - prev) / prev * 100
    return {
        "price": price,
        "previousClose": prev,
        "changePct": chg,
        "currency": meta.get("currency"),
    }


def main() -> None:
    quotes = {}
    for sym in SYMBOLS:
        try:
            quotes[sym] = fetch_one(sym)
        except Exception as e:
            quotes[sym] = {"error": str(e)}
    out = {
        "updatedAt": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
        "quotes": quotes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
