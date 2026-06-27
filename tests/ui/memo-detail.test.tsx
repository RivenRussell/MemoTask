import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";
import type { Memo } from "../../src/types";

describe("MemoTask memo detail workflow", () => {
  it("edits a memo, manages todos, and manually archives it to History", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "整理上线前检查");
    await userEvent.type(screen.getByLabelText("Memo 标题"), "上线检查");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "检查 Worker 健康");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("上线检查")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开 上线检查" }));
    expect(screen.getByRole("heading", { name: "Memo 详情" })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("详情标题"));
    await userEvent.type(screen.getByLabelText("详情标题"), "上线前检查");
    await userEvent.clear(screen.getByLabelText("详情原文"));
    await userEvent.type(screen.getByLabelText("详情原文"), "确认 Cloudflare 部署和访问控制");
    await userEvent.click(screen.getByRole("button", { name: "保存 Memo" }));
    expect(await screen.findByText("Memo 已保存")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("详情新增 Todo"), "确认 Access 规则");
    await userEvent.click(screen.getByRole("button", { name: "新增 Todo" }));
    expect(await screen.findByDisplayValue("确认 Access 规则")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("详情新增 Todo"), "保留未完成项");
    await userEvent.click(screen.getByRole("button", { name: "新增 Todo" }));
    expect(await screen.findByDisplayValue("保留未完成项")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("编辑 确认 Access 规则"));
    await userEvent.type(screen.getByLabelText("编辑 确认 Access 规则"), "确认 Access 保护");
    await userEvent.tab();
    expect(await screen.findByDisplayValue("确认 Access 保护")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "删除 检查 Worker 健康" }));
    expect(screen.queryByText("检查 Worker 健康")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "确认 Access 保护" }));
    expect(screen.getByDisplayValue("确认 Access 保护").closest("li")).toHaveClass("is-done");

    await userEvent.click(screen.getByRole("button", { name: "手动归档" }));
    expect(await screen.findByText("上线前检查")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
  });

  it("shows detail todo changes immediately even when the server is slow", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          delayMs: 2500,
          initialMemos: [
            createMemo("memo-detail-slow", "慢详情 Memo", [
              createTodo("todo-delete-slow", "马上消失", "memo-detail-slow")
            ])
          ]
        })}
      />
    );

    expect(await screen.findByText("慢详情 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 慢详情 Memo" }));
    expect(await screen.findByDisplayValue("马上消失", undefined, { timeout: 4_000 })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("详情新增 Todo"), "马上出现");
    await userEvent.click(screen.getByRole("button", { name: "新增 Todo" }));
    expect(screen.getByDisplayValue("马上出现")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "删除 马上消失" }));
    expect(screen.queryByDisplayValue("马上消失")).not.toBeInTheDocument();
  });

  it("shows memo save feedback immediately even when the server is slow", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          delayMs: 2500,
          initialMemos: [createMemo("memo-save-slow", "慢保存 Memo", [])]
        })}
      />
    );

    expect(await screen.findByText("慢保存 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 慢保存 Memo" }));
    expect(await screen.findByDisplayValue("慢保存 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("详情标题"));
    await userEvent.type(screen.getByLabelText("详情标题"), "慢保存 Memo 已改");

    await userEvent.click(screen.getByRole("button", { name: "保存 Memo" }));
    expect(screen.getByText("Memo 保存中")).toBeInTheDocument();
  });

  it("shows archive feedback immediately even when the server is slow", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          delayMs: 2500,
          initialMemos: [createMemo("memo-archive-slow", "慢归档 Memo", [])]
        })}
      />
    );

    expect(await screen.findByText("慢归档 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 慢归档 Memo" }));
    expect(await screen.findByDisplayValue("慢归档 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "手动归档" }));
    expect(screen.getByText("归档中")).toBeInTheDocument();
  });

  it("places memo title and content before the detail todo list", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [createMemo("memo-detail-order", "先看标题内容", [createTodo("todo-detail-order", "再看 Todo", "memo-detail-order")])]
        })}
      />
    );

    expect(await screen.findByText("先看标题内容")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 先看标题内容" }));

    const memoSection = screen.getByLabelText("详情标题").closest("section");
    const todoSection = screen.getByRole("heading", { name: "Todo 管理" }).closest("section");

    expect(memoSection).not.toBeNull();
    expect(todoSection).not.toBeNull();
    expect(memoSection?.compareDocumentPosition(todoSection as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("uses multiline controls for detail todo titles so long todos remain readable", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [
            createMemo("memo-detail-long-todo", "长 Todo Memo", [
              createTodo(
                "todo-detail-long",
                "这是一条很长的 Todo，需要在详情页完整显示而不是被单行输入框裁切",
                "memo-detail-long-todo"
              )
            ])
          ]
        })}
      />
    );

    expect(await screen.findByText("长 Todo Memo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 长 Todo Memo" }));

    expect(screen.getByLabelText("编辑 这是一条很长的 Todo，需要在详情页完整显示而不是被单行输入框裁切").tagName).toBe("TEXTAREA");
  });

  it("shows a Markdown preview beside the editable memo content", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [createMemo("memo-detail-markdown", "Markdown 详情", [])]
        })}
      />
    );

    expect(await screen.findByText("Markdown 详情")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 Markdown 详情" }));
    const contentInput = screen.getByLabelText("详情原文");
    await userEvent.clear(contentInput);
    fireEvent.change(contentInput, { target: { value: "## 详情预览\n\n- [x] 可读" } });

    const preview = screen.getByLabelText("Markdown 预览");
    expect(within(preview).getByRole("heading", { name: "详情预览" })).toBeInTheDocument();
    expect(within(preview).getByRole("checkbox", { name: "可读" })).toBeChecked();
  });

  it("saves linked Markdown task edits back to the structured detail Todo", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [
            {
              ...createMemo("memo-linked-markdown-save", "Markdown 同步", [
                createTodo("todo-linked-markdown-save", "旧标题", "memo-linked-markdown-save")
              ]),
              content: "- [ ] 旧标题 <!-- memotask:todo=todo-linked-markdown-save -->"
            }
          ]
        })}
      />
    );

    expect(await screen.findByText("Markdown 同步")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 Markdown 同步" }));
    const contentInput = screen.getByLabelText("详情原文");
    await userEvent.clear(contentInput);
    fireEvent.change(contentInput, {
      target: { value: "- [x] 新标题 <!-- memotask:todo=todo-linked-markdown-save -->\n- [x] 未绑定 checkbox" }
    });
    await userEvent.click(screen.getByRole("button", { name: "保存 Memo" }));

    expect(await screen.findByDisplayValue("新标题")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Markdown 预览")).getByRole("checkbox", { name: "新标题" })).toBeChecked();
  });

  it("reflects structured Todo toggles in linked Markdown preview checkboxes", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [
            {
              ...createMemo("memo-linked-markdown-toggle", "Markdown 勾选同步", [
                createTodo("todo-linked-markdown-toggle", "发布说明", "memo-linked-markdown-toggle")
              ]),
              content: "- [ ] 发布说明 <!-- memotask:todo=todo-linked-markdown-toggle -->"
            }
          ]
        })}
      />
    );

    expect(await screen.findByText("Markdown 勾选同步")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开 Markdown 勾选同步" }));

    const preview = screen.getByLabelText("Markdown 预览");
    expect(within(preview).getByRole("checkbox", { name: "发布说明" })).not.toBeChecked();
    await userEvent.click(within(screen.getByRole("heading", { name: "Todo 管理" }).closest("section") as HTMLElement).getByRole("checkbox", { name: "发布说明" }));

    await waitFor(() => {
      expect(within(preview).getByRole("checkbox", { name: "发布说明" })).toBeChecked();
    });
  });
});

function createMemo(id: string, title: string, todos: Memo["todos"]): Memo {
  return {
    id,
    userId: "default",
    title,
    content: "用于验证慢网络下详情页操作反馈。",
    status: "active",
    historyReason: null,
    sortOrder: 1,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    createdAt: "2026-06-23T08:55:00.000Z",
    updatedAt: "2026-06-23T08:55:00.000Z",
    publishedAt: "2026-06-23T08:55:00.000Z",
    historyAt: null,
    deletedAt: null,
    todos
  };
}

function createTodo(id: string, title: string, memoId: string): Memo["todos"][number] {
  return {
    id,
    memoId,
    title,
    notes: null,
    status: "todo",
    sortOrder: 1,
    generatedByAi: false,
    createdAt: "2026-06-23T08:55:00.000Z",
    updatedAt: "2026-06-23T08:55:00.000Z",
    completedAt: null,
    deletedAt: null
  };
}
