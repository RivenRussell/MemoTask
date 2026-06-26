# MemoTask

MemoTask 是一个低压力的个人 Memo 待办整理工具。它的核心思路很简单：先把脑子里的想法、计划、链接、琐事写成一条 Memo，再让人工智能把这条 Memo 内部拆成可执行的待办项。用户不需要一开始就想清楚分类、日期和提醒，只需要先记录，再整理。

当前版本为 **v3.1.0**。这个版本继续保留 Windows 桌面安装包和 Android APK，并重点优化跨端 Memo 同步、登录启动速度和草稿记录体验。

生产访问地址：

```text
https://memotask.rrwks.cn/login
```

## 版本重点

v3.1.0 延续 v3 的“网页、Windows 桌面端、Android APK”三种入口。桌面端和 Android 端会把 React 构建产物打包到本地应用内，接口仍请求同一个 Cloudflare Worker 和 D1 后端；前端 server state 由 TanStack React Query 管理，用手动刷新、窗口聚焦刷新和队列低频轮询保持 PC/Android 列表同步。

主要能力：

- 支持邮箱和密码注册账号。
- 注册后通过邮箱验证码完成验证。
- 支持登录、退出登录和保持登录状态。
- 支持忘记密码与邮件重置密码。
- 使用 HttpOnly 会话 Cookie 保存登录态，降低前端脚本读取登录凭据的风险。
- 所有 Memo 数据按用户隔离，不同账号互相不可见。
- 每个用户拥有独立的人工智能接口设置、提示词和加密后的接口密钥。
- 前端、后端和静态资源统一部署在同一个 Cloudflare Worker。
- Cloudflare D1 保存账号、会话、Memo、待办、历史记录、草稿、撤销记录和同步状态。
- Resend 负责发送注册验证和密码重置邮件。
- Windows 端通过 Electron 打包为 `.exe` 安装包。
- Android 端通过 Capacitor 打包为可侧载 APK。
- 桌面端支持托盘、`Ctrl + Alt + M` 快捷键、快速记录窗口和系统通知。
- Android 端支持从其他 App 分享文本或链接到 MemoTask。
- 队列页支持手动刷新，并在页面打开时低频自动刷新，适合同一账号在手机和电脑同时记录。
- 登录和已登录启动不等待 Memo 列表加载完成，先进入应用界面再后台同步数据。
- 草稿优先展示正文预览；标题输入默认隐藏，AI 生成标题后可继续手动修改。
- 发布失败时会保留本地草稿，避免记录内容丢失。

## 产品理念

MemoTask 不想成为一个复杂项目管理系统。它刻意不做日期压力、提醒轰炸、团队权限、订阅付费、看板模板和营销页面。

它只围绕一个日常闭环：

```text
写下 Memo
-> 可选使用人工智能整理
-> 编辑待办草稿
-> 发布到 Memo 队列
-> 按顺序处理待办
-> 完成或归档后进入历史记录
```

Memo 是主要容器，Todo 永远属于某条 Memo。Memo 在队列里的前后顺序就是优先级：越靠前越应该先处理，越靠后就暂时放着。这样可以避免“今日任务过期后越积越多”的压力。

## 功能清单

账号功能：

- 邮箱注册。
- 邮箱验证码验证。
- 邮箱密码登录。
- 退出登录。
- 忘记密码。
- 密码重置。
- 登录态检查。
- 会话过期处理。

Memo 功能：

- 快速记录原始 Memo。
- 草稿自动保存。
- 最近草稿恢复。
- 草稿列表在没有显式标题时使用正文作为预览。
- AI 分析后显示可编辑标题；未手动填写标题时发布会从正文自动生成标题。
- 发布 Memo 到队列。
- Memo 队列排序。
- 上移、下移和拖拽排序。
- Memo 详情编辑。
- Memo 手动归档。
- Todo 新增、编辑、删除、勾选和排序。
- 所有 Todo 完成后自动归档 Memo。

