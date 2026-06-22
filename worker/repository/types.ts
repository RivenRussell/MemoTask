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

export interface MemoRepository {
  createDraft(input: DraftInput, now: string): Promise<Memo>;
  listRecentDrafts(limit: number): Promise<Memo[]>;
  publishMemo(input: PublishMemoInput, now: string): Promise<Memo>;
  listActiveMemos(): Promise<Memo[]>;
  listHistoryMemos(): Promise<Memo[]>;
  findTodo(todoId: string): Promise<MemoTodo | null>;
  updateTodo(todo: MemoTodo): Promise<MemoTodo>;
  findMemo(memoId: string): Promise<Memo | null>;
  saveMemo(memo: Memo): Promise<Memo>;
}
