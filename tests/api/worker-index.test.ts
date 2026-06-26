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
});
