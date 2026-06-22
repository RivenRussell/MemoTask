import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";

describe("health API", () => {
  it("returns ok for GET /api/health", async () => {
    const app = createApi();
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
