import { test, expect } from '@playwright/test';

test.describe('Symbolic Mathematics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/symbolic');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /symbolic/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('expression input field exists', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('can type an expression into the input', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('x^2 + 3*x');
    await expect(input).toHaveValue(/x\^2/);
  });

  test('differentiate or integrate buttons are present', async ({ page }) => {
    const diffButton = page.getByRole('button', { name: /differentiat/i })
      .or(page.getByRole('button', { name: /derive/i }))
      .or(page.locator('button:has-text("d/dx")'));
    const intButton = page.getByRole('button', { name: /integrat/i })
      .or(page.locator('button:has-text("\\u222B")'));

    // At least one symbolic operation button should be visible
    const hasDiff = await diffButton.first().isVisible().catch(() => false);
    const hasInt = await intButton.first().isVisible().catch(() => false);
    expect(hasDiff || hasInt).toBeTruthy();
  });
});
