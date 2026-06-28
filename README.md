# MemoTask

MemoTask 是一个低压力的个人 Memo 待办整理工具。它的核心思路很简单：先把脑子里的想法、计划、链接、琐事写成一条 Memo，再让人工智能把这条 Memo 内部拆成可执行的待办项。用户不需要一开始就想清楚分类、日期和提醒，只需要先记录，再整理。

当前本地版本为 **v5.0.1**。本版本修复标签、AI 整理结果和同步状态的数据链路，并补充 PC 刷新按钮与 Android 下拉刷新入口。注意：v5.0.1 目前只在本地代码中完成，尚未上传或部署到 Cloudflare，避免影响现有线上用户访问。

生产访问地址：

```text
https://memotask.rrwks.cn/login
```

## 前端重构基线

旧版前端中同时混入了独立记录页、时间线队列、详情页、右侧工具栏、装饰图片和多阶段样式覆盖。
这些旧 UI 已退场，当前前端只保留最小占位入口，避免后续重写时继续背负旧结构。

新版前端的唯一设计基准见 [MemoTask UI 功能与边界设计契约](docs/UI/memotask-ui-design-contract.md)。

## 后端能力基线

当前保留的核心能力来自 v2-v4 后端演进：从“单用户自用工具”升级为“带账号隔离的多用户应用”，再补齐 Memo、Todo、历史、AI 设置和 Markdown Todo 同步。

主要能力：

- 支持邮箱和密码注册账号。
- 注册后通过邮箱验证码完成验证。
- 支持登录、退出登录和保持登录状态。
- 支持忘记密码与邮件重置密码。
- 使用 HttpOnly 会话 Cookie 保存登录态，降低前端脚本读取登录凭据的风险。
- 所有 Memo 数据按用户隔离，不同账号互相不可见。
- 每个用户拥有独立的人工智能接口设置、提示词和加密后的接口密钥。
- AI 整理状态和最近一次整理结果会随草稿保存，PC 与 Android 重新拉取后保持一致。
- 前端、后端和静态资源统一部署在同一个 Cloudflare Worker。
- Cloudflare D1 保存账号、会话、Memo、待办、标签、AI 设置、AI 整理结果、历史记录、草稿、撤销记录和同步状态。
- Resend 负责发送注册验证和密码重置邮件。

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
- 支持在 Memo 正文中使用 Markdown。
- 支持通过 `<!-- memotask:todo=TODO_ID -->` 将 Markdown checkbox 显式绑定到结构化 Todo。
- 草稿自动保存。
- 最近草稿恢复。
- 发布 Memo 到队列。
- Memo 队列排序。
- 上移、下移和拖拽排序。
- Memo 内容编辑能力。
- Memo 手动归档。
- Todo 新增、编辑、删除、勾选和排序。
- 绑定后的 Markdown checkbox 与结构化 Todo 状态和标题保持同步。
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
- 响应式布局适配安卓手机和桌面浏览器。
- 生产环境通过 Cloudflare 自定义域名访问。

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
- Wrangler
- Vitest
- Tauri
- Capacitor

## 目录结构

```text
src/                  前端入口、API client、共享领域工具和类型
worker/               Cloudflare Worker、接口、领域逻辑和仓储实现
worker/auth/          账号、密码、令牌、会话和邮件发送逻辑
worker/repository/    D1 与内存仓储实现
migrations/           Cloudflare D1 数据库迁移
tests/api/            Worker 接口和仓储测试
tests/*.test.ts       共享领域工具测试
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
migrations/0003_clear_default_ai_key.sql
migrations/0004_memo_tags.sql
migrations/0005_sync_ai_metadata.sql
```

主要数据表：

- `users`
- `sessions`
- `email_verification_tokens`
- `password_reset_tokens`
- `memos`
- `memo_todos`
- `memo_tags`
- `ai_settings`
- `undo_operations`
- `sync_meta`

v5.0.1 数据结构整理：

- `memos.ai_result_json` 保存草稿最近一次 AI 整理结果，避免两端只同步到草稿正文、同步不到整理结果。
- `memo_tags.user_id` 给标签记录补上账号归属，便于直接按账号查询和排查数据。
- 写入 Memo、Todo、AI 设置、Prompt、历史操作后会推进 `sync_meta.last_success_at`，让客户端能看到真实的最近同步时间。
- 草稿清理 SQL 限定当前 `user_id`，避免多账号场景下误影响其他账号草稿。

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

只运行共享逻辑测试：

```bash
npm run test:shared
```

执行生产构建：

```bash
npm run build
```

旧版 UI 单测和 Playwright 视觉检查已随旧前端删除。新版前端实现后再按设计契约重建 UI 测试、e2e 与视觉检查。

## 桌面与 Android 打包

PC 端使用 Tauri 壳：

```bash
npm run tauri:build
```

Android 端使用 React 构建产物打包进 Capacitor APK：

```bash
npm run android:build
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

v5.0.1 尚未执行远程迁移或部署。发布前必须先确认线上 D1 可兼容 `migrations/0005_sync_ai_metadata.sql`，再按顺序执行远程迁移和 Worker 部署。

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
- Cloudflare Access 可以作为额外外层保护，但 v2.0.0 的主要账号边界是应用自己的登录系统。

## 版本管理

当前整理版本：

```text
v5.0.1
```

重要分支和标签：

```text
codex/memotask-v1       v1 基线分支
codex/v2-auth           v2 开发和发布分支
v1                      已存在的 v1 标签
v2.0.0                  v2 正式标签
v4.0.0                  当前 v4 基线标签
v4.1.0                  Memos 式 UI 与时间线工作台
v4.2.0                  标签与搜索
v4.2.3                  Markdown 渲染
v4.2.4                  Markdown checkbox 与结构化 Todo 同步
v5.0.1                  同步链路、AI 整理结果持久化和刷新入口修复（本地待发布）
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

检出 v2.0.0 标签：

```bash
git switch --detach v2.0.0
```

更详细的版本和回滚说明见 [版本历史与回滚说明](docs/version-history.md)。

## 核心文档

- [Cloudflare 部署指南](docs/cloudflare-setup.md)
- [版本历史与回滚说明](docs/version-history.md)
- [MemoTask UI 功能与边界设计契约](docs/UI/memotask-ui-design-contract.md)
- [文档索引](docs/README.md)
