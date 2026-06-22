import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

describe("MemoTask frontend memo flow", () => {
  it("publishes a pure memo with manual todos and auto archives when all todos are done", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "Capture" }));
    await userEvent.type(screen.getByLabelText("Raw Memo"), "研究 PWA 能不能覆盖手机和 PC");
    await userEvent.type(screen.getByLabelText("Memo 标题"), "PWA 调研");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "确认手机端安装体验");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.type(screen.getByLabelText("新增 Todo"), "整理 PC 端布局");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(await screen.findByText("PWA 调研")).toBeInTheDocument();
    expect(screen.getByText("确认手机端安装体验")).toBeInTheDocument();
    expect(screen.getByText("整理 PC 端布局")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "确认手机端安装体验" }));
    expect(screen.getByText("PWA 调研")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "整理 PC 端布局" }));
    expect(await screen.findByText("还没有 Memo")).toBeInTheDocument();
    expect(screen.queryByText("PWA 调研")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开 History" }));
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(await screen.findByText("PWA 调研")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "恢复 PWA 调研" }));
    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(screen.getByText("PWA 调研")).toBeInTheDocument();
  });

  it("keeps completed todo text in place without strikethrough", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "Capture" }));
    await userEvent.type(screen.getByLabelText("Raw Memo"), "整理设计图");
    await userEvent.type(screen.getByLabelText("Memo 标题"), "设计图检查");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "确认完成态没有删除线");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("设计图检查")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "确认完成态没有删除线" }));

    await userEvent.click(screen.getByRole("button", { name: "打开 History" }));
    expect(await screen.findByText("设计图检查")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "恢复 设计图检查" }));
    const completedTodo = await screen.findByText("确认完成态没有删除线");

    expect(completedTodo.closest("li")).toHaveClass("is-done");
    expect(completedTodo.closest("li")).toHaveStyle({ textDecoration: "none" });
  });
});
