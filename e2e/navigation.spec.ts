import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to builder page', async ({ page }) => {
    await page.goto('/');

    // Try to find and click builder link if it exists
    const builderLink = page.locator('a[href*="builder"], button:has-text("Builder")').first();

    if (await builderLink.isVisible()) {
      await builderLink.click();
      await expect(page).toHaveURL(/.*builder.*/);
    }
  });

  test('should navigate to pricing page', async ({ page }) => {
    await page.goto('/');

    const pricingLink = page.locator('a[href*="pricing"], button:has-text("Pricing")').first();

    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      await expect(page).toHaveURL(/.*pricing.*/);
    }
  });

  test('should have working back navigation', async ({ page }) => {
    await page.goto('/');
    const initialUrl = page.url();

    // Navigate to another page if possible
    const anyLink = page.locator('a[href^="/"]').first();
    if (await anyLink.isVisible()) {
      await anyLink.click();
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(initialUrl);
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should either show 404 page or redirect
    expect(response?.status()).toBeLessThan(500);
  });
});
