# 版本历史与回滚说明

本文档记录 MemoTask 的核心版本点、Git 分支、标签和常用回滚方式。它用于后续上传 GitHub、排查生产问题和回到稳定版本。

## 当前版本

```text
版本号：v3.1.0
分支：codex/v3-app-packaging
标签：v3.1.0
```

v3.1.0 是同步与草稿体验增强版本。它继续使用 Electron `.exe` 和 Capacitor APK 作为本地入口，接口仍请求 `https://memotask.rrwks.cn` 上的 Cloudflare Worker，同时用 TanStack React Query 管理前端 server state，改善 PC/Android 同账号同步、登录启动速度和草稿标题流程。

## 关键版本点

| 版本点 | 类型 | 说明 |
| --- | --- | --- |
| `v1` | Git 标签 | 已存在的 v1 发布标签 |
| `codex/memotask-v1` | Git 分支 | v1 本地回滚基线 |
| `codex/v2-auth` | Git 分支 | v2 账号体系开发与发布分支 |
| `v2-auth-stable-2026-06-24` | Git 标签 | v2 账号能力阶段稳定点 |
| `v2-soft-ui-2026-06-24` | Git 标签 | v2 界面改版阶段稳定点 |
| `v2-complete-2026-06-25` | Git 标签 | v2 功能完善阶段稳定点 |
| `v2-prompt-sync-2026-06-25` | Git 标签 | 提示词和同步修复稳定点 |
| `v2.0.0` | Git 标签 | v2 正式发布点 |
| `codex/v3-app-packaging` | Git 分支 | v3 桌面端与 Android 打包开发分支 |
| `v3.0.0` | Git 标签 | v3 桌面端与 Android 打包正式发布点 |
| `v3.1.0` | Git 标签 | v3.1 同步与草稿体验正式发布点 |

## v3.1.0 内容摘要

同步与刷新：

- 前端引入 TanStack React Query 统一管理 Memo、详情、草稿、历史、设置和同步状态缓存。
- 队列页新增“刷新队列”手动刷新入口。
- 队列页保持打开时以低频轮询刷新；窗口重新聚焦时刷新当前页面数据。
- 发布 Memo 后立即把服务端返回结果写入队列缓存，不等待后续列表请求。
- Memo、Todo、排序、归档、恢复、历史删除和设置保存后会更新或失效相关缓存。

登录与启动：

- 登录成功后先进入应用 shell，再后台加载 Memo 列表。
- 已登录启动时账号检查完成即可进入应用，不再等待队列列表加载完成。
- 受保护请求失效时仍会清理本地认证状态并回到登录页。

草稿与标题：

- 最近草稿在没有显式标题时优先使用正文作为预览。
- 标题输入默认隐藏，AI 生成标题或外部分享带标题后再显示并允许编辑。
- 未填写标题发布时会从正文自动派生标题，不再强制发送“未命名 Memo”。
- 草稿保存使用最新输入快照，避免较旧的自动保存响应覆盖新的草稿预览。

构建产物：

- Windows 安装包：`release/desktop/MemoTask Setup 3.1.0.exe`
- Android APK：`android/app/build/outputs/apk/release/app-release.apk`

## v3.0.0 内容摘要

应用打包：

- Windows 端使用 Electron 和 electron-builder 打包为 NSIS `.exe` 安装包。
- Android 端使用 Capacitor Android 打包为可侧载 APK。
- PC 和 Android 都打包本地 React/Vite `dist` 构建产物。
- PC 和 Android 接口仍请求 `https://memotask.rrwks.cn/api/*`。
- 网页端继续使用同源 `/api/*`。

登录与接口兼容：

- 网页端保留 HttpOnly `memotask_session` Cookie。
- 打包端使用 Worker 返回的 app session token 发送 Bearer 请求。
- Worker 只为受控 app origin 开放必要 CORS。

快速记录：

