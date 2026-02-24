import { test, expect } from '@playwright/test';

test.describe('Unit Converter Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/units');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /unit converter/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('feature badges are displayed', async ({ page }) => {
    await expect(page.getByText(/12 Categories/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/80\+ Units/i)).toBeVisible();
  });

  test('converter widget is present with input field', async ({ page }) => {
    // UnitConverter renders a number input for the value
    const valueInput = page.locator('input[type="number"], input[type="text"]').first();
    await expect(valueInput).toBeVisible({ timeout: 10000 });
  });

  test('supported categories section is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /supported categories/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('example conversions section is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /example conversions/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/1 kilometer/i)).toBeVisible();
  });

  test('category cards are displayed', async ({ page }) => {
    // At least some category labels should be visible
    await expect(page.getByText('Length').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mass').first()).toBeVisible();
    await expect(page.getByText('Temperature').first()).toBeVisible();
  });
});
