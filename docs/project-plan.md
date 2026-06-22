# MemoTask 完整项目计划书

生成日期：2026-06-22  
状态：规划稿  
定位：个人自用、跨手机和 PC、以 Memo 为容器的 AI 待办整理工具  

## 1. 项目总目标

MemoTask 要解决的不是“再做一个待办清单”，而是：

> 让用户随手记录一个 Memo，AI 在这个 Memo 内生成待办项，用户通过勾选内部待办和拖动 Memo 顺序推进事情。

第一版只验证最核心闭环：

```text
创建 Memo -> AI 生成 MemoTodo -> 编辑/勾选 MemoTodo -> 拖动 Memo 排序 -> 多端同步
```

后续版本再加入日期板块。日期板块不是第一版目标，而是以“月份地图”的形式展示：完整月视图中每个日期显示被手动关联到该日期的待办项。

## 2. 产品原则

1. **Memo 是容器**  
   每个 Memo 是一个大的包围框，AI 生成的待办项留在这个 Memo 内部。

2. **顺序是优先级**  
   第一版不靠日期、截止时间或优先级字段管理压力。Memo 在队列中的前后位置就是紧急程度。

3. **AI 只整理，不替用户决定**  
   AI 负责从 Memo 中提取待办、总结上下文、给出建议。它不自动改变 Memo 排序，不自动安排日期。

4. **第一版不做日期压力**  
   不做 Today、Upcoming、截止日期、到期提醒、过期任务。后续日期板块只作为用户主动设置的月份地图。

5. **自用优先**  
   不做付费窗口、会员、订阅墙、团队协作、权限管理、营销页。

## 3. 版本范围

### 3.1 V1：核心可用版

目标：能真实用于个人日常记录和整理。

包含：

- PWA 前端，手机和 PC 都能使用。
- 创建、编辑、删除、归档 Memo。
- Memo 以大包围框卡片展示。
- AI 在 Memo 内生成 MemoTodo。
- 用户编辑、勾选、删除、新增 MemoTodo。
- 拖动 Memo 调整顺序。
- Memo 顺序跨端同步。
- 基础搜索。
- 数据导出。
- AI API 接口设置。
- 默认提示词和自定义提示词设置。
- Cloudflare 上的同步服务。

不包含：

- 日期板块。
- 月份地图。
- 到期提醒。
- 重复任务。
- 团队协作。
- 付费功能。

### 3.2 V1.5：使用体验增强

目标：提升日常使用频率。

包含：

- PWA 安装体验优化。
- 离线创建 Memo。
- 离线勾选 MemoTodo。
- 离线拖动排序后恢复同步。
- 手机分享入口。
- PC 快捷键输入。
- 语音输入。
- 标签和归档视图。
- AI 队列整理建议。

### 3.3 V2：日期月份地图

目标：在不破坏 V1 低压力模型的前提下，加入用户主动设置的日期视图。

包含：

- 完整月份地图。
- 每个日期格子显示关联的 MemoTodo。
- MemoTodo 详情中开放日期接口。
- MemoTodo 日期接口作为唯一添加日期的入口。
- 用户可以手动给某个 MemoTodo 设置日期。
- 月份地图只展示已设置日期的待办。
- 不自动生成过期压力，未完成事项只保留状态，不强制滚动或弹窗。

不包含：

- AI 自动安排日期。
- 默认截止提醒。
- 过期任务红色压迫式提示。

### 3.4 V3：高级能力

包含：

- 浏览器扩展。
- 图片 OCR。
- 邮件或消息机器人输入。
- 自然语言搜索。
- AI 周报。
- 本地优先完整同步。
- 端到端加密。
- 开放 API。

## 4. 推荐技术架构

### 4.1 总体架构

```text
PWA 前端
  |
  | HTTPS
  v
Cloudflare Workers API
  |
  |-- D1：主数据库
  |-- KV：轻量配置缓存，可选
  |-- R2：附件/图片/音频，后续
  |-- Queues：AI 解析异步任务，后续
  |-- Durable Objects：实时同步/WebSocket，后续
```

Cloudflare 选型依据：

- Cloudflare Workers 是运行在 Cloudflare 全球网络上的 serverless 平台，适合承载 API。
- Cloudflare D1 是托管的 serverless SQL 数据库，使用 SQLite 语义，适合作为 Memo、MemoTodo、同步记录的主库。
- Cloudflare Pages 可以承载前端，并通过 Pages Functions 或 Workers 加入动态能力。
- Durable Objects 支持强一致状态和 WebSocket，适合后续做实时多端同步。
- KV 适合低延迟读取配置，但不适合作为强一致主数据库。
- R2 适合后续存储图片、音频等附件。
- Queues 适合把 AI 解析这类耗时任务从请求中拆出来异步处理。

