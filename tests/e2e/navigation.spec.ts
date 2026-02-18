import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Header shows all navigation links", async ({ page }) => {
    await page.goto("/");

    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Logo/brand link
    await expect(header.getByRole("link", { name: /ChessManager/ })).toBeVisible();

    // Desktop nav links
    await expect(header.getByRole("link", { name: "Tournaments" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Players" })).toBeVisible();
  });

  test("Logo navigates to homepage", async ({ page }) => {
    await page.goto("/tournaments");
    await page.getByRole("link", { name: /ChessManager/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("Tournaments nav link works", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "Tournaments" }).click();
    await expect(page).toHaveURL("/tournaments");
  });

  test("Players nav link works", async ({ page }) => {
    await page.goto("/");
    // Use the visible desktop nav link (not mobile menu)
    await page.locator("header nav").getByRole("link", { name: "Players" }).click();
    await expect(page).toHaveURL("/players", { timeout: 5_000 });
  });

  test("Sign in link visible for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Sign in/ })).toBeVisible();
  });

  test("Theme toggle button exists", async ({ page }) => {
    await page.goto("/");
    const themeButton = page.getByRole("button", { name: /Toggle theme/ });
    await expect(themeButton).toBeVisible();
  });

  test("Theme toggle switches dark/light mode", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const themeButton = page.getByRole("button", { name: /Toggle theme/ });

    // Get initial theme
    const initialClass = await html.getAttribute("class");

    // Toggle theme
    await themeButton.click();
    await page.waitForTimeout(300);

    const newClass = await html.getAttribute("class");
    // Theme class should have changed
    expect(newClass).not.toBe(initialClass);
  });
});
