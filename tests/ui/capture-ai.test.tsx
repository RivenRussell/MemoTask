import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";
import type { ApiClient } from "../../src/api/client";
import type { DraftInput, Memo } from "../../src/types";

describe("MemoTask capture draft and AI workflow", () => {
  it("shows recent drafts as a vertical side list without the old cloud illustration", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "第一条最近草稿");
    expect(await screen.findByText("草稿已保存", undefined, { timeout: 3_000 })).toBeInTheDocument();

    expect(screen.getByLabelText("最近草稿列表")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "载入草稿：第一条最近草稿" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "载入草稿：未命名 Memo" })).not.toBeInTheDocument();
    expect(document.querySelector(".draft-empty-state")).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/ui/empty-memos-cloud.png"]')).not.toBeInTheDocument();
  });

  it("keeps the title field out of the way until AI creates an editable title", async () => {
    render(
      <App
        client={createUiTestClient(async () =>
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "AI 生成标题",
                    todos: [{ title: "确认标题可修改" }]
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
    expect(screen.queryByLabelText("Memo 标题")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("原始 Memo"), "请帮我整理这个想法");
    await userEvent.click(screen.getByRole("button", { name: "整理" }));

    expect(await screen.findByLabelText("Memo 标题")).toHaveValue("AI 生成标题");
    await userEvent.clear(screen.getByLabelText("Memo 标题"));
    await userEvent.type(screen.getByLabelText("Memo 标题"), "我修改后的标题");
    expect(screen.getByLabelText("Memo 标题")).toHaveValue("我修改后的标题");
  });

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
    await userEvent.click(screen.getByRole("button", { name: "载入草稿：研究 PWA 能不能覆盖手机和 PC" }));
    expect(screen.getByDisplayValue("研究 PWA 能不能覆盖手机和 PC")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "整理" }));
    expect(await screen.findByDisplayValue("PWA 调研")).toBeInTheDocument();
    expect(await screen.findByText("确认手机支持")).toBeInTheDocument();
    expect(screen.getByText("整理 PC 方案")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("PWA 调研")).toBeInTheDocument();
    expect(screen.getByText("确认手机支持")).toBeInTheDocument();
  });

  it("keeps the newest draft preview when an older auto save returns later", async () => {
    const drafts: Memo[] = [];
    let resolveOldSave: (() => void) | null = null;
    const client = {
      getCurrentUser: async () => ({
        id: "default",
        email: "local@memotask.test",
        emailVerified: true,
        createdAt: "2026-06-22T12:00:00.000Z"
      }),
      listMemos: async () => [],
      listRecentDrafts: async () => drafts,
      createDraft: async (input: DraftInput) => {
        if (input.content === "旧内容") {
          return new Promise<Memo>((resolve) => {
            resolveOldSave = () => {
              const memo = createDraftMemo("draft-old", input.content);
              drafts.unshift(memo);
              resolve(memo);
            };
          });
        }

        const memo = createDraftMemo("draft-new", input.content);
        drafts.unshift(memo);
        return memo;
      }
    } as unknown as ApiClient;

    render(<App client={client} />);
    const primaryNav = await findPrimaryNav();
    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));

    await userEvent.type(screen.getByLabelText("原始 Memo"), "旧内容");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_100));
    });

    await userEvent.clear(screen.getByLabelText("原始 Memo"));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "最新完整内容");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_100));
    });

    expect(screen.getByRole("button", { name: "载入草稿：最新完整内容" })).toBeInTheDocument();

    await act(async () => {
      resolveOldSave?.();
      await Promise.resolve();
    });

    const draftButtons = screen.getAllByRole("button", { name: /^载入草稿：/ });
    expect(draftButtons[0]).toHaveAccessibleName("载入草稿：最新完整内容");
  }, 10_000);

  it("flushes the latest draft when leaving capture before debounce saves", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = await findPrimaryNav();

    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "立刻离开也要保存");
    await userEvent.click(within(primaryNav).getByRole("button", { name: "队列" }));
    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));

    expect(await screen.findByRole("button", { name: "载入草稿：立刻离开也要保存" })).toBeInTheDocument();
  });
});

function createDraftMemo(id: string, content: string): Memo {
  return {
    id,
    userId: "default",
    title: "",
    content,
    status: "draft",
    historyReason: null,
    sortOrder: 1,
    lastActiveSortOrder: null,
    autoArchiveSuppressedUntilChange: false,
    aiState: "idle",
    aiError: null,
    createdAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z",
    publishedAt: null,
    historyAt: null,
    deletedAt: null,
    todos: []
  };
}
