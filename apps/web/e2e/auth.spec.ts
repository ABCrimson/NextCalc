import { expect, test } from '@playwright/test';

test.describe('Sign-In Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 10000 });
  });

  test('sign-in heading or branding is visible', async ({ page }) => {
    // The sign-in page should show a heading, logo, or sign-in prompt
    const heading = page
      .getByRole('heading')
      .first()
      .or(page.getByText(/sign in|log in|welcome/i).first());
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('OAuth provider buttons are present', async ({ page }) => {
    // NextAuth sign-in page shows GitHub and Google OAuth buttons
    const githubButton = page.getByRole('button', { name: /github/i });
    const googleButton = page.getByRole('button', { name: /google/i });

    const hasGithub = await githubButton.isVisible().catch(() => false);
    const hasGoogle = await googleButton.isVisible().catch(() => false);

    // At least one OAuth provider button should be visible
    // (providers are conditionally rendered based on env credentials)
    expect(hasGithub || hasGoogle).toBeTruthy();
  });

  test('page has proper ARIA accessibility', async ({ page }) => {
    const main = page.locator('main[aria-label]');
    const hasMainLabel = await main.isVisible().catch(() => false);
    // The main element should have an aria-label for accessibility
    expect(hasMainLabel).toBeTruthy();
  });

  test('link back to calculator exists', async ({ page }) => {
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible({ timeout: 10000 });
  });
});
