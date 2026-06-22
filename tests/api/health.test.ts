import { describe, expect, it } from "vitest";
import app from "../../worker/index";

describe("health API", () => {
  it("returns ok for GET /api/health", async () => {
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
