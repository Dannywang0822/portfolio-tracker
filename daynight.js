/* 日夜自动换肤 + 遥控器方向键导航 + TV 自动翻页
 * - 白天（日出→日落）= .theme-day 纸感卡片；夜间 = .theme-night 深色终端
 * - 日出日落：NOAA 公式本地计算，不调外部 API；坐标优先浏览器定位，失败用上海 (31.23, 121.47)，缓存 localStorage
 * - 手动模式：auto / night / day，存 localStorage("dn-mode")
 * - 测试参数：?force=day|night，?now=ISO 时间
 * 只切换 <html> 的 class，不刷新页面，焦点、滚动、已输入内容都不受影响。
 */
(function () {
  "use strict";
  var R = Math.PI / 180, LS = window.localStorage, doc = document.documentElement;
  var q = new URLSearchParams(location.search);
  var MODE_KEY = "dn-mode", GEO_KEY = "dn-geo";
  var DEFAULT_GEO = { lat: 31.23, lng: 121.47, src: "默认上海" };

  function lsGet(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) { /* 隐私模式 */ } }

  /* NOAA Solar Calculator 公式；返回该 UTC 日的日出/日落 Date（极昼/极夜返回 null） */
  function sun(date, lat, lng) {
    var d0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    function calc(rise, guess) {
      var jd = guess / 864e5 + 2440587.5, T = (jd - 2451545) / 36525;
      var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
      var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      var C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
      var om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
      var eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
      var dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R));
      var y = Math.pow(Math.tan(eps * R / 2), 2);
      var eot = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R) - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
      var cosH = (Math.cos(90.833 * R) - Math.sin(lat * R) * Math.sin(dec)) / (Math.cos(lat * R) * Math.cos(dec));
      if (cosH > 1 || cosH < -1) return null;
      var H = Math.acos(cosH) / R;
      return d0 + (720 - 4 * (lng + (rise ? H : -H)) - eot) * 6e4;
    }
    var noon = d0 + (720 - 4 * lng) * 6e4;
    var r = calc(true, noon), s = calc(false, noon);
    if (r) r = calc(true, r);
    if (s) s = calc(false, s);
    return { rise: r ? new Date(r) : null, set: s ? new Date(s) : null };
  }

  var t0 = Date.now();
  var nowParam = q.get("now"), base = nowParam && !isNaN(Date.parse(nowParam)) ? Date.parse(nowParam) : t0;
  function now() { return new Date(base + (Date.now() - t0)); }
  window.DN_NOW = now; // 供交易时段卡片使用同一时钟（便于 ?now= 测试）

  function geo() {
    try { var c = JSON.parse(lsGet(GEO_KEY)); if (c && isFinite(c.lat) && isFinite(c.lng)) return c; } catch (e) { /* ignore */ }
    return DEFAULT_GEO;
  }

  function isDaytime() {
    var c = geo(), n = now();
    for (var k = -1; k <= 1; k++) {
      var s = sun(new Date(n.getTime() + k * 864e5), c.lat, c.lng);
      if (s.rise && s.set && n >= s.rise && n < s.set) return true;
    }
    var s0 = sun(n, c.lat, c.lng);
    if (!s0.rise || !s0.set) { // 极昼/极夜：按半球季节粗判
      var summer = n.getUTCMonth() > 2 && n.getUTCMonth() < 9;
      return c.lat > 0 ? summer : !summer;
    }
    return false;
  }

  function mode() { var m = lsGet(MODE_KEY); return m === "day" || m === "night" ? m : "auto"; }
  function wanted() {
    var f = q.get("force");
    if (f === "day" || f === "night") return f;
    var m = mode();
    return m === "auto" ? (isDaytime() ? "day" : "night") : m;
  }

  var current = null, toggles = [], menu = null, menuBtn = null;
  function apply(fade) {
    var t = wanted();
    if (t === current) { updateLabels(); return; }
    if (fade && current) {
      doc.classList.add("dn-fade");
      setTimeout(function () { doc.classList.remove("dn-fade"); }, 520);
    }
    var sx = window.scrollX, sy = window.scrollY;
    doc.classList.add("dn");
    doc.classList.toggle("theme-day", t === "day");
    doc.classList.toggle("theme-night", t === "night");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "day" ? "#f4f2ee" : "#12161c");
    current = t;
    if (sy || sx) { window.scrollTo(sx, sy); requestAnimationFrame(function () { window.scrollTo(sx, sy); }); }
    updateLabels();
  }
  apply(false); // 在 <head> 里同步执行，避免首屏闪烁

  if (navigator.geolocation && !nowParam) {
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        lsSet(GEO_KEY, JSON.stringify({ lat: +p.coords.latitude.toFixed(3), lng: +p.coords.longitude.toFixed(3), src: "定位", ts: Date.now() }));
        apply(true);
      }, function () { /* 拒绝或失败：沿用缓存或上海 */ }, { timeout: 8000, maximumAge: 6 * 3600e3 });
    } catch (e) { /* ignore */ }
  }
  setInterval(function () { apply(true); }, 60000);

  /* ---------- 切换按钮 / 菜单 ---------- */
  var MODES = [["auto", "◐ 自动"], ["night", "☾ 强制夜间"], ["day", "☀ 强制日间"]];
  function hm(d) { return d ? d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"; }
  function sunText() { var c = geo(), s = sun(now(), c.lat, c.lng); return "日出 " + hm(s.rise) + " · 日落 " + hm(s.set) + "（" + c.src + "）"; }
  function labelFor() {
    var f = q.get("force");
    var m = mode(), name = MODES.filter(function (x) { return x[0] === m; })[0][1];
    if (f === "day" || f === "night") name = "⚑ 测试";
    return name + " <small>" + (current === "day" ? "日间" : "夜间") + "</small>";
  }
  function updateLabels() {
    toggles.forEach(function (b) {
      b.innerHTML = labelFor();
      b.title = "主题模式（点击切换：自动 → 强制夜间 → 强制日间） · " + sunText();
      b.setAttribute("aria-label", "主题模式 " + b.textContent + "，回车切换");
    });
    if (menu) {
      menu.querySelectorAll("[data-dn-mode]").forEach(function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-dn-mode") === mode() ? "true" : "false");
      });
      var st = menu.querySelector(".dn-sun"); if (st) st.textContent = sunText();
    }
  }
  function setMode(m) { lsSet(MODE_KEY, m); apply(true); }
  function cycle() { var i = MODES.map(function (x) { return x[0]; }).indexOf(mode()); setMode(MODES[(i + 1) % 3][0]); }
  function makeToggle(extraClass) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "dn-toggle" + (extraClass ? " " + extraClass : "");
    b.addEventListener("click", cycle);
    toggles.push(b); return b;
  }
  function openMenu(show) {
    if (!menu) return;
    menu.hidden = !show;
    menuBtn.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) { var f = menu.querySelector('[aria-checked="true"]') || menu.querySelector("button"); f && f.focus(); }
  }

  function initUI() {
    var bar = document.querySelector(".toolbar-actions");
    if (bar) {
      bar.insertBefore(makeToggle(), bar.firstChild);
      menuBtn = document.createElement("button");
      menuBtn.type = "button"; menuBtn.className = "dn-menu-btn"; menuBtn.textContent = "☰";
      menuBtn.setAttribute("aria-label", "菜单"); menuBtn.setAttribute("aria-haspopup", "true"); menuBtn.setAttribute("aria-expanded", "false");
      bar.appendChild(menuBtn);
      menu = document.createElement("div");
      menu.className = "dn-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
      menu.innerHTML = '<div class="dn-menu-title">主题</div>' + MODES.map(function (x) {
        return '<button type="button" role="menuitemradio" data-dn-mode="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '<div class="dn-menu-title dn-sun"></div>';
      document.body.appendChild(menu);
      menuBtn.addEventListener("click", function (e) { e.stopPropagation(); openMenu(menu.hidden); });
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("[data-dn-mode]"); if (!b) return;
        setMode(b.getAttribute("data-dn-mode")); openMenu(false); menuBtn.focus();
      });
      document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== menuBtn) openMenu(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { openMenu(false); menuBtn.focus(); } });
    }
    var gate = document.getElementById("loginGate");
    if (gate) gate.appendChild(makeToggle("dn-login-toggle"));
    initPaging();
    fitPositionsPane();
    window.addEventListener("resize", fitPositionsPane);
    window.addEventListener("orientationchange", fitPositionsPane);
    setInterval(fitPositionsPane, 1500);
    updateLabels();
  }

  /* ---------- 遥控器：方向键按空间位置移动焦点，回车确认 ---------- */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
  function visible(el) {
    if (el.closest("[hidden]")) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none";
  }
  function scope() {
    var m = ["deleteConfirmModal", "holdingModal"].map(function (id) { return document.getElementById(id); })
      .filter(function (x) { return x && !x.hidden; })[0];
    if (m) return m;
    if (menu && !menu.hidden) return menu;
    var g = document.getElementById("loginGate");
    if (g && !g.hidden) return g;
    return document;
  }
  function clipRect(el) { // 被 overflow:hidden 容器裁掉的部分也算作可去的位置（翻页容器）
    return el.getBoundingClientRect();
  }
  document.addEventListener("keydown", function (e) {
    var dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
    var cur = document.activeElement;
    if (cur && cur.tagName === "SELECT") return; // 下拉框保留原生方向键
    if (cur && (cur.tagName === "TEXTAREA" || (cur.tagName === "INPUT" && !/^(checkbox|radio|button|submit)$/.test(cur.type))) && dir[1] === 0) return;
    var root = scope();
    var all = Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), visible);
    if (!all.length) return;
    if (!cur || cur === document.body || !root.contains(cur) || (root === document && !visible(cur))) {
      all[0].focus(); e.preventDefault(); return;
    }
    var a = clipRect(cur), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bs = Infinity;
    all.forEach(function (el) {
      if (el === cur || el.contains(cur)) return;
      var r = clipRect(el);
      // 取边缘距离，避免大卡片中心偏移
      var x = Math.max(r.left, Math.min(ax, r.right)), y = Math.max(r.top, Math.min(ay, r.bottom));
      var dx = (dir[0] ? (r.left + r.width / 2) : x) - ax, dy = (dir[1] ? (r.top + r.height / 2) : y) - ay;
      var along = dx * dir[0] + dy * dir[1];
      if (along <= 2) return;
      var perp = Math.abs(dx * dir[1] + dy * dir[0]);
      // 与当前元素在垂直方向上没有交叠、且偏得太远的候选不算“在那个方向上”
      var overlap = dir[0] ? (r.bottom > a.top && r.top < a.bottom) : (r.right > a.left && r.left < a.right);
      if (!overlap && perp > along * 1.5) return;
      var score = along + perp * 2.2;
      if (score < bs) { bs = score; best = el; }
    });
    if (best) {
      e.preventDefault();
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
      lastInput = Date.now();
    }
  });

  /* ---------- TV：持仓超过一屏时每 10 秒翻页；有焦点或有操作时暂停 ---------- */
  var lastInput = 0, PAGE_MS = 10000, IDLE_MS = 15000;
  ["keydown", "pointerdown", "wheel", "touchstart", "mousemove"].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInput = Date.now(); }, { passive: true });
  });
  function fitPositionsPane() {
    try {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        document.documentElement.style.removeProperty("--pos-fit-h");
        return;
      }
      var box = document.getElementById("positions");
      var sync = document.querySelector(".sync-bar");
      if (!box) return;
      var top = box.getBoundingClientRect().top;
      var bottom = sync && !sync.hidden ? sync.getBoundingClientRect().top : window.innerHeight;
      var h = Math.max(180, Math.floor(bottom - top - 8));
      document.documentElement.style.setProperty("--pos-fit-h", h + "px");
    } catch (e) { /* ignore */ }
  }

  function initPaging() {
    var box = document.getElementById("positions");
    if (!box) return;
    var ind = document.createElement("div");
    ind.className = "dn-page"; ind.setAttribute("aria-live", "polite");
    box.parentNode.insertBefore(ind, box.nextSibling);
    function pages() { return box.clientHeight ? Math.max(1, Math.ceil((box.scrollHeight - 4) / box.clientHeight)) : 1; }
    function isTvLayout() {
      // ≥1800 为 TV 布局；电脑端即使窗口很宽也可滚（overflow-y:auto），仍可选用自动翻页
      return window.matchMedia("(min-width: 1800px)").matches && box.scrollHeight > box.clientHeight + 4;
    }
    function paint(paused) {
      if (!isTvLayout()) { ind.textContent = ""; return; }
      var p = Math.round(box.scrollTop / box.clientHeight) + 1;
      ind.textContent = "第 " + Math.min(p, pages()) + " / " + pages() + " 页 · " + (paused ? "已暂停自动翻页" : "每 10 秒自动翻页");
    }
    function paused() {
      var a = document.activeElement;
      var modalOpen = ["holdingModal", "deleteConfirmModal", "loginGate"].some(function (id) { var x = document.getElementById(id); return x && !x.hidden; });
      return modalOpen || (a && a !== document.body && a !== document.documentElement) || Date.now() - lastInput < IDLE_MS || document.hidden;
    }
    setInterval(function () {
      if (!isTvLayout()) { ind.textContent = ""; return; }
      if (paused()) { paint(true); return; }
      var next = box.scrollTop + box.clientHeight;
      box.scrollTo({ top: next >= box.scrollHeight - 4 ? 0 : next, behavior: "smooth" });
      setTimeout(function () { paint(false); }, 600);
    }, PAGE_MS);
    setInterval(function () { paint(paused()); }, 1000);
    window.NOAA_SUN_DEBUG = { sun: sun, isDaytime: isDaytime, geo: geo };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI);
  else initUI();
})();
