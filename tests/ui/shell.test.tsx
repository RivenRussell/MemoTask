import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("MemoTask app shell", () => {
  it("opens on the Memos page with Chinese product UI", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(screen.getByText("当前 Memo 队列")).toBeInTheDocument();
    expect(screen.getByText("还没有 Memo")).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
    expect(screen.queryByText("升级")).not.toBeInTheDocument();
  });

  it("keeps primary navigation limited to Capture, Memos, and Settings", () => {
    render(<App />);

    const primaryNav = screen.getByRole("navigation", { name: "主导航" });
    const links = within(primaryNav).getAllByRole("button");

    expect(links.map((link) => link.textContent)).toEqual(["Capture", "Memos", "Settings"]);
    expect(within(primaryNav).queryByText("History")).not.toBeInTheDocument();
  });

  it("opens History only from the Memos page action", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "打开 History" }));

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("完整 Memo 历史")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回 Memos" })).toBeInTheDocument();
  });

  it("switches between Capture, Memos, and Settings without showing forbidden features", async () => {
    render(<App />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "Capture" }));
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByText("写下原始想法")).toBeInTheDocument();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("dsv4-pro")).toBeInTheDocument();

    expect(screen.queryByText("日期")).not.toBeInTheDocument();
    expect(screen.queryByText("提醒")).not.toBeInTheDocument();
    expect(screen.queryByText("订阅")).not.toBeInTheDocument();
  });
});