参考：

- Cloudflare Workers：https://developers.cloudflare.com/workers/
- Cloudflare Pages Functions：https://developers.cloudflare.com/pages/functions/
- Cloudflare D1：https://developers.cloudflare.com/d1/
- Cloudflare Durable Objects：https://developers.cloudflare.com/durable-objects/
- Cloudflare KV：https://developers.cloudflare.com/kv/
- Cloudflare R2：https://developers.cloudflare.com/r2/
- Cloudflare Queues：https://developers.cloudflare.com/queues/

### 4.2 前端建议

推荐：

- React + TypeScript + Vite。
- PWA 插件。
- 本地状态使用轻量 store。
- 本地缓存使用 IndexedDB。
- 拖拽排序使用成熟拖拽库。

理由：

- Vite 适合 Cloudflare Pages 静态部署。
- React 生态成熟，做卡片队列、设置页、月份地图都方便。
- IndexedDB 可以支持离线 Memo 草稿和本地同步队列。

### 4.3 后端建议

推荐：

- Cloudflare Workers 提供 REST API。
- D1 存储核心数据。
- Worker Secret 存储服务器加密密钥。
- D1 中存储加密后的用户 AI API Key。
- Queues 在 V1.5 或 V2 接入，用于异步 AI 解析。
- Durable Objects 在需要实时同步时接入。

V1 可以先不做 WebSocket。用增量同步轮询即可：

```text
客户端每隔 N 秒或页面可见时请求 /sync/pull?since=cursor
本地有变更时调用 /sync/push
服务端返回新 cursor
```

## 5. 核心数据模型

### 5.1 users

V1 可以只有一个用户，但仍建议保留用户表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 用户 ID |
| email | text | 可选，登录标识 |
| password_hash | text | 单用户登录时使用 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### 5.2 memos

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | Memo ID |
| user_id | text | 用户 ID |
| content | text | 原始内容 |
| summary | text | AI 摘要 |
| status | text | active / done / note_only / archived |
| sort_order | real | Memo 队列排序，越小越靠前 |
| source | text | web / mobile / share / voice / api |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |
| deleted_at | text? | 软删除 |
| sync_version | integer | 同步版本 |

### 5.3 memo_todos

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | MemoTodo ID |
| memo_id | text | 所属 Memo |
| user_id | text | 用户 ID |
| title | text | 待办标题 |
| notes | text | 上下文 |
| status | text | todo / done / ignored |
| generated_by_ai | integer | 0/1 |
| confidence | real? | AI 置信度 |
| sort_order | integer | Memo 内部排序 |
| calendar_date | text? | V2 日期接口，YYYY-MM-DD，可为空 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |
| completed_at | text? | 完成时间 |
| deleted_at | text? | 软删除 |
| sync_version | integer | 同步版本 |

说明：

- `calendar_date` 在 V1 中不展示，可先预留字段，也可以 V2 migration 添加。
- 日期由用户在 MemoTodo 上手动设置。
- AI 不自动填 `calendar_date`。

### 5.4 tags

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 标签 ID |
| user_id | text | 用户 ID |
| name | text | 标签名 |
| color | text? | 颜色 |
| sort_order | integer | 排序 |

### 5.5 memo_tags

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| memo_id | text | Memo ID |
| tag_id | text | 标签 ID |

### 5.6 ai_settings

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 设置 ID |
| user_id | text | 用户 ID |
| provider_name | text | openai / compatible / custom |
| base_url | text | API Base URL |
| model | text | 模型名 |
| encrypted_api_key | text | 加密后的 API Key |
| prompt_template | text | 当前提示词模板 |
| use_default_prompt | integer | 0/1 |
| enabled | integer | 0/1 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### 5.7 sync_events

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 事件 ID |
| user_id | text | 用户 ID |
| entity_type | text | memo / memo_todo / tag / setting |
| entity_id | text | 实体 ID |
| operation | text | create / update / delete / reorder |
| version | integer | 单调递增版本 |
| created_at | text | 创建时间 |

## 6. 同步服务器设计

### 6.1 Cloudflare 部署结构

推荐部署：

