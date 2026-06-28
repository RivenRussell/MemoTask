# MemoTask UI 与功能设计契约

确认日期：2026-06-28

本文档是 MemoTask 新版 PC 与 Android UI 的唯一设计契约。它把已经钉死的 UI 效果图、当前真实后端能力、前端交互边界绑定在一起，目的是让后续 AI 或开发者快速理解：每张图里的区域分别对应什么功能、调用什么接口、不能做什么。

后续 UI 实现必须先读本文档，再写代码。不要只凭图片临场发挥，也不要只按后端接口堆功能。

## 0. 阅读规则

优先级从高到低：

1. 本文档的功能边界和接口说明。
2. `docs/UI/` 下绑定图片的布局、视觉密度、组件气质和空间关系。
3. 现有后端代码中的真实数据契约。
4. 图片中的示例文字和示例数据。

图片不是功能清单。图片中出现但本文档未确认的能力，不允许实现为真实入口。

如果图片和后端能力冲突：

- 保留真实后端能力；
- 用图片中的 Memos 式视觉重新表达；
- 不为贴图效果虚构后端不存在的功能。

## 1. 产品一句话

MemoTask 是一个低压力 Memo 到 Todo 整理工具。

用户先随手写 Memo，再交给 AI 整理成标题和 Todo，确认后发布到当前队列。当前队列中的 Memo 顺序就是轻量优先级。完成或不再关注的 Memo 安静进入历史。

MemoTask 不是：

- 社交时间线；
- GTD 系统；
- 日历任务系统；
- 项目管理看板；
- 团队协作工具；
- 营销 landing page；
- 装饰性 AI 助手界面。

## 2. 当前后端真实能力

UI 必须建立在这些能力上。

### 2.1 Memo 数据模型

前后端 `Memo` 都包含：

```ts
interface Memo {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: "draft" | "active" | "history" | "deleted";
  historyReason: "completed" | "archived" | null;
  sortOrder: number;
  lastActiveSortOrder: number | null;
  autoArchiveSuppressedUntilChange: boolean;
  aiState: "idle" | "analyzing" | "done" | "failed" | "unavailable";
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  historyAt: string | null;
  deletedAt: string | null;
  tags: string[];
  todos: MemoTodo[];
}
```

### 2.2 Tag 后端规则

Tag 已经是多端共享的后端能力。

真实规则：

- 标签来源于 Memo `title` 和 `content` 中的 `#标签`；
- 后端用同一套规则解析标签；
- 标签保存到 D1 的 `memo_tags` 表；
- 所有端拿到的 `Memo` 都有 `tags: string[]`；
- 标签匹配按 normalized 名称比较；
- 标签显示保留第一次出现时的大小写和文本；
- 修改标签的真实方式是修改 Memo 标题或正文里的 `#标签`。

UI 不能把 tag 做成一个脱离 Memo 文本的独立字段，除非后端以后新增专门接口。

允许的 UI 表达：

- 展示 `memo.tags`；
- 点击标签筛选 Memo；
- 在编辑态提供“添加标签”输入，但它的行为必须是把 `#标签` 写入标题或正文；
- 删除标签时，本质是从标题或正文中移除对应 `#标签`。

禁止的 UI 表达：

- 独立标签管理器；
- 标签重命名中心；
- 标签颜色管理；
- 多级标签；
- 把标签当 GTD 分类；
- UI 上改了标签但没有同步到 Memo 文本。

### 2.3 核心接口绑定

