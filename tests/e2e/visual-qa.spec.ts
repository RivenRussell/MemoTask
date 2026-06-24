import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { moveMemoToHistory } from "../../worker/domain/state-machines";
import { createApi } from "../../worker/api";
import { createSessionCookie, hashPassword, hashToken } from "../../worker/auth/crypto";
import { MemoryAuthRepository } from "../../worker/auth/memory-auth-repository";
import { AuthService } from "../../worker/auth/service";
import type { EmailMessage, EmailSender } from "../../worker/auth/types";
import { MemoryRepository } from "../../worker/repository/memory-repository";
import type { MemoRepository } from "../../worker/repository/types";

const outputDir = path.join(process.cwd(), "output", "visual-qa");

interface PageSpec {
  path: string;
  label: string;
  heading: string;
  requiredTexts: string[];
  requiredValues?: string[];
}

const pageSpecs: PageSpec[] = [
  {
    path: "/memos",
    label: "memos",
    heading: "队列",
    requiredTexts: ["双端验收 Memo", "确认完成态没有删除线", "跨端排序 Memo"]
  },
  {
    path: "/capture",
    label: "capture",
    heading: "记录",
    requiredTexts: ["视觉验收草稿"]
  },
  {
    path: "/settings",
    label: "settings",
    heading: "设置",
    requiredTexts: ["AI API", "接口地址", "同步状态：正常", "Prompt"]
  },
  {
    path: "/history",
    label: "history",
    heading: "历史",
    requiredTexts: ["已归档验收 Memo", "恢复", "搜索历史"]
  }
];

test.beforeEach(async ({ page }) => {
  const repository = new MemoryRepository();
  await seedVisualQaData(repository);
  await routeAuthenticatedApi(page, repository, "test-encryption-key-for-visual-qa");
});

for (const spec of pageSpecs) {
  test(`visual QA renders ${spec.label} with real content`, async ({ page }, testInfo) => {
    await page.goto(spec.path);
    await expect(page.getByRole("heading", { name: spec.heading, exact: true })).toBeVisible();
    for (const text of spec.requiredTexts) {
      await expectPageText(page, text);
    }
    for (const value of spec.requiredValues ?? []) {
      await expect(page.locator("input, textarea").filter({ hasText: value }).or(page.locator(`input[value="${value}"]`))).toHaveCount(1);
    }

    await expect(page.getByText("Today")).toHaveCount(0);
    await expect(page.getByText("Upcoming")).toHaveCount(0);
    await expect(page.getByText("订阅")).toHaveCount(0);
    await expect(page.getByText("升级")).toHaveCount(0);
    await expect(page.locator(".app-frame")).toBeVisible();
    await assertVisualIntegrity(page);

    await mkdir(outputDir, { recursive: true });
    await page.screenshot({
      fullPage: true,
      path: path.join(outputDir, `verified-${testInfo.project.name}-${spec.label}.png`)
    });
  });
}

test("visual QA keeps memo detail readable on Android", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "android", "Android-only mobile detail layout check");

  await page.goto("/memos");
  await page.getByRole("button", { name: "打开 双端验收 Memo" }).click();
  await expect(page.getByRole("heading", { name: "Memo 详情", exact: true })).toBeVisible();
  await expect(page.getByLabel("详情标题")).toHaveValue("双端验收 Memo");
  const todoTitles = await page.locator(".memo-detail-todo-list .todo-title-input").evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value)
  );
  expect(todoTitles).toContain("第四条 Todo 不在卡片默认展示");

  await assertVisualIntegrity(page);
  await expectMobileDetailLayout(page);

  await mkdir(outputDir, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(outputDir, `verified-${testInfo.project.name}-memo-detail.png`)
  });
});

test("visual QA keeps the empty queue focused", async ({ page }) => {
  const repository = new MemoryRepository();

  await page.unroute("**/*");
  await routeAuthenticatedApi(page, repository, "test-encryption-key-for-empty-visual-qa");

  await page.goto("/memos");
  await expect(page.getByText("还没有 Memo")).toBeVisible();
  await expect(page.getByText("Memo 卡片预览")).toHaveCount(0);
  await expect(page.locator(".soft-card")).toHaveCount(1);
  await assertVisualIntegrity(page);
});