人工智能功能：

- 在设置页配置人工智能接口地址。
- 配置模型名称。
- 保存接口密钥。
- 编辑提示词模板。
- 恢复默认提示词。
- 测试接口连接。
- 从草稿中生成 Memo 标题和 Todo 草稿。
- 接口密钥保存前会在 Worker 内加密。
- 前端和导出数据不会返回完整接口密钥。

历史与导出：

- 历史记录列表。
- 历史记录搜索。
- 恢复历史 Memo。
- 批量软删除历史 Memo。
- 短时间撤销删除。
- 导出 JSON 数据。

跨端体验：

- 手机端和电脑端共用同一套账号数据。
- 队列页提供“刷新队列”操作。
- 已登录客户端重新聚焦或保持队列页打开时会自动刷新 Memo 列表。
- 响应式布局适配安卓手机和桌面浏览器。
- 生产环境通过 Cloudflare 自定义域名访问。
- Windows 桌面端安装后可从托盘或 `Ctrl + Alt + M` 快速打开记录窗口。
- Android 端可从系统分享菜单接收 `text/plain` 文本和链接。
- 网络异常导致发布失败时，记录内容会进入本地草稿列表，稍后可重新载入。
- Memo 详情页优先显示标题和摘要，再显示 Todo 列表；长 Todo 会自动换行，移动端滚动到底部也能看到最后一条 Todo。

## 下载与安装

v3.1.0 的安装包会放在 GitHub Releases 的 `v3.1.0` 页面中：

- Windows：`MemoTask Setup 3.1.0.exe`
- Android：`app-release.apk`

Windows 安装：

1. 下载 `MemoTask Setup 3.1.0.exe`。
2. 双击安装。
3. 如果 Windows SmartScreen 提示未知发布者，选择“更多信息”后再选择“仍要运行”。
4. 安装完成后从开始菜单、桌面快捷方式或系统托盘打开 MemoTask。

Android 安装：

1. 下载 `app-release.apk` 到手机。
2. 在系统设置中允许当前文件管理器或浏览器“安装未知来源应用”。
3. 打开 APK 并安装。
4. 如果提示签名冲突，先卸载旧版 MemoTask，再安装新版。Memo 数据保存在 Cloudflare D1 中，账号数据不会因为卸载本地应用而删除；但本机未同步的失败草稿可能会随卸载丢失。

网页端不需要安装，访问生产地址即可：

```text
https://memotask.rrwks.cn/login
```

## 技术架构

MemoTask 是一个单 Worker 应用。React 构建后的静态文件由 Cloudflare Workers Assets 托管，接口请求由同一个 Worker 中的 Hono 路由处理，持久化数据保存在 Cloudflare D1。

```text
浏览器
  |
  | 访问页面和 /api/*
  v
Cloudflare Worker
  |
  |-- Workers Assets：托管前端构建产物
  |-- Hono：处理接口路由
  |-- D1Repository：生产数据库访问
  |-- AuthRepository：账号、会话和令牌访问
  |-- EmailSender：通过 Resend 发送邮件
  |
  v
Cloudflare D1
```

主要技术：

- React
- TypeScript
- Vite
- Hono
- Cloudflare Workers
- Cloudflare Workers Assets
- Cloudflare D1
- Electron
- electron-builder
- Capacitor Android
- Wrangler
- Vitest
- Testing Library
- Playwright
- dnd-kit
- lucide-react

## 目录结构

```text
src/                  前端应用、页面、组件、状态和样式
worker/               Cloudflare Worker、接口、领域逻辑和仓储实现
worker/auth/          账号、密码、令牌、会话和邮件发送逻辑
worker/repository/    D1 与内存仓储实现
migrations/           Cloudflare D1 数据库迁移
tests/api/            Worker 接口和仓储测试
tests/ui/             React 页面与交互测试
tests/electron/       Electron 打包配置测试
tests/android/        Android/Capacitor 配置测试
tests/native/         跨端原生桥接测试
tests/e2e/            Playwright 端到端和视觉检查
docs/                 核心中文文档
```

