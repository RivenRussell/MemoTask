import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";

describe("MemoTask settings and history workflows", () => {
  it("saves AI settings, tests connection, restores prompt, and exports JSON without showing plaintext key", async () => {
    render(<App client={createUiTestClient(async () => Response.json({ choices: [{ message: { content: "ok" } }] }))} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    expect(await screen.findByLabelText("接口地址")).toHaveValue("");
    expect(screen.getByLabelText("接口地址")).toHaveAttribute("placeholder", "https://api.deepseek.com");
    expect(screen.getByLabelText("模型")).toHaveValue("");
    expect(screen.getByLabelText("模型")).toHaveAttribute("placeholder", "deepseek-v4-pro");
    await userEvent.type(screen.getByLabelText("接口地址"), "https://api.example.com/v1");
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

  it("keeps the signed-in account's AI settings after logout and login", async () => {
    render(<App client={createUiTestClient(async () => Response.json({ choices: [{ message: { content: "ok" } }] }))} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    await userEvent.type(await screen.findByLabelText("接口地址"), "https://api.persisted.example/v1");
    await userEvent.type(screen.getByLabelText("模型"), "persisted-model");
    await userEvent.type(screen.getByLabelText("API 密钥"), "persisted-key-1234567890");
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByText("当前已保存：pers...7890")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("邮箱"), "local@memotask.test");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    const navAfterLogin = await findPrimaryNav();
    await userEvent.click(within(navAfterLogin).getByRole("button", { name: "设置" }));
    expect(await screen.findByDisplayValue("https://api.persisted.example/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("persisted-model")).toBeInTheDocument();
    expect(screen.getByText("当前已保存：pers...7890")).toBeInTheDocument();
    expect(screen.getByLabelText("API 密钥")).toHaveValue("");
  });

  it("searches history, bulk deletes a memo, and restores it with undo", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "部署资料");
    await userEvent.type(screen.getByLabelText("新增 Todo"), "检查 Access 配置");
    await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByRole("heading", { name: "部署资料" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "检查 Access 配置" }));
    await userEvent.click(screen.getByRole("button", { name: "打开历史" }));

    expect(await screen.findByRole("heading", { name: "部署资料" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("搜索历史"), "Access");
    expect(await screen.findByText("检查 Access 配置")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "选择 部署资料" }));
    await userEvent.click(screen.getByRole("button", { name: "删除所选" }));
    expect(await screen.findByText("已删除 1 个 Memo")).toBeInTheDocument();
    expect(screen.queryByText("部署资料")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(await screen.findByRole("heading", { name: "部署资料" })).toBeInTheDocument();
  });

  it("keeps the newest history search results when older searches return later", async () => {
    const alphaMemo = {
      ...createMemo("history-alpha", "Alpha 最新结果", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:30:00.000Z"
    };
    const archiveMemo = {
      ...createMemo("history-archive", "Archive 旧请求结果", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:29:00.000Z"
    };
    window.history.pushState({}, "", "/history");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [alphaMemo, archiveMemo],
          delayForUrl: (url) => {
            const query = new URL(url, "http://localhost").searchParams.get("q") ?? "";
            return query === "a" ? 700 : 0;
          }
        })}
      />
    );

    expect(await screen.findByText("Alpha 最新结果")).toBeInTheDocument();
    const searchInput = screen.getByLabelText("搜索历史");

    await userEvent.type(searchInput, "a");
    await userEvent.type(searchInput, "lpha");

    expect(await screen.findByText("Alpha 最新结果")).toBeInTheDocument();
    expect(screen.queryByText("Archive 旧请求结果")).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    });
    expect(screen.getByText("Alpha 最新结果")).toBeInTheDocument();
    expect(screen.queryByText("Archive 旧请求结果")).not.toBeInTheDocument();
  });

  it("does not duplicate history search requests for a single query change", async () => {
    const requests: string[] = [];
    const memo = {
      ...createMemo("history-single-search", "唯一历史", []),
      status: "history" as const,
      historyReason: "archived" as const,
      historyAt: "2026-06-23T09:31:00.000Z"
    };
    window.history.pushState({}, "", "/history");
    render(
      <App
        client={createUiTestClient({
          initialMemos: [memo],
          onRequest: (url) => requests.push(url)
        })}
      />
    );

    expect(await screen.findByText("唯一历史")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("搜索历史"), "z");
    expect(await screen.findByText("还没有历史 Memo")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });

    const searchRequests = requests.filter((url) => {
      const parsed = new URL(url, "http://localhost");
      return parsed.pathname === "/api/history/search" && parsed.searchParams.get("q") === "z";
    });
    expect(searchRequests).toHaveLength(1);
  });

  it("shows settings save feedback immediately even when the server is slow", async () => {
    window.history.pushState({}, "", "/settings");
    render(<App client={createUiTestClient({ delayMs: 2500 })} />);

    expect(await screen.findByLabelText("模型", undefined, { timeout: 4_000 })).toHaveValue("");
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
