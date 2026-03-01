import { expect, test } from '@playwright/test';

test.describe('ML Algorithms Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ml-algorithms');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('algorithm tabs or sections are present', async ({ page }) => {
    // The ML algorithms page has tabs for different algorithms (contrastive, attention, etc.)
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    // Should have at least one tab or section
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: check for any interactive elements
      const buttons = page.getByRole('button');
      await expect(buttons.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('parameter controls exist', async ({ page }) => {
    // ML algorithms page has sliders or inputs for parameters
    const controls = page.locator('input[type="range"], [role="slider"], input[type="number"]');
    await expect(controls.first()).toBeVisible({ timeout: 10000 });
  });

  test('visualization matrix or output is present', async ({ page }) => {
    // The page renders similarity/attention matrices or visualizations
    const visualization = page.locator('canvas, svg, table, [role="grid"], [role="table"]');
    await expect(visualization.first()).toBeVisible({ timeout: 10000 });
  });
});
