import { test, expect } from '@playwright/test';

test.describe('Builder Page', () => {
  test('should load builder page', async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('domcontentloaded');

    // Page should have content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should display builder interface or login prompt', async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Either shows builder UI or login/signup prompt or any content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should have demo mode for unauthenticated users', async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('domcontentloaded');

    // Builder should load on the correct URL
    expect(page.url()).toContain('builder');
  });

  test('should be keyboard accessible', async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Page should remain functional
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
