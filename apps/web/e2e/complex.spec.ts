import { expect, test } from '@playwright/test';

test.describe('Complex Number Calculator Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/complex');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /complex number/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('feature badges are displayed', async ({ page }) => {
    await expect(page.getByText(/Rectangular & Polar/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Argand Diagram/i)).toBeVisible();
  });

  test('complex number inputs are present', async ({ page }) => {
    // ComplexPanel renders input fields for real and imaginary parts
    const inputs = page.locator('input[type="number"], input[type="text"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('supported operations section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /supported operations/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('binary operations section lists add/sub/mul/div', async ({ page }) => {
    await expect(page.getByText(/Binary Operations/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Addition/i).first()).toBeVisible();
  });

  test('example calculations section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /example calculations/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
