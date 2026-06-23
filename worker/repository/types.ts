import type { Memo, MemoTodo } from "../domain/types";

export interface DraftInput {
  title?: string;
  content: string;
}

export interface PublishMemoInput {
  title: string;
  content: string;
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
  createDraft(input: DraftInput, now: string): Promise<Memo>;
  updateDraft(draftId: string, input: DraftInput, now: string): Promise<Memo | null>;
  listRecentDrafts(limit: number): Promise<Memo[]>;
  publishMemo(input: PublishMemoInput, now: string): Promise<Memo>;
  listActiveMemos(): Promise<Memo[]>;
  listHistoryMemos(): Promise<Memo[]>;
  searchHistoryMemos(query: string): Promise<Memo[]>;
  findTodo(todoId: string): Promise<MemoTodo | null>;
  updateTodo(todo: MemoTodo): Promise<MemoTodo>;
  createTodo(memoId: string, input: { title: string; notes?: string | null; generatedByAi?: boolean }, now: string): Promise<MemoTodo>;
  deleteTodo(todoId: string, now: string): Promise<MemoTodo | null>;
  reorderTodos(memoId: string, todoIds: string[], now: string): Promise<MemoTodo[]>;
  findMemo(memoId: string): Promise<Memo | null>;
  saveMemo(memo: Memo): Promise<Memo>;
  reorderMemos(memoIds: string[], now: string): Promise<Memo[]>;
  softDeleteHistoryMemos(memoIds: string[], now: string): Promise<Memo[]>;
  restoreDeletedMemos(memoIds: string[], now: string): Promise<Memo[]>;
  listExportableMemos(): Promise<Memo[]>;
  getAiSettings(now: string): Promise<AiSettings>;
  saveAiSettings(input: AiSettingsInput, now: string): Promise<AiSettings>;
  resetAiPrompt(promptTemplate: string, now: string): Promise<AiSettings>;
  getSyncStatus(now: string): Promise<SyncStatus>;
}
