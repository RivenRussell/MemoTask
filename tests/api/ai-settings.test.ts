import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";

function createTestApi(fetchAi?: (request: Request) => Promise<Response>) {
  const repository = new MemoryRepository();
  const app = createApi({
    repository,
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-ai-settings",
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
    expect(body.settings.baseUrl).toBe("");
    expect(body.settings.model).toBe("");
    expect(body.settings.apiKeyMask).toBeNull();
    expect(JSON.stringify(body)).not.toContain("encrypted");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("saves settings with a masked API key and never returns the plaintext key", async () => {
    const { app, repository } = createTestApi();

    const response = await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "test-key-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.apiKeyMask).toBe("test...cdef");
    expect(JSON.stringify(body)).not.toContain("1234567890");
    expect(JSON.stringify(await repository.getAiSettings("default", "2026-06-22T12:00:00.000Z"))).not.toContain("1234567890");
  });

  it("requires the server encryption key before storing an API key", async () => {
    const app = createApi({
      repository: new MemoryRepository(),
      now: () => "2026-06-22T12:00:00.000Z"
    });

    const response = await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "test-key-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });
    const body = await json(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("ENCRYPTION_KEY_MISSING");
  });

  it("resets prompt to the built-in default", async () => {
    const { app } = createTestApi();
    await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        apiKey: "test-key-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "临时 Prompt"
      })
    });

    const response = await app.request("/api/ai/reset-prompt", { method: "POST" });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.promptTemplate).toContain("你是 MemoTask 的整理助手");
  });

  it("upgrades the legacy short prompt to the built-in default", async () => {
    const { app, repository } = createTestApi();
    await repository.saveAiSettings(
      "default",
      {
        baseUrl: "",
        model: "",
        promptTemplate: "你是 MemoTask 的整理助手。"
      },
      "2026-06-22T12:00:00.000Z"
    );

    const response = await app.request("/api/ai/settings");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.settings.promptTemplate).toContain("输出必须是 JSON");
    expect(body.settings.promptTemplate.length).toBeGreaterThan(200);
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
    expect(body.error.message).toBe("请先在设置里为当前账号填写接口地址、模型名称和 API 密钥");
  });

  it("analyzes a draft and accepts JSON wrapped in markdown fences", async () => {
    const { app } = createTestApi(async (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer test-key-1234567890abcdef");
      const body = (await request.json()) as {
        model: string;
        response_format?: unknown;
        messages: Array<{ content: string }>;
      };
      expect(body.model).toBe("dsv4-pro");
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages[0].content).toContain("\"todos\"");
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
        apiKey: "test-key-1234567890abcdef",
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

  it("persists the latest AI result on the draft so another client can reload it", async () => {
    const { app } = createTestApi(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "跨端同步整理",
                todos: [{ title: "在安卓端继续查看", notes: "来自 AI" }]
              })
            }
          }
        ]
      })
    );
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
    const draft = await json(
      await app.request("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "需要在 PC 和安卓之间同步 AI 整理结果" })
      })
    );

    await app.request("/api/ai/analyze-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: draft.draft.id })
    });
    const drafts = await json(await app.request("/api/drafts/recent"));

    expect(drafts.drafts[0]).toMatchObject({
      id: draft.draft.id,
      aiState: "done",
      aiError: null,
      aiResult: {
        title: "跨端同步整理",
        todos: [{ title: "在安卓端继续查看", notes: "来自 AI" }]
      }
    });
  });

  it("retries analyze up to three attempts before returning the editable draft result", async () => {
    let attempts = 0;
    const { app } = createTestApi(async () => {
      attempts += 1;
      if (attempts < 3) {
        return Response.json({ error: "temporary" }, { status: 502 });
      }

      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "重试后成功",
                todos: [{ title: "保留草稿继续发布" }]
              })
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
        apiKey: "test-key-1234567890abcdef",
        model: "dsv4-pro",
        promptTemplate: "整理 Memo"
      })
    });
    const draft = await json(
      await app.request("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "需要测试 AI 重试" })
      })
    );

    const response = await app.request("/api/ai/analyze-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: draft.draft.id })
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(attempts).toBe(3);
    expect(body.result).toEqual({
      title: "重试后成功",
      todos: [{ title: "保留草稿继续发布", notes: null }]
    });
  });
});
