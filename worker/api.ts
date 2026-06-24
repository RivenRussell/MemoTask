import { Hono } from "hono";
import type { AuthService } from "./auth/service";
import { EmailConfigurationError, EmailDeliveryError } from "./auth/email";
import { AuthError, type PublicAuthUser } from "./auth/types";
import { moveMemoToHistory, restoreMemoFromHistory, shouldAutoArchiveMemo, toggleTodoStatus } from "./domain/state-machines";
import { MemoryRepository } from "./repository/memory-repository";
import type { AiSettings, MemoRepository } from "./repository/types";
import { DEFAULT_PROMPT } from "../src/shared/ai-defaults";

interface ApiOptions {
  repository?: MemoRepository;
  authService?: AuthService;
  now?: () => string;
  appEncryptionKey?: string;
  fetchAi?: (request: Request) => Promise<Response>;
}

const undoOperations = new Map<string, { memoIds: string[]; expiresAt: string }>();
const AI_SETTINGS_REQUIRED_MESSAGE = "请先在设置里为当前账号填写接口地址、模型名称和 API 密钥";

function getNow(options?: ApiOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

async function readJson<T>(context: { req: { json: () => Promise<T> } }): Promise<T> {
  return context.req.json();
}

async function currentUser(
  context: { req: { header: (name: string) => string | undefined } },
  options: ApiOptions
): Promise<{ user: PublicAuthUser | null; response: Response | null }> {
  if (!options.authService) {
    return { user: null, response: null };
  }

  const user = await options.authService.resolveSession(context.req.header("cookie"), getNow(options));
  if (!user) {
    return {
      user: null,
      response: Response.json({ error: { code: "AUTH_REQUIRED", message: "请先登录" } }, { status: 401 })
    };
  }
  if (!user.emailVerified) {
    return {
      user,
      response: Response.json({ error: { code: "EMAIL_NOT_VERIFIED", message: "请先验证邮箱" } }, { status: 403 })
    };
  }

  return { user, response: null };
}

function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    const statusByCode: Record<string, number> = {
      EMAIL_ALREADY_REGISTERED: 409,
      EMAIL_INVALID: 400,
      PASSWORD_TOO_SHORT: 400,
      INVALID_CREDENTIALS: 401,
      EMAIL_NOT_VERIFIED: 403,
      PASSWORD_WEAK: 400,
      TOKEN_INVALID: 400
    };
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: statusByCode[error.code] ?? 400 }
    );
  }
  if (error instanceof EmailConfigurationError || error instanceof EmailDeliveryError) {
    console.error("Auth email error", { name: error.name, message: error.message });
    return Response.json({ error: { code: "EMAIL_DELIVERY_FAILED", message: "邮件发送失败，请稍后重试" } }, { status: 502 });
  }
  console.error("Unhandled auth error", error instanceof Error ? { name: error.name, message: error.message } : error);
  return Response.json({ error: { code: "AUTH_FAILED", message: "账号操作失败，请稍后重试" } }, { status: 500 });
}

function withSessionCookie(context: { json: (object: unknown, status?: number) => Response }, body: unknown, sessionCookie: string, status = 200): Response {
  const response = context.json(body, status);
  response.headers.append("set-cookie", sessionCookie);
  return response;
}

function publicAiSettings(settings: AiSettings) {
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeyMask: settings.apiKeyMask,
    promptTemplate: settings.promptTemplate,
    updatedAt: settings.updatedAt
  };
}

