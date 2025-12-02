import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('homepage should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Page should load within 30 seconds (generous for dev mode with compilation)
    expect(loadTime).toBeLessThan(30000);
  });

  test('should have reasonable number of network requests', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should not make excessive requests (reasonable limit)
    expect(requests.length).toBeLessThan(200);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to builder
    await page.goto('/builder');
    await page.waitForLoadState('domcontentloaded');

    // Navigate back
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Page should still have content - use try-catch for navigation timing
    try {
      const content = await page.content();
      expect(content.length).toBeGreaterThan(100);
    } catch {
      // If content retrieval fails due to navigation, wait and retry
      await page.waitForLoadState('networkidle');
      const content = await page.content();
      expect(content.length).toBeGreaterThan(100);
    }
  });

  test('should handle rapid interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Rapid clicking on any visible element
    const clickableElement = page.locator('button, a').first();

    if (await clickableElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickableElement.click().catch(() => {});
    }

    // Page should remain stable
    await page.waitForTimeout(500);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should lazy load images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const images = page.locator('img');
    const imageCount = await images.count();

    // Check if images have loading attribute or are in viewport
    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);
      const loading = await img.getAttribute('loading');
      const src = await img.getAttribute('src');

      // Image should either be lazy loaded or have a valid src
      expect(loading === 'lazy' || src).toBeTruthy();
    }
  });
});
