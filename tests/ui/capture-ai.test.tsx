import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";

describe("MemoTask capture draft and AI workflow", () => {
  it("auto saves a draft, reloads it from recent drafts, and applies Analyze results before publishing", async () => {
    render(
      <App
        client={createUiTestClient(async () =>
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "PWA 调研",
                    todos: [{ title: "确认手机支持" }, { title: "整理 PC 方案", notes: "对照设计图" }]
                  })
                }
              }
            ]
          })
        )}
      />
    );
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "设置" }));
    await userEvent.type(screen.getByLabelText("接口地址"), "https://api.example.com/v1");
    await userEvent.type(screen.getByLabelText("模型"), "dsv4-pro");
    await userEvent.type(screen.getByLabelText("API 密钥"), "test-key-1234567890abcdef");
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(await screen.findByText("已保存 AI 设置")).toBeInTheDocument();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "研究 PWA 能不能覆盖手机和 PC");
    expect(await screen.findByText("草稿已保存", undefined, { timeout: 3_000 })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("原始 Memo"));
    await userEvent.click(screen.getByRole("button", { name: "载入草稿：未命名 Memo" }));
    expect(screen.getByDisplayValue("研究 PWA 能不能覆盖手机和 PC")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "整理" }));
    expect(await screen.findByDisplayValue("PWA 调研")).toBeInTheDocument();
    expect(await screen.findByText("确认手机支持")).toBeInTheDocument();
    expect(screen.getByText("整理 PC 方案")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("PWA 调研")).toBeInTheDocument();
    expect(screen.getByText("确认手机支持")).toBeInTheDocument();
  });
});
