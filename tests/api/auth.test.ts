import { describe, expect, it } from "vitest";
import { AuthService } from "../../worker/auth/service";
import { MemoryAuthRepository } from "../../worker/auth/memory-auth-repository";
import type { EmailMessage, EmailSender } from "../../worker/auth/types";

const now = "2026-06-23T12:00:00.000Z";

class RecordingEmailSender implements EmailSender {
  public messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

function createAuthService() {
  const repository = new MemoryAuthRepository();
  const emailSender = new RecordingEmailSender();
  const service = new AuthService({
    repository,
    emailSender,
    appBaseUrl: "https://memotask.example.com"
  });
  return { repository, emailSender, service };
}

function tokenFromLatestEmail(emailSender: RecordingEmailSender): string {
  const latest = emailSender.messages.at(-1);
  expect(latest).toBeDefined();
  const url = new URL(latest?.actionUrl ?? "");
  return url.searchParams.get("token") ?? "";
}

describe("AuthService", () => {
  it("registers an unverified user and sends a verification email without leaking password data", async () => {
    const { emailSender, repository, service } = createAuthService();

    const result = await service.register({ email: "  Owner@Example.com ", password: "correct horse battery staple" }, now);

    expect(result.user).toMatchObject({ email: "owner@example.com", emailVerified: false });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(emailSender.messages).toHaveLength(1);
    expect(emailSender.messages[0]).toMatchObject({
      to: "owner@example.com",
      subject: "验证你的 MemoTask 邮箱"
    });
    expect(emailSender.messages[0].actionUrl).toMatch(/^https:\/\/memotask\.example\.com\/verify-email\?token=.+/);
    const stored = await repository.findUserByEmail("owner@example.com");
    expect(stored?.passwordHash).toMatch(/^pbkdf2-sha256:/);
  });

  it("rejects duplicate registration for the same normalized email", async () => {
    const { service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "correct horse battery staple" }, now);

    await expect(service.register({ email: " OWNER@example.com ", password: "another strong password" }, now)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_REGISTERED"
    });
  });

  it("blocks login until email verification succeeds, then creates a session", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "correct horse battery staple" }, now);

    await expect(service.login({ email: "owner@example.com", password: "correct horse battery staple" }, now)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED"
    });

    const verified = await service.verifyEmail(tokenFromLatestEmail(emailSender), now);
    expect(verified.user.emailVerified).toBe(true);
    expect(verified.sessionCookie).toContain("memotask_session=");
    expect(verified.sessionCookie).toContain("HttpOnly");

    const loggedIn = await service.login({ email: "OWNER@example.com", password: "correct horse battery staple" }, now);
    expect(loggedIn.user).toMatchObject({ email: "owner@example.com", emailVerified: true });
    expect(loggedIn.sessionCookie).toContain("memotask_session=");
  });

  it("rejects invalid passwords for verified users", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "correct horse battery staple" }, now);
    await service.verifyEmail(tokenFromLatestEmail(emailSender), now);

    await expect(service.login({ email: "owner@example.com", password: "wrong password" }, now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
  });

  it("sends password reset email generically and rejects reused reset tokens", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "correct horse battery staple" }, now);
    await service.verifyEmail(tokenFromLatestEmail(emailSender), now);

    const response = await service.forgotPassword("owner@example.com", now);
    expect(response).toEqual({ ok: true });
    expect(emailSender.messages.at(-1)).toMatchObject({
      to: "owner@example.com",
      subject: "重置你的 MemoTask 密码"
    });

    const resetToken = tokenFromLatestEmail(emailSender);
    const reset = await service.resetPassword({ token: resetToken, password: "new correct horse battery staple" }, now);
    expect(reset.user.email).toBe("owner@example.com");
    expect(reset.sessionCookie).toContain("memotask_session=");

    await expect(service.resetPassword({ token: resetToken, password: "another strong password" }, now)).rejects.toMatchObject({
      code: "TOKEN_INVALID"
    });
    await expect(service.login({ email: "owner@example.com", password: "correct horse battery staple" }, now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
    await expect(service.login({ email: "owner@example.com", password: "new correct horse battery staple" }, now)).resolves.toMatchObject({
      user: { email: "owner@example.com", emailVerified: true }
    });
  });

  it("returns a generic forgot-password response for unknown emails without sending mail", async () => {
    const { emailSender, service } = createAuthService();

    await expect(service.forgotPassword("nobody@example.com", now)).resolves.toEqual({ ok: true });
    expect(emailSender.messages).toEqual([]);
  });
});
