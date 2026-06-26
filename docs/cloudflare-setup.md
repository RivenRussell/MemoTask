# Cloudflare 部署指南

本文档记录 MemoTask v3.1.0 在 Cloudflare 上的核心部署方式。它面向后续复现、迁移、回滚和排查问题，不包含真实账号编号、真实密钥或私人控制台链接。

当前生产地址：

```text
https://memotask.rrwks.cn/login
```

## 部署架构

MemoTask 以单个 Cloudflare Worker 运行：

```text
用户浏览器
  |
  | 访问 https://memotask.rrwks.cn
  v
Cloudflare Worker：memotask
  |
  |-- Workers Assets：返回 React 构建产物
  |-- Hono：处理 /api/*
  |-- D1：保存账号、Memo、Todo、历史记录和设置
  |-- Resend：发送邮箱验证码和密码重置邮件
```

v3.1.0 使用应用自己的账号系统。Cloudflare Access 可以继续作为额外外层保护，但不是必须项。Windows 桌面端和 Android APK 仍然请求同一个 Worker API，因此 Cloudflare 端是三端共享的数据入口。

## 当前资源

生产域名：

```text
memotask.rrwks.cn
```

Worker：

```text
名称：memotask
入口：worker/index.ts
静态资源目录：dist
```

D1：

```text
数据库名称：memotask-db
绑定名称：DB
```

邮件：

```text
服务商：Resend
发信域名：notify.rrwks.cn
```

## 费用提醒

以下操作可能产生费用，执行前需要单独确认：

- 购买域名。
- 升级 Cloudflare 付费套餐。
- 开通付费产品。
- 填写付款信息。
- 确认结账、购买或订阅。

日常重新部署 Worker、执行 D1 迁移、修改 Worker Secrets，一般不需要购买新资源。

## 本地准备

安装依赖：

```bash
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

查看 Wrangler 版本：

```bash
npx wrangler --version
```

本项目开发和部署时使用过的 Wrangler 版本为 4.x。

## Wrangler 配置

`wrangler.toml` 的核心配置如下：

```toml
name = "memotask"
main = "worker/index.ts"
compatibility_date = "2026-06-22"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
preview_urls = true

[[routes]]
pattern = "memotask.rrwks.cn"
custom_domain = true

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true

