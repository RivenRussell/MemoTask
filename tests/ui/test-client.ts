import { screen } from "@testing-library/react";
import { createApi } from "../../worker/api";
import { createSessionCookie, hashPassword, hashToken } from "../../worker/auth/crypto";
import { MemoryAuthRepository } from "../../worker/auth/memory-auth-repository";
import { AuthService } from "../../worker/auth/service";
import type { EmailMessage, EmailSender } from "../../worker/auth/types";
import { MemoryRepository } from "../../worker/repository/memory-repository";
import { ApiClient } from "../../src/api/client";
import type { Memo } from "../../src/types";

interface UiTestClientOptions {
  fetchAi?: (request: Request) => Promise<Response>;
  delayMs?: number;
  delayForUrl?: (url: string) => number;
  failForUrl?: (url: string) => boolean;
  onRequest?: (url: string) => void;
  initialMemos?: Memo[];
}

export function createUiTestClient(options?: ((request: Request) => Promise<Response>) | UiTestClientOptions) {
  const fetchAi = typeof options === "function" ? options : options?.fetchAi;
  const repository = new MemoryRepository();
  const authRepository = new MemoryAuthRepository();
  for (const memo of typeof options === "function" ? [] : (options?.initialMemos ?? [])) {
    void repository.saveMemo("default", memo);
  }
  const sessionToken = "ui-test-session-token";
  const authReady = seedDefaultSession(authRepository, sessionToken);
  const authService = new AuthService({
    repository: authRepository,
    emailSender: new RecordingEmailSender(),
    appBaseUrl: "https://memotask.example.com"
  });
  const app = createApi({
    repository,
    authService,
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-ui",
    fetchAi
  });
  let cookie = createSessionCookie(sessionToken, "2099-01-01T00:00:00.000Z").split(";")[0];
  const fetcher: typeof fetch = async (input, init) => {
    await authReady;
    const url = input instanceof Request ? input.url : input.toString();
    if (typeof options !== "function") {
      options?.onRequest?.(url);
      if (options?.failForUrl?.(url)) {
        throw new Error(`Simulated request failure for ${url}`);
      }
      const delayMs = options?.delayForUrl?.(url) ?? options?.delayMs ?? 0;
      if (delayMs > 0 && !url.includes("/api/auth/")) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
    const requestHeaders = new Headers(input instanceof Request ? input.headers : init?.headers);
    if (cookie) {
      requestHeaders.set("cookie", cookie);
    }
    const response = await app.request(url, { ...init, headers: requestHeaders });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      cookie = setCookie.includes("Max-Age=0") ? "" : setCookie.split(";")[0];
    }
    return response;
  };

  return new ApiClient(fetcher);
}

export async function findPrimaryNav(): Promise<HTMLElement> {
  return screen.findByRole("navigation", { name: "主导航" });
}

async function seedDefaultSession(authRepository: MemoryAuthRepository, sessionToken: string): Promise<void> {
  await authRepository.createUser({
    id: "default",
    email: "local@memotask.test",
    passwordHash: await hashPassword("memo123"),
    emailVerifiedAt: "2026-06-22T12:00:00.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z"
  });
  await authRepository.createSession({
    id: "session-default",
    userId: "default",
    tokenHash: await hashToken(sessionToken),
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    lastSeenAt: "2026-06-22T12:00:00.000Z"
  });
}

class RecordingEmailSender implements EmailSender {
  public messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

export function createAuthenticatedUiTestClient() {
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
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-auth-ui"
  });
  let cookie = "";

  const fetcher: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const requestHeaders = new Headers(input instanceof Request ? input.headers : init?.headers);
    if (cookie) {
      requestHeaders.set("cookie", cookie);
    }

    const response = await app.request(url, { ...init, headers: requestHeaders });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      cookie = setCookie.includes("Max-Age=0") ? "" : setCookie.split(";")[0];
    }
    return response;
  };

  const client = new ApiClient(fetcher);
  const latestTokenForSubject = (subject: string) => {
    const message = emailSender.messages.filter((candidate) => candidate.subject === subject).at(-1);
    return message?.actionUrl ? new URL(message.actionUrl).searchParams.get("token") ?? "" : "";
  };
  const latestCodeForSubject = (subject: string) => {
    const message = emailSender.messages.filter((candidate) => candidate.subject === subject).at(-1);
    return message?.text.match(/\b\d{6}\b/)?.[0] ?? "";
  };

  return Object.assign(client, {
    getLatestVerificationCode: () => latestCodeForSubject("验证你的 MemoTask 邮箱"),
    getLatestResetToken: () => latestTokenForSubject("重置你的 MemoTask 密码")
  });
}
