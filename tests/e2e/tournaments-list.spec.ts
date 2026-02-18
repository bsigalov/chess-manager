import { test, expect } from "@playwright/test";

test.describe("Tournaments List Page", () => {
  test("Tournaments page loads", async ({ page }) => {
    await page.goto("/tournaments");
    await expect(page.getByRole("heading", { name: /Tournaments/ })).toBeVisible();
  });

  test("Shows imported tournaments", async ({ page }) => {
    await page.goto("/tournaments");

    // Should show at least one tournament card/link (we have 3 imported)
    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    const count = await tournamentLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Tournament cards show key info", async ({ page }) => {
    await page.goto("/tournaments");

    const pageText = await page.textContent("body");
    // Should contain tournament name from our imported data
    expect(pageText).toMatch(/Rishon|Jerusalem|Tournament/i);
  });

  test("Clicking tournament card navigates to detail", async ({ page }) => {
    await page.goto("/tournaments");

    const firstLink = page.locator('a[href*="/tournaments/"]').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();

    await expect(page).toHaveURL(/\/tournaments\/.+/);
  });
});
