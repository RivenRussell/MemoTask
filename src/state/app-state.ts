import { useEffect, useMemo, useState } from "react";
import { ApiClient, apiClient } from "../api/client";
import type { AiSettingsView, DraftTodoInput, Memo, PublishMemoInput, SyncStatusView } from "../types";

export type Page = "capture" | "memos" | "settings" | "history";
export type PrimaryPage = "capture" | "memos" | "settings";

export interface DraftState {
  title: string;
  content: string;
  todos: DraftTodoInput[];
}

export interface AiSettingsDraft {
  baseUrl: string;
  model: string;
  apiKey: string;
  promptTemplate: string;
}

export interface AppState {
  page: Page;
  activePrimary: PrimaryPage;
  title: string;
  memos: Memo[];
  historyMemos: Memo[];
  historyQuery: string;
  draft: DraftState;
  aiSettings: AiSettingsView | null;
  aiSettingsDraft: AiSettingsDraft;
  syncStatus: SyncStatusView | null;
  settingsMessage: string | null;
  historyMessage: string | null;
  canUndoHistoryDelete: boolean;
  isLoading: boolean;
  error: string | null;
  setPage: (page: Page) => void;
  updateDraft: (patch: Partial<DraftState>) => void;
  updateAiSettingsDraft: (patch: Partial<AiSettingsDraft>) => void;
  addDraftTodo: (title: string) => void;
  removeDraftTodo: (index: number) => void;
  publishDraft: () => Promise<void>;
  toggleTodo: (todoId: string) => Promise<void>;
  restoreMemo: (memoId: string) => Promise<void>;
  refreshMemos: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  searchHistory: (query: string) => Promise<void>;
  bulkDeleteHistory: (memoIds: string[]) => Promise<void>;
  undoHistoryDelete: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveAiSettings: () => Promise<void>;
  resetAiPrompt: () => Promise<void>;
  testAiConnection: () => Promise<void>;
  exportJson: () => Promise<void>;
}

const emptyDraft: DraftState = {
  title: "",
  content: "",
  todos: []
};

const defaultAiSettingsDraft: AiSettingsDraft = {
  baseUrl: "",
  model: "dsv4-pro",
  apiKey: "",
  promptTemplate: "你是 MemoTask 的整理助手。"
};

