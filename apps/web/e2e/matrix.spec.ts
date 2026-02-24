import { test, expect } from '@playwright/test';

test.describe('Matrix Operations Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/matrix');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /matrix operations/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('feature badges are displayed', async ({ page }) => {
    await expect(page.getByText(/LU Decomposition/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Eigenvalues/i).first()).toBeVisible();
  });

  test('matrix input grid is present', async ({ page }) => {
    // MatrixPanel renders number inputs for the matrix cells
    const matrixInputs = page.locator('input[type="number"]');
    const count = await matrixInputs.count();
    expect(count).toBeGreaterThanOrEqual(4); // At least a 2x2 matrix
  });

  test('can edit a matrix cell value', async ({ page }) => {
    const firstInput = page.locator('input[type="number"]').first();
    await firstInput.fill('42');
    await expect(firstInput).toHaveValue('42');
  });

  test('eigenvalue section is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /eigenvalue/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('example usage section is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /example usage/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
