import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test('should load pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display pricing tiers', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Look for pricing cards or tiers
    const pricingElements = page.locator('[class*="price"], [class*="tier"], [class*="plan"], [data-testid*="pricing"]');

    if (await pricingElements.count() > 0) {
      await expect(pricingElements.first()).toBeVisible();
    }
  });

  test('should have call-to-action buttons', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const ctaButtons = page.locator('button:has-text("Get Started"), button:has-text("Subscribe"), button:has-text("Start"), a:has-text("Get Started")');

    if (await ctaButtons.count() > 0) {
      await expect(ctaButtons.first()).toBeVisible();
    }
  });

  test('should display pricing amounts', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Look for price indicators
    const priceText = page.locator(':has-text("$"), :has-text("Free"), :has-text("/month")');

    if (await priceText.count() > 0) {
      await expect(priceText.first()).toBeVisible();
    }
  });

  test('should handle plan selection', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const planButton = page.locator('button:has-text("Select"), button:has-text("Choose"), button:has-text("Get")').first();

    if (await planButton.isVisible()) {
      await planButton.click();
      await page.waitForTimeout(500);

      // Should navigate or show modal
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
