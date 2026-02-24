import { test, expect } from '@playwright/test';

test.describe('Algorithms Hub Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/algorithms');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /algorithm visualizations/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('interactive learning badge is displayed', async ({ page }) => {
    await expect(page.getByText(/interactive learning/i)).toBeVisible({ timeout: 10000 });
  });

  test('category tags are displayed', async ({ page }) => {
    await expect(page.getByText(/machine learning/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/cryptography/i).first()).toBeVisible();
    await expect(page.getByText(/graph theory/i).first()).toBeVisible();
  });

  test('algorithm cards are displayed', async ({ page }) => {
    await expect(page.getByText(/Transformer Attention/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Fourier Analysis/i)).toBeVisible();
    await expect(page.getByText(/Game Theory/i)).toBeVisible();
  });

  test('algorithm count is shown', async ({ page }) => {
    await expect(page.getByText(/algorithm(s)? found/i)).toBeVisible({ timeout: 10000 });
  });

  test('algorithm cards link to sub-pages', async ({ page }) => {
    // Check that links to sub-pages exist
    const links = page.locator('a[href*="/algorithms/"], a[href*="/fourier"], a[href*="/game-theory"], a[href*="/chaos"]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('educational callout section is present', async ({ page }) => {
    await expect(page.getByText(/learning through interaction/i)).toBeVisible({ timeout: 10000 });
  });
});
