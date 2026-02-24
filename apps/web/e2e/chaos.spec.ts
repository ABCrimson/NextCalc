import { test, expect } from '@playwright/test';

test.describe('Chaos Theory Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chaos');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /chaos theory/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('badges for attractor types are displayed', async ({ page }) => {
    await expect(page.getByText(/Lorenz Attractor/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Logistic Map/i).first()).toBeVisible();
    await expect(page.getByText(/Bifurcation/i).first()).toBeVisible();
  });

  test('tab navigation for different visualizations', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Lorenz/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Logistic/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bifurcation/i })).toBeVisible();
  });

  test('parameter sliders are present for Lorenz', async ({ page }) => {
    // Sigma, Rho, Beta sliders should be visible on the Lorenz tab
    await expect(page.getByText(/Prandtl number/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Rayleigh number/i)).toBeVisible();
  });

  test('canvas element renders for 3D trajectory', async ({ page }) => {
    // Lorenz3DRenderer uses WebGL canvas
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  test('simulate button is present', async ({ page }) => {
    const simButton = page.getByRole('button', { name: /simulate/i }).first();
    await expect(simButton).toBeVisible({ timeout: 10000 });
  });

  test('educational content section is present', async ({ page }) => {
    await expect(page.getByText(/About Chaos Theory/i)).toBeVisible({ timeout: 10000 });
  });
});
