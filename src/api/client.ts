import type { AiSettingsView, AnalyzeDraftResult, AuthUserView, DraftInput, Memo, PublishMemoInput, SyncStatusView } from "../types";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface AiSettingsInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
  promptTemplate: string;
}

export class ApiClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async getCurrentUser(): Promise<AuthUserView | null> {
    try {
      const body = await this.request<{ user: AuthUserView }>("/api/auth/me");
      return body.user ?? null;
    } catch {
      return null;
    }
  }

  async register(input: { email: string; password: string }): Promise<AuthUserView> {
    const body = await this.request<{ user: AuthUserView }>("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.user);
    return body.user;
  }

  async login(input: { email: string; password: string }): Promise<AuthUserView> {
    const body = await this.request<{ user: AuthUserView }>("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.user);
    return body.user;
  }

  async logout(): Promise<void> {
    await this.request<{ ok: true }>("/api/auth/logout", { method: "POST" });
  }

  async verifyEmail(code: string): Promise<AuthUserView> {
    const body = await this.request<{ user: AuthUserView }>("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code })
    });
    assertPresent(body.user);
    return body.user;
  }

  async resendVerification(email: string): Promise<void> {
    await this.request<{ ok: true }>("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request<{ ok: true }>("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(input: { token: string; password: string }): Promise<AuthUserView> {
    const body = await this.request<{ user: AuthUserView }>("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.user);
    return body.user;
  }

  async listMemos(): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>("/api/memos");
    assertArray(body.memos);
    return body.memos;
  }

  async publishMemo(input: PublishMemoInput): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.memo);
    return body.memo;
  }

  async getMemo(memoId: string): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}`);
    assertPresent(body.memo);
    return body.memo;
  }

  async createDraft(input: DraftInput): Promise<Memo> {
    const body = await this.request<{ draft: Memo }>("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.draft);
    return body.draft;
  }

  async updateDraft(draftId: string, input: DraftInput): Promise<Memo> {
    const body = await this.request<{ draft: Memo }>(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.draft);
    return body.draft;
  }

  async listRecentDrafts(): Promise<Memo[]> {
    const body = await this.request<{ drafts: Memo[] }>("/api/drafts/recent");
    assertArray(body.drafts);
    return body.drafts;
  }

  async toggleTodo(todoId: string): Promise<void> {
    await this.request<{ todo: unknown }>(`/api/todos/${todoId}/toggle`, { method: "POST" });
  }

  async updateMemo(memoId: string, input: { title: string; content: string }): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.memo);
    return body.memo;
  }

  async reorderMemos(memoIds: string[]): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>("/api/memos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoIds })
    });
    assertArray(body.memos);
    return body.memos;
  }

  async reorderTodos(memoId: string, todoIds: string[]): Promise<void> {
    await this.request<{ todos: unknown[] }>("/api/todos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoId, todoIds })
    });
  }

  async archiveMemo(memoId: string): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}/archive`, { method: "POST" });
    assertPresent(body.memo);
    return body.memo;
  }

  async createTodo(memoId: string, input: { title: string; notes?: string | null; generatedByAi?: boolean }): Promise<void> {
    await this.request<{ todo: unknown }>(`/api/memos/${memoId}/todos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  async updateTodo(todoId: string, input: { title: string; notes?: string | null }): Promise<void> {
    await this.request<{ todo: unknown }>(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  async deleteTodo(todoId: string): Promise<void> {
    await this.request<{ todo: unknown }>(`/api/todos/${todoId}`, { method: "DELETE" });
  }

  async listHistory(): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>("/api/history");
    assertArray(body.memos);
    return body.memos;
  }

  async searchHistory(query: string): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>(`/api/history/search?q=${encodeURIComponent(query)}`);
    assertArray(body.memos);
    return body.memos;
  }

  async restoreMemo(memoId: string): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}/restore`, { method: "POST" });
    assertPresent(body.memo);
    return body.memo;
  }

  async bulkDeleteHistory(memoIds: string[]): Promise<{ operation: { id: string }; deletedCount: number }> {
    return this.request<{ operation: { id: string }; deletedCount: number }>("/api/history/bulk-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoIds })
    });
  }

  async undoHistoryDelete(operationId: string): Promise<void> {
    await this.request<{ restored: Memo[] }>("/api/history/undo-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId })
    });
  }

  async getAiSettings(): Promise<AiSettingsView> {
    const body = await this.request<{ settings: AiSettingsView }>("/api/ai/settings");
    assertPresent(body.settings);
    return body.settings;
  }

  async saveAiSettings(input: AiSettingsInput): Promise<AiSettingsView> {
    const body = await this.request<{ settings: AiSettingsView }>("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    assertPresent(body.settings);
    return body.settings;
  }

  async resetAiPrompt(): Promise<AiSettingsView> {
    const body = await this.request<{ settings: AiSettingsView }>("/api/ai/reset-prompt", { method: "POST" });
    assertPresent(body.settings);
    return body.settings;
  }

  async testAiConnection(): Promise<void> {
    await this.request<{ ok: true }>("/api/ai/test", { method: "POST" });
  }

  async analyzeDraft(draftId: string): Promise<AnalyzeDraftResult> {
    const body = await this.request<{ result: AnalyzeDraftResult }>("/api/ai/analyze-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId })
    });
    assertPresent(body.result);
    return body.result;
  }

  async exportJson(): Promise<unknown> {
    return this.request<unknown>("/api/export/json");
  }

  async getSyncStatus(): Promise<SyncStatusView> {
    const body = await this.request<{ status: SyncStatusView }>("/api/sync/status");
    assertPresent(body.status);
    return body.status;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(url, { ...init, credentials: "include" });
    const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

    if (!response.ok) {
      throw new ApiRequestError(body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "请求失败，请稍后重试", response.status);
    }

    return body;
  }
}

export const apiClient = new ApiClient();

function assertPresent<T>(value: T | null | undefined): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error("请求失败，请稍后重试");
  }
}

function assertArray(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("请求失败，请稍后重试");
  }
}
