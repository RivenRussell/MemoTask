import type { Memo, MemoHistoryReason, MemoTodo } from "./types";

export function shouldAutoArchiveMemo(todos: MemoTodo[], suppressUntilChange: boolean): boolean {
  if (suppressUntilChange) {
    return false;
  }

  const visibleTodos = todos.filter((todo) => todo.deletedAt === null);
  return visibleTodos.length > 0 && visibleTodos.every((todo) => todo.status === "done");
}

export function toggleTodoStatus(todo: MemoTodo, now: string): MemoTodo {
  if (todo.status === "todo") {
    return {
      ...todo,
      status: "done",
      completedAt: now,
      updatedAt: now
    };
  }

  return {
    ...todo,
    status: "todo",
    completedAt: null,
    updatedAt: now
  };
}

export function moveMemoToHistory(memo: Memo, reason: MemoHistoryReason, now: string): Memo {
  return {
    ...memo,
    status: "history",
    historyReason: reason,
    lastActiveSortOrder: memo.sortOrder,
    historyAt: now,
    updatedAt: now
  };
}

export function restoreMemoFromHistory(memo: Memo, now: string): Memo {
  return {
    ...memo,
    status: "active",
    historyReason: null,
    sortOrder: memo.lastActiveSortOrder ?? memo.sortOrder,
    autoArchiveSuppressedUntilChange: true,
    historyAt: null,
    updatedAt: now
  };
}
