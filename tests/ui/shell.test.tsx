import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";
import type { Memo } from "../../src/types";

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App client={createUiTestClient()} />);
}

describe("MemoTask app shell", () => {
  it("opens on the Memos page with Chinese product UI", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/memos");
    expect(document.querySelector(".app-rail")).not.toBeNull();
    expect(document.querySelector(".workspace-main")).not.toBeNull();
    expect(document.querySelector(".timeline-feed")).not.toBeNull();
    expect(document.querySelector(".utility-sidebar")).not.toBeNull();
    expect(document.querySelector(".memos-grid")).toBeNull();
    expect(screen.getByText("快速记录")).toBeInTheDocument();
    expect(screen.getByText("筛选")).toBeInTheDocument();
    expect(screen.getByText("标签")).toBeInTheDocument();
    expect(screen.getByText("还没有 Memo")).toBeInTheDocument();
    expect(document.querySelector(".empty-memo-card img")).toBeNull();
    expect(screen.queryByText("当前 Memo 队列")).not.toBeInTheDocument();
    expect(screen.queryByText("Memo 卡片预览")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("升级")).not.toBeInTheDocument();
  });

  it("keeps primary navigation limited to recording, queue, and settings", async () => {
    renderAt("/");

    const primaryNav = await findPrimaryNav();
    const links = within(primaryNav).getAllByRole("button");

    expect(links.map((link) => link.textContent)).toEqual(["记录", "队列", "设置"]);
    expect(within(primaryNav).queryByText("历史")).not.toBeInTheDocument();
  });

  it("opens history only from the queue page action", async () => {
    renderAt("/");

    const topbar = await screen.findByRole("banner");
    await userEvent.click(within(topbar).getByRole("button", { name: "打开历史" }));

    expect(await screen.findByRole("heading", { name: "历史" })).toBeInTheDocument();
    expect(screen.getByText("还没有历史 Memo")).toBeInTheDocument();
    expect(screen.queryByText("完整 Memo 历史")).not.toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "返回队列" })).toBeInTheDocument();
  });

  it("switches between recording, queue, and settings without showing forbidden features", async () => {
    renderAt("/");
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    expect(screen.getByRole("heading", { name: "记录" })).toBeInTheDocument();
    expect(screen.getByLabelText("原始 Memo")).toBeInTheDocument();
    expect(screen.queryByText("写下原始想法")).not.toBeInTheDocument();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("接口地址")).toHaveValue("");
    expect(screen.getByLabelText("接口地址")).toHaveAttribute("placeholder", "https://api.deepseek.com");
    expect(screen.getByLabelText("模型")).toHaveValue("");
    expect(screen.getByLabelText("模型")).toHaveAttribute("placeholder", "deepseek-v4-pro");

    expect(screen.queryByText("日期")).not.toBeInTheDocument();
    expect(screen.queryByText("提醒")).not.toBeInTheDocument();
    expect(screen.queryByText("订阅")).not.toBeInTheDocument();
  });

  it("shows navigation feedback immediately even when page data is slow", async () => {
    const requestedUrls: string[] = [];
    window.history.pushState({}, "", "/");
    render(<App client={createUiTestClient({ delayMs: 2500, onRequest: (url) => requestedUrls.push(url) })} />);
    const primaryNav = await findPrimaryNav();

    const clickPromise = userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(within(primaryNav).getByRole("button", { name: "设置" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("模型")).toHaveValue("");
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toContain("输出必须是 JSON");

    await clickPromise;
    expect(await screen.findByLabelText("接口地址")).toHaveValue("");
    expect(requestedUrls.filter((url) => url.includes("/api/ai/settings"))).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.includes("/api/sync/status"))).toHaveLength(1);
  });

  it("refreshes the queue when the signed-in user returns to the page", async () => {
    window.history.pushState({}, "", "/");
    const client = createUiTestClient();
    render(<App client={client} />);

    expect(await screen.findByText("还没有 Memo")).toBeInTheDocument();

    await client.publishMemo({
      title: "安卓端新增 Memo",
      content: "同一账号在另一端发布的内容",
      todos: []
    });

    expect(screen.queryByText("安卓端新增 Memo")).not.toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(await screen.findByText("安卓端新增 Memo")).toBeInTheDocument();
  });

  it("opens direct routes for capture, settings, history, and memo detail", async () => {
    let view = renderAt("/capture");
    expect(await screen.findByRole("heading", { name: "记录" })).toBeInTheDocument();
    view.unmount();

    view = renderAt("/settings");
    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(await screen.findByLabelText("接口地址")).toHaveValue("");
    view.unmount();

    view = renderAt("/history");
    expect(await screen.findByRole("heading", { name: "历史" })).toBeInTheDocument();
    view.unmount();

    renderAt("/memos/memo-unknown");
    expect(await screen.findByRole("heading", { name: "Memo 详情" })).toBeInTheDocument();
    expect(screen.getByText("正在加载 Memo 详情")).toBeInTheDocument();
  });

  it("filters the timeline by search and content tags", async () => {
    window.history.pushState({}, "", "/");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [
            createMemo("memo-work", "工作计划 #work", "整理 #launch 发布说明", ["检查发布清单"]),
            createMemo("memo-life", "生活记录", "买咖啡 #life", ["预约牙医"])
          ]
        })}
      />
    );

    expect(await screen.findByText("工作计划 #work")).toBeInTheDocument();
    expect(screen.getByText("生活记录")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("筛选"), "牙医");
    expect(screen.queryByText("工作计划 #work")).not.toBeInTheDocument();
    expect(screen.getByText("生活记录")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByText("工作计划 #work")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "筛选标签 launch" }));
    expect(screen.getByText("工作计划 #work")).toBeInTheDocument();
    expect(screen.queryByText("生活记录")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByText("生活记录")).toBeInTheDocument();
  });

  it("renders memo feed content as Markdown", async () => {
    window.history.pushState({}, "", "/");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [createMemo("memo-markdown-feed", "Markdown Memo", "## 发布计划\n\n- [ ] 补充文档", [])]
        })}
      />
    );

    expect(await screen.findByText("Markdown Memo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发布计划" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "补充文档" })).toBeInTheDocument();
  });
});

function createMemo(id: string, title: string, content: string, todoTitles: string[]): Memo {
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