## 本地运行

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

启动本地 Worker：

```bash
npm run worker:dev
```

执行本地 D1 迁移：

```bash
npm run db:migrate:local
```

## 环境变量

生产环境需要在 Cloudflare Worker 中配置这些密钥或变量：

| 名称 | 用途 |
| --- | --- |
| `APP_ENCRYPTION_KEY` | 用于加密用户保存的人工智能接口密钥 |
| `EMAIL_API_KEY` | Resend 发信接口密钥 |
| `EMAIL_FROM` | 发件人，例如 `MemoTask <noreply@notify.example.com>` |
| `APP_BASE_URL` | 应用公网地址，例如 `https://memotask.example.com` |

配置命令：

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
```

本地开发可以使用 `.dev.vars`，但不要提交到 Git：

```text
APP_ENCRYPTION_KEY=replace-with-a-long-random-secret
EMAIL_API_KEY=replace-with-resend-api-key
EMAIL_FROM=MemoTask <noreply@notify.example.com>
APP_BASE_URL=http://127.0.0.1:8787
```

仓库中的 `.env.example` 只保留占位示例，不包含真实密钥。

## 数据库

D1 迁移文件：

```text
migrations/0001_initial.sql
migrations/0002_auth.sql
```

主要数据表：

- `users`
- `sessions`
- `email_verification_tokens`
- `password_reset_tokens`
- `memos`
- `memo_todos`
- `ai_settings`
- `undo_operations`
- `sync_meta`

远程迁移命令：

```bash
npm run db:migrate:remote
```

查看远程表结构：

```bash
npx wrangler d1 execute memotask-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## 测试与构建

运行全部测试：

```bash
npm test
```

只运行接口测试：

```bash
npm run test:api
```

只运行前端测试：

```bash
npm run test:ui
```

执行生产构建：

```bash
npm run build
```

执行 Web 构建：

```bash
npm run build:web
```

构建 Windows 桌面安装包：

```bash
npm run desktop:build
```

产物位置：

```text
release/desktop/MemoTask Setup 3.1.0.exe
```

构建 Android APK：

```bash
npm run android:apk
```

产物位置：

```text
android/app/build/outputs/apk/release/app-release.apk
```

Android 构建需要 JDK 11 或更新版本。`scripts/build-android-apk.ps1` 会优先使用本机 JDK 21 或 Android Studio JBR，避免系统默认 Java 8 导致 Gradle 构建失败。当前 APK 用于手动侧载，release 构建使用本机调试签名配置生成；后续公开分发时可替换为私有 keystore。

运行 Playwright 检查：

```bash
npm run e2e
```

## 部署流程

部署前先构建：

```bash
npm run build
```

执行远程数据库迁移：

```bash
npm run db:migrate:remote
```

部署 Worker 和静态资源：

```bash
npm run worker:deploy
```

部署后检查：

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

期望结果：

```text
{"ok":true}
```

Cloudflare 的详细配置见 [Cloudflare 部署指南](docs/cloudflare-setup.md)。

## v3 应用打包说明

Windows 桌面端：

- 使用 Electron 加载本地打包的 `dist` 静态文件。
- 应用启动时通过本机 `127.0.0.1` 临时服务提供静态资源，避免 `file://` 场景下的跨域和路由问题。
- 接口请求指向 `https://memotask.rrwks.cn/api/*`。
- 登录态使用 Worker 返回的 app session token，避免削弱网页端 HttpOnly Cookie 安全模型。
- 支持系统托盘、快速记录窗口、`Ctrl + Alt + M` 快捷键和系统通知。

Android 端：

