import { expect, test } from '@playwright/test';

test.describe('Problems Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/problems');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('problem list is displayed', async ({ page }) => {
    // The page renders mock problem data as a list
    await expect(page.getByText(/Quadratic Equation/i)).toBeVisible({ timeout: 10000 });
  });

  test('difficulty indicators are present', async ({ page }) => {
    const difficulties = page.getByText(/beginner|intermediate|advanced|master/i);
    const count = await difficulties.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('filtering or search functionality exists', async ({ page }) => {
    // ProblemBrowser should have filter controls
    const filterControls = page.locator(
      'input[type="text"], input[type="search"], select, [role="combobox"]',
    );
    await expect(filterControls.first()).toBeVisible({ timeout: 10000 });
  });

  test('problem cards have topic tags', async ({ page }) => {
    const topicTags = page.getByText(/algebra|calculus|topology|linear algebra/i);
    const count = await topicTags.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
