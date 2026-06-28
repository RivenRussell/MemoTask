import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../src/api/client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

describe("frontend API client", () => {
  it("includes browser credentials on every request so session cookies survive on mobile browsers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock);

    await client.listMemos();

    expect(fetchMock).toHaveBeenCalledWith("/api/memos", { credentials: "include" });
  });

  it("targets the configured API origin and keeps a mobile bearer session token", async () => {
    const storage = new Map<string, string>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "user-1", email: "owner@example.com", emailVerified: true }, sessionToken: "session-token" }))
      .mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock, {
      baseUrl: "https://memotask.rrwks.cn",
      sessionStorage: {
        get: (key) => storage.get(key) ?? null,
        set: (key, value) => storage.set(key, value),
        remove: (key) => storage.delete(key)
      }
    });

    await client.login({ email: "owner@example.com", password: "memo123" });
    await client.listMemos();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://memotask.rrwks.cn/api/auth/login",
      expect.objectContaining({
        credentials: "include",
        headers: { "content-type": "application/json", "x-memotask-client": "capacitor" }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://memotask.rrwks.cn/api/memos",
      expect.objectContaining({
        credentials: "include",
        headers: { authorization: "Bearer session-token", "x-memotask-client": "capacitor" }
      })
    );
  });

  it("binds the default browser fetch before making requests", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve(jsonResponse({ memos: [] }));
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    try {
      const client = new ApiClient();

      await expect(client.listMemos()).resolves.toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("publishes a memo and refreshes active memos through Worker endpoints", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ memo: { id: "memo-1", title: "新 Memo", todos: [] } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ memos: [{ id: "memo-1", title: "新 Memo", todos: [] }] }));
    const client = new ApiClient(fetchMock);

    const published = await client.publishMemo({
      title: "新 Memo",
      content: "原始内容",
      todos: [{ title: "第一步", notes: null, generatedByAi: false }]
    });
    const memos = await client.listMemos();

    expect(published.title).toBe("新 Memo");
    expect(memos.map((memo) => memo.title)).toEqual(["新 Memo"]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/memos/publish", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "新 Memo",
        content: "原始内容",
        todos: [{ title: "第一步", notes: null, generatedByAi: false }]
      })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/memos", { credentials: "include" });
  });

  it("requests shared memo tags and tag-filtered memo lists", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ tags: ["work"] }))
      .mockResolvedValueOnce(jsonResponse({ memos: [{ id: "memo-1", title: "工作", tags: ["work"], todos: [] }] }))
      .mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock);

    await expect(client.listTags()).resolves.toEqual(["work"]);
    await expect(client.listMemos("work")).resolves.toHaveLength(1);
    await expect(client.searchHistory("Cloudflare", "work")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/tags", { credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/memos?tag=work", { credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/history/search?q=Cloudflare&tag=work", { credentials: "include" });
  });

  it("surfaces Worker validation messages", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, { status: 400 }));
    const client = new ApiClient(fetchMock);

    await expect(client.publishMemo({ title: "", content: "", todos: [] })).rejects.toThrow("请输入 Memo 内容");
  });

  it("returns the updated todo and memo after toggling a todo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        todo: { id: "todo-1", memoId: "memo-1", title: "第一步", status: "done" },
        memo: { id: "memo-1", title: "新 Memo", status: "history", todos: [] }
      })
    );
    const client = new ApiClient(fetchMock);

    const result = await client.toggleTodo("todo-1");

    expect(result.memo?.status).toBe("history");
    expect(result.todo.status).toBe("done");
    expect(fetchMock).toHaveBeenCalledWith("/api/todos/todo-1/toggle", { method: "POST", credentials: "include" });
  });

  it("returns todo payloads for create, update, delete, and reorder actions", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ todo: { id: "todo-new", memoId: "memo-1", title: "新增", status: "todo" } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ todo: { id: "todo-new", memoId: "memo-1", title: "更新", status: "todo" } }))
      .mockResolvedValueOnce(jsonResponse({ todo: { id: "todo-new", memoId: "memo-1", title: "更新", status: "todo", deletedAt: "2026-06-28T08:00:00.000Z" } }))
      .mockResolvedValueOnce(jsonResponse({ todos: [{ id: "todo-2", memoId: "memo-1", title: "第二步", status: "todo" }] }));
    const client = new ApiClient(fetchMock);

    await expect(client.createTodo("memo-1", { title: "新增", generatedByAi: false })).resolves.toMatchObject({ id: "todo-new" });
    await expect(client.updateTodo("todo-new", { title: "更新", notes: null })).resolves.toMatchObject({ title: "更新" });
    await expect(client.deleteTodo("todo-new")).resolves.toMatchObject({ deletedAt: "2026-06-28T08:00:00.000Z" });
    await expect(client.reorderTodos("memo-1", ["todo-2"])).resolves.toHaveLength(1);
  });

  it("treats malformed successful API responses as request failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}));
    const client = new ApiClient(fetchMock);

    await expect(client.listRecentDrafts()).rejects.toThrow("请求失败，请稍后重试");
  });
});
