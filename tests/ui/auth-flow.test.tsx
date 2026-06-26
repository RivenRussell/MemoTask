import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { ApiRequestError, type ApiClient } from "../../src/api/client";
import { createAuthenticatedUiTestClient } from "./test-client";

function renderAuthApp(path = "/memos") {
  window.history.pushState({}, "", path);
  return render(<App client={createAuthenticatedUiTestClient()} />);
}

describe("MemoTask auth flow", () => {
  it("renders the login screen without heavyweight raster artwork", async () => {
    renderAuthApp("/");

    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(document.querySelector('.auth-shell img[src^="/assets/ui/"]')).not.toBeInTheDocument();
    expect(document.querySelector(".auth-orb-asset")).toBeInTheDocument();
  });

  it("returns to login instead of leaving the shell open when a protected request loses its session", async () => {
    const expiredSessionClient = {
      getCurrentUser: async () => ({
        id: "user-expired",
        email: "expired@example.com",
        emailVerified: true,
        createdAt: "2026-06-23T12:00:00.000Z"
      }),
      listMemos: async () => {
        throw new ApiRequestError("AUTH_REQUIRED", "请先登录", 401);
      }
    } as unknown as ApiClient;

    render(<App client={expiredSessionClient} />);

    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "队列" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("shows login instead of memo data when the user is not signed in", async () => {
    renderAuthApp("/");

    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "队列" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("registers an account, verifies by email code, then returns to login", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    expect(window.location.pathname).toBe("/signup");
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.type(screen.getByLabelText("确认密码"), "memo123");
    expect(screen.getByText("至少 6 位，并同时包含英文字母和数字")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "显示密码" }));
    expect(screen.getByLabelText("密码")).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "隐藏密码" }));
    expect(screen.getByLabelText("密码")).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));

    expect(await screen.findByRole("heading", { name: "验证邮箱" })).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/verify-email");

    await userEvent.click(screen.getByRole("button", { name: "填入测试验证码" }));
    await userEvent.click(screen.getByRole("button", { name: "验证邮箱" }));

    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(screen.getByText("邮箱验证成功，请登录")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");

    expect(screen.getByLabelText("邮箱")).toHaveValue("owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
  });

  it("logs in and logs out with the app shell account control", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.type(screen.getByLabelText("确认密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.click(await screen.findByRole("button", { name: "填入测试验证码" }));
    await userEvent.click(screen.getByRole("button", { name: "验证邮箱" }));
    await screen.findByRole("heading", { name: "登录 MemoTask" });
    expect(screen.getByLabelText("邮箱")).toHaveValue("owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    await screen.findByRole("heading", { name: "队列" });
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(await screen.findByRole("heading", { name: "登录 MemoTask" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");

    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
  });

  it("sends a reset email and resets the password from the reset route", async () => {
    renderAuthApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "创建账号" }));
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.type(screen.getByLabelText("确认密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));
    await userEvent.click(await screen.findByRole("button", { name: "填入测试验证码" }));
    await userEvent.click(screen.getByRole("button", { name: "验证邮箱" }));
    await screen.findByRole("heading", { name: "登录 MemoTask" });
    expect(screen.getByLabelText("邮箱")).toHaveValue("owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "memo123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    await screen.findByRole("heading", { name: "队列" });
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await userEvent.click(await screen.findByRole("button", { name: "忘记密码" }));
    expect(window.location.pathname).toBe("/forgot-password");
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));
    expect(await screen.findByText("如果邮箱存在，重置链接已经发送")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开测试重置链接" }));
    expect(await screen.findByRole("heading", { name: "重置密码" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("新密码"), "new123");
    await userEvent.click(screen.getByRole("button", { name: "更新密码" }));

    expect(await screen.findByRole("heading", { name: "队列" })).toBeInTheDocument();
  });
});
