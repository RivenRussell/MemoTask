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
});