function getEncryptionKey(options: ApiOptions): string | undefined {
  return options.appEncryptionKey?.trim();
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

async function encryptionMaterial(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function encryptApiKey(apiKey: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionMaterial(secret);
  const plain = new TextEncoder().encode(apiKey);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plain)));
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(cipher)}`;
}

async function decryptApiKey(encryptedApiKey: string, secret: string): Promise<string> {
  const [version, ivValue, cipherValue] = encryptedApiKey.split(":");
  if (version !== "v1" || !ivValue || !cipherValue) {
    throw new Error("Unsupported encrypted key format");
  }

  const key = await encryptionMaterial(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(ivValue)) }, key, toArrayBuffer(base64ToBytes(cipherValue)));
  return new TextDecoder().decode(plain);
}

async function getPlainApiKey(settings: AiSettings, options: ApiOptions): Promise<string | null> {
  if (!settings.encryptedApiKey) {
    return null;
  }

  const key = getEncryptionKey(options);
  if (!key) {
    throw new Error("ENCRYPTION_KEY_MISSING");
  }

  return decryptApiKey(settings.encryptedApiKey, key);
}

function extractAiContent(payload: any): string {
  return payload?.choices?.[0]?.message?.content ?? payload?.content ?? "";
}

function parseAiJson(content: string): { title: string; todos: Array<{ title: string; notes: string | null }> } {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { title?: unknown; todos?: unknown };
  if (typeof parsed.title !== "string" || !Array.isArray(parsed.todos)) {
    throw new Error("AI response shape is invalid");
  }

  return {
    title: parsed.title,
    todos: parsed.todos
      .filter((todo): todo is { title: unknown; notes?: unknown } => Boolean(todo) && typeof todo === "object")
      .map((todo) => ({
        title: typeof todo.title === "string" ? todo.title.trim() : "",
        notes: typeof todo.notes === "string" && todo.notes.trim() ? todo.notes.trim() : null
      }))
      .filter((todo) => todo.title.length > 0)
  };
}

function buildAnalyzeSystemPrompt(promptTemplate: string): string {
  return `${promptTemplate}

