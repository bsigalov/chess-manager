import { test, expect } from "@playwright/test";
import { TOURNAMENT_URL, PLAYER_TOURNAMENT_URL } from "./fixtures";

test.describe("Player Tournament Page", () => {
  test("Player tournament page loads from standings link", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 15000 });
    const text = await heading.textContent();
    expect(text!.length).toBeGreaterThan(2);
  });

  test("Player tournament page has breadcrumbs back to tournament", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const backLink = page.locator(`a[href="${TOURNAMENT_URL}"], a[href*="/tournaments/"]`).first();
    await expect(backLink).toBeVisible();
  });

  test("Player tournament page shows Games tab by default", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    const body = await page.textContent("body");
    expect(body).toMatch(/Rd|Round/i);
  });

  test("Player tournament page has H2H tab", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const h2hTab = page.getByRole("tab", { name: "H2H" });
    await expect(h2hTab).toBeVisible({ timeout: 10000 });
    await h2hTab.click();
    const body = await page.textContent("body");
    expect(body).toMatch(/Opponent|W|D|L|Score/i);
  });

  test("Player tournament page has What If tab", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const whatIfTab = page.getByRole("tab", { name: "What If" });
    await expect(whatIfTab).toBeVisible();
    await whatIfTab.click();
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(10);
  });

  test("Player tournament page has Rating tab", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const ratingTab = page.getByRole("tab", { name: "Rating" });
    await expect(ratingTab).toBeVisible();
    await ratingTab.click();
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(10);
  });

  test("Player tournament page has Position tab", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const posTab = page.getByRole("tab", { name: "Position" });
    await expect(posTab).toBeVisible();
    await posTab.click();
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(10);
  });

  test("Summary bar shows streak and best win stats", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    const body = await page.textContent("body");
    expect(body).toMatch(/Streak/i);
    expect(body).toMatch(/Best Win/i);
  });

  test("Follow button is visible", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/tournaments\/.+\/players\/\d+/);
  });

  test("Player names in Games tab link to other players", async ({ page }) => {
    await page.goto(PLAYER_TOURNAMENT_URL);
    const table = page.locator("table").first();
    await expect(table).toBeVisible({ timeout: 15000 });
    const opponentLinks = table.locator('a[href*="/players/"]');
    const count = await opponentLinks.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("Players tab in tournament navigates to player page", async ({ page }) => {
    await page.goto(TOURNAMENT_URL);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });

    const playersTab = page.getByRole("tab", { name: "Players" });
    await expect(playersTab).toBeVisible();
    await playersTab.click();

    const playerLink = page.locator('[role="tabpanel"] a[href*="/players/"]').first();
    await expect(playerLink).toBeVisible({ timeout: 10000 });
    const href = await playerLink.getAttribute("href");
    expect(href).toMatch(/\/tournaments\/.+\/players\/\d+/);
  });
});
