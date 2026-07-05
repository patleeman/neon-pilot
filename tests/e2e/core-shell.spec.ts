/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { assertDesktopApiEndpoints, expectCleanViewport, launchTestApp, navigateApp } from './fixtures/electronApp';

async function clickRouteButton(page: import('@playwright/test').Page, route: string): Promise<void> {
  await page.locator(`button[data-route="${route}"]`).first().click();
  await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
}

test('app shell routes, command palette, and settings surfaces work in one launch @core-shell', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/conversations/new' });
  try {
    const page = testApp.page;

    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await assertDesktopApiEndpoints(page);
    await expectCleanViewport(page);

    await page.getByLabel('Search threads, models, settings').focus();
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible({ timeout: 15_000 });
    await palette.getByLabel('Search command palette').fill('extensions');
    await expect(palette).toContainText(/App Manager|Apps/i);
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);

    await clickRouteButton(page, '/extensions');
    await expect(page.locator('body')).toContainText(/App Manager|Installed/i, { timeout: 30_000 });
    await assertDesktopApiEndpoints(page);
    await expectCleanViewport(page);

    await clickRouteButton(page, '/automations');
    await expect(page.locator('body')).toContainText(/Automations|automation/i, { timeout: 30_000 });
    await expectCleanViewport(page);

    await clickRouteButton(page, '/settings');
    await expect(page.locator('body')).toContainText(/Settings|Providers|Commands/i, { timeout: 45_000 });
    await expectCleanViewport(page);

    await navigateApp(page, '/settings/providers');
    await expect(page.locator('body')).toContainText('Providers', { timeout: 45_000 });
    await expectCleanViewport(page);

    await page.reload();
    await expect(page.locator('body')).toContainText('Providers', { timeout: 45_000 });
    await expectCleanViewport(page);
  } finally {
    await testApp.close();
  }
});
