import { Hono } from "hono";
import { moveMemoToHistory, restoreMemoFromHistory, shouldAutoArchiveMemo, toggleTodoStatus } from "./domain/state-machines";
import { DEFAULT_PROMPT, MemoryRepository } from "./repository/memory-repository";
import type { AiSettings, MemoRepository } from "./repository/types";

interface ApiOptions {
  repository?: MemoRepository;
  now?: () => string;
  fetchAi?: (request: Request) => Promise<Response>;
}

const undoOperations = new Map<string, { memoIds: string[]; expiresAt: string }>();

function getNow(options?: ApiOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

async function readJson<T>(context: { req: { json: () => Promise<T> } }): Promise<T> {
  return context.req.json();
}

function publicAiSettings(settings: AiSettings) {
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeyMask: settings.apiKeyMask,
    promptTemplate: settings.promptTemplate,
    updatedAt: settings.updatedAt
  };
}

function extractAiContent(payload: any): string {
  return payload?.choices?.[0]?.message?.content ?? payload?.content ?? "";
}

function parseAiJson(content: string): { title: string; todos: Array<{ title: string; notes: string | null }> } {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { title?: unknown; todos?: unknown };
  if (typeof parsed.title !== "string" || !Array.isArray(parsed.todos)) {
    throw new Error("AI response shape is invalid");
  }

  return {
    title: parsed.title,
    todos: parsed.todos
      .filter((todo): todo is { title: unknown; notes?: unknown } => Boolean(todo) && typeof todo === "object")
      .map((todo) => ({
        title: typeof todo.title === "string" ? todo.title.trim() : "",
        notes: typeof todo.notes === "string" && todo.notes.trim() ? todo.notes.trim() : null
      }))
      .filter((todo) => todo.title.length > 0)
  };
}

