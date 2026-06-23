import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";

describe("MemoTask settings and history workflows", () => {
  it("saves AI settings, tests connection, restores prompt, and exports JSON without showing plaintext key", async () => {
    render(<App client={createUiTestClient(async () => Response.json({ choices: [{ message: { content: "ok" } }] }))} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    await userEvent.type(screen.getByLabelText("接口地址"), "https://api.example.com/v1");
    await userEvent.clear(screen.getByLabelText("模型"));
    await userEvent.type(screen.getByLabelText("模型"), "dsv4-pro");
    await userEvent.type(screen.getByLabelText("API 密钥"), "test-key-1234567890abcdef");
    await userEvent.clear(screen.getByLabelText("Prompt"));
    await userEvent.type(screen.getByLabelText("Prompt"), "临时 Prompt");

    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByText("已保存 AI 设置")).toBeInTheDocument();
    expect(screen.queryByText("1234567890")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "测试连接" }));
    expect(await screen.findByText("连接测试通过")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "恢复默认 Prompt" }));
    expect(await screen.findByDisplayValue(/你是 MemoTask 的整理助手/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "导出 JSON" }));
    expect(await screen.findByText("JSON 导出已生成")).toBeInTheDocument();
  });

  it("searches history, bulk deletes a memo, and restores it with undo", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "包含 Cloudflare 部署步骤");
    await userEvent.type(screen.getByLabelText("Memo 标题"), "部署资料");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "检查 Access 配置");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("部署资料")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "检查 Access 配置" }));
    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));

    expect(await screen.findByText("部署资料")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("搜索历史"), "Access");
    expect(await screen.findByText("检查 Access 配置")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "选择 部署资料" }));
    await userEvent.click(screen.getByRole("button", { name: "删除所选" }));
    expect(await screen.findByText("已删除 1 个 Memo")).toBeInTheDocument();
    expect(screen.queryByText("部署资料")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(await screen.findByText("部署资料")).toBeInTheDocument();
  });

  it("shows settings save feedback immediately even when the server is slow", async () => {
    window.history.pushState({}, "", "/settings");
    render(<App client={createUiTestClient({ delayMs: 2500 })} />);

    expect(await screen.findByDisplayValue("deepseek-v4-pro", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("接口地址"), "https://api.example.com/v1");

    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(screen.getByText("设置保存中")).toBeInTheDocument();
  });

  it("shows history delete feedback immediately even when the server is slow", async () => {
    const memo = {
      ...createMemo("history-delete-slow", "慢删除历史", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:20:00.000Z"
    };
    window.history.pushState({}, "", "/history");
    render(<App client={createUiTestClient({ delayMs: 2500, initialMemos: [memo] })} />);

    expect(await screen.findByText("慢删除历史", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "选择 慢删除历史" }));

    await userEvent.click(screen.getByRole("button", { name: "删除所选" }));
    expect(screen.getByText("删除中")).toBeInTheDocument();
  });

  it("shows restore feedback immediately even when the server is slow", async () => {
    const memo = {
      ...createMemo("history-restore-slow", "慢恢复历史", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:21:00.000Z"
    };
    window.history.pushState({}, "", "/history");
    render(<App client={createUiTestClient({ delayMs: 2500, initialMemos: [memo] })} />);

    expect(await screen.findByText("慢恢复历史", undefined, { timeout: 4_000 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "恢复 慢恢复历史" }));
    expect(screen.getByText("恢复中")).toBeInTheDocument();
  });

  it("shows undo delete feedback immediately even when the server is slow", async () => {
    const memo = {
      ...createMemo("history-undo-slow", "慢撤销删除", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:22:00.000Z"
    };
    window.history.pushState({}, "", "/history");
    render(<App client={createUiTestClient({ delayMs: 800, initialMemos: [memo] })} />);

    expect(await screen.findByText("慢撤销删除", undefined, { timeout: 4_000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "选择 慢撤销删除" }));
    await userEvent.click(screen.getByRole("button", { name: "删除所选" }));
    expect(await screen.findByText("已删除 1 个 Memo", undefined, { timeout: 4_000 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(screen.getByText("撤销中")).toBeInTheDocument();
  });
});

function createMemo(id: string, title: string, todos: never[]) {
  return {
    id,
    userId: "default",
    title,
    content: "用于验证慢网络下的历史操作反馈。",
    status: "active" as const,
    historyReason: null,
    sortOrder: 1,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle" as const,
    aiError: null,
    createdAt: "2026-06-23T09:20:00.000Z",
    updatedAt: "2026-06-23T09:20:00.000Z",
    publishedAt: "2026-06-23T09:20:00.000Z",
    historyAt: null,
    deletedAt: null,
    todos
  };
}
