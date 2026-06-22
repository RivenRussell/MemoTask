import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

describe("MemoTask memo detail workflow", () => {
  it("edits a memo, manages todos, and manually archives it to History", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

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
    expect(await screen.findByText("确认 Access 规则")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("详情新增 Todo"), "保留未完成项");
    await userEvent.click(screen.getByRole("button", { name: "新增 Todo" }));
    expect(await screen.findByText("保留未完成项")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "删除 检查 Worker 健康" }));
    expect(screen.queryByText("检查 Worker 健康")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "确认 Access 规则" }));
    expect(screen.getByText("确认 Access 规则").closest("li")).toHaveClass("is-done");

    await userEvent.click(screen.getByRole("button", { name: "手动归档" }));
    expect(await screen.findByText("上线前检查")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "历史" })).toBeInTheDocument();
  });
});
