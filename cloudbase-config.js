/**
 * Tencent CloudBase (腾讯云开发) config — public identifiers only, no secrets.
 * Cloud mode activates ONLY on *.tcloudbaseapp.com (CloudBase 静态托管),
 * or when forced with ?cloud=tcb (persisted in localStorage "portfolio-cloud-mode";
 * ?cloud=off clears it). GitHub Pages keeps the local danny/123 gate.
 */
window.__CLOUDBASE_CONFIG__ = {
  env: "english-little-steps-d0a2b84764b",
  region: "ap-shanghai",
  collection: "portfolio_holdings",
  sdkUrl: "./vendor/cloudbase.full.js",
};
