import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App client={createUiTestClient()} />);
}

describe("MemoTask app shell", () => {
  it("opens on the Memos page with Chinese product UI", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/memos");
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

    await userEvent.click(await screen.findByRole("button", { name: "打开历史" }));

    expect(await screen.findByRole("heading", { name: "历史" })).toBeInTheDocument();
    expect(screen.getByText("还没有历史 Memo")).toBeInTheDocument();
    expect(screen.queryByText("完整 Memo 历史")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回队列" })).toBeInTheDocument();
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
});
