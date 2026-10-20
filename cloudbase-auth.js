/**
 * CloudBase backend for PortfolioAuth (replaces the local gate API in auth.js
 * when cloud mode is detected). Username + password login, optional register
 * (email verification code), one document per user in collection
 * portfolio_holdings: { _id: uid, holdings: [...], updatedAt }.
 * localStorage "portfolio-custom-holdings" stays primary / offline cache.
 */
(function (global) {
  "use strict";
  var cfg = global.__CLOUDBASE_CONFIG__ || null;
  var MODE_KEY = "portfolio-cloud-mode";

  function detectCloud() {
    if (!cfg || !cfg.env) return false;
    try {
      var q = new URLSearchParams(global.location.search).get("cloud");
      if (q === "tcb") global.localStorage.setItem(MODE_KEY, "tcb");
      if (q === "off") global.localStorage.removeItem(MODE_KEY);
    } catch (e) { /* ignore */ }
    var host = String(global.location.hostname || "").toLowerCase();
    if (/(^|\.)tcloudbaseapp\.com$/.test(host)) return true;
    try { return global.localStorage.getItem(MODE_KEY) === "tcb"; } catch (e) { return false; }
  }

  if (!detectCloud()) return; // GitHub Pages etc.: leave auth.js local gate untouched.

  var AUTH_KEY = "portfolio-tracker-logged-in";
  var AUTH_USER_KEY = "portfolio-tracker-auth-email";
  var CUSTOM_KEY = "portfolio-custom-holdings";
  var COLLECTION = cfg.collection || "portfolio_holdings";

  var _app = null, _auth = null, _db = null, _sdkPromise = null;
  var _currentUser = null, _watcher = null, _authReady = null;
  var _cloudHoldings = [], _listeners = [], _pushTimer = null, _pendingSignUp = null;

  function loadSdk() {
    if (global.cloudbase) return Promise.resolve(global.cloudbase);
    if (_sdkPromise) return _sdkPromise;
    _sdkPromise = new Promise(function (resolve, reject) {
      var s = global.document.createElement("script");
      s.src = cfg.sdkUrl || "./vendor/cloudbase.full.js";
      s.onload = function () { global.cloudbase ? resolve(global.cloudbase) : reject(new Error("云开发 SDK 加载失败")); };
      s.onerror = function () { _sdkPromise = null; reject(new Error("云开发 SDK 加载失败，请检查网络")); };
      global.document.head.appendChild(s);
    });
    return _sdkPromise;
  }

  function ensure() {
    return loadSdk().then(function (cb) {
      if (!_app) {
        _app = cb.init({ env: cfg.env, region: cfg.region || "ap-shanghai" });
        _auth = _app.auth({ persistence: "local" });
        _db = _app.database();
      }
      return _auth;
    });
  }

  function errMsg(err, fallback) {
    var m = (err && (err.message || err.error_description || err.msg)) || "";
    if (/password|密码/i.test(m) && /invalid|incorrect|wrong|错误/i.test(m)) return "用户名或密码错误";
    if (/not.?found|不存在/i.test(m)) return "用户名或密码错误";
    if (/network|timeout|Failed to fetch/i.test(m)) return "网络异常，请检查网络后重试";
    if (/too many|频繁|limit/i.test(m)) return "尝试过多，请稍后再试";
    return m || fallback || "操作失败";
  }
  function unwrap(res, fallback) {
    if (res && res.error) throw new Error(errMsg(res.error, fallback));
    return res && res.data;
  }

  function uidOf(u) { return u ? String(u.id || u.uid || u.sub || "") : ""; }

  function setLoggedIn(on, name) {
    try {
      if (on) {
        global.localStorage.setItem(AUTH_KEY, "1");
        if (name) global.localStorage.setItem(AUTH_USER_KEY, String(name));
      } else {
        global.localStorage.removeItem(AUTH_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function normalizeRow(h) {
    var row = {
      id: String(h.id || ""),
      name: String(h.name || h.yahoo || ""),
      yahoo: String(h.yahoo || h.ticker || ""),
      ticker: String(h.yahoo || h.ticker || ""),
      shares: Number(h.shares) || 0,
      avgCost: Number(h.avgCost) || 0,
      currency: String(h.currency || "USD"),
      account: String(h.account || "futu"),
    };
    if (h.deleted) row.deleted = true;
    if (h.override) row.override = true;
    return row;
  }
  function readLocal() {
    try {
      var a = JSON.parse(global.localStorage.getItem(CUSTOM_KEY) || "[]");
      return Array.isArray(a) ? a.filter(function (h) { return h && h.id; }) : [];
    } catch (e) { return []; }
  }
  function writeLocal(list) {
    try { global.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }
  function notify() {
    var list = _cloudHoldings.slice();
    _listeners.forEach(function (fn) { try { fn(list); } catch (e) { /* ignore */ } });
  }
  function applyRemote(arr) {
    _cloudHoldings = (Array.isArray(arr) ? arr : []).map(function (h) {
      var r = normalizeRow(h); r.custom = true; return r;
    });
    writeLocal(_cloudHoldings.map(function (h) { var r = normalizeRow(h); return r; }));
    notify();
  }

  function docRef() {
    var uid = uidOf(_currentUser);
    if (!uid || !_db) throw new Error("未登录");
    return _db.collection(COLLECTION).doc(uid);
  }

  /** Push the whole local list (index.html already updated localStorage). */
  function pushNow() {
    var list = readLocal().map(normalizeRow);
    return docRef().set({ holdings: list, updatedAt: Date.now() }).then(function (res) {
      if (res && res.code) { var e = new Error(res.message || res.code); e.code = res.code; throw e; }
      _cloudHoldings = list;
      return true;
    });
  }
  function schedulePush() {
    return new Promise(function (resolve, reject) {
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(function () {
        pushNow().then(function (v) { setStatus("已保存到云端"); resolve(v); }, function (err) {
          console.warn("[PortfolioAuth/tcb] push failed", err);
          setStatus("保存到云端失败：" + cloudErrText(err) + "（已存本机）", "error");
          reject(err);
        });
      }, 400);
    });
  }

  function stopSync() {
    if (_watcher) { try { _watcher.close(); } catch (e) { /* ignore */ } _watcher = null; }
    _cloudHoldings = [];
  }

  /* ---- 同步状态（中文，显示在页面右下角，错误不再被吞掉） ---- */
  var _statusEl = null, _statusTimer = null;
  function setStatus(text, kind) {
    try {
      global.__PORTFOLIO_SYNC_STATUS__ = { text: text, kind: kind || "info", at: Date.now() };
      if (!global.document || !global.document.body) return;
      if (!_statusEl) {
        _statusEl = global.document.createElement("div");
        _statusEl.id = "cloudSyncStatus";
        _statusEl.setAttribute("role", "status");
        _statusEl.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:9999;max-width:80vw;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.4;background:rgba(0,0,0,.75);color:#fff;pointer-events:none;transition:opacity .3s";
        global.document.body.appendChild(_statusEl);
      }
      _statusEl.textContent = text;
      _statusEl.style.background = kind === "error" ? "rgba(180,30,30,.92)" : "rgba(0,0,0,.75)";
      _statusEl.style.opacity = "1";
      clearTimeout(_statusTimer);
      if (kind !== "error") _statusTimer = setTimeout(function () { if (_statusEl) _statusEl.style.opacity = "0"; }, 4000);
    } catch (e) { /* ignore */ }
  }
  function cloudErrText(err) {
    var code = (err && (err.code || err.errCode)) || "";
    var m = (err && (err.message || err.errMsg)) || String(err || "");
    if (/PERMISSION|permission|权限/i.test(code + m)) return "无权限写入云端（请检查集合权限）";
    if (/network|timeout|Failed to fetch/i.test(m)) return "网络异常";
    return (code ? code + " " : "") + m;
  }
  function isNotFound(err) {
    var s = (err && (err.code || "")) + " " + (err && err.message || "");
    return /DOCUMENT_NOT_FOUND|not.?found|不存在/i.test(s);
  }

  /** First-time seed: built-in holdings (as override rows) + this device's custom rows. */
  function seedList() {
    var custom = readLocal();
    var ids = {};
    custom.forEach(function (h) { ids[String(h.id)] = true; });
    var builtins = Array.isArray(global.__PORTFOLIO_BUILTIN_HOLDINGS__) ? global.__PORTFOLIO_BUILTIN_HOLDINGS__ : [];
    var rows = builtins.filter(function (b) { return b && b.id && !ids[String(b.id)]; })
      .map(function (b) { var r = normalizeRow(b); r.override = true; return r; });
    return rows.concat(custom.map(normalizeRow));
  }

  function startSync() {
    stopSync();
    var ref = docRef();
    setStatus("正在同步云端持仓…");
    return ref.get().then(function (res) {
      if (res && res.code) { var e = new Error(res.message || res.code); e.code = res.code; throw e; }
      return (res && res.data && res.data[0]) || null;
    }, function (err) {
      if (isNotFound(err)) return null; // v2 SDK: 文档不存在会直接 reject
      throw err;
    }).then(function (doc) {
      if (doc && Array.isArray(doc.holdings) && doc.holdings.length) {
        applyRemote(doc.holdings);
        setStatus("已从云端同步 " + doc.holdings.length + " 条持仓");
        return;
      }
      var list = seedList();
      writeLocal(list);
      return pushNow().then(function () {
        notify();
        setStatus("云端为空，已上传本机 " + list.length + " 条持仓");
      });
    }).catch(function (err) {
      console.warn("[PortfolioAuth/tcb] sync failed, using local cache", err);
      setStatus("云端同步失败：" + cloudErrText(err) + "（暂用本机数据）", "error");
    }).then(function () {
      try {
        _watcher = ref.watch({
          onChange: function (snap) {
            var d = snap && snap.docs && snap.docs[0];
            if (d && Array.isArray(d.holdings)) {
              var remote = JSON.stringify(d.holdings.map(normalizeRow));
              if (remote !== JSON.stringify(readLocal().map(normalizeRow))) applyRemote(d.holdings);
            }
          },
          onError: function (err) { console.warn("[PortfolioAuth/tcb] watch error", err); setStatus("云端实时同步中断：" + cloudErrText(err), "error"); },
        });
      } catch (e) { console.warn("[PortfolioAuth/tcb] watch unavailable", e); }
      return _cloudHoldings;
    });
  }

  function onSignedIn(user, name) {
    _currentUser = user;
    setLoggedIn(true, name || user.username || user.email || "");
    startSync().catch(function (e) { console.warn("[PortfolioAuth/tcb] sync", e); });
    return { mode: "cloud", email: currentEmail(), uid: uidOf(user) };
  }

  function currentEmail() {
    try { return global.localStorage.getItem(AUTH_USER_KEY) || ""; } catch (e) { return ""; }
  }

  function whenAuthReady(timeoutMs) {
    if (_authReady) return _authReady;
    var ms = timeoutMs > 0 ? timeoutMs : 8000;
    _authReady = new Promise(function (resolve) {
      var done = false;
      function finish(u) { if (!done) { done = true; resolve(u || null); } }
      setTimeout(function () { finish(_currentUser); }, ms);
      ensure().then(function (auth) { return auth.getSession(); }).then(function (res) {
        var s = res && res.data && res.data.session;
        var u = s && s.user;
        if (u && uidOf(u)) { onSignedIn(u); finish(u); }
        else { setLoggedIn(false); finish(null); }
      }).catch(function (e) {
        console.warn("[PortfolioAuth/tcb] auth ready", e);
        setLoggedIn(false); finish(null);
      });
    });
    return _authReady;
  }

  function validatePassword(p) {
    if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) {
      return "云开发密码至少 8 位，且需同时包含字母和数字";
    }
    return "";
  }

  function signIn(username, password) {
    var u = String(username || "").trim(), p = String(password || "");
    if (!u || !p) return Promise.reject(new Error("请填写用户名和密码"));
    return ensure().then(function (auth) {
      var params = u.indexOf("@") > 0 ? { email: u, password: p } : { username: u, password: p };
      return auth.signInWithPassword(params);
    }).then(function (res) {
      var d = unwrap(res, "登录失败");
      var user = (d && (d.user || (d.session && d.session.user))) || null;
      if (!user || !uidOf(user)) throw new Error("登录失败，请重试");
      return onSignedIn(user, u);
    });
  }

  /**
   * Register step 1: {username, email, password} → sends email verification code.
   * Register step 2: verifySignUp(code). CloudBase requires email/phone verification
   * for self sign-up; alternatively create users in 控制台 → 身份认证 → 用户管理.
   */
  function signUp(opts) {
    opts = opts || {};
    var username = String(opts.username || "").trim();
    var email = String(opts.email || "").trim();
    var password = String(opts.password || "");
    if (!username || !email || !password) return Promise.reject(new Error("请填写用户名、邮箱和密码"));
    if (!/^[A-Za-z][A-Za-z0-9_\-.]{3,31}$/.test(username)) {
      return Promise.reject(new Error("用户名需以字母开头，4–32 位字母/数字/_-."));
    }
    var pe = validatePassword(password);
    if (pe) return Promise.reject(new Error(pe));
    return ensure().then(function (auth) {
      return auth.signUp({ email: email, password: password, username: username });
    }).then(function (res) {
      var d = unwrap(res, "注册失败");
      if (d && typeof d.verifyOtp === "function") {
        _pendingSignUp = { verifyOtp: d.verifyOtp, username: username };
        return { needCode: true, email: email };
      }
      var user = d && (d.user || (d.session && d.session.user));
      if (user) return onSignedIn(user, username);
      return { needCode: false };
    });
  }

  function verifySignUp(code) {
    if (!_pendingSignUp) return Promise.reject(new Error("请先发送验证码"));
    var c = String(code || "").trim();
    if (!c) return Promise.reject(new Error("请填写验证码"));
    var p = _pendingSignUp;
    return Promise.resolve(p.verifyOtp({ token: c })).then(function (res) {
      var d = unwrap(res, "验证失败");
      var user = d && (d.user || (d.session && d.session.user));
      _pendingSignUp = null;
      if (!user) throw new Error("注册成功，请返回登录");
      return onSignedIn(user, p.username);
    });
  }

  function resetPassword() {
    return Promise.reject(new Error("云端账号请在腾讯云开发控制台 → 身份认证 → 用户管理 中重置密码"));
  }

  function signOut() {
    stopSync();
    _currentUser = null;
    _authReady = null;
    setLoggedIn(false);
    if (!_auth) return Promise.resolve({ mode: "cloud" });
    return Promise.resolve(_auth.signOut()).catch(function () {}).then(function () { return { mode: "cloud" }; });
  }

  global.PortfolioAuth = {
    backend: "tcb",
    isAuthGateEnabled: function () { return true; },
    isCloudReady: function () { return true; },
    modeLabel: function () { return "cloud"; },
    isLoggedIn: function () { return !!_currentUser; },
    setLoggedIn: setLoggedIn,
    currentEmail: currentEmail,
    currentUid: function () { return uidOf(_currentUser) || null; },
    allowedEmail: function () { return ""; },
    signIn: signIn,
    signUp: signUp,
    verifySignUp: verifySignUp,
    validatePassword: validatePassword,
    resetPassword: resetPassword,
    signOut: signOut,
    whenAuthReady: whenAuthReady,
    getCloudHoldings: function () { return _cloudHoldings.slice(); },
    onHoldingsChange: function (fn) {
      if (typeof fn !== "function") return function () {};
      _listeners.push(fn);
      return function () { _listeners = _listeners.filter(function (x) { return x !== fn; }); };
    },
    upsertHolding: function () { return schedulePush(); },
    deleteHolding: function () { return schedulePush(); },
    startHoldingsSync: startSync,
    AUTH_KEY: AUTH_KEY,
    clearLegacyLocalAuth: function () { setLoggedIn(false); },
    boot: function () { whenAuthReady(); },
  };
  setTimeout(function () { global.PortfolioAuth.boot(); }, 0);
})(typeof window !== "undefined" ? window : globalThis);
