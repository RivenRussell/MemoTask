import type { Memo, MemoTodo } from "../domain/types";
import type { AiSettings, AiSettingsInput, DraftInput, MemoRepository, PublishMemoInput, SyncStatus } from "./types";
import { DEFAULT_PROMPT } from "./memory-repository";

type MemoRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: Memo["status"];
  history_reason: Memo["historyReason"];
  sort_order: number;
  last_active_sort_order: number | null;
  auto_archive_suppressed_until_change: number;
  ai_state: Memo["aiState"];
  ai_error: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  history_at: string | null;
  deleted_at: string | null;
};

type TodoRow = {
  id: string;
  memo_id: string;
  title: string;
  notes: string | null;
  status: MemoTodo["status"];
  sort_order: number;
  generated_by_ai: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

type AiSettingsRow = {
  id: string;
  user_id: string;
  base_url: string;
  model: string;
  encrypted_api_key: string | null;
  api_key_mask: string | null;
  prompt_template: string;
  created_at: string;
  updated_at: string;
};

export class D1Repository implements MemoRepository {
  constructor(private readonly db: D1Database) {}

  async createDraft(input: DraftInput, now: string): Promise<Memo> {
    const draft: Memo = {
      id: createId("memo"),
      userId: "default",
      title: input.title?.trim() || "未命名 Memo",
      content: input.content,
      status: "draft",
      historyReason: null,
      sortOrder: Date.parse(now),
      lastActiveSortOrder: null,
      autoArchiveSuppressedUntilChange: false,
      aiState: "idle",
      aiError: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      historyAt: null,
      deletedAt: null,
      todos: []
    };

    await this.saveMemo(draft);
    await this.trimDrafts(3);
    return draft;
  }

  async listRecentDrafts(limit: number): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'draft' AND deleted_at IS NULL
         ORDER BY updated_at DESC, id DESC
         LIMIT ?`
      )
      .bind("default", limit)
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async publishMemo(input: PublishMemoInput, now: string): Promise<Memo> {
    const existing = input.draftId ? await this.findMemo(input.draftId) : null;
    const nextSortOrder = await this.nextFrontSortOrder();
    const memo: Memo = {
      ...(existing ?? createEmptyMemo(createId("memo"), now)),
      title: input.title.trim(),
      content: input.content,
      status: "active",
      historyReason: null,
      sortOrder: nextSortOrder,
      updatedAt: now,
      publishedAt: now,
      deletedAt: null,
      todos: input.todos.map((todo, index) => ({
        id: createId("todo"),
        memoId: existing?.id ?? "",
        title: todo.title.trim(),
        notes: todo.notes?.trim() || null,
        status: "todo",
        sortOrder: index + 1,
        generatedByAi: Boolean(todo.generatedByAi),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null
      }))
    };
    memo.todos = memo.todos.map((todo) => ({ ...todo, memoId: memo.id }));

    await this.saveMemo(memo);
    return (await this.findMemo(memo.id)) ?? memo;
  }

  async listActiveMemos(): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
         ORDER BY sort_order ASC`
      )
      .bind("default")
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async listHistoryMemos(): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'history' AND deleted_at IS NULL
         ORDER BY history_at DESC, updated_at DESC`
      )
      .bind("default")
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async searchHistoryMemos(query: string): Promise<Memo[]> {
    const normalized = query.trim();
    if (!normalized) {
      return this.listHistoryMemos();
    }

    const pattern = `%${normalized.toLowerCase()}%`;
    const rows = await this.db
      .prepare(
        `SELECT DISTINCT memos.*
         FROM memos
         LEFT JOIN memo_todos ON memo_todos.memo_id = memos.id AND memo_todos.deleted_at IS NULL
         WHERE memos.user_id = ?
           AND memos.status = 'history'
           AND memos.deleted_at IS NULL
           AND (
             lower(memos.title) LIKE ?
             OR lower(memos.content) LIKE ?
             OR lower(memo_todos.title) LIKE ?
             OR lower(coalesce(memo_todos.notes, '')) LIKE ?
           )
         ORDER BY memos.history_at DESC, memos.updated_at DESC`
      )
      .bind("default", pattern, pattern, pattern, pattern)
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async findTodo(todoId: string): Promise<MemoTodo | null> {
    const row = await this.db
      .prepare("SELECT * FROM memo_todos WHERE id = ? AND deleted_at IS NULL")
      .bind(todoId)
      .first<TodoRow>();
    return row ? mapTodo(row) : null;
  }

  async updateTodo(todo: MemoTodo): Promise<MemoTodo> {
    await this.upsertTodo(todo);
    return todo;
  }

  async createTodo(
    memoId: string,
    input: { title: string; notes?: string | null; generatedByAi?: boolean },
    now: string
  ): Promise<MemoTodo> {
    const maxOrder = await this.db
      .prepare("SELECT MAX(sort_order) AS value FROM memo_todos WHERE memo_id = ? AND deleted_at IS NULL")
      .bind(memoId)
      .first<{ value: number | null }>();
    const todo: MemoTodo = {
      id: createId("todo"),
      memoId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      status: "todo",
      sortOrder: (maxOrder?.value ?? 0) + 1,
      generatedByAi: Boolean(input.generatedByAi),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null
    };
    await this.upsertTodo(todo);
    await this.db
      .prepare("UPDATE memos SET auto_archive_suppressed_until_change = 0, updated_at = ? WHERE id = ?")
      .bind(now, memoId)
      .run();
    return todo;
  }

  async deleteTodo(todoId: string, now: string): Promise<MemoTodo | null> {
    const todo = await this.findTodo(todoId);
    if (!todo) {
      return null;
    }

    const deleted = { ...todo, deletedAt: now, updatedAt: now };
    await this.upsertTodo(deleted);
    await this.db
      .prepare("UPDATE memos SET auto_archive_suppressed_until_change = 0, updated_at = ? WHERE id = ?")
      .bind(now, todo.memoId)
      .run();
    return deleted;
  }

  async reorderTodos(memoId: string, todoIds: string[], now: string): Promise<MemoTodo[]> {
    await this.db.batch(
      todoIds.map((id, index) =>
        this.db
          .prepare("UPDATE memo_todos SET sort_order = ?, updated_at = ? WHERE id = ? AND memo_id = ? AND deleted_at IS NULL")
          .bind(index + 1, now, id, memoId)
      )
    );
    await this.db.prepare("UPDATE memos SET updated_at = ? WHERE id = ?").bind(now, memoId).run();
    const memo = await this.findMemo(memoId);
    return memo?.todos ?? [];
  }

  async findMemo(memoId: string): Promise<Memo | null> {
    const row = await this.db.prepare("SELECT * FROM memos WHERE id = ?").bind(memoId).first<MemoRow>();
    if (!row) {
      return null;
    }

    const [memo] = await this.hydrateMemos([row]);
    return memo ?? null;
  }

  async saveMemo(memo: Memo): Promise<Memo> {
    await this.upsertMemo(memo);
    if (memo.todos.length > 0) {
      await this.db.batch(memo.todos.map((todo) => this.todoStatement(todo)));
    }
    return memo;
  }

  async reorderMemos(memoIds: string[], now: string): Promise<Memo[]> {
    await this.db.batch(
      memoIds.map((id, index) =>
        this.db
          .prepare("UPDATE memos SET sort_order = ?, updated_at = ? WHERE id = ? AND status = 'active' AND deleted_at IS NULL")
          .bind(index + 1, now, id)
      )
    );
    return this.listActiveMemos();
  }

  async softDeleteHistoryMemos(memoIds: string[], now: string): Promise<Memo[]> {
    const deleted: Memo[] = [];
    for (const id of memoIds) {
      const memo = await this.findMemo(id);
      if (memo?.status === "history" && memo.deletedAt === null) {
        const next = { ...memo, status: "deleted" as const, deletedAt: now, updatedAt: now };
        await this.saveMemo(next);
        deleted.push(next);
      }
    }
    return deleted;
  }

  async restoreDeletedMemos(memoIds: string[], now: string): Promise<Memo[]> {
    const restored: Memo[] = [];
    for (const id of memoIds) {
      const memo = await this.findMemo(id);
      if (memo?.status === "deleted") {
        const next = { ...memo, status: "history" as const, deletedAt: null, updatedAt: now };
        await this.saveMemo(next);
        restored.push(next);
      }
    }
    return restored;
  }

  async listExportableMemos(): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status IN ('active', 'history') AND deleted_at IS NULL
         ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, sort_order ASC, history_at DESC`
      )
      .bind("default")
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async getAiSettings(now: string): Promise<AiSettings> {
    const row = await this.db.prepare("SELECT * FROM ai_settings WHERE id = ?").bind("default").first<AiSettingsRow>();
    if (row) {
      return mapAiSettings(row);
    }

    const settings = createDefaultAiSettings(now);
    await this.upsertAiSettings(settings);
    return settings;
  }

  async saveAiSettings(input: AiSettingsInput, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(now);
    const settings: AiSettings = {
      ...existing,
      baseUrl: input.baseUrl.trim(),
      model: input.model.trim() || "dsv4-pro",
      encryptedApiKey: input.apiKey ? encryptPlaceholder(input.apiKey) : existing.encryptedApiKey,
      apiKeyMask: input.apiKey ? maskApiKey(input.apiKey) : existing.apiKeyMask,
      promptTemplate: input.promptTemplate,
      updatedAt: now
    };
    await this.upsertAiSettings(settings);
    return settings;
  }

  async resetAiPrompt(promptTemplate: string, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(now);
    const settings = { ...existing, promptTemplate, updatedAt: now };
    await this.upsertAiSettings(settings);
    return settings;
  }

  async getSyncStatus(now: string): Promise<SyncStatus> {
    const row = await this.db.prepare("SELECT * FROM sync_meta WHERE id = ?").bind("default").first<{
      last_success_at: string | null;
      last_error: string | null;
      updated_at: string;
    }>();
    if (!row) {
      await this.db
        .prepare("INSERT INTO sync_meta (id, last_success_at, last_error, updated_at) VALUES (?, ?, ?, ?)")
        .bind("default", now, null, now)
        .run();
      return { ok: true, lastSuccessAt: now, lastError: null, updatedAt: now };
    }

    return {
      ok: row.last_error === null,
      lastSuccessAt: row.last_success_at,
      lastError: row.last_error,
      updatedAt: row.updated_at
    };
  }

  private async hydrateMemos(rows: MemoRow[]): Promise<Memo[]> {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(", ");
    const todos = await this.db
      .prepare(
        `SELECT * FROM memo_todos
         WHERE memo_id IN (${placeholders}) AND deleted_at IS NULL
         ORDER BY sort_order ASC`
      )
      .bind(...ids)
      .all<TodoRow>();
    const todosByMemo = groupTodos(todos.results.map(mapTodo));
    return rows.map((row) => ({ ...mapMemo(row), todos: todosByMemo.get(row.id) ?? [] }));
  }

  private async nextFrontSortOrder(): Promise<number> {
    const row = await this.db
      .prepare("SELECT MIN(sort_order) AS value FROM memos WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL")
      .bind("default")
      .first<{ value: number | null }>();
    return row?.value === null || row?.value === undefined ? 1000 : row.value - 1;
  }

  private async trimDrafts(limit: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE memos
         SET status = 'deleted', deleted_at = updated_at
         WHERE status = 'draft'
           AND id NOT IN (
             SELECT id FROM memos
             WHERE user_id = ? AND status = 'draft' AND deleted_at IS NULL
             ORDER BY updated_at DESC, id DESC
             LIMIT ?
           )`
      )
      .bind("default", limit)
      .run();
  }

  private async upsertMemo(memo: Memo): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO memos (
          id, user_id, title, content, status, history_reason, sort_order, last_active_sort_order,
          auto_archive_suppressed_until_change, ai_state, ai_error, created_at, updated_at,
          published_at, history_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          title = excluded.title,
          content = excluded.content,
          status = excluded.status,
          history_reason = excluded.history_reason,
          sort_order = excluded.sort_order,
          last_active_sort_order = excluded.last_active_sort_order,
          auto_archive_suppressed_until_change = excluded.auto_archive_suppressed_until_change,
          ai_state = excluded.ai_state,
          ai_error = excluded.ai_error,
          updated_at = excluded.updated_at,
          published_at = excluded.published_at,
          history_at = excluded.history_at,
          deleted_at = excluded.deleted_at`
      )
      .bind(
        memo.id,
        memo.userId,
        memo.title,
        memo.content,
        memo.status,
        memo.historyReason,
        memo.sortOrder,
        memo.lastActiveSortOrder,
        memo.autoArchiveSuppressedUntilChange ? 1 : 0,
        memo.aiState,
        memo.aiError,
        memo.createdAt,
        memo.updatedAt,
        memo.publishedAt,
        memo.historyAt,
        memo.deletedAt
      )
      .run();
  }

  private todoStatement(todo: MemoTodo): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO memo_todos (
          id, memo_id, title, notes, status, sort_order, generated_by_ai,
          created_at, updated_at, completed_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          memo_id = excluded.memo_id,
          title = excluded.title,
          notes = excluded.notes,
          status = excluded.status,
          sort_order = excluded.sort_order,
          generated_by_ai = excluded.generated_by_ai,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          deleted_at = excluded.deleted_at`
      )
      .bind(
        todo.id,
        todo.memoId,
        todo.title,
        todo.notes,
        todo.status,
        todo.sortOrder,
        todo.generatedByAi ? 1 : 0,
        todo.createdAt,
        todo.updatedAt,
        todo.completedAt,
        todo.deletedAt
      );
  }

  private async upsertTodo(todo: MemoTodo): Promise<void> {
    await this.todoStatement(todo).run();
  }

  private async upsertAiSettings(settings: AiSettings): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ai_settings (
          id, user_id, base_url, model, encrypted_api_key, api_key_mask,
          prompt_template, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          base_url = excluded.base_url,
          model = excluded.model,
          encrypted_api_key = excluded.encrypted_api_key,
          api_key_mask = excluded.api_key_mask,
          prompt_template = excluded.prompt_template,
          updated_at = excluded.updated_at`
      )
      .bind(
        settings.id,
        settings.userId,
        settings.baseUrl,
        settings.model,
        settings.encryptedApiKey,
        settings.apiKeyMask,
        settings.promptTemplate,
        settings.createdAt,
        settings.updatedAt
      )
      .run();
  }
}

