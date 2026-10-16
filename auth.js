/**
 * Portfolio Auth + Firestore holdings sync (Firebase Email/Password).
 *
 * Config via window.__FIREBASE_CONFIG__ (see firebase-config.js).
 * When cloud config is present, local danny/123 gate is disabled.
 * Holdings path: users/{uid}/holdings/{holdingId}
 * Same id as a built-in row = override; deleted:true = hide built-in across devices.
 */
(function (global) {
  "use strict";

  var LOCAL_USER = "danny";
  var LOCAL_PASS = "123";
  /** Sole allowed cloud login email (UI + client guard). Password never stored here. */
  var ALLOWED_EMAIL = "oppodanny@gmail.com";
  var AUTH_KEY = "portfolio-tracker-logged-in";
  var AUTH_EMAIL_KEY = "portfolio-tracker-auth-email";
  var CUSTOM_KEY = "portfolio-custom-holdings";
  var MIGRATED_KEY = "portfolio-custom-holdings-migrated-uid";

  var _auth = null;
  var _db = null;
  var _unsubHoldings = null;
  var _cloudHoldings = [];
  var _holdingsListeners = [];
  var _authReady = null;
  var _currentUser = null;

  function config() {
    return global.__FIREBASE_CONFIG__ || null;
  }

  function isCloudReady() {
    var c = config();
    return !!(
      c &&
      typeof c.apiKey === "string" &&
      c.apiKey &&
      typeof c.projectId === "string" &&
      c.projectId &&
      typeof c.authDomain === "string" &&
      c.authDomain
    );
  }

  function modeLabel() {
    return isCloudReady() ? "cloud" : "local";
  }

  function firebaseAvailable() {
    return !!(global.firebase && typeof global.firebase.initializeApp === "function");
  }

  function ensureFirebase() {
    if (!isCloudReady()) return null;
    if (!firebaseAvailable()) {
      throw new Error("Firebase SDK 未加载，请刷新页面重试");
    }
    if (!_auth) {
      try {
        if (!global.firebase.apps || !global.firebase.apps.length) {
          global.firebase.initializeApp(config());
        }
      } catch (e) {
        if (!/already exists/i.test(String(e && e.message))) throw e;
      }
      _auth = global.firebase.auth();
      _db = global.firebase.firestore();
    }
    return _auth;
  }

  function mapAuthError(err) {
    var code = (err && err.code) || "";
    var map = {
      "auth/invalid-email": "邮箱格式不正确",
      "auth/user-disabled": "该账号已被禁用",
      "auth/user-not-found": "邮箱或密码错误",
      "auth/wrong-password": "邮箱或密码错误",
      "auth/invalid-credential": "邮箱或密码错误",
      "auth/email-already-in-use": "该邮箱已注册，请直接登录",
      "auth/weak-password": "密码至少 6 位",
      "auth/too-many-requests": "尝试过多，请稍后再试",
      "auth/network-request-failed": "网络异常，请检查网络后重试",
      "auth/operation-not-allowed": "邮箱登录未开启，请联系管理员",
      "auth/missing-email": "请填写邮箱",
    };
    if (map[code]) return map[code];
    return (err && err.message) || "操作失败";
  }

  function isLoggedIn() {
    if (isCloudReady()) {
      /* Cloud mode: only a live Firebase user counts — never trust stale localStorage alone. */
      return !!_currentUser;
    }
    return global.localStorage.getItem(AUTH_KEY) === "1";
  }

  /** Drop pre-Firebase local gate flag so a missing SDK cannot skip the login UI. */
  function clearLegacyLocalAuth() {
    try {
      global.localStorage.removeItem(AUTH_KEY);
      global.localStorage.removeItem(AUTH_EMAIL_KEY);
    } catch (e) { /* ignore */ }
  }

  function setLoggedIn(on, email) {
    if (on) {
      global.localStorage.setItem(AUTH_KEY, "1");
      if (email) global.localStorage.setItem(AUTH_EMAIL_KEY, String(email));
    } else {
      global.localStorage.removeItem(AUTH_KEY);
      global.localStorage.removeItem(AUTH_EMAIL_KEY);
    }
  }

  function currentEmail() {
    if (_currentUser && _currentUser.email) return _currentUser.email;
    return global.localStorage.getItem(AUTH_EMAIL_KEY) || "";
  }

  function currentUid() {
    return _currentUser ? _currentUser.uid : null;
  }

  function holdingsCol(uid) {
    ensureFirebase();
    return _db.collection("users").doc(uid).collection("holdings");
  }

  function holdingToDoc(h) {
    var doc = {
      account: String(h.account || "futu"),
      yahoo: String(h.yahoo || h.ticker || ""),
      name: String(h.name || ""),
      shares: Number(h.shares) || 0,
      avgCost: Number(h.avgCost) || 0,
      currency: String(h.currency || "USD"),
      updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (h && h.deleted) doc.deleted = true;
    else doc.deleted = false;
    return doc;
  }

  function docToHolding(id, data) {
    data = data || {};
    return {
      id: String(id),
      name: String(data.name || data.yahoo || "未命名持仓"),
      ticker: String(data.yahoo || ""),
      yahoo: String(data.yahoo || ""),
      shares: Number(data.shares) || 0,
      avgCost: Number(data.avgCost) || 0,
      currency: String(data.currency || "USD"),
      account: String(data.account || "futu"),
      custom: true,
      deleted: !!data.deleted,
    };
  }

  function notifyHoldings() {
    var list = _cloudHoldings.slice();
    _holdingsListeners.forEach(function (fn) {
      try { fn(list); } catch (e) { /* ignore */ }
    });
  }

  function onHoldingsChange(fn) {
    if (typeof fn !== "function") return function () {};
    _holdingsListeners.push(fn);
    if (_cloudHoldings.length) {
      try { fn(_cloudHoldings.slice()); } catch (e) { /* ignore */ }
    }
    return function () {
      _holdingsListeners = _holdingsListeners.filter(function (x) { return x !== fn; });
    };
  }

  function getCloudHoldings() {
    return _cloudHoldings.slice();
  }

  function stopHoldingsSync() {
    if (_unsubHoldings) {
      try { _unsubHoldings(); } catch (e) { /* ignore */ }
      _unsubHoldings = null;
    }
    _cloudHoldings = [];
  }

  function migrateLocalIfNeeded(uid) {
    try {
      var flag = global.localStorage.getItem(MIGRATED_KEY);
      if (flag === uid) return Promise.resolve(0);
      var raw = global.localStorage.getItem(CUSTOM_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr) || !arr.length) {
        global.localStorage.setItem(MIGRATED_KEY, uid);
        return Promise.resolve(0);
      }
      var col = holdingsCol(uid);
      var batch = _db.batch();
      var n = 0;
      arr.forEach(function (h) {
        if (!h || typeof h !== "object") return;
        var id = h.id ? String(h.id) : col.doc().id;
        batch.set(col.doc(id), holdingToDoc(h), { merge: true });
        n++;
      });
      if (!n) {
        global.localStorage.setItem(MIGRATED_KEY, uid);
        return Promise.resolve(0);
      }
      return batch.commit().then(function () {
        global.localStorage.setItem(MIGRATED_KEY, uid);
        return n;
      });
    } catch (e) {
      return Promise.resolve(0);
    }
  }

  function startHoldingsSync(uid) {
    stopHoldingsSync();
    ensureFirebase();
    return migrateLocalIfNeeded(uid).then(function () {
      return new Promise(function (resolve) {
        var first = true;
        _unsubHoldings = holdingsCol(uid).onSnapshot(
          function (snap) {
            _cloudHoldings = [];
            snap.forEach(function (doc) {
              _cloudHoldings.push(docToHolding(doc.id, doc.data()));
            });
            try {
              global.localStorage.setItem(
                CUSTOM_KEY,
                JSON.stringify(
                  _cloudHoldings.map(function (h) {
                    var row = {
                      id: h.id,
                      name: h.name,
                      yahoo: h.yahoo,
                      ticker: h.ticker,
                      shares: h.shares,
                      avgCost: h.avgCost,
                      currency: h.currency,
                      account: h.account,
                    };
                    if (h.deleted) row.deleted = true;
                    return row;
                  })
                )
              );
            } catch (e) { /* ignore */ }
            notifyHoldings();
            if (first) {
              first = false;
              resolve(_cloudHoldings);
            }
          },
          function (err) {
            console.warn("[PortfolioAuth] holdings sync error", err);
            if (first) {
              first = false;
              resolve(_cloudHoldings);
            }
          }
        );
      });
    });
  }

  function upsertHolding(payload) {
    var uid = currentUid();
    if (!uid) return Promise.reject(new Error("未登录"));
    ensureFirebase();
    var id = payload.id ? String(payload.id) : holdingsCol(uid).doc().id;
    return holdingsCol(uid)
      .doc(id)
      .set(holdingToDoc(payload), { merge: true })
      .then(function () { return id; });
  }

  function deleteHolding(id) {
    var uid = currentUid();
    if (!uid) return Promise.reject(new Error("未登录"));
    ensureFirebase();
    return holdingsCol(uid).doc(String(id)).delete();
  }

  function whenAuthReady(timeoutMs) {
    if (!isCloudReady()) return Promise.resolve(null);
    if (!firebaseAvailable()) {
      clearLegacyLocalAuth();
      return Promise.resolve(null);
    }
    if (_authReady) return _authReady;
    var ms = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 8000;
    _authReady = new Promise(function (resolve) {
      var settled = false;
      function finish(user) {
        if (settled) return;
        settled = true;
        resolve(user || null);
      }
      try {
        var auth = ensureFirebase();
        auth.onAuthStateChanged(function (user) {
          _currentUser = user || null;
          if (user) {
            setLoggedIn(true, user.email || "");
            /* Do not block the login UI on Firestore — sync in background. */
            startHoldingsSync(user.uid).catch(function (err) {
              console.warn("[PortfolioAuth] holdings sync", err);
            });
            finish(user);
          } else {
            stopHoldingsSync();
            setLoggedIn(false);
            clearLegacyLocalAuth();
            finish(null);
          }
        });
        setTimeout(function () {
          if (!settled) {
            console.warn("[PortfolioAuth] auth ready timeout — showing login");
            if (!_currentUser) clearLegacyLocalAuth();
            finish(_currentUser);
          }
        }, ms);
      } catch (e) {
        clearLegacyLocalAuth();
        finish(null);
      }
    });
    return _authReady;
  }


  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function assertAllowedEmail(email) {
    var em = normalizeEmail(email);
    if (em !== ALLOWED_EMAIL) {
      return Promise.reject(new Error("仅允许授权账号登录（" + ALLOWED_EMAIL + "）"));
    }
    return Promise.resolve(em);
  }

  function signIn(emailOrUser, password) {
    var id = String(emailOrUser || "").trim();
    var pass = String(password || "");
    if (!id || !pass) {
      return Promise.reject(new Error("请填写邮箱和密码"));
    }
    if (isCloudReady()) {
      return assertAllowedEmail(id).then(function (em) {
        try { ensureFirebase(); } catch (e) { return Promise.reject(e); }
        return _auth
          .signInWithEmailAndPassword(em, pass)
        .then(function (cred) {
          _currentUser = cred.user;
          setLoggedIn(true, cred.user.email || em);
          return startHoldingsSync(cred.user.uid).then(function () {
            return { mode: "cloud", email: cred.user.email || em, uid: cred.user.uid };
          });
        })
        .catch(function (err) {
          return Promise.reject(new Error(mapAuthError(err)));
        });
      });
    }
    var lower = id.toLowerCase();
    var localOk =
      (lower === LOCAL_USER ||
        lower === LOCAL_USER + "@local" ||
        lower.indexOf(LOCAL_USER + "@") === 0) &&
      pass === LOCAL_PASS;
    if (!localOk) localOk = id === LOCAL_USER && pass === LOCAL_PASS;
    if (!localOk) {
      return Promise.reject(new Error("邮箱或密码错误"));
    }
    setLoggedIn(true, id);
    return Promise.resolve({ mode: "local", email: id });
  }

  function signUp() {
    return Promise.reject(new Error("本看板已关闭公开注册，仅授权账号可登录"));
  }

  function resetPassword(email) {
    var raw = String(email || "").trim();
    if (!raw) {
      return Promise.reject(new Error("请填写授权邮箱"));
    }
    return assertAllowedEmail(raw).then(function (em) {
      if (!isCloudReady()) {
        return Promise.reject(
          new Error("忘记密码将走邮箱重置；云端未接入前请联系看板管理员")
        );
      }
      try { ensureFirebase(); } catch (e) { return Promise.reject(e); }
      return _auth
        .sendPasswordResetEmail(em)
        .then(function () { return { ok: true, email: em }; })
        .catch(function (err) {
          return Promise.reject(new Error(mapAuthError(err)));
        });
    });
  }

  function signOut() {
    stopHoldingsSync();
    _currentUser = null;
    setLoggedIn(false);
    if (isCloudReady() && _auth) {
      return _auth.signOut().then(function () {
        return { mode: "cloud" };
      }).catch(function () {
        return { mode: "cloud" };
      });
    }
    return Promise.resolve({ mode: modeLabel() });
  }

  function boot() {
    if (!isCloudReady() || !firebaseAvailable()) return;
    try { whenAuthReady(); } catch (e) {
      console.warn("[PortfolioAuth] boot", e);
    }
  }

  global.PortfolioAuth = {
    isCloudReady: isCloudReady,
    modeLabel: modeLabel,
    isLoggedIn: isLoggedIn,
    setLoggedIn: setLoggedIn,
    currentEmail: currentEmail,
    currentUid: currentUid,
    allowedEmail: function () { return ALLOWED_EMAIL; },
    signIn: signIn,
    signUp: signUp,
    resetPassword: resetPassword,
    signOut: signOut,
    whenAuthReady: whenAuthReady,
    getCloudHoldings: getCloudHoldings,
    onHoldingsChange: onHoldingsChange,
    upsertHolding: upsertHolding,
    deleteHolding: deleteHolding,
    startHoldingsSync: startHoldingsSync,
    AUTH_KEY: AUTH_KEY,
    clearLegacyLocalAuth: clearLegacyLocalAuth,
    boot: boot,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