async function seedVisualQaData(repository: MemoRepository) {
  await repository.createDraft(
    "default",
    {
      title: "视觉验收草稿",
      content: "用于确认 Capture 页最近草稿区域不是空白。"
    },
    "2026-06-22T12:00:00.000Z"
  );

  const activeMemo = await repository.publishMemo(
    "default",
    {
      title: "双端验收 Memo",
      content: "用于确认 PC 和 Android 页面不白屏，按钮不裁切。",
      todos: [
        { title: "确认完成态没有删除线" },
        { title: "检查响应式布局" },
        { title: "验证按钮文字不溢出" },
        { title: "第四条 Todo 不在卡片默认展示" }
      ]
    },
    "2026-06-22T12:01:00.000Z"
  );
  await repository.updateTodo("default", {
    ...activeMemo.todos[0],
    status: "done",
    completedAt: "2026-06-22T12:02:00.000Z",
    updatedAt: "2026-06-22T12:02:00.000Z"
  });

  await repository.publishMemo(
    "default",
    {
      title: "跨端排序 Memo",
      content: "用于确认队列里存在多张 Memo 卡片。",
      todos: [{ title: "确认排序按钮可见" }, { title: "确认详情入口可见" }]
    },
    "2026-06-22T12:03:00.000Z"
  );

  const historyMemo = await repository.publishMemo(
    "default",
    {
      title: "已归档验收 Memo",
      content: "归档后保存完整 Memo，用于确认 History 页面不白屏。",
      todos: [{ title: "保留已完成 Todo 状态" }, { title: "恢复后回到队列" }]
    },
    "2026-06-22T12:04:00.000Z"
  );

  await repository.saveMemo(
    "default",
    moveMemoToHistory(
      {
        ...historyMemo,
        todos: [
          {
            ...historyMemo.todos[0],
            status: "done",
            completedAt: "2026-06-22T12:05:00.000Z",
            updatedAt: "2026-06-22T12:05:00.000Z"
          },
          historyMemo.todos[1]
        ]
      },
      "archived",
      "2026-06-22T12:06:00.000Z"
    )
  );
}

async function routeAuthenticatedApi(page: Page, repository: MemoRepository, appEncryptionKey: string) {
  const authRepository = new MemoryAuthRepository();
  const sessionToken = "visual-qa-session-token";
  await seedDefaultSession(authRepository, sessionToken);
  const authService = new AuthService({
    repository: authRepository,
    emailSender: new RecordingEmailSender(),
    appBaseUrl: "https://memotask.example.com"
  });
  const app = createApi({
    repository,
    authService,
    now: () => "2026-06-22T12:30:00.000Z",
    appEncryptionKey
  });
  const cookie = createSessionCookie(sessionToken, "2099-01-01T00:00:00.000Z").split(";")[0];

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    const headers = new Headers(await request.allHeaders());
    headers.set("cookie", cookie);
    const response = await app.request(request.url(), {
      method: request.method(),
      headers,
      body: request.postData() ?? undefined
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text()
    });
  });
}

async function seedDefaultSession(authRepository: MemoryAuthRepository, sessionToken: string): Promise<void> {
  await authRepository.createUser({
    id: "default",
    email: "local@memotask.test",
    passwordHash: await hashPassword("memo123"),
    emailVerifiedAt: "2026-06-22T12:00:00.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z"
  });
  await authRepository.createSession({
    id: "session-default",
    userId: "default",
    tokenHash: await hashToken(sessionToken),
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    lastSeenAt: "2026-06-22T12:00:00.000Z"
  });
}

class RecordingEmailSender implements EmailSender {
  public messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

async function assertVisualIntegrity(page: Page) {
  const result = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
    };

