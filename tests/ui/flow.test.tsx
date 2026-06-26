import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";
import type { Memo } from "../../src/types";

describe("MemoTask frontend memo flow", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("publishes a pure memo with manual todos and auto archives when all todos are done", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "研究 PWA 能不能覆盖手机和 PC");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "确认手机端安装体验");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.type(screen.getByLabelText("新增 Todo"), "整理 PC 端布局");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    expect(screen.getByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "研究 PWA 能不能覆盖手机和 PC" })).toBeInTheDocument();
    expect(screen.getByText("确认手机端安装体验")).toBeInTheDocument();
    expect(screen.getByText("整理 PC 端布局")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "确认手机端安装体验" }));
    expect(screen.getByRole("heading", { name: "研究 PWA 能不能覆盖手机和 PC" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "整理 PC 端布局" }));
    expect(await screen.findByText("还没有 Memo")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "研究 PWA 能不能覆盖手机和 PC" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));
    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "研究 PWA 能不能覆盖手机和 PC" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "恢复 研究 PWA 能不能覆盖手机和 PC" }));
    expect(screen.getByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "研究 PWA 能不能覆盖手机和 PC" })).toBeInTheDocument();
  });

  it("keeps completed todo text in place without strikethrough", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "设计图检查");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "确认完成态没有删除线");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByRole("heading", { name: "设计图检查" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "确认完成态没有删除线" }));

    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));
    expect(await screen.findByRole("heading", { name: "设计图检查" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "恢复 设计图检查" }));
    const completedTodo = await screen.findByText("确认完成态没有删除线");

    expect(completedTodo.closest("li")).toHaveClass("is-done");
    expect(completedTodo.closest("li")).toHaveStyle({ textDecoration: "none" });
  });

  it("checks a todo immediately even when the server is slow", async () => {
    const memo = createMemo("memo-slow", "慢网络 Memo", [
      createTodo("todo-slow", "马上显示勾选", "memo-slow"),
      createTodo("todo-other", "另一条 Todo", "memo-slow")
    ]);
    const requestedUrls: string[] = [];
    render(
      <App
        client={createUiTestClient({
          delayMs: 2500,
          onRequest: (url) => requestedUrls.push(url),
          initialMemos: [memo]
        })}
      />
    );

    expect(await screen.findByRole("heading", { name: "慢网络 Memo" }, { timeout: 4_000 })).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: "马上显示勾选" });

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole("heading", { name: "慢网络 Memo" })).toBeInTheDocument();
    expect(requestedUrls.filter((url) => url.includes("/api/todos/todo-slow/toggle"))).toHaveLength(1);
  });

  it("shows how many todos remain hidden on memo cards", async () => {
    window.history.pushState({}, "", "/memos");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [
            createMemo("memo-more-todos", "多 Todo Memo", [
              createTodo("todo-one", "第一条", "memo-more-todos"),
              createTodo("todo-two", "第二条", "memo-more-todos"),
              createTodo("todo-three", "第三条", "memo-more-todos"),
              createTodo("todo-four", "第四条", "memo-more-todos")
            ])
          ]
        })}
      />
    );

    expect(await screen.findByText("多 Todo Memo")).toBeInTheDocument();
    expect(screen.getByText("第一条")).toBeInTheDocument();
    expect(screen.getByText("第二条")).toBeInTheDocument();
    expect(screen.getByText("第三条")).toBeInTheDocument();
    expect(screen.queryByText("第四条")).not.toBeInTheDocument();
    expect(screen.getByText("还有 1 个 Todo")).toBeInTheDocument();
  });

  it("shows publish feedback immediately even when the server is slow", async () => {
    render(<App client={createUiTestClient({ delayMs: 2500 })} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "慢网络发布");

    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(screen.getByText("发布中")).toBeInTheDocument();
  });

  it("shows the newly published memo before the follow-up list refresh completes", async () => {
    render(
      <App
        client={createUiTestClient({
          delayForUrl: (url) => (url.includes("/api/memos") && !url.includes("/publish") ? 3000 : 0)
        })}
      />
    );
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "发布后应该立即显示正文");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "发布后应该立即显示正文" }, { timeout: 800 })).toBeInTheDocument();
  });
});

function createMemo(id: string, title: string, todos: Memo["todos"]): Memo {
  return {
    id,
    userId: "default",
    title,
    content: "用于验证慢网络下的操作反馈。",
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
    createdAt: "2026-06-23T08:45:00.000Z",
    updatedAt: "2026-06-23T08:45:00.000Z",
    completedAt: null,
    deletedAt: null
  };
}
