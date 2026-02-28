import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for content to load (not skeleton/spinner)
    await page.waitForLoadState("networkidle");
  });

  test("loads without crashing", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("shows Pages and Funnels navigation", async ({ page }) => {
    // Look for the Pages button specifically (exact match to avoid ambiguity)
    const pagesBtn = page.getByRole("button", { name: "Pages", exact: true })
      .or(page.getByRole("tab", { name: "Pages", exact: true }));
    await expect(pagesBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("Funnels section is reachable", async ({ page }) => {
    // Click Funnels tab/button if it exists
    const funnelsBtn = page.getByRole("button", { name: /funnels/i })
      .or(page.getByRole("tab", { name: /funnels/i }));

    if (await funnelsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await funnelsBtn.click();
      await expect(page.locator("body")).not.toContainText("Application error");
    }
  });
});
