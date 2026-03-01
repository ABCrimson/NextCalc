import { expect, test } from '@playwright/test';

test.describe('PDE Solver Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pde');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /PDE Solver/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('WebGPU accelerated badge is displayed', async ({ page }) => {
    await expect(page.getByText(/WebGPU Accelerated/i)).toBeVisible({ timeout: 10000 });
  });

  test('equation type selector (Heat/Wave) is present', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Heat/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Wave/i })).toBeVisible();
  });

  test('grid resolution slider is present', async ({ page }) => {
    await expect(page.getByText(/Grid Resolution/i)).toBeVisible({ timeout: 10000 });
  });

  test('play/pause button is present', async ({ page }) => {
    const playButton = page.getByRole('button', { name: /play|pause/i }).first();
    await expect(playButton).toBeVisible({ timeout: 10000 });
  });

  test('initial condition presets are displayed', async ({ page }) => {
    await expect(page.getByText(/Initial Condition Presets/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Center Spot/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ring/i })).toBeVisible();
  });

  test('heatmap canvas is rendered', async ({ page }) => {
    // WebGPUHeatmap renders a canvas element
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('educational content about PDEs is visible', async ({ page }) => {
    await expect(page.getByText(/About PDEs/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Heat Equation/i).first()).toBeVisible();
    await expect(page.getByText(/Wave Equation/i).first()).toBeVisible();
  });
});