| 功能 | 接口或客户端方法 | UI 使用场景 |
| --- | --- | --- |
| 获取当前队列 | `GET /api/memos` / `listMemos()` | PC/Android 工作台 Memo 队列 |
| 按标签筛选当前队列 | `GET /api/memos?tag=xxx` / `listMemos(tag)` | 左侧栏或移动 sheet 的标签筛选 |
| 获取标签列表 | `GET /api/tags` / `listTags()` | PC 左侧栏 Tags、Android 筛选 sheet |
| 发布 Memo | `POST /api/memos/publish` / `publishMemo()` | AI 整理后发布到当前队列 |
| Memo 详情 | `GET /api/memos/:id` / `getMemo()` | 原地展开编辑或兼容深链接 |
| 修改 Memo | `PATCH /api/memos/:id` / `updateMemo()` | 原地编辑标题、正文、文本标签 |
| Memo 排序 | `POST /api/memos/reorder` / `reorderMemos()` | 当前队列拖拽排序 |
| 手动归档 | `POST /api/memos/:id/archive` / `archiveMemo()` | Memo 更多菜单或编辑态归档 |
| 恢复历史 Memo | `POST /api/memos/:id/restore` / `restoreMemo()` | 历史页恢复 |
| 新增 Todo | `POST /api/memos/:memoId/todos` / `createTodo()` | Memo 编辑态和整理结果区 |
| 修改 Todo | `PATCH /api/todos/:id` / `updateTodo()` | Todo 行内编辑 |
| 删除 Todo | `DELETE /api/todos/:id` / `deleteTodo()` | Todo 行更多按钮 |
| 勾选 Todo | `POST /api/todos/:id/toggle` / `toggleTodo()` | 当前队列勾选 |
| Todo 排序 | `POST /api/todos/reorder` / `reorderTodos()` | Memo 展开态 Todo 拖拽 |
| 草稿保存 | `POST /api/drafts`、`PATCH /api/drafts/:id` | 输入区自动保存 |
| 最近草稿 | `GET /api/drafts/recent` / `listRecentDrafts()` | PC 左侧栏、Android sheet |
| AI 整理 | `POST /api/ai/analyze-draft` / `analyzeDraft()` | 整理结果区 |
| AI 设置 | `GET/PUT /api/ai/settings` | 设置抽屉/账号页 |
| 测试 AI 连接 | `POST /api/ai/test` | 设置里的测试连接 |
| 恢复默认 Prompt | `POST /api/ai/reset-prompt` | Prompt 设置 |
| 历史列表 | `GET /api/history` / `listHistory()` | 历史页 |
| 历史搜索与标签筛选 | `GET /api/history/search?q=xxx&tag=xxx` / `searchHistory(query, tag)` | 历史页搜索和标签筛选 |
| 历史批量删除 | `POST /api/history/bulk-delete` | 历史选择模式 |
| 撤销历史删除 | `POST /api/history/undo-delete` | 删除后的轻量撤销 |
| JSON 导出 | `GET /api/export/json` | 设置数据区 |
| 同步状态 | `GET /api/sync/status` | 设置数据区 |

### 2.4 数据库迁移要求

线上 Cloudflare D1 必须包含：

```sql
migrations/0004_memo_tags.sql
```

如果部署前没有执行迁移，`/api/tags` 和读取 Memo tags 会失败。部署新版 UI 前必须确认远端执行：

```bash
npm run db:migrate:remote
```

本地开发库执行：

```bash
npm run db:migrate:local
```

## 3. 全局视觉哲学

视觉目标：极度接近 Memos 的浅色、紧凑、克制风格，但不复制 Memos 的社交时间线心智。

必须使用：

- 近白页面背景；
- 白色内容表面；
- 浅灰细边框；
- 很轻的阴影或无阴影；
- 系统字体；
- 克制圆角，常规卡片 8px 左右；
- 蓝色或蓝灰色作为主交互色；
- 代码图标，优先 `lucide-react`；
- 轻量标签 chip；
- 紧凑但不拥挤的留白。

禁止使用：

- 深色主题作为默认主界面；
- 玻璃拟态；
- 霓虹、强渐变、大光斑；
- 装饰性 raster 插图；
- 云朵、光球、圆环、AI 魔法图；
- 大型 Hero；
- 卡片套卡片；
- 营销式文案；
- GTD 词汇和焦虑式进度语言。

## 4. 参考图总表

