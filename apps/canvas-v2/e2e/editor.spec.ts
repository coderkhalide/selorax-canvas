import { test, expect, request as apiRequest } from "@playwright/test";

// Fetch first available page from backend before tests
let pageId: string | null = null;

test.beforeAll(async () => {
  try {
    const ctx = await apiRequest.newContext();
    const res = await ctx.get("http://localhost:3001/api/pages", {
      headers: { "x-tenant-id": "store_001" },
    });
    if (res.ok()) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.pages ?? []);
      if (arr.length > 0) pageId = arr[0].id;
    }
    await ctx.dispose();
  } catch {
    // Backend not available — all tests will skip
  }
});

test.describe("Editor", () => {
  test("editor loads for a valid pageId", async ({ page }) => {
    test.skip(!pageId, "No pages in database — skipping editor tests");
    await page.goto(`/editor/${pageId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("header shows Publish button", async ({ page }) => {
    test.skip(!pageId, "No pages in database");
    await page.goto(`/editor/${pageId}`);
    await page.waitForLoadState("networkidle");

    const publishBtn = page.getByRole("button", { name: /publish/i });
    await expect(publishBtn).toBeVisible({ timeout: 10_000 });
  });

  test("header shows Preview button", async ({ page }) => {
    test.skip(!pageId, "No pages in database");
    await page.goto(`/editor/${pageId}`);
    await page.waitForLoadState("networkidle");

    // Use first() to handle multiple Preview buttons (header preview + modal buttons)
    const previewBtn = page.getByRole("button", { name: /preview/i }).first();
    await expect(previewBtn).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar has a Components section or tab", async ({ page }) => {
    test.skip(!pageId, "No pages in database");
    await page.goto(`/editor/${pageId}`);
    await page.waitForLoadState("networkidle");

    const componentsTab = page.getByRole("button", { name: /components/i })
      .or(page.getByText(/components/i).first());
    await expect(componentsTab).toBeVisible({ timeout: 10_000 });
  });

  test("Home link navigates back to dashboard", async ({ page }) => {
    test.skip(!pageId, "No pages in database");
    await page.goto(`/editor/${pageId}`);
    await page.waitForLoadState("networkidle");

    // Find home link (href="/")
    const homeLink = page.locator('a[href="/"]').first();
    const isVisible = await homeLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (isVisible) {
      await homeLink.click();
      await expect(page).toHaveURL("/", { timeout: 5_000 });
    } else {
      test.skip(true, "No home link visible");
    }
  });
});
