import { expect, test } from '@playwright/test';

test.describe('Plot Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plot');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /interactive plots/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('tab bar with plot types is present', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /2D Cartesian/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /2D Polar/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /2D Parametric/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /3D Surface/i })).toBeVisible();
  });

  test('function input field exists and accepts expressions', async ({ page }) => {
    // The FunctionInput component renders text inputs for function expressions
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.clear();
    await input.fill('x^2');
    await expect(input).toHaveValue('x^2');
  });

  test('canvas element renders for 2D cartesian plot', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('preset chips are clickable', async ({ page }) => {
    const preset = page.getByRole('button', { name: /Load sin\(x\) preset/i });
    await expect(preset).toBeVisible({ timeout: 10000 });
    await preset.click();
  });

  test('switching tabs changes visible content', async ({ page }) => {
    const polarTab = page.getByRole('tab', { name: /2D Polar/i });
    await polarTab.click();
    await expect(page.getByText(/Polar Presets/i)).toBeVisible({ timeout: 5000 });
  });
});
