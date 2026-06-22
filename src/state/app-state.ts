import { useEffect, useMemo, useState } from "react";
import { ApiClient, apiClient } from "../api/client";
import type { DraftTodoInput, Memo, PublishMemoInput } from "../types";

export type Page = "capture" | "memos" | "settings" | "history";
export type PrimaryPage = "capture" | "memos" | "settings";

export interface DraftState {
  title: string;
  content: string;
  todos: DraftTodoInput[];
}

export interface AppState {
  page: Page;
  activePrimary: PrimaryPage;
  title: string;
  memos: Memo[];
  historyMemos: Memo[];
  draft: DraftState;
  isLoading: boolean;
  error: string | null;
  setPage: (page: Page) => void;
  updateDraft: (patch: Partial<DraftState>) => void;
  addDraftTodo: (title: string) => void;
  removeDraftTodo: (index: number) => void;
  publishDraft: () => Promise<void>;
  toggleTodo: (todoId: string) => Promise<void>;
  restoreMemo: (memoId: string) => Promise<void>;
  refreshMemos: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const emptyDraft: DraftState = {
  title: "",
  content: "",
  todos: []
};

export function useMemoTaskState(client: ApiClient = apiClient): AppState {
  const [page, setPageState] = useState<Page>("memos");
  const [memos, setMemos] = useState<Memo[]>([]);
  const [historyMemos, setHistoryMemos] = useState<Memo[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
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
    await run(async () => {
      setHistoryMemos(await client.listHistory());
    });
  }

  function setPage(page: Page) {
    setPageState(page);
    if (page === "history") {
      void refreshHistory();
    }
  }

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
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

  return {
    page,
    activePrimary,
    title,
    memos,
    historyMemos,
    draft,
    isLoading,
    error,
    setPage,
    updateDraft,
    addDraftTodo,
    removeDraftTodo,
    publishDraft,
    toggleTodo,
    restoreMemo,
    refreshMemos,
    refreshHistory
  };
}

function pageTitle(page: Page): string {
  if (page === "capture") return "Capture";
  if (page === "settings") return "Settings";
  if (page === "history") return "History";
  return "Memos";
}
