import { describe, expect, it } from "vitest";
import { createApi } from "../../worker/api";
import { AuthService } from "../../worker/auth/service";
import { MemoryAuthRepository } from "../../worker/auth/memory-auth-repository";
import type { EmailMessage, EmailSender } from "../../worker/auth/types";
import { MemoryRepository } from "../../worker/repository/memory-repository";

const now = "2026-06-23T12:00:00.000Z";

class RecordingEmailSender implements EmailSender {
  public messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

function createIsolatedApi() {
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
    now: () => now,
    appEncryptionKey: "test-encryption-key-for-isolation"
  });
  return { app, emailSender };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

function codeFromMessage(message: EmailMessage): string {
  return message.text.match(/\b\d{6}\b/)?.[0] ?? "";
}

async function registerVerified(app: ReturnType<typeof createApi>, emailSender: RecordingEmailSender, email: string): Promise<string> {
  const before = emailSender.messages.length;
  const register = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "memo123" })
  });
  expect(register.status).toBe(201);
  const verificationEmail = emailSender.messages.slice(before).at(-1);
  expect(verificationEmail).toBeDefined();

  const verify = await app.request("/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: codeFromMessage(verificationEmail as EmailMessage) })
  });
  expect(verify.status).toBe(200);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "memo123" })
  });
  expect(login.status).toBe(200);
  return login.headers.get("set-cookie") ?? "";
}

describe("user data isolation", () => {
  it("prevents another user from listing, reading, editing, archiving, or reordering memos", async () => {
    const { app, emailSender } = createIsolatedApi();
    const aliceCookie = await registerVerified(app, emailSender, "alice@example.com");
    const bobCookie = await registerVerified(app, emailSender, "bob@example.com");

    const published = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: aliceCookie },
        body: JSON.stringify({ title: "Alice Memo", content: "Only Alice can see this", todos: [{ title: "Private Todo" }] })
      })
    );
    const memoId = published.memo.id;
    const todoId = published.memo.todos[0].id;

    expect((await json(await app.request("/api/memos", { headers: { cookie: aliceCookie } }))).memos).toHaveLength(1);
    expect((await json(await app.request("/api/memos", { headers: { cookie: bobCookie } }))).memos).toEqual([]);

    expect((await app.request(`/api/memos/${memoId}`, { headers: { cookie: bobCookie } })).status).toBe(404);
    expect(
      (
        await app.request(`/api/memos/${memoId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: bobCookie },
          body: JSON.stringify({ title: "Bob Edit", content: "Cross-user edit" })
        })
      ).status
    ).toBe(404);
    expect((await app.request(`/api/todos/${todoId}/toggle`, { method: "POST", headers: { cookie: bobCookie } })).status).toBe(404);
    expect((await app.request(`/api/memos/${memoId}/archive`, { method: "POST", headers: { cookie: bobCookie } })).status).toBe(404);
    expect(
      (
        await app.request("/api/memos/reorder", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: bobCookie },
          body: JSON.stringify({ memoIds: [memoId] })
        })
      ).status
    ).toBe(200);
    expect((await json(await app.request("/api/memos", { headers: { cookie: bobCookie } }))).memos).toEqual([]);

    const aliceMemo = await json(await app.request(`/api/memos/${memoId}`, { headers: { cookie: aliceCookie } }));
    expect(aliceMemo.memo).toMatchObject({ title: "Alice Memo" });
    expect(aliceMemo.memo.todos[0]).toMatchObject({ status: "todo" });
  });

  it("isolates history, export, AI settings, and sync status by user", async () => {
    const { app, emailSender } = createIsolatedApi();
    const aliceCookie = await registerVerified(app, emailSender, "alice@example.com");
    const bobCookie = await registerVerified(app, emailSender, "bob@example.com");

    const aliceMemo = await json(
      await app.request("/api/memos/publish", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: aliceCookie },
        body: JSON.stringify({ title: "Alice Export", content: "Alice data", todos: [] })
      })
    );
    await app.request(`/api/memos/${aliceMemo.memo.id}/archive`, { method: "POST", headers: { cookie: aliceCookie } });

    await app.request("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: aliceCookie },
      body: JSON.stringify({
        baseUrl: "https://api.alice.example/v1",
        model: "alice-model",
        apiKey: "alice-key-1234567890",
        promptTemplate: "Alice prompt"
      })
    });

    const bobHistory = await json(await app.request("/api/history", { headers: { cookie: bobCookie } }));
    const bobExport = await json(await app.request("/api/export/json", { headers: { cookie: bobCookie } }));
    const bobSettings = await json(await app.request("/api/ai/settings", { headers: { cookie: bobCookie } }));
    const aliceSettings = await json(await app.request("/api/ai/settings", { headers: { cookie: aliceCookie } }));
    const aliceSync = await json(await app.request("/api/sync/status", { headers: { cookie: aliceCookie } }));
    const bobSync = await json(await app.request("/api/sync/status", { headers: { cookie: bobCookie } }));

    expect(bobHistory.memos).toEqual([]);
    expect(bobExport.memos).toEqual([]);
    expect(bobExport.aiSettings).toMatchObject({ baseUrl: "https://api.deepseek.com", hasApiKey: false });
    expect(bobSettings.settings).toMatchObject({ baseUrl: "https://api.deepseek.com", model: "deepseek-v4-pro" });
    expect(aliceSettings.settings).toMatchObject({ baseUrl: "https://api.alice.example/v1", model: "alice-model" });
    expect(aliceSync.status.updatedAt).toBe(now);
    expect(bobSync.status.updatedAt).toBe(now);
  });
});
