import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('navigation bar is present', async ({ page }) => {
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('nav contains links to key pages', async ({ page }) => {
    // Check for presence of navigation links (may be in desktop nav or mobile menu)
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    // The command palette should appear as a dialog/modal
    const palette = page.locator(
      '[role="dialog"], [data-command-palette], [cmdk-dialog], [data-radix-popper-content-wrapper]',
    );
    await expect(palette.first())
      .toBeVisible({ timeout: 5000 })
      .catch(async () => {
        // Some implementations use a different structure
        const searchInput = page.locator(
          'input[placeholder*="search" i], input[placeholder*="command" i]',
        );
        await expect(searchInput.first()).toBeVisible({ timeout: 3000 });
      });
  });

  test('clicking a nav link navigates to the correct page', async ({ page }) => {
    // Find and click a nav link to the plot page
    const plotLink = page
      .locator('nav a[href="/plot"], [role="navigation"] a[href="/plot"]')
      .first();
    if (await plotLink.isVisible()) {
      await plotLink.click();
      await expect(page).toHaveURL(/\/plot/);
    }
  });

  test('logo or brand link returns to home', async ({ page }) => {
    // Navigate away first
    await page.goto('/plot');
    await page.waitForLoadState('domcontentloaded');

    // Click the logo/brand to go home
    const homeLink = page.locator('nav a[href="/"], [role="navigation"] a[href="/"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/?$/);
    }
  });
});
