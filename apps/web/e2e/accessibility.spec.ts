import { expect, test } from '@playwright/test';

test.describe('Accessibility', () => {
  test('calculator page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigation landmark
    const nav = page.locator('[role="navigation"], nav');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });

    // Main content landmark
    const main = page.locator('[role="main"], main');
    await expect(main.first()).toBeVisible({ timeout: 10000 });

    // Heading hierarchy: h1 should exist
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1.first()).toBeVisible({ timeout: 10000 });
  });

  test('matrix page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/matrix');
    await page.waitForLoadState('domcontentloaded');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1.first()).toBeVisible({ timeout: 10000 });

    // Should have h2 for subsections
    const h2 = page.getByRole('heading', { level: 2 });
    const h2Count = await h2.count();
    expect(h2Count).toBeGreaterThanOrEqual(1);
  });

  test('forum page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/forum');
    await page.waitForLoadState('domcontentloaded');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1.first()).toBeVisible({ timeout: 10000 });
  });

  test('plot page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/plot');
    await page.waitForLoadState('domcontentloaded');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1.first()).toBeVisible({ timeout: 10000 });
  });

  test('focus is visible when tabbing through interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Tab to first focusable element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible({ timeout: 5000 });
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const buttons = page.getByRole('button');
    const count = await buttons.count();

    // Check first 5 buttons have accessible names
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const name = (await button.getAttribute('aria-label')) ?? (await button.textContent()) ?? '';
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  test('PDE page has labeled form controls', async ({ page }) => {
    await page.goto('/pde');
    await page.waitForLoadState('domcontentloaded');

    // Sliders should have associated labels
    const labels = page.locator('label[for]');
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('game theory page has proper table semantics', async ({ page }) => {
    await page.goto('/game-theory');
    await page.waitForLoadState('domcontentloaded');

    // The payoff matrix uses role="table" for accessibility
    const table = page.locator('[role="table"]');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('settings page theme controls are keyboard accessible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Tab to interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toBeVisible({ timeout: 5000 });
  });

  test('key pages have no duplicate h1 elements', async ({ page }) => {
    const pages = ['/', '/plot', '/matrix', '/forum', '/stats'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const h1Count = await page.getByRole('heading', { level: 1 }).count();
      expect(h1Count).toBeLessThanOrEqual(1);
    }
  });
});
