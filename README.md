# 持仓跟踪（H5 / PWA）

在线面板：**https://dannywang0822.github.io/portfolio-tracker/**

仓库：**https://github.com/Dannywang0822/portfolio-tracker**

## 项目背景

这是一个个人持仓跟踪面板，用来盯几只关心的标的，并按持仓股数和成本价估算盈亏，而不是接券商账户。

当前跟踪：

| 标的 | 代码 | 持仓 | 成本均价 |
|------|------|------|----------|
| 极兔速递（J&T Express） | `1519.HK` | 1,000,000 股 | HKD 9 |
| 拼多多 | `PDD` | 500,000 股 | USD 80 |
| 标普500（用 ETF 跟踪） | `SPY` | 10,000 股 | USD 600 |
| 中国宝安 | `000009.SZ` | 100 股 | CNY 17.835 |
| ST利源 | `002501.SZ` | 285,900 股 | CNY 2.4979 |

港股用 Yahoo 的 `USDHKD=X`、A 股用 `USDCNY=X` 折算成美元，和美股持仓在同一套汇总里看。

一开始是单页 HTML，后来做成手机友好的 H5，并加上 PWA（可「添加到主屏幕」）。浏览器里直接请求 Yahoo 会被 CORS 拦住，所以线上改成：GitHub Actions 大约每 15 分钟拉一次行情，写入 `data/quotes.json`，页面优先读这个静态文件。

页面有轻量登录门禁（默认用户名 `danny`），仅保存在本机浏览器，不构成真实服务端鉴权。

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
