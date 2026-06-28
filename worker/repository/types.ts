import type { Memo, MemoTodo } from "../domain/types";

export interface DraftInput {
  title?: string;
  content: string;
  tags?: string[];
}

export interface PublishMemoInput {
  title: string;
  content: string;
  tags?: string[];
  draftId?: string;
  todos: Array<{
    title: string;
    notes?: string | null;
    generatedByAi?: boolean;
  }>;
}

export interface AiSettings {
  id: string;
  userId: string;
  baseUrl: string;
  model: string;
  encryptedApiKey: string | null;
  apiKeyMask: string | null;
  promptTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiSettingsInput {
  baseUrl: string;
  model: string;
  encryptedApiKey?: string;
  apiKeyMask?: string;
  promptTemplate: string;
}

export interface SyncStatus {
  ok: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface MemoRepository {
  createDraft(userId: string, input: DraftInput, now: string): Promise<Memo>;
  updateDraft(userId: string, draftId: string, input: DraftInput, now: string): Promise<Memo | null>;
  listRecentDrafts(userId: string, limit: number): Promise<Memo[]>;
  publishMemo(userId: string, input: PublishMemoInput, now: string): Promise<Memo>;
  listActiveMemos(userId: string, tag?: string): Promise<Memo[]>;
  listHistoryMemos(userId: string): Promise<Memo[]>;
  searchHistoryMemos(userId: string, query: string, tag?: string): Promise<Memo[]>;
  listTags(userId: string): Promise<string[]>;
  findTodo(userId: string, todoId: string): Promise<MemoTodo | null>;
  updateTodo(userId: string, todo: MemoTodo): Promise<MemoTodo>;
  createTodo(userId: string, memoId: string, input: { title: string; notes?: string | null; generatedByAi?: boolean }, now: string): Promise<MemoTodo>;
  deleteTodo(userId: string, todoId: string, now: string): Promise<MemoTodo | null>;
  reorderTodos(userId: string, memoId: string, todoIds: string[], now: string): Promise<MemoTodo[]>;
  findMemo(userId: string, memoId: string): Promise<Memo | null>;
  saveMemo(userId: string, memo: Memo): Promise<Memo>;
  reorderMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]>;
  softDeleteHistoryMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]>;
  restoreDeletedMemos(userId: string, memoIds: string[], now: string): Promise<Memo[]>;
  listExportableMemos(userId: string): Promise<Memo[]>;
  getAiSettings(userId: string, now: string): Promise<AiSettings>;
  saveAiSettings(userId: string, input: AiSettingsInput, now: string): Promise<AiSettings>;
  resetAiPrompt(userId: string, promptTemplate: string, now: string): Promise<AiSettings>;
  getSyncStatus(userId: string, now: string): Promise<SyncStatus>;
  markSyncSuccess(userId: string, now: string): Promise<SyncStatus>;
}
