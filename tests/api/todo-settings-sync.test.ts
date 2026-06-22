import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";

function createTestApi(fetchAi?: (request: Request) => Promise<Response>) {
  const repository = new MemoryRepository();
  const app = createApi({
    repository,
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-api",
    fetchAi
  });
  return { app, repository };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

describe("todo editing, AI test, and sync APIs", () => {
  it("creates, edits, soft deletes, and reorders todos inside one memo", async () => {
    const { app } = createTestApi();
    const published = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Todo 编辑", content: "content", todos: [{ title: "旧 Todo" }] })
      })
    );

    const createResponse = await app.request(`/api/memos/${published.memo.id}/todos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "新增 Todo", notes: "备注" })
    });
    expect(createResponse.status).toBe(201);
    const created = await json(createResponse);

    const updateResponse = await app.request(`/api/todos/${created.todo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "更新 Todo", notes: null })
    });
    expect(updateResponse.status).toBe(200);

    const detailAfterUpdate = await json(await app.request(`/api/memos/${published.memo.id}`));
    expect(detailAfterUpdate.memo.todos.map((todo: { title: string }) => todo.title)).toEqual(["旧 Todo", "更新 Todo"]);

    const reorderResponse = await app.request("/api/todos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoId: published.memo.id, todoIds: [created.todo.id, published.memo.todos[0].id] })
    });
    expect(reorderResponse.status).toBe(200);
    const reordered = await json(reorderResponse);
    expect(reordered.todos.map((todo: { title: string }) => todo.title)).toEqual(["更新 Todo", "旧 Todo"]);

    const deleteResponse = await app.request(`/api/todos/${created.todo.id}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    const detailAfterDelete = await json(await app.request(`/api/memos/${published.memo.id}`));
    expect(detailAfterDelete.memo.todos.map((todo: { title: string }) => todo.title)).toEqual(["旧 Todo"]);
  });

  it("tests AI settings with a lightweight model request", async () => {
    const { app } = createTestApi(async (request) => {
      const body = (await request.json()) as { model: string; messages: Array<{ content: string }> };
      expect(body.model).toBe("dsv4-pro");
      expect(body.messages[0].content).toContain("连接测试");
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    });
    await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });

    const response = await app.request("/api/ai/test", { method: "POST" });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns sync status without exposing secrets", async () => {
    const { app } = createTestApi();

    const response = await app.request("/api/sync/status");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.status).toMatchObject({ ok: true, lastError: null });
    expect(JSON.stringify(body)).not.toContain("sk-");
  });
});
