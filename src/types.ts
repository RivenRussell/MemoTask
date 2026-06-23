export type MemoStatus = "draft" | "active" | "history" | "deleted";
export type MemoHistoryReason = "completed" | "archived";
export type TodoStatus = "todo" | "done";
export type AiState = "idle" | "analyzing" | "done" | "failed" | "unavailable";

export interface MemoTodo {
  id: string;
  memoId: string;
  title: string;
  notes: string | null;
  status: TodoStatus;
  sortOrder: number;
  generatedByAi: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface Memo {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: MemoStatus;
  historyReason: MemoHistoryReason | null;
  sortOrder: number;
  lastActiveSortOrder: number | null;
  autoArchiveSuppressedUntilChange: boolean;
  aiState: AiState;
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  historyAt: string | null;
  deletedAt: string | null;
  todos: MemoTodo[];
}

export interface DraftTodoInput {
  title: string;
  notes: string | null;
  generatedByAi: boolean;
}

export interface DraftInput {
  title?: string;
  content: string;
}

export interface PublishMemoInput {
  draftId?: string;
  title: string;
  content: string;
  todos: DraftTodoInput[];
}

export interface AiSettingsView {
  baseUrl: string;
  model: string;
  apiKeyMask: string | null;
  promptTemplate: string;
  updatedAt: string;
}

export interface SyncStatusView {
  ok: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface AnalyzeDraftResult {
  title: string;
  todos: Array<{
    title: string;
    notes: string | null;
  }>;
}

export interface AuthUserView {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}
