# 持仓跟踪（H5）

极兔 `1519.HK`、拼多多 `PDD`、标普500/`SPY` 持仓面板。

## GitHub Pages（推荐）

1. 本仓库由 Actions 每约 15 分钟拉取 Yahoo 行情，写入 [`data/quotes.json`](data/quotes.json)。
2. 页面优先读这个 JSON，因此 **GitHub Pages 静态托管也能刷新数据**。
3. 开启 Pages：仓库 Settings → Pages → Source 选 **GitHub Actions** 或 **Deploy from branch `main` / root**（以你账号界面为准）。
4. **注意**：GitHub 免费账号的 **私有仓库默认不能开 Pages**（通常需要 GitHub Pro）。若开不了，可改公开仓库，或继续用本地 `python3 serve.py`。

私有仓库的 Pages 网址一般是：`https://<用户名>.github.io/<仓库名>/`（需登录且有仓库权限才能访问）。

## 本地预览

```bash
python3 serve.py
```

浏览器打开 `http://127.0.0.1:8765/`（不要用 `file://` 打开）。

## 手动刷新行情文件

```bash
python3 scripts/fetch_quotes.py
```
