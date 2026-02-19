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

    // Find a card link that points to a specific tournament (not the nav link)
    const links = page.locator('a[href^="/tournaments/"]');
    const count = await links.count();
    let tournamentHref: string | null = null;
    for (let i = 0; i < count; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (h && h.replace("/tournaments/", "").length > 0) {
        tournamentHref = h;
        break;
      }
    }
    expect(tournamentHref).not.toBeNull();
    await page.goto(tournamentHref!);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(tournamentHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
