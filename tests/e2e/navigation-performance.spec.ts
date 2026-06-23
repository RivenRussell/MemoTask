import { expect, test } from "@playwright/test";

test("primary navigation gives visible feedback without waiting on page data", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLocalApp = requestUrl.origin === "http://127.0.0.1:5173" || requestUrl.origin === "http://localhost:5173";
    if (!isLocalApp || !requestUrl.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseForApiPath(requestUrl.pathname))
    });
  });

  await page.goto("/memos");
  await expect(page.getByRole("heading", { name: "队列", exact: true })).toBeVisible();

  const headingDelay = await page.evaluate(async () => {
    const settingsButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "设置" && button.getClientRects().length > 0
    ) as HTMLButtonElement | undefined;
    if (!settingsButton) {
      throw new Error("Settings button not found");
    }

    return new Promise<number>((resolve, reject) => {
      let done = false;
      let observer: MutationObserver;
      let timeout: number;
      const startedAt = performance.now();
      const finishIfVisible = () => {
        const heading = document.querySelector("h1");
        if (done || heading?.textContent?.trim() !== "设置") {
          return;
        }

        done = true;
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve(performance.now() - startedAt);
      };

      observer = new MutationObserver(finishIfVisible);
      timeout = window.setTimeout(() => {
        if (!done) {
          observer.disconnect();
          reject(new Error("Settings heading did not appear"));
        }
      }, 1_000);

      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      settingsButton.click();
      finishIfVisible();
    });
  });
  await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();

  expect(headingDelay).toBeLessThan(500);
});

test("todo checkbox gives visible feedback without waiting on writes", async ({ page }) => {
  let todoDone = false;
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLocalApp = requestUrl.origin === "http://127.0.0.1:5173" || requestUrl.origin === "http://localhost:5173";
    if (!isLocalApp || !requestUrl.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_500));
    if (requestUrl.pathname === "/api/todos/perf-todo/toggle") {
      todoDone = !todoDone;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ todo: { id: "perf-todo", status: todoDone ? "done" : "todo" } })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseForApiPath(requestUrl.pathname, todoDone))
    });
  });

  await page.goto("/memos");
  await expect(page.getByText("性能反馈 Memo")).toBeVisible({ timeout: 4_000 });

  const checkbox = page.getByRole("checkbox", { name: "立即显示勾选" });
  const startedAt = Date.now();
  await checkbox.click();
  await expect(checkbox).toBeChecked({ timeout: 500 });
  const feedbackDelay = Date.now() - startedAt;

  expect(feedbackDelay).toBeLessThan(500);
});

function responseForApiPath(pathname: string, todoDone = false) {
  if (pathname === "/api/ai/settings") {
    return {
      settings: {
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        apiKeyMask: null,
        promptTemplate: "你是 MemoTask 的整理助手。"
      }
    };
  }

  if (pathname === "/api/sync/status") {
    return { status: { ok: true, checkedAt: "2026-06-23T08:42:00.000Z" } };
  }

  if (pathname === "/api/memos") {
    return {
      memos: [
        {
          id: "perf-memo",
          userId: "default",
          title: "性能反馈 Memo",
          content: "验证点击反馈不等待慢接口。",
          status: "active",
          historyReason: null,
          sortOrder: 1,
          lastActiveSortOrder: null,
          autoArchiveSuppressedUntilChange: false,
          aiState: "idle",
          aiError: null,
          createdAt: "2026-06-23T09:05:00.000Z",
          updatedAt: "2026-06-23T09:05:00.000Z",
          publishedAt: "2026-06-23T09:05:00.000Z",
          historyAt: null,
          deletedAt: null,
          todos: [
            {
              id: "perf-todo",
              memoId: "perf-memo",
              title: "立即显示勾选",
              notes: null,
              status: todoDone ? "done" : "todo",
              sortOrder: 1,
              generatedByAi: false,
              createdAt: "2026-06-23T09:05:00.000Z",
              updatedAt: "2026-06-23T09:05:00.000Z",
              completedAt: todoDone ? "2026-06-23T09:05:01.000Z" : null,
              deletedAt: null
            },
            {
              id: "perf-todo-other",
              memoId: "perf-memo",
              title: "保持队列存在",
              notes: null,
              status: "todo",
              sortOrder: 2,
              generatedByAi: false,
              createdAt: "2026-06-23T09:05:00.000Z",
              updatedAt: "2026-06-23T09:05:00.000Z",
              completedAt: null,
              deletedAt: null
            }
          ]
        }
      ]
    };
  }

  if (pathname === "/api/drafts/recent") {
    return { drafts: [] };
  }

  if (pathname === "/api/history") {
    return { memos: [] };
  }

  return {};
}