export function useMemoTaskState(client: ApiClient = apiClient): AppState {
  const [page, setPageState] = useState<Page>("memos");
  const [memos, setMemos] = useState<Memo[]>([]);
  const [historyMemos, setHistoryMemos] = useState<Memo[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>(defaultAiSettingsDraft);
  const [syncStatus, setSyncStatus] = useState<SyncStatusView | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [lastHistoryDeleteOperationId, setLastHistoryDeleteOperationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activePrimary = page === "history" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);

  useEffect(() => {
    void refreshMemos();
  }, []);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "请求失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshMemos() {
    await run(async () => {
      setMemos(await client.listMemos());
    });
  }

  async function refreshHistory() {
    setHistoryQuery("");
    await loadHistory("");
  }

  function setPage(page: Page) {
    setPageState(page);
    if (page === "history") {
      void refreshHistory();
    }
    if (page === "settings") {
      void refreshSettings();
    }
  }

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateAiSettingsDraft(patch: Partial<AiSettingsDraft>) {
    setAiSettingsDraft((current) => ({ ...current, ...patch }));
  }

  function addDraftTodo(title: string) {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    setDraft((current) => ({
      ...current,
      todos: [...current.todos, { title: trimmed, notes: null, generatedByAi: false }]
    }));
  }

  function removeDraftTodo(index: number) {
    setDraft((current) => ({
      ...current,
      todos: current.todos.filter((_, candidateIndex) => candidateIndex !== index)
    }));
  }

  async function publishDraft() {
    if (!draft.content.trim()) {
      setError("请输入 Memo 内容");
      return;
    }

    const input: PublishMemoInput = {
      title: draft.title.trim() || "未命名 Memo",
      content: draft.content,
      todos: draft.todos
    };

    await run(async () => {
      await client.publishMemo(input);
      setDraft(emptyDraft);
      setPageState("memos");
      setMemos(await client.listMemos());
    });
  }

  async function toggleTodo(todoId: string) {
    await run(async () => {
      await client.toggleTodo(todoId);
      setMemos(await client.listMemos());
    });
  }

  async function restoreMemo(memoId: string) {
    await run(async () => {
      await client.restoreMemo(memoId);
      setPageState("memos");
      setMemos(await client.listMemos());
    });
  }

  async function loadHistory(query: string) {
    await run(async () => {
      setHistoryMemos(query.trim() ? await client.searchHistory(query) : await client.listHistory());
    });
  }

  async function searchHistory(query: string) {
    setHistoryQuery(query);
    await loadHistory(query);
  }

  async function bulkDeleteHistory(memoIds: string[]) {
    if (memoIds.length === 0) {
      return;
    }

    await run(async () => {
      const result = await client.bulkDeleteHistory(memoIds);
      setLastHistoryDeleteOperationId(result.operation.id);
      setHistoryMessage(`已删除 ${result.deletedCount} 个 Memo`);
      setHistoryMemos(historyQuery.trim() ? await client.searchHistory(historyQuery) : await client.listHistory());
    });
  }

  async function undoHistoryDelete() {
    if (!lastHistoryDeleteOperationId) {
      return;
    }

    await run(async () => {
      await client.undoHistoryDelete(lastHistoryDeleteOperationId);
      setLastHistoryDeleteOperationId(null);
      setHistoryMessage("已撤销删除");
      setHistoryMemos(historyQuery.trim() ? await client.searchHistory(historyQuery) : await client.listHistory());
    });
  }

  async function refreshSettings() {
    await run(async () => {
      const [settings, status] = await Promise.all([client.getAiSettings(), client.getSyncStatus()]);
      setAiSettings(settings);
      setSyncStatus(status);
      setAiSettingsDraft({
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: "",
        promptTemplate: settings.promptTemplate
      });
    });
  }

  async function saveAiSettings() {
    await run(async () => {
      const nextSettings = await client.saveAiSettings({
        baseUrl: aiSettingsDraft.baseUrl,
        model: aiSettingsDraft.model,
        apiKey: aiSettingsDraft.apiKey.trim() || undefined,
        promptTemplate: aiSettingsDraft.promptTemplate
      });
      setAiSettings(nextSettings);
      setAiSettingsDraft({
        baseUrl: nextSettings.baseUrl,
        model: nextSettings.model,
        apiKey: "",
        promptTemplate: nextSettings.promptTemplate
      });
      setSettingsMessage("已保存 AI 设置");
    });
  }

  async function resetAiPrompt() {
    await run(async () => {
      const nextSettings = await client.resetAiPrompt();
      setAiSettings(nextSettings);
      setAiSettingsDraft((current) => ({ ...current, promptTemplate: nextSettings.promptTemplate }));
      setSettingsMessage("已恢复默认 Prompt");
    });
  }

  async function testAiConnection() {
    await run(async () => {
      await client.testAiConnection();
      setSettingsMessage("连接测试通过");
    });
  }

  async function exportJson() {
    await run(async () => {
      await client.exportJson();
      setSettingsMessage("JSON 导出已生成");
    });
  }

  return {
    page,
    activePrimary,
    title,
    memos,
    historyMemos,
    historyQuery,
    draft,
    aiSettings,
    aiSettingsDraft,
    syncStatus,
    settingsMessage,
    historyMessage,
    canUndoHistoryDelete: Boolean(lastHistoryDeleteOperationId),
    isLoading,
    error,
    setPage,
    updateDraft,
    updateAiSettingsDraft,
    addDraftTodo,
    removeDraftTodo,
    publishDraft,
    toggleTodo,
    restoreMemo,
    refreshMemos,
    refreshHistory,
    searchHistory,
    bulkDeleteHistory,
    undoHistoryDelete,
    refreshSettings,
    saveAiSettings,
    resetAiPrompt,
    testAiConnection,
    exportJson
  };
}

function pageTitle(page: Page): string {
  if (page === "capture") return "Capture";
  if (page === "settings") return "Settings";
  if (page === "history") return "History";
  return "Memos";
}
