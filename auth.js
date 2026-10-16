/**
 * Portfolio Auth stub — designer UI layer (Firebase Email/Password).
 *
 * Admin injects config later via either:
 *   window.__FIREBASE_CONFIG__ = {
 *     apiKey: "…", authDomain: "….firebaseapp.com",
 *     projectId: "…", appId: "…"
 *   };
 * or a non-committed `firebase-config.js` that sets the same object.
 *
 * Until config is present, sign-in falls back to the local gate (localStorage).
 * No real apiKeys belong in this repo.
 */
(function (global) {
  "use strict";

  var LOCAL_USER = "danny";
  var LOCAL_PASS = "123";
  var AUTH_KEY = "portfolio-tracker-logged-in";
  var AUTH_EMAIL_KEY = "portfolio-tracker-auth-email";

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

  function isLoggedIn() {
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
    return global.localStorage.getItem(AUTH_EMAIL_KEY) || "";
  }

  /**
   * Local gate: username "danny" or email local-part danny, password "123".
   * Cloud path is a stub until admin wires Firebase Auth SDK.
   */
  function signIn(emailOrUser, password) {
    var id = String(emailOrUser || "").trim();
    var pass = String(password || "");
    if (!id || !pass) {
      return Promise.reject(new Error("请填写邮箱和密码"));
    }
    if (isCloudReady()) {
      // Placeholder for admin: firebase/auth signInWithEmailAndPassword
      return Promise.reject(
        new Error("云端登录已配置，请管理员接入 Firebase Auth SDK 后使用")
      );
    }
    var lower = id.toLowerCase();
    var localOk =
      (lower === LOCAL_USER ||
        lower === LOCAL_USER + "@local" ||
        lower.startsWith(LOCAL_USER + "@")) &&
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
    if (isCloudReady()) {
      // Placeholder: createUserWithEmailAndPassword
      return Promise.reject(
        new Error("云端注册已配置，请管理员接入 Firebase Auth SDK 后使用")
      );
    }
    return Promise.reject(
      new Error(
        "云端邮箱注册即将上线（Firebase）。当前请用本地门禁登录：danny / 123"
      )
    );
  }

  function resetPassword(email) {
    var em = String(email || "").trim();
    if (!em) {
      return Promise.reject(new Error("请填写注册邮箱"));
    }
    if (isCloudReady()) {
      // Placeholder: sendPasswordResetEmail
      return Promise.reject(
        new Error("云端重置已配置，请管理员接入 sendPasswordResetEmail")
      );
    }
    return Promise.reject(
      new Error("忘记密码将走邮箱重置；云端未接入前请联系看板管理员")
    );
  }

  function signOut() {
    setLoggedIn(false);
    return Promise.resolve({ mode: modeLabel() });
  }

  global.PortfolioAuth = {
    isCloudReady: isCloudReady,
    modeLabel: modeLabel,
    isLoggedIn: isLoggedIn,
    setLoggedIn: setLoggedIn,
    currentEmail: currentEmail,
    signIn: signIn,
    signUp: signUp,
    resetPassword: resetPassword,
    signOut: signOut,
    AUTH_KEY: AUTH_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
