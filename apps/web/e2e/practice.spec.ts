import { test, expect } from '@playwright/test';

test.describe('Practice Mode Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1 }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('practice configuration options are present', async ({ page }) => {
    // The practice page has topic/difficulty selectors
    const selectors = page.locator('select, [role="combobox"], button').filter({ hasText: /.{2,}/ });
    const count = await selectors.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('start or begin practice button exists', async ({ page }) => {
    const startButton = page.getByRole('button', { name: /start|begin|practice/i }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
  });

  test('topic selection is available', async ({ page }) => {
    // Should have dropdown or buttons for selecting math topics
    const topicSelector = page.locator('[role="combobox"]')
      .or(page.getByRole('button', { name: /topic|all/i }))
      .or(page.locator('select'));
    await expect(topicSelector.first()).toBeVisible({ timeout: 10000 });
  });
});
