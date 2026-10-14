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
- 若代码尚未出现在 `data/quotes.json`，现价可能暂不可用，刷新时会尝试按现有行情路径补拉

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