| 编号 | 场景 | 图片 | 功能绑定 |
| --- | --- | --- | --- |
| PC-01 | PC 主工作台 | `ig_0ac8a19b3457d6da016a3f9f6431548198a9ffdacbedbecf29.png` | 工作台、搜索、草稿、标签、输入、AI 结果、当前队列 |
| PC-02 | PC 整理结果未生成 | `ig_0cc7376dc6057696016a3faf47cec8819abe9dc70785a0db37.png` | AI 结果空状态 |
| PC-03 | PC Memo 拖拽排序 | `ig_0ff12569f5188fd7016a3fa1710240819b8de824ee140baf44.png` | 当前队列 `reorderMemos()` |
| PC-04 | PC Memo 原地展开编辑 | `ig_0ff12569f5188fd7016a3fa1adaa00819b9616710ee6fa5a6b.png` | Memo/Todo 编辑、文本标签编辑、归档 |
| PC-05 | PC 历史记录 | `ig_0ff12569f5188fd7016a3fa1ed8630819bbe5ca98516453dba.png` | 历史搜索、标签筛选、恢复、删除 |
| PC-06 | PC 设置抽屉 | `ig_01db2c8aa25c5d86016a3fa4c971dc819ab0c9d95f29ca8094.png` | 账号、AI API、Prompt、数据 |
| A-01 | Android 主工作台 | `ig_05a3501d1266c42d016a3fac736a9c8199b20f6001796d3e8a.png` | 移动工作台、底部导航、当前队列 |
| A-02 | Android 整理结果未生成 | `ig_0cc7376dc6057696016a3faf95cd54819aa73e15fe44c86e02.png` | 移动 AI 结果空状态 |
| A-03 | Android 历史记录 | `ig_05cddd7dc86efd20016a3fae238c8c819b8237be4511e0c261.png` | 移动历史页 |
| A-04 | Android 账号与设置 | `ig_05cddd7dc86efd20016a3fade79f34819bb39dd362a7511733.png` | 移动账号页与设置 |

下面每一节都会把图片和功能具体绑定。

## 5. PC-01 主工作台

绑定图片：

![PC 主工作台](./ig_0ac8a19b3457d6da016a3f9f6431548198a9ffdacbedbecf29.png)

### 5.1 页面结构

PC 主工作台是四区结构：

1. 最左侧极窄 rail。
2. 左侧辅助栏。
3. 中央工作区。
4. 可选右侧设置抽屉。

主路由推荐使用 `/memos` 或 `/`。旧的 `/capture` 可以重定向到工作台输入区。

### 5.2 最左侧 rail

rail 只放四类入口：

- MemoTask 标识；
- 工作台入口；
- 历史入口；
- 底部账号/设置入口。

rail 不允许放：

- 设置主导航；
- 独立记录页；
- 独立队列页；
- 标签分类入口；
- GTD 分类。

### 5.3 左侧辅助栏

左侧辅助栏绑定三个真实能力：

| UI 区域 | 数据来源 | 行为 |
| --- | --- | --- |
| 搜索框 | 本地输入状态 | 搜当前队列标题、正文、Todo 文本；可先前端过滤，后续再扩后端 |
| 草稿记录 | `listRecentDrafts()` | 点击恢复草稿内容到输入区 |
| 标签 chips | `listTags()` | 点击后调用 `listMemos(tag)` 筛当前队列 |

标签区显示后端 tags，不显示前端猜出来的临时标签。

标签 chip 选中态：

- 使用轻蓝底或蓝色边框；
- 不显示数量，除非后端以后提供数量；
- 再次点击可取消筛选。

### 5.4 中央输入区

输入区用于随手记录原始 Memo。

真实数据流：

1. 用户输入 `content`。
2. 自动调用草稿保存。
3. 点击 `AI 整理` 前必须已有草稿 id。
4. 调用 `analyzeDraft(draftId)`。
5. AI 结果显示在整理结果区。
6. 点击 `发布` 时调用 `publishMemo({ title, content, todos })`。

输入区必须支持用户写 `#标签`。例如：

```text
整理 Cloudflare 部署 #deploy #cloudflare
```

发布后后端会返回：

```ts
memo.tags // ["deploy", "cloudflare"]
```

输入区不提供：

- 附件；
- 定位；
- 日历；
- 截止日期；
- 提醒；
- 优先级；
- 富文本工具栏；
- 复杂 markdown 工具栏。

### 5.5 AI 整理结果区

整理结果区在主工作台输入区下方。

