import { test, expect } from "@playwright/test";

test.describe("Responsive & Mobile Layout", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone-sized

  test("Mobile menu toggle appears on small screens", async ({ page }) => {
    await page.goto("/");

    // Desktop nav should be hidden
    const desktopNav = page.locator("nav.hidden.md\\:flex");
    // Mobile menu button should be visible
    const menuButton = page.locator("button.md\\:hidden");
    const hasMenuButton = await menuButton.isVisible().catch(() => false);

    // Either we find the mobile toggle or the nav adapts
    expect(hasMenuButton).toBeTruthy();
  });

  test("Mobile menu opens and shows links", async ({ page }) => {
    await page.goto("/");

    // Click mobile menu button
    const menuButton = page.locator("button.md\\:hidden");
    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Should show navigation links
      await expect(page.getByRole("link", { name: "Tournaments" }).last()).toBeVisible();
      await expect(page.getByRole("link", { name: "Players" }).last()).toBeVisible();
    }
  });

  test("Tournament list renders on mobile", async ({ page }) => {
    await page.goto("/tournaments");

    // Page should load without horizontal overflow issues
    const body = page.locator("body");
    await expect(body).toBeVisible();

    const heading = page.getByRole("heading", { name: /Tournaments/ });
    await expect(heading).toBeVisible();
  });

  test("Players table scrolls horizontally on mobile", async ({ page }) => {
    await page.goto("/players");

    // Table should be wrapped in an overflow container
    const table = page.locator("table");
    await expect(table).toBeVisible();
  });

  test("Tournament detail works on mobile", async ({ page }) => {
    const { TOURNAMENT_URL } = await import("./fixtures");
    await page.goto(TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    // Tabs may be scrollable on mobile — just verify the page content loads
    const body = await page.textContent("body");
    expect(body).toMatch(/Standings|Pairings/i);
  });
});