function mapMemo(row: MemoRow): Memo {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    status: row.status,
    historyReason: row.history_reason,
    sortOrder: row.sort_order,
    lastActiveSortOrder: row.last_active_sort_order,
    autoArchiveSuppressedUntilChange: row.auto_archive_suppressed_until_change === 1,
    aiState: row.ai_state,
    aiError: row.ai_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    historyAt: row.history_at,
    deletedAt: row.deleted_at,
    todos: []
  };
}

function mapTodo(row: TodoRow): MemoTodo {
  return {
    id: row.id,
    memoId: row.memo_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    sortOrder: row.sort_order,
    generatedByAi: row.generated_by_ai === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at
  };
}

function mapAiSettings(row: AiSettingsRow): AiSettings {
  return {
    id: row.id,
    userId: row.user_id,
    baseUrl: row.base_url,
    model: row.model,
    encryptedApiKey: row.encrypted_api_key,
    apiKeyMask: row.api_key_mask,
    promptTemplate: row.prompt_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function groupTodos(todos: MemoTodo[]): Map<string, MemoTodo[]> {
  const byMemo = new Map<string, MemoTodo[]>();
  for (const todo of todos) {
    byMemo.set(todo.memoId, [...(byMemo.get(todo.memoId) ?? []), todo]);
  }
  return byMemo;
}

function createEmptyMemo(id: string, now: string): Memo {
  return {
    id,
    userId: "default",
    title: "未命名 Memo",
    content: "",
    status: "draft",
    historyReason: null,
    sortOrder: 1000,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    historyAt: null,
    deletedAt: null,
    todos: []
  };
}

function createDefaultAiSettings(now: string): AiSettings {
  return {
    id: "default",
    userId: "default",
    baseUrl: "",
    model: "dsv4-pro",
    encryptedApiKey: null,
    apiKeyMask: null,
    promptTemplate: DEFAULT_PROMPT,
    createdAt: now,
    updatedAt: now
  };
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function encryptPlaceholder(apiKey: string): string {
  return `encrypted:${apiKey.length}:${apiKey.slice(-4)}`;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
