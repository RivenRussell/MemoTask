import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";

function createTestApi(fetchAi?: (request: Request) => Promise<Response>) {
  const repository = new MemoryRepository();
  const app = createApi({
    repository,
    now: () => "2026-06-22T12:00:00.000Z",
    fetchAi
  });
  return { app, repository };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

describe("AI settings and analyze API", () => {
  it("returns default settings without a plaintext API key", async () => {
    const { app } = createTestApi();

    const response = await app.request("/api/ai/settings");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.model).toBe("dsv4-pro");
    expect(body.settings.apiKeyMask).toBeNull();
    expect(JSON.stringify(body)).not.toContain("encrypted");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("saves settings with a masked API key and never returns the plaintext key", async () => {
    const { app } = createTestApi();

    const response = await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.apiKeyMask).toBe("sk-t...cdef");
    expect(JSON.stringify(body)).not.toContain("1234567890");
  });

  it("resets prompt to the built-in default", async () => {
    const { app } = createTestApi();
    await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "临时 Prompt"
      })
    });

    const response = await app.request("/api/ai/reset-prompt", { method: "POST" });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.promptTemplate).toContain("你是 MemoTask 的整理助手");
  });

  it("marks analyze unavailable when API settings are missing", async () => {
    const { app } = createTestApi();
    const draft = await json(
      await app.request("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "请帮我整理任务" })
      })
    );

    const response = await app.request("/api/ai/analyze-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: draft.draft.id })
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("AI_UNAVAILABLE");
  });

  it("analyzes a draft and accepts JSON wrapped in markdown fences", async () => {
    const { app } = createTestApi(async () => {
      return Response.json({
        choices: [
          {
            message: {
              content: "```json\n{\"title\":\"PWA 调研\",\"todos\":[{\"title\":\"确认手机支持\"},{\"title\":\"整理 PC 方案\",\"notes\":\"对照设计图\"}]}\n```"
            }
          }
        ]
      });
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
    const draft = await json(
      await app.request("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "研究 PWA 能不能覆盖手机和 PC" })
      })
    );

    const response = await app.request("/api/ai/analyze-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: draft.draft.id })
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.result.title).toBe("PWA 调研");
    expect(body.result.todos).toEqual([
      { title: "确认手机支持", notes: null },
      { title: "整理 PC 方案", notes: "对照设计图" }
    ]);
  });
});
