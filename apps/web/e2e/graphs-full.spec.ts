import { expect, test } from '@playwright/test';

test.describe('Graph Algorithms Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/graphs-full');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('graph visualization area exists', async ({ page }) => {
    // The graph page renders an SVG or canvas for graph visualization
    const visualization = page.locator('svg, canvas').first();
    await expect(visualization).toBeVisible({ timeout: 10000 });
  });

  test('node or edge controls are present', async ({ page }) => {
    // Should have buttons for adding nodes/edges or running algorithms
    const controlButton = page.getByRole('button').first();
    await expect(controlButton).toBeVisible({ timeout: 10000 });
  });

  test('algorithm selection is available', async ({ page }) => {
    // The page has algorithm selection (MST, shortest path, etc.)
    const algorithmSelector = page
      .locator('select, [role="combobox"], [role="listbox"]')
      .or(page.getByRole('button', { name: /kruskal|prim|dijkstra|algorithm/i }));
    await expect(algorithmSelector.first()).toBeVisible({ timeout: 10000 });
  });
});
