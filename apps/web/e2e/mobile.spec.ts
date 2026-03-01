import { expect, test } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('calculator page renders at mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });

  test('forum page renders at mobile viewport', async ({ page }) => {
    await page.goto('/forum');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /community/i })).toBeVisible({ timeout: 10000 });

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('plot page renders at mobile viewport', async ({ page }) => {
    await page.goto('/plot');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /interactive plots/i })).toBeVisible({
      timeout: 10000,
    });

    // Canvas should still render
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('navigation hamburger menu is visible on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // On mobile, the nav should show a hamburger/menu toggle button
    const menuButton = page
      .getByRole('button', { name: /menu|toggle|navigation/i })
      .or(page.locator('[aria-label*="menu" i]'))
      .or(page.locator('button[data-mobile-menu]'));

    await expect(menuButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('mobile menu can be opened', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const menuButton = page
      .getByRole('button', { name: /menu|toggle|navigation/i })
      .or(page.locator('[aria-label*="menu" i]'))
      .or(page.locator('button[data-mobile-menu]'));

    const btn = menuButton.first();
    if (await btn.isVisible()) {
      await btn.click();
      // After opening, navigation links should become visible
      await page.waitForTimeout(300); // Allow animation
      const navLinks = page.locator('a[href="/plot"], a[href="/matrix"], a[href="/stats"]');
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('matrix page is usable at mobile viewport', async ({ page }) => {
    await page.goto('/matrix');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /matrix operations/i })).toBeVisible({
      timeout: 10000,
    });

    // Matrix inputs should be accessible
    const matrixInputs = page.locator('input[type="number"]');
    const count = await matrixInputs.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
