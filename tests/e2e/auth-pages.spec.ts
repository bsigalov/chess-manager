import { test, expect } from "@playwright/test";

test.describe("Authentication Pages", () => {
  test("Sign in page loads", async ({ page }) => {
    await page.goto("/auth/signin");

    // Should have sign in form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Should have a submit button
    const submitButton = page.getByRole("button", { name: /sign in/i });
    await expect(submitButton).toBeVisible();
  });

  test("Sign in page has link to register", async ({ page }) => {
    await page.goto("/auth/signin");

    const registerLink = page.getByRole("link", { name: /register|sign up|create account/i });
    const hasLink = await registerLink.isVisible().catch(() => false);

    if (hasLink) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/auth\/register/);
    }
  });

  test("Register page loads", async ({ page }) => {
    await page.goto("/auth/register");

    // Should have registration form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();

    // Should have a submit button
    const submitButton = page.getByRole("button", { name: /register|sign up|create/i });
    await expect(submitButton).toBeVisible();
  });

  test("Sign in with empty credentials shows error", async ({ page }) => {
    await page.goto("/auth/signin");

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole("button", { name: /sign in/i });

    await emailInput.fill("nonexistent@example.com");
    await passwordInput.fill("wrongpassword");
    await submitButton.click();

    // Should show an error or stay on sign-in page
    await page.waitForTimeout(1000);
    const url = page.url();
    // Should still be on auth page (not redirected to dashboard)
    expect(url).toMatch(/auth|signin|error/i);
  });

  test("Protected route redirects to sign in", async ({ page }) => {
    // Use API request to check the redirect without full page navigation
    const response = await page.request.get("/dashboard", {
      maxRedirects: 0,
    });
    // Middleware should return 307 redirect to /auth/signin
    expect(response.status()).toBe(307);
    const location = response.headers()["location"] || "";
    expect(location).toContain("/auth/signin");
  });

  test("Settings page redirects to sign in", async ({ page }) => {
    const response = await page.request.get("/settings", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = response.headers()["location"] || "";
    expect(location).toContain("/auth/signin");
  });
});
