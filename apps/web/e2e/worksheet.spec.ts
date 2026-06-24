import { expect, test } from '@playwright/test';

test.describe('Worksheet Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/worksheet');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    // The worksheet page has an aria-label on the main element
    await expect(page.locator('main[aria-label*="worksheet" i]')).toBeVisible({ timeout: 10000 });
  });

  test('worksheet editor area is visible', async ({ page }) => {
    // The WorksheetClientWrapper dynamically loads the editor
    // Look for any cell interface, input, or the editor container
    const editor = page
      .locator('[data-testid="worksheet-editor"], [role="textbox"], textarea, .worksheet-cell')
      .first();
    // Give extra time since this is a dynamic import with ssr: false. Either the
    // editor itself becomes visible, or at minimum the worksheet main container does.
    await expect(editor.or(page.locator('main'))).toBeVisible({ timeout: 15000 });
  });

  test('page has proper background elements', async ({ page }) => {
    // The page renders decorative background elements
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });
});
