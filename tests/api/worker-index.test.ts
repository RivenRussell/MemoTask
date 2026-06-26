import { describe, expect, it } from "vitest";
import worker, { type Env } from "../../worker/index";

function createEnv(): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {
      fetch: () => Response.json({ ok: true })
    } as unknown as Fetcher
  };
}

describe("worker entrypoint", () => {
  it("serves frontend assets through the assets binding after Worker-first routing", async () => {
    const response = await worker.fetch(new Request("https://memotask.rrwks.cn/login"), createEnv(), {} as ExecutionContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("redirects plaintext production requests to HTTPS before setting Secure session cookies", async () => {
    const response = await worker.fetch(
      new Request("http://memotask.rrwks.cn/login", {
        headers: { "x-forwarded-proto": "http" }
      }),
      createEnv(),
      {} as ExecutionContext
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://memotask.rrwks.cn/login");
  });

  it("answers credentialed app API preflights for allowed app origins", async () => {
    const response = await worker.fetch(
      new Request("https://memotask.rrwks.cn/api/memos", {
        method: "OPTIONS",
        headers: {
          origin: "https://localhost",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type,x-memotask-client"
        }
      }),
      createEnv(),
      {} as ExecutionContext
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://localhost");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("allows Electron loopback origins without allowing arbitrary websites", async () => {
    const allowed = await worker.fetch(
      new Request("https://memotask.rrwks.cn/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: "http://127.0.0.1:48231",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type,x-memotask-client"
        }
      }),
      createEnv(),
      {} as ExecutionContext
    );
    const denied = await worker.fetch(
      new Request("https://memotask.rrwks.cn/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example.com",
          "access-control-request-method": "POST"
        }
      }),
      createEnv(),
      {} as ExecutionContext
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:48231");
    expect(denied.status).toBe(403);
  });
});