```text
memo.example.com
  |
  |-- Cloudflare Pages：前端 PWA
  |-- /api/* -> Cloudflare Worker：API
      |
      |-- D1：主数据
      |-- R2：附件，后续
      |-- Queues：AI 解析队列，后续
      |-- Durable Object：实时同步，后续
```

### 6.2 V1 同步协议

V1 使用简单增量同步。

客户端本地维护：

- local database。
- pending mutations。
- last_sync_cursor。

服务端维护：

- 当前数据表。
- sync_events 事件表。
- 每个事件一个递增 version。

接口：

```text
POST /api/sync/push
GET  /api/sync/pull?since=<version>
```

`push` 请求：

```json
{
  "client_id": "device-1",
  "last_seen_version": 123,
  "mutations": [
    {
      "id": "mutation-1",
      "entity_type": "memo",
      "entity_id": "memo-1",
      "operation": "update",
      "patch": {
        "content": "new content"
      }
    }
  ]
}
```

`pull` 响应：

```json
{
  "server_version": 130,
  "events": [
    {
      "version": 124,
      "entity_type": "memo",
      "entity_id": "memo-2",
      "operation": "update",
      "data": {}
    }
  ]
}
```

### 6.3 排序同步

Memo 排序是 V1 的关键。

推荐：

- `sort_order` 使用 real number 或 LexoRank 类字符串。
- 拖到两个 Memo 中间时，生成中间值。
- 如果排序值过密，后台做 rebalance。
- MVP 可以用 real number，后续再优化。

冲突策略：

- 同一 Memo 多端同时拖动：最后写入优先。
- 如果同一批排序发生冲突：保留服务端版本，客户端重新拉取。
- P1 再显示“排序已被另一设备更新”提示。

## 7. AI 配置设计

### 7.1 设置目标

用户需要能手动设置：

- AI API Base URL。
- API Key。
- 模型名。
- 是否启用 AI。
- 发送给 AI 的提示词。
- 是否恢复默认提示词。

这使 MemoTask 不绑定单一 AI 服务，可以接入 OpenAI 或其他兼容接口。

### 7.2 安全策略

推荐采用服务端代理：

```text
前端 -> Worker /api/ai/analyze -> 第三方 AI API
```

原因：

- API Key 不暴露在浏览器请求中。
- 可以统一限制请求频率。
- 可以统一记录失败原因。
- 可以隐藏不同供应商的差异。

API Key 存储：

- 用户在设置页输入 API Key。
- Worker 使用 `APP_ENCRYPTION_KEY` 加密。
- 加密后的值存入 D1。
- 前端永远看不到完整 API Key。
- 设置页只显示掩码，例如 `sk-...abcd`。

### 7.3 默认提示词

系统必须内置默认提示词。用户可以编辑，但可以一键恢复默认。

默认提示词目标：

```text
你是 MemoTask 的整理助手。请从用户 Memo 中提取明确可执行的待办项。
规则：
1. 所有待办都必须保留在当前 Memo 内部。
2. 不要安排日期，不要设置截止时间，不要改变 Memo 排序。
3. 不要把情绪、背景、观点强行变成待办。
4. 输出 JSON，包含 summary、memo_todos、note_only_reason。
5. memo_todos 每项包含 title、notes、confidence、reason。
6. 如果没有明确行动项，返回空 memo_todos，并说明原因。
```

### 7.4 AI 调用流程

V1 可同步调用：

```text
用户保存 Memo
  -> Worker 调用 AI
  -> 写入 memo_todos
  -> 返回前端
```

V1.5 建议改为异步：

```text
用户保存 Memo
  -> Worker 保存 Memo
  -> 写入 AI 解析队列
  -> 前端先显示“整理中”
  -> Queue consumer 调用 AI
  -> 写入 memo_todos
  -> 前端下次同步拿到结果
```

异步化优点：

- 保存 Memo 不被 AI 延迟阻塞。
- AI 失败不会影响原文保存。
- 后续可以重试。

## 8. 日期月份地图设计

### 8.1 版本边界

日期月份地图是 V2 功能，不进入 V1。

V1 仍然以 Memo 队列排序为核心，避免第一版就引入日期压力。

### 8.2 月份地图形态

月份地图展示完整自然月。

```text
2026 年 7 月

一   二   三   四   五   六   日
1   2   3   4   5   6   7
8   9   10  11  12  13  14
...
```

每个日期格子显示：