真实状态：

- 未整理：显示空状态，见 PC-02；
- 分析中：轻量 loading；
- 分析失败：中性错误文字和重试；
- 分析完成：显示建议标题和 Todo；
- 已应用：把结果写回待发布数据；
- 清除：清掉当前 AI 结果。

AI 结果还不是 Memo。只有发布后才成为 active Memo。

整理结果区不显示：

- 优先级评分；
- 截止日期规划；
- 进度分析；
- 复杂效率建议；
- 压力型文案。

### 5.6 当前 Memo 队列

当前队列显示 `status = active` 的 Memo。

数据来源：

- 无标签筛选：`listMemos()`；
- 有标签筛选：`listMemos(tag)`。

每张 Memo 卡片必须显示：

- 标题；
- `memo.tags`；
- 原文摘要或正文；
- 全部 Todo；
- 更多菜单。

Todo 展示规则：

- 所有 Todo 都显示；
- 不折叠后几个；
- 不显示“还有 N 个 Todo”；
- Todo 勾选调用 `toggleTodo(todoId)`；
- 如果最后一个 Todo 完成，后端可能自动归档，UI 必须从返回的 `memo` 或重新拉取列表中同步状态。

当前队列不是时间线。不要按日期分组，不要把时间戳做成主要视觉元素。

## 6. PC-02 AI 整理结果未生成状态

绑定图片：

![PC AI 整理结果未生成状态](./ig_0cc7376dc6057696016a3faf47cec8819abe9dc70785a0db37.png)

### 6.1 功能含义

这张图定义 AI 结果区在未整理时的状态。

它不是空白，也不是假数据。它只需要告诉用户：点击 AI 整理后这里会出现建议标题和 Todo。

推荐文案：

```text
点击 AI 整理后，会在这里生成建议标题和 Todo。
```

### 6.2 状态边界

未整理状态不显示：

- 模拟 Todo；
- 示例分析结果；
- 大插画；
- 花哨 loading；
- 未实现按钮；
- AI 能力营销说明。

## 7. PC-03 Memo 拖拽排序

绑定图片：

![PC Memo 拖拽排序状态](./ig_0ff12569f5188fd7016a3fa1710240819b8de824ee140baf44.png)

### 7.1 功能含义

当前队列支持拖拽排序。排序结果调用：

```ts
reorderMemos(memoIds)
```

后端只对 active Memo 排序，历史页不排序。

### 7.2 UI 行为

默认态：

- 卡片右侧可以有更多菜单；
- 拖拽柄不必常驻强显示。

hover 或长按：

- 显示轻量拖拽柄；
- 卡片边框轻微变蓝；
- 拖动时卡片轻微抬起；
- 插入位置显示细线或轻量占位。

辅助操作：

- 更多菜单可提供上移、下移；
- 但不要把排序做成复杂管理模式。

禁止：

- 看板式拖动；
- 大型排序工具栏；
- 红色警告式反馈；
- 历史页拖拽排序。

## 8. PC-04 Memo 原地展开编辑

绑定图片：

![PC Memo 原地展开编辑](./ig_0ff12569f5188fd7016a3fa1adaa00819b9616710ee6fa5a6b.png)

### 8.1 功能含义

点击当前队列中的 Memo 卡片后，应在原位置展开编辑。日常编辑不进入沉重详情页。

`/memos/:id` 可以保留为兼容深链接，但主体验必须是原地展开。

### 8.2 展开态字段

展开态显示：

- 标题输入；
- 正文输入；
- 标签 chips；
- Todo 列表；
- 添加 Todo 行；
- 保存；
- 收起；
- 归档；
- 更多菜单。

### 8.3 标签编辑的真实规则

展开态可以出现标签 chip 和“添加标签”按钮，但必须遵守后端规则：

- 标签真实来源是标题和正文中的 `#标签`；
- 添加标签时，把 `#标签` 写入正文末尾或标签行对应的文本区域；
- 删除标签时，从标题或正文中删除对应 `#标签`；
- 保存时调用 `updateMemo(memoId, { title, content })`；
- 保存后以后端返回的 `memo.tags` 为准。

