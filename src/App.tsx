import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject, TouchEvent as ReactTouchEvent } from "react";
import { apiClient } from "./api/client";
import { extractMemoTagsFromText } from "./shared/memo-tags";
import type { AiSettingsView, AnalyzeDraftResult, AuthUserView, Memo, MemoTodo, SyncStatusView } from "./types";
import { Icon } from "./ui-icons";
import {
  addMemoTextTag,
  collectMemoTags,
  didRefreshComplete,
  filterMemosByQuery,
  getQuickRecordShortcut,
  isPullRefreshGesture,
  isBusyInScope,
  moveIdByDelta,
  removeMemoTextTag,
  toggleTodoInMemoList
} from "./ui-helpers";

type View = "workspace" | "history" | "account";
type AiPanelState = "idle" | "analyzing" | "done" | "failed" | "applied";
type AuthMode = "login" | "register" | "verify" | "forgot";

interface DraftForm {
  id: string | null;
  content: string;
}

interface EditableMemo {
  title: string;
  content: string;
  newTag: string;
  newTodo: string;
}

interface PendingTodoEdit {
  title: string;
  notes: string;
}

const EMPTY_AI_SETTINGS: AiSettingsView = {
  baseUrl: "",
  model: "",
  apiKeyMask: null,
  promptTemplate: "",
  updatedAt: ""
};

const EMPTY_SYNC_STATUS: SyncStatusView = {
  ok: false,
  lastSuccessAt: null,
  lastError: null,
  updatedAt: ""
};

