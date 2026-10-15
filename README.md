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
