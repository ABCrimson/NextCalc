import { expect, test } from '@playwright/test';

test.describe('Forum New Post Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forum/new');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    // The new post page should either show a login prompt or the post form
    await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 10000 });
  });

  test('shows either login prompt or post creation form', async ({ page }) => {
    // When not authenticated, it may redirect to sign-in or show a prompt
    // When authenticated, it shows the new post form
    const hasSignIn = await page
      .getByText(/sign in|log in/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasForm = await page
      .locator('form, textarea, input[type="text"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasHeading = await page
      .getByRole('heading', { name: /new post|create/i })
      .first()
      .isVisible()
      .catch(() => false);

    // At least one of these should be true
    expect(hasSignIn || hasForm || hasHeading).toBeTruthy();
  });
});
