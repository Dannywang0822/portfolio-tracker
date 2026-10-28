#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Built-in holdings + FX. Manual adds go into data/extra-symbols.json (or via watchlist issue).
# SPCX is SpaceX on Nasdaq (Yahoo chart symbol SPCX, currency USD).
# SPACE and SPACEX return 404 on the chart API — do not substitute them.
# SPY is the NYSE Arca SPDR S&P 500 ETF (Yahoo chart symbol SPY, currency USD).
BASE_SYMBOLS = [
    "PDD", "COIN", "NVO", "CAG", "TSLA", "SPCX", "SPY",
    "0700.HK", "0981.HK", "1519.HK", "9992.HK", "1119.HK",
    "000009.SZ", "002501.SZ", "002828.SZ", "161033.SZ", "300405.SZ", "300629.SZ",
    "510150.SS", "513500.SS", "515000.SS", "515030.SS", "515710.SS",
    "600519.SS", "601012.SS",
    "USDHKD=X", "USDCNY=X",
]
UA = "Mozilla/5.0 (compatible; PortfolioTracker/1.0)"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "quotes.json"
EXTRA = ROOT / "data" / "extra-symbols.json"


def load_symbols() -> list:
    seen = set()
    out = []
    extras = []
    if EXTRA.exists():
        try:
            raw = json.loads(EXTRA.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                extras = [str(x).strip() for x in raw if str(x).strip()]
            elif isinstance(raw, dict) and isinstance(raw.get("symbols"), list):
                extras = [str(x).strip() for x in raw["symbols"] if str(x).strip()]
        except Exception as e:
            print(f"warn: could not read {EXTRA}: {e}")
    for sym in BASE_SYMBOLS + extras:
        if sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


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
    symbols = load_symbols()
    quotes = {}
    for sym in symbols:
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
    print(json.dumps({"symbolCount": len(symbols), "symbols": symbols, "updatedAt": out["updatedAt"]}, indent=2))


if __name__ == "__main__":
    main()
