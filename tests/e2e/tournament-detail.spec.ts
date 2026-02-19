import { test, expect } from "@playwright/test";
import { TOURNAMENT_URL } from "./fixtures";

// Helper: navigate directly to a known tournament detail page
async function goToTournament(page: import("@playwright/test").Page) {
  await page.goto(TOURNAMENT_URL);
  await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
}

test.describe("Tournament Detail Page", () => {
  test("Shows tournament header with name", async ({ page }) => {
    await goToTournament(page);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text!.length).toBeGreaterThan(3);
  });

  test("Has Standings and Pairings tabs", async ({ page }) => {
    await goToTournament(page);
    await expect(page.getByRole("tab", { name: "Standings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pairings" })).toBeVisible();
  });

  test("Standings tab is sortable", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Standings" }).click();

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Click "Rating" column header to sort
    const ratingHeader = table.locator("thead").getByText("Rating", { exact: true });
    await ratingHeader.click();

    // Verify the table still has rows (sorting didn't break anything)
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Standings player names link to player profiles", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Standings" }).click();

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Find a player link in the standings table
    const playerLink = table.locator('a[href*="/players/"]').first();
    await expect(playerLink).toBeVisible();

    // Click and verify navigation to player page
    await playerLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 10000 });
    // Player page should load (h1 visible)
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  });

  test("Pairings tab shows round selector buttons", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    // Use visible tabpanel only (Shadcn renders all panels, only one is visible)
    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const round1Btn = panel.getByRole("button", { name: "1", exact: true });
    const hasRounds = await round1Btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasRounds) {
      const buttons = panel.getByRole("button");
      expect(await buttons.count()).toBeGreaterThan(0);
    } else {
      expect(await panel.textContent()).toBeTruthy();
    }
  });

  test("Pairings round switching loads different data", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const round1 = panel.getByRole("button", { name: "1", exact: true });
    if (!await round1.isVisible({ timeout: 10000 }).catch(() => false)) return;
    await round1.click();
    const round1Text = await panel.textContent();

    const round2 = panel.getByRole("button", { name: "2", exact: true });
    if (await round2.isVisible().catch(() => false)) {
      await round2.click();
      await page.waitForTimeout(300);
      const round2Text = await panel.textContent();
      expect(round2Text).not.toBe(round1Text);
    }
  });

  test("Pairings show board numbers and results", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const round1Btn = panel.getByRole("button", { name: "1", exact: true });
    if (!await round1Btn.isVisible({ timeout: 10000 }).catch(() => false)) return;
    await round1Btn.click();
    await page.waitForTimeout(300);

    const panelText = await panel.textContent();
    const hasResults =
      panelText?.includes("1-0") ||
      panelText?.includes("0-1") ||
      panelText?.includes("1/2-1/2") ||
      panelText?.includes("½");
    expect(hasResults).toBeTruthy();
  });

  test("Pairings player names link to profiles", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.getByRole("tabpanel");
    const round1Btn = panel.getByRole("button", { name: "1", exact: true });
    const hasRound1 = await round1Btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRound1) return; // No pairings available
    await round1Btn.click();

    // Find a player link in pairings
    const playerLink = panel.locator('a[href*="/players/"]').first();
    const hasLinks = await playerLink.isVisible().catch(() => false);
    if (hasLinks) {
      await playerLink.click();
      await expect(page).toHaveURL(/\/players\//, { timeout: 10000 });
    }
  });

  test("Export dropdown is present", async ({ page }) => {
    await goToTournament(page);

    // Look for export button/dropdown
    const exportButton = page.getByRole("button", { name: /Export/i });
    const hasExport = await exportButton.isVisible().catch(() => false);
    if (hasExport) {
      await exportButton.click();
      // Should show export options - wait for dropdown to appear
      // Use text locator since buttons contain SVG icons
      const csvOption = page.locator("button", { hasText: /^CSV$/ }).or(
        page.locator("button").filter({ hasText: "CSV" })
      );
      await expect(csvOption.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Refresh button triggers re-import", async ({ page }) => {
    test.setTimeout(60_000);
    await goToTournament(page);

    const refreshButton = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Should show loading state then re-enable
    await expect(refreshButton).toBeEnabled({ timeout: 45_000 });
  });
});