- 当日关联的 MemoTodo 数量。
- 前 2-3 条 MemoTodo 标题。
- 完成数量 / 总数量。

点击日期：

- 打开该日待办列表。
- 每条待办仍显示所属 Memo。
- 可以跳回 Memo 卡片。

### 8.3 添加日期的方式

日期入口放在 MemoTodo 上。

用户打开 Memo 卡片，在某条 MemoTodo 上设置日期：

```text
Memo
  ☐ 整理项目计划书   [设置日期]
```

设置后：

- `memo_todos.calendar_date = YYYY-MM-DD`
- 月份地图对应日期显示该待办。
- Memo 队列排序不受影响。

### 8.4 日期设计原则

- 日期是“视图”，不是压力系统。
- 不自动生成过期任务。
- 不强制滚动未完成任务。
- 不默认弹窗提醒。
- AI 不自动设置日期。
- 用户可以随时取消日期。

## 9. 前端页面任务书

### 9.1 V1 页面

| 页面 | 功能 |
| --- | --- |
| Capture | 快速输入 Memo |
| Memo Queue | 展示可拖拽 Memo 卡片 |
| Memo Detail | 展开 Memo、编辑原文、编辑内部待办 |
| Search | 搜索 Memo 和 MemoTodo |
| Settings | 同步设置、AI API 设置、提示词设置、导出 |

### 9.2 V2 页面

| 页面 | 功能 |
| --- | --- |
| Month Map | 完整月份地图 |
| Date Detail | 查看某天关联的 MemoTodo |
| MemoTodo Date Picker | 在 Memo 内给待办设置日期 |

## 10. API 任务书

### 10.1 Auth

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

V1 自用模式可以使用单用户密码登录。

### 10.2 Memo

```text
GET    /api/memos
POST   /api/memos
GET    /api/memos/:id
PATCH  /api/memos/:id
DELETE /api/memos/:id
POST   /api/memos/reorder
POST   /api/memos/:id/archive
POST   /api/memos/:id/restore
```

### 10.3 MemoTodo

```text
POST   /api/memos/:memoId/todos
PATCH  /api/todos/:id
DELETE /api/todos/:id
POST   /api/todos/:id/toggle
POST   /api/todos/reorder
PATCH  /api/todos/:id/date
```

`PATCH /api/todos/:id/date` 是 V2 接口，可以 V1 先不暴露 UI。

### 10.4 AI

```text
POST /api/ai/analyze-memo
GET  /api/ai/settings
PUT  /api/ai/settings
POST /api/ai/test
POST /api/ai/reset-prompt
```

### 10.5 Sync

```text
POST /api/sync/push
GET  /api/sync/pull
```

### 10.6 Export

```text
GET /api/export/json
GET /api/export/markdown
```

## 11. 阶段任务拆解

### Phase 0：项目基础

目标：创建可运行工程。

任务：

1. 初始化前端项目。
2. 初始化 Cloudflare Worker API。
3. 配置 Cloudflare Pages 部署。
4. 配置 D1 数据库。
5. 建立基础 schema migration。
6. 建立本地开发脚本。

验收：

- 本地前端可启动。
- Worker API 可启动。
- D1 migration 可执行。
- 一个健康检查接口返回成功。

### Phase 1：Memo 基础闭环

目标：没有 AI 也能使用。

任务：

1. 创建 Memo。
2. 编辑 Memo。
3. 删除 / 软删除 Memo。
4. 展示 Memo 卡片队列。
5. 展开 / 折叠 Memo。
6. 拖动 Memo 排序。
7. 保存 `sort_order`。

验收：

- 用户能创建 Memo。
- Memo 以包围框卡片显示。
- 拖动后刷新页面顺序不变。

### Phase 2：MemoTodo

目标：Memo 内部能管理待办。

任务：

1. 手动新增 MemoTodo。
2. 编辑 MemoTodo。
3. 勾选 MemoTodo。
4. 删除 MemoTodo。
5. 调整 MemoTodo 内部顺序。
6. 显示 Memo 完成进度。

验收：

- 每个 Memo 内部能有多个待办。
- 勾选后进度更新。
- MemoTodo 不脱离 Memo 展示。

### Phase 3：AI 设置与解析

目标：AI 可配置、可测试、可生成内部待办。

任务：

1. AI 设置页。
2. API Base URL 输入。
3. API Key 输入和加密存储。
4. 模型名输入。
5. 默认提示词。
6. 自定义提示词。
7. 恢复默认提示词。
8. 测试 AI 连接。
9. 从 Memo 生成 MemoTodo。

