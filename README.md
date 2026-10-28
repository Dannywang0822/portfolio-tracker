# 持仓跟踪（H5 / PWA）

在线面板：**https://dannywang0822.github.io/portfolio-tracker/**

仓库：**https://github.com/Dannywang0822/portfolio-tracker**

## 项目背景

这是一个个人持仓跟踪面板，用来盯关心的标的，并按持仓股数和成本价估算盈亏，而不是接券商账户。

持仓可按券商账户分组（如富途、平安证券、招商永隆、中信国际等），同一标的可在不同账户各记一行、不合并。支持美股、港股、A 股；港股与 A 股报价会按汇率折算成美元，与美股在同一套汇总里查看。

一开始是单页 HTML，后来做成手机友好的 H5，并加上 PWA（可「添加到主屏幕」）。浏览器里直接请求 Yahoo 会被 CORS 拦住，所以线上改成：GitHub Actions 大约每 15 分钟拉一次行情，写入 `data/quotes.json`，页面优先读这个静态文件。

页面有轻量登录门禁，仅保存在本机浏览器，不构成真实服务端鉴权。

## 手动新增持仓

登录后，顶栏点 **＋新增**（在「刷新」旁边），填写名称、Yahoo 代码、股数、成本、币种、账户即可。

- 币种自动对应市场：USD→美股、HKD→港股、CNY→A股（与现有市场筛选一致）
- 手动持仓只保存在本机浏览器 `localStorage`，不会写入 GitHub 仓库
- 仅手动条目可编辑 / 删除；内置持仓仍由仓库维护
- **行情来源**：GitHub Actions 定时写入 `data/quotes.json`（内置列表 + `data/extra-symbols.json`）。浏览器读不到你的 localStorage，所以**新代码默认不在定时列表里**
- 页面会尝试用公共代理即时补拉缺失行情，并缓存到本机；若仍无现价，展开该卡片点 **「加入定时行情」**（会打开 GitHub Issue，标题形如 `watchlist: AAPL`），合并进 `extra-symbols.json` 后约 15 分钟内开始更新
- 也可以直接把 Yahoo 代码发给看板管理员，代为写入 `data/extra-symbols.json`
- **SPCX（SpaceX）**：定时行情键就是 Yahoo `SPCX`（Nasdaq，报价币种 USD）。chart 接口对 `SPACE` 和 `SPACEX` 返回 404，不能拿来替代。中信国际这行用 `SPCX`，和券商代码一致，卡片会正常出报价。
- **SPY**：标准 Yahoo 键 `SPY`（NYSE Arca 的 SPDR S&P 500 ETF，报价币种 USD）。

## 在线地址

- **网页（GitHub Pages）**：https://dannywang0822.github.io/portfolio-tracker/
- **源码仓库**：https://github.com/Dannywang0822/portfolio-tracker

行情更新后，刷新页面即可看到最新报价（Yahoo 本身可能有延迟）。

## 本地预览

需要实时代理 Yahoo（不依赖 Actions 的 JSON）时：

```bash
python3 serve.py
```

浏览器打开 `http://127.0.0.1:8765/`（不要用 `file://`）。

## 手动刷新行情文件

```bash
python3 scripts/fetch_quotes.py
```

会更新 `data/quotes.json`。线上由工作流 `.github/workflows/update-quotes.yml` 定时跑同样的脚本。

## 日盈亏（T0·三市收盘后）

**T0 定义**：美股常规交易时段收盘日（美东 16:00 后）。此时 A 股、港股对应日历交易日早已收盘，三市均结束，记为一笔官方日终市值。

- GitHub Actions（`.github/workflows/daily-pnl.yml`）工作日 **UTC 22:00 ≈ 上海 06:00** 拉行情并写入 `data/daily-pnl.json`
- 页面汇总区展示「日盈亏」三币种（USD/HKD/CNY），红涨绿跌
- 有连续两日 T0 快照时：日盈亏 = 当日 T0 总市值 − 上一 T0 总市值
- 仅有一日快照时：显示相对该 T0（或昨收估算）的市值变化，并标明引导/估算

手动生成快照：

```bash
python3 scripts/fetch_quotes.py
python3 scripts/snapshot_daily_pnl.py
```

## 腾讯云开发（CloudBase）部署 · 国内云端登录/同步

- 环境：`english-little-steps-d0a2b84764b`（ap-shanghai），配置见 `cloudbase-config.js`（只含公开 envId，无密钥）。
- SDK：已本地化为 `vendor/cloudbase.full.js`（来自 static.cloudbase.net），仅在云模式下按需加载。
- **云模式检测**：`location.hostname` 以 `tcloudbaseapp.com` 结尾时启用；也可用 `?cloud=tcb` 强制开启（存于 localStorage `portfolio-cloud-mode`，`?cloud=off` 关闭）。
  GitHub Pages 等其他域名保持原本机门禁（danny / 123），行为不变。
- 登录：用户名 + 密码（控制台需开启「用户名密码登录」）。注册需邮箱验证码（需开启邮箱登录）；也可在 控制台 → 身份认证 → 用户管理 直接新建用户。
  云开发密码至少 8 位，且同时含字母和数字。
- 数据：集合 **`portfolio_holdings`**，每个用户一个文档，`_id = 用户 uid`，字段 `{ holdings: [...], updatedAt }`。
  localStorage 仍是主数据/离线缓存：登录时拉取云端（云端为空则用本机数据初始化），每次增删改后整表推送，并用 `watch` 实时接收其他设备的修改。

### 安全规则（推荐，在 控制台 → 文档型数据库 → portfolio_holdings → 权限设置 → 自定义安全规则）

```json
{
  "read": "doc._openid == auth.openid || doc._id == auth.uid",
  "write": "doc._openid == auth.openid || doc._id == auth.uid"
}
```

即仅文档所有者可读写（Web SDK 写入时会自动带 `_openid` = 当前用户）。简单起见也可选预设「仅创建者可读写」。

### 发布到静态网站托管

- 控制台上传：云开发控制台 → 静态网站托管 → 文件管理 → 上传 `portfolio-tracker-cloudbase.zip` 解压后的全部文件到根目录。
- CLI：`npm i -g @cloudbase/cli`，`tcb login --apiKeyId <SecretId> --apiKey <SecretKey>`（或浏览器扫码 `tcb login`），
  然后 `tcb hosting deploy ./ -e english-little-steps-d0a2b84764b`。
- 访问：`https://english-little-steps-d0a2b84764b-1408940790.tcloudbaseapp.com/`
