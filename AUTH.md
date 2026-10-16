# 认证与云端同步（Firebase）

后端：**Firebase Authentication（Email/Password）+ Firestore holdings**。

## 项目

| 项 | 值 |
|----|----|
| Project ID | `danny-portfolio-tracker` |
| Auth | Email/Password（已开启） |
| Firestore | `(default)` · `asia-east1` |
| Web App | Portfolio Tracker |
| 配置文件 | `firebase-config.js`（网页公开配置，靠 Rules 保护数据） |

## 安全规则

路径：`users/{uid}/holdings/{holdingId}` — 仅本人可读写（见 `firestore.rules`）。

## 前端行为

- 有 `window.__FIREBASE_CONFIG__` 时：**只用 Firebase 登录**，本地 `danny/123` 门禁关闭
- 登录/注册后 `onSnapshot` 实时同步手动持仓
- 首次登录会把本机 `portfolio-custom-holdings` 迁移到云端（每 uid 一次）
- 内置持仓仍在 `index.html` 的 `HOLDINGS`；手动仓走 Firestore

## 授权域名（需控制台确认）

Firebase Console → Authentication → Settings → Authorized domains，确保有：

- `dannywang0822.github.io`
- `localhost`（本地预览）

默认通常已含 `localhost` 与 `*.firebaseapp.com`；**GitHub Pages 域名需手动添加**。

## 你怎么用

1. 强刷看板（SW v29）
2. 用邮箱注册（建议 `oppodanny@gmail.com`）并设密码（≥6 位）
3. 新增/编辑/删除手动仓 → 多端实时同步
4. 忘记密码走邮箱重置

## 相关文件

- `firebase-config.js` — 网页 SDK 配置
- `auth.js` — Auth + Firestore sync
- `firestore.rules` / `firebase.json`
- `index.html` — 门禁 UI + CRUD
- `sw.js` — shell v29