不要维护一个只存在前端状态里的标签数组。

### 8.4 Todo 编辑

Todo 行支持：

- 勾选；
- 改标题；
- 改 notes；
- 删除；
- 拖拽排序。

接口：

- 勾选：`toggleTodo(todoId)`；
- 新增：`createTodo(memoId, input)`；
- 修改：`updateTodo(todoId, input)`；
- 删除：`deleteTodo(todoId)`；
- 排序：`reorderTodos(memoId, todoIds)`。

### 8.5 Markdown checkbox 同步

后端支持 Markdown checkbox 与结构化 Todo 同步。

UI 边界：

- 当前队列仍展示结构化 Todo；
- Markdown 是正文内容能力；
- 不把主界面变成纯 Markdown 编辑器；
- 用户编辑正文中的绑定 checkbox 后，保存 Memo 时可同步 Todo 状态；
- Todo 勾选后，后端会同步正文中的绑定 checkbox。

## 9. PC-05 历史记录

绑定图片：

![PC 历史记录](./ig_0ff12569f5188fd7016a3fa1ed8630819bbe5ca98516453dba.png)

### 9.1 功能含义

历史是安静归档箱，不是第二个当前队列。

进入方式：

- PC rail 的历史入口。

数据来源：

- 默认历史：`listHistory()`；
- 搜索：`searchHistory(query)`；
- 搜索加标签：`searchHistory(query, tag)`。

### 9.2 历史页能力

历史页支持：

- 搜索；
- 标签筛选；
- 查看归档 Memo；
- 恢复；
- 删除；
- 批量选择后删除；
- 撤销近期删除。

历史卡片展示：

- 标题；
- 摘要；
- `memo.tags`；
- Todo 完成情况；
- 归档原因；
- 恢复按钮；
- 删除或更多菜单。

### 9.3 历史详情

点击历史 Memo 后，在原位置展开只读详情。

只读详情允许：

- 查看标题；
- 查看正文；
- 查看全部 Todo；
- 查看标签；
- 恢复；
- 删除。

不允许：

- 默认编辑；
- Todo 勾选；
- 拖拽排序；
- 变成另一个 active 队列。

## 10. PC-06 设置抽屉

绑定图片：

![PC 设置抽屉](./ig_01db2c8aa25c5d86016a3fa4c971dc819ab0c9d95f29ca8094.png)

### 10.1 入口

PC 设置从 rail 底部账号图标打开，表现为右侧抽屉或轻量覆盖面板。

设置不是 rail 主导航。

### 10.2 设置分区

设置包含四组：

1. 账号；
2. AI API；
3. Prompt；
4. 数据。

账号区：

- 当前邮箱；
- 邮箱验证状态；
- 退出登录。

AI API 区：

- 接口地址；
- 模型；
- API Key；
- 已保存 key 的 mask；
- 保存设置；
- 测试连接。

Prompt 区：

- Prompt 文本框；
- 恢复默认 Prompt。

数据区：

- 导出 JSON；
- 同步状态。

### 10.3 设置禁区

禁止添加：

- 订阅；
- 计费；
- 团队；
- 权限；
- 主题市场；
- 插件市场；
- 复杂仪表盘；
- 设置装饰图。

## 11. Android-A-01 主工作台

绑定图片：

![Android 主工作台](./ig_05a3501d1266c42d016a3fac736a9c8199b20f6001796d3e8a.png)

### 11.1 移动结构

Android 必须是移动端体验，不是压缩桌面布局。

结构：

1. 顶部栏；
2. 输入区；
3. AI 整理结果区；
4. 当前 Memo 队列；
5. 底部导航。

底部导航只包含：

- 工作台；
- 历史；
- 账号。

顶部栏包含：

- MemoTask 标识；
- 搜索图标；
- 筛选/草稿/标签 sheet 图标。

顶部栏不放账号按钮，因为账号已经在底部导航。

### 11.2 移动工作台数据

与 PC 共用同一套接口：

- `listMemos()`；
- `listMemos(tag)`；
- `listTags()`；
- `listRecentDrafts()`；
- `publishMemo()`；
- `toggleTodo()`。

