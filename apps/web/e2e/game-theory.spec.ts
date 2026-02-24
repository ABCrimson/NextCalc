import { test, expect } from '@playwright/test';

test.describe('Game Theory Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/game-theory');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /game theory/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Nash equilibrium badge is displayed', async ({ page }) => {
    await expect(page.getByText(/Nash Equilibrium/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('payoff matrix inputs are present', async ({ page }) => {
    // The game theory page renders number inputs for the payoff matrix
    const matrixInputs = page.locator('input[type="number"]');
    const count = await matrixInputs.count();
    expect(count).toBeGreaterThanOrEqual(8); // 2x2 matrix with 2 players = 8 inputs
  });

  test('matrix size tabs (2x2/3x3) are present', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /2.*2/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /3.*3/i })).toBeVisible();
  });

  test('preset games are listed', async ({ page }) => {
    await expect(page.getByText(/Prisoner.*Dilemma/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Battle of the Sexes/i)).toBeVisible();
  });

  test('Find Nash Equilibrium button is present', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /find nash equilibrium/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('can click a preset to load it', async ({ page }) => {
    const chickenButton = page.getByText(/Chicken Game/i).first();
    await expect(chickenButton).toBeVisible({ timeout: 10000 });
    await chickenButton.click();
  });

  test('educational content section is present', async ({ page }) => {
    await expect(page.getByText(/About Game Theory/i)).toBeVisible({ timeout: 10000 });
  });
});
