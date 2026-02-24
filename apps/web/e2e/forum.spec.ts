import { test, expect } from '@playwright/test';

test.describe('Forum Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forum');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with Community heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /community/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('search input is present', async ({ page }) => {
    await expect(
      page.getByPlaceholder(/search discussions/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('sort tabs (Hot/New/Top) are present and clickable', async ({ page }) => {
    const hotButton = page.getByRole('button', { name: /hot/i });
    const newButton = page.getByRole('button', { name: /new/i });
    const topButton = page.getByRole('button', { name: /top/i });

    await expect(hotButton).toBeVisible({ timeout: 10000 });
    await expect(newButton).toBeVisible();
    await expect(topButton).toBeVisible();

    // Click the "New" sort tab
    await newButton.click();
  });

  test('New Post button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /new post/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('post cards are displayed (mock data fallback)', async ({ page }) => {
    // The forum page uses mock data when GraphQL is unavailable
    // Wait for at least one post card to appear
    const postCards = page.locator('[class*="rounded-2xl"]').filter({ hasText: /.{10,}/ });
    await expect(postCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('stats badges show discussion count', async ({ page }) => {
    await expect(page.getByText(/discussions/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/contributors/i).first()).toBeVisible();
  });

  test('popular topics sidebar is visible', async ({ page }) => {
    await expect(page.getByText(/popular topics/i)).toBeVisible({ timeout: 10000 });
  });

  test('community guidelines card is visible', async ({ page }) => {
    await expect(page.getByText(/community guidelines/i)).toBeVisible({ timeout: 10000 });
  });

  test('search filters posts', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search discussions/i);
    await searchInput.fill('nonexistent-query-xyz123');
    // Wait for debounce (300ms) and re-render
    await page.waitForTimeout(500);
    // Should show "No discussions found" or a reduced list
    const noResults = page.getByText(/no discussions found/i);
    const results = page.locator('[class*="rounded-2xl"]').filter({ hasText: /.{10,}/ });
    const hasNoResults = await noResults.isVisible().catch(() => false);
    const resultCount = await results.count();
    expect(hasNoResults || resultCount === 0).toBeTruthy();
  });
});
