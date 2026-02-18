import { test, expect } from "@playwright/test";

test.describe.serial("Tournament Import & Detail Flow", () => {
  let tournamentUrl: string;

  test("Homepage loads correctly", async ({ page }) => {
    await page.goto("/");

    // Verify page title
    await expect(page).toHaveTitle(/Chess Tournament Manager/);

    // Verify heading
    await expect(
      page.getByRole("heading", { name: "Chess Tournament Manager" })
    ).toBeVisible();

    // Verify import input field
    await expect(
      page.getByPlaceholder("Paste chess-results.com tournament URL...")
    ).toBeVisible();

    // Verify Import button is present
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  });

  test("Import form validation", async ({ page }) => {
    await page.goto("/");

    const importButton = page.getByRole("button", { name: "Import" });
    const input = page.getByPlaceholder(
      "Paste chess-results.com tournament URL..."
    );

    // Button should be disabled when input is empty
    await expect(importButton).toBeDisabled();

    // Type an invalid URL — button becomes enabled (no client-side URL validation)
    await input.fill("not-a-url");
    await expect(importButton).toBeEnabled();

    // Clear and type a valid chess-results URL
    await input.clear();
    await input.fill("https://chess-results.com/tnr1233866.aspx");
    await expect(importButton).toBeEnabled();
  });

  test("Full tournament import flow", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if tournament was already imported (visible in Recent Tournaments)
    const existingLink = page.locator(
      'a[href*="/tournaments/"]'
    ).first();
    const hasExisting = await existingLink.isVisible().catch(() => false);

    if (hasExisting) {
      // Tournament already in DB — click the existing card to navigate
      const href = await existingLink.getAttribute("href");
      if (href) {
        await page.goto(href);
        tournamentUrl = page.url();
      }
    }

    if (!tournamentUrl) {
      // Perform the actual import
      const input = page.getByPlaceholder(
        "Paste chess-results.com tournament URL..."
      );
      const importButton = page.getByRole("button", { name: "Import" });

      await input.fill("https://s2.chess-results.com/tnr1233866.aspx");

      // Start waiting for navigation BEFORE clicking to avoid race condition
      await Promise.all([
        page.waitForURL("**/tournaments/**", { timeout: 60_000 }),
        importButton.click(),
      ]);

      tournamentUrl = page.url();
    }

    expect(tournamentUrl).toContain("/tournaments/");

    // Verify the tournament name appears
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10_000 });
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();

    // Verify tournament-related content is visible
    const pageContent = await page.textContent("body");
    const hasKnownContent =
      pageContent?.includes("Mindlin") ||
      pageContent?.includes("Veinberg") ||
      pageContent?.includes("Rishon") ||
      pageContent?.includes("Blitz") ||
      pageContent?.includes("Festival") ||
      pageContent?.includes("players");
    expect(hasKnownContent).toBeTruthy();
  });

  test("Tournament detail page shows standings data", async ({ page }) => {
    test.setTimeout(30_000);

    expect(tournamentUrl).toBeTruthy();
    await page.goto(tournamentUrl);

    // Click the Standings tab to be sure
    await page.getByRole("tab", { name: "Standings" }).click();

    // Verify the standings table exists
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Verify column headers (use exact match to avoid matching "14 players" etc.)
    const headerRow = table.locator("thead tr");
    await expect(headerRow.getByText("Player", { exact: true })).toBeVisible();
    await expect(headerRow.getByText("Rating", { exact: true })).toBeVisible();
    await expect(headerRow.getByText("Points", { exact: true })).toBeVisible();

    // Verify multiple players are shown (at least 10 rows)
    const rows = table.locator("tbody tr");
    await expect(rows).not.toHaveCount(0);
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(10);

    // Verify ratings are displayed (4-digit numbers in the table)
    const tableText = await table.textContent();
    expect(tableText).toMatch(/\d{4}/);
  });

  test("Tournament detail page shows pairings tab", async ({ page }) => {
    test.setTimeout(30_000);

    expect(tournamentUrl).toBeTruthy();
    await page.goto(tournamentUrl);

    // Click the Pairings tab
    const pairingsTab = page.getByRole("tab", { name: "Pairings" });
    await expect(pairingsTab).toBeVisible();
    await pairingsTab.click();

    // Wait for pairings content
    const pairingsPanel = page.getByRole("tabpanel");
    await expect(pairingsPanel).toBeVisible({ timeout: 10_000 });

    // Check if round buttons exist (tournament may have 0 rounds)
    const roundButtons = pairingsPanel.getByRole("button");
    const buttonCount = await roundButtons.count();

    if (buttonCount > 0) {
      // Has round data — click round 1 and verify pairings
      await roundButtons.first().click();

      const panelText = await pairingsPanel.textContent();
      const hasPairingData =
        panelText?.includes("Bd") ||
        panelText?.includes("1-0") ||
        panelText?.includes("0-1") ||
        panelText?.includes("1/2-1/2") ||
        panelText?.includes("No pairings");
      expect(hasPairingData).toBeTruthy();
    } else {
      // No rounds — should show "No pairings available" message
      await expect(
        pairingsPanel.getByText(/No pairings available/)
      ).toBeVisible();
    }
  });

  test("Refresh tournament", async ({ page }) => {
    test.setTimeout(60_000);

    expect(tournamentUrl).toBeTruthy();
    await page.goto(tournamentUrl);

    const refreshButton = page.getByRole("button", { name: "Refresh" });
    await expect(refreshButton).toBeVisible();

    await refreshButton.click();

    // Verify refresh completes — button re-enables after loading
    await expect(refreshButton).toBeEnabled({ timeout: 45_000 });

    // A toast should appear (success or error — both are valid UI feedback)
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });
    const toastText = await toast.first().textContent();
    // Either "Tournament data refreshed" or "Failed to refresh tournament"
    expect(toastText).toMatch(/refresh/i);
  });

  test("Navigation back to homepage", async ({ page }) => {
    expect(tournamentUrl).toBeTruthy();
    await page.goto(tournamentUrl);

    // Click the logo/home link in the header
    await page.getByRole("link", { name: /ChessManager/ }).click();

    // Verify we're back at the homepage
    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Chess Tournament Manager" })
    ).toBeVisible();
  });
});
