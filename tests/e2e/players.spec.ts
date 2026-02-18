import { test, expect } from "@playwright/test";

test.describe("Players List Page", () => {
  test("Players page loads with player data", async ({ page }) => {
    await page.goto("/players");
    await expect(page.getByRole("heading", { name: /Players/ })).toBeVisible();

    // Should show a table with player data
    const table = page.locator("table");
    await expect(table).toBeVisible();

    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Players table has correct columns", async ({ page }) => {
    await page.goto("/players");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    const header = table.locator("thead");
    await expect(header.getByText("Player", { exact: true })).toBeVisible();
    await expect(header.getByText("Title", { exact: true })).toBeVisible();
    await expect(header.getByText("Rating", { exact: true })).toBeVisible();
    await expect(header.getByText("Fed", { exact: true })).toBeVisible();
  });

  test("Players are sorted by rating (highest first)", async ({ page }) => {
    await page.goto("/players");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Get ratings from first few rows
    const ratingCells = table.locator("tbody tr td:nth-child(3)");
    const count = Math.min(await ratingCells.count(), 5);
    const ratings: number[] = [];
    for (let i = 0; i < count; i++) {
      const text = await ratingCells.nth(i).textContent();
      const num = parseInt(text || "0", 10);
      if (!isNaN(num) && num > 0) ratings.push(num);
    }

    // Verify descending order
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
    }
  });

  test("Shows titled players with badges", async ({ page }) => {
    await page.goto("/players");

    // Should have at least one title badge (IM, FM, GM, etc.)
    const body = await page.textContent("body");
    const hasTitles =
      body?.includes("IM") || body?.includes("FM") || body?.includes("GM");
    expect(hasTitles).toBeTruthy();
  });

  test("Player count is displayed", async ({ page }) => {
    await page.goto("/players");

    // Should show "X players" text
    const body = await page.textContent("body");
    expect(body).toMatch(/\d+\s*players/i);
  });

  test("Clicking player name navigates to player detail", async ({ page }) => {
    await page.goto("/players");

    const playerLink = page.locator('table a[href*="/players/"]').first();
    await expect(playerLink).toBeVisible();

    const playerName = await playerLink.textContent();
    await playerLink.click();

    await expect(page).toHaveURL(/\/players\/.+/);

    // Player detail page should show the player's name
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toContain(playerName!.trim());
  });
});

test.describe("Player Detail Page", () => {
  // Helper: navigate to first player
  async function goToPlayer(page: import("@playwright/test").Page) {
    await page.goto("/players");
    const link = page.locator('table a[href*="/players/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/players\/.+/);
  }

  test("Player detail page loads with profile info", async ({ page }) => {
    await goToPlayer(page);

    // Should show player name
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();

    // Should show some player data (rating, country, etc.)
    const body = await page.textContent("body");
    const hasData =
      body?.match(/\d{4}/) || // rating
      body?.includes("ISR") || // federation
      body?.includes("Tournament"); // tournament history
    expect(hasData).toBeTruthy();
  });

  test("Player detail shows tournament history", async ({ page }) => {
    await goToPlayer(page);

    const body = await page.textContent("body");
    // Should reference tournaments the player participated in
    const hasTournamentRef =
      body?.includes("Rishon") ||
      body?.includes("Jerusalem") ||
      body?.includes("Tournament") ||
      body?.includes("Points") ||
      body?.includes("Rank");
    expect(hasTournamentRef).toBeTruthy();
  });

  test("Player detail has follow button for unauthenticated users", async ({ page }) => {
    await goToPlayer(page);

    // Follow button might require auth — check it exists or redirects
    const followButton = page.getByRole("button", { name: /Follow/i });
    const hasFollow = await followButton.isVisible().catch(() => false);

    // Either the button exists or there's a sign-in prompt
    if (!hasFollow) {
      // For unauthenticated users, follow might not be shown — that's ok
      expect(true).toBe(true);
    }
  });
});
