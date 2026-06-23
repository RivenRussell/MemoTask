import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createAuthenticatedUiTestClient } from "./test-client";

function renderAuthApp(path = "/memos") {
  window.history.pushState({}, "", path);
  return render(<App client={createAuthenticatedUiTestClient()} />);
}

describe("MemoTask auth flow", () => {
  it("shows login instead of memo data when the user is not signed in", async () => {
    renderAuthApp("/");

    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "队列" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/memos");
  });

  it("registers an account, waits for email verification, then opens the queue", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));

    expect(await screen.findByRole("heading", { name: "验证邮箱" })).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开测试验证链接" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
    expect(screen.getByText("还没有 Memo")).toBeInTheDocument();
  });

  it("logs in and logs out with the app shell account control", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.click(await screen.findByRole("button", { name: "打开测试验证链接" }));
    await screen.findByRole("heading", { name: "队列" });

    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
  });

  it("sends a reset email and resets the password from the reset route", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.click(await screen.findByRole("button", { name: "打开测试验证链接" }));
    await screen.findByRole("heading", { name: "队列" });
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await userEvent.click(await screen.findByRole("button", { name: "忘记密码" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));
    expect(await screen.findByText("如果邮箱存在，重置链接已经发送")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开测试重置链接" }));
    expect(await screen.findByRole("heading", { name: "重置密码" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("新密码"), "new correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "更新密码" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
  });
});
