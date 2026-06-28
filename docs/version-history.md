# 版本历史与回滚说明

本文档记录 MemoTask 的核心版本点、Git 分支、标签和常用回滚方式。它用于后续上传 GitHub、排查生产问题和回到稳定版本。

## 当前版本

```text
版本号：v5.0.3
分支：codex/v2-auth
标签：v5.0.3
```

v5.0.3 是当前已部署体验优化版本，已上传并部署到 Cloudflare。当前线上用户使用 v5.0.3 部署版本。

v5.0.3 主要变化：

- Todo 勾选改为单项 pending 状态，后台刷新历史和同步状态时不再锁住整张 Memo 详情卡。
- 服务端返回 Memo 已完成归档时，前端会立即从当前队列移除并插入历史列表。
- 草稿输入区和 Memo 展开编辑态的标签入口会真实写入 `#标签` 文本，保存后由后端解析到 `memo_tags`。
- 标签输入支持直接输入带 `#` 的文本，避免写成 `##标签`。

v5.0.3 不新增 D1 迁移，远程迁移检查结果为 `No migrations to apply`。已执行 `npm run worker:deploy`，生产 Worker Version ID：`e46a8411-a24e-4009-86fe-80d81c6ec2dd`。

v5.0.2 主要变化：

- 刷新失败时不再显示“已刷新”，只有工作台、历史或设置相关刷新源全部成功后才提示成功。
- 刷新过程中拦截重复触发，并在页面顶部显示轻量刷新进度条。
- 发布、AI 整理、保存、归档、Todo 编辑、设置保存、AI 测试、Prompt 恢复、导出和退出登录增加更明确的进行中文案与禁用状态。
- 操作按钮、通知、卡片和刷新反馈补充克制过渡动画，并兼容 `prefers-reduced-motion`。

v5.0.2 已执行远程 D1 迁移和 Worker 部署。生产 Worker Version ID：`1a8141c6-d483-45c8-ab97-1d889a736315`。

v5.0.1 主要变化：

- 草稿的 AI 整理状态和最近一次整理结果保存到数据库，PC 与 Android 重新拉取后能看到同一份 AI 信息。
- `memo_tags` 补充 `user_id` 归属字段，并增加按用户和标准化标签查询的索引。
- Memo、Todo、历史、AI 设置和 Prompt 写操作成功后更新 `sync_meta.last_success_at`。
- D1 草稿清理逻辑限定当前账号，避免多用户草稿互相影响。
- PC 端增加刷新按钮，Android 端增加顶栏刷新按钮和下拉刷新手势。
- 新增 `migrations/0005_sync_ai_metadata.sql`，发布前必须先确认远端 D1 迁移计划。

v5.0.1 没有执行 `npm run worker:deploy`，也没有执行 `npm run db:migrate:remote`。

2026-06-27 起，旧版混合前端 UI 已退役并清理。后续前端实现以 [UI 功能与边界设计契约](UI/memotask-ui-design-contract.md) 为准。

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
| `v4.0.0` | Git 标签 | Memos 对齐改造基线 |
| `v4.1.0` | Git 标签 | Memos 式 UI 与时间线工作台 |
| `v4.2.0` | Git 标签 | 标签与搜索 |
| `v4.2.3` | Git 标签 | Markdown 渲染 |
| `v4.2.4` | Git 标签 | Markdown checkbox 与结构化 Todo 同步 |
| `v5.0.1` | 本地版本 | 同步链路、AI 整理结果持久化和刷新入口修复 |
| `v5.0.2` | 已部署版本 | 刷新反馈、重复点击防护和操作忙碌状态优化 |
| `v5.0.3` | 已部署版本 | Todo 勾选不卡顿、完成后即时归档、标签入口真实写入文本 |

## v4 规划版本点

| 版本点 | 说明 |
| --- | --- |
| `v4.0.0` | 当前代码基线和四阶段路线文档 |
| `v4.1.0` | Memos 式 UI 与时间线工作台（已完成） |
| `v4.2.0` | 标签与搜索（已完成） |
| `v4.2.3` | Markdown 渲染（已完成） |
| `v4.2.4` | Markdown checkbox 与结构化 Todo 同步（已完成） |

旧版 v4 路线文档已删除，避免与当前 UI 设计契约冲突。

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
git diff --check
```

再检查是否误提交密钥：

```bash
rg -n -P "re_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer (?!test-|example-|placeholder)[A-Za-z0-9_.-]{20,}" . -g "!node_modules/**" -g "!dist/**" -g "!.wrangler/**" -g "!output/**" -g "!test-results/**" -g "!release/**"
```

发布后检查：

```bash
curl https://memotask.rrwks.cn/api/health
curl -I https://memotask.rrwks.cn/login
```

## 推送建议

当前远端 `main` 与本地开发线不是同一条直接历史。为了避免覆盖远端主分支，建议先推送当前分支和需要发布的标签：

```bash
git push -u origin codex/v2-auth
git push origin v4.0.0
```

后续如果要让 GitHub 默认首页直接显示 v4，可以在 GitHub 上创建 Pull Request，或在确认无风险后再合并到 `main`。
