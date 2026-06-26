import { describe, expect, it, vi } from "vitest";
import { ApiClient, resolveApiBaseUrl, resolveApiUrl } from "../../src/api/client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

describe("frontend API client", () => {
  it("keeps API paths relative when no app API base URL is configured", () => {
    expect(resolveApiUrl("/api/auth/me")).toBe("/api/auth/me");
  });

  it("resolves API paths against the configured app API base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock, { apiBaseUrl: "https://memotask.rrwks.cn" });

    await client.listMemos();

    expect(fetchMock).toHaveBeenCalledWith("https://memotask.rrwks.cn/api/memos", { credentials: "include" });
  });

  it("normalizes trailing slashes when resolving app API URLs", () => {
    expect(resolveApiUrl("/api/auth/me", "https://memotask.rrwks.cn/")).toBe("https://memotask.rrwks.cn/api/auth/me");
  });

  it("defaults desktop and android bundles to the production Worker origin", () => {
    expect(resolveApiBaseUrl("desktop")).toBe("https://memotask.rrwks.cn");
    expect(resolveApiBaseUrl("android")).toBe("https://memotask.rrwks.cn");
    expect(resolveApiBaseUrl("production")).toBeUndefined();
  });

  it("lets explicit API base configuration override app bundle defaults", () => {
    expect(resolveApiBaseUrl("desktop", "https://preview.example.com")).toBe("https://preview.example.com");
  });

  it("includes browser credentials on every request so session cookies survive on mobile browsers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock);

    await client.listMemos();

    expect(fetchMock).toHaveBeenCalledWith("/api/memos", { credentials: "include" });
  });

  it("stores app session tokens from auth responses and sends bearer auth on later app requests", async () => {
    const store = new Map<string, string>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "user-1", email: "owner@example.com", emailVerified: true }, appSessionToken: "app-token-1" }))
      .mockResolvedValueOnce(jsonResponse({ memos: [] }));
    const client = new ApiClient(fetchMock, {
      apiBaseUrl: "https://memotask.rrwks.cn",
      appSessionStorage: {
        get: () => store.get("token") ?? null,
        set: (token) => store.set("token", token),
        clear: () => store.delete("token")
      }
    });

    await client.login({ email: "owner@example.com", password: "memo123" });
    await client.listMemos();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://memotask.rrwks.cn/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-memotask-client": "app" },
      body: JSON.stringify({ email: "owner@example.com", password: "memo123" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://memotask.rrwks.cn/api/memos", {
      credentials: "include",
      headers: { authorization: "Bearer app-token-1" }
    });
  });

  it("clears stored app session tokens after logout", async () => {
    let token: string | null = "app-token-1";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ApiClient(fetchMock, {
      apiBaseUrl: "https://memotask.rrwks.cn",
      appSessionStorage: {
        get: () => token,
        set: (nextToken) => {
          token = nextToken;
        },
        clear: () => {
          token = null;
        }
      }
    });

    await client.logout();

    expect(fetchMock).toHaveBeenCalledWith("https://memotask.rrwks.cn/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { authorization: "Bearer app-token-1" }
    });
    expect(token).toBeNull();
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
