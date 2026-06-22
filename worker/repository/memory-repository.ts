import type { Memo, MemoTodo } from "../domain/types";
import type { DraftInput, MemoRepository, PublishMemoInput } from "./types";

let idCounter = 0;

function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function cloneMemo(memo: Memo): Memo {
  return {
    ...memo,
    todos: memo.todos.map((todo) => ({ ...todo }))
  };
}

export class MemoryRepository implements MemoRepository {
  private memos: Memo[] = [];

  async createDraft(input: DraftInput, now: string): Promise<Memo> {
    const draft: Memo = {
      id: createId("memo"),
      userId: "default",
      title: input.title?.trim() || "未命名 Memo",
      content: input.content,
      status: "draft",
      historyReason: null,
      sortOrder: Date.parse(now),
      lastActiveSortOrder: null,
      autoArchiveSuppressedUntilChange: false,
      aiState: "idle",
      aiError: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      historyAt: null,
      deletedAt: null,
      todos: []
    };

    this.memos.push(draft);
    this.trimDrafts(3);
    return cloneMemo(draft);
  }

  async listRecentDrafts(limit: number): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.status === "draft" && memo.deletedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
      .slice(0, limit)
      .map(cloneMemo);
  }

  async publishMemo(input: PublishMemoInput, now: string): Promise<Memo> {
    const memo = input.draftId ? this.memos.find((candidate) => candidate.id === input.draftId) : undefined;
    const nextSortOrder = this.nextFrontSortOrder();
    const todos = input.todos.map((todo, index): MemoTodo => {
      const memoId = memo?.id ?? "pending";
      return {
        id: createId("todo"),
        memoId,
        title: todo.title.trim(),
        notes: todo.notes?.trim() || null,
        status: "todo",
        sortOrder: index + 1,
        generatedByAi: Boolean(todo.generatedByAi),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null
      };
    });

    if (memo) {
      Object.assign(memo, {
        title: input.title.trim(),
        content: input.content,
        status: "active",
        sortOrder: nextSortOrder,
        updatedAt: now,
        publishedAt: now,
        todos: todos.map((todo) => ({ ...todo, memoId: memo.id }))
      });
      return cloneMemo(memo);
    }

    const published: Memo = {
      id: createId("memo"),
      userId: "default",
      title: input.title.trim(),
      content: input.content,
      status: "active",
      historyReason: null,
      sortOrder: nextSortOrder,
      lastActiveSortOrder: null,
      autoArchiveSuppressedUntilChange: false,
      aiState: "idle",
      aiError: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      historyAt: null,
      deletedAt: null,
      todos: []
    };
    published.todos = todos.map((todo) => ({ ...todo, memoId: published.id }));
    this.memos.push(published);
    return cloneMemo(published);
  }

  async listActiveMemos(): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.status === "active" && memo.deletedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(cloneMemo);
  }

  async listHistoryMemos(): Promise<Memo[]> {
    return this.memos
      .filter((memo) => memo.status === "history" && memo.deletedAt === null)
      .sort((a, b) => (b.historyAt ?? "").localeCompare(a.historyAt ?? ""))
      .map(cloneMemo);
  }

  async findTodo(todoId: string): Promise<MemoTodo | null> {
    const todo = this.memos.flatMap((memo) => memo.todos).find((candidate) => candidate.id === todoId);
    return todo ? { ...todo } : null;
  }

  async updateTodo(todo: MemoTodo): Promise<MemoTodo> {
    for (const memo of this.memos) {
      const index = memo.todos.findIndex((candidate) => candidate.id === todo.id);
      if (index >= 0) {
        memo.todos[index] = { ...todo };
        memo.updatedAt = todo.updatedAt;
        return { ...todo };
      }
    }

    throw new Error("Todo not found");
  }

  async findMemo(memoId: string): Promise<Memo | null> {
    const memo = this.memos.find((candidate) => candidate.id === memoId);
    return memo ? cloneMemo(memo) : null;
  }

  async saveMemo(memo: Memo): Promise<Memo> {
    const index = this.memos.findIndex((candidate) => candidate.id === memo.id);
    if (index < 0) {
      this.memos.push(cloneMemo(memo));
    } else {
      this.memos[index] = cloneMemo(memo);
    }
    return cloneMemo(memo);
  }

  private nextFrontSortOrder(): number {
    const activeOrders = this.memos.filter((memo) => memo.status === "active").map((memo) => memo.sortOrder);
    return activeOrders.length === 0 ? 1000 : Math.min(...activeOrders) - 1;
  }

  private trimDrafts(limit: number): void {
    const drafts = this.memos
      .filter((memo) => memo.status === "draft")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    const keepIds = new Set(drafts.slice(0, limit).map((memo) => memo.id));
    this.memos = this.memos.filter((memo) => memo.status !== "draft" || keepIds.has(memo.id));
  }
}