    const overflowingButtons = [...document.querySelectorAll("button")]
      .filter(visible)
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.left < -1 ||
          rect.right > window.innerWidth + 1 ||
          button.scrollWidth > button.clientWidth + 2 ||
          button.scrollHeight > button.clientHeight + 2
        );
      })
      .map((button) => button.getAttribute("aria-label") || button.textContent?.trim() || button.tagName);

    const doneTextDecorations = [...document.querySelectorAll(".todo-list li.is-done, .todo-list li.is-done *")]
      .filter(visible)
      .map((element) => window.getComputedStyle(element).textDecorationLine)
      .filter((decoration) => decoration !== "none");

    const mobileNav = document.querySelector(".mobile-bottom-nav");
    const mobileNavRect = mobileNav && visible(mobileNav) ? mobileNav.getBoundingClientRect() : null;
    const workspace = document.querySelector(".workspace-shell");
    const workspacePaddingBottom = workspace ? Number.parseFloat(window.getComputedStyle(workspace).paddingBottom) : 0;
    const mobileNavClearance = mobileNavRect ? Math.round(workspacePaddingBottom - mobileNavRect.height) : null;
    const overlaps = (left: DOMRectReadOnly, right: DOMRectReadOnly) =>
      left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
    const viewportRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const visibleRect = (element: Element) => {
      let rect: DOMRectReadOnly = element.getBoundingClientRect();
      const scrollClip = element.closest(".workspace-shell")?.getBoundingClientRect();
      for (const clip of [viewportRect, scrollClip].filter((candidate): candidate is DOMRect => Boolean(candidate))) {
        const left = Math.max(rect.left, clip.left);
        const right = Math.min(rect.right, clip.right);
        const top = Math.max(rect.top, clip.top);
        const bottom = Math.min(rect.bottom, clip.bottom);
        if (right <= left || bottom <= top) {
          return null;
        }
        rect = new DOMRect(left, top, right - left, bottom - top);
      }
      return rect;
    };
    const mobileNavOverlaps = mobileNavRect
      ? [...document.querySelectorAll(".page-surface .soft-card, .page-surface button, .page-surface input, .page-surface textarea")]
          .filter(visible)
          .filter((element) => {
            const rect = visibleRect(element);
            return rect !== null && overlaps(mobileNavRect, rect);
          })
          .map((element) => element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName)
      : [];
    const oversizedCheckboxVisuals = [...document.querySelectorAll(".todo-list .checkbox-visual")]
      .filter(visible)
      .map((element) => Math.round(element.getBoundingClientRect().width))
      .filter((width) => width > 24);

    return {
      bodyTextLength: document.body.innerText.trim().length,
      backgroundColor: window.getComputedStyle(document.body).backgroundColor,
      rootChildren: document.querySelector("#root")?.children.length ?? 0,
      visibleCards: [...document.querySelectorAll(".soft-card")].filter(visible).length,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflowingButtons,
      doneTextDecorations,
      mobileNavOverlaps,
      mobileNavClearance,
      oversizedCheckboxVisuals
    };
  });

  expect(result.bodyTextLength).toBeGreaterThan(10);
  expect(result.backgroundColor).toBe("rgb(248, 250, 252)");
  expect(result.rootChildren).toBeGreaterThan(0);
  expect(result.visibleCards).toBeGreaterThan(0);
  expect(result.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(result.overflowingButtons).toEqual([]);
  expect(result.doneTextDecorations).toEqual([]);
  expect(result.mobileNavOverlaps).toEqual([]);
  if (result.mobileNavClearance !== null) {
    expect(result.mobileNavClearance).toBeGreaterThanOrEqual(24);
  }
  expect(result.oversizedCheckboxVisuals).toEqual([]);
}

async function expectMobileDetailLayout(page: Page) {
  const result = await page.evaluate(() => {
    const detailLayout = document.querySelector(".memo-detail-layout");
    const todoPanel = document.querySelector(".memo-detail-todos");
    const editorPanel = document.querySelector(".memo-detail-editor");
    const actionBar = document.querySelector(".memo-detail-actions");
    const rows = [...document.querySelectorAll(".todo-edit-row")];
    const visible = (element: Element | null) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
    };

    return {
      hasDetailClass: visible(detailLayout),
      workspaceScrollTop: document.querySelector(".workspace-shell")?.scrollTop ?? 0,
      todoPanelComesBeforeEditor:
        Boolean(todoPanel && editorPanel) &&
        (todoPanel as Element).getBoundingClientRect().top <= (editorPanel as Element).getBoundingClientRect().top,
      actionBarVisible: visible(actionBar),
      crampedRows: rows
        .filter(visible)
        .map((row) => row.getBoundingClientRect())
        .filter((rect) => rect.width < 280).length,
      rowOverflows: rows
        .filter(visible)
        .map((row) => row.scrollWidth - row.clientWidth)
        .filter((overflow) => overflow > 2)
    };
  });

  expect(result.hasDetailClass).toBe(true);
  expect(result.workspaceScrollTop).toBe(0);
  expect(result.todoPanelComesBeforeEditor).toBe(true);
  expect(result.actionBarVisible).toBe(true);
  expect(result.crampedRows).toBe(0);
  expect(result.rowOverflows).toEqual([]);
}

async function expectPageText(page: Page, text: string) {
  await expect
    .poll(async () => page.evaluate((expected) => document.body.innerText.includes(expected), text))
    .toBe(true);
}
