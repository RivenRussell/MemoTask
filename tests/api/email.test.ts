import { describe, expect, it } from "vitest";
import { createEmailSender, EmailConfigurationError } from "../../worker/auth/email";

describe("production email sender", () => {
  it("fails fast when production email configuration is missing", async () => {
    const sender = createEmailSender({ EMAIL_API_KEY: "", EMAIL_FROM: "MemoTask <noreply@example.com>", APP_BASE_URL: "https://app.example.com" });

    await expect(
      sender.send({
        to: "owner@example.com",
        subject: "验证你的 MemoTask 邮箱",
        text: "你的 MemoTask 邮箱验证码是：123456。验证码 24 小时内有效。"
      })
    ).rejects.toBeInstanceOf(EmailConfigurationError);
  });

  it("sends Resend-compatible email requests", async () => {
    const requests: Request[] = [];
    const sender = createEmailSender(
      {
        EMAIL_API_KEY: "test-email-key",
        EMAIL_FROM: "MemoTask <noreply@example.com>",
        APP_BASE_URL: "https://app.example.com"
      },
      async (request: RequestInfo | URL) => {
        if (!(request instanceof Request)) {
          throw new Error("Expected a Request");
        }
        requests.push(request);
        return Response.json({ id: "email-1" });
      }
    );

    await sender.send({
      to: "owner@example.com",
      subject: "重置你的 MemoTask 密码",
      text: "打开链接重置密码：https://app.example.com/reset-password?token=token",
      actionUrl: "https://app.example.com/reset-password?token=token"
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.resend.com/emails");
    expect(requests[0].headers.get("authorization")).toBe("Bearer test-email-key");
    const body = (await requests[0].json()) as { from: string; to: string[]; subject: string; text: string; html: string };
    expect(body).toMatchObject({
      from: "MemoTask <noreply@example.com>",
      to: ["owner@example.com"],
      subject: "重置你的 MemoTask 密码",
      text: "打开链接重置密码：https://app.example.com/reset-password?token=token"
    });
    expect(body.html).toContain("https://app.example.com/reset-password?token=token");
  });

  it("calls the default fetch without relying on a method receiver", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Request[] = [];
    globalThis.fetch = function (this: unknown, request: RequestInfo | URL) {
      if (this !== undefined) {
        throw new TypeError("fetch receiver should be undefined");
      }
      if (!(request instanceof Request)) {
        throw new Error("Expected a Request");
      }
      requests.push(request);
      return Promise.resolve(Response.json({ id: "email-1" }));
    } as typeof fetch;
    try {
      const sender = createEmailSender({
        EMAIL_API_KEY: "test-email-key",
        EMAIL_FROM: "MemoTask <noreply@example.com>",
        APP_BASE_URL: "https://app.example.com"
      });

      await sender.send({
        to: "owner@example.com",
        subject: "验证你的 MemoTask 邮箱",
        text: "你的 MemoTask 邮箱验证码是：123456。验证码 24 小时内有效。"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests).toHaveLength(1);
  });
});
