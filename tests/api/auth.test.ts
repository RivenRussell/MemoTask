import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { readSessionToken } from "../../worker/auth/crypto";
import { AuthService } from "../../worker/auth/service";
import { MemoryAuthRepository } from "../../worker/auth/memory-auth-repository";
import type { AuthSession, EmailMessage, EmailSender } from "../../worker/auth/types";
import { MemoryRepository } from "../../worker/repository/memory-repository";

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

class CountingAuthRepository extends MemoryAuthRepository {
  public sessionUpdateCount = 0;

  async updateSession(session: AuthSession): Promise<AuthSession> {
    this.sessionUpdateCount += 1;
    return super.updateSession(session);
  }
}

function verificationCodeFromLatestEmail(emailSender: RecordingEmailSender): string {
  const latest = emailSender.messages.at(-1);
  expect(latest).toBeDefined();
  const match = latest?.text.match(/\b\d{6}\b/);
  return match?.[0] ?? "";
}

function resetTokenFromLatestEmail(emailSender: RecordingEmailSender): string {
  const latest = emailSender.messages.at(-1);
  expect(latest).toBeDefined();
  const url = new URL(latest?.actionUrl ?? "");
  return url.searchParams.get("token") ?? "";
}

describe("AuthService", () => {
  it("registers an unverified user and sends a verification email without leaking password data", async () => {
    const { emailSender, repository, service } = createAuthService();

    const result = await service.register({ email: "  Owner@Example.com ", password: "memo123" }, now);

    expect(result.user).toMatchObject({ email: "owner@example.com", emailVerified: false });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(emailSender.messages).toHaveLength(1);
    expect(emailSender.messages[0]).toMatchObject({
      to: "owner@example.com",
      subject: "验证你的 MemoTask 邮箱"
    });
    expect(emailSender.messages[0].text).toMatch(/\b\d{6}\b/);
    expect(emailSender.messages[0].text).not.toContain("/verify-email?token=");
    const stored = await repository.findUserByEmail("owner@example.com");
    expect(stored?.passwordHash).toMatch(/^pbkdf2-sha256:/);
  });

  it("rejects duplicate registration for the same normalized email", async () => {
    const { service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "memo123" }, now);

    await expect(service.register({ email: " OWNER@example.com ", password: "memo456" }, now)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_REGISTERED"
    });
  });

  it("blocks login until email verification succeeds, then creates a session", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "memo123" }, now);

    await expect(service.login({ email: "owner@example.com", password: "memo123" }, now)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED"
    });

    const verified = await service.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);
    expect(verified.user.emailVerified).toBe(true);
    expect(verified.sessionCookie).toContain("memotask_session=");
    expect(verified.sessionCookie).toContain("HttpOnly");

    const loggedIn = await service.login({ email: "OWNER@example.com", password: "memo123" }, now);
    expect(loggedIn.user).toMatchObject({ email: "owner@example.com", emailVerified: true });
    expect(loggedIn.sessionCookie).toContain("memotask_session=");
  });

  it("requires passwords to be at least 6 characters with letters and numbers", async () => {
    const { service } = createAuthService();

    await expect(service.register({ email: "short@example.com", password: "abc12" }, now)).rejects.toMatchObject({
      code: "PASSWORD_WEAK"
    });
    await expect(service.register({ email: "letters@example.com", password: "abcdef" }, now)).rejects.toMatchObject({
      code: "PASSWORD_WEAK"
    });
    await expect(service.register({ email: "numbers@example.com", password: "123456" }, now)).rejects.toMatchObject({
      code: "PASSWORD_WEAK"
    });
    await expect(service.register({ email: "valid@example.com", password: "abc123" }, now)).resolves.toMatchObject({
      user: { email: "valid@example.com", emailVerified: false }
    });
  });

  it("rejects invalid passwords for verified users", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "memo123" }, now);
    await service.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);

    await expect(service.login({ email: "owner@example.com", password: "wrong password" }, now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
  });

  it("does not write session last-seen on every authenticated request", async () => {
    const repository = new CountingAuthRepository();
    const emailSender = new RecordingEmailSender();
    const service = new AuthService({
      repository,
      emailSender,
      appBaseUrl: "https://memotask.example.com"
    });
    await service.register({ email: "owner@example.com", password: "memo123" }, now);
    await service.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);
    const loggedIn = await service.login({ email: "owner@example.com", password: "memo123" }, now);
    const token = readSessionToken(loggedIn.sessionCookie);
    expect(token).toEqual(expect.any(String));

    await service.resolveBearerSession(token, now);
    await service.resolveBearerSession(token, "2026-06-23T12:04:00.000Z");
    await service.resolveBearerSession(token, "2026-06-23T12:06:00.000Z");

    expect(repository.sessionUpdateCount).toBe(1);
  });

  it("sends password reset email generically and rejects reused reset tokens", async () => {
    const { emailSender, service } = createAuthService();
    await service.register({ email: "owner@example.com", password: "memo123" }, now);
    await service.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);

    const response = await service.forgotPassword("owner@example.com", now);
    expect(response).toEqual({ ok: true });
    expect(emailSender.messages.at(-1)).toMatchObject({
      to: "owner@example.com",
      subject: "重置你的 MemoTask 密码"
    });

    const resetToken = resetTokenFromLatestEmail(emailSender);
    const reset = await service.resetPassword({ token: resetToken, password: "new123" }, now);
    expect(reset.user.email).toBe("owner@example.com");
    expect(reset.sessionCookie).toContain("memotask_session=");

    await expect(service.resetPassword({ token: resetToken, password: "other123" }, now)).rejects.toMatchObject({
      code: "TOKEN_INVALID"
    });
    await expect(service.login({ email: "owner@example.com", password: "memo123" }, now)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
    await expect(service.login({ email: "owner@example.com", password: "new123" }, now)).resolves.toMatchObject({
      user: { email: "owner@example.com", emailVerified: true }
    });
  });

  it("returns a generic forgot-password response for unknown emails without sending mail", async () => {
    const { emailSender, service } = createAuthService();

    await expect(service.forgotPassword("nobody@example.com", now)).resolves.toEqual({ ok: true });
    expect(emailSender.messages).toEqual([]);
  });
});

