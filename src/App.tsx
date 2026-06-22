import { AppShell } from "./components/AppShell";
import type { ApiClient } from "./api/client";
import { CapturePage } from "./pages/CapturePage";
import { HistoryPage } from "./pages/HistoryPage";
import { MemoDetailPage } from "./pages/MemoDetailPage";
import { MemosPage } from "./pages/MemosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useMemoTaskState } from "./state/app-state";

export default function App({ client }: { client?: ApiClient }) {
  const state = useMemoTaskState(client);

  return (
    <AppShell page={state.page} activePrimary={state.activePrimary} title={state.title} onNavigate={state.setPage}>
      {state.page === "memos" ? (
        <MemosPage
          memos={state.memos}
          onOpenMemo={state.openMemoDetail}
          onToggleTodo={(todoId) => void state.toggleTodo(todoId)}
        />
      ) : null}
      {state.page === "memoDetail" && state.activeMemo ? (
        <MemoDetailPage
          error={state.error}
          memo={state.activeMemo}
          message={state.detailMessage}
          onArchive={() => void state.archiveActiveMemo()}
          onBack={() => state.setPage("memos")}
          onCreateTodo={(title) => void state.addActiveMemoTodo(title)}
          onDeleteTodo={(todoId) => void state.deleteActiveMemoTodo(todoId)}
          onSaveMemo={(input) => void state.updateActiveMemo(input)}
          onToggleTodo={(todoId) => void state.toggleTodo(todoId)}
        />
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