[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<Cloudflare D1 数据库编号>"
```

说明：

- `not_found_handling = "single-page-application"` 用于支持 `/login`、`/signup`、`/memos`、`/history` 等前端路由刷新。
- `run_worker_first = true` 让 Worker 先接管请求，再决定返回接口响应或静态资源。
- `custom_domain = true` 表示该 Worker 直接绑定自定义域名。
- `database_id` 是 Cloudflare D1 生成的数据库编号，不是密钥，但公开仓库中仍建议按需脱敏。

## D1 数据库

创建数据库：

```bash
npx wrangler d1 create memotask-db
```

创建后将返回的数据库编号写入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<Cloudflare D1 数据库编号>"
```

本地执行迁移：

```bash
npm run db:migrate:local
```

远程执行迁移：

```bash
npm run db:migrate:remote
```

当前迁移文件：

```text
migrations/0001_initial.sql
migrations/0002_auth.sql
migrations/0003_clear_default_ai_key.sql
```

验证远程表：

```bash
npx wrangler d1 execute memotask-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

应能看到这些核心表：

```text
ai_settings
email_verification_tokens
memo_todos
memos
password_reset_tokens
sessions
sync_meta
undo_operations
users
```

## Worker 密钥和变量

生产环境必须配置：

| 名称 | 建议类型 | 用途 |
| --- | --- | --- |
| `APP_ENCRYPTION_KEY` | Secret | 加密用户保存的人工智能接口密钥 |
| `EMAIL_API_KEY` | Secret | Resend 发信接口密钥 |
| `EMAIL_FROM` | Secret 或变量 | 发件人地址 |
| `APP_BASE_URL` | Secret 或变量 | 应用公网地址 |

配置命令：

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
```

示例值：

```text
APP_ENCRYPTION_KEY=<一段足够长的随机字符串>
EMAIL_API_KEY=<Resend API Key>
EMAIL_FROM=MemoTask <noreply@notify.example.com>
APP_BASE_URL=https://memotask.example.com
```

不要把真实值写入 README、提交记录、截图、问题单或公开聊天。

## Resend 邮件配置

MemoTask v3.1.0 需要邮件能力完成注册验证和密码找回。当前建议使用 Resend。

配置步骤：

1. 登录 Resend。
2. 新建或选择发信域名，例如 `notify.rrwks.cn`。
3. Resend 会给出若干 DNS 记录，通常包括 SPF、DKIM 和可能的验证记录。
4. 打开 Cloudflare DNS。
5. 在 `rrwks.cn` 这个区域下添加 Resend 要求的记录。
6. 等待 Resend 显示域名验证通过。
7. 在 Resend 创建 API Key，权限选择发送邮件所需的最小权限。
8. 将 API Key 写入 `EMAIL_API_KEY`。
9. 将发件人写入 `EMAIL_FROM`。

如果使用当前域名，建议值类似：

```text
EMAIL_FROM=MemoTask <noreply@notify.rrwks.cn>
APP_BASE_URL=https://memotask.rrwks.cn
```

注意：

- `notify.rrwks.cn` 是发信域名，不是应用访问域名。
- `memotask.rrwks.cn` 是应用访问域名。
- 两者可以同时存在于 Cloudflare DNS 中。
- Cloudflare 邮件路由不是必须项；MemoTask 是通过 Resend 主动发信，不依赖 Cloudflare 收信转发。

## 自定义域名

当前应用域名是：

```text
memotask.rrwks.cn
```

前提：

- `rrwks.cn` 的权威 DNS 已经托管到 Cloudflare。
- Cloudflare 中存在 `rrwks.cn` 这个区域。
- Worker 路由配置中包含 `memotask.rrwks.cn`。

部署后 Cloudflare 会把该主机名绑定到 Worker。通常不需要手动添加一条普通的 A 记录指向服务器，因为 Worker 自定义域名由 Cloudflare 内部路由接管。

检查命令：

```bash
curl -I https://memotask.rrwks.cn/login
curl https://memotask.rrwks.cn/api/health
```

期望：

```text
HTTP/2 200
{"ok":true}
```

如果 HTTP 被跳转到 HTTPS，也属于正常行为：

```text
HTTP/1.1 308 Permanent Redirect
```

## 构建与部署

构建前端：

```bash
npm run build
```

部署 Worker 和静态资源：

```bash
npm run worker:deploy
```

推荐完整发布顺序：

```bash
npm test
npm run build
npm run db:migrate:remote
npm run worker:deploy
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

## 部署后检查

基础检查：

- `/api/health` 返回 `{"ok":true}`。
- `/login` 能打开登录页面。
- `/signup` 能打开注册页面。
- 未登录访问 `/api/memos` 返回未授权错误。
- 注册后能收到邮箱验证码。
- 验证邮箱后能登录。
- 登录后创建的 Memo 只在当前账号可见。
- 另一个账号登录后看不到前一个账号的数据。
- 忘记密码邮件能收到。
- 重置密码后旧密码不可用，新密码可登录。

命令示例：

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

## 常见问题

### 页面刷新后 404

检查 `wrangler.toml`：

```toml
not_found_handling = "single-page-application"
```

这个配置让前端路由刷新时仍返回 React 应用入口。

### 接口返回的是 HTML

检查 Worker 是否先处理接口请求。当前配置使用：

```toml
run_worker_first = true
```

### 保存人工智能设置失败

检查是否已经配置：

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
```

然后重新部署：

```bash
npm run worker:deploy
```

### 注册或找回密码邮件发送失败

检查：

- `EMAIL_API_KEY` 是否正确。
- `EMAIL_FROM` 是否使用已经在 Resend 验证通过的发信域名。
- `APP_BASE_URL` 是否是生产访问地址。
- Resend 域名验证是否已经通过。
- Cloudflare DNS 中 Resend 要求的记录是否完整。

重新写入密钥后部署：

```bash
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put APP_BASE_URL
npm run worker:deploy
```

### D1 绑定缺失

检查 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "memotask-db"
database_id = "<Cloudflare D1 数据库编号>"
```

Worker 代码期望通过 `env.DB` 访问数据库。

### 自定义域名无法访问

按顺序检查：

1. `rrwks.cn` 是否已经使用 Cloudflare 的 NS。
2. Cloudflare 区域是否处于启用状态。
3. `wrangler.toml` 中的路由是否是 `memotask.rrwks.cn`。
4. 最近一次 `npm run worker:deploy` 是否成功。
5. HTTPS 是否已经签发证书。
6. `curl -I https://memotask.rrwks.cn/login` 是否返回 200 或跳转。

### Cloudflare Access 和应用登录的关系

MemoTask v3.1.0 已经有应用级账号系统。Cloudflare Access 可以选用：

- 如果只想依赖 MemoTask 自己的注册和登录，保持 Worker 自定义域名公开即可。
- 如果想在外面再加一道门，可以给 `memotask.rrwks.cn` 配置 Cloudflare Access。
- 开启 Access 后，用户需要先通过 Cloudflare，再进入 MemoTask 登录页。

移动端测试时，如果 Cloudflare Access 登录不方便，可以临时关闭 Access，仅依赖 MemoTask 应用登录。

## Windows 和 Android 本地应用接入

Windows 安装包和 Android APK 会把 React/Vite 的 `dist` 构建产物打包进本地应用，但数据和接口仍然使用 Cloudflare Worker：

```text
Windows Electron / Android Capacitor
  |
  | HTTPS 请求 /api/*
  v
https://memotask.rrwks.cn
  |
  v
Cloudflare Worker + D1
```

关键点：

- Web 端默认使用同源 `/api/*`。
- Desktop 和 Android 构建模式默认使用 `https://memotask.rrwks.cn`。
- 如果你部署到自己的域名，需要在 `.env` 或构建环境中设置 `VITE_API_BASE_URL=https://your-domain.example.com`，然后重新运行 `npm run desktop:build` 或 `npm run android:apk`。
- 本地应用登录后使用 Worker 返回的 app session token 访问 API；网页端仍使用 HttpOnly Cookie。
- CORS 需要允许受控 app origin，例如 `http://127.0.0.1:*`、`https://localhost` 和 `capacitor://localhost`。当前 Worker 已内置这些受控来源判断。

## GitHub 发布前检查

提交和推送前执行：

```bash
npm test
npm run build
git diff --check
```

检查密钥：

```bash
rg -n -P "re_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer (?!test-|example-|placeholder)[A-Za-z0-9_.-]{20,}" . -g "!node_modules/**" -g "!dist/**" -g "!.wrangler/**" -g "!output/**" -g "!test-results/**" -g "!playwright-report/**"
```

确认不要提交：

- `.dev.vars`
- `.env`
- `dist/`
- `.wrangler/`
- `test-results/`
- `playwright-report/`
- 真实 Resend API Key
- 真实人工智能接口密钥
