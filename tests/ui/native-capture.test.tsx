import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { createUiTestClient, findPrimaryNav } from "./test-client";

describe("native quick capture workflow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads shared text from the native bridge into the capture draft", async () => {
    window.history.pushState({}, "", "/memos");
    render(<App client={createUiTestClient()} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("memotask:native-capture", {
          detail: {
            title: "从浏览器分享",
            content: "https://example.com/article",
            source: "android-share",
            receivedAt: "2026-06-26T12:00:00.000Z"
          }
        })
      );
    });

    expect(await screen.findByRole("heading", { name: "记录" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("从浏览器分享")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/article")).toBeInTheDocument();
    expect(screen.getByText("已接收外部分享")).toBeInTheDocument();
  });

  it("saves failed quick captures as local drafts and restores them on the capture page", async () => {
    render(<App client={createUiTestClient({ failForUrl: (url) => url.includes("/api/memos/publish") })} />);
    const primaryNav = await findPrimaryNav();
    await userEvent.click(within(primaryNav).getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("原始 Memo"), "需要离线保护的内容");

    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(window.localStorage.getItem("memotask.localCaptureDrafts")).toContain("需要离线保护的内容"));
    expect(await screen.findByText("发布失败，已保存在本地草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "载入本地草稿：需要离线保护的内容" })).toBeInTheDocument();
  });
});