同一个账号在 PC 和 Android 看到的 Memo、Todo、Tags 必须一致。

### 11.3 移动 Memo 卡片

卡片显示：

- 标题；
- `memo.tags`；
- 全部 Todo；
- 更多菜单。

移动端也不隐藏后续 Todo。

点击 Memo 后可以：

- 原地展开；
- 或打开轻量底部 sheet 编辑。

两种方案都必须保持低压力，不能做成大型详情页。

## 12. Android-A-02 整理结果未生成状态

绑定图片：

![Android AI 整理结果未生成状态](./ig_0cc7376dc6057696016a3faf95cd54819aa73e15fe44c86e02.png)

### 12.1 功能含义

移动端整理结果区和 PC 一致，只是布局更适合单列屏幕。

未整理状态显示轻量提示，不显示假 Todo。

### 12.2 移动状态

移动端整理状态包括：

- 未整理；
- 分析中；
- 分析失败；
- 分析完成；
- 已应用。

按钮需要适合触控：

- `AI 整理`；
- `应用`；
- `清除`；
- `发布`。

## 13. Android 筛选、草稿、标签 Sheet

虽然当前没有单独绑定图片，但它由 A-01 顶部右侧筛选图标触发。

Sheet 内容：

1. 搜索；
2. 草稿记录；
3. 标签 chips。

数据：

- 搜索本地当前队列或历史页对应数据；
- 草稿来自 `listRecentDrafts()`；
- 标签来自 `listTags()`；
- 标签筛选调用 `listMemos(tag)` 或 `searchHistory(query, tag)`。

边界：

- Sheet 不是设置页；
- Sheet 不包含账号信息；
- Sheet 不包含 GTD 分类；
- Sheet 不包含项目管理状态。

## 14. Android-A-03 历史记录

绑定图片：

![Android 历史记录](./ig_05cddd7dc86efd20016a3fae238c8c819b8237be4511e0c261.png)

### 14.1 功能含义

Android 历史是底部导航中的独立页。

它不能和账号页混排。

### 14.2 能力

历史页支持：

- 搜索；
- 标签筛选；
- 查看归档 Memo；
- 恢复；
- 删除；
- 批量选择后删除；
- 撤销删除。

移动端可用顶部搜索或 sheet 承载筛选。

禁止：

- 历史页默认编辑；
- 历史页拖拽排序；
- 历史页显示成当前任务队列。

## 15. Android-A-04 账号与设置

绑定图片：

![Android 账号与设置](./ig_05cddd7dc86efd20016a3fade79f34819bb39dd362a7511733.png)

### 15.1 入口

Android 账号页从底部导航进入。

它承载移动端设置，不需要 PC 那种右侧抽屉。

### 15.2 内容

账号页包含：

- 当前账号；
- 邮箱验证状态；
- 退出登录；
- AI API 设置；
- Prompt 设置；
- 测试连接；
- 导出 JSON；
- 同步状态。

### 15.3 禁区

和 PC 设置一致，不添加订阅、团队、权限、营销说明和装饰图。

## 16. 登录与认证页

登录、注册、邮箱验证、忘记密码、重置密码可以继续使用独立页面。

认证页不需要复用工作台布局，但必须遵守全局视觉哲学：

- 浅色；
- 克制；
- 无装饰图片；
- 不做营销 landing page；
- 不展示不存在的能力。

Android 端登录必须兼容 Capacitor session token 方案。不要因为 UI 重写破坏移动端登录态。

## 17. 空状态、加载和错误

所有反馈都保持低压力。

### 17.1 空状态文案

| 场景 | 文案方向 |
| --- | --- |
| AI 未整理 | 点击 AI 整理后，会在这里生成建议标题和 Todo。 |
| 当前队列为空 | 先随手记录一条 Memo。 |
| 草稿为空 | 保存过的草稿会出现在这里。 |
| 标签为空 | 在 Memo 中写下 `#标签` 后会出现在这里。 |
| 历史为空 | 归档后的 Memo 会出现在这里。 |

### 17.2 错误状态

使用：

- 简短文字；
- 中性色；
- 轻量边框；
- 必要时的蓝色重试按钮。

