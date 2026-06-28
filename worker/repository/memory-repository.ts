import type { Memo, MemoTodo } from "../domain/types";
import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL, DEFAULT_PROMPT, normalizePromptTemplate } from "../../src/shared/ai-defaults";
import { extractMemoTagsFromText, memoHasTag, normalizeMemoTag, normalizeMemoTags } from "../../src/shared/memo-tags";
import type { AiSettings, AiSettingsInput, DraftInput, MemoRepository, PublishMemoInput, SyncStatus } from "./types";

let idCounter = 0;

function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function cloneMemo(memo: Memo): Memo {
  return {
    ...memo,
    aiResult: memo.aiResult
      ? {
          title: memo.aiResult.title,
          todos: memo.aiResult.todos.map((todo) => ({ ...todo }))
        }
      : null,
    tags: [...memo.tags],
    todos: memo.todos.filter((todo) => todo.deletedAt === null).map((todo) => ({ ...todo }))
  };
}

export class MemoryRepository implements MemoRepository {
  private memos: Memo[] = [];
  private aiSettings = new Map<string, AiSettings>();
  private syncStatus = new Map<string, SyncStatus>();

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
      tags: tagsFromInput(input.tags, input.title?.trim() || "未命名 Memo", input.content),
      todos: []
    };

    this.memos.push(draft);
    this.trimDrafts(userId, 3);
    return cloneMemo(draft);
  }

  async updateDraft(userId: string, draftId: string, input: DraftInput, now: string): Promise<Memo | null> {
    const draft = this.memos.find((memo) => memo.userId === userId && memo.id === draftId && memo.status === "draft" && memo.deletedAt === null);
    if (!draft) {
      return null;
    }

    draft.title = input.title?.trim() || "未命名 Memo";
    draft.content = input.content;
    draft.tags = tagsFromInput(input.tags, draft.title, draft.content);
    draft.aiState = "idle";
    draft.aiError = null;
    draft.aiResult = null;
    draft.updatedAt = now;
    this.trimDrafts(userId, 3);
    return cloneMemo(draft);
  }

  async listRecentDrafts(userId: string, limit: number): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.userId === userId && memo.status === "draft" && memo.deletedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
      .slice(0, limit)
      .map(cloneMemo);
  }

  async publishMemo(userId: string, input: PublishMemoInput, now: string): Promise<Memo> {
    const memo = input.draftId ? this.memos.find((candidate) => candidate.userId === userId && candidate.id === input.draftId) : undefined;
    const nextSortOrder = this.nextFrontSortOrder(userId);
    const todos = input.todos.map((todo, index): MemoTodo => {
      const memoId = memo?.id ?? "pending";
      return {
        id: createId("todo"),
        memoId,
        title: todo.title.trim(),
        notes: todo.notes?.trim() || null,
        status: "todo",
        sortOrder: index + 1,
        generatedByAi: Boolean(todo.generatedByAi),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null
      };
    });

    if (memo) {
      const hasAiTodos = todos.some((todo) => todo.generatedByAi);
      Object.assign(memo, {
        title: input.title.trim(),
        content: input.content,
        status: "active",
        sortOrder: nextSortOrder,
        aiState: hasAiTodos ? "done" : "idle",
        aiError: null,
        aiResult: hasAiTodos ? memo.aiResult : null,
        updatedAt: now,
        publishedAt: now,
        tags: tagsFromInput(input.tags, input.title, input.content),
        todos: todos.map((todo) => ({ ...todo, memoId: memo.id }))
      });
      return cloneMemo(memo);
    }

    const published: Memo = {
      id: createId("memo"),
      userId,
      title: input.title.trim(),
      content: input.content,
      status: "active",
      historyReason: null,
      sortOrder: nextSortOrder,
      lastActiveSortOrder: null,
      autoArchiveSuppressedUntilChange: false,
      aiState: todos.some((todo) => todo.generatedByAi) ? "done" : "idle",
      aiError: null,
      aiResult: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      historyAt: null,
      deletedAt: null,
      tags: tagsFromInput(input.tags, input.title, input.content),
      todos: []
    };
    published.todos = todos.map((todo) => ({ ...todo, memoId: published.id }));
    this.memos.push(published);
    return cloneMemo(published);
  }

  async listActiveMemos(userId: string, tag?: string): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.userId === userId && memo.status === "active" && memo.deletedAt === null)
      .filter((memo) => !tag || memoHasTag(memo.tags, tag))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(cloneMemo);
  }

  async listHistoryMemos(userId: string): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.userId === userId && memo.status === "history" && memo.deletedAt === null)
      .sort((a, b) => (b.historyAt ?? "").localeCompare(a.historyAt ?? ""))
      .map(cloneMemo);
  }

  async searchHistoryMemos(userId: string, query: string, tag?: string): Promise<Memo[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      const history = await this.listHistoryMemos(userId);
      return tag ? history.filter((memo) => memoHasTag(memo.tags, tag)) : history;
    }

    return this.memos
      .filter((memo) => memo.userId === userId && memo.status === "history" && memo.deletedAt === null)
      .filter((memo) => !tag || memoHasTag(memo.tags, tag))
      .filter((memo) => {
        const fields = [
          memo.title,
          memo.content,
          ...memo.todos.flatMap((todo) => [todo.title, todo.notes ?? ""])
        ];
        return fields.some((field) => field.toLowerCase().includes(normalized));
      })
      .sort((a, b) => (b.historyAt ?? "").localeCompare(a.historyAt ?? ""))
      .map(cloneMemo);
  }

  async listTags(userId: string): Promise<string[]> {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const memo of this.memos) {
      if (memo.userId !== userId || (memo.status !== "active" && memo.status !== "history") || memo.deletedAt !== null) {
        continue;
      }

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
    const todo = this.memos.filter((memo) => memo.userId === userId).flatMap((memo) => memo.todos).find((candidate) => candidate.id === todoId);
    return todo ? { ...todo } : null;
  }

  async updateTodo(userId: string, todo: MemoTodo): Promise<MemoTodo> {
    for (const memo of this.memos) {
      if (memo.userId !== userId) {
        continue;
      }
      const index = memo.todos.findIndex((candidate) => candidate.id === todo.id);
      if (index >= 0) {
        memo.todos[index] = { ...todo };
        memo.updatedAt = todo.updatedAt;
        return { ...todo };
      }
    }

    throw new Error("Todo not found");
  }

  async createTodo(
    userId: string,
    memoId: string,
    input: { title: string; notes?: string | null; generatedByAi?: boolean },
    now: string
  ): Promise<MemoTodo> {
    const memo = this.memos.find((candidate) => candidate.userId === userId && candidate.id === memoId && candidate.deletedAt === null);
    if (!memo) {
      throw new Error("Memo not found");
    }

    const maxOrder = Math.max(0, ...memo.todos.filter((todo) => todo.deletedAt === null).map((todo) => todo.sortOrder));
    const todo: MemoTodo = {
      id: createId("todo"),
      memoId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      status: "todo",
      sortOrder: maxOrder + 1,
      generatedByAi: Boolean(input.generatedByAi),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null
    };
    memo.todos.push(todo);
    memo.updatedAt = now;
    memo.autoArchiveSuppressedUntilChange = false;
    return { ...todo };
  }

  async deleteTodo(userId: string, todoId: string, now: string): Promise<MemoTodo | null> {
    const todo = this.memos.filter((memo) => memo.userId === userId).flatMap((memo) => memo.todos).find((candidate) => candidate.id === todoId);
    if (!todo || todo.deletedAt !== null) {
      return null;
    }

    todo.deletedAt = now;
    todo.updatedAt = now;
    const memo = this.memos.find((candidate) => candidate.userId === userId && candidate.id === todo.memoId);
    if (memo) {
      memo.updatedAt = now;
      memo.autoArchiveSuppressedUntilChange = false;
    }
    return { ...todo };
  }

  async reorderTodos(userId: string, memoId: string, todoIds: string[], now: string): Promise<MemoTodo[]> {
    const memo = this.memos.find((candidate) => candidate.userId === userId && candidate.id === memoId && candidate.deletedAt === null);
    if (!memo) {
      return [];
    }

    const orderById = new Map(todoIds.map((id, index) => [id, index + 1]));
    for (const todo of memo.todos) {
      const order = orderById.get(todo.id);
      if (order !== undefined && todo.deletedAt === null) {
        todo.sortOrder = order;
        todo.updatedAt = now;
      }
    }
    memo.updatedAt = now;
    return memo.todos
      .filter((todo) => todo.deletedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((todo) => ({ ...todo }));
  }

  async findMemo(userId: string, memoId: string): Promise<Memo | null> {
    const memo = this.memos.find((candidate) => candidate.userId === userId && candidate.id === memoId);
    return memo ? cloneMemo(memo) : null;
  }

  async saveMemo(userId: string, memo: Memo): Promise<Memo> {
    const scopedMemo = { ...memo, userId, tags: normalizeMemoTags(memo.tags ?? extractMemoTagsFromText(memo.title, memo.content)) };
    const index = this.memos.findIndex((candidate) => candidate.id === memo.id);
    if (index < 0) {
      this.memos.push(cloneMemo(scopedMemo));
    } else {
      this.memos[index] = cloneMemo(scopedMemo);
    }
    return cloneMemo(scopedMemo);
  }

  async reorderMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    const orderById = new Map(memoIds.map((id, index) => [id, index + 1]));
    for (const memo of this.memos) {
      const order = orderById.get(memo.id);
      if (order !== undefined && memo.userId === userId && memo.status === "active" && memo.deletedAt === null) {
        memo.sortOrder = order;
        memo.updatedAt = now;
      }
    }

    return this.listActiveMemos(userId);
  }

  async softDeleteHistoryMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    const ids = new Set(memoIds);
    const deleted: Memo[] = [];
    for (const memo of this.memos) {
      if (ids.has(memo.id) && memo.userId === userId && memo.status === "history" && memo.deletedAt === null) {
        memo.status = "deleted";
        memo.deletedAt = now;
        memo.updatedAt = now;
        deleted.push(cloneMemo(memo));
      }
    }

    return deleted;
  }

  async restoreDeletedMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]> {
    const ids = new Set(memoIds);
    const restored: Memo[] = [];
    for (const memo of this.memos) {
      if (ids.has(memo.id) && memo.userId === userId && memo.status === "deleted") {
        memo.status = "history";
        memo.deletedAt = null;
        memo.updatedAt = now;
        restored.push(cloneMemo(memo));
      }
    }

    return restored;
  }

  async listExportableMemos(userId: string): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.userId === userId && (memo.status === "active" || memo.status === "history") && memo.deletedAt === null)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        if (a.status === "active") {
          return a.sortOrder - b.sortOrder;
        }
        return (b.historyAt ?? "").localeCompare(a.historyAt ?? "");
      })
      .map(cloneMemo);
  }

  async getAiSettings(userId: string, now: string): Promise<AiSettings> {
    if (!this.aiSettings.has(userId)) {
      this.aiSettings.set(userId, createDefaultAiSettings(userId, now));
    }

    const settings = this.aiSettings.get(userId)!;
    const normalizedPrompt = normalizePromptTemplate(settings.promptTemplate);
    if (normalizedPrompt !== settings.promptTemplate) {
      settings.promptTemplate = normalizedPrompt;
      settings.updatedAt = now;
      this.aiSettings.set(userId, settings);
    }

    return { ...settings };
  }

  async saveAiSettings(userId: string, input: AiSettingsInput, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(userId, now);
    const settings = {
      ...existing,
      baseUrl: input.baseUrl.trim(),
      model: input.model.trim(),
      encryptedApiKey: input.encryptedApiKey ?? existing.encryptedApiKey,
      apiKeyMask: input.apiKeyMask ?? existing.apiKeyMask,
      promptTemplate: input.promptTemplate,
      updatedAt: now
    };
    this.aiSettings.set(userId, settings);
    return { ...settings };
  }

  async resetAiPrompt(userId: string, promptTemplate: string, now: string): Promise<AiSettings> {
    const existing = await this.getAiSettings(userId, now);
    const settings = {
      ...existing,
      promptTemplate,
      updatedAt: now
    };
    this.aiSettings.set(userId, settings);
    return { ...settings };
  }

  async getSyncStatus(userId: string, now: string): Promise<SyncStatus> {
    const status = this.syncStatus.get(userId) ?? {
      ok: true,
      lastSuccessAt: now,
      lastError: null,
      updatedAt: now
    };
    this.syncStatus.set(userId, status);
    return { ...status };
  }

  async markSyncSuccess(userId: string, now: string): Promise<SyncStatus> {
    const status = {
      ok: true,
      lastSuccessAt: now,
      lastError: null,
      updatedAt: now
    };
    this.syncStatus.set(userId, status);
    return { ...status };
  }

  private nextFrontSortOrder(userId: string): number {
    const activeOrders = this.memos.filter((memo) => memo.userId === userId && memo.status === "active").map((memo) => memo.sortOrder);
    return activeOrders.length === 0 ? 1000 : Math.min(...activeOrders) - 1;
  }

  private trimDrafts(userId: string, limit: number): void {
    const drafts = this.memos
      .filter((memo) => memo.userId === userId && memo.status === "draft")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    const keepIds = new Set(drafts.slice(0, limit).map((memo) => memo.id));
    this.memos = this.memos.filter((memo) => memo.userId !== userId || memo.status !== "draft" || keepIds.has(memo.id));
  }
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

function tagsFromInput(tags: string[] | undefined, title: string, content: string): string[] {
  return tags ? normalizeMemoTags(tags) : extractMemoTagsFromText(title, content);
}