验收：

- 用户能配置 AI API。
- 用户能修改提示词并保存。
- 用户能恢复默认提示词。
- AI 生成的待办只出现在 Memo 内部。
- AI 不自动设置日期，不改变 Memo 排序。

### Phase 4：Cloudflare 同步

目标：手机和 PC 数据一致。

任务：

1. D1 数据持久化。
2. sync_events 表。
3. push 接口。
4. pull 接口。
5. 客户端本地缓存。
6. pending mutations。
7. 冲突策略。
8. 多端排序同步。

验收：

- 手机创建 Memo，PC 能看到。
- PC 拖动 Memo，手机刷新后顺序一致。
- 离线创建 Memo 后，联网可同步。

### Phase 5：搜索、导出、设置

目标：可维护、可迁移。

任务：

1. 搜索 Memo 原文。
2. 搜索 MemoTodo。
3. JSON 导出。
4. Markdown 导出。
5. 设置页整理。
6. AI 开关。

验收：

- 搜索能找到 Memo 和内部待办。
- 导出文件包含 Memo、MemoTodo、标签、AI 设置元信息。
- 导出不包含明文 API Key。

### Phase 6：V2 月份地图

目标：加入日期视图，但不破坏 V1 的低压力模型。

任务：

1. 给 MemoTodo 增加日期字段。
2. MemoTodo 日期设置控件。
3. 月份地图页面。
4. 日期格子展示关联待办。
5. 日期详情页。
6. 从日期详情跳回 Memo。
7. 取消日期。

验收：

- 用户能在 MemoTodo 上设置日期。
- 月份地图显示对应待办。
- 未设置日期的待办不出现在月份地图。
- 没有过期任务强提醒。

## 12. 测试计划

| 层级 | 测试内容 |
| --- | --- |
| 单元测试 | 排序算法、提示词变量替换、AI JSON 校验 |
| API 测试 | Memo CRUD、MemoTodo CRUD、sync push/pull、AI 设置 |
| 集成测试 | 创建 Memo -> AI 生成 MemoTodo -> 同步到另一设备 |
| E2E 测试 | 手机视口创建 Memo、PC 视口拖动排序、设置 AI |
| 数据测试 | migration、导出、软删除恢复 |

## 13. 风险与应对

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| Cloudflare D1 查询复杂度上升 | 同步和搜索变慢 | V1 数据量小，先用 D1；后续按用户分表或优化索引 |
| 多端拖拽排序冲突 | 手机和 PC 顺序不一致 | V1 最后写入优先，P1 加冲突提示 |
| AI API Key 泄露 | 前端暴露密钥 | 服务端代理，D1 加密存储，前端只显示掩码 |
| AI 输出格式不稳定 | 无法生成 MemoTodo | JSON schema 校验，失败则保留 Memo 并允许重试 |
| 日期功能带来压力 | 月份地图变成过期任务墙 | 日期只手动设置，不自动提醒，不生成过期红色警告 |
| 功能膨胀 | 做成小 Notion | 第一版只做 Memo 容器、内部待办、拖拽排序、同步、AI 设置 |

## 14. 第一版完成定义

V1 完成时必须满足：

1. PWA 可在手机和 PC 使用。
2. Memo 可以创建、编辑、归档、删除。
3. Memo 以大包围框卡片显示。
4. 每个 Memo 内可以有多个 MemoTodo。
5. AI 可以按用户配置的 API 和提示词生成 MemoTodo。
6. 用户可以手动修改 AI API Base URL、API Key、模型和提示词。
7. 用户可以拖动 Memo 排序。
8. Memo 顺序可以同步到另一设备。
9. 数据存储在 Cloudflare D1。
10. API 运行在 Cloudflare Workers。
11. 前端部署在 Cloudflare Pages。
12. 不存在付费、会员、订阅或升级入口。
    换句话说，V1 不出现任何付费功能。
13. 第一版不出现日期板块。

## 15. 后续决策点

开发前需要最终确认：

1. 登录方式：单用户密码登录，还是直接用 Cloudflare Access 保护整个应用。
2. AI API Key 是否同步到云端加密保存，还是只存在本地浏览器。
3. 月份地图中每个日期默认显示几条待办。
4. Memo 完成后是自动归档，还是手动归档。
5. AI 解析是 V1 同步调用，还是从第一版就用 Queue 异步处理。
