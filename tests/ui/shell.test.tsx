import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App client={createUiTestClient()} />);
}

describe("MemoTask app shell", () => {
  it("opens on the Memos page with Chinese product UI", async () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/memos");
    expect(await screen.findByText("当前 Memo 队列")).toBeInTheDocument();
    expect(screen.getByText("还没有 Memo")).toBeInTheDocument();
    expect(screen.queryByText("Memo 卡片预览")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("升级")).not.toBeInTheDocument();
  });

  it("keeps primary navigation limited to recording, queue, and settings", () => {
    renderAt("/");

    const primaryNav = screen.getByRole("navigation", { name: "主导航" });
    const links = within(primaryNav).getAllByRole("button");

    expect(links.map((link) => link.textContent)).toEqual(["记录", "队列", "设置"]);
    expect(within(primaryNav).queryByText("历史")).not.toBeInTheDocument();
  });

  it("opens history only from the queue page action", async () => {
    renderAt("/");

    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));

    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
    expect(screen.getByText("完整 Memo 历史")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回队列" })).toBeInTheDocument();
  });

  it("switches between recording, queue, and settings without showing forbidden features", async () => {
    renderAt("/");
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    expect(screen.getByRole("heading", { name: "记录" })).toBeInTheDocument();
    expect(screen.getByText("写下原始想法")).toBeInTheDocument();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("deepseek-v4-pro")).toBeInTheDocument();

    expect(screen.queryByText("日期")).not.toBeInTheDocument();
    expect(screen.queryByText("提醒")).not.toBeInTheDocument();
    expect(screen.queryByText("订阅")).not.toBeInTheDocument();
  });

  it("shows navigation feedback immediately even when page data is slow", async () => {
    const requestedUrls: string[] = [];
    window.history.pushState({}, "", "/");
    render(<App client={createUiTestClient({ delayMs: 2500, onRequest: (url) => requestedUrls.push(url) })} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    const clickPromise = userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(within(primaryNav).getByRole("button", { name: "设置" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByDisplayValue("deepseek-v4-pro")).toBeInTheDocument();

    await clickPromise;
    await screen.findByDisplayValue("https://api.deepseek.com");
    expect(requestedUrls.filter((url) => url.includes("/api/ai/settings"))).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.includes("/api/sync/status"))).toHaveLength(1);
  });

  it("opens direct routes for capture, settings, history, and memo detail", async () => {
    let view = renderAt("/capture");
    expect(screen.getByRole("heading", { name: "记录" })).toBeInTheDocument();
    view.unmount();

    view = renderAt("/settings");
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("https://api.deepseek.com")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/history");
    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
    view.unmount();

    renderAt("/memos/memo-unknown");
    expect(screen.getByRole("heading", { name: "Memo 详情" })).toBeInTheDocument();
    expect(screen.getByText("正在加载 Memo 详情")).toBeInTheDocument();
  });
});