export default function App() {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [view, setView] = useState<View>("workspace");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [history, setHistory] = useState<Memo[]>([]);
  const [drafts, setDrafts] = useState<Memo[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [draft, setDraft] = useState<DraftForm>({ id: null, content: "" });
  const [aiState, setAiState] = useState<AiPanelState>("idle");
  const [aiResult, setAiResult] = useState<AnalyzeDraftResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [editedMemo, setEditedMemo] = useState<EditableMemo | null>(null);
  const [todoEdits, setTodoEdits] = useState<Record<string, PendingTodoEdit>>({});
  const [aiSettings, setAiSettings] = useState<AiSettingsView>(EMPTY_AI_SETTINGS);
  const [syncStatus, setSyncStatus] = useState<SyncStatusView>(EMPTY_SYNC_STATUS);
  const [settingsForm, setSettingsForm] = useState({ baseUrl: "", model: "", apiKey: "", promptTemplate: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const captureTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const busyRef = useRef("");
  const refreshingRef = useRef(false);
  const canHideToTray = typeof window !== "undefined" && Boolean(window.memotaskDesktop?.hideToTray);

  useEffect(() => {
    let mounted = true;
    apiClient
      .getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (mounted) setCheckingUser(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshWorkspace();
    void refreshHistory();
    void refreshSettings();
  }, [user, selectedTag]);

  useEffect(() => {
    if (!user || view !== "history") {
      return;
    }
    const timeout = window.setTimeout(() => {
      void refreshHistory();
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [historyQuery, selectedTag, user, view]);

  useEffect(() => {
    if (!user) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (getQuickRecordShortcut(event) !== "focus") {
        return;
      }
      event.preventDefault();
      focusQuickRecord();
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [user]);

  const visibleMemos = useMemo(() => filterMemosByQuery(memos, workspaceQuery), [memos, workspaceQuery]);
  const sidebarTags = useMemo(() => collectMemoTags(tags, memos), [tags, memos]);

  async function refreshWorkspace(): Promise<boolean> {
    try {
      const [nextMemos, nextTags, nextDrafts] = await Promise.all([
        apiClient.listMemos(selectedTag ?? undefined),
        apiClient.listTags(),
        apiClient.listRecentDrafts()
      ]);
      setMemos(nextMemos);
      setTags(nextTags);
      setDrafts(nextDrafts);
      return true;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return false;
    }
  }

  async function refreshCurrentView(showMessage = false) {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    setMessage("");
    try {
      let results: boolean[];
      if (view === "history") {
        results = await Promise.all([refreshHistory(), refreshWorkspace(), refreshSettings()]);
      } else if (view === "account") {
        results = await Promise.all([refreshSettings(), refreshWorkspace()]);
      } else {
        results = await Promise.all([refreshWorkspace(), refreshSettings()]);
      }
      if (showMessage && didRefreshComplete(results)) {
        setMessage("已刷新");
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  async function refreshHistory(): Promise<boolean> {
    try {
      const query = historyQuery.trim();
      const nextHistory = query || selectedTag ? await apiClient.searchHistory(query, selectedTag ?? undefined) : await apiClient.listHistory();
      setHistory(nextHistory);
      return true;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return false;
    }
  }

  async function refreshSettings(): Promise<boolean> {
    try {
      const [settings, status] = await Promise.all([apiClient.getAiSettings(), apiClient.getSyncStatus()]);
      setAiSettings(settings);
      setSyncStatus(status);
      setSettingsForm({
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: "",
        promptTemplate: settings.promptTemplate
      });
      return true;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return false;
    }
  }

  async function withBusy(label: string, action: () => Promise<void>) {
    if (busyRef.current) {
      return;
    }
    busyRef.current = label;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      busyRef.current = "";
      setBusy("");
    }
  }

  async function saveDraftIfNeeded(): Promise<string | null> {
    const content = draft.content.trim();
    if (!content) {
      setError("请输入 Memo 内容");
      return null;
    }
    const saved = draft.id ? await apiClient.updateDraft(draft.id, { content }) : await apiClient.createDraft({ content });
    setDraft({ id: saved.id, content: saved.content });
    setDrafts((items) => [saved, ...items.filter((item) => item.id !== saved.id)].slice(0, 3));
    return saved.id;
  }

  async function handleAnalyzeDraft() {
    await withBusy("analyze", async () => {
      const draftId = await saveDraftIfNeeded();
      if (!draftId) return;
      setAiState("analyzing");
      try {
        const result = await apiClient.analyzeDraft(draftId);
        setAiResult(result);
        setAiState("done");
      } catch (requestError) {
        setAiError(errorMessage(requestError));
        setAiState("failed");
      }
    });
  }

  function handleApplyAiResult() {
    if (!aiResult) {
      return;
    }
    const todoText = aiResult.todos.map((todo) => `- [ ] ${todo.title}${todo.notes ? `\n  ${todo.notes}` : ""}`).join("\n");
    setDraft((current) => ({
      ...current,
      content: `${current.content.trim()}\n\n${todoText}`.trim()
    }));
    setAiState("applied");
  }

  async function handlePublishDraft() {
    await withBusy("publish", async () => {
      const content = draft.content.trim();
      if (!content) {
        setError("请输入 Memo 内容");
        return;
      }

      const title = aiResult?.title?.trim() || firstContentLine(content) || "未命名 Memo";
      const todos = aiResult?.todos.map((todo) => ({ ...todo, generatedByAi: true })) ?? [];
      const published = await apiClient.publishMemo({ draftId: draft.id ?? undefined, title, content, todos });
      setDraft({ id: null, content: "" });
      setAiResult(null);
      setAiState("idle");
      setMemos((items) => [published, ...items.filter((item) => item.id !== published.id)]);
      await Promise.all([refreshWorkspace(), refreshSettings()]);
      setMessage("Memo 已发布");
    });
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (window.scrollY > 0 || refreshingRef.current) {
      pullStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    pullStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = pullStartRef.current;
    const touch = event.changedTouches[0];
    pullStartRef.current = null;
    if (!start || !touch) {
      return;
    }
    if (isPullRefreshGesture({ startX: start.x, startY: start.y, currentX: touch.clientX, currentY: touch.clientY })) {
      void refreshCurrentView(true);
    }
  }

  function focusQuickRecord() {
    setSettingsOpen(false);
    setFilterSheetOpen(false);
    setView("workspace");
    window.requestAnimationFrame(() => captureTextareaRef.current?.focus());
  }

  function handleCaptureKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const shortcut = getQuickRecordShortcut(event);
    if (shortcut !== "publish" && shortcut !== "analyze") {
      return;
    }

    event.preventDefault();
    if (shortcut === "publish" && !isBusyInScope(busyRef.current || busy, ["publish", "analyze"])) {
      void handlePublishDraft();
    }
    if (shortcut === "analyze" && !isBusyInScope(busyRef.current || busy, ["publish", "analyze"])) {
      void handleAnalyzeDraft();
    }
  }

  function openMemoEditor(memo: Memo) {
    setExpandedMemoId((current) => (current === memo.id ? null : memo.id));
    setEditedMemo({ title: memo.title, content: memo.content, newTag: "", newTodo: "" });
    setTodoEdits(Object.fromEntries(memo.todos.map((todo) => [todo.id, { title: todo.title, notes: todo.notes ?? "" }])));
  }

  async function saveExpandedMemo(memo: Memo) {
    if (!editedMemo) {
      return;
    }
    await withBusy(`save-${memo.id}`, async () => {
      const optimisticMemo = {
        ...memo,
        title: editedMemo.title,
        content: editedMemo.content,
        tags: extractMemoTagsFromText(editedMemo.title, editedMemo.content),
        updatedAt: new Date().toISOString()
      };
      setMemos((items) => replaceOrRemoveMemo(items, optimisticMemo));
      const updated = await apiClient.updateMemo(memo.id, { title: editedMemo.title, content: editedMemo.content });
      setMemos((items) => replaceOrRemoveMemo(items, updated));
      setExpandedMemoId(updated.status === "active" ? updated.id : null);
      await Promise.all([refreshWorkspace(), refreshHistory(), refreshSettings()]);
      setMessage("Memo 已保存");
    });
  }

  async function addTagToExpandedMemo() {
    if (!editedMemo || !editedMemo.newTag.trim()) {
      return;
    }
    const next = addMemoTextTag({ title: editedMemo.title, content: editedMemo.content }, editedMemo.newTag);
    setEditedMemo({ ...editedMemo, ...next, newTag: "" });
  }

  function removeTagFromExpandedMemo(tag: string) {
    if (!editedMemo) {
      return;
    }
    const next = removeMemoTextTag({ title: editedMemo.title, content: editedMemo.content }, tag);
    setEditedMemo({ ...editedMemo, ...next });
  }

  async function handleToggleTodo(todo: MemoTodo) {
    await withBusy(`todo-${todo.id}`, async () => {
      setMemos((items) => toggleTodoInMemoList(items, todo.id, new Date().toISOString()));
      const result = await apiClient.toggleTodo(todo.id);
      const updatedMemo = result.memo;
      if (updatedMemo) {
        setMemos((items) => replaceOrRemoveMemo(items, updatedMemo));
      } else {
        await refreshWorkspace();
      }
      await Promise.all([refreshHistory(), refreshSettings()]);
    });
  }

  async function saveTodoEdit(todo: MemoTodo) {
    const edit = todoEdits[todo.id];
    if (!edit || !edit.title.trim()) {
      return;
    }
    await withBusy(`todo-save-${todo.id}`, async () => {
      setMemos((items) => updateTodoInMemoList(items, { ...todo, title: edit.title.trim(), notes: edit.notes.trim() || null }));
      const updated = await apiClient.updateTodo(todo.id, { title: edit.title, notes: edit.notes.trim() || null });
      setMemos((items) => updateTodoInMemoList(items, updated));
      await refreshSettings();
      setMessage("Todo 已保存");
    });
  }

  async function addTodoToMemo(memo: Memo) {
    if (!editedMemo?.newTodo.trim()) {
      return;
    }
    await withBusy(`todo-add-${memo.id}`, async () => {
      const optimisticTodo = createOptimisticTodo(memo.id, editedMemo.newTodo.trim(), memo.todos.length + 1);
      setMemos((items) => appendTodoToMemoList(items, memo.id, optimisticTodo));
      setEditedMemo({ ...editedMemo, newTodo: "" });
      const created = await apiClient.createTodo(memo.id, { title: optimisticTodo.title, generatedByAi: false });
      setMemos((items) => appendTodoToMemoList(removeTodoFromMemoList(items, optimisticTodo.id), memo.id, created));
      await refreshSettings();
    });
  }

  async function deleteTodo(todoId: string) {
    await withBusy(`todo-delete-${todoId}`, async () => {
      setMemos((items) => removeTodoFromMemoList(items, todoId));
      await apiClient.deleteTodo(todoId);
      await refreshSettings();
    });
  }

  async function reorderMemo(memoId: string, delta: -1 | 1) {
    const ids = visibleMemos.map((memo) => memo.id);
    const nextIds = moveIdByDelta(ids, memoId, delta);
    if (nextIds === ids) {
      return;
    }
    await withBusy(`reorder-${memoId}`, async () => {
      setMemos((items) => reorderMemoList(items, nextIds));
      const reordered = await apiClient.reorderMemos(nextIds);
      setMemos(reordered);
      await refreshSettings();
    });
  }

  async function reorderTodo(memo: Memo, todoId: string, delta: -1 | 1) {
    const ids = memo.todos.map((todo) => todo.id);
    const nextIds = moveIdByDelta(ids, todoId, delta);
    if (nextIds === ids) {
      return;
    }
    await withBusy(`todo-reorder-${todoId}`, async () => {
      setMemos((items) => replaceMemoTodos(items, memo.id, orderTodosByIds(memo.todos, nextIds)));
      const todos = await apiClient.reorderTodos(memo.id, nextIds);
      setMemos((items) => replaceMemoTodos(items, memo.id, todos));
      await refreshSettings();
    });
  }

  async function archiveMemo(memoId: string) {
    await withBusy(`archive-${memoId}`, async () => {
      const current = memos.find((memo) => memo.id === memoId);
      if (current) {
        setMemos((items) => items.filter((item) => item.id !== memoId));
        setHistory((items) => [{ ...current, status: "history", historyReason: "archived", historyAt: new Date().toISOString() }, ...items]);
      }
      const archived = await apiClient.archiveMemo(memoId);
      setMemos((items) => replaceOrRemoveMemo(items, archived));
      await Promise.all([refreshHistory(), refreshSettings()]);
      setMessage("Memo 已归档");
    });
  }

  async function restoreMemo(memoId: string) {
    await withBusy(`restore-${memoId}`, async () => {
      await apiClient.restoreMemo(memoId);
      await Promise.all([refreshHistory(), refreshWorkspace(), refreshSettings()]);
      setMessage("Memo 已恢复");
    });
  }

  async function deleteHistoryMemo(memoId: string) {
    await withBusy(`delete-history-${memoId}`, async () => {
      const result = await apiClient.bulkDeleteHistory([memoId]);
      await Promise.all([refreshHistory(), refreshSettings()]);
      setMessage(`已删除 1 条历史记录，可撤销：${result.operation.id}`);
    });
  }

  async function saveSettings() {
    await withBusy("settings", async () => {
      const settings = await apiClient.saveAiSettings(settingsForm);
      setAiSettings(settings);
      setSettingsForm({ baseUrl: settings.baseUrl, model: settings.model, apiKey: "", promptTemplate: settings.promptTemplate });
      await refreshSettings();
      setMessage("设置已保存");
    });
  }

  async function resetPrompt() {
    await withBusy("prompt", async () => {
      const settings = await apiClient.resetAiPrompt();
      setAiSettings(settings);
      setSettingsForm({ baseUrl: settings.baseUrl, model: settings.model, apiKey: "", promptTemplate: settings.promptTemplate });
      await refreshSettings();
      setMessage("Prompt 已恢复默认");
    });
  }

  async function testAiConnection() {
    await withBusy("ai-test", async () => {
      await apiClient.testAiConnection();
      setMessage("AI 连接正常");
    });
  }

  async function exportJson() {
    await withBusy("export", async () => {
      const data = await apiClient.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `memotask-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("JSON 已导出");
    });
  }

  async function logout() {
    await withBusy("logout", async () => {
      await apiClient.logout();
      setUser(null);
    });
  }

  async function hideToTray() {
    try {
      await window.memotaskDesktop?.hideToTray();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (checkingUser) {
    return (
      <main className="boot-screen">
        <div className="brand-mark">M</div>
        <p>正在打开 MemoTask...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  return (
    <div className={`app-shell view-${view}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <DesktopRail
        view={view}
        canHideToTray={canHideToTray}
        refreshing={refreshing}
        onViewChange={setView}
        onRefresh={() => void refreshCurrentView(true)}
        onHideToTray={hideToTray}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Sidebar
        view={view}
        query={view === "history" ? historyQuery : workspaceQuery}
        onQueryChange={view === "history" ? setHistoryQuery : setWorkspaceQuery}
        drafts={drafts}
        tags={sidebarTags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        onDraftSelect={(item) => setDraft({ id: item.id, content: item.content })}
      />
      <main className="app-main">
        {refreshing ? <div className="refresh-bar" aria-label="正在刷新" /> : null}
        {error ? <Notice tone="error" text={error} onDismiss={() => setError("")} /> : null}
        {message ? <Notice tone="info" text={message} onDismiss={() => setMessage("")} /> : null}
        {view === "workspace" ? (
          <WorkspaceView
            draft={draft}
            setDraft={setDraft}
            captureTextareaRef={captureTextareaRef}
            aiState={aiState}
            aiResult={aiResult}
            aiError={aiError}
            busy={busy}
            memos={visibleMemos}
            expandedMemoId={expandedMemoId}
            editedMemo={editedMemo}
            todoEdits={todoEdits}
            onAnalyze={handleAnalyzeDraft}
            onApplyAiResult={handleApplyAiResult}
            onClearAi={() => {
              setAiResult(null);
              setAiState("idle");
              setAiError("");
            }}
            onCaptureKeyDown={handleCaptureKeyDown}
            onPublish={handlePublishDraft}
            onOpenMemo={openMemoEditor}
            onEditMemo={setEditedMemo}
            onSaveMemo={saveExpandedMemo}
            onAddTag={addTagToExpandedMemo}
            onRemoveTag={removeTagFromExpandedMemo}
            onToggleTodo={handleToggleTodo}
            onTodoEdit={(todoId, edit) => setTodoEdits((items) => ({ ...items, [todoId]: edit }))}
            onSaveTodo={saveTodoEdit}
            onDeleteTodo={deleteTodo}
            onAddTodo={addTodoToMemo}
            onReorderMemo={reorderMemo}
            onReorderTodo={reorderTodo}
            onArchive={archiveMemo}
          />
        ) : null}
        {view === "history" ? (
          <HistoryView
            history={history}
            busy={busy}
            expandedHistoryId={expandedHistoryId}
            query={historyQuery}
            onQueryChange={setHistoryQuery}
            onToggleExpanded={(memoId) => setExpandedHistoryId((current) => (current === memoId ? null : memoId))}
            onRestore={restoreMemo}
            onDelete={deleteHistoryMemo}
          />
        ) : null}
        {view === "account" ? (
          <AccountView
            user={user}
            settings={aiSettings}
            syncStatus={syncStatus}
            form={settingsForm}
            setForm={setSettingsForm}
            busy={busy}
            onSave={saveSettings}
            onTest={testAiConnection}
            onResetPrompt={resetPrompt}
            onExport={exportJson}
            onLogout={logout}
          />
        ) : null}
      </main>
      <MobileTopbar view={view} refreshing={refreshing} onViewChange={setView} onRefresh={() => void refreshCurrentView(true)} onOpenFilter={() => setFilterSheetOpen(true)} />
      <MobileNav view={view} onViewChange={setView} />
      {filterSheetOpen ? (
        <FilterSheet
          view={view}
          query={view === "history" ? historyQuery : workspaceQuery}
          onQueryChange={view === "history" ? setHistoryQuery : setWorkspaceQuery}
          drafts={drafts}
          tags={sidebarTags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          onDraftSelect={(item) => {
            setDraft({ id: item.id, content: item.content });
            setFilterSheetOpen(false);
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDrawer
          user={user}
          settings={aiSettings}
          syncStatus={syncStatus}
          form={settingsForm}
          setForm={setSettingsForm}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onTest={testAiConnection}
          onResetPrompt={resetPrompt}
          onExport={exportJson}
          onLogout={logout}
        />
      ) : null}
    </div>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (user: AuthUserView) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        onAuthed(await apiClient.login({ email, password }));
      } else if (mode === "register") {
        setMessage("注册成功，请查看邮箱验证码");
        await apiClient.register({ email, password });
        setMode("verify");
      } else if (mode === "verify") {
        onAuthed(await apiClient.verifyEmail(code));
      } else {
        await apiClient.forgotPassword(email);
        setMessage("如果邮箱存在，重置邮件会发送到你的邮箱");
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-row">
          <div className="brand-mark">M</div>
          <strong>MemoTask</strong>
        </div>
        <h1 id="auth-title">{authTitle(mode)}</h1>
        <form onSubmit={submit} className="form-stack">
          {mode !== "verify" ? (
            <label>
              邮箱
              <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </label>
          ) : null}
          {mode === "login" || mode === "register" ? (
            <label>
              密码
              <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位，含字母和数字" required />
            </label>
          ) : null}
          {mode === "verify" ? (
            <label>
              邮箱验证码
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 位验证码" required />
            </label>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-message">{message}</p> : null}
          <button className="primary-button" disabled={busy}>{busy ? "处理中..." : authButton(mode)}</button>
        </form>
        <div className="auth-actions">
          <button onClick={() => setMode("login")}>登录</button>
          <button onClick={() => setMode("register")}>注册</button>
          <button onClick={() => setMode("verify")}>验证邮箱</button>
          <button onClick={() => setMode("forgot")}>忘记密码</button>
        </div>
      </section>
    </main>
  );
}

function DesktopRail({
  view,
  canHideToTray,
  refreshing,
  onViewChange,
  onRefresh,
  onHideToTray,
  onOpenSettings
}: {
  view: View;
  canHideToTray: boolean;
  refreshing: boolean;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
  onHideToTray: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <nav className="rail" aria-label="MemoTask 主导航">
      <button className="brand-mark rail-brand" onClick={() => onViewChange("workspace")} aria-label="MemoTask">M</button>
      <button className={view === "workspace" ? "active" : ""} onClick={() => onViewChange("workspace")} aria-label="工作台" title="工作台">
        <Icon name="memo" />
      </button>
      <button className={view === "history" ? "active" : ""} onClick={() => onViewChange("history")} aria-label="历史" title="历史">
        <Icon name="history" />
      </button>
      <button className={refreshing ? "is-spinning" : ""} disabled={refreshing} onClick={onRefresh} aria-label="刷新" title="刷新">
        <Icon name="refresh" />
      </button>
      {canHideToTray ? (
        <button onClick={onHideToTray} aria-label="隐藏到托盘" title="隐藏到托盘">
          <Icon name="tray" />
        </button>
      ) : null}
      <button className="rail-account" onClick={onOpenSettings} aria-label="设置" title="设置">
        <Icon name="user" />
      </button>
    </nav>
  );
}

function Sidebar(props: {
  view: View;
  query: string;
  onQueryChange: (query: string) => void;
  drafts: Memo[];
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onDraftSelect: (draft: Memo) => void;
}) {
  return (
    <aside className="sidebar">
      <SearchBox
        value={props.query}
        placeholder={props.view === "history" ? "搜索历史记录..." : "搜索备忘录..."}
        onChange={props.onQueryChange}
      />
      {props.view !== "history" ? (
        <SidebarSection title="草稿记录">
          {props.drafts.length ? (
            props.drafts.map((draft) => (
              <button key={draft.id} className="draft-row" onClick={() => props.onDraftSelect(draft)}>
                <Icon name="file" size={15} />
                <span>{draft.title || firstContentLine(draft.content) || "未命名 Memo"}</span>
                <time>{relativeDraftTime(draft.updatedAt)}</time>
              </button>
            ))
          ) : (
            <p className="empty-copy">保存过的草稿会出现在这里。</p>
          )}
        </SidebarSection>
      ) : (
        <SidebarSection title="History">
          <div className="history-filters">
            <button className={!props.selectedTag ? "selected" : ""} onClick={() => props.onSelectTag(null)}>All</button>
            <button>Completed</button>
            <button>Manual</button>
          </div>
        </SidebarSection>
      )}
      <SidebarSection title="标签">
        <TagList tags={props.tags} selectedTag={props.selectedTag} onSelectTag={props.onSelectTag} />
      </SidebarSection>
    </aside>
  );
}

function WorkspaceView(props: {
  draft: DraftForm;
  setDraft: (draft: DraftForm) => void;
  captureTextareaRef: RefObject<HTMLTextAreaElement | null>;
  aiState: AiPanelState;
  aiResult: AnalyzeDraftResult | null;
  aiError: string;
  busy: string;
  memos: Memo[];
  expandedMemoId: string | null;
  editedMemo: EditableMemo | null;
  todoEdits: Record<string, PendingTodoEdit>;
  onAnalyze: () => void;
  onApplyAiResult: () => void;
  onClearAi: () => void;
  onCaptureKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPublish: () => void;
  onOpenMemo: (memo: Memo) => void;
  onEditMemo: (memo: EditableMemo) => void;
  onSaveMemo: (memo: Memo) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onToggleTodo: (todo: MemoTodo) => void;
  onTodoEdit: (todoId: string, edit: PendingTodoEdit) => void;
  onSaveTodo: (todo: MemoTodo) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddTodo: (memo: Memo) => void;
  onReorderMemo: (memoId: string, delta: -1 | 1) => void;
  onReorderTodo: (memo: Memo, todoId: string, delta: -1 | 1) => void;
  onArchive: (memoId: string) => void;
}) {
  const captureBusy = Boolean(props.busy);
  return (
    <div className="workspace">
      <section className="capture-panel" aria-labelledby="capture-title">
        <h1 id="capture-title" className="visually-hidden">随时记录 Memo</h1>
        <textarea
          ref={props.captureTextareaRef}
          value={props.draft.content}
          onChange={(event) => props.setDraft({ ...props.draft, content: event.target.value })}
          onKeyDown={props.onCaptureKeyDown}
          placeholder="随时记录..."
        />
        <div className="capture-actions">
          <span className="hash-hint">#</span>
          <button className="primary-button" disabled={captureBusy} onClick={props.onAnalyze}>
            {props.busy === "analyze" ? "整理中..." : "AI 整理"}
          </button>
          <button className="ghost-button" disabled={captureBusy} onClick={props.onPublish}>
            {props.busy === "publish" ? "发布中..." : "发布"}
          </button>
        </div>
      </section>
      <AiResultPanel
        state={props.aiState}
        result={props.aiResult}
        error={props.aiError}
        onApply={props.onApplyAiResult}
        onClear={props.onClearAi}
        onRetry={props.onAnalyze}
      />
      <section className="memo-list" aria-label="当前 Memo 队列">
        {props.memos.length ? (
          props.memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              busy={props.busy}
              expanded={props.expandedMemoId === memo.id}
              editedMemo={props.editedMemo}
              todoEdits={props.todoEdits}
              onOpen={() => props.onOpenMemo(memo)}
              onEditMemo={props.onEditMemo}
              onSaveMemo={() => props.onSaveMemo(memo)}
              onAddTag={props.onAddTag}
              onRemoveTag={props.onRemoveTag}
              onToggleTodo={props.onToggleTodo}
              onTodoEdit={props.onTodoEdit}
              onSaveTodo={props.onSaveTodo}
              onDeleteTodo={props.onDeleteTodo}
              onAddTodo={() => props.onAddTodo(memo)}
              onReorder={(delta) => props.onReorderMemo(memo.id, delta)}
              onReorderTodo={(todoId, delta) => props.onReorderTodo(memo, todoId, delta)}
              onArchive={() => props.onArchive(memo.id)}
            />
          ))
        ) : (
          <EmptyPanel text="先随手记录一条 Memo。" />
        )}
      </section>
    </div>
  );
}

function AiResultPanel(props: {
  state: AiPanelState;
  result: AnalyzeDraftResult | null;
  error: string;
  onApply: () => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="ai-panel" aria-labelledby="ai-title">
      <div className="panel-title-row">
        <h2 id="ai-title">
          <Icon name="spark" />
          整理结果
        </h2>
        <div className="inline-actions">
          <button onClick={props.onApply} disabled={!props.result}>应用</button>
          <button onClick={props.onClear}>清除</button>
          <button className="icon-button" aria-label="更多">
            <Icon name="more" />
          </button>
        </div>
      </div>
      {props.state === "idle" ? <p className="empty-copy">点击 AI 整理后，会在这里生成建议标题和 Todo。</p> : null}
      {props.state === "analyzing" ? <p className="empty-copy">正在整理 Memo...</p> : null}
      {props.state === "failed" ? (
        <div className="soft-error">
          <span>{props.error || "AI 分析失败"}</span>
          <button onClick={props.onRetry}>重试</button>
        </div>
      ) : null}
      {props.result ? (
        <div className="ai-result">
          <p>
            建议标题： <strong>{props.result.title}</strong>
          </p>
          <ul>
            {props.result.todos.map((todo, index) => (
              <li key={`${todo.title}-${index}`}>
                <span className="checkbox" aria-hidden="true" />
                <span>{todo.title}</span>
              </li>
            ))}
          </ul>
          <button className="add-row" type="button">
            <Icon name="plus" />
            添加 Todo
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MemoCard(props: {
  memo: Memo;
  busy: string;
  expanded: boolean;
  editedMemo: EditableMemo | null;
  todoEdits: Record<string, PendingTodoEdit>;
  onOpen: () => void;
  onEditMemo: (memo: EditableMemo) => void;
  onSaveMemo: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onToggleTodo: (todo: MemoTodo) => void;
  onTodoEdit: (todoId: string, edit: PendingTodoEdit) => void;
  onSaveTodo: (todo: MemoTodo) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddTodo: () => void;
  onReorder: (delta: -1 | 1) => void;
  onReorderTodo: (todoId: string, delta: -1 | 1) => void;
  onArchive: () => void;
}) {
  const editor = props.editedMemo;
  const editorTags = editor ? extractMemoTagsFromText(editor.title, editor.content) : props.memo.tags;
  const memoBusy = Boolean(props.busy);

  return (
    <article className={`memo-card ${props.expanded ? "expanded" : ""}`}>
      <div className="memo-card-head">
        <button className="drag-button" aria-label="拖拽排序" title="拖拽排序">
          <Icon name="drag" />
        </button>
        {props.expanded && editor ? (
          <input className="title-input" value={editor.title} onChange={(event) => props.onEditMemo({ ...editor, title: event.target.value })} />
        ) : (
          <button className="memo-title-button" onClick={props.onOpen}>
            <h3>{props.memo.title}</h3>
          </button>
        )}
        <div className="card-actions">
          <button className="icon-button" disabled={memoBusy} onClick={() => props.onReorder(-1)} aria-label="上移">
            <Icon name="chevronUp" />
          </button>
          <button className="icon-button" disabled={memoBusy} onClick={() => props.onReorder(1)} aria-label="下移">
            <Icon name="chevronDown" />
          </button>
          <button className="icon-button" onClick={props.onOpen} aria-label={props.expanded ? "收起" : "展开"}>
            <Icon name={props.expanded ? "chevronUp" : "more"} />
          </button>
        </div>
      </div>
      {props.expanded && editor ? (
        <div className="memo-editor">
          <textarea value={editor.content} onChange={(event) => props.onEditMemo({ ...editor, content: event.target.value })} />
          <div className="tag-strip">
            {editorTags.map((tag) => (
              <button key={tag} className="tag-chip selected" onClick={() => props.onRemoveTag(tag)}>
                #{tag}
                <Icon name="x" size={13} />
              </button>
            ))}
            <input value={editor.newTag} onChange={(event) => props.onEditMemo({ ...editor, newTag: event.target.value })} placeholder="标签" />
            <button className="ghost-button small" onClick={props.onAddTag}>
              <Icon name="plus" />
              标签
            </button>
          </div>
          <TodoEditorList
            memo={props.memo}
            busy={props.busy}
            todoEdits={props.todoEdits}
            newTodo={editor.newTodo}
            onNewTodoChange={(newTodo) => props.onEditMemo({ ...editor, newTodo })}
            onToggleTodo={props.onToggleTodo}
            onTodoEdit={props.onTodoEdit}
            onSaveTodo={props.onSaveTodo}
            onDeleteTodo={props.onDeleteTodo}
            onAddTodo={props.onAddTodo}
            onReorderTodo={props.onReorderTodo}
          />
          <div className="editor-actions">
            <button className="primary-button" disabled={memoBusy} onClick={props.onSaveMemo}>
              {props.busy === `save-${props.memo.id}` ? "保存中..." : "保存"}
            </button>
            <button className="ghost-button" onClick={props.onOpen}>收起</button>
            <button className="ghost-button" disabled={memoBusy} onClick={props.onArchive}>
              {props.busy === `archive-${props.memo.id}` ? "归档中..." : "归档"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <TagStrip tags={props.memo.tags} />
          {props.memo.content ? <p className="memo-summary">{summarize(props.memo.content)}</p> : null}
          <TodoList todos={props.memo.todos} onToggleTodo={props.onToggleTodo} />
        </>
      )}
    </article>
  );
}

function TodoEditorList(props: {
  memo: Memo;
  busy: string;
  todoEdits: Record<string, PendingTodoEdit>;
  newTodo: string;
  onNewTodoChange: (value: string) => void;
  onToggleTodo: (todo: MemoTodo) => void;
  onTodoEdit: (todoId: string, edit: PendingTodoEdit) => void;
  onSaveTodo: (todo: MemoTodo) => void;
  onDeleteTodo: (todoId: string) => void;
  onAddTodo: () => void;
  onReorderTodo: (todoId: string, delta: -1 | 1) => void;
}) {
  const listBusy = Boolean(props.busy);
  return (
    <div className="todo-editor">
      {props.memo.todos.map((todo) => {
        const edit = props.todoEdits[todo.id] ?? { title: todo.title, notes: todo.notes ?? "" };
        const todoBusy = Boolean(props.busy);
        return (
          <div key={todo.id} className="todo-edit-row">
            <button className={`checkbox ${todo.status === "done" ? "checked" : ""}`} disabled={todoBusy} onClick={() => props.onToggleTodo(todo)} aria-label="切换 Todo">
              {todo.status === "done" ? <Icon name="check" size={14} /> : null}
            </button>
            <button className="drag-mini" disabled={todoBusy} onClick={() => props.onReorderTodo(todo.id, -1)} aria-label="Todo 上移">
              <Icon name="chevronUp" size={14} />
            </button>
            <input value={edit.title} onChange={(event) => props.onTodoEdit(todo.id, { ...edit, title: event.target.value })} />
            <input value={edit.notes} onChange={(event) => props.onTodoEdit(todo.id, { ...edit, notes: event.target.value })} placeholder="notes" />
            <button className="icon-button" disabled={todoBusy} onClick={() => props.onSaveTodo(todo)} aria-label="保存 Todo">
              <Icon name="save" />
            </button>
            <button className="icon-button" disabled={todoBusy} onClick={() => props.onDeleteTodo(todo.id)} aria-label="删除 Todo">
              <Icon name="trash" />
            </button>
            <button className="drag-mini" disabled={todoBusy} onClick={() => props.onReorderTodo(todo.id, 1)} aria-label="Todo 下移">
              <Icon name="chevronDown" size={14} />
            </button>
          </div>
        );
      })}
      <div className="add-todo-row">
        <Icon name="plus" />
        <input value={props.newTodo} onChange={(event) => props.onNewTodoChange(event.target.value)} placeholder="添加 Todo" />
        <button disabled={listBusy} onClick={props.onAddTodo}>{props.busy === `todo-add-${props.memo.id}` ? "添加中..." : "添加"}</button>
      </div>
    </div>
  );
}

function TodoList({ todos, onToggleTodo }: { todos: MemoTodo[]; onToggleTodo: (todo: MemoTodo) => void }) {
  if (!todos.length) {
    return null;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <li key={todo.id}>
          <button className={`checkbox ${todo.status === "done" ? "checked" : ""}`} onClick={() => onToggleTodo(todo)} aria-label="切换 Todo">
            {todo.status === "done" ? <Icon name="check" size={14} /> : null}
          </button>
          <span>{todo.title}</span>
        </li>
      ))}
    </ul>
  );
}

function HistoryView(props: {
  history: Memo[];
  busy: string;
  expandedHistoryId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onToggleExpanded: (memoId: string) => void;
  onRestore: (memoId: string) => void;
  onDelete: (memoId: string) => void;
}) {
  const historyBusy = Boolean(props.busy);
  return (
    <section className="history-view" aria-labelledby="history-title">
      <div className="view-header">
        <div>
          <h1 id="history-title">历史记录</h1>
          <p>{props.history.length} 条记录</p>
        </div>
        <SearchBox value={props.query} placeholder="搜索记录" disabled={historyBusy} onChange={props.onQueryChange} />
        <button className="ghost-button" disabled={historyBusy}>
          <Icon name="check" />
          选择
        </button>
      </div>
      <div className="history-list">
        {props.history.length ? (
          props.history.map((memo) => {
            const doneCount = memo.todos.filter((todo) => todo.status === "done").length;
            const expanded = props.expandedHistoryId === memo.id;
            return (
              <article key={memo.id} className={`history-card ${expanded ? "expanded" : ""}`}>
                <button className="history-body" disabled={historyBusy} onClick={() => props.onToggleExpanded(memo.id)}>
                  <h3>{memo.title}</h3>
                  <p>{summarize(memo.content)}</p>
                  <TagStrip tags={memo.tags} />
                </button>
                <div className="history-meta">
                  <span className={memo.historyReason === "completed" ? "status-pill done" : "status-pill manual"}>
                    {memo.historyReason === "completed" ? "已完成" : "手动归档"}
                  </span>
                  <span>{doneCount}/{memo.todos.length} Todo</span>
                  <button disabled={historyBusy} onClick={() => props.onRestore(memo.id)}>
                    {props.busy === `restore-${memo.id}` ? "恢复中..." : "恢复"}
                  </button>
                  <button disabled={historyBusy} onClick={() => props.onDelete(memo.id)}>
                    {props.busy === `delete-history-${memo.id}` ? "删除中..." : "删除"}
                  </button>
                  <button className="icon-button" disabled={historyBusy} onClick={() => props.onToggleExpanded(memo.id)} aria-label="展开历史详情">
                    <Icon name={expanded ? "chevronUp" : "more"} />
                  </button>
                </div>
                {expanded ? (
                  <div className="history-detail">
                    <p>{memo.content}</p>
                    <TodoList todos={memo.todos} onToggleTodo={() => undefined} />
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <EmptyPanel text="归档后的 Memo 会出现在这里。" />
        )}
      </div>
    </section>
  );
}

function AccountView(props: SettingsProps) {
  return (
    <section className="account-page" aria-labelledby="account-title">
      <div className="view-header">
        <div>
          <h1 id="account-title">账号</h1>
        </div>
      </div>
      <SettingsContent {...props} />
    </section>
  );
}

interface SettingsProps {
  user: AuthUserView;
  settings: AiSettingsView;
  syncStatus: SyncStatusView;
  form: { baseUrl: string; model: string; apiKey: string; promptTemplate: string };
  setForm: (form: { baseUrl: string; model: string; apiKey: string; promptTemplate: string }) => void;
  busy: string;
  onSave: () => void;
  onTest: () => void;
  onResetPrompt: () => void;
  onExport: () => void;
  onLogout: () => void;
}

function SettingsDrawer(props: SettingsProps & { onClose: () => void }) {
  return (
    <aside className="settings-drawer" aria-label="设置">
      <div className="drawer-header">
        <h2>设置</h2>
        <button className="icon-button" onClick={props.onClose} aria-label="关闭设置">
          <Icon name="x" />
        </button>
      </div>
      <SettingsContent {...props} />
    </aside>
  );
}

function SettingsContent(props: SettingsProps) {
  const settingsBusy = Boolean(props.busy);
  return (
    <div className="settings-content">
      <section className="settings-section">
        <h3>账号</h3>
        <p>{props.user.email}</p>
        <p className="muted">账号状态：{props.user.emailVerified ? "正常" : "待验证"}</p>
        <button className="ghost-button" disabled={settingsBusy} onClick={props.onLogout}>
          <Icon name="logOut" />
          {props.busy === "logout" ? "退出中..." : "退出登录"}
        </button>
      </section>
      <section className="settings-section">
        <h3>AI API</h3>
        <label>
          接口地址
          <input value={props.form.baseUrl} onChange={(event) => props.setForm({ ...props.form, baseUrl: event.target.value })} />
        </label>
        <label>
          模型
          <input value={props.form.model} onChange={(event) => props.setForm({ ...props.form, model: event.target.value })} />
        </label>
        <label>
          API 密钥
          <input value={props.form.apiKey} onChange={(event) => props.setForm({ ...props.form, apiKey: event.target.value })} placeholder={props.settings.apiKeyMask ?? "未保存"} />
        </label>
        <div className="settings-actions">
          <button className="primary-button" disabled={settingsBusy} onClick={props.onSave}>
            {props.busy === "settings" ? "保存中..." : "保存设置"}
          </button>
          <button className="ghost-button" disabled={settingsBusy} onClick={props.onTest}>
            {props.busy === "ai-test" ? "测试中..." : "测试连接"}
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h3>Prompt</h3>
        <label>
          Prompt 模板
          <textarea value={props.form.promptTemplate} onChange={(event) => props.setForm({ ...props.form, promptTemplate: event.target.value })} />
        </label>
        <button className="ghost-button" disabled={settingsBusy} onClick={props.onResetPrompt}>
          {props.busy === "prompt" ? "恢复中..." : "恢复默认 Prompt"}
        </button>
      </section>
      <section className="settings-section data-section">
        <h3>数据</h3>
        <button className="ghost-button" disabled={settingsBusy} onClick={props.onExport}>
          <Icon name="download" />
          {props.busy === "export" ? "导出中..." : "导出 JSON"}
        </button>
        <p className="sync-status">
          同步状态：{props.syncStatus.ok ? "正常" : "需要检查"}
          {props.syncStatus.lastSuccessAt ? <span>上次同步：{formatDateTime(props.syncStatus.lastSuccessAt)}</span> : null}
        </p>
      </section>
    </div>
  );
}

function MobileTopbar({
  view,
  refreshing,
  onViewChange,
  onRefresh,
  onOpenFilter
}: {
  view: View;
  refreshing: boolean;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
  onOpenFilter: () => void;
}) {
  return (
    <header className="mobile-topbar">
      <button className="brand-mark" onClick={() => onViewChange("workspace")}>M</button>
      <strong>{view === "history" ? "历史记录" : view === "account" ? "账号" : "MemoTask"}</strong>
      <div className="mobile-top-actions">
        <button className={`icon-button ${refreshing ? "is-spinning" : ""}`} disabled={refreshing} onClick={onRefresh} aria-label="刷新">
          <Icon name="refresh" size={24} />
        </button>
        <button className="icon-button" onClick={onOpenFilter} aria-label="搜索">
          <Icon name="search" size={24} />
        </button>
        <button className="icon-button" onClick={onOpenFilter} aria-label="筛选">
          <Icon name="filter" size={24} />
        </button>
      </div>
    </header>
  );
}

function MobileNav({ view, onViewChange }: { view: View; onViewChange: (view: View) => void }) {
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      <button className={view === "workspace" ? "active" : ""} onClick={() => onViewChange("workspace")}>
        <Icon name="layers" />
        工作台
      </button>
      <button className={view === "history" ? "active" : ""} onClick={() => onViewChange("history")}>
        <Icon name="history" />
        历史
      </button>
      <button className={view === "account" ? "active" : ""} onClick={() => onViewChange("account")}>
        <Icon name="user" />
        账号
      </button>
    </nav>
  );
}

function FilterSheet(props: {
  view: View;
  query: string;
  onQueryChange: (query: string) => void;
  drafts: Memo[];
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onDraftSelect: (draft: Memo) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <aside className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <h2>筛选</h2>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭筛选">
            <Icon name="x" />
          </button>
        </div>
        <SearchBox value={props.query} placeholder={props.view === "history" ? "搜索历史记录..." : "搜索备忘录..."} onChange={props.onQueryChange} />
        {props.view !== "history" ? (
          <SidebarSection title="草稿记录">
            {props.drafts.map((draft) => (
              <button key={draft.id} className="draft-row" onClick={() => props.onDraftSelect(draft)}>
                <Icon name="file" />
                {draft.title || firstContentLine(draft.content) || "未命名 Memo"}
              </button>
            ))}
            {!props.drafts.length ? <p className="empty-copy">保存过的草稿会出现在这里。</p> : null}
          </SidebarSection>
        ) : null}
        <SidebarSection title="标签">
          <TagList tags={props.tags} selectedTag={props.selectedTag} onSelectTag={props.onSelectTag} />
        </SidebarSection>
      </aside>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sidebar-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SearchBox({
  value,
  placeholder,
  disabled = false,
  onChange
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search-box">
      <Icon name="search" />
      <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <Icon name="filter" />
    </label>
  );
}

function TagList({ tags, selectedTag, onSelectTag }: { tags: string[]; selectedTag: string | null; onSelectTag: (tag: string | null) => void }) {
  if (!tags.length) {
    return <p className="empty-copy">在 Memo 中写下 #标签 后会出现在这里。</p>;
  }

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <button key={tag} className={`tag-chip ${selectedTag === tag ? "selected" : ""}`} onClick={() => onSelectTag(selectedTag === tag ? null : tag)}>
          #{tag}
        </button>
      ))}
    </div>
  );
}

function TagStrip({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return null;
  }
  return (
    <div className="tag-strip">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">#{tag}</span>
      ))}
    </div>
  );
}

function Notice({ tone, text, onDismiss }: { tone: "error" | "info"; text: string; onDismiss: () => void }) {
  return (
    <div className={`notice ${tone}`}>
      <span>{text}</span>
      <button onClick={onDismiss} aria-label="关闭">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="empty-panel">{text}</div>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}

function authTitle(mode: AuthMode): string {
  return {
    login: "登录",
    register: "注册",
    verify: "验证邮箱",
    forgot: "重置密码"
  }[mode];
}

function authButton(mode: AuthMode): string {
  return {
    login: "登录",
    register: "注册",
    verify: "验证",
    forgot: "发送重置邮件"
  }[mode];
}

function replaceOrRemoveMemo(items: Memo[], nextMemo: Memo): Memo[] {
  if (nextMemo.status !== "active" || nextMemo.deletedAt !== null) {
    return items.filter((item) => item.id !== nextMemo.id);
  }
  return items.map((item) => (item.id === nextMemo.id ? nextMemo : item));
}

function updateTodoInMemoList(items: Memo[], nextTodo: MemoTodo): Memo[] {
  return items.map((memo) => {
    if (!memo.todos.some((todo) => todo.id === nextTodo.id)) {
      return memo;
    }

    return {
      ...memo,
      updatedAt: nextTodo.updatedAt || memo.updatedAt,
      todos: memo.todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo)).filter((todo) => todo.deletedAt === null)
    };
  });
}

function appendTodoToMemoList(items: Memo[], memoId: string, todo: MemoTodo): Memo[] {
  return items.map((memo) =>
    memo.id === memoId
      ? {
          ...memo,
          updatedAt: todo.updatedAt || memo.updatedAt,
          todos: [...memo.todos.filter((item) => item.id !== todo.id), todo].sort((a, b) => a.sortOrder - b.sortOrder)
        }
      : memo
  );
}

function removeTodoFromMemoList(items: Memo[], todoId: string): Memo[] {
  return items.map((memo) =>
    memo.todos.some((todo) => todo.id === todoId)
      ? {
          ...memo,
          todos: memo.todos.filter((todo) => todo.id !== todoId)
        }
      : memo
  );
}

function replaceMemoTodos(items: Memo[], memoId: string, todos: MemoTodo[]): Memo[] {
  return items.map((memo) => (memo.id === memoId ? { ...memo, todos } : memo));
}

function reorderMemoList(items: Memo[], orderedIds: string[]): Memo[] {
  const orderedIdSet = new Set(orderedIds);
  const byId = new Map(items.map((memo) => [memo.id, memo]));
  const ordered = orderedIds.map((id, index) => {
    const memo = byId.get(id);
    return memo ? { ...memo, sortOrder: index + 1 } : null;
  }).filter((memo): memo is Memo => Boolean(memo));
  return [...ordered, ...items.filter((memo) => !orderedIdSet.has(memo.id))];
}

function orderTodosByIds(todos: MemoTodo[], todoIds: string[]): MemoTodo[] {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  return todoIds.map((id, index) => {
    const todo = byId.get(id);
    return todo ? { ...todo, sortOrder: index + 1 } : null;
  }).filter((todo): todo is MemoTodo => Boolean(todo));
}

function createOptimisticTodo(memoId: string, title: string, sortOrder: number): MemoTodo {
  const now = new Date().toISOString();
  return {
    id: `local-${crypto.randomUUID()}`,
    memoId,
    title,
    notes: null,
    status: "todo",
    sortOrder,
    generatedByAi: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null
  };
}

function firstContentLine(content: string): string {
  return content.trim().split(/\r?\n/)[0]?.replace(/^#+\s*/, "").trim() ?? "";
}

function summarize(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 96 ? `${compact.slice(0, 96)}...` : compact;
}

function relativeDraftTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  const diff = Date.now() - timestamp;
  if (diff < 1000 * 60 * 5) return "刚刚";
  if (diff < 1000 * 60 * 60 * 24) return formatDateTime(value).slice(11, 16);
  return "昨天";
}

function formatDateTime(value: string): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
