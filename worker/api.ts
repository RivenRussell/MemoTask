import { Hono } from "hono";
import { moveMemoToHistory, shouldAutoArchiveMemo, toggleTodoStatus } from "./domain/state-machines";
import { MemoryRepository } from "./repository/memory-repository";
import type { MemoRepository } from "./repository/types";

interface ApiOptions {
  repository?: MemoRepository;
  now?: () => string;
}

function getNow(options?: ApiOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

async function readJson<T>(context: { req: { json: () => Promise<T> } }): Promise<T> {
  return context.req.json();
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

  app.get("/api/history", async (context) => {
    const memos = await repository.listHistoryMemos();
    return context.json({ memos });
  });

  return app;
}
