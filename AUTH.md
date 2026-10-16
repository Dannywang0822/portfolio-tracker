# 认证与云端同步（Firebase · 分工说明）

后端定为 **Firebase Authentication（Email/Password）+ Firestore holdings**，不是 Supabase。

## 设计师负责（本仓库已做）

- 登录 / 邮箱注册 / 忘记密码 **UI**（PWA 内全屏门禁 overlay）
- 加载态、错误态、赛博朋克视觉（`theme-cyberpunk.css` + 门禁样式）
- `auth.js` stub：检测 `window.__FIREBASE_CONFIG__`；未配置时回退本地门禁
- 持仓新增 / 编辑 / 删除弹窗文案与删除确认（本地 `localStorage` 仍可用）
- **不**提交真实 `apiKey` / 私密配置；示例见 `firebase-config.example.js`

本地门禁（过渡）：用户名 `danny`，密码 `123`（邮箱字段也可用 `danny@…`）。

## 管理员负责（待接）

1. 在 Firebase Console 创建项目，开启 **Email/Password** 登录。
2. 注入配置（二选一，**勿把真实密钥提交进 git**）：
   - 构建/托管时写入：
     ```js
     window.__FIREBASE_CONFIG__ = {
       apiKey: "…",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project",
       appId: "1:…:web:…",
       // optional: storageBucket, messagingSenderId, measurementId
     };
     ```
   - 或复制 `firebase-config.example.js` → `firebase-config.js`（已在 `.gitignore`），页面加载该脚本。
3. 接入 Firebase JS SDK（`firebase/app` + `firebase/auth` + `firebase/firestore`）：
   - Auth：`signInWithEmailAndPassword` / `createUserWithEmailAndPassword` / `sendPasswordResetEmail` / `signOut` / `onAuthStateChanged`
   - 会话就绪后调用现有 `showApp()` / `logout()`
4. Firestore `holdings` 集合建议字段：

| field      | type   | notes |
|------------|--------|-------|
| userId     | string | `auth.uid`，Security Rules 按此过滤 |
| account    | string | `futu` / `pingan` / `winglung` / `citic` |
| yahoo      | string | Yahoo 代码，如 `300629.SZ` |
| name       | string | 显示名 |
| shares     | number | 股数 |
| avgCost    | number | 成本均价（标的币种） |
| currency   | string | `USD` / `HKD` / `CNY` |
| updatedAt  | timestamp | optional |

文档 id：可用自动 id；唯一性建议 Rules/复合：`userId + account + yahoo`（跨券商同票分行）。

5. 前端 CRUD：登录后读写 Firestore；可先迁移 `localStorage` 的 `portfolio-custom-holdings`。
6. 授权域名：Firebase Auth → Authorized domains 加入 `dannywang0822.github.io` 与本地预览 host。

## 开放问题（需管理员确认）

- **邮箱验证**：注册后是否必须 `sendEmailVerification` 才可读写 holdings？
- **密码重置**邮件语言（中文）与发件显示名
- 旧本地门禁下线时机（云端稳定后删 `danny/123`）
- Firestore 是否用实时 `onSnapshot` 还是拉一次 + 手动刷新

## 相关文件

- `auth.js` — stub API（`__FIREBASE_CONFIG__`）
- `firebase-config.example.js` — 占位示例（无真实 key）
- `index.html` — 门禁 DOM + 持仓弹窗
- `theme-cyberpunk.css` — 霓虹主题
- `sw.js` — shell 缓存（含 `auth.js`）