function createProtectedApi() {
  const repository = new MemoryRepository();
  const authRepository = new MemoryAuthRepository();
  const emailSender = new RecordingEmailSender();
  const authService = new AuthService({
    repository: authRepository,
    emailSender,
    appBaseUrl: "https://memotask.example.com"
  });
  const app = createApi({
    repository,
    authService,
    now: () => now
  });
  return { app, authService, emailSender };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

async function verifiedSessionCookie(authService: AuthService, emailSender: RecordingEmailSender): Promise<string> {
  await authService.register({ email: "owner@example.com", password: "memo123" }, now);
  await authService.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);
  const loggedIn = await authService.login({ email: "owner@example.com", password: "memo123" }, now);
  return loggedIn.sessionCookie;
}

describe("auth API protection", () => {
  it("returns the current user from /api/auth/me when a session cookie is valid", async () => {
    const { app, authService, emailSender } = createProtectedApi();
    const sessionCookie = await verifiedSessionCookie(authService, emailSender);

    const response = await app.request("/api/auth/me", { headers: { cookie: sessionCookie } });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ email: "owner@example.com", emailVerified: true });
  });

  it("sets and clears HttpOnly session cookies through auth API routes", async () => {
    const { app, emailSender } = createProtectedApi();
    const register = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "memo123" })
    });
    expect(register.status).toBe(201);
    const unverifiedCookie = register.headers.get("set-cookie") ?? "";
    expect(unverifiedCookie).toContain("memotask_session=");

    const protectedBeforeVerification = await app.request("/api/memos", { headers: { cookie: unverifiedCookie } });
    expect(protectedBeforeVerification.status).toBe(403);

    const verify = await app.request("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: verificationCodeFromLatestEmail(emailSender) })
    });
    expect(verify.status).toBe(200);
    const sessionCookie = verify.headers.get("set-cookie") ?? "";
    expect(sessionCookie).toContain("memotask_session=");
    expect(sessionCookie).toContain("HttpOnly");

    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie: sessionCookie }
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("allows Capacitor clients to use bearer sessions across CORS requests", async () => {
    const { app, authService, emailSender } = createProtectedApi();
    await authService.register({ email: "owner@example.com", password: "memo123" }, now);
    await authService.verifyEmail(verificationCodeFromLatestEmail(emailSender), now);

    const preflight = await app.request("/api/auth/me", {
      method: "OPTIONS",
      headers: {
        origin: "https://localhost",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,x-memotask-client"
      }
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://localhost");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-memotask-client": "capacitor", origin: "https://localhost" },
      body: JSON.stringify({ email: "owner@example.com", password: "memo123" })
    });
    const loginBody = await json(login);
    expect(login.status).toBe(200);
    expect(loginBody.sessionToken).toEqual(expect.any(String));
    expect(login.headers.get("access-control-allow-origin")).toBe("https://localhost");

    const me = await app.request("/api/auth/me", {
      headers: {
        authorization: `Bearer ${loginBody.sessionToken}`,
        "x-memotask-client": "capacitor",
        origin: "https://localhost"
      }
    });
    expect(me.status).toBe(200);
    await expect(json(me)).resolves.toMatchObject({ user: { email: "owner@example.com" } });
  });

  it("rejects protected memo APIs without a verified session", async () => {
    const { app, authService } = createProtectedApi();

    const anonymous = await app.request("/api/memos");
    expect(anonymous.status).toBe(401);

    const registered = await authService.register({ email: "owner@example.com", password: "memo123" }, now);
    const unverifiedResponse = await app.request("/api/memos", { headers: { cookie: registered.sessionCookie } });
    expect(unverifiedResponse.status).toBe(403);

    await expect(authService.login({ email: "owner@example.com", password: "memo123" }, now)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED"
    });
  });

  it("allows verified sessions to use existing memo APIs", async () => {
    const { app, authService, emailSender } = createProtectedApi();
    const sessionCookie = await verifiedSessionCookie(authService, emailSender);

    const publish = await app.request("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({ title: "v2 Memo", content: "需要登录", todos: [{ title: "验证保护层" }] })
    });
    expect(publish.status).toBe(201);

    const list = await app.request("/api/memos", { headers: { cookie: sessionCookie } });
    const body = await json(list);

    expect(list.status).toBe(200);
    expect(body.memos.map((memo: { title: string }) => memo.title)).toEqual(["v2 Memo"]);
  });
});
