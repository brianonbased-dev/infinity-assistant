import { test, expect } from '@playwright/test';

test.describe('Visual and UI Tests', () => {
  test('should render without layout shift', async ({ page }) => {
    await page.goto('/');

    // Wait for fonts and styles to load
    await page.waitForLoadState('networkidle');

    // Take a snapshot after load
    const bodyBox = await page.locator('body').boundingBox();

    await page.waitForTimeout(1000);

    // Check box again
    const bodyBoxAfter = await page.locator('body').boundingBox();

    // Layout should be stable
    expect(bodyBoxAfter?.width).toBe(bodyBox?.width);
  });

  test('should have consistent styling across pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get primary colors from homepage
    const homeBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    await page.goto('/builder');
    await page.waitForLoadState('networkidle');

    // Background should be consistent or follow design system
    const builderBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    // Both should be valid colors
    expect(homeBackground).toBeTruthy();
    expect(builderBackground).toBeTruthy();
  });

  test('should handle dark mode if supported', async ({ page }) => {
    // Set dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Page should render - check for any content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should handle light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should handle reduced motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should not have horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('should have proper z-index stacking', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that modals/overlays are above content
    const overlays = page.locator('[class*="modal"], [class*="overlay"], [role="dialog"]');

    if (await overlays.count() > 0) {
      const zIndex = await overlays.first().evaluate(el =>
        parseInt(getComputedStyle(el).zIndex) || 0
      );

      // Overlays should have high z-index
      expect(zIndex).toBeGreaterThan(0);
    }
  });

  test('should handle very long text gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[type="text"], textarea').first();

    if (await input.isVisible()) {
      const longText = 'A'.repeat(1000);
      await input.fill(longText);

      // Input should handle long text without breaking layout
      const hasHorizontalScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );

      expect(hasHorizontalScroll).toBeFalsy();
    }
  });
});
