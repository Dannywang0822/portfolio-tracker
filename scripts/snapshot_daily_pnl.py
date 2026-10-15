#!/usr/bin/env python3
"""Capture end-of-day portfolio market-value snapshot after all three markets close (T0).

T0 = the US equity regular-session calendar date that most recently finished.
When this job runs ~06:00 Asia/Shanghai (after NYSE close ~04:00–05:00 CST),
A-share and HK for that same calendar session are already closed, so the snapshot
is the official「三市收盘后」T0 mark.

Writes / appends data/daily-pnl.json. Idempotent per t0 (overwrites same-day entry).
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
QUOTES = ROOT / "data" / "quotes.json"
OUT = ROOT / "data" / "daily-pnl.json"
INDEX = ROOT / "index.html"
TZ_SH = ZoneInfo("Asia/Shanghai")
TZ_NY = ZoneInfo("America/New_York")


def parse_holdings(html: str) -> list[dict]:
    m = re.search(r"const HOLDINGS = (\[[\s\S]*?\n    \]);", html)
    if not m:
        raise SystemExit("HOLDINGS not found in index.html")
    raw = m.group(1)
    s = re.sub(r"(?m)^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'  "\1":', raw)
    s = s.replace("'", '"')
    s = re.sub(r"(\d)_(\d)", r"\1\2", s)
    s = re.sub(r",\s*}", "}", s)
    s = re.sub(r",\s*]", "]", s)
    data = json.loads(s)
    if not isinstance(data, list) or not data:
        raise SystemExit("HOLDINGS parse empty")
    return data


def last_completed_us_session(now_ny: datetime) -> date:
    """US regular session date that has finished (after 16:00 ET on a weekday)."""
    d = now_ny.date()
    closed_today = now_ny.weekday() < 5 and (
        now_ny.hour > 16 or (now_ny.hour == 16 and now_ny.minute >= 0)
    )
    if closed_today:
        return d
    d = d - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def to_usd(amount: float, currency: str, fx: dict) -> float | None:
    if currency == "USD":
        return amount
    rate = fx.get("hkd") if currency == "HKD" else fx.get("cny") if currency == "CNY" else None
    if rate is None or rate == 0:
        return None
    return amount / rate


def portfolio_totals(holdings: list[dict], quotes: dict, fx: dict) -> dict:
    total_mv = 0.0
    total_cost = 0.0
    total_mv_prev = 0.0
    missing = []
    counted = 0
    for h in holdings:
        yahoo = h.get("yahoo") or h.get("ticker")
        shares = float(h["shares"])
        avg = float(h["avgCost"])
        ccy = h.get("currency") or "USD"
        cost = shares * avg
        cost_usd = to_usd(cost, ccy, fx)
        q = quotes.get(yahoo) or {}
        price = q.get("price")
        prev = q.get("previousClose")
        if price is None:
            missing.append(yahoo)
            continue
        mv_usd = to_usd(shares * float(price), ccy, fx)
        if mv_usd is None or cost_usd is None:
            missing.append(yahoo)
            continue
        total_mv += mv_usd
        total_cost += cost_usd
        counted += 1
        if prev is not None:
            prev_usd = to_usd(shares * float(prev), ccy, fx)
            if prev_usd is not None:
                total_mv_prev += prev_usd
            else:
                total_mv_prev += mv_usd
        else:
            total_mv_prev += mv_usd
    return {
        "totalMvUsd": round(total_mv, 2),
        "totalCostUsd": round(total_cost, 2),
        "totalMvPrevCloseUsd": round(total_mv_prev, 2),
        "dayChangeVsPrevCloseUsd": round(total_mv - total_mv_prev, 2),
        "holdingCount": counted,
        "missingQuotes": missing,
    }


def load_history() -> dict:
    if OUT.exists():
        try:
            return json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"updatedAt": None, "snapshots": []}


def main() -> None:
    now_sh = datetime.now(TZ_SH)
    now_ny = datetime.now(TZ_NY)
    t0 = last_completed_us_session(now_ny).isoformat()

    qdata = json.loads(QUOTES.read_text(encoding="utf-8"))
    quotes = qdata.get("quotes") or {}
    fx = {
        "hkd": (quotes.get("USDHKD=X") or {}).get("price"),
        "cny": (quotes.get("USDCNY=X") or {}).get("price"),
    }
    holdings = parse_holdings(INDEX.read_text(encoding="utf-8"))
    totals = portfolio_totals(holdings, quotes, fx)

    hist = load_history()
    snaps: list = list(hist.get("snapshots") or [])
    # prior T0 for daily pnl
    prior = None
    for s in reversed(snaps):
        if s.get("t0") and s["t0"] != t0:
            prior = s
            break

    daily_vs_t0 = None
    if prior and prior.get("totalMvUsd") is not None:
        daily_vs_t0 = round(totals["totalMvUsd"] - float(prior["totalMvUsd"]), 2)

    snap = {
        "t0": t0,
        "capturedAt": now_sh.isoformat(),
        "capturedAtNy": now_ny.isoformat(),
        "fx": fx,
        "quotesUpdatedAt": qdata.get("updatedAt"),
        **totals,
        "dailyPnlVsPriorT0Usd": daily_vs_t0,
        "priorT0": prior.get("t0") if prior else None,
        "note": "T0=美股常规交易日收盘日；此时 A股/港股该日历交易时段已结束",
    }

    # upsert by t0
    replaced = False
    for i, s in enumerate(snaps):
        if s.get("t0") == t0:
            snaps[i] = snap
            replaced = True
            break
    if not replaced:
        snaps.append(snap)
    snaps.sort(key=lambda x: x.get("t0") or "")
    # keep last 400 trading days
    snaps = snaps[-400:]

    out = {
        "updatedAt": now_sh.isoformat(),
        "latest": snap,
        "snapshots": snaps,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"t0": t0, "replaced": replaced, "totalMvUsd": snap["totalMvUsd"],
                      "dailyPnlVsPriorT0Usd": daily_vs_t0,
                      "dayChangeVsPrevCloseUsd": snap["dayChangeVsPrevCloseUsd"],
                      "missing": snap["missingQuotes"]}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
