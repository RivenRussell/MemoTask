import { describe, expect, it } from "vitest";
import type { Memo } from "../src/types";
import {
  addMemoTextTag,
  collectMemoTags,
  filterMemosByQuery,
  getQuickRecordShortcut,
  isPullRefreshGesture,
  didRefreshComplete,
  isBusyInScope,
  moveIdByDelta,
  removeMemoTextTag,
  replaceOrRemoveMemoFromActiveList,
  toggleTodoInMemoList,
  upsertHistoryMemo
} from "../src/ui-helpers";

function memo(overrides: Partial<Memo>): Memo {
  return {
    id: overrides.id ?? "memo-1",
    userId: "user-1",
    title: overrides.title ?? "开发网络嗅探工具",
    content: overrides.content ?? "我想做一个网络嗅探工具。#project",
    status: overrides.status ?? "active",
    historyReason: overrides.historyReason ?? null,
    sortOrder: overrides.sortOrder ?? 1,
    lastActiveSortOrder: overrides.lastActiveSortOrder ?? null,
    autoArchiveSuppressedUntilChange: overrides.autoArchiveSuppressedUntilChange ?? false,
    aiState: overrides.aiState ?? "idle",
    aiError: overrides.aiError ?? null,
    aiResult: overrides.aiResult ?? null,
    createdAt: overrides.createdAt ?? "2026-06-28T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-28T00:00:00.000Z",
    publishedAt: overrides.publishedAt ?? "2026-06-28T00:00:00.000Z",
    historyAt: overrides.historyAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    tags: overrides.tags ?? ["project"],
    todos: overrides.todos ?? []
  };
}

