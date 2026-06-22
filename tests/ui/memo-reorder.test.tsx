import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient } from "./test-client";

describe("MemoTask memo reorder workflow", () => {
  it("moves memos in the priority queue and keeps the order after navigation refresh", async () => {
    render(<App client={createUiTestClient()} />);
    const primaryNav = screen.getByRole("navigation", { name: "主导航" });

    await publishMemo(primaryNav, "低优先 Memo", "稍后处理", "稍后确认");
    await publishMemo(primaryNav, "高优先 Memo", "马上处理", "马上确认");

    expect(memoTitles()).toEqual(["高优先 Memo", "低优先 Memo"]);

    await userEvent.click(screen.getByRole("button", { name: "下移 高优先 Memo" }));
    expect(memoTitles()).toEqual(["低优先 Memo", "高优先 Memo"]);

    await userEvent.click(within(primaryNav).getByRole("button", { name: "Settings" }));
    await userEvent.click(within(primaryNav).getByRole("button", { name: "Memos" }));
    expect(memoTitles()).toEqual(["低优先 Memo", "高优先 Memo"]);
  });
});

async function publishMemo(primaryNav: HTMLElement, title: string, content: string, todo: string) {
  await userEvent.click(within(primaryNav).getByRole("button", { name: "Capture" }));
  await userEvent.type(screen.getByLabelText("Raw Memo"), content);
  await userEvent.type(screen.getByLabelText("Memo 标题"), title);
  await userEvent.type(screen.getByLabelText("新增 Todo"), todo);
  await userEvent.click(screen.getByRole("button", { name: "添加 Todo" }));
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(await screen.findByText(title)).toBeInTheDocument();
}

function memoTitles(): string[] {
  return screen.getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 2 }).textContent ?? "");
}