- Windows 桌面端支持托盘、快速记录窗口、`Ctrl + Alt + M` 快捷键和系统通知。
- Android 端支持系统分享菜单接收 `text/plain` 文本和链接。
- Android 返回键在记录、设置、历史和详情页优先返回队列页。
- 发布失败时会保存本地草稿，稍后可重新载入。

构建产物：

- Windows 安装包：`release/desktop/MemoTask Setup 3.0.0.exe`
- Android APK：`android/app/build/outputs/apk/release/app-release.apk`

## v2.0.0 内容摘要

账号与安全：

- 邮箱注册。
- 邮箱验证码验证。
- 邮箱密码登录。
- 退出登录。
- 忘记密码。
- 密码重置。
- D1 会话存储。
- `memotask_session` 登录 Cookie。
- 未登录接口保护。

数据隔离：

- Memo 按用户隔离。
- 草稿按用户隔离。
- 历史记录按用户隔离。
- 撤销删除按用户隔离。
- 同步状态按用户隔离。
- 人工智能设置按用户隔离。
- JSON 导出按用户隔离。

部署能力：

- 单 Worker 同时托管前端和接口。
- Cloudflare D1 保存数据。
- Resend 发送验证和重置密码邮件。
- 自定义域名 `memotask.rrwks.cn`。

文档能力：

- 中文 README。
- 中文 Cloudflare 部署指南。
- 中文版本历史和回滚说明。

## 常用 Git 命令

查看当前状态：

```bash
git status --short --branch
```

查看版本图：

```bash
git log --oneline --decorate --graph --all
```

查看标签：

```bash
git tag --list
```

切回 v2 开发分支：

```bash
git switch codex/v2-auth
```

切回 v1 基线分支：

```bash
git switch codex/memotask-v1
```

检出 v2.0.0 标签进行只读排查：

```bash
git switch --detach v2.0.0
```

从标签新建排查分支：

```bash
git switch -c hotfix/from-v2.0.0 v2.0.0
```

## 回滚思路

### 只回看代码

如果只是查看某个版本，不要切换工作分支到旧提交，可以使用：

```bash
git show v2.0.0:README.md
git show v1:README.md
```

### 本地回到 v1

适合确认 v1 状态或重新启动 v1 分支开发：

```bash
git switch codex/memotask-v1
npm install
npm test
npm run build
```

### 本地回到 v2.0.0

适合确认当前正式发布点：

```bash
git switch --detach v2.0.0
npm install
npm test
npm run build
```

如果需要在 v2.0.0 基础上修复问题：

```bash
git switch -c hotfix/v2.0.1 v2.0.0
```

### 生产回滚

生产环境运行在 Cloudflare Worker。推荐优先使用 Cloudflare Dashboard 的 Worker 版本回滚能力，选择上一个已知可用版本恢复。

如果需要用 Git 重新部署某个标签：

```bash
git switch --detach v2.0.0
npm install
npm test
npm run build
npm run worker:deploy
```

如果回滚到旧代码时数据库迁移已经前进，需要特别小心。D1 迁移通常不建议简单倒退，回滚前应确认旧代码能兼容当前表结构。

## 发布检查清单

每次发布前至少执行：

```bash
npm test
npm run build
npm run e2e
npm run desktop:build
npm run android:apk
npx wrangler deploy --dry-run
git diff --check
```

再检查是否误提交密钥：

```bash
rg -n -P "re_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer (?!test-|example-|placeholder)[A-Za-z0-9_.-]{20,}" . -g "!node_modules/**" -g "!dist/**" -g "!.wrangler/**" -g "!output/**" -g "!test-results/**" -g "!playwright-report/**"
```

发布后检查：

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

## 推送建议

本次正式发布需要让远端 `main` 指向 v3.1.0，同时保留开发分支和标签：

```bash
git push -u origin codex/v3-app-packaging
git push origin HEAD:main --force-with-lease
git push origin v3.1.0
```

因为远端 `main` 可能和本地开发线不是同一条直接历史，推送 `main` 时使用 `--force-with-lease`，避免在远端发生未知新提交时静默覆盖。
