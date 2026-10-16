/**
 * Portfolio Auth + Firestore holdings sync (Firebase Email/Password).
 *
 * Config via window.__FIREBASE_CONFIG__ (see firebase-config.js).
 * When cloud config is present, local danny/123 gate is disabled.
 * Holdings path: users/{uid}/holdings/{holdingId}
 */
(function (global) {
  "use strict";

  var LOCAL_USER = "danny";
  var LOCAL_PASS = "123";
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
    if (isCloudReady() && _currentUser) return true;
    if (isCloudReady()) return false;
    return global.localStorage.getItem(AUTH_KEY) === "1";
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
    return {
      account: String(h.account || "futu"),
      yahoo: String(h.yahoo || h.ticker || ""),
      name: String(h.name || ""),
      shares: Number(h.shares) || 0,
      avgCost: Number(h.avgCost) || 0,
      currency: String(h.currency || "USD"),
      updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
    };
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
                    return {
                      id: h.id,
                      name: h.name,
                      yahoo: h.yahoo,
                      ticker: h.ticker,
                      shares: h.shares,
                      avgCost: h.avgCost,
                      currency: h.currency,
                      account: h.account,
                    };
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

  function whenAuthReady() {
    if (!isCloudReady()) return Promise.resolve(null);
    if (_authReady) return _authReady;
    _authReady = new Promise(function (resolve) {
      try {
        var auth = ensureFirebase();
        var settled = false;
        auth.onAuthStateChanged(function (user) {
          _currentUser = user || null;
          if (user) {
            setLoggedIn(true, user.email || "");
            startHoldingsSync(user.uid).then(function () {
              if (!settled) { settled = true; resolve(user); }
            });
          } else {
            stopHoldingsSync();
            setLoggedIn(false);
            if (!settled) { settled = true; resolve(null); }
          }
        });
      } catch (e) {
        resolve(null);
      }
    });
    return _authReady;
  }

  function signIn(emailOrUser, password) {
    var id = String(emailOrUser || "").trim();
    var pass = String(password || "");
    if (!id || !pass) {
      return Promise.reject(new Error("请填写邮箱和密码"));
    }
    if (isCloudReady()) {
      try { ensureFirebase(); } catch (e) { return Promise.reject(e); }
      return _auth
        .signInWithEmailAndPassword(id, pass)
        .then(function (cred) {
          _currentUser = cred.user;
          setLoggedIn(true, cred.user.email || id);
          return startHoldingsSync(cred.user.uid).then(function () {
            return { mode: "cloud", email: cred.user.email || id, uid: cred.user.uid };
          });
        })
        .catch(function (err) {
          return Promise.reject(new Error(mapAuthError(err)));
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

  function signUp(email, password, password2) {
    var em = String(email || "").trim();
    var p1 = String(password || "");
    var p2 = String(password2 || "");
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return Promise.reject(new Error("请填写有效邮箱"));
    }
    if (p1.length < 6) {
      return Promise.reject(new Error("密码至少 6 位"));
    }
    if (p1 !== p2) {
      return Promise.reject(new Error("两次密码不一致"));
    }
    if (!isCloudReady()) {
      return Promise.reject(
        new Error("云端邮箱注册即将上线（Firebase）。当前请用本地门禁登录：danny / 123")
      );
    }
    try { ensureFirebase(); } catch (e) { return Promise.reject(e); }
    return _auth
      .createUserWithEmailAndPassword(em, p1)
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
  }

  function resetPassword(email) {
    var em = String(email || "").trim();
    if (!em) {
      return Promise.reject(new Error("请填写注册邮箱"));
    }
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
    boot: boot,
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
