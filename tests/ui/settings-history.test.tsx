import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

describe("MemoTask settings and history workflows", () => {
  it("saves AI settings, tests connection, restores prompt, and exports JSON without showing plaintext key", async () => {
    render(<App client={createUiTestClient(async () => Response.json({ choices: [{ message: { content: "ok" } }] }))} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    await userEvent.type(screen.getByLabelText("接口地址"), "https://api.example.com/v1");
    await userEvent.clear(screen.getByLabelText("模型"));
    await userEvent.type(screen.getByLabelText("模型"), "dsv4-pro");
    await userEvent.type(screen.getByLabelText("API 密钥"), "sk-test-1234567890abcdef");
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
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

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
});
