import { expect, test } from '@playwright/test';

test.describe('PDE 3D Solver Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pde/3d');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    // PDE3DClient is dynamically loaded
    await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 10000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('equation selector is present', async ({ page }) => {
    // The 3D PDE page has equation type selection (tabs or buttons)
    const equationSelector = page
      .getByRole('tab')
      .or(page.getByRole('button', { name: /heat|wave/i }));
    await expect(equationSelector.first()).toBeVisible({ timeout: 10000 });
  });

  test('canvas element is present for 3D rendering', async ({ page }) => {
    // 3D visualization uses canvas (WebGL/Three.js)
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });
});
