import { describe, expect, it } from "vitest";
import {
  moveMemoToHistory,
  restoreMemoFromHistory,
  shouldAutoArchiveMemo,
  toggleTodoStatus
} from "../worker/domain/state-machines";
import type { Memo, MemoTodo } from "../worker/domain/types";

const now = "2026-06-22T12:00:00.000Z";

function memo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: "memo-1",
    userId: "default",
    title: "研究 PWA",
    content: "确认 PWA 是否覆盖手机和 PC",
    status: "active",
    historyReason: null,
    sortOrder: 10,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    aiResult: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    publishedAt: "2026-06-22T10:00:00.000Z",
    historyAt: null,
    deletedAt: null,
    tags: [],
    todos: [],
    ...overrides
  };
}

function todo(overrides: Partial<MemoTodo> = {}): MemoTodo {
  return {
    id: "todo-1",
    memoId: "memo-1",
    title: "调研 PWA",
    notes: null,
    status: "todo",
    sortOrder: 10,
    generatedByAi: false,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    ...overrides
  };
}

describe("MemoTask state machines", () => {
  it("does not auto archive a memo without todos", () => {
    expect(shouldAutoArchiveMemo([], false)).toBe(false);
  });

  it("auto archives only when every non-deleted todo is done and suppression is off", () => {
    expect(shouldAutoArchiveMemo([todo({ status: "done" }), todo({ status: "done" })], false)).toBe(true);
    expect(shouldAutoArchiveMemo([todo({ status: "done" }), todo()], false)).toBe(false);
    expect(shouldAutoArchiveMemo([todo({ status: "done" })], true)).toBe(false);
  });

  it("toggles todo status in place without changing sort order", () => {
    const first = todo({ sortOrder: 22 });
    const done = toggleTodoStatus(first, now);
    const reopened = toggleTodoStatus(done, "2026-06-22T13:00:00.000Z");

    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(now);
    expect(done.sortOrder).toBe(22);
    expect(reopened.status).toBe("todo");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.sortOrder).toBe(22);
  });

  it("moves active memo to history while remembering its active order", () => {
    const archived = moveMemoToHistory(memo({ sortOrder: 7 }), "archived", now);

    expect(archived.status).toBe("history");
    expect(archived.historyReason).toBe("archived");
    expect(archived.lastActiveSortOrder).toBe(7);
    expect(archived.historyAt).toBe(now);
  });

  it("restores history memo to active and suppresses immediate auto archive", () => {
    const restored = restoreMemoFromHistory(
      memo({ status: "history", sortOrder: 99, lastActiveSortOrder: 4, historyReason: "completed", historyAt: now }),
      "2026-06-22T13:00:00.000Z"
    );

    expect(restored.status).toBe("active");
    expect(restored.sortOrder).toBe(4);
    expect(restored.historyReason).toBeNull();
    expect(restored.historyAt).toBeNull();
    expect(restored.autoArchiveSuppressedUntilChange).toBe(true);
  });
});
