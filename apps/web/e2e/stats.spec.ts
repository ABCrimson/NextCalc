import { expect, test } from '@playwright/test';

test.describe('Statistical Analysis Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stats');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /statistical analysis/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('feature badges are displayed', async ({ page }) => {
    await expect(page.getByText(/Descriptive Stats/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Regression Analysis/i)).toBeVisible();
  });

  test('data input area exists', async ({ page }) => {
    // StatsPanel renders a textarea or input for data entry
    const dataInput = page.locator('textarea, input[type="text"]').first();
    await expect(dataInput).toBeVisible({ timeout: 10000 });
  });

  test('can enter data values', async ({ page }) => {
    const dataInput = page.locator('textarea, input[type="text"]').first();
    await dataInput.fill('1, 2, 3, 4, 5');
    await expect(dataInput).toHaveValue(/1.*2.*3/);
  });

  test('compute or analyze button is present', async ({ page }) => {
    const button = page.getByRole('button', { name: /comput|analyz|calculate/i });
    await expect(button.first()).toBeVisible({ timeout: 10000 });
  });
});