describe("UI helper contract behavior", () => {
  it("adds tags by writing #tag text into memo content instead of creating a local tag field", () => {
    const result = addMemoTextTag({ title: "部署计划 #Deploy", content: "整理 Cloudflare 部署" }, "cloudflare");

    expect(result.title).toBe("部署计划 #Deploy");
    expect(result.content).toBe("整理 Cloudflare 部署 #cloudflare");
    expect(addMemoTextTag(result, "deploy")).toEqual(result);
    expect(addMemoTextTag(result, "#release").content).toBe("整理 Cloudflare 部署 #cloudflare #release");
  });

  it("removes matching tag tokens from title and content by normalized name", () => {
    const result = removeMemoTextTag(
      { title: "部署计划 #Deploy", content: "整理 #cloudflare 部署\n补充 #deploy 步骤" },
      "deploy"
    );

    expect(result.title).toBe("部署计划");
    expect(result.content).toBe("整理 #cloudflare 部署\n补充 步骤");
  });

  it("filters the active memo queue locally across title, content, tags, todos, and notes", () => {
    const memos = [
      memo({ id: "memo-1", title: "开发网络嗅探工具", tags: ["project"] }),
      memo({
        id: "memo-2",
        title: "开一家汉堡店",
        content: "选址和菜单 #ideas",
        tags: ["ideas"],
        todos: [{ id: "todo-1", memoId: "memo-2", title: "准备设备", notes: "冷链清单", status: "todo", sortOrder: 1, generatedByAi: true, createdAt: "", updatedAt: "", completedAt: null, deletedAt: null }]
      })
    ];

    expect(filterMemosByQuery(memos, "冷链").map((item) => item.id)).toEqual(["memo-2"]);
    expect(filterMemosByQuery(memos, "project").map((item) => item.id)).toEqual(["memo-1"]);
    expect(filterMemosByQuery(memos, "  ").map((item) => item.id)).toEqual(["memo-1", "memo-2"]);
  });

  it("builds the sidebar tag list from API tags plus visible memo tags", () => {
    const memos = [
      memo({ id: "memo-1", title: "创建自媒体账号", content: "我想去创建一个自媒体账号 #牛马", tags: ["牛马"] }),
      memo({ id: "memo-2", title: "PWA跨平台研究与开发 #Tech", tags: [] })
    ];

    const tags = collectMemoTags(["work"], memos);

    expect(tags).toEqual(expect.arrayContaining(["Tech", "work", "牛马"]));
    expect(tags).toHaveLength(3);
  });

  it("toggles a todo inside the local memo list for immediate feedback", () => {
    const memos = [
      memo({
        id: "memo-1",
        todos: [{ id: "todo-1", memoId: "memo-1", title: "选择并确定自媒体平台", notes: null, status: "todo", sortOrder: 1, generatedByAi: false, createdAt: "", updatedAt: "", completedAt: null, deletedAt: null }]
      })
    ];

    const toggled = toggleTodoInMemoList(memos, "todo-1", "2026-06-28T08:00:00.000Z");

    expect(toggled[0].todos[0].status).toBe("done");
    expect(toggled[0].todos[0].completedAt).toBe("2026-06-28T08:00:00.000Z");
    expect(memos[0].todos[0].status).toBe("todo");
  });

  it("removes a memo from the active list when the server returns it as history", () => {
    const activeMemo = memo({ id: "memo-1", title: "PWA跨平台研究与开发" });
    const archivedMemo = memo({
      ...activeMemo,
      status: "history",
      historyReason: "completed",
      historyAt: "2026-06-28T08:00:00.000Z"
    });

    expect(replaceOrRemoveMemoFromActiveList([activeMemo], archivedMemo)).toEqual([]);
  });

  it("upserts a completed memo into the history list without duplicating it", () => {
    const older = memo({ id: "memo-2", title: "旧历史", status: "history", historyReason: "archived", historyAt: "2026-06-27T08:00:00.000Z" });
    const completed = memo({ id: "memo-1", title: "完成历史", status: "history", historyReason: "completed", historyAt: "2026-06-28T08:00:00.000Z" });

    const first = upsertHistoryMemo([older], completed);
    const second = upsertHistoryMemo(first, { ...completed, title: "完成历史更新" });

    expect(first.map((item) => item.id)).toEqual(["memo-1", "memo-2"]);
    expect(second.map((item) => item.title)).toEqual(["完成历史更新", "旧历史"]);
  });

  it("moves memo ids by one step for lightweight reorder controls", () => {
    const ids = ["a", "b", "c"];

    expect(moveIdByDelta(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveIdByDelta(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveIdByDelta(ids, "a", -1)).toBe(ids);
  });

  it("classifies quick record keyboard shortcuts without hijacking plain typing", () => {
    expect(getQuickRecordShortcut({ key: "k", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("focus");
    expect(getQuickRecordShortcut({ key: "K", ctrlKey: false, metaKey: true, shiftKey: false })).toBe("focus");
    expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: true, metaKey: false, shiftKey: false })).toBe("publish");
    expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: true, shiftKey: false })).toBe("publish");
    expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: true, metaKey: false, shiftKey: true })).toBe("analyze");
    expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: true, shiftKey: true })).toBe("analyze");
    expect(getQuickRecordShortcut({ key: "Enter", ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
    expect(getQuickRecordShortcut({ key: "k", ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
    expect(getQuickRecordShortcut({ key: "x", ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
  });

  it("recognizes only deliberate downward pull gestures for mobile refresh", () => {
    expect(isPullRefreshGesture({ startX: 120, startY: 16, currentX: 126, currentY: 96 })).toBe(true);
    expect(isPullRefreshGesture({ startX: 120, startY: 16, currentX: 126, currentY: 70 })).toBe(false);
    expect(isPullRefreshGesture({ startX: 120, startY: 90, currentX: 124, currentY: 16 })).toBe(false);
    expect(isPullRefreshGesture({ startX: 120, startY: 16, currentX: 230, currentY: 96 })).toBe(false);
  });

  it("shows refresh success only when every refresh source completed", () => {
    expect(didRefreshComplete([true, true, true])).toBe(true);
    expect(didRefreshComplete([true, false, true])).toBe(false);
    expect(didRefreshComplete([])).toBe(false);
  });

  it("matches busy labels by exact operation or scoped prefix", () => {
    expect(isBusyInScope("publish", ["publish", "analyze"])).toBe(true);
    expect(isBusyInScope("save-memo-1", ["save-"])).toBe(true);
    expect(isBusyInScope("todo-save-1", ["todo-save-", "todo-delete-"])).toBe(true);
    expect(isBusyInScope("settings", ["publish", "analyze"])).toBe(false);
    expect(isBusyInScope("", ["publish"])).toBe(false);
  });
});
