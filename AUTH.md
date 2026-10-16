# 认证说明

> **当前状态（2026-10-16）：本机登录门禁已开启**（`auth.js` 中 `AUTH_GATE_ENABLED=true`）。
> **未加载 Firebase SDK**（`index.html` 中 gstatic 脚本仍注释），国内可直接打开。
> 用户名 `danny` / 密码 `123`；会话写在本机 `localStorage`，刷新保持登录，点「退出」清除。
> **持仓只保存在当前设备**，不做多端云同步。公开注册关闭。

若以后要恢复 Firebase 云端：取消注释 `index.html` 里的 gstatic + `firebase-config.js`，并保证控制台已关公开注册。

## 相关文件

- `auth.js` — 本机门禁（及休眠中的 Firebase 同步代码）
- `index.html` — 登录 UI（含密码小眼睛）+ CRUD
- `sw.js` — shell v37
