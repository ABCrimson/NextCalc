import { test, expect } from '@playwright/test';

test.describe('Learning Hub Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1 }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('topic cards or links are displayed', async ({ page }) => {
    // The learning hub shows topic cards/links from math-engine knowledge module
    const topicElements = page.locator('a, [role="link"], button').filter({ hasText: /.{3,}/ });
    const count = await topicElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('page has interactive elements', async ({ page }) => {
    // Should have clickable topic cards or search functionality
    const interactive = page.locator('a[href*="/learn/"], button, input').first();
    await expect(interactive).toBeVisible({ timeout: 10000 });
  });
});
