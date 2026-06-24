import { AppShell } from "./components/AppShell";
import type { ApiClient } from "./api/client";
import { AuthPage } from "./pages/AuthPage";
import { CapturePage } from "./pages/CapturePage";
import { HistoryPage } from "./pages/HistoryPage";
import { MemoDetailPage } from "./pages/MemoDetailPage";
import { MemosPage } from "./pages/MemosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useMemoTaskState } from "./state/app-state";

export default function App({ client }: { client?: ApiClient }) {
  const state = useMemoTaskState(client);

  if (state.authMode === "checking") {
    return (
      <main className="auth-shell">
        <section className="soft-card auth-card">
          <p className="section-kicker">MemoTask 账号</p>
          <h1>检查账号状态</h1>
        </section>
      </main>
    );
  }

  if (state.authMode !== "authenticated") {
    return (
      <AuthPage
        canOpenTestResetLink={state.canOpenTestResetLink}
        canOpenTestVerificationLink={state.canOpenTestVerificationLink}
        email={state.authEmail}
        error={state.error}
        message={state.authMessage}
        mode={state.authMode}
        onForgotPassword={state.forgotPassword}
        onLogin={state.login}
        onOpenTestResetLink={state.openTestResetLink}
        onOpenTestVerificationLink={state.openTestVerificationLink}
        onRegister={state.register}
        onResendVerification={state.resendVerification}
        onResetPassword={state.resetPassword}
        onSetMode={state.setAuthMode}
        onVerifyEmail={state.verifyEmail}
      />
    );
  }

  return (
    <AppShell
      page={state.page}
      activePrimary={state.activePrimary}
      title={state.title}
      userEmail={state.authUser?.email ?? ""}
      onLogout={() => void state.logout()}
      onNavigate={state.setPage}
    >
      {state.page === "memos" ? (
        <MemosPage
          memos={state.memos}
          onMoveMemo={(memoId, direction) => void state.moveMemo(memoId, direction)}
          onOpenMemo={state.openMemoDetail}
          onReorderMemos={(memoIds) => void state.reorderMemoList(memoIds)}
          onToggleTodo={(todoId) => void state.toggleTodo(todoId)}
        />
      ) : null}
      {state.page === "memoDetail" ? (
        state.activeMemo ? (
          <MemoDetailPage
            error={state.error}
            memo={state.activeMemo}
            message={state.detailMessage}
            onArchive={() => void state.archiveActiveMemo()}
            onBack={() => state.setPage("memos")}
            onCreateTodo={(title) => void state.addActiveMemoTodo(title)}
            onDeleteTodo={(todoId) => void state.deleteActiveMemoTodo(todoId)}
            onReorderTodos={(todoIds) => void state.reorderActiveMemoTodos(todoIds)}
            onSaveMemo={(input) => void state.updateActiveMemo(input)}
            onToggleTodo={(todoId) => void state.toggleTodo(todoId)}
            onUpdateTodo={(todoId, title) => void state.updateActiveMemoTodo(todoId, title)}
          />
        ) : (
          <section className="soft-card intro-card">
            <h2>正在加载 Memo 详情</h2>
            {state.error ? <p className="status-message status-message-error">{state.error}</p> : null}
          </section>
        )
      ) : null}
      {state.page === "capture" ? (
        <CapturePage
          draft={state.draft}
          error={state.error}
          isAnalyzing={state.isAnalyzing}
          message={state.captureMessage}
          recentDrafts={state.recentDrafts}
          onAddTodo={state.addDraftTodo}
          onAnalyze={state.analyzeDraft}
          onLoadDraft={state.loadRecentDraft}
          onMoveTodo={state.moveDraftTodo}
          onPublish={state.publishDraft}
          onRemoveTodo={state.removeDraftTodo}
          onUpdateDraft={state.updateDraft}
        />
      ) : null}
      {state.page === "settings" ? (
        <SettingsPage
          draft={state.aiSettingsDraft}
          error={state.error}
          message={state.settingsMessage}
          settings={state.aiSettings}
          syncStatus={state.syncStatus}
          onExportJson={() => void state.exportJson()}
          onResetPrompt={() => void state.resetAiPrompt()}
          onSave={() => void state.saveAiSettings()}
          onTestConnection={() => void state.testAiConnection()}
          onUpdateDraft={state.updateAiSettingsDraft}
        />
      ) : null}
      {state.page === "history" ? (
        <HistoryPage
          canUndoDelete={state.canUndoHistoryDelete}
          message={state.historyMessage}
          memos={state.historyMemos}
          query={state.historyQuery}
          onBulkDelete={(memoIds) => void state.bulkDeleteHistory(memoIds)}
          onRestore={(memoId) => void state.restoreMemo(memoId)}
          onSearch={(query) => void state.searchHistory(query)}
          onUndoDelete={() => void state.undoHistoryDelete()}
        />
      ) : null}
    </AppShell>
  );
}
