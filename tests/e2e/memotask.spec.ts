import { expect, test, type Page } from "@playwright/test";
import { createApi } from "../../worker/api";
import { MemoryRepository } from "../../worker/repository/memory-repository";

test.beforeEach(async ({ page }) => {
  const repository = new MemoryRepository();
  const app = createApi({
    repository,
    now: () => "2026-06-22T12:00:00.000Z",
    appEncryptionKey: "test-encryption-key-for-e2e",
    fetchAi: async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "AI 生成 Memo",
                todos: [{ title: "检查 AI 草稿" }, { title: "确认发布前可编辑" }]
              })
            }
          }
        ]
      })
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    const response = await app.request(request.url(), {
      method: request.method(),
      headers: await request.allHeaders(),
      body: request.postData() ?? undefined
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text()
    });
  });
});

test("pc queue settings history and manifest smoke", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "pc", "PC smoke runs only on the desktop project.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "队列" })).toBeVisible();
  await expect(page.getByText("Today")).toHaveCount(0);
  await expect(page.getByText("Upcoming")).toHaveCount(0);
  await expect(page.getByText("订阅")).toHaveCount(0);

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe("standalone");

  await publishMemo(page, "低优先 Memo", "稍后处理", "稍后确认");
  await publishMemo(page, "高优先 Memo", "马上处理", "马上确认");
  await expectMemoOrder(page, ["高优先 Memo", "低优先 Memo"]);
  await page.getByRole("button", { name: "下移 高优先 Memo" }).click();
  await expectMemoOrder(page, ["低优先 Memo", "高优先 Memo"]);

  await page.getByRole("button", { name: "设置" }).first().click();
  await page.getByLabel("接口地址").fill("https://api.example.com/v1");
  await page.getByLabel("API 密钥").fill("test-key-1234567890abcdef");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByText("已保存 AI 设置")).toBeVisible();
  await page.getByRole("button", { name: "导出 JSON" }).click();
  await expect(page.getByText("JSON 导出已生成")).toBeVisible();
});

test("android capture complete history restore smoke", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "android", "Android smoke runs only on the mobile project.");

  await page.goto("/");
  await page.getByRole("button", { name: "记录" }).last().click();
  await page.getByLabel("原始 Memo").fill("移动端检查 Memo");
  await page.getByLabel("Memo 标题").fill("移动端检查");
  await page.getByLabel("新增 Todo").fill("完成移动端验证");
  await page.getByRole("button", { name: "添加 Todo" }).click();
  await page.getByRole("button", { name: "发布" }).click();

  await expect(page.getByRole("heading", { name: "队列" })).toBeVisible();
  await page.getByRole("checkbox", { name: "完成移动端验证" }).click();
  await expect(page.getByText("还没有 Memo")).toBeVisible();

  await page.getByRole("button", { name: "打开历史" }).click();
  await expect(page.getByRole("heading", { name: "移动端检查" })).toBeVisible();
  await page.getByRole("button", { name: "恢复 移动端检查" }).click();
  await expect(page.getByRole("heading", { name: "队列" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "移动端检查" })).toBeVisible();
});

async function publishMemo(page: Page, title: string, content: string, todo: string) {
  await page.getByRole("button", { name: "记录" }).first().click();
  await page.getByLabel("原始 Memo").fill(content);
  await page.getByLabel("Memo 标题").fill(title);
  await page.getByLabel("新增 Todo").fill(todo);
  await page.getByRole("button", { name: "添加 Todo" }).click();
  await page.getByRole("button", { name: "发布" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

async function expectMemoOrder(page: Page, titles: string[]) {
  await expect
    .poll(async () => {
      return page.locator("article.memo-card h2").evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    })
    .toEqual(titles);
}
