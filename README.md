# 持仓跟踪（H5 / PWA）

在线面板：**https://dannywang0822.github.io/portfolio-tracker/**

仓库：**https://github.com/Dannywang0822/portfolio-tracker**

## 项目背景

这是一个个人持仓跟踪面板，用来盯关心的标的，并按持仓股数和成本价估算盈亏，而不是接券商账户。

当前跟踪（含平安证券账户等）：

| 标的 | 代码 | 持仓 | 成本均价 | 账户/备注 |
|------|------|------|----------|-----------|
| 极兔速递（J&T Express） | `1519.HK` | 1,000,000 股 | HKD 9 | — |
| 拼多多 | `PDD` | 500,000 股 | USD 80 | — |
| 标普500（用 ETF 跟踪） | `SPY` | 10,000 股 | USD 600 | 美股 ETF |
| 中国宝安 | `000009.SZ` | 100 股 | CNY 17.835 | — |
| ST利源 | `002501.SZ` | 285,900 股 | CNY 2.4979 | — |
| 贝肯能源 | `002828.SZ` | 2,000 股 | CNY 14.9649 | — |
| 智能汽车LOF | `161033.SZ` | 100 份 | CNY 1.886 | — |
| 科隆股份 | `300405.SZ` | 130 股 | CNY 7.1923 | — |
| 新劲刚 | `300629.SZ` | 29,100 股 | CNY 31.3016 | 平安证券 |
| 消费ETF招商 | `510150.SS` | 173,400 份 | CNY 0.8322 | 平安证券 |
| 标普500ETF博时 | `513500.SS` | 10,000 份 | CNY 2.4294 | 平安证券（A 股标普500，与 SPY 分开计） |
| 科技ETF华宝 | `515000.SS` | 200 份 | CNY 0.925 | 平安证券 |
| 新能源车ETF华夏 | `515030.SS` | 12,000 份 | CNY 2.6465 | 平安证券 |
| 食品饮料ETF华宝 | `515710.SS` | 479,600 份 | CNY 1.0493 | 平安证券 |
| 贵州茅台 | `600519.SS` | 800 股 | CNY 1618.4172 | 平安证券 |
| 隆基绿能 | `601012.SS` | 140 股 | CNY 62.8741 | 平安证券 |
| 创梦天地 | `1119.HK` | 8,400 股 | HKD 7.799 | 平安证券 |

港股用 Yahoo 的 `USDHKD=X`、A 股用 `USDCNY=X` 折算成美元，和美股持仓在同一套汇总里看。`SPY`（美股）与 `513500.SS`（博时标普500 ETF）同时保留，互不替代。

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
