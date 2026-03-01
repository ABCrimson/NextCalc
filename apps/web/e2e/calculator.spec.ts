import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Calculator - Basic Operations', () => {
  test('should load calculator page successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/NextCalc/);
    await expect(page.locator('h1')).toContainText(/Calculator/i);
  });

  test('should perform basic arithmetic', async ({ page }) => {
    await page.goto('/');

    // Type expression
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('2 + 3');

    // Submit
    await page.keyboard.press('Enter');

    // Check result appears in history
    await expect(page.locator('text=5')).toBeVisible({ timeout: 5000 });
  });

  test('should handle keyboard input', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('textarea, input[type="text"]').first();
    await input.focus();

    // Type using keyboard
    await page.keyboard.type('10 * 5');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=50')).toBeVisible({ timeout: 5000 });
  });

  test('should clear input', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('123');

    // Clear button or Escape key
    await page.keyboard.press('Escape');

    await expect(input).toHaveValue('');
  });

  test('should display calculation history', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('textarea, input[type="text"]').first();

    // Perform multiple calculations
    await input.fill('5 + 5');
    await page.keyboard.press('Enter');

    await input.fill('10 * 2');
    await page.keyboard.press('Enter');

    // Check history contains both results
    await expect(page.locator('text=10')).toBeVisible();
    await expect(page.locator('text=20')).toBeVisible();
  });
});

test.describe('Calculator - Advanced Features', () => {
  test('should compute scientific functions', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('sin(0)');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=0')).toBeVisible({ timeout: 5000 });
  });

  test('should handle complex expressions', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('2^3 + sqrt(16)');
    await page.keyboard.press('Enter');

    // 2³ + √16 = 8 + 4 = 12
    await expect(page.locator('text=12')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle between plain and LaTeX display', async ({ page }) => {
    await page.goto('/');

    // Look for tabs or toggle button
    const latexTab = page
      .locator('text=LaTeX')
      .or(page.locator('button:has-text("LaTeX")'))
      .first();

    if (await latexTab.isVisible()) {
      await latexTab.click();
      // Verify LaTeX content is displayed
      await expect(page.locator('.katex, [class*="katex"]')).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate to 2D plot page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/plot"], text=Plot, text=2D');
    await expect(page).toHaveURL(/\/plot/);
  });

  test('should navigate to 3D plot page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/plot3d"], text=3D');
    await expect(page).toHaveURL(/\/plot3d/);
  });

  test('should navigate to symbolic page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/symbolic"], text=Symbolic');
    await expect(page).toHaveURL(/\/symbolic/);
  });

  test('should navigate to matrix page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/matrix"], text=Matrix');
    await expect(page).toHaveURL(/\/matrix/);
  });

  test('should navigate to stats page', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/stats"], text=Stats');
    await expect(page).toHaveURL(/\/stats/);
  });
});

test.describe('2D Plotting', () => {
  test('should plot a simple function', async ({ page }) => {
    await page.goto('/plot');

    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('x^2');

    const plotButton = page.locator('button:has-text("Plot"), button:has-text("Graph")').first();
    await plotButton.click();

    // Check for canvas or SVG
    await expect(page.locator('canvas, svg')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Accessibility', () => {
  test('should not have accessibility violations on homepage', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');

    await expect(focused).toBeVisible();
    await expect(focused).toHaveCSS('outline-width', /.+/); // Has focus indicator
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    // Check for ARIA landmarks
    await expect(page.locator('[role="main"]')).toBeVisible();

    // Check for labeled inputs
    const inputs = page.locator('input, textarea, button');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const element = inputs.nth(i);
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');

      // Element should have ARIA label or be labeled
      expect(ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });
});

// Mobile tests moved to separate file (mobile.spec.ts) due to device config requiring top-level test.use()
test.describe('Responsive Design', () => {
  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/');

    // Buttons should be at least 44x44 px (WCAG AAA)
    const buttons = page.locator('button');
    const firstButton = buttons.first();

    if (await firstButton.isVisible()) {
      const box = await firstButton.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Theme', () => {
  test('should toggle dark/light mode', async ({ page }) => {
    await page.goto('/');

    // Look for theme toggle
    const themeToggle = page
      .locator('[aria-label*="theme" i], button:has-text("Dark"), button:has-text("Light")')
      .first();

    if (await themeToggle.isVisible()) {
      await themeToggle.click();

      // Check theme changed
      const html = page.locator('html');
      const className = await html.getAttribute('class');
      expect(className).toMatch(/dark|light/);
    }
  });
});

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Should load in < 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