export function createApi(options: ApiOptions = {}) {
  const repository = options.repository ?? new MemoryRepository();
  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));

  app.post("/api/drafts", async (context) => {
    const body = await readJson<{ title?: string; content?: string }>(context);
    if (!body.content?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, 400);
    }

    const draft = await repository.createDraft({ title: body.title, content: body.content }, getNow(options));
    return context.json({ draft }, 201);
  });

  app.get("/api/drafts/recent", async (context) => {
    const drafts = await repository.listRecentDrafts(3);
    return context.json({ drafts });
  });

  app.post("/api/memos/publish", async (context) => {
    const body = await readJson<{
      title?: string;
      content?: string;
      draftId?: string;
      todos?: Array<{ title?: string; notes?: string | null; generatedByAi?: boolean }>;
    }>(context);
    if (!body.content?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, 400);
    }

    const memo = await repository.publishMemo(
      {
        draftId: body.draftId,
        title: body.title?.trim() || "未命名 Memo",
        content: body.content,
        todos: (body.todos ?? [])
          .filter((todo) => todo.title?.trim())
          .map((todo) => ({
            title: todo.title?.trim() ?? "",
            notes: todo.notes ?? null,
            generatedByAi: todo.generatedByAi
          }))
      },
      getNow(options)
    );

    return context.json({ memo }, 201);
  });

  app.get("/api/memos", async (context) => {
    const memos = await repository.listActiveMemos();
    return context.json({ memos });
  });

  app.get("/api/memos/:id", async (context) => {
    const memo = await repository.findMemo(context.req.param("id"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    return context.json({ memo });
  });

  app.patch("/api/memos/:id", async (context) => {
    const memo = await repository.findMemo(context.req.param("id"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; content?: string }>(context);
    const updated = await repository.saveMemo({
      ...memo,
      title: body.title?.trim() || memo.title,
      content: body.content ?? memo.content,
      updatedAt: getNow(options)
    });
    return context.json({ memo: updated });
  });

  app.post("/api/memos/:id/archive", async (context) => {
    const memo = await repository.findMemo(context.req.param("id"));
    if (!memo || memo.status !== "active" || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const archived = await repository.saveMemo(moveMemoToHistory(memo, "archived", getNow(options)));
    return context.json({ memo: archived });
  });

  app.post("/api/memos/:id/restore", async (context) => {
    const memo = await repository.findMemo(context.req.param("id"));
    if (!memo || memo.status !== "history" || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const restored = await repository.saveMemo(restoreMemoFromHistory(memo, getNow(options)));
    return context.json({ memo: restored });
  });

  app.post("/api/memos/reorder", async (context) => {
    const body = await readJson<{ memoIds?: string[] }>(context);
    if (!Array.isArray(body.memoIds)) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "排序数据无效" } }, 400);
    }

    const memos = await repository.reorderMemos(body.memoIds, getNow(options));
    return context.json({ memos });
  });

  app.post("/api/todos/:id/toggle", async (context) => {
    const todo = await repository.findTodo(context.req.param("id"));
    if (!todo) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    const now = getNow(options);
    const updatedTodo = await repository.updateTodo(toggleTodoStatus(todo, now));
    const memo = await repository.findMemo(updatedTodo.memoId);
    if (memo) {
      const nextTodos = memo.todos.map((candidate) => (candidate.id === updatedTodo.id ? updatedTodo : candidate));
      const shouldArchive = shouldAutoArchiveMemo(nextTodos, memo.autoArchiveSuppressedUntilChange);
      await repository.saveMemo(
        shouldArchive
          ? moveMemoToHistory({ ...memo, todos: nextTodos }, "completed", now)
          : { ...memo, todos: nextTodos, autoArchiveSuppressedUntilChange: false, updatedAt: now }
      );
    }

    return context.json({ todo: updatedTodo });
  });

  app.post("/api/memos/:memoId/todos", async (context) => {
    const memo = await repository.findMemo(context.req.param("memoId"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; notes?: string | null; generatedByAi?: boolean }>(context);
    if (!body.title?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Todo 内容" } }, 400);
    }

    const todo = await repository.createTodo(
      memo.id,
      { title: body.title, notes: body.notes ?? null, generatedByAi: body.generatedByAi },
      getNow(options)
    );
    return context.json({ todo }, 201);
  });

  app.patch("/api/todos/:id", async (context) => {
    const todo = await repository.findTodo(context.req.param("id"));
    if (!todo) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; notes?: string | null }>(context);
    const updated = await repository.updateTodo({
      ...todo,
      title: body.title?.trim() || todo.title,
      notes: body.notes === undefined ? todo.notes : body.notes,
      updatedAt: getNow(options)
    });
    return context.json({ todo: updated });
  });

  app.delete("/api/todos/:id", async (context) => {
    const deleted = await repository.deleteTodo(context.req.param("id"), getNow(options));
    if (!deleted) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    return context.json({ todo: deleted });
  });

  app.post("/api/todos/reorder", async (context) => {
    const body = await readJson<{ memoId?: string; todoIds?: string[] }>(context);
    if (!body.memoId || !Array.isArray(body.todoIds)) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "排序数据无效" } }, 400);
    }

    const todos = await repository.reorderTodos(body.memoId, body.todoIds, getNow(options));
    return context.json({ todos });
  });

  app.get("/api/history", async (context) => {
    const memos = await repository.listHistoryMemos();
    return context.json({ memos });
  });

  app.get("/api/history/search", async (context) => {
    const memos = await repository.searchHistoryMemos(context.req.query("q") ?? "");
    return context.json({ memos });
  });

  app.post("/api/history/bulk-delete", async (context) => {
    const body = await readJson<{ memoIds?: string[] }>(context);
    if (!Array.isArray(body.memoIds) || body.memoIds.length === 0) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请选择要删除的 Memo" } }, 400);
    }

    const now = getNow(options);
    const deleted = await repository.softDeleteHistoryMemos(body.memoIds, now);
    const operation = {
      id: `undo-${crypto.randomUUID()}`,
      type: "history_bulk_delete",
      memoIds: deleted.map((memo) => memo.id),
      expiresAt: new Date(Date.parse(now) + 1000 * 60 * 5).toISOString()
    };
    undoOperations.set(operation.id, { memoIds: operation.memoIds, expiresAt: operation.expiresAt });
    return context.json({ operation, deletedCount: deleted.length });
  });

  app.post("/api/history/undo-delete", async (context) => {
    const body = await readJson<{ operationId?: string }>(context);
    const operation = body.operationId ? undoOperations.get(body.operationId) : undefined;
    if (!operation) {
      return context.json({ error: { code: "NOT_FOUND", message: "撤销操作不存在" } }, 404);
    }

    const restored = await repository.restoreDeletedMemos(operation.memoIds, getNow(options));
    undoOperations.delete(body.operationId ?? "");
    return context.json({ restored });
  });

  app.get("/api/export/json", async (context) => {
    const memos = await repository.listExportableMemos();
    return context.json({
      exportedAt: getNow(options),
      version: 1,
      memos,
      aiSettings: {
        model: "dsv4-pro",
        hasApiKey: false
      }
    });
  });

  app.get("/api/ai/settings", async (context) => {
    const settings = await repository.getAiSettings(getNow(options));
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.put("/api/ai/settings", async (context) => {
    const body = await readJson<{ baseUrl?: string; model?: string; apiKey?: string; promptTemplate?: string }>(context);
    const settings = await repository.saveAiSettings(
      {
        baseUrl: body.baseUrl ?? "",
        model: body.model || "dsv4-pro",
        apiKey: body.apiKey,
        promptTemplate: body.promptTemplate || DEFAULT_PROMPT
      },
      getNow(options)
    );
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.post("/api/ai/reset-prompt", async (context) => {
    const settings = await repository.resetAiPrompt(DEFAULT_PROMPT, getNow(options));
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.post("/api/ai/test", async (context) => {
    const settings = await repository.getAiSettings(getNow(options));
    if (!settings.baseUrl || !settings.encryptedApiKey) {
      return context.json({ error: { code: "AI_UNAVAILABLE", message: "请先在 Settings 配置 AI API" } }, 400);
    }

    const fetchAi = options.fetchAi ?? fetch;
    const response = await fetchAi(
      new Request(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "user", content: "MemoTask 连接测试" }],
          max_tokens: 8
        })
      })
    );

    if (!response.ok) {
      return context.json({ error: { code: "AI_FAILED", message: "AI 连接测试失败" } }, 502);
    }

    return context.json({ ok: true });
  });

  app.post("/api/ai/analyze-draft", async (context) => {
    const body = await readJson<{ draftId?: string }>(context);
    const settings = await repository.getAiSettings(getNow(options));
    if (!settings.baseUrl || !settings.encryptedApiKey) {
      return context.json({ error: { code: "AI_UNAVAILABLE", message: "请先在 Settings 配置 AI API" } }, 400);
    }

    const draft = body.draftId ? await repository.findMemo(body.draftId) : null;
    if (!draft || draft.status !== "draft") {
      return context.json({ error: { code: "NOT_FOUND", message: "草稿不存在" } }, 404);
    }

    const fetchAi = options.fetchAi ?? fetch;
    const response = await fetchAi(
      new Request(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: settings.promptTemplate },
            { role: "user", content: draft.content }
          ]
        })
      })
    );

    if (!response.ok) {
      return context.json({ error: { code: "AI_FAILED", message: "AI 分析失败" } }, 502);
    }

    try {
      const payload = await response.json();
      const result = parseAiJson(extractAiContent(payload));
      return context.json({ result });
    } catch {
      return context.json({ error: { code: "AI_INVALID_JSON", message: "AI 返回格式无效" } }, 502);
    }
  });

  app.get("/api/sync/status", async (context) => {
    const status = await repository.getSyncStatus(getNow(options));
    return context.json({ status });
  });

  return app;
}
