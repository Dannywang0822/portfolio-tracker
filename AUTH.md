# 认证与云端同步（Firebase）

> **当前状态（2026-10-16）：登录门控已关闭**（`auth.js` 中 `AUTH_GATE_ENABLED=false`）。
> 页面直接进入持仓；数据以本机 `localStorage` + 内置 `HOLDINGS` 为主。
> gstatic Firebase SDK 脚本已从 `index.html` 注释掉，避免国内网络卡住。
> 云端同步暂停；若要恢复：把 `AUTH_GATE_ENABLED` 设为 `true`，并取消注释 `index.html` 里的 gstatic + `firebase-config.js`。
> 公开注册保持关闭。

后端：**Firebase Authentication（Email/Password）+ Firestore holdings**。

## 项目

| 项 | 值 |
|----|----|
| Project ID | `danny-portfolio-tracker` |
| Auth | Email/Password（已开启） |
| 公开注册 | **已关闭**（Identity Platform `disabledUserSignup`） |
| 允许登录邮箱 | 仅 `oppodanny@gmail.com`（前端校验 + Auth 单用户） |
| Firestore | `(default)` · `asia-east1` |
| Web App | Portfolio Tracker |
| 配置文件 | `firebase-config.js`（网页公开配置，靠 Rules 保护数据） |

## 安全规则

路径：`users/{uid}/holdings/{holdingId}` — 仅本人可读写（见 `firestore.rules`）。

## 前端行为

- 有 `window.__FIREBASE_CONFIG__` 时：**只用 Firebase 登录**，本地 `danny/123` 门禁关闭
- **仅登录页**，无公开注册入口；非授权邮箱会被拒绝
- 登录后 `onSnapshot` 实时同步持仓改动（新增 / 编辑 / 删除）
- 内置行也可编辑删除：同 id 覆盖写入 Firestore；删除内置写 `deleted:true` 墓碑，多端隐藏
- 首次登录会把本机 `portfolio-custom-holdings` 迁移到云端（每 uid 一次）
- 内置默认值仍在 `index.html` 的 `HOLDINGS`；覆盖与纯手动仓走 Firestore
- 「忘记密码」仅允许向授权邮箱发重置邮件

## 授权域名

Firebase Console → Authentication → Settings → Authorized domains：

- `dannywang0822.github.io`
- `localhost`
- `*.firebaseapp.com` / `*.web.app`（默认）

## 你怎么用

1. 强刷看板（SW v33）
2. 用授权邮箱 `oppodanny@gmail.com` + 既定密码登录（密码由管理员在 Auth 控制台维护，**不写进仓库**）
3. 新增/编辑/删除手动仓 → 多端实时同步

## 相关文件

- `firebase-config.js` — 网页 SDK 配置
- `auth.js` — Auth + Firestore sync（含授权邮箱守卫）
- `firestore.rules` / `firebase.json`
- `index.html` — 登录门禁 UI + CRUD
- `sw.js` — shell v32
