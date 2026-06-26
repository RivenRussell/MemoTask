import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";

function createTestApi() {
  const repository = new MemoryRepository();
  const app = createApi({ repository, now: () => "2026-06-22T12:00:00.000Z" });
  return { app, repository };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

describe("memo data loop API", () => {
  it("keeps only the latest three drafts", async () => {
    const { app } = createTestApi();

    for (const content of ["第一条", "第二条", "第三条", "第四条"]) {
      const response = await app.request("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content })
      });
      expect(response.status).toBe(201);
    }

    const draftsResponse = await app.request("/api/drafts/recent");
    expect(draftsResponse.status).toBe(200);
    const body = await json(draftsResponse);

    expect(body.drafts.map((draft: { content: string }) => draft.content)).toEqual(["第四条", "第三条", "第二条"]);
  });

  it("updates the current draft instead of creating duplicate autosave entries", async () => {
    const { app } = createTestApi();
    const createdResponse = await app.request("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "初始草稿" })
    });
    const created = await json(createdResponse);

    const updateResponse = await app.request(`/api/drafts/${created.draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "更新草稿", content: "更新后的草稿" })
    });
    expect(updateResponse.status).toBe(200);

    const drafts = await json(await app.request("/api/drafts/recent"));
    expect(drafts.drafts).toHaveLength(1);
    expect(drafts.drafts[0]).toMatchObject({ id: created.draft.id, title: "更新草稿", content: "更新后的草稿" });
  });

  it("keeps untitled drafts untitled so clients can preview the body text", async () => {
    const { app } = createTestApi();

    const response = await app.request("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "这是没有标题但很有用的主体想法" })
    });
    expect(response.status).toBe(201);

    const drafts = await json(await app.request("/api/drafts/recent"));
    expect(drafts.drafts[0]).toMatchObject({ title: "", content: "这是没有标题但很有用的主体想法" });
  });

  it("publishes a pure memo to the front of the active queue", async () => {
    const { app } = createTestApi();

    await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "后处理 Memo",
        content: "排在后面",
        todos: [{ title: "稍后做" }]
      })
    });
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "最新 Memo",
        content: "应该排最前",
        todos: [{ title: "马上做" }]
      })
    });

    expect(publishResponse.status).toBe(201);
    const listResponse = await app.request("/api/memos");
    const body = await json(listResponse);

    expect(body.memos.map((memo: { title: string }) => memo.title)).toEqual(["最新 Memo", "后处理 Memo"]);
    expect(body.memos[0].todos).toHaveLength(1);
  });

  it("moves a memo to history only after all todos are toggled done", async () => {
    const { app } = createTestApi();
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "两步任务",
        content: "完成后进入历史",
        todos: [{ title: "第一步" }, { title: "第二步" }]
      })
    });
    const published = await json(publishResponse);
    const [firstTodo, secondTodo] = published.memo.todos;

    const firstToggle = await app.request(`/api/todos/${firstTodo.id}/toggle`, { method: "POST" });
    expect(firstToggle.status).toBe(200);
    let memosBody = await json(await app.request("/api/memos"));
    expect(memosBody.memos).toHaveLength(1);

    const secondToggle = await app.request(`/api/todos/${secondTodo.id}/toggle`, { method: "POST" });
    expect(secondToggle.status).toBe(200);
    memosBody = await json(await app.request("/api/memos"));
    const historyBody = await json(await app.request("/api/history"));

    expect(memosBody.memos).toEqual([]);
    expect(historyBody.memos).toHaveLength(1);
    expect(historyBody.memos[0].title).toBe("两步任务");
  });

  it("reads and updates memo details without triggering AI", async () => {
    const { app } = createTestApi();
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "原标题",
        content: "原始内容",
        todos: [{ title: "保留 Todo" }]
      })
    });
    const published = await json(publishResponse);

    const updateResponse = await app.request(`/api/memos/${published.memo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "新标题", content: "更新后的原文" })
    });
    expect(updateResponse.status).toBe(200);

    const detailResponse = await app.request(`/api/memos/${published.memo.id}`);
    const detail = await json(detailResponse);
    expect(detail.memo.title).toBe("新标题");
    expect(detail.memo.content).toBe("更新后的原文");
    expect(detail.memo.aiState).toBe("idle");
    expect(detail.memo.todos[0].title).toBe("保留 Todo");
  });

  it("archives and restores a memo without immediately auto-archiving it again", async () => {
    const { app } = createTestApi();
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "可恢复 Memo",
        content: "所有 Todo 都已经完成时恢复也要留在 Memos",
        todos: [{ title: "第一步" }]
      })
    });
    const published = await json(publishResponse);
    const todoId = published.memo.todos[0].id;
    await app.request(`/api/todos/${todoId}/toggle`, { method: "POST" });

    const history = await json(await app.request("/api/history"));
    const archivedId = history.memos[0].id;
    const restoreResponse = await app.request(`/api/memos/${archivedId}/restore`, { method: "POST" });
    expect(restoreResponse.status).toBe(200);

    const active = await json(await app.request("/api/memos"));
    expect(active.memos).toHaveLength(1);
    expect(active.memos[0].autoArchiveSuppressedUntilChange).toBe(true);

    await app.request(`/api/todos/${todoId}/toggle`, { method: "POST" });
    const activeAfterChange = await json(await app.request("/api/memos"));
    expect(activeAfterChange.memos).toHaveLength(1);
    expect(activeAfterChange.memos[0].todos[0].status).toBe("todo");
    expect(activeAfterChange.memos[0].autoArchiveSuppressedUntilChange).toBe(false);
  });

  it("manually archives an unfinished memo and restores it near the original order", async () => {
    const { app } = createTestApi();
    const first = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "前一个", content: "A", todos: [{ title: "A1" }] })
      })
    );
    const second = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "后一个", content: "B", todos: [{ title: "B1" }] })
      })
    );

    const archiveResponse = await app.request(`/api/memos/${first.memo.id}/archive`, { method: "POST" });
    expect(archiveResponse.status).toBe(200);
    let active = await json(await app.request("/api/memos"));
    expect(active.memos.map((memo: { id: string }) => memo.id)).toEqual([second.memo.id]);

    const restoreResponse = await app.request(`/api/memos/${first.memo.id}/restore`, { method: "POST" });
    expect(restoreResponse.status).toBe(200);
    active = await json(await app.request("/api/memos"));
    expect(active.memos.map((memo: { id: string }) => memo.id)).toContain(first.memo.id);
  });

  it("persists memo reorder order", async () => {
    const { app } = createTestApi();
    const first = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "第一个", content: "A", todos: [] })
      })
    );
    const second = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "第二个", content: "B", todos: [] })
      })
    );

    const reorderResponse = await app.request("/api/memos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoIds: [first.memo.id, second.memo.id] })
    });
    expect(reorderResponse.status).toBe(200);

    const active = await json(await app.request("/api/memos"));
    expect(active.memos.map((memo: { id: string }) => memo.id)).toEqual([first.memo.id, second.memo.id]);
  });

  it("searches history by memo content and todo title", async () => {
    const { app } = createTestApi();
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "资料整理",
        content: "包含 Cloudflare 部署步骤",
        todos: [{ title: "检查 Access 配置" }]
      })
    });
    const published = await json(publishResponse);
    await app.request(`/api/memos/${published.memo.id}/archive`, { method: "POST" });

    const contentResult = await json(await app.request("/api/history/search?q=Cloudflare"));
    const todoResult = await json(await app.request("/api/history/search?q=Access"));

    expect(contentResult.memos).toHaveLength(1);
    expect(todoResult.memos).toHaveLength(1);
  });

  it("bulk deletes history memos and restores them with undo", async () => {
    const { app } = createTestApi();
    const publishResponse = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "待删除历史", content: "History", todos: [] })
    });
    const published = await json(publishResponse);
    await app.request(`/api/memos/${published.memo.id}/archive`, { method: "POST" });

    const deleteResponse = await app.request("/api/history/bulk-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoIds: [published.memo.id] })
    });
    expect(deleteResponse.status).toBe(200);
    const deleted = await json(deleteResponse);
    expect((await json(await app.request("/api/history"))).memos).toEqual([]);

    const undoResponse = await app.request("/api/history/undo-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId: deleted.operation.id })
    });
    expect(undoResponse.status).toBe(200);
    expect((await json(await app.request("/api/history"))).memos).toHaveLength(1);
  });

  it("exports active and history memos while excluding drafts, deleted memos, and plaintext secrets", async () => {
    const repository = new MemoryRepository();
    const app = createApi({
      repository,
      now: () => "2026-06-22T12:00:00.000Z",
      appEncryptionKey: "test-encryption-key-for-export"
    });
    await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "test-key-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });
    await app.request("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "不应导出的草稿" })
    });
    const active = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "导出 Active", content: "Active", todos: [{ title: "A" }] })
      })
    );
    const history = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "导出 History", content: "History", todos: [] })
      })
    );
    await app.request(`/api/memos/${history.memo.id}/archive`, { method: "POST" });

    const exportBody = await json(await app.request("/api/export/json"));
    const serialized = JSON.stringify(exportBody);

    expect(exportBody.memos.map((memo: { title: string }) => memo.title)).toEqual(["导出 Active", "导出 History"]);
    expect(exportBody.aiSettings).toMatchObject({ baseUrl: "https://api.example.com/v1", model: "dsv4-pro", hasApiKey: true });
    expect(serialized).not.toContain("不应导出的草稿");
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("encrypted_api_key");
    expect(serialized).toContain(active.memo.todos[0].title);
  });
});
