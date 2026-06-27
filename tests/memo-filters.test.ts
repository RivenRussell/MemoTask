import { describe, expect, it } from "vitest";
import { collectMemoTags, filterMemos } from "../src/shared/memo-filters";
import type { Memo } from "../src/types";

describe("memo filters", () => {
  it("collects unique content tags in display order", () => {
    const memos = [
      createMemo("one", "发布计划 #work", "整理 #design 和 #work"),
      createMemo("two", "生活记录", "周末买菜 #life")
    ];

    expect(collectMemoTags(memos)).toEqual(["work", "design", "life"]);
  });

  it("filters by selected tag and searches titles content and todo titles", () => {
    const memos = [
      createMemo("work", "发布计划 #work", "整理发版说明", ["检查部署"]),
      createMemo("life", "周末记录", "买咖啡 #life", ["预约牙医"])
    ];

    expect(filterMemos(memos, { selectedTag: "work", query: "" }).map((memo) => memo.id)).toEqual(["work"]);
    expect(filterMemos(memos, { selectedTag: null, query: "牙医" }).map((memo) => memo.id)).toEqual(["life"]);
    expect(filterMemos(memos, { selectedTag: "life", query: "部署" })).toEqual([]);
  });
});

function createMemo(id: string, title: string, content: string, todoTitles: string[] = []): Memo {
  return {
    id,
    userId: "default",
    title,
    content,
    status: "active",
    historyReason: null,
    sortOrder: 1,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    createdAt: "2026-06-23T08:45:00.000Z",
    updatedAt: "2026-06-23T08:45:00.000Z",
    publishedAt: "2026-06-23T08:45:00.000Z",
    historyAt: null,
    deletedAt: null,
    todos: todoTitles.map((todoTitle, index) => ({
      id: `${id}-todo-${index}`,
      memoId: id,
      title: todoTitle,
      notes: null,
      status: "todo",
      sortOrder: index + 1,
      generatedByAi: false,
      createdAt: "2026-06-23T08:45:00.000Z",
      updatedAt: "2026-06-23T08:45:00.000Z",
      completedAt: null,
      deletedAt: null
    }))
  };
}
