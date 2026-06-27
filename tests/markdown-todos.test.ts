import { describe, expect, it } from "vitest";
import {
  collectLinkedMarkdownTasks,
  syncMarkdownCheckboxForTodo,
  syncMarkdownTaskTitleForTodo,
  syncTodosFromLinkedMarkdownTasks
} from "../src/shared/markdown-todos";
import type { MemoTodo } from "../src/types";

describe("linked Markdown todo helpers", () => {
  it("collects only task-list items with explicit MemoTask todo markers", () => {
    const content = [
      "- [ ] Content-only task",
      "- [x] Write release notes <!-- memotask:todo=todo-release -->",
      "1. [ ] Ordered follow-up <!-- memotask:todo=todo-follow-up -->"
    ].join("\n");

    expect(collectLinkedMarkdownTasks(content)).toEqual([
      { todoId: "todo-release", title: "Write release notes", status: "done" },
      { todoId: "todo-follow-up", title: "Ordered follow-up", status: "todo" }
    ]);
  });

  it("syncs a structured Todo status into its linked Markdown checkbox only", () => {
    const content = [
      "- [ ] Content-only task",
      "- [ ] Write release notes <!-- memotask:todo=todo-release -->",
      "- [x] Keep done <!-- memotask:todo=todo-other -->"
    ].join("\n");

    expect(syncMarkdownCheckboxForTodo(content, "todo-release", "done")).toBe(
      [
        "- [ ] Content-only task",
        "- [x] Write release notes <!-- memotask:todo=todo-release -->",
        "- [x] Keep done <!-- memotask:todo=todo-other -->"
      ].join("\n")
    );
  });

  it("syncs a structured Todo title into its linked Markdown task text", () => {
    const content = "1. [x] Old task title <!-- memotask:todo=todo-release -->";

    expect(syncMarkdownTaskTitleForTodo(content, "todo-release", "发布说明")).toBe(
      "1. [x] 发布说明 <!-- memotask:todo=todo-release -->"
    );
  });

  it("syncs linked Markdown task title and status back to structured Todos", () => {
    const now = "2026-06-27T15:30:00.000Z";
    const todos = [
      createTodo("todo-release", "Old title", "todo"),
      createTodo("todo-unlinked", "Keep me", "todo")
    ];
    const content = [
      "- [x] Write release notes <!-- memotask:todo=todo-release -->",
      "- [x] Content-only checkbox"
    ].join("\n");

    const result = syncTodosFromLinkedMarkdownTasks(todos, content, now);

    expect(result.changed).toBe(true);
    expect(result.titleChanged).toBe(true);
    expect(result.statusChanged).toBe(true);
    expect(result.todos[0]).toMatchObject({
      id: "todo-release",
      title: "Write release notes",
      status: "done",
      completedAt: now,
      updatedAt: now
    });
    expect(result.todos[1]).toEqual(todos[1]);
  });

  it("leaves structured Todos unchanged when Markdown checkboxes are unlinked", () => {
    const todos = [createTodo("todo-release", "Write release notes", "todo")];
    const content = "- [x] Write release notes";

    expect(syncTodosFromLinkedMarkdownTasks(todos, content, "2026-06-27T15:30:00.000Z")).toEqual({
      todos,
      changed: false,
      titleChanged: false,
      statusChanged: false
    });
  });
});

function createTodo(id: string, title: string, status: MemoTodo["status"]): MemoTodo {
  return {
    id,
    memoId: "memo-1",
    title,
    notes: null,
    status,
    sortOrder: 1,
    generatedByAi: false,
    createdAt: "2026-06-27T15:00:00.000Z",
    updatedAt: "2026-06-27T15:00:00.000Z",
    completedAt: status === "done" ? "2026-06-27T15:00:00.000Z" : null,
    deletedAt: null
  };
}
