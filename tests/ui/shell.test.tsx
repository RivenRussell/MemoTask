import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

describe("MemoTask app shell", () => {
  it("opens on the Memos page with Chinese product UI", async () => {
    render(<App client={createUiTestClient()} />);

    expect(screen.getByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(await screen.findByText("当前 Memo 队列")).toBeInTheDocument();
    expect(screen.getByText("还没有 Memo")).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("升级")).not.toBeInTheDocument();
  });

  it("keeps primary navigation limited to recording, queue, and settings", () => {
    render(<App client={createUiTestClient()} />);

    const primaryNav = screen.getByRole("navigation", { name: "主导航" });
    const links = within(primaryNav).getAllByRole("button");

    expect(links.map((link) => link.textContent)).toEqual(["记录", "队列", "设置"]);
    expect(within(primaryNav).queryByText("历史")).not.toBeInTheDocument();
  });

  it("opens history only from the queue page action", async () => {
    render(<App client={createUiTestClient()} />);

    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));

    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
    expect(screen.getByText("完整 Memo 历史")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回队列" })).toBeInTheDocument();
  });

  it("switches between recording, queue, and settings without showing forbidden features", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    expect(screen.getByRole("heading", { name: "记录" })).toBeInTheDocument();
    expect(screen.getByText("写下原始想法")).toBeInTheDocument();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("dsv4-pro")).toBeInTheDocument();

    expect(screen.queryByText("日期")).not.toBeInTheDocument();
    expect(screen.queryByText("提醒")).not.toBeInTheDocument();
    expect(screen.queryByText("订阅")).not.toBeInTheDocument();
  });
});
