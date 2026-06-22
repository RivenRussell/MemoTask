import { useEffect, useMemo, useState } from "react";
import { ApiClient, apiClient } from "../api/client";
import type { AiSettingsView, DraftTodoInput, Memo, PublishMemoInput, SyncStatusView } from "../types";

export type Page = "capture" | "memos" | "memoDetail" | "settings" | "history";
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
  activeMemo: Memo | null;
  historyMemos: Memo[];
  historyQuery: string;
  recentDrafts: Memo[];
  draft: DraftState;
  captureMessage: string | null;
  isAnalyzing: boolean;
  aiSettings: AiSettingsView | null;
  aiSettingsDraft: AiSettingsDraft;
  syncStatus: SyncStatusView | null;
  settingsMessage: string | null;
  historyMessage: string | null;
  detailMessage: string | null;
  canUndoHistoryDelete: boolean;
  isLoading: boolean;
  error: string | null;
  setPage: (page: Page) => void;
  openMemoDetail: (memoId: string) => void;
  updateDraft: (patch: Partial<DraftState>) => void;
  updateAiSettingsDraft: (patch: Partial<AiSettingsDraft>) => void;
  loadRecentDraft: (draftId: string) => void;
  addDraftTodo: (title: string) => void;
  removeDraftTodo: (index: number) => void;
  analyzeDraft: () => Promise<void>;
  publishDraft: () => Promise<void>;
  toggleTodo: (todoId: string) => Promise<void>;
  moveMemo: (memoId: string, direction: "up" | "down") => Promise<void>;
  updateActiveMemo: (input: { title: string; content: string }) => Promise<void>;
  addActiveMemoTodo: (title: string) => Promise<void>;
  updateActiveMemoTodo: (todoId: string, title: string) => Promise<void>;
  deleteActiveMemoTodo: (todoId: string) => Promise<void>;
  archiveActiveMemo: () => Promise<void>;
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
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [historyMemos, setHistoryMemos] = useState<Memo[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [recentDrafts, setRecentDrafts] = useState<Memo[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>(defaultAiSettingsDraft);
  const [syncStatus, setSyncStatus] = useState<SyncStatusView | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [lastHistoryDeleteOperationId, setLastHistoryDeleteOperationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activePrimary = page === "history" || page === "memoDetail" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);

  useEffect(() => {
    void refreshMemos();
  }, []);

  useEffect(() => {
    if (page !== "capture") {
      return;
    }

    void refreshDrafts();
  }, [page]);

  useEffect(() => {
    if (page !== "capture" || !draft.content.trim()) {
      return;
    }

    setCaptureMessage("草稿保存中");
    const timeout = window.setTimeout(() => {
      void saveCurrentDraft();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [page, draft.title, draft.content]);

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
    if (page === "capture") {
      void refreshDrafts();
    }
  }

  function openMemoDetail(memoId: string) {
    const selectedMemo = memos.find((memo) => memo.id === memoId);
    if (!selectedMemo) {
      return;
    }

    setActiveMemo(selectedMemo);
    setDetailMessage(null);
    setPageState("memoDetail");
  }

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateAiSettingsDraft(patch: Partial<AiSettingsDraft>) {
    setAiSettingsDraft((current) => ({ ...current, ...patch }));
  }

  function loadRecentDraft(draftId: string) {
    const selected = recentDrafts.find((candidate) => candidate.id === draftId);
    if (!selected) {
      return;
    }

    setCurrentDraftId(selected.id);
    setDraft({
      title: selected.title === "未命名 Memo" ? "" : selected.title,
      content: selected.content,
      todos: []
    });
    setCaptureMessage("已载入最近草稿");
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

  async function refreshDrafts() {
    await run(async () => {
      setRecentDrafts(await client.listRecentDrafts());
    });
  }

  async function saveCurrentDraft(): Promise<string | null> {
    if (!draft.content.trim()) {
      return currentDraftId;
    }

    let savedDraftId: string | null = null;
    await run(async () => {
      const savedDraft = await client.createDraft({
        title: draft.title.trim() || undefined,
        content: draft.content
      });
      savedDraftId = savedDraft.id;
      setCurrentDraftId(savedDraft.id);
      setRecentDrafts(await client.listRecentDrafts());
      setCaptureMessage("草稿已保存");
    });
    return savedDraftId;
  }

  async function analyzeDraft() {
    if (!draft.content.trim()) {
      setError("请输入 Memo 内容");
      return;
    }

    setIsAnalyzing(true);
    await run(async () => {
      const draftId = (await saveCurrentDraft()) ?? currentDraftId;
      if (!draftId) {
        throw new Error("草稿保存失败，请稍后重试");
      }

      const result = await client.analyzeDraft(draftId);
      setDraft((current) => ({
        ...current,
        title: result.title,
        todos: result.todos.map((todo) => ({
          title: todo.title,
          notes: todo.notes,
          generatedByAi: true
        }))
      }));
      setCaptureMessage("AI 草稿已生成");
    });
    setIsAnalyzing(false);
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
      setCurrentDraftId(null);
      setCaptureMessage(null);
      setRecentDrafts(await client.listRecentDrafts());
      setPageState("memos");
      setMemos(await client.listMemos());
    });
  }

  async function toggleTodo(todoId: string) {
    await run(async () => {
      await client.toggleTodo(todoId);
      const nextMemos = await client.listMemos();
      setMemos(nextMemos);
      setActiveMemo((current) => nextMemos.find((memo) => memo.id === current?.id) ?? current);
    });
  }

  async function moveMemo(memoId: string, direction: "up" | "down") {
    const currentIndex = memos.findIndex((memo) => memo.id === memoId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= memos.length) {
      return;
    }

    const nextMemos = [...memos];
    [nextMemos[currentIndex], nextMemos[targetIndex]] = [nextMemos[targetIndex], nextMemos[currentIndex]];

    await run(async () => {
      setMemos(nextMemos);
      setMemos(await client.reorderMemos(nextMemos.map((memo) => memo.id)));
    });
  }

  async function updateActiveMemo(input: { title: string; content: string }) {
    if (!activeMemo) {
      return;
    }

    await run(async () => {
      const updated = await client.updateMemo(activeMemo.id, input);
      setActiveMemo(updated);
      setMemos(await client.listMemos());
      setDetailMessage("Memo 已保存");
    });
  }

  async function addActiveMemoTodo(title: string) {
    const trimmed = title.trim();
    if (!activeMemo || !trimmed) {
      return;
    }

    await run(async () => {
      await client.createTodo(activeMemo.id, { title: trimmed, notes: null, generatedByAi: false });
      const nextMemos = await client.listMemos();
      setMemos(nextMemos);
      setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? activeMemo);
    });
  }

  async function updateActiveMemoTodo(todoId: string, title: string) {
    const trimmed = title.trim();
    if (!activeMemo || !trimmed) {
      return;
    }

    await run(async () => {
      await client.updateTodo(todoId, { title: trimmed });
      const nextMemos = await client.listMemos();
      setMemos(nextMemos);
      setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? activeMemo);
    });
  }

  async function deleteActiveMemoTodo(todoId: string) {
    if (!activeMemo) {
      return;
    }

    await run(async () => {
      await client.deleteTodo(todoId);
      const nextMemos = await client.listMemos();
      setMemos(nextMemos);
      setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? { ...activeMemo, todos: activeMemo.todos.filter((todo) => todo.id !== todoId) });
    });
  }

  async function archiveActiveMemo() {
    if (!activeMemo) {
      return;
    }

    await run(async () => {
      await client.archiveMemo(activeMemo.id);
      setActiveMemo(null);
      setMemos(await client.listMemos());
      setPageState("history");
      setHistoryMemos(await client.listHistory());
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
    activeMemo,
    historyMemos,
    historyQuery,
    recentDrafts,
    draft,
    captureMessage,
    isAnalyzing,
    aiSettings,
    aiSettingsDraft,
    syncStatus,
    settingsMessage,
    historyMessage,
    detailMessage,
    canUndoHistoryDelete: Boolean(lastHistoryDeleteOperationId),
    isLoading,
    error,
    setPage,
    openMemoDetail,
    updateDraft,
    updateAiSettingsDraft,
    loadRecentDraft,
    addDraftTodo,
    removeDraftTodo,
    analyzeDraft,
    publishDraft,
    toggleTodo,
    moveMemo,
    updateActiveMemo,
    addActiveMemoTodo,
    updateActiveMemoTodo,
    deleteActiveMemoTodo,
    archiveActiveMemo,
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
  if (page === "memoDetail") return "Memo Detail";
  if (page === "settings") return "Settings";
  if (page === "history") return "History";
  return "Memos";
}
