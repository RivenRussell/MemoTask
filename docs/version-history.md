# 版本历史与回滚说明

本文档记录 MemoTask 的核心版本点、Git 分支、标签和常用回滚方式。它用于后续上传 GitHub、排查生产问题和回到稳定版本。

## 当前版本

```text
版本号：v4.2.4
分支：codex/v2-auth
标签：v4.2.4
```

v4.2.4 完成 Markdown checkbox 与结构化 Todo 同步阶段。带有 `<!-- memotask:todo=TODO_ID -->` 标记的 Markdown task 会与对应 Todo 同步标题和完成状态；未绑定的 Markdown checkbox 仍然只是正文内容。

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
