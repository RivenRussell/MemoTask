import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../src/api/client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

describe("frontend API client", () => {
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "新 Memo",
        content: "原始内容",
        todos: [{ title: "第一步", notes: null, generatedByAi: false }]
      })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/memos");
  });

  it("surfaces Worker validation messages", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, { status: 400 }));
    const client = new ApiClient(fetchMock);

    await expect(client.publishMemo({ title: "", content: "", todos: [] })).rejects.toThrow("请输入 Memo 内容");
  });

  it("treats malformed successful API responses as request failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}));
    const client = new ApiClient(fetchMock);

    await expect(client.listRecentDrafts()).rejects.toThrow("请求失败，请稍后重试");
  });
});