避免：

- 大红块；
- 大面积插画；
- 焦虑文案；
- 夸张失败动效。

## 18. Markdown 与 Todo 边界

Markdown 渲染保留。

Markdown checkbox 与结构化 Todo 同步保留。

边界：

- Markdown 是正文内容能力；
- 结构化 Todo 仍是主 UI；
- 当前队列不变成纯 Markdown 编辑器；
- 绑定 checkbox 修改后，保存 Memo 可同步 Todo；
- Todo 勾选后，后端会同步绑定 checkbox；
- 无绑定 checkbox 仍是普通正文内容。

## 19. 多端一致性要求

PC、Android、Cloudflare 后端必须共享同一套数据：

- 同账号 Memo 一致；
- 同账号 Todo 一致；
- 同账号 Tags 一致；
- 同账号 AI 设置一致；
- 同账号历史一致。

UI 实现不得在某一端引入只存在本地的核心状态。

尤其是 tags：

- 不允许 PC 自己解析一套、Android 自己解析一套；
- 不允许只在 localStorage 存标签；
- 不允许前端 tags 和后端 `memo.tags` 不一致；
- 展示和筛选以后端返回为准。

## 20. 实现顺序建议

为了减少返工，推荐按以下顺序实现：

1. 数据层：确认 API client 覆盖 `Memo.tags`、`listTags()`、`listMemos(tag)`、`searchHistory(query, tag)`。
2. PC 主工作台结构：rail、左侧栏、输入区、AI 结果区、当前队列。
3. 当前队列 Memo 卡片：展示 tags 和全部 Todo。
4. Memo 原地展开编辑：标题、正文、文本标签、Todo 增删改排、归档。
5. PC 历史页：搜索、标签筛选、恢复、删除。
6. PC 设置抽屉。
7. Android 主工作台。
8. Android 筛选 sheet。
9. Android 历史页。
10. Android 账号与设置页。
11. 全量视觉 QA，对照每张绑定图检查。

## 21. 绝对禁止项

实现时不得：

- 只换底色就宣称接近 Memos；
- 保留旧版丑 UI 的结构；
- 把 PC 布局硬塞进 Android；
- 把历史做成第二个当前队列；
- 把 tags 做成本地假功能；
- 隐藏后续 Todo；
- 加 GTD 分类；
- 加日历、提醒、截止日期、优先级；
- 加团队、订阅、计费；
- 加装饰图片；
- 加社交时间线；
- 加图片里没有确认的功能入口。

## 22. 验收清单

实现完成后逐项检查。

### 22.1 图像对齐

- PC 主工作台对齐 PC-01；
- PC AI 未整理状态对齐 PC-02；
- PC 拖拽排序状态对齐 PC-03；
- PC 原地展开编辑对齐 PC-04；
- PC 历史记录对齐 PC-05；
- PC 设置抽屉对齐 PC-06；
- Android 主工作台对齐 A-01；
- Android AI 未整理状态对齐 A-02；
- Android 历史记录对齐 A-03；
- Android 账号设置对齐 A-04。

### 22.2 功能对齐

- `Memo.tags` 在当前队列卡片展示；
- `GET /api/tags` 被用于标签列表；
- `GET /api/memos?tag=xxx` 被用于当前队列标签筛选；
- `GET /api/history/search?q=xxx&tag=xxx` 被用于历史搜索和标签筛选；
- 添加或删除标签会同步修改 Memo 文本里的 `#标签`；
- 当前队列显示全部 Todo；
- 勾选最后一个 Todo 后 UI 能处理自动归档；
- Memo 日常编辑是原地展开或移动端轻量 sheet；
- 历史页只读，不排序；
- 设置入口符合 PC/Android 各自设计。

### 22.3 视觉与边界

- 页面浅色、紧凑、克制；
- 无装饰 raster 图片；
- 无大型 Hero；
- 无 GTD 词汇；
- 无焦虑式进度；
- 无未实现功能入口；
- Android 不是压缩版桌面；
- PC 不是只改背景色的旧版。

如果有任何一项不满足，不能认为新版 UI 重构完成。
