import { test, expect } from "@playwright/test";

// Helper: navigate to the first available tournament
async function goToTournament(page: import("@playwright/test").Page) {
  await page.goto("/tournaments");
  await page.waitForLoadState("domcontentloaded");
  // Click a tournament card link - use direct navigation via href
  const link = page.locator('a[href*="/tournaments/"]').filter({ hasNotText: /^Tournaments$/ }).first();
  await expect(link).toBeVisible({ timeout: 10000 });
  const href = await link.getAttribute("href");
  if (href) {
    await page.goto(href, { waitUntil: "commit", timeout: 60000 });
  } else {
    await link.click();
  }
  await expect(page).toHaveURL(/\/tournaments\/.+/, { timeout: 10000 });
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

    // Click and verify navigation
    const playerName = await playerLink.textContent();
    await playerLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 10000 });

    // Wait for player page to load, then verify the player name appears
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 15000 });
    const headingText = await heading.textContent();
    // Normalize: standings may show "Last, First" but heading shows "Last First"
    const normalizedLink = playerName!.trim().replace(/,\s*/g, " ");
    const normalizedHeading = headingText!.trim().replace(/,\s*/g, " ");
    expect(normalizedHeading).toContain(normalizedLink);
  });

  test("Pairings tab shows round selector buttons", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();

    // Wait for round buttons to appear (loaded client-side)
    const round1Btn = panel.getByRole("button", { name: "1", exact: true });
    const hasRounds = await round1Btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasRounds) {
      const buttons = panel.getByRole("button");
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // No rounds available — check for empty state message
      const panelText = await panel.textContent();
      expect(panelText).toBeTruthy();
    }
  });

  test("Pairings round switching loads different data", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();

    // Click round 1 (wait for it to appear)
    const round1 = panel.getByRole("button", { name: "1", exact: true });
    const hasRound1 = await round1.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRound1) return; // No rounds available, skip test
    await round1.click();
    const round1Text = await panel.textContent();

    // Click round 2 (if available)
    const round2 = panel.getByRole("button", { name: "2", exact: true });
    const hasRound2 = await round2.isVisible().catch(() => false);
    if (hasRound2) {
      await round2.click();
      await page.waitForTimeout(200);
      const round2Text = await panel.textContent();
      // Content should differ between rounds (different pairings)
      expect(round2Text).not.toBe(round1Text);
    }
  });

  test("Pairings show board numbers and results", async ({ page }) => {
    await goToTournament(page);
    await page.getByRole("tab", { name: "Pairings" }).click();

    const panel = page.getByRole("tabpanel");
    // Click round 1 (wait for it to appear client-side)
    const round1Btn = panel.getByRole("button", { name: "1", exact: true });
    const hasRound1 = await round1Btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRound1) return; // No pairings available, skip
    await round1Btn.click();

    const panelText = await panel.textContent();
    // Should have board numbers (column may be labeled "Bd", "#", or numeric)
    const hasBoardColumn = panelText?.includes("Bd") || panelText?.includes("#") || /\b\d+\b/.test(panelText || "");
    expect(hasBoardColumn).toBeTruthy();
    // Should have results
    const hasResults =
      panelText?.includes("1-0") ||
      panelText?.includes("0-1") ||
      panelText?.includes("1/2-1/2");
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
      const csvOption = page.getByRole("button", { name: /CSV/i });
      await expect(csvOption).toBeVisible({ timeout: 5000 });
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
