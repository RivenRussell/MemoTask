import { AppShell } from "./components/AppShell";
import type { ApiClient } from "./api/client";
import { CapturePage } from "./pages/CapturePage";
import { HistoryPage } from "./pages/HistoryPage";
import { MemosPage } from "./pages/MemosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useMemoTaskState } from "./state/app-state";

export default function App({ client }: { client?: ApiClient }) {
  const state = useMemoTaskState(client);

  return (
    <AppShell page={state.page} activePrimary={state.activePrimary} title={state.title} onNavigate={state.setPage}>
      {state.page === "memos" ? <MemosPage memos={state.memos} onToggleTodo={(todoId) => void state.toggleTodo(todoId)} /> : null}
      {state.page === "capture" ? (
        <CapturePage
          draft={state.draft}
          error={state.error}
          onAddTodo={state.addDraftTodo}
          onPublish={state.publishDraft}
          onRemoveTodo={state.removeDraftTodo}
          onUpdateDraft={state.updateDraft}
        />
      ) : null}
      {state.page === "settings" ? <SettingsPage /> : null}
      {state.page === "history" ? <HistoryPage memos={state.historyMemos} onRestore={(memoId) => void state.restoreMemo(memoId)} /> : null}
    </AppShell>
  );
}