- 使用 Capacitor 打包 `dist` 到 Android WebView。
- APK 不用于上架，只用于手动安装。
- 接口请求指向 `https://memotask.rrwks.cn/api/*`。
- 支持系统分享菜单接收文本和链接。
- 支持 Android 返回键：记录、设置、历史和详情页优先返回队列页。

## GitHub Release 资产

不要把安装包或 APK 直接提交到 Git。源码仓库只保存可复现构建所需的核心代码、配置、迁移、测试和文档。

发布时应将这些文件上传到 GitHub Releases：

```text
release/desktop/MemoTask Setup 3.1.0.exe
android/app/build/outputs/apk/release/app-release.apk
```

当前 `.gitignore` 会忽略 `release/`、`dist/`、`output/`、`.wrangler/`、测试输出和本地环境文件。Android 子目录还会忽略 APK、AAB、keystore、本机 SDK 路径和 Capacitor 生成的 WebView 静态资源。

## 主要接口

健康检查：

```text
GET /api/health
```

账号接口：

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/verify-email
POST /api/auth/resend-verification
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

Memo 与 Todo 接口：

```text
POST   /api/drafts
GET    /api/drafts/recent
PATCH  /api/drafts/:id
POST   /api/memos/publish
GET    /api/memos
GET    /api/memos/:id
PATCH  /api/memos/:id
POST   /api/memos/:id/archive
POST   /api/memos/:id/restore
POST   /api/memos/reorder
POST   /api/memos/:memoId/todos
POST   /api/todos/:id/toggle
PATCH  /api/todos/:id
DELETE /api/todos/:id
POST   /api/todos/reorder
```

历史、导出和同步接口：

```text
GET  /api/history
GET  /api/history/search
POST /api/history/bulk-delete
POST /api/history/undo-delete
GET  /api/export/json
GET  /api/sync/status
```

人工智能设置接口：

```text
GET  /api/ai/settings
PUT  /api/ai/settings
POST /api/ai/reset-prompt
POST /api/ai/test
POST /api/ai/analyze-draft
```

## 安全说明

- 不要提交 `.dev.vars`、`.env`、真实接口密钥、构建产物和测试输出。
- 用户密码不会明文保存。
- 登录会话保存在 D1，并通过 HttpOnly 的 `memotask_session` Cookie 维持登录态。
- 非账号接口需要有效登录态。
- 人工智能接口密钥进入 D1 前会用 `APP_ENCRYPTION_KEY` 加密。
- 导出数据不会包含明文人工智能接口密钥。
- 邮件验证码和密码重置令牌都有有效期。
- Cloudflare Access 可以作为额外外层保护，但 v3.1.0 的主要账号边界是应用自己的登录系统。

## 版本管理

当前发布版本：

```text
v3.1.0
```

重要分支和标签：

```text
codex/memotask-v1       v1 基线分支
codex/v2-auth           v2 开发和发布分支
codex/v3-app-packaging  v3 桌面端与 Android 打包分支
v1                      已存在的 v1 标签
v2.0.0                  v2 正式标签
v3.0.0                  v3 桌面端与 Android 打包正式标签
v3.1.0                  v3.1 同步与草稿体验正式标签
```

查看版本历史：

```bash
git log --oneline --decorate --graph --all
```

回到 v1 基线：

```bash
git switch codex/memotask-v1
```

回到 v2 当前开发分支：

```bash
git switch codex/v2-auth
```

切换到 v3 当前开发分支：

```bash
git switch codex/v3-app-packaging
```

检出 v2.0.0 标签：

```bash
git switch --detach v2.0.0
```

更详细的版本和回滚说明见 [版本历史与回滚说明](docs/version-history.md)。

## 核心文档

- [Cloudflare 部署指南](docs/cloudflare-setup.md)
- [版本历史与回滚说明](docs/version-history.md)
- [MemoTask v3.1.0 发布说明](docs/release-v3.1.0.md)
