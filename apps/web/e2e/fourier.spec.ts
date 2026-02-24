import { test, expect } from '@playwright/test';

test.describe('Fourier Analysis Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fourier');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /fourier analysis/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('GPU accelerated badge is displayed', async ({ page }) => {
    await expect(page.getByText(/GPU Accelerated/i)).toBeVisible({ timeout: 10000 });
  });

  test('signal generator card is present', async ({ page }) => {
    await expect(page.getByText(/Signal Generator/i)).toBeVisible({ timeout: 10000 });
  });

  test('frequency sliders are present', async ({ page }) => {
    await expect(page.getByText(/Frequency 1/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Frequency 2/i)).toBeVisible();
  });

  test('algorithm selection tabs (FFT/DFT) are present', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /FFT/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /DFT/i })).toBeVisible();
  });

  test('preset signal buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Dual Sine/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Square/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sawtooth/i })).toBeVisible();
  });

  test('time domain visualization area exists', async ({ page }) => {
    await expect(page.getByText(/Time Domain Signal/i)).toBeVisible({ timeout: 10000 });
    // Canvas element should render for the signal visualization
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  test('custom signal input exists', async ({ page }) => {
    const customInput = page.getByPlaceholder(/1, 2, 3/i);
    await expect(customInput).toBeVisible({ timeout: 10000 });
  });
});