无论用户输入什么，必须只返回一个 JSON object，不能返回 Markdown、解释或额外文字。
JSON schema:
{
  "title": "string",
  "todos": [
    { "title": "string", "notes": "string | null" }
  ]
}`;
}

async function fetchAiWithRetries(createRequest: () => Request, fetchAi: (request: Request) => Promise<Response>): Promise<Response> {
  let latestResponse: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    latestResponse = await fetchAi(createRequest());
    if (latestResponse.ok) {
      return latestResponse;
    }
  }

  return latestResponse ?? Response.json({ error: "AI request failed" }, { status: 502 });
}

export function createApi(options: ApiOptions = {}) {
  const repository = options.repository ?? new MemoryRepository();
  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));

  app.post("/api/auth/register", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ email?: string; password?: string }>(context);
      const result = await options.authService.register({ email: body.email ?? "", password: body.password ?? "" }, getNow(options));
      return withSessionCookie(context, { user: result.user }, result.sessionCookie, 201);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/auth/login", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ email?: string; password?: string }>(context);
      const result = await options.authService.login({ email: body.email ?? "", password: body.password ?? "" }, getNow(options));
      return withSessionCookie(context, { user: result.user }, result.sessionCookie);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/auth/logout", async (context) => {
    if (!options.authService) {
      return context.json({ ok: true });
    }

    const result = await options.authService.logout(context.req.header("cookie"));
    return withSessionCookie(context, { ok: true }, result.sessionCookie);
  });

  app.get("/api/auth/me", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    const user = await options.authService.resolveSession(context.req.header("cookie"), getNow(options));
    if (!user) {
      return context.json({ error: { code: "AUTH_REQUIRED", message: "请先登录" } }, 401);
    }
    return context.json({ user });
  });

  app.post("/api/auth/verify-email", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ code?: string; token?: string }>(context);
      const result = await options.authService.verifyEmail(body.code ?? body.token ?? "", getNow(options));
      return withSessionCookie(context, { user: result.user }, result.sessionCookie);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/auth/resend-verification", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ email?: string }>(context);
      const result = await options.authService.resendVerification(body.email ?? "", getNow(options));
      return context.json(result);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/auth/forgot-password", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ email?: string }>(context);
      const result = await options.authService.forgotPassword(body.email ?? "", getNow(options));
      return context.json(result);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/auth/reset-password", async (context) => {
    if (!options.authService) {
      return context.json({ error: { code: "AUTH_UNAVAILABLE", message: "账号服务未启用" } }, 503);
    }

    try {
      const body = await readJson<{ token?: string; password?: string }>(context);
      const result = await options.authService.resetPassword({ token: body.token ?? "", password: body.password ?? "" }, getNow(options));
      return withSessionCookie(context, { user: result.user }, result.sessionCookie);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.post("/api/drafts", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ title?: string; content?: string }>(context);
    if (!body.content?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, 400);
    }

    const draft = await repository.createDraft(userId, { title: body.title, content: body.content }, getNow(options));
    return context.json({ draft }, 201);
  });

  app.get("/api/drafts/recent", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const drafts = await repository.listRecentDrafts(userId, 3);
    return context.json({ drafts });
  });

  app.patch("/api/drafts/:id", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ title?: string; content?: string }>(context);
    if (!body.content?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, 400);
    }

    const draft = await repository.updateDraft(userId, context.req.param("id"), { title: body.title, content: body.content }, getNow(options));
    if (!draft) {
      return context.json({ error: { code: "NOT_FOUND", message: "草稿不存在" } }, 404);
    }

    return context.json({ draft });
  });

  app.post("/api/memos/publish", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{
      title?: string;
      content?: string;
      draftId?: string;
      todos?: Array<{ title?: string; notes?: string | null; generatedByAi?: boolean }>;
    }>(context);
    if (!body.content?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Memo 内容" } }, 400);
    }

    const memo = await repository.publishMemo(
      userId,
      {
        draftId: body.draftId,
        title: body.title?.trim() || "未命名 Memo",
        content: body.content,
        todos: (body.todos ?? [])
          .filter((todo) => todo.title?.trim())
          .map((todo) => ({
            title: todo.title?.trim() ?? "",
            notes: todo.notes ?? null,
            generatedByAi: todo.generatedByAi
          }))
      },
      getNow(options)
    );

    return context.json({ memo }, 201);
  });

  app.get("/api/memos", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memos = await repository.listActiveMemos(userId);
    return context.json({ memos });
  });

  app.get("/api/memos/:id", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memo = await repository.findMemo(userId, context.req.param("id"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    return context.json({ memo });
  });

  app.patch("/api/memos/:id", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memo = await repository.findMemo(userId, context.req.param("id"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; content?: string }>(context);
    const updated = await repository.saveMemo(userId, {
      ...memo,
      title: body.title?.trim() || memo.title,
      content: body.content ?? memo.content,
      updatedAt: getNow(options)
    });
    return context.json({ memo: updated });
  });

  app.post("/api/memos/:id/archive", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memo = await repository.findMemo(userId, context.req.param("id"));
    if (!memo || memo.status !== "active" || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const archived = await repository.saveMemo(userId, moveMemoToHistory(memo, "archived", getNow(options)));
    return context.json({ memo: archived });
  });

  app.post("/api/memos/:id/restore", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memo = await repository.findMemo(userId, context.req.param("id"));
    if (!memo || memo.status !== "history" || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const restored = await repository.saveMemo(userId, restoreMemoFromHistory(memo, getNow(options)));
    return context.json({ memo: restored });
  });

  app.post("/api/memos/reorder", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ memoIds?: string[] }>(context);
    if (!Array.isArray(body.memoIds)) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "排序数据无效" } }, 400);
    }

    const memos = await repository.reorderMemos(userId, body.memoIds, getNow(options));
    return context.json({ memos });
  });

  app.post("/api/todos/:id/toggle", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const todo = await repository.findTodo(userId, context.req.param("id"));
    if (!todo) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    const now = getNow(options);
    const updatedTodo = await repository.updateTodo(userId, toggleTodoStatus(todo, now));
    const memo = await repository.findMemo(userId, updatedTodo.memoId);
    if (memo) {
      const nextTodos = memo.todos.map((candidate) => (candidate.id === updatedTodo.id ? updatedTodo : candidate));
      const shouldArchive = shouldAutoArchiveMemo(nextTodos, memo.autoArchiveSuppressedUntilChange);
      await repository.saveMemo(
        userId,
        shouldArchive
          ? moveMemoToHistory({ ...memo, todos: nextTodos }, "completed", now)
          : { ...memo, todos: nextTodos, autoArchiveSuppressedUntilChange: false, updatedAt: now }
      );
    }

    return context.json({ todo: updatedTodo });
  });

  app.post("/api/memos/:memoId/todos", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memo = await repository.findMemo(userId, context.req.param("memoId"));
    if (!memo || memo.deletedAt !== null) {
      return context.json({ error: { code: "NOT_FOUND", message: "Memo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; notes?: string | null; generatedByAi?: boolean }>(context);
    if (!body.title?.trim()) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请输入 Todo 内容" } }, 400);
    }

    const todo = await repository.createTodo(
      userId,
      memo.id,
      { title: body.title, notes: body.notes ?? null, generatedByAi: body.generatedByAi },
      getNow(options)
    );
    return context.json({ todo }, 201);
  });

  app.patch("/api/todos/:id", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const todo = await repository.findTodo(userId, context.req.param("id"));
    if (!todo) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    const body = await readJson<{ title?: string; notes?: string | null }>(context);
    const updated = await repository.updateTodo(userId, {
      ...todo,
      title: body.title?.trim() || todo.title,
      notes: body.notes === undefined ? todo.notes : body.notes,
      updatedAt: getNow(options)
    });
    return context.json({ todo: updated });
  });

  app.delete("/api/todos/:id", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const deleted = await repository.deleteTodo(userId, context.req.param("id"), getNow(options));
    if (!deleted) {
      return context.json({ error: { code: "NOT_FOUND", message: "Todo 不存在" } }, 404);
    }

    return context.json({ todo: deleted });
  });

  app.post("/api/todos/reorder", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ memoId?: string; todoIds?: string[] }>(context);
    if (!body.memoId || !Array.isArray(body.todoIds)) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "排序数据无效" } }, 400);
    }

    const todos = await repository.reorderTodos(userId, body.memoId, body.todoIds, getNow(options));
    return context.json({ todos });
  });

  app.get("/api/history", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memos = await repository.listHistoryMemos(userId);
    return context.json({ memos });
  });

  app.get("/api/history/search", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memos = await repository.searchHistoryMemos(userId, context.req.query("q") ?? "");
    return context.json({ memos });
  });

  app.post("/api/history/bulk-delete", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ memoIds?: string[] }>(context);
    if (!Array.isArray(body.memoIds) || body.memoIds.length === 0) {
      return context.json({ error: { code: "VALIDATION_FAILED", message: "请选择要删除的 Memo" } }, 400);
    }

    const now = getNow(options);
    const deleted = await repository.softDeleteHistoryMemos(userId, body.memoIds, now);
    const operation = {
      id: `undo-${crypto.randomUUID()}`,
      type: "history_bulk_delete",
      memoIds: deleted.map((memo) => memo.id),
      expiresAt: new Date(Date.parse(now) + 1000 * 60 * 5).toISOString()
    };
    undoOperations.set(operation.id, { memoIds: operation.memoIds, expiresAt: operation.expiresAt });
    return context.json({ operation, deletedCount: deleted.length });
  });

  app.post("/api/history/undo-delete", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ operationId?: string }>(context);
    const operation = body.operationId ? undoOperations.get(body.operationId) : undefined;
    if (!operation) {
      return context.json({ error: { code: "NOT_FOUND", message: "撤销操作不存在" } }, 404);
    }

    const restored = await repository.restoreDeletedMemos(userId, operation.memoIds, getNow(options));
    undoOperations.delete(body.operationId ?? "");
    return context.json({ restored });
  });

  app.get("/api/export/json", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const memos = await repository.listExportableMemos(userId);
    const settings = await repository.getAiSettings(userId, getNow(options));
    return context.json({
      exportedAt: getNow(options),
      version: 1,
      memos,
      aiSettings: {
        baseUrl: settings.baseUrl,
        model: settings.model,
        hasApiKey: Boolean(settings.encryptedApiKey)
      }
    });
  });

  app.get("/api/ai/settings", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const settings = await repository.getAiSettings(userId, getNow(options));
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.put("/api/ai/settings", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ baseUrl?: string; model?: string; apiKey?: string; promptTemplate?: string }>(context);
    const trimmedApiKey = body.apiKey?.trim();
    let encryptedApiKey: string | undefined;
    let apiKeyMask: string | undefined;

    if (trimmedApiKey) {
      const encryptionKey = getEncryptionKey(options);
      if (!encryptionKey) {
        return context.json({ error: { code: "ENCRYPTION_KEY_MISSING", message: "服务端加密密钥未配置" } }, 500);
      }

      encryptedApiKey = await encryptApiKey(trimmedApiKey, encryptionKey);
      apiKeyMask = maskApiKey(trimmedApiKey);
    }

    const settings = await repository.saveAiSettings(
      userId,
      {
        baseUrl: body.baseUrl ?? "",
        model: body.model ?? "",
        encryptedApiKey,
        apiKeyMask,
        promptTemplate: body.promptTemplate || DEFAULT_PROMPT
      },
      getNow(options)
    );
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.post("/api/ai/reset-prompt", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const settings = await repository.resetAiPrompt(userId, DEFAULT_PROMPT, getNow(options));
    return context.json({ settings: publicAiSettings(settings) });
  });

  app.post("/api/ai/test", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const settings = await repository.getAiSettings(userId, getNow(options));
    if (!settings.baseUrl || !settings.model || !settings.encryptedApiKey) {
      return context.json({ error: { code: "AI_UNAVAILABLE", message: AI_SETTINGS_REQUIRED_MESSAGE } }, 400);
    }

    const apiKey = await getPlainApiKey(settings, options);
    const fetchAi = options.fetchAi ?? fetch;
    const response = await fetchAi(
      new Request(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "user", content: "MemoTask 连接测试" }],
          max_tokens: 8
        })
      })
    );

    if (!response.ok) {
      return context.json({ error: { code: "AI_FAILED", message: "AI 连接测试失败" } }, 502);
    }

    return context.json({ ok: true });
  });

  app.post("/api/ai/analyze-draft", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const body = await readJson<{ draftId?: string }>(context);
    const settings = await repository.getAiSettings(userId, getNow(options));
    if (!settings.baseUrl || !settings.model || !settings.encryptedApiKey) {
      return context.json({ error: { code: "AI_UNAVAILABLE", message: AI_SETTINGS_REQUIRED_MESSAGE } }, 400);
    }

    const draft = body.draftId ? await repository.findMemo(userId, body.draftId) : null;
    if (!draft || draft.status !== "draft") {
      return context.json({ error: { code: "NOT_FOUND", message: "草稿不存在" } }, 404);
    }

    const apiKey = await getPlainApiKey(settings, options);
    const fetchAi = options.fetchAi ?? fetch;
    const response = await fetchAiWithRetries(
      () => new Request(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: buildAnalyzeSystemPrompt(settings.promptTemplate) },
            { role: "user", content: draft.content }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200
        })
      }),
      fetchAi
    );

    if (!response.ok) {
      return context.json({ error: { code: "AI_FAILED", message: "AI 分析失败" } }, 502);
    }

    try {
      const payload = await response.json();
      const result = parseAiJson(extractAiContent(payload));
      return context.json({ result });
    } catch {
      return context.json({ error: { code: "AI_INVALID_JSON", message: "AI 返回格式无效" } }, 502);
    }
  });

  app.get("/api/sync/status", async (context) => {
    const auth = await currentUser(context, options);
    if (auth.response) return auth.response;
    const userId = auth.user?.id ?? "default";
    const status = await repository.getSyncStatus(userId, getNow(options));
    return context.json({ status });
  });

  return app;
}
