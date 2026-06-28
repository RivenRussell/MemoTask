import type { Memo, MemoTodo } from "../domain/types";
import type { AiSettings, AiSettingsInput, DraftInput, MemoRepository, PublishMemoInput, SyncStatus } from "./types";
import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL, DEFAULT_PROMPT, normalizePromptTemplate } from "../../src/shared/ai-defaults";
import { extractMemoTagsFromText, memoHasTag, normalizeMemoTag } from "../../src/shared/memo-tags";

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
  ai_result_json?: string | null;
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

type MemoTagRow = {
  memo_id: string;
  user_id?: string | null;
  name: string;
  normalized_name: string;
  sort_order: number;
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

  async createDraft(userId: string, input: DraftInput, now: string): Promise<Memo> {
    const draft: Memo = {
      id: createId("memo"),
      userId,
      title: input.title?.trim() || "未命名 Memo",
      content: input.content,
      status: "draft",
      historyReason: null,
      sortOrder: Date.parse(now),
      lastActiveSortOrder: null,
      autoArchiveSuppressedUntilChange: false,
      aiState: "idle",
      aiError: null,
      aiResult: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      historyAt: null,
      deletedAt: null,
      tags: extractMemoTagsFromText(input.title?.trim() || "未命名 Memo", input.content),
      todos: []
    };

    await this.saveMemo(userId, draft);
    await this.trimDrafts(userId, 3);
    return draft;
  }

  async updateDraft(userId: string, draftId: string, input: DraftInput, now: string): Promise<Memo | null> {
    const draft = await this.findMemo(userId, draftId);
    if (!draft || draft.status !== "draft" || draft.deletedAt !== null) {
      return null;
    }

    const title = input.title?.trim() || "未命名 Memo";
    await this.db
      .prepare(
        `UPDATE memos
         SET title = ?, content = ?, ai_state = 'idle', ai_error = NULL, ai_result_json = NULL, updated_at = ?
         WHERE id = ? AND user_id = ? AND status = 'draft' AND deleted_at IS NULL`
      )
      .bind(title, input.content, now, draftId, userId)
      .run();
    await this.syncMemoTags(userId, draftId, extractMemoTagsFromText(title, input.content));
    await this.trimDrafts(userId, 3);
    return this.findMemo(userId, draftId);
  }

  async listRecentDrafts(userId: string, limit: number): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'draft' AND deleted_at IS NULL
         ORDER BY updated_at DESC, id DESC
         LIMIT ?`
      )
      .bind(userId, limit)
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async publishMemo(userId: string, input: PublishMemoInput, now: string): Promise<Memo> {
    const existing = input.draftId ? await this.findMemo(userId, input.draftId) : null;
    const nextSortOrder = await this.nextFrontSortOrder(userId);
    const hasAiTodos = input.todos.some((todo) => todo.generatedByAi);
    const memo: Memo = {
      ...(existing ?? createEmptyMemo(userId, createId("memo"), now)),
      title: input.title.trim(),
      content: input.content,
      status: "active",
      historyReason: null,
      sortOrder: nextSortOrder,
      aiState: hasAiTodos ? "done" : "idle",
      aiError: null,
      aiResult: hasAiTodos ? existing?.aiResult ?? null : null,
      updatedAt: now,
      publishedAt: now,
      deletedAt: null,
      tags: extractMemoTagsFromText(input.title, input.content),
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

    await this.saveMemo(userId, memo);
    return (await this.findMemo(userId, memo.id)) ?? memo;
  }

  async listActiveMemos(userId: string, tag?: string): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
         ORDER BY sort_order ASC`
      )
      .bind(userId)
      .all<MemoRow>();
    const memos = await this.hydrateMemos(rows.results);
    return tag ? memos.filter((memo) => memoHasTag(memo.tags, tag)) : memos;
  }

  async listHistoryMemos(userId: string): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status = 'history' AND deleted_at IS NULL
         ORDER BY history_at DESC, updated_at DESC`
      )
      .bind(userId)
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async searchHistoryMemos(userId: string, query: string, tag?: string): Promise<Memo[]> {
    const normalized = query.trim();
    if (!normalized) {
      const history = await this.listHistoryMemos(userId);
      return tag ? history.filter((memo) => memoHasTag(memo.tags, tag)) : history;
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
      .bind(userId, pattern, pattern, pattern, pattern)
      .all<MemoRow>();
    const memos = await this.hydrateMemos(rows.results);
    return tag ? memos.filter((memo) => memoHasTag(memo.tags, tag)) : memos;
  }

  async listTags(userId: string): Promise<string[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status IN ('active', 'history') AND deleted_at IS NULL
         ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, sort_order ASC, history_at DESC`
      )
      .bind(userId)
      .all<MemoRow>();
    const memos = await this.hydrateMemos(rows.results);
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const memo of memos) {
      for (const tag of memo.tags) {
        const normalized = normalizeMemoTag(tag);
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        tags.push(tag);
      }
    }

    return tags.sort((a, b) => normalizeMemoTag(a).localeCompare(normalizeMemoTag(b)));
  }

  async findTodo(userId: string, todoId: string): Promise<MemoTodo | null> {
    const row = await this.db
      .prepare(
        `SELECT memo_todos.*
         FROM memo_todos
         INNER JOIN memos ON memos.id = memo_todos.memo_id
         WHERE memo_todos.id = ? AND memos.user_id = ? AND memo_todos.deleted_at IS NULL`
      )
      .bind(todoId, userId)
      .first<TodoRow>();
    return row ? mapTodo(row) : null;
  }

  async updateTodo(userId: string, todo: MemoTodo): Promise<MemoTodo> {
    await this.db
      .prepare(
        `UPDATE memo_todos
         SET title = ?,
             notes = ?,
             status = ?,
             sort_order = ?,
             generated_by_ai = ?,
             updated_at = ?,
             completed_at = ?,
             deleted_at = ?
         WHERE id = ?
           AND memo_id = ?
           AND EXISTS (
             SELECT 1 FROM memos
             WHERE memos.id = memo_todos.memo_id AND memos.user_id = ?
           )`
      )
      .bind(
        todo.title,
        todo.notes,
        todo.status,
        todo.sortOrder,
        todo.generatedByAi ? 1 : 0,
        todo.updatedAt,
        todo.completedAt,
        todo.deletedAt,
        todo.id,
        todo.memoId,
        userId
      )
      .run();
    return todo;
  }

  async createTodo(
    userId: string,
    memoId: string,
    input: { title: string; notes?: string | null; generatedByAi?: boolean },
    now: string
  ): Promise<MemoTodo> {
    const memo = await this.findMemo(userId, memoId);
    if (!memo) {
      throw new Error("Memo not found");
    }

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

  async deleteTodo(userId: string, todoId: string, now: string): Promise<MemoTodo | null> {
    const todo = await this.findTodo(userId, todoId);
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

  async reorderTodos(userId: string, memoId: string, todoIds: string[], now: string): Promise<MemoTodo[]> {
    const memo = await this.findMemo(userId, memoId);
    if (!memo) {
      return [];
    }

    await this.db.batch(
      todoIds.map((id, index) =>
        this.db
          .prepare("UPDATE memo_todos SET sort_order = ?, updated_at = ? WHERE id = ? AND memo_id = ? AND deleted_at IS NULL")
          .bind(index + 1, now, id, memoId)
      )
    );
    await this.db.prepare("UPDATE memos SET updated_at = ? WHERE id = ?").bind(now, memoId).run();
    const updated = await this.findMemo(userId, memoId);
    return updated?.todos ?? [];
  }

  async findMemo(userId: string, memoId: string): Promise<Memo | null> {
    const row = await this.db.prepare("SELECT * FROM memos WHERE id = ? AND user_id = ?").bind(memoId, userId).first<MemoRow>();
    if (!row) {
      return null;
    }

    const [memo] = await this.hydrateMemos([row]);
    return memo ?? null;
  }

  async saveMemo(userId: string, memo: Memo): Promise<Memo> {
    const scopedMemo = { ...memo, userId, tags: extractMemoTagsFromText(memo.title, memo.content) };
    await this.upsertMemo(scopedMemo);
    if (memo.todos.length > 0) {
      await this.db.batch(memo.todos.map((todo) => this.todoStatement(todo)));
    }
    await this.syncMemoTags(userId, scopedMemo.id, scopedMemo.tags);
    return scopedMemo;
  }

  async reorderMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    await this.db.batch(
      memoIds.map((id, index) =>
        this.db
          .prepare("UPDATE memos SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL")
          .bind(index + 1, now, id, userId)
      )
    );
    return this.listActiveMemos(userId);
  }

  async softDeleteHistoryMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    const selected = await this.findMemosByIdsAndStatus(userId, memoIds, "history", true);
    if (selected.length === 0) {
      return [];
    }

    await this.updateMemoStatuses(
      userId,
      selected.map((memo) => memo.id),
      "deleted",
      now,
      now
    );
    return selected.map((memo) => ({ ...memo, status: "deleted", deletedAt: now, updatedAt: now }));
  }

  async restoreDeletedMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    const selected = await this.findMemosByIdsAndStatus(userId, memoIds, "deleted", false);
    if (selected.length === 0) {
      return [];
    }

    await this.updateMemoStatuses(
      userId,
      selected.map((memo) => memo.id),
      "history",
      now,
      null
    );
    return selected.map((memo) => ({ ...memo, status: "history", deletedAt: null, updatedAt: now }));
  }

  async listExportableMemos(userId: string): Promise<Memo[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ? AND status IN ('active', 'history') AND deleted_at IS NULL
         ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, sort_order ASC, history_at DESC`
      )
      .bind(userId)
      .all<MemoRow>();
    return this.hydrateMemos(rows.results);
  }

  async getAiSettings(userId: string, now: string): Promise<AiSettings> {
    const row = await this.db.prepare("SELECT * FROM ai_settings WHERE id = ? AND user_id = ?").bind(userId, userId).first<AiSettingsRow>();
    if (row) {
      const settings = mapAiSettings(row);
      const normalizedPrompt = normalizePromptTemplate(settings.promptTemplate);
      if (normalizedPrompt !== settings.promptTemplate) {
        const upgraded = { ...settings, promptTemplate: normalizedPrompt, updatedAt: now };
        await this.upsertAiSettings(upgraded);
        return upgraded;
      }
      return settings;
    }

    const settings = createDefaultAiSettings(userId, now);
    await this.upsertAiSettings(settings);
    return settings;
  }

  async saveAiSettings(userId: string, input: AiSettingsInput, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(userId, now);
    const settings: AiSettings = {
      ...existing,
      baseUrl: input.baseUrl.trim(),
      model: input.model.trim(),
      encryptedApiKey: input.encryptedApiKey ?? existing.encryptedApiKey,
      apiKeyMask: input.apiKeyMask ?? existing.apiKeyMask,
      promptTemplate: input.promptTemplate,
      updatedAt: now
    };
    await this.upsertAiSettings(settings);
    return settings;
  }

  async resetAiPrompt(userId: string, promptTemplate: string, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(userId, now);
    const settings = { ...existing, promptTemplate, updatedAt: now };
    await this.upsertAiSettings(settings);
    return settings;
  }

  async getSyncStatus(userId: string, now: string): Promise<SyncStatus> {
    const row = await this.db.prepare("SELECT * FROM sync_meta WHERE id = ?").bind(userId).first<{
      last_success_at: string | null;
      last_error: string | null;
      updated_at: string;
    }>();
    if (!row) {
      await this.db
        .prepare("INSERT INTO sync_meta (id, last_success_at, last_error, updated_at) VALUES (?, ?, ?, ?)")
        .bind(userId, now, null, now)
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

  async markSyncSuccess(userId: string, now: string): Promise<SyncStatus> {
    await this.db
      .prepare(
        `INSERT INTO sync_meta (id, last_success_at, last_error, updated_at)
         VALUES (?, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_success_at = excluded.last_success_at,
           last_error = NULL,
           updated_at = excluded.updated_at`
      )
      .bind(userId, now, now)
      .run();
    return { ok: true, lastSuccessAt: now, lastError: null, updatedAt: now };
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
    const tags = await this.db
      .prepare(
        `SELECT * FROM memo_tags
         WHERE memo_id IN (${placeholders})
         ORDER BY sort_order ASC`
      )
      .bind(...ids)
      .all<MemoTagRow>();
    const todosByMemo = groupTodos(todos.results.map(mapTodo));
    const tagsByMemo = groupTags(tags.results);
    return rows.map((row) => ({
      ...mapMemo(row),
      tags: tagsByMemo.get(row.id) ?? extractMemoTagsFromText(row.title, row.content),
      todos: todosByMemo.get(row.id) ?? []
    }));
  }

  private async findMemosByIdsAndStatus(
    userId: string,
    memoIds: string[],
    status: Memo["status"],
    requireNotDeleted: boolean
  ): Promise<Memo[]> {
    const orderedIds = [...new Set(memoIds)];
    if (orderedIds.length === 0) {
      return [];
    }

    const placeholders = orderedIds.map(() => "?").join(", ");
    const rows = await this.db
      .prepare(
        `SELECT * FROM memos
         WHERE user_id = ?
           AND status = ?
           ${requireNotDeleted ? "AND deleted_at IS NULL" : ""}
           AND id IN (${placeholders})`
      )
      .bind(userId, status, ...orderedIds)
      .all<MemoRow>();
    const memos = await this.hydrateMemos(rows.results);
    const byId = new Map(memos.map((memo) => [memo.id, memo]));
    return orderedIds.map((id) => byId.get(id)).filter((memo): memo is Memo => Boolean(memo));
  }

  private async updateMemoStatuses(
    userId: string,
    memoIds: string[],
    status: Memo["status"],
    updatedAt: string,
    deletedAt: string | null
  ): Promise<void> {
    const placeholders = memoIds.map(() => "?").join(", ");
    await this.db
      .prepare(
        `UPDATE memos
         SET status = ?, deleted_at = ?, updated_at = ?
         WHERE user_id = ? AND id IN (${placeholders})`
      )
      .bind(status, deletedAt, updatedAt, userId, ...memoIds)
      .run();
  }

  private async nextFrontSortOrder(userId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT MIN(sort_order) AS value FROM memos WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL")
      .bind(userId)
      .first<{ value: number | null }>();
    return row?.value === null || row?.value === undefined ? 1000 : row.value - 1;
  }

  private async trimDrafts(userId: string, limit: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE memos
         SET status = 'deleted', deleted_at = updated_at
         WHERE status = 'draft'
           AND user_id = ?
           AND id NOT IN (
             SELECT id FROM memos
             WHERE user_id = ? AND status = 'draft' AND deleted_at IS NULL
             ORDER BY updated_at DESC, id DESC
             LIMIT ?
           )`
      )
      .bind(userId, userId, limit)
      .run();
  }

  private async upsertMemo(memo: Memo): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO memos (
          id, user_id, title, content, status, history_reason, sort_order, last_active_sort_order,
          auto_archive_suppressed_until_change, ai_state, ai_error, ai_result_json, created_at, updated_at,
          published_at, history_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          ai_result_json = excluded.ai_result_json,
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
        serializeAiResult(memo.aiResult),
        memo.createdAt,
        memo.updatedAt,
        memo.publishedAt,
        memo.historyAt,
        memo.deletedAt
      )
      .run();
  }

  private async syncMemoTags(userId: string, memoId: string, tags: string[]): Promise<void> {
    await this.db.prepare("DELETE FROM memo_tags WHERE memo_id = ?").bind(memoId).run();
    if (tags.length === 0) {
      return;
    }

    await this.db.batch(
      tags.map((tag, index) =>
        this.db
          .prepare(
            `INSERT INTO memo_tags (memo_id, user_id, name, normalized_name, sort_order)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(memo_id, normalized_name) DO UPDATE SET
               user_id = excluded.user_id,
               name = excluded.name,
               sort_order = excluded.sort_order`
          )
          .bind(memoId, userId, tag, normalizeMemoTag(tag), index + 1)
      )
    );
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
    aiResult: parseAiResult(row.ai_result_json ?? null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    historyAt: row.history_at,
    deletedAt: row.deleted_at,
    tags: [],
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

function parseAiResult(value: string | null): Memo["aiResult"] {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Memo["aiResult"];
    if (!parsed || typeof parsed.title !== "string" || !Array.isArray(parsed.todos)) {
      return null;
    }
    return {
      title: parsed.title,
      todos: parsed.todos
        .filter((todo): todo is { title: string; notes: string | null } => Boolean(todo) && typeof todo.title === "string")
        .map((todo) => ({ title: todo.title, notes: typeof todo.notes === "string" ? todo.notes : null }))
    };
  } catch {
    return null;
  }
}

function serializeAiResult(value: Memo["aiResult"]): string | null {
  return value ? JSON.stringify(value) : null;
}

function groupTodos(todos: MemoTodo[]): Map<string, MemoTodo[]> {
  const byMemo = new Map<string, MemoTodo[]>();
  for (const todo of todos) {
    byMemo.set(todo.memoId, [...(byMemo.get(todo.memoId) ?? []), todo]);
  }
  return byMemo;
}

function groupTags(rows: MemoTagRow[]): Map<string, string[]> {
  const byMemo = new Map<string, string[]>();
  for (const row of rows) {
    byMemo.set(row.memo_id, [...(byMemo.get(row.memo_id) ?? []), row.name]);
  }
  return byMemo;
}

function createEmptyMemo(userId: string, id: string, now: string): Memo {
  return {
    id,
    userId,
    title: "未命名 Memo",
    content: "",
    status: "draft",
    historyReason: null,
    sortOrder: 1000,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    aiResult: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    historyAt: null,
    deletedAt: null,
    tags: [],
    todos: []
  };
}

function createDefaultAiSettings(userId: string, now: string): AiSettings {
  return {
    id: userId,
    userId,
    baseUrl: DEFAULT_AI_BASE_URL,
    model: DEFAULT_AI_MODEL,
    encryptedApiKey: null,
    apiKeyMask: null,
    promptTemplate: DEFAULT_PROMPT,
    createdAt: now,
    updatedAt: now
  };
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
