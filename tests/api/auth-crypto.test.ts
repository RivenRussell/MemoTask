import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../worker/auth/crypto";

describe("auth password crypto", () => {
  it("uses a PBKDF2 iteration count supported by Cloudflare Workers", async () => {
    const hash = await hashPassword("CodexSmoke12345");
    const [, iterations] = hash.split(":");

    expect(Number(iterations)).toBeLessThanOrEqual(100000);
    await expect(verifyPassword("CodexSmoke12345", hash)).resolves.toBe(true);
  });
});
