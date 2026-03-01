import { expect, test } from '@playwright/test';

test.describe('Forum Detail Page', () => {
  test('navigating from forum list to a post detail page', async ({ page }) => {
    await page.goto('/forum');
    await page.waitForLoadState('domcontentloaded');

    // Wait for post cards to appear (mock data fallback)
    const firstPostLink = page.locator('a[href^="/forum/"]').first();
    await expect(firstPostLink).toBeVisible({ timeout: 10000 });

    // Click the first post link
    await firstPostLink.click();

    // The URL should now contain /forum/ followed by an id
    await expect(page).toHaveURL(/\/forum\/.+/, { timeout: 10000 });
  });

  test('forum detail page loads directly', async ({ page }) => {
    // Navigate to a mock post detail page
    // This may show a "not found" or the post content depending on data availability
    await page.goto('/forum/1');
    await page.waitForLoadState('domcontentloaded');

    // The page should load without crashing - verify the main content area exists
    await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 10000 });
  });
});
