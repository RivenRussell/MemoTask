# MemoTask v3.1.0 发布说明

发布日期：2026-06-27

v3.1.0 是 MemoTask 的跨端体验增强版本。它保留 Cloudflare Worker + D1 作为统一后端，同时提供网页端、Windows 安装包和 Android APK 三种入口。

## 适合谁升级

- 同一个账号经常在 PC 和手机之间切换记录 Memo 的用户。
- 希望 Memo 发布后列表更快显示新内容的用户。
- 希望草稿保存更贴近真实输入状态的用户。
- 希望在 Memo 详情页更清楚浏览 Todo 列表的用户。

## 主要变化

同步和刷新：

- 引入 TanStack React Query 管理 Memo 列表、详情、草稿、历史、AI 设置和同步状态。
- 队列页新增手动刷新入口。
- 队列页打开时低频自动刷新。
- 窗口重新聚焦时刷新当前页面数据。
- 发布 Memo 后立即写入前端缓存，减少等待列表重新拉取的空窗期。
- 使用账号维度 query key，避免跨账号缓存串线。

登录和启动：

- 已登录启动时先进入应用 shell，再后台加载 Memo 数据。
- 登录成功后不再等待 Memo 列表完整加载才进入应用。
- 过期会话仍会被清理并回到登录页。

草稿体验：

- 无标题草稿优先用正文预览。
- 标题输入默认隐藏，AI 生成标题后可以继续修改。
- 发布时如果没有标题，会从正文自动派生标题。
- 草稿保存会尽量使用最新输入快照，减少旧保存响应覆盖新内容的情况。

Memo 详情页：

- 详情页先显示标题和摘要/正文，再显示 Todo 管理区。
- Todo 标题改为可自动增高的多行编辑控件，长 Todo 不再被单行裁切。
- Android 端滚动到底部时最后一条 Todo 不会被底部导航遮挡。

本地应用：

- Windows 端继续使用 Electron 打包为 NSIS 安装包。
- Android 端继续使用 Capacitor 打包为可手动安装 APK。
- 本地应用仍请求 `https://memotask.rrwks.cn` 上的 Cloudflare Worker API。

## 安装包

GitHub Release 应包含：

```text
MemoTask Setup 3.1.0.exe
app-release.apk
```

本地构建产物路径：

```text
release/desktop/MemoTask Setup 3.1.0.exe
android/app/build/outputs/apk/release/app-release.apk
```

## 升级方式

Windows：

1. 下载 `MemoTask Setup 3.1.0.exe`。
2. 直接运行安装包覆盖安装。
3. 如果 SmartScreen 提示未知发布者，选择“更多信息”后继续运行。

Android：

1. 下载 `app-release.apk`。
2. 允许未知来源安装。
3. 打开 APK 安装。
4. 如果提示签名冲突，先卸载旧版再安装新版。

数据说明：

- Memo、Todo、历史记录、账号和 AI 设置保存在 Cloudflare D1 中。
- 卸载本地应用不会删除云端账号数据。
- 本机未同步的失败草稿可能只存在于本地，卸载前应先确认已发布或重新载入草稿。

## Cloudflare 部署概要

MemoTask 使用单个 Cloudflare Worker：

```text
Web / Windows / Android
  |
  | HTTPS
  v
Cloudflare Worker
  |
  |-- Workers Assets
  |-- Hono API
  |-- Cloudflare D1
  |-- Resend Email
```

部署需要：

- Cloudflare Worker
- Cloudflare D1 数据库
- Worker Secrets：`APP_ENCRYPTION_KEY`、`EMAIL_API_KEY`、`EMAIL_FROM`、`APP_BASE_URL`
- Resend 发信域名
- 自定义域名，例如 `memotask.example.com`

详细步骤见 [Cloudflare 部署指南](cloudflare-setup.md)。

## 验证命令

发布前建议执行：

```bash
npm test
npm run build
npm run e2e
npm run desktop:build
npm run android:apk
git diff --check
```

发布后检查：

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

## 隐私和密钥

本次发布不应把以下内容提交到 Git：

- `.env`
- `.dev.vars`
- `.wrangler/`
- `dist/`
- `release/`
- `output/`
- `test-results/`
- Playwright 报告
- Android keystore
- 真实 Resend API Key
- 真实 AI API Key
- 真实 Cloudflare 账号私密信息

`wrangler.toml` 中的 D1 `database_id` 在公开仓库里使用占位符。部署到自己的 Cloudflare 账号时，需要填入自己的 D1 数据库编号。
