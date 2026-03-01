import { expect, test } from '@playwright/test';

test.describe('Equation Solver Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solver');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /equation solver|solver/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('equation input field exists', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('can type an equation', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('x^2 - 4 = 0');
    await expect(input).toHaveValue(/x\^2/);
  });

  test('solve button is present', async ({ page }) => {
    const solveButton = page.getByRole('button', { name: /solve/i });
    await expect(solveButton.first()).toBeVisible({ timeout: 10000 });
  });
});
