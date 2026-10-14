/*! 三市场交易时段 · 倒计时与节假日（纯客户端，无 API）
 * 暴露 window.MarketHours：{ getAllStates(now), formatCountdown(ms) }
 * 供看板设计师后续换肤：语义 class 见 getAllStates().cssStatus
 */
(function (global) {
  "use strict";

  /** @type {Record<string, Array<{date:string, name:string}>>} */
  const HOLIDAYS = {
    CN: [
      // 2025 沪深交易所休市
      { date: "2025-01-01", name: "元旦" },
      { date: "2025-01-28", name: "春节" },
      { date: "2025-01-29", name: "春节" },
      { date: "2025-01-30", name: "春节" },
      { date: "2025-01-31", name: "春节" },
      { date: "2025-02-01", name: "春节" },
      { date: "2025-02-02", name: "春节" },
      { date: "2025-02-03", name: "春节" },
      { date: "2025-02-04", name: "春节" },
      { date: "2025-04-04", name: "清明节" },
      { date: "2025-04-05", name: "清明节" },
      { date: "2025-04-06", name: "清明节" },
      { date: "2025-05-01", name: "劳动节" },
      { date: "2025-05-02", name: "劳动节" },
      { date: "2025-05-03", name: "劳动节" },
      { date: "2025-05-04", name: "劳动节" },
      { date: "2025-05-05", name: "劳动节" },
      { date: "2025-05-31", name: "端午节" },
      { date: "2025-06-01", name: "端午节" },
      { date: "2025-06-02", name: "端午节" },
      { date: "2025-10-01", name: "国庆中秋" },
      { date: "2025-10-02", name: "国庆中秋" },
      { date: "2025-10-03", name: "国庆中秋" },
      { date: "2025-10-04", name: "国庆中秋" },
      { date: "2025-10-05", name: "国庆中秋" },
      { date: "2025-10-06", name: "国庆中秋" },
      { date: "2025-10-07", name: "国庆中秋" },
      { date: "2025-10-08", name: "国庆中秋" },
      // 2026
      { date: "2026-01-01", name: "元旦" },
      { date: "2026-01-02", name: "元旦" },
      { date: "2026-01-03", name: "元旦" },
      { date: "2026-02-15", name: "春节" },
      { date: "2026-02-16", name: "春节" },
      { date: "2026-02-17", name: "春节" },
      { date: "2026-02-18", name: "春节" },
      { date: "2026-02-19", name: "春节" },
      { date: "2026-02-20", name: "春节" },
      { date: "2026-02-21", name: "春节" },
      { date: "2026-02-22", name: "春节" },
      { date: "2026-02-23", name: "春节" },
      { date: "2026-04-04", name: "清明节" },
      { date: "2026-04-05", name: "清明节" },
      { date: "2026-04-06", name: "清明节" },
      { date: "2026-05-01", name: "劳动节" },
      { date: "2026-05-02", name: "劳动节" },
      { date: "2026-05-03", name: "劳动节" },
      { date: "2026-05-04", name: "劳动节" },
      { date: "2026-05-05", name: "劳动节" },
      { date: "2026-06-19", name: "端午节" },
      { date: "2026-06-20", name: "端午节" },
      { date: "2026-06-21", name: "端午节" },
      { date: "2026-09-25", name: "中秋节" },
      { date: "2026-09-26", name: "中秋节" },
      { date: "2026-09-27", name: "中秋节" },
      { date: "2026-10-01", name: "国庆节" },
      { date: "2026-10-02", name: "国庆节" },
      { date: "2026-10-03", name: "国庆节" },
      { date: "2026-10-04", name: "国庆节" },
      { date: "2026-10-05", name: "国庆节" },
      { date: "2026-10-06", name: "国庆节" },
      { date: "2026-10-07", name: "国庆节" },
    ],
    HK: [
      { date: "2025-01-01", name: "元旦" },
      { date: "2025-01-29", name: "农历新年" },
      { date: "2025-01-30", name: "农历新年" },
      { date: "2025-01-31", name: "农历新年" },
      { date: "2025-04-04", name: "清明节" },
      { date: "2025-04-18", name: "耶稣受难日" },
      { date: "2025-04-21", name: "复活节星期一" },
      { date: "2025-05-01", name: "劳动节" },
      { date: "2025-05-05", name: "佛诞" },
      { date: "2025-07-01", name: "特区成立日" },
      { date: "2025-10-01", name: "国庆日" },
      { date: "2025-10-07", name: "中秋节翌日" },
      { date: "2025-10-29", name: "重阳节" },
      { date: "2025-12-25", name: "圣诞节" },
      { date: "2025-12-26", name: "圣诞节后首个工作日" },
      { date: "2026-01-01", name: "元旦" },
      { date: "2026-02-17", name: "农历新年" },
      { date: "2026-02-18", name: "农历新年" },
      { date: "2026-02-19", name: "农历新年" },
      { date: "2026-04-03", name: "耶稣受难日" },
      { date: "2026-04-06", name: "清明节翌日" },
      { date: "2026-04-07", name: "复活节翌日" },
      { date: "2026-05-01", name: "劳动节" },
      { date: "2026-05-25", name: "佛诞翌日" },
      { date: "2026-06-19", name: "端午节" },
      { date: "2026-07-01", name: "特区成立日" },
      { date: "2026-10-01", name: "国庆日" },
      { date: "2026-10-19", name: "重阳节翌日" },
      { date: "2026-12-25", name: "圣诞节" },
    ],
    US: [
      { date: "2025-01-01", name: "新年" },
      { date: "2025-01-20", name: "马丁·路德·金日" },
      { date: "2025-02-17", name: "总统日" },
      { date: "2025-04-18", name: "耶稣受难日" },
      { date: "2025-05-26", name: "阵亡将士纪念日" },
      { date: "2025-06-19", name: "六月节" },
      { date: "2025-07-04", name: "独立日" },
      { date: "2025-09-01", name: "劳动节" },
      { date: "2025-11-27", name: "感恩节" },
      { date: "2025-12-25", name: "圣诞节" },
      { date: "2026-01-01", name: "新年" },
      { date: "2026-01-19", name: "马丁·路德·金日" },
      { date: "2026-02-16", name: "总统日" },
      { date: "2026-04-03", name: "耶稣受难日" },
      { date: "2026-05-25", name: "阵亡将士纪念日" },
      { date: "2026-06-19", name: "六月节" },
      { date: "2026-07-03", name: "独立日（顺延）" },
      { date: "2026-09-07", name: "劳动节" },
      { date: "2026-11-26", name: "感恩节" },
      { date: "2026-12-25", name: "圣诞节" },
    ],
  };

  /** 美股提前收盘日（13:00 ET） */
  const US_EARLY_CLOSE = {
    "2025-07-03": true,
    "2025-11-28": true,
    "2025-12-24": true,
    "2026-11-27": true,
    "2026-12-24": true,
  };

  /** 港股半日市（仅上午，收盘 12:00） */
  const HK_HALF_DAY = {
    "2025-01-28": true,
    "2025-12-24": true,
    "2025-12-31": true,
    "2026-02-16": true,
    "2026-12-24": true,
    "2026-12-31": true,
  };

  const MARKETS = [
    {
      id: "CN",
      name: "A股",
      sub: "沪深",
      timeZone: "Asia/Shanghai",
      holidayKey: "CN",
      sessions: [
        { open: [9, 30], close: [11, 30] },
        { open: [13, 0], close: [15, 0] },
      ],
    },
    {
      id: "HK",
      name: "港股",
      sub: "港交所",
      timeZone: "Asia/Hong_Kong",
      holidayKey: "HK",
      sessions: [
        { open: [9, 30], close: [12, 0] },
        { open: [13, 0], close: [16, 0] },
      ],
    },
    {
      id: "US",
      name: "美股",
      sub: "NYSE",
      timeZone: "America/New_York",
      holidayKey: "US",
      sessions: [{ open: [9, 30], close: [16, 0] }],
    },
  ];

  const holidayIndex = {};
  Object.keys(HOLIDAYS).forEach((k) => {
    holidayIndex[k] = Object.create(null);
    HOLIDAYS[k].forEach((h) => {
      holidayIndex[k][h.date] = h.name;
    });
  });

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function getZonedParts(date, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    const map = {};
    dtf.formatToParts(date).forEach((p) => {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: +map.year,
      month: +map.month,
      day: +map.day,
      hour: +map.hour,
      minute: +map.minute,
      second: +map.second,
      weekday: wd[map.weekday] ?? 0,
      dateStr: `${map.year}-${map.month}-${map.day}`,
    };
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const p = getZonedParts(date, timeZone);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUTC - date.getTime();
  }

  /** 将某时区墙钟时间转为 UTC Date */
  function zonedLocalToUtc(y, mo, d, h, mi, s, timeZone) {
    const utc = Date.UTC(y, mo - 1, d, h, mi, s);
    let offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
    let guess = new Date(utc - offset);
    offset = getTimeZoneOffsetMs(guess, timeZone);
    return new Date(utc - offset);
  }

  function addCalendarDays(y, mo, d, delta) {
    const t = new Date(Date.UTC(y, mo - 1, d + delta));
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
  }

  function holidayName(key, dateStr) {
    return holidayIndex[key][dateStr] || null;
  }

  function isWeekend(weekday) {
    return weekday === 0 || weekday === 6;
  }

  function sessionsFor(market, dateStr) {
    if (market.id === "HK" && HK_HALF_DAY[dateStr]) {
      return [{ open: [9, 30], close: [12, 0] }];
    }
    if (market.id === "US" && US_EARLY_CLOSE[dateStr]) {
      return [{ open: [9, 30], close: [13, 0] }];
    }
    return market.sessions;
  }

  function isTradingDay(market, parts) {
    if (isWeekend(parts.weekday)) return false;
    if (holidayName(market.holidayKey, parts.dateStr)) return false;
    return true;
  }

  function findNextOpen(market, fromDate) {
    let cursor = getZonedParts(fromDate, market.timeZone);
    for (let i = 0; i < 20; i++) {
      const check =
        i === 0
          ? cursor
          : (() => {
              const n = addCalendarDays(cursor.year, cursor.month, cursor.day, i);
              const noon = zonedLocalToUtc(n.year, n.month, n.day, 12, 0, 0, market.timeZone);
              return getZonedParts(noon, market.timeZone);
            })();

      if (!isTradingDay(market, check)) continue;
      const sessions = sessionsFor(market, check.dateStr);
      for (const sess of sessions) {
        const openAt = zonedLocalToUtc(
          check.year,
          check.month,
          check.day,
          sess.open[0],
          sess.open[1],
          0,
          market.timeZone
        );
        if (openAt.getTime() > fromDate.getTime()) {
          return { at: openAt, dateStr: check.dateStr };
        }
      }
    }
    return null;
  }

  function addCalendarDaysMs(fromDate, timeZone, days) {
    const p = getZonedParts(fromDate, timeZone);
    const n = addCalendarDays(p.year, p.month, p.day, days);
    return zonedLocalToUtc(n.year, n.month, n.day, 12, 0, 0, timeZone);
  }

  function nextOpenLabel(market, fromDate, openInfo) {
    if (!openInfo) return "开盘";
    const today = getZonedParts(fromDate, market.timeZone).dateStr;
    const tomorrow = getZonedParts(addCalendarDaysMs(fromDate, market.timeZone, 1), market.timeZone).dateStr;
    if (openInfo.dateStr === today) return "距开盘";
    if (openInfo.dateStr === tomorrow) return "距明日开盘";
    const [, m, d] = openInfo.dateStr.split("-");
    return `距 ${+m}/${+d} 开盘`;
  }

  function upcomingHolidayHint(market, fromDate) {
    const p = getZonedParts(fromDate, market.timeZone);
    for (let i = 0; i <= 14; i++) {
      const n = addCalendarDays(p.year, p.month, p.day, i);
      const ds = `${n.year}-${pad2(n.month)}-${pad2(n.day)}`;
      const name = holidayName(market.holidayKey, ds);
      if (!name) continue;
      if (i === 0) return { when: "今日", name, dateStr: ds };
      if (i === 1) return { when: "明日", name, dateStr: ds };
      return { when: `${n.month}/${n.day}`, name, dateStr: ds };
    }
    return null;
  }

  function getMarketState(market, now) {
    const parts = getZonedParts(now, market.timeZone);
    const hol = holidayName(market.holidayKey, parts.dateStr);
    const upcoming = upcomingHolidayHint(market, now);

    if (hol) {
      const next = findNextOpen(market, now);
      return {
        id: market.id,
        name: market.name,
        sub: market.sub,
        status: "休市·节假日",
        cssStatus: "holiday",
        countdownLabel: nextOpenLabel(market, now, next),
        countdownMs: next ? Math.max(0, next.at.getTime() - now.getTime()) : 0,
        holiday: hol,
        holidayHint: upcoming && upcoming.when !== "今日" ? upcoming : null,
        localDate: parts.dateStr,
        localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
      };
    }

    if (isWeekend(parts.weekday)) {
      const next = findNextOpen(market, now);
      return {
        id: market.id,
        name: market.name,
        sub: market.sub,
        status: "周末",
        cssStatus: "weekend",
        countdownLabel: nextOpenLabel(market, now, next),
        countdownMs: next ? Math.max(0, next.at.getTime() - now.getTime()) : 0,
        holiday: null,
        holidayHint: upcoming,
        localDate: parts.dateStr,
        localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
      };
    }

    const sessions = sessionsFor(market, parts.dateStr);
    const nowMs = now.getTime();

    for (let i = 0; i < sessions.length; i++) {
      const sess = sessions[i];
      const openAt = zonedLocalToUtc(
        parts.year,
        parts.month,
        parts.day,
        sess.open[0],
        sess.open[1],
        0,
        market.timeZone
      );
      const closeAt = zonedLocalToUtc(
        parts.year,
        parts.month,
        parts.day,
        sess.close[0],
        sess.close[1],
        0,
        market.timeZone
      );

      if (nowMs >= openAt.getTime() && nowMs < closeAt.getTime()) {
        return {
          id: market.id,
          name: market.name,
          sub: market.sub,
          status: "交易中",
          cssStatus: "open",
          countdownLabel: "距收盘",
          countdownMs: Math.max(0, closeAt.getTime() - nowMs),
          holiday: null,
          holidayHint: upcoming,
          localDate: parts.dateStr,
          localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
        };
      }

      // 午休：上一节已收、下一节未开
      if (i < sessions.length - 1) {
        const nextSess = sessions[i + 1];
        const nextOpen = zonedLocalToUtc(
          parts.year,
          parts.month,
          parts.day,
          nextSess.open[0],
          nextSess.open[1],
          0,
          market.timeZone
        );
        if (nowMs >= closeAt.getTime() && nowMs < nextOpen.getTime()) {
          return {
            id: market.id,
            name: market.name,
            sub: market.sub,
            status: "午休",
            cssStatus: "lunch",
            countdownLabel: "距开盘",
            countdownMs: Math.max(0, nextOpen.getTime() - nowMs),
            holiday: null,
            holidayHint: upcoming,
            localDate: parts.dateStr,
            localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
          };
        }
      }
    }

    // 交易日但未开盘或已收盘
    const firstOpen = zonedLocalToUtc(
      parts.year,
      parts.month,
      parts.day,
      sessions[0].open[0],
      sessions[0].open[1],
      0,
      market.timeZone
    );
    if (nowMs < firstOpen.getTime()) {
      return {
        id: market.id,
        name: market.name,
        sub: market.sub,
        status: "已收盘",
        cssStatus: "closed",
        countdownLabel: "距开盘",
        countdownMs: Math.max(0, firstOpen.getTime() - nowMs),
        holiday: null,
        holidayHint: upcoming,
        localDate: parts.dateStr,
        localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
        preOpen: true,
      };
    }

    const next = findNextOpen(market, now);
    return {
      id: market.id,
      name: market.name,
      sub: market.sub,
      status: "已收盘",
      cssStatus: "closed",
      countdownLabel: nextOpenLabel(market, now, next),
      countdownMs: next ? Math.max(0, next.at.getTime() - now.getTime()) : 0,
      holiday: null,
      holidayHint: upcoming,
      localDate: parts.dateStr,
      localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`,
    };
  }

  function formatCountdown(ms) {
    if (ms == null || ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h >= 100) return `${h}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  function getAllStates(now) {
    const t = now instanceof Date ? now : new Date();
    return MARKETS.map((m) => getMarketState(m, t));
  }

  global.MarketHours = {
    MARKETS,
    HOLIDAYS,
    getAllStates,
    formatCountdown,
  };
})(typeof window !== "undefined" ? window : globalThis);
