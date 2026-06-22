import type { AiSettingsView, AnalyzeDraftResult, DraftInput, Memo, PublishMemoInput, SyncStatusView } from "../types";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface AiSettingsInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
  promptTemplate: string;
}

export class ApiClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async listMemos(): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>("/api/memos");
    return body.memos;
  }

  async publishMemo(input: PublishMemoInput): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>("/api/memos/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return body.memo;
  }

  async createDraft(input: DraftInput): Promise<Memo> {
    const body = await this.request<{ draft: Memo }>("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return body.draft;
  }

  async listRecentDrafts(): Promise<Memo[]> {
    const body = await this.request<{ drafts: Memo[] }>("/api/drafts/recent");
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
    return body.memo;
  }

  async reorderMemos(memoIds: string[]): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>("/api/memos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoIds })
    });
    return body.memos;
  }

  async archiveMemo(memoId: string): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}/archive`, { method: "POST" });
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
    return body.memos;
  }

  async searchHistory(query: string): Promise<Memo[]> {
    const body = await this.request<{ memos: Memo[] }>(`/api/history/search?q=${encodeURIComponent(query)}`);
    return body.memos;
  }

  async restoreMemo(memoId: string): Promise<Memo> {
    const body = await this.request<{ memo: Memo }>(`/api/memos/${memoId}/restore`, { method: "POST" });
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
    return body.settings;
  }

  async saveAiSettings(input: AiSettingsInput): Promise<AiSettingsView> {
    const body = await this.request<{ settings: AiSettingsView }>("/api/ai/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return body.settings;
  }

  async resetAiPrompt(): Promise<AiSettingsView> {
    const body = await this.request<{ settings: AiSettingsView }>("/api/ai/reset-prompt", { method: "POST" });
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
    return body.result;
  }

  async exportJson(): Promise<unknown> {
    return this.request<unknown>("/api/export/json");
  }

  async getSyncStatus(): Promise<SyncStatusView> {
    const body = await this.request<{ status: SyncStatusView }>("/api/sync/status");
    return body.status;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = init ? await this.fetcher(url, init) : await this.fetcher(url);
    const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "请求失败，请稍后重试");
    }

    return body;
  }
}

export const apiClient = new ApiClient();
