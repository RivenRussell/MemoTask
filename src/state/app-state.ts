import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, ApiRequestError, apiClient } from "../api/client";
import { createAndroidBackButtonHandler } from "../native/android-back-button";
import { createNativeBridge, type ExternalCapturePayload } from "../native/native-bridge";
import { DEFAULT_PROMPT } from "../shared/ai-defaults";
import type { AiSettingsView, AuthUserView, DraftTodoInput, Memo, PublishMemoInput, SyncStatusView } from "../types";
import { memoTaskQueryKeys } from "./query-keys";

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
  titleVisible: boolean;
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
  flushDraft: () => Promise<void>;
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
  isRefreshingMemos: boolean;
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
  todos: [],
  titleVisible: false
};

const defaultAiSettingsDraft: AiSettingsDraft = {
  baseUrl: "",
  model: "",
  apiKey: "",
  promptTemplate: DEFAULT_PROMPT
};

const localCaptureDraftsKey = "memotask.localCaptureDrafts";

export function useMemoTaskState(client: ApiClient = apiClient): AppState {
  const queryClient = useQueryClient();
  const initialRoute = routeFromPath();
  const [page, setPageState] = useState<Page>(initialRoute.page);
  const [routeMemoId, setRouteMemoId] = useState<string | null>(initialRoute.memoId);
  const [historyQuery, setHistoryQuery] = useState("");
  const [localDrafts, setLocalDrafts] = useState<LocalCaptureDraft[]>(() => readLocalCaptureDrafts());
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>(defaultAiSettingsDraft);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [lastHistoryDeleteOperationId, setLastHistoryDeleteOperationId] = useState<string | null>(null);
  const [authMode, setAuthModeState] = useState<AuthMode>(() => authModeFromPath(window.location.pathname) ?? "checking");
  const [authUser, setAuthUser] = useState<AuthUserView | null>(null);
  const queryUserId = authUser?.id ?? "__anonymous__";
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resetToken, setResetToken] = useState(new URLSearchParams(window.location.search).get("token") ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingMemos, setIsRefreshingMemos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nativeBridge = useMemo(() => createNativeBridge(), []);
  const pendingExternalCaptureRef = useRef<ExternalCapturePayload | null>(null);
  const authGenerationRef = useRef(0);
  const authUserIdRef = useRef<string | null>(null);
  const authModeRef = useRef<AuthMode>(authMode);
  const draftRef = useRef<DraftState>(draft);
  const currentDraftIdRef = useRef<string | null>(currentDraftId);
  const draftSaveInFlightRef = useRef<{ signature: string; promise: Promise<string | null> } | null>(null);
  const draftSaveRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const aiSettingsDraftDirtyRef = useRef(false);
  const aiSettingsDraftSourceRef = useRef<string | null>(null);
  const isAuthenticated = authMode === "authenticated";
  const memosQuery = useQuery({
    queryKey: memoTaskQueryKeys.memos.list(queryUserId),
    queryFn: () => client.listMemos(),
    enabled: isAuthenticated && Boolean(authUser),
    refetchInterval: isAuthenticated && page === "memos" ? 10_000 : false
  });
  const activeMemoQuery = useQuery({
    queryKey: routeMemoId ? memoTaskQueryKeys.memos.detail(queryUserId, routeMemoId) : memoTaskQueryKeys.memos.detail(queryUserId, "__none__"),
    queryFn: () => client.getMemo(routeMemoId ?? ""),
    enabled: isAuthenticated && Boolean(authUser) && page === "memoDetail" && Boolean(routeMemoId),
    initialData: () =>
      routeMemoId
        ? queryClient.getQueryData<Memo>(memoTaskQueryKeys.memos.detail(queryUserId, routeMemoId)) ??
          queryClient.getQueryData<Memo[]>(memoTaskQueryKeys.memos.list(queryUserId))?.find((memo) => memo.id === routeMemoId)
        : undefined
  });
  const recentDraftsQuery = useQuery({
    queryKey: memoTaskQueryKeys.drafts.recent(queryUserId),
    queryFn: () => client.listRecentDrafts(),
    enabled: isAuthenticated && Boolean(authUser) && page === "capture"
  });
  const historyMemosQuery = useQuery({
    queryKey: memoTaskQueryKeys.history.list(queryUserId, historyQuery),
    queryFn: () => (historyQuery.trim() ? client.searchHistory(historyQuery) : client.listHistory()),
    enabled: isAuthenticated && Boolean(authUser) && page === "history"
  });
  const aiSettingsQuery = useQuery({
    queryKey: memoTaskQueryKeys.settings.ai(queryUserId),
    queryFn: () => client.getAiSettings(),
    enabled: isAuthenticated && Boolean(authUser) && page === "settings"
  });
  const syncStatusQuery = useQuery({
    queryKey: memoTaskQueryKeys.settings.sync(queryUserId),
    queryFn: () => client.getSyncStatus(),
    enabled: isAuthenticated && Boolean(authUser) && page === "settings"
  });
  const memos = memosQuery.data ?? [];
  const activeMemo = page === "memoDetail" && routeMemoId ? (activeMemoQuery.data ?? null) : null;
  const historyMemos = historyMemosQuery.data ?? [];
  const recentDrafts = recentDraftsQuery.data ?? [];
  const aiSettings = aiSettingsQuery.data ?? null;
  const syncStatus = syncStatusQuery.data ?? null;
  const activePrimary = page === "history" || page === "memoDetail" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);
  authModeRef.current = authMode;
  authUserIdRef.current = authUser?.id ?? null;
  draftRef.current = draft;
  currentDraftIdRef.current = currentDraftId;

  function setMemos(next: Memo[] | ((current: Memo[]) => Memo[])): Memo[] {
    const userId = activeQueryUserId();
    const current = queryClient.getQueryData<Memo[]>(memoTaskQueryKeys.memos.list(userId)) ?? memos;
    const nextMemos = typeof next === "function" ? next(current) : next;
    queryClient.setQueryData(memoTaskQueryKeys.memos.list(userId), nextMemos);
    for (const memo of nextMemos) {
      queryClient.setQueryData(memoTaskQueryKeys.memos.detail(userId, memo.id), memo);
    }
    return nextMemos;
  }

  function setActiveMemo(next: Memo | null | ((current: Memo | null) => Memo | null)): void {
    const userId = activeQueryUserId();
    const currentMemoId = activeMemo?.id ?? routeMemoId;
    const currentMemo = currentMemoId ? (queryClient.getQueryData<Memo>(memoTaskQueryKeys.memos.detail(userId, currentMemoId)) ?? activeMemo) : activeMemo;
    const nextMemo = typeof next === "function" ? next(currentMemo) : next;
    if (!nextMemo) {
      return;
    }

    queryClient.setQueryData(memoTaskQueryKeys.memos.detail(userId, nextMemo.id), nextMemo);
  }

  function setHistoryMemos(next: Memo[] | ((current: Memo[]) => Memo[]), query = historyQuery): Memo[] {
    const queryKey = memoTaskQueryKeys.history.list(activeQueryUserId(), query);
    const current = queryClient.getQueryData<Memo[]>(queryKey) ?? historyMemos;
    const nextHistoryMemos = typeof next === "function" ? next(current) : next;
    queryClient.setQueryData(queryKey, nextHistoryMemos);
    return nextHistoryMemos;
  }

  function setRecentDrafts(next: Memo[] | ((current: Memo[]) => Memo[])): Memo[] {
    const userId = activeQueryUserId();
    const current = queryClient.getQueryData<Memo[]>(memoTaskQueryKeys.drafts.recent(userId)) ?? recentDrafts;
    const nextDrafts = typeof next === "function" ? next(current) : next;
    queryClient.setQueryData(memoTaskQueryKeys.drafts.recent(userId), nextDrafts);
    return nextDrafts;
  }

  function setAiSettings(next: AiSettingsView): void {
    queryClient.setQueryData(memoTaskQueryKeys.settings.ai(activeQueryUserId()), next);
  }

  function setSyncStatus(next: SyncStatusView | null): void {
    queryClient.setQueryData(memoTaskQueryKeys.settings.sync(activeQueryUserId()), next);
  }

  function invalidateMemoQueries(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: memoTaskQueryKeys.memos.all(activeQueryUserId()) });
  }

  function invalidateHistoryQueries(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: memoTaskQueryKeys.history.all(activeQueryUserId()) });
  }

  function invalidateDraftQueries(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: memoTaskQueryKeys.drafts.all(activeQueryUserId()) });
  }

  function invalidateSettingsQueries(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: memoTaskQueryKeys.settings.all(activeQueryUserId()) });
  }

  function activeQueryUserId(): string {
    return authUserIdRef.current ?? authUser?.id ?? queryUserId;
  }

  function advanceAuthGeneration(user: AuthUserView | null) {
    authGenerationRef.current += 1;
    authUserIdRef.current = user?.id ?? null;
    setAuthUser(user);
  }

  function activateAuthenticatedUser(user: AuthUserView): { generation: number; userId: string } {
    advanceAuthGeneration(user);
    return { generation: authGenerationRef.current, userId: user.id };
  }

  function captureAuthSnapshot(): { generation: number; userId: string | null } {
    return { generation: authGenerationRef.current, userId: authUserIdRef.current };
  }

  function isCurrentAuthSnapshot(snapshot: { generation: number; userId: string | null }): boolean {
    return (
      authModeRef.current === "authenticated" &&
      snapshot.userId !== null &&
      authGenerationRef.current === snapshot.generation &&
      authUserIdRef.current === snapshot.userId
    );
  }

  async function clearAuthenticatedQueries() {
    await queryClient.cancelQueries({ queryKey: ["users"] });
    queryClient.removeQueries({ queryKey: ["users"] });
  }

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

  useEffect(() => {
    if (!aiSettings || aiSettingsDraftDirtyRef.current) {
      return;
    }

    aiSettingsDraftSourceRef.current = aiSettingsSignature(aiSettings);
    setAiSettingsDraft({
      baseUrl: aiSettings.baseUrl,
      model: aiSettings.model,
      apiKey: "",
      promptTemplate: aiSettings.promptTemplate
    });
  }, [aiSettings]);

  useEffect(() => {
    const queryError =
      memosQuery.error ??
      activeMemoQuery.error ??
      recentDraftsQuery.error ??
      historyMemosQuery.error ??
      aiSettingsQuery.error ??
      syncStatusQuery.error;
    if (!queryError) {
      return;
    }

    handleRequestError(queryError);
  }, [
    activeMemoQuery.error,
    aiSettingsQuery.error,
    historyMemosQuery.error,
    memosQuery.error,
    recentDraftsQuery.error,
    syncStatusQuery.error
  ]);

  async function checkAuth() {
    await run(async () => {
      const user = await client.getCurrentUser();
      queryClient.setQueryData(memoTaskQueryKeys.auth.me, user);
      if (!user) {
        advanceAuthGeneration(null);
        setAuthMode(authModeFromPath(window.location.pathname) ?? "login");
        return;
      }
      const authSnapshot = activateAuthenticatedUser(user);
      setAuthEmail(user.email);
      if (!user.emailVerified) {
        setAuthMode("unverified");
        return;
      }
      setAuthModeState("authenticated");
      if (isAuthPath(window.location.pathname)) {
        applyRoute({ page: "memos", memoId: null }, true);
      }
      void refreshMemos(authSnapshot);
    });
  }

  async function login(email: string, password: string) {
    await run(async () => {
      const user = await client.login({ email, password });
      queryClient.setQueryData(memoTaskQueryKeys.auth.me, user);
      const authSnapshot = activateAuthenticatedUser(user);
      setAuthEmail(user.email);
      setAuthMessage(null);
      setAuthModeState(user.emailVerified ? "authenticated" : "unverified");
      if (user.emailVerified) {
        applyRoute({ page: "memos", memoId: null }, true);
        void refreshMemos(authSnapshot);
      }
    });
  }

  async function register(email: string, password: string) {
    await run(async () => {
      const user = await client.register({ email, password });
      queryClient.setQueryData(memoTaskQueryKeys.auth.me, user);
      activateAuthenticatedUser(user);
      setAuthEmail(user.email);
      setAuthMessage("验证码已发送，请查看邮箱");
      setVerificationCode(readTestToken("getLatestVerificationCode"));
      setAuthMode("unverified");
    });
  }

  async function logout() {
    await run(async () => {
      await client.logout();
      await clearAuthenticatedQueries();
      advanceAuthGeneration(null);
      setAuthEmail("");
      setVerificationCode("");
      setResetToken("");
      setActiveMemo(null);
      queryClient.clear();
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
      queryClient.setQueryData(memoTaskQueryKeys.auth.me, user);
      const authSnapshot = activateAuthenticatedUser(user);
      setAuthEmail(user.email);
      setAuthMessage(null);
      setAuthModeState("authenticated");
      applyRoute({ page: "memos", memoId: null }, true);
      void refreshMemos(authSnapshot);
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
      advanceAuthGeneration(null);
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
      handleRequestError(caught);
    } finally {
      setIsLoading(false);
    }
  }

  function handleRequestError(caught: unknown) {
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
  }

  function resetAuthenticatedState() {
    void clearAuthenticatedQueries();
    advanceAuthGeneration(null);
    setActiveMemo(null);
    setHistoryMemos([]);
    setRecentDrafts([]);
    setDraft(emptyDraft);
    setCurrentDraftId(null);
    setSyncStatus(null);
  }

  async function refreshMemos(authSnapshot = captureAuthSnapshot()) {
    setIsRefreshingMemos(true);
    await run(async () => {
      try {
        const nextMemos = await client.listMemos();
        if (isCurrentAuthSnapshot(authSnapshot)) {
          setMemos(nextMemos);
        }
      } finally {
        setIsRefreshingMemos(false);
      }
    });
  }

  async function refreshHistory() {
    setHistoryQuery("");
    await loadHistory("");
  }

  function setPage(page: Page) {
    if (page !== "capture") {
      void flushDraft();
    }
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
    const authSnapshot = captureAuthSnapshot();
    await run(async () => {
      const memo = await client.getMemo(memoId);
      if (isCurrentAuthSnapshot(authSnapshot)) {
        setActiveMemo(memo);
        setDetailMessage(null);
      }
    });
  }

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateAiSettingsDraft(patch: Partial<AiSettingsDraft>) {
    aiSettingsDraftDirtyRef.current = true;
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
      todos: [],
      titleVisible: hasExplicitTitle(selected.title)
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
      todos: [],
      titleVisible: hasExplicitTitle(selected.title)
    });
    setCaptureMessage("已载入本地草稿");
    applyRoute({ page: "capture", memoId: null }, true);
  }

  function loadExternalCapture(payload: ExternalCapturePayload) {
    setCurrentDraftId(null);
    setDraft({
      title: payload.title,
      content: payload.content,
      todos: [],
      titleVisible: Boolean(payload.title.trim())
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
    const authSnapshot = captureAuthSnapshot();
    await run(async () => {
      const drafts = await client.listRecentDrafts();
      if (isCurrentAuthSnapshot(authSnapshot)) {
        setRecentDrafts(drafts);
      }
    });
  }

  async function flushDraft() {
    const snapshot = draftRef.current;
    if (authModeRef.current !== "authenticated" || !snapshot.content.trim()) {
      return;
    }

    await saveCurrentDraft(snapshot, currentDraftIdRef.current);
  }

  async function saveCurrentDraft(snapshot: DraftState = draftRef.current, draftId: string | null = currentDraftIdRef.current): Promise<string | null> {
    if (!snapshot.content.trim()) {
      return draftId;
    }

    const signature = JSON.stringify({
      draftId,
      title: snapshot.title.trim(),
      content: snapshot.content
    });
    if (draftSaveInFlightRef.current?.signature === signature) {
      return draftSaveInFlightRef.current.promise;
    }

    const savePromise = saveDraftSnapshot(snapshot, draftId);
    draftSaveInFlightRef.current = { signature, promise: savePromise };
    try {
      return await savePromise;
    } finally {
      if (draftSaveInFlightRef.current?.promise === savePromise) {
        draftSaveInFlightRef.current = null;
      }
    }
  }

  async function saveDraftSnapshot(snapshot: DraftState, draftId: string | null): Promise<string | null> {
    const requestId = draftSaveRequestIdRef.current + 1;
    const authSnapshot = captureAuthSnapshot();
    draftSaveRequestIdRef.current = requestId;
    let savedDraftId: string | null = null;
    await run(async () => {
      const draftInput = {
        title: snapshot.title.trim() || undefined,
        content: snapshot.content
      };
      const savedDraft = draftId ? await client.updateDraft(draftId, draftInput) : await client.createDraft(draftInput);
      savedDraftId = savedDraft.id;
      if (requestId !== draftSaveRequestIdRef.current || !isCurrentAuthSnapshot(authSnapshot)) {
        return;
      }
      currentDraftIdRef.current = savedDraft.id;
      setCurrentDraftId(savedDraft.id);
      const drafts = await client.listRecentDrafts();
      if (requestId !== draftSaveRequestIdRef.current || !isCurrentAuthSnapshot(authSnapshot)) {
        return;
      }
      setRecentDrafts(drafts);
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
        titleVisible: true,
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
      title: draft.title.trim() || deriveMemoTitle(draft.content),
      content: draft.content,
      todos: draft.todos
    };
    draftSaveRequestIdRef.current += 1;

    setCaptureMessage("发布中");
    await run(async () => {
      try {
        const published = await client.publishMemo(input);
        setMemos((current) => [published, ...current.filter((memo) => memo.id !== published.id)]);
      } catch (caught) {
        const nextLocalDrafts = saveLocalCaptureDraft(input);
        setLocalDrafts(nextLocalDrafts);
        setCaptureMessage("发布失败，已保存在本地草稿");
        nativeBridge.notifyCaptureFailed("内容已保存在本地草稿，可稍后重试");
        throw caught;
      }
      setDraft(emptyDraft);
      setCurrentDraftId(null);
      currentDraftIdRef.current = null;
      setCaptureMessage(null);
      const drafts = await client.listRecentDrafts();
      setRecentDrafts(drafts);
      applyRoute({ page: "memos", memoId: null }, true);
      void invalidateHistoryQueries();
      void invalidateDraftQueries();
      void refreshMemos();
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
        void invalidateHistoryQueries();
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

    const previousMemos = memos;
    const nextMemos = [...memos];
    [nextMemos[currentIndex], nextMemos[targetIndex]] = [nextMemos[targetIndex], nextMemos[currentIndex]];

    await run(async () => {
      try {
        setMemos(nextMemos);
        const orderedMemos = await client.reorderMemos(nextMemos.map((memo) => memo.id));
        setMemos(orderedMemos);
      } catch (caught) {
        setMemos(previousMemos);
        throw caught;
      }
    });
  }

  async function reorderMemoList(memoIds: string[]) {
    const nextMemos = memoIds.map((memoId) => memos.find((memo) => memo.id === memoId)).filter((memo): memo is Memo => Boolean(memo));
    if (nextMemos.length !== memos.length) {
      return;
    }

    const previousMemos = memos;
    await run(async () => {
      try {
        setMemos(nextMemos);
        const orderedMemos = await client.reorderMemos(memoIds);
        setMemos(orderedMemos);
      } catch (caught) {
        setMemos(previousMemos);
        throw caught;
      }
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
      setMemos(replaceMemo(memos, updated));
      void invalidateMemoQueries();
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
        const createdTodo = await client.createTodo(activeMemo.id, { title: trimmed, notes: null, generatedByAi: false });
        const memoWithCreatedTodo = {
          ...optimisticMemo,
          todos: optimisticMemo.todos.map((todo) => (todo.id === optimisticTodo.id ? createdTodo : todo))
        };
        setActiveMemo(memoWithCreatedTodo);
        setMemos(replaceMemo(memos, memoWithCreatedTodo));
        const nextMemos = await client.listMemos();
        setMemos(nextMemos);
        setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? memoWithCreatedTodo);
        void invalidateHistoryQueries();
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
      void invalidateHistoryQueries();
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
        void invalidateHistoryQueries();
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

    const previousMemos = memos;
    const previousActiveMemo = activeMemo;
    const orderedTodos = todoIds
      .map((todoId) => activeMemo.todos.find((todo) => todo.id === todoId))
      .filter((todo): todo is Memo["todos"][number] => Boolean(todo));
    if (orderedTodos.length !== activeMemo.todos.length) {
      return;
    }

    await run(async () => {
      try {
        setActiveMemo({ ...activeMemo, todos: orderedTodos });
        await client.reorderTodos(activeMemo.id, todoIds);
        const nextMemos = await client.listMemos();
        setMemos(nextMemos);
        setActiveMemo(nextMemos.find((memo) => memo.id === activeMemo.id) ?? { ...activeMemo, todos: orderedTodos });
        void invalidateHistoryQueries();
      } catch (caught) {
        setMemos(previousMemos);
        setActiveMemo(previousActiveMemo);
        throw caught;
      }
    });
  }

  async function archiveActiveMemo() {
    if (!activeMemo) {
      return;
    }

    setDetailMessage("归档中");
    await run(async () => {
      const archived = await client.archiveMemo(activeMemo.id);
      setActiveMemo(null);
      setMemos((current) => current.filter((memo) => memo.id !== archived.id));
      applyRoute({ page: "history", memoId: null }, true);
      const nextHistory = await client.listHistory();
      setHistoryMemos(nextHistory, "");
      await Promise.all([invalidateMemoQueries(), invalidateHistoryQueries()]);
    });
  }

  async function restoreMemo(memoId: string) {
    setHistoryMessage("恢复中");
    await run(async () => {
      const restored = await client.restoreMemo(memoId);
      applyRoute({ page: "memos", memoId: null }, true);
      setMemos((current) => [restored, ...current.filter((memo) => memo.id !== restored.id)]);
      await Promise.all([invalidateMemoQueries(), invalidateHistoryQueries()]);
      setHistoryMessage("已恢复 Memo");
    });
  }

  async function loadHistory(query: string) {
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    const authSnapshot = captureAuthSnapshot();
    await run(async () => {
      const nextHistoryMemos = query.trim() ? await client.searchHistory(query) : await client.listHistory();
      if (requestId === historyRequestIdRef.current && isCurrentAuthSnapshot(authSnapshot)) {
        setHistoryMemos(nextHistoryMemos, query);
      }
    });
  }

  async function searchHistory(query: string) {
    setHistoryQuery(query);
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
      await Promise.all([invalidateHistoryQueries(), invalidateMemoQueries()]);
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
      await Promise.all([invalidateHistoryQueries(), invalidateMemoQueries()]);
    });
  }

  async function refreshSettings() {
    const authSnapshot = captureAuthSnapshot();
    await run(async () => {
      const [settings, status] = await Promise.all([client.getAiSettings(), client.getSyncStatus()]);
      if (!isCurrentAuthSnapshot(authSnapshot)) {
        return;
      }
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
      aiSettingsDraftDirtyRef.current = false;
      aiSettingsDraftSourceRef.current = aiSettingsSignature(nextSettings);
      setAiSettingsDraft({
        baseUrl: nextSettings.baseUrl,
        model: nextSettings.model,
        apiKey: "",
        promptTemplate: nextSettings.promptTemplate
      });
      setSettingsMessage("已保存 AI 设置");
      void invalidateSettingsQueries();
    });
  }

  async function resetAiPrompt() {
    setSettingsMessage("Prompt 恢复中");
    await run(async () => {
      const nextSettings = await client.resetAiPrompt();
      setAiSettings(nextSettings);
      aiSettingsDraftDirtyRef.current = false;
      aiSettingsDraftSourceRef.current = aiSettingsSignature(nextSettings);
      setAiSettingsDraft((current) => ({ ...current, promptTemplate: nextSettings.promptTemplate }));
      setSettingsMessage("已恢复默认 Prompt");
      void invalidateSettingsQueries();
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
    flushDraft,
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
    isRefreshingMemos,
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
    title: input.title || deriveMemoTitle(input.content),
    content: input.content,
    createdAt: new Date().toISOString()
  };
  const nextDrafts = [nextDraft, ...readLocalCaptureDrafts()].slice(0, 10);
  window.localStorage.setItem(localCaptureDraftsKey, JSON.stringify(nextDrafts));
  return nextDrafts;
}

export function deriveMemoTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "未命名 Memo";
  }

  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

function hasExplicitTitle(title: string): boolean {
  return title.trim().length > 0 && title !== "未命名 Memo";
}

function aiSettingsSignature(settings: AiSettingsView): string {
  return JSON.stringify({
    baseUrl: settings.baseUrl,
    model: settings.model,
    promptTemplate: settings.promptTemplate,
    updatedAt: settings.updatedAt
  });
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
