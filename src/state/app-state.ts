import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, ApiRequestError, apiClient } from "../api/client";
import { createAndroidBackButtonHandler } from "../native/android-back-button";
import { createNativeBridge, type ExternalCapturePayload } from "../native/native-bridge";
import { DEFAULT_PROMPT } from "../shared/ai-defaults";
import type { AiSettingsView, AuthUserView, DraftTodoInput, Memo, PublishMemoInput, SyncStatusView } from "../types";

export type Page = "capture" | "memos" | "memoDetail" | "settings" | "history";
export type PrimaryPage = "capture" | "memos" | "settings";
export type AuthMode = "checking" | "login" | "register" | "forgot" | "reset" | "unverified" | "authenticated";

interface RouteState {
  page: Page;
  memoId: string | null;
}

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

export interface LocalCaptureDraft {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface AppState {
  authMode: AuthMode;
  authUser: AuthUserView | null;
  authEmail: string;
  authMessage: string | null;
  canOpenTestVerificationLink: boolean;
  canOpenTestResetLink: boolean;
  page: Page;
  activePrimary: PrimaryPage;
  title: string;
  memos: Memo[];
  activeMemo: Memo | null;
  historyMemos: Memo[];
  historyQuery: string;
  recentDrafts: Memo[];
  localDrafts: LocalCaptureDraft[];
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  openTestVerificationLink: () => void;
  openTestResetLink: () => void;
  setAuthMode: (mode: AuthMode) => void;
  setPage: (page: Page) => void;
  openMemoDetail: (memoId: string) => void;
  updateDraft: (patch: Partial<DraftState>) => void;
  updateAiSettingsDraft: (patch: Partial<AiSettingsDraft>) => void;
  loadRecentDraft: (draftId: string) => void;
  loadLocalDraft: (draftId: string) => void;
  addDraftTodo: (title: string) => void;
  removeDraftTodo: (index: number) => void;
  moveDraftTodo: (index: number, direction: "up" | "down") => void;
  analyzeDraft: () => Promise<void>;
  publishDraft: () => Promise<void>;
  toggleTodo: (todoId: string) => Promise<void>;
  moveMemo: (memoId: string, direction: "up" | "down") => Promise<void>;
  reorderMemoList: (memoIds: string[]) => Promise<void>;
  updateActiveMemo: (input: { title: string; content: string }) => Promise<void>;
  addActiveMemoTodo: (title: string) => Promise<void>;
  updateActiveMemoTodo: (todoId: string, title: string) => Promise<void>;
  deleteActiveMemoTodo: (todoId: string) => Promise<void>;
  reorderActiveMemoTodos: (todoIds: string[]) => Promise<void>;
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
  model: "",
  apiKey: "",
  promptTemplate: DEFAULT_PROMPT
};

const localCaptureDraftsKey = "memotask.localCaptureDrafts";

export function useMemoTaskState(client: ApiClient = apiClient): AppState {
  const initialRoute = routeFromPath();
  const [page, setPageState] = useState<Page>(initialRoute.page);
  const [routeMemoId, setRouteMemoId] = useState<string | null>(initialRoute.memoId);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [historyMemos, setHistoryMemos] = useState<Memo[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [recentDrafts, setRecentDrafts] = useState<Memo[]>([]);
  const [localDrafts, setLocalDrafts] = useState<LocalCaptureDraft[]>(() => readLocalCaptureDrafts());
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
  const [authMode, setAuthModeState] = useState<AuthMode>(() => authModeFromPath(window.location.pathname) ?? "checking");
  const [authUser, setAuthUser] = useState<AuthUserView | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resetToken, setResetToken] = useState(new URLSearchParams(window.location.search).get("token") ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nativeBridge = useMemo(() => createNativeBridge(), []);
  const pendingExternalCaptureRef = useRef<ExternalCapturePayload | null>(null);
  const authModeRef = useRef<AuthMode>(authMode);
  const historyRequestIdRef = useRef(0);
  const activePrimary = page === "history" || page === "memoDetail" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);
  authModeRef.current = authMode;

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/login");
    }
    void checkAuth();
  }, []);

  useEffect(() => {
    function handlePopState() {
      const authMode = authModeFromPath(window.location.pathname);
      if (authMode) {
        setAuthModeState(authMode);
        return;
      }
      const nextRoute = routeFromPath();
      applyRoute(nextRoute, false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [memos]);

  useEffect(() => {
    if (authMode !== "authenticated") {
      return;
    }
    if (page === "capture") {
      void refreshDrafts();
    }
    if (page === "history") {
      void refreshHistory();
    }
    if (page === "settings") {
      void refreshSettings();
    }
  }, [page, authMode]);

  useEffect(() => {
    if (authMode === "authenticated" && page === "memoDetail" && routeMemoId) {
      void loadMemoDetail(routeMemoId);
    }
  }, [page, routeMemoId, authMode]);

  useEffect(() => {
    if (authMode !== "authenticated") {
      return;
    }

    function refreshActivePage() {
      if (document.visibilityState === "hidden") {
        return;
      }
      void refreshPageData(page, routeMemoId);
    }

    window.addEventListener("focus", refreshActivePage);
    document.addEventListener("visibilitychange", refreshActivePage);
    return () => {
      window.removeEventListener("focus", refreshActivePage);
      document.removeEventListener("visibilitychange", refreshActivePage);
    };
  }, [authMode, historyQuery, page, routeMemoId]);

  useEffect(() => {
    if (authMode !== "authenticated" || page !== "capture" || !draft.content.trim()) {
      return;
    }

    setCaptureMessage((current) => (current === "已接收外部分享" || current === "已打开快速记录" ? current : "草稿保存中"));
    const timeout = window.setTimeout(() => {
      void saveCurrentDraft();
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [authMode, page, draft.title, draft.content]);

  useEffect(() => {
    return nativeBridge.onExternalCapture((payload) => {
      if (authModeRef.current !== "authenticated") {
        pendingExternalCaptureRef.current = payload;
        return;
      }

      loadExternalCapture(payload);
    });
  }, [nativeBridge]);

  useEffect(() => {
    if (authMode !== "authenticated" || !pendingExternalCaptureRef.current) {
      return;
    }

    const payload = pendingExternalCaptureRef.current;
    pendingExternalCaptureRef.current = null;
    loadExternalCapture(payload);
  }, [authMode]);

  useEffect(() => {
    if (authMode !== "authenticated" || nativeBridge.platform !== "android") {
      return;
    }

    const handleBackButton = createAndroidBackButtonHandler({
      getPage: () => page,
      navigateTo: setPage,
      goBack: () => window.history.back()
    });
    document.addEventListener("backbutton", handleBackButton);
    return () => document.removeEventListener("backbutton", handleBackButton);
  }, [authMode, nativeBridge, page]);

  async function checkAuth() {
    await run(async () => {
      const user = await client.getCurrentUser();
      setAuthUser(user);
      if (!user) {
        setAuthMode(authModeFromPath(window.location.pathname) ?? "login");
        return;
      }
      setAuthEmail(user.email);
      if (!user.emailVerified) {
        setAuthMode("unverified");
        return;
      }
      setAuthModeState("authenticated");
      if (isAuthPath(window.location.pathname)) {
        applyRoute({ page: "memos", memoId: null }, true);
      }
      await refreshMemos();
    });
  }

  async function login(email: string, password: string) {
    await run(async () => {
      const user = await client.login({ email, password });
      setAuthUser(user);
      setAuthEmail(user.email);
      setAuthMessage(null);
      setAuthModeState(user.emailVerified ? "authenticated" : "unverified");
      if (user.emailVerified) {
        applyRoute({ page: "memos", memoId: null }, true);
        await refreshMemos();
      }
    });
  }

  async function register(email: string, password: string) {
    await run(async () => {
      const user = await client.register({ email, password });
      setAuthUser(user);
      setAuthEmail(user.email);
      setAuthMessage("验证码已发送，请查看邮箱");
      setVerificationCode(readTestToken("getLatestVerificationCode"));
      setAuthMode("unverified");
    });
  }

  async function logout() {
    await run(async () => {
      await client.logout();
      setAuthUser(null);
      setAuthEmail("");
      setVerificationCode("");
      setResetToken("");
      setMemos([]);
      setActiveMemo(null);
      setAuthMessage(null);
      setAuthMode("login");
    });
  }

  async function forgotPassword(email: string) {
    await run(async () => {
      await client.forgotPassword(email);
      setAuthEmail(email);
      setAuthMessage("如果邮箱存在，重置链接已经发送");
      setResetToken(readTestToken("getLatestResetToken"));
    });
  }

  async function resetPassword(password: string) {
    await run(async () => {
      const user = await client.resetPassword({ token: resetToken, password });
      setAuthUser(user);
      setAuthEmail(user.email);
      setAuthMessage(null);
      setAuthModeState("authenticated");
      applyRoute({ page: "memos", memoId: null }, true);
      await refreshMemos();
    });
  }

  async function resendVerification() {
    await run(async () => {
      await client.resendVerification(authEmail);
      setVerificationCode(readTestToken("getLatestVerificationCode"));
      setAuthMessage("验证码已重新发送");
    });
  }

  async function verifyEmail(code: string) {
    await run(async () => {
      const user = await client.verifyEmail(code);
      setAuthUser(null);
      setAuthEmail(user.email);
      setVerificationCode("");
      setAuthMode("login");
      setAuthMessage("邮箱验证成功，请登录");
    });
  }

  function openTestVerificationLink() {
    if (!verificationCode) {
      return;
    }
    window.dispatchEvent(new CustomEvent("memotask:test-verification-code", { detail: verificationCode }));
  }

  function openTestResetLink() {
    if (!resetToken) {
      return;
    }
    window.history.pushState({}, "", `/reset-password?token=${encodeURIComponent(resetToken)}`);
    setAuthModeState("reset");
  }

  function setAuthMode(mode: AuthMode) {
    setAuthMessage(null);
    setError(null);
    setAuthModeState(mode);
    const authPath = pathForAuthMode(mode);
    if (authPath && window.location.pathname !== authPath) {
      window.history.pushState({}, "", authPath);
    }
  }

  function readTestToken(methodName: "getLatestVerificationCode" | "getLatestResetToken"): string {
    const candidate = client as ApiClient & Partial<Record<typeof methodName, () => string>>;
    return candidate[methodName]?.() ?? "";
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "AUTH_REQUIRED") {
        resetAuthenticatedState();
        setAuthMode("login");
        setError(caught.message);
        return;
      }
      if (caught instanceof ApiRequestError && caught.code === "EMAIL_NOT_VERIFIED") {
        resetAuthenticatedState();
        setAuthMode("unverified");
        setError(caught.message);
        return;
      }
      setError(caught instanceof Error ? caught.message : "请求失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  function resetAuthenticatedState() {
    setAuthUser(null);
    setMemos([]);
    setActiveMemo(null);
    setHistoryMemos([]);
    setRecentDrafts([]);
    setDraft(emptyDraft);
    setCurrentDraftId(null);
    setSyncStatus(null);
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
    applyRoute({ page, memoId: null }, true);
  }

  function applyRoute(route: RouteState, updateUrl: boolean) {
    setPageState(route.page);
    setRouteMemoId(route.memoId);
    if (route.page !== "memoDetail") {
      setActiveMemo(null);
    }

    if (updateUrl) {
      const path = pathForRoute(route);
      if (window.location.pathname !== path) {
        window.history.pushState({}, "", path);
      }
    }
  }

  function openMemoDetail(memoId: string) {
    const selectedMemo = memos.find((memo) => memo.id === memoId);
    if (!selectedMemo) {
      return;
    }

    setActiveMemo(selectedMemo);
    setDetailMessage(null);
    applyRoute({ page: "memoDetail", memoId }, true);
  }

  async function loadMemoDetail(memoId: string) {
    await run(async () => {
      setActiveMemo(await client.getMemo(memoId));
      setDetailMessage(null);
    });
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

  function loadLocalDraft(draftId: string) {
    const selected = localDrafts.find((candidate) => candidate.id === draftId);
    if (!selected) {
      return;
    }

    setCurrentDraftId(null);
    setDraft({
      title: selected.title === "未命名 Memo" ? "" : selected.title,
      content: selected.content,
      todos: []
    });
    setCaptureMessage("已载入本地草稿");
    applyRoute({ page: "capture", memoId: null }, true);
  }

  function loadExternalCapture(payload: ExternalCapturePayload) {
    setCurrentDraftId(null);
    setDraft({
      title: payload.title,
      content: payload.content,
      todos: []
    });
    setCaptureMessage(payload.source === "android-share" ? "已接收外部分享" : "已打开快速记录");
    applyRoute({ page: "capture", memoId: null }, true);
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

  function moveDraftTodo(index: number, direction: "up" | "down") {
    setDraft((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.todos.length) {
        return current;
      }

      const todos = [...current.todos];
      [todos[index], todos[targetIndex]] = [todos[targetIndex], todos[index]];
      return { ...current, todos };
    });
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
      const draftInput = {
        title: draft.title.trim() || undefined,
        content: draft.content
      };
      const savedDraft = currentDraftId ? await client.updateDraft(currentDraftId, draftInput) : await client.createDraft(draftInput);
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
      draftId: currentDraftId ?? undefined,
      title: draft.title.trim() || "未命名 Memo",
      content: draft.content,
      todos: draft.todos
    };

    setCaptureMessage("发布中");
    await run(async () => {
      try {
        await client.publishMemo(input);
      } catch (caught) {
        const nextLocalDrafts = saveLocalCaptureDraft(input);
        setLocalDrafts(nextLocalDrafts);
        setCaptureMessage("发布失败，已保存在本地草稿");
        nativeBridge.notifyCaptureFailed("内容已保存在本地草稿，可稍后重试");
        throw caught;
      }
      setDraft(emptyDraft);
      setCurrentDraftId(null);
      setCaptureMessage(null);
      setRecentDrafts(await client.listRecentDrafts());
      applyRoute({ page: "memos", memoId: null }, true);
      setMemos(await client.listMemos());
      nativeBridge.notifyCaptureSaved("Memo 已发布到队列");
    });
  }

  async function toggleTodo(todoId: string) {
    const previousMemos = memos;
    const previousActiveMemo = activeMemo;
    const optimisticMemos = toggleTodoInMemos(memos, todoId);
    const optimisticActiveMemo = activeMemo ? toggleTodoInMemo(activeMemo, todoId)?.memo ?? activeMemo : activeMemo;

    if (optimisticMemos !== memos) {
      setMemos(optimisticMemos);
    }
    if (optimisticActiveMemo !== activeMemo) {
      setActiveMemo(optimisticActiveMemo);
    }

    await run(async () => {
      try {
        await client.toggleTodo(todoId);
        const nextMemos = await client.listMemos();
        setMemos(nextMemos);
        setActiveMemo((current) => nextMemos.find((memo) => memo.id === current?.id) ?? current);
      } catch (caught) {
        setMemos(previousMemos);
        setActiveMemo(previousActiveMemo);
        throw caught;
      }
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

  async function reorderMemoList(memoIds: string[]) {
    const nextMemos = memoIds.map((memoId) => memos.find((memo) => memo.id === memoId)).filter((memo): memo is Memo => Boolean(memo));
    if (nextMemos.length !== memos.length) {
      return;
    }

    await run(async () => {
      setMemos(nextMemos);
      setMemos(await client.reorderMemos(memoIds));
    });
  }

  async function updateActiveMemo(input: { title: string; content: string }) {
    if (!activeMemo) {
      return;
    }

    setDetailMessage("Memo 保存中");
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

    const previousMemos = memos;
    const previousActiveMemo = activeMemo;
    const optimisticTodo: Memo["todos"][number] = {
      id: `optimistic-todo-${Date.now()}`,
      memoId: activeMemo.id,
      title: trimmed,
      notes: null,
      status: "todo",
      sortOrder: activeMemo.todos.length + 1,
      generatedByAi: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      deletedAt: null
    };
    const optimisticMemo = { ...activeMemo, todos: [...activeMemo.todos, optimisticTodo], autoArchiveSuppressedUntilChange: false };

    setActiveMemo(optimisticMemo);
    setMemos(replaceMemo(memos, optimisticMemo));

    await run(async () => {
      try {
        await client.createTodo(activeMemo.id, { title: trimmed, notes: null, generatedByAi: false });
        const nextMemos = await client.listMemos();
        setMemos(nextMemos);
        setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? optimisticMemo);
      } catch (caught) {
        setMemos(previousMemos);
        setActiveMemo(previousActiveMemo);
        throw caught;
      }
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

    const previousMemos = memos;
    const previousActiveMemo = activeMemo;
    const optimisticMemo = { ...activeMemo, todos: activeMemo.todos.filter((todo) => todo.id !== todoId), autoArchiveSuppressedUntilChange: false };

    setActiveMemo(optimisticMemo);
    setMemos(replaceMemo(memos, optimisticMemo));

    await run(async () => {
      try {
        await client.deleteTodo(todoId);
        const nextMemos = await client.listMemos();
        setMemos(nextMemos);
        setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? optimisticMemo);
      } catch (caught) {
        setMemos(previousMemos);
        setActiveMemo(previousActiveMemo);
        throw caught;
      }
    });
  }

  async function reorderActiveMemoTodos(todoIds: string[]) {
    if (!activeMemo) {
      return;
    }

    const orderedTodos = todoIds
      .map((todoId) => activeMemo.todos.find((todo) => todo.id === todoId))
      .filter((todo): todo is Memo["todos"][number] => Boolean(todo));
    if (orderedTodos.length !== activeMemo.todos.length) {
      return;
    }

    await run(async () => {
      setActiveMemo({ ...activeMemo, todos: orderedTodos });
      await client.reorderTodos(activeMemo.id, todoIds);
      const nextMemos = await client.listMemos();
      setMemos(nextMemos);
      setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? { ...activeMemo, todos: orderedTodos });
    });
  }

  async function archiveActiveMemo() {
    if (!activeMemo) {
      return;
    }

    setDetailMessage("归档中");
    await run(async () => {
      await client.archiveMemo(activeMemo.id);
      setActiveMemo(null);
      setMemos(await client.listMemos());
      applyRoute({ page: "history", memoId: null }, true);
      setHistoryMemos(await client.listHistory());
    });
  }

  async function restoreMemo(memoId: string) {
    setHistoryMessage("恢复中");
    await run(async () => {
      await client.restoreMemo(memoId);
      applyRoute({ page: "memos", memoId: null }, true);
      setMemos(await client.listMemos());
      setHistoryMessage("已恢复 Memo");
    });
  }

  async function loadHistory(query: string) {
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    await run(async () => {
      const nextHistoryMemos = query.trim() ? await client.searchHistory(query) : await client.listHistory();
      if (requestId === historyRequestIdRef.current) {
        setHistoryMemos(nextHistoryMemos);
      }
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

    setHistoryMessage("删除中");
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

    setHistoryMessage("撤销中");
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

  async function refreshPageData(page: Page, memoId: string | null) {
    if (page === "memos") {
      await refreshMemos();
      return;
    }
    if (page === "history") {
      await loadHistory(historyQuery);
      return;
    }
    if (page === "memoDetail" && memoId) {
      await loadMemoDetail(memoId);
      return;
    }
    if (page === "capture") {
      await refreshDrafts();
    }
  }

  async function saveAiSettings() {
    setSettingsMessage("设置保存中");
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
    setSettingsMessage("Prompt 恢复中");
    await run(async () => {
      const nextSettings = await client.resetAiPrompt();
      setAiSettings(nextSettings);
      setAiSettingsDraft((current) => ({ ...current, promptTemplate: nextSettings.promptTemplate }));
      setSettingsMessage("已恢复默认 Prompt");
    });
  }

  async function testAiConnection() {
    setSettingsMessage("连接测试中");
    await run(async () => {
      await client.testAiConnection();
      setSettingsMessage("连接测试通过");
    });
  }

  async function exportJson() {
    setSettingsMessage("JSON 导出中");
    await run(async () => {
      await client.exportJson();
      setSettingsMessage("JSON 导出已生成");
    });
  }

  return {
    authMode,
    authUser,
    authEmail,
    authMessage,
    canOpenTestVerificationLink: Boolean(verificationCode),
    canOpenTestResetLink: Boolean(resetToken),
    page,
    activePrimary,
    title,
    memos,
    activeMemo,
    historyMemos,
    historyQuery,
    recentDrafts,
    localDrafts,
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
    login,
    logout,
    register,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    openTestVerificationLink,
    openTestResetLink,
    setAuthMode,
    setPage,
    openMemoDetail,
    updateDraft,
    updateAiSettingsDraft,
    loadRecentDraft,
    loadLocalDraft,
    addDraftTodo,
    removeDraftTodo,
    moveDraftTodo,
    analyzeDraft,
    publishDraft,
    toggleTodo,
    moveMemo,
    reorderMemoList,
    updateActiveMemo,
    addActiveMemoTodo,
    updateActiveMemoTodo,
    deleteActiveMemoTodo,
    reorderActiveMemoTodos,
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
  if (page === "capture") return "记录";
  if (page === "memoDetail") return "Memo 详情";
  if (page === "settings") return "设置";
  if (page === "history") return "历史";
  return "队列";
}

function routeFromPath(pathname: string = window.location.pathname): RouteState {
  if (pathname === "/capture") return { page: "capture", memoId: null };
  if (pathname === "/settings") return { page: "settings", memoId: null };
  if (pathname === "/history") return { page: "history", memoId: null };

  const memoDetailMatch = pathname.match(/^\/memos\/([^/]+)$/);
  if (memoDetailMatch) {
    return { page: "memoDetail", memoId: decodeURIComponent(memoDetailMatch[1]) };
  }

  return { page: "memos", memoId: null };
}

function authModeFromPath(pathname: string): AuthMode | null {
  if (pathname === "/login") return "login";
  if (pathname === "/signup") return "register";
  if (pathname === "/forgot-password") return "forgot";
  if (pathname === "/reset-password") return "reset";
  if (pathname === "/verify-email") return "unverified";
  return null;
}

function isAuthPath(pathname: string): boolean {
  return authModeFromPath(pathname) !== null;
}

function pathForAuthMode(mode: AuthMode): string | null {
  if (mode === "login") return "/login";
  if (mode === "register") return "/signup";
  if (mode === "forgot") return "/forgot-password";
  if (mode === "reset") return "/reset-password";
  if (mode === "unverified") return "/verify-email";
  return null;
}

function pathForRoute(route: RouteState): string {
  if (route.page === "capture") return "/capture";
  if (route.page === "settings") return "/settings";
  if (route.page === "history") return "/history";
  if (route.page === "memoDetail" && route.memoId) return `/memos/${encodeURIComponent(route.memoId)}`;
  return "/memos";
}

function readLocalCaptureDrafts(): LocalCaptureDraft[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const value = window.localStorage.getItem(localCaptureDraftsKey);
    const parsed = value ? (JSON.parse(value) as LocalCaptureDraft[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((draft) => typeof draft.id === "string" && typeof draft.content === "string")
      : [];
  } catch {
    return [];
  }
}

function saveLocalCaptureDraft(input: PublishMemoInput): LocalCaptureDraft[] {
  const nextDraft: LocalCaptureDraft = {
    id: `local-${Date.now()}`,
    title: input.title || "未命名 Memo",
    content: input.content,
    createdAt: new Date().toISOString()
  };
  const nextDrafts = [nextDraft, ...readLocalCaptureDrafts()].slice(0, 10);
  window.localStorage.setItem(localCaptureDraftsKey, JSON.stringify(nextDrafts));
  return nextDrafts;
}

function toggleTodoInMemos(memos: Memo[], todoId: string): Memo[] {
  let changed = false;
  const nextMemos = memos.flatMap((memo) => {
    const result = toggleTodoInMemo(memo, todoId);
    if (!result) {
      return [memo];
    }

    changed = true;
    return result.shouldArchive ? [] : [result.memo];
  });

  return changed ? nextMemos : memos;
}

function replaceMemo(memos: Memo[], nextMemo: Memo): Memo[] {
  return memos.map((memo) => (memo.id === nextMemo.id ? nextMemo : memo));
}

function toggleTodoInMemo(memo: Memo, todoId: string): { memo: Memo; shouldArchive: boolean } | null {
  let changed = false;
  const todos: Memo["todos"] = memo.todos.map((todo) => {
    if (todo.id !== todoId) {
      return todo;
    }

    changed = true;
    const isDone = todo.status === "done";
    return {
      ...todo,
      status: isDone ? "todo" : "done",
      completedAt: isDone ? null : new Date().toISOString()
    };
  });

  if (!changed) {
    return null;
  }

  const visibleTodos = todos.filter((todo) => todo.deletedAt === null);
  const shouldArchive =
    !memo.autoArchiveSuppressedUntilChange && visibleTodos.length > 0 && visibleTodos.every((todo) => todo.status === "done");

  return {
    memo: {
      ...memo,
      todos,
      autoArchiveSuppressedUntilChange: false,
      updatedAt: new Date().toISOString()
    },
    shouldArchive
  };
}
