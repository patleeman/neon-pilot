/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { assertDesktopApiEndpoints, launchTestApp, navigateApp } from './fixtures/electronApp';

test('desktop app routes and API endpoints are healthy @desktop-smoke', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/' });
  try {
    await assertDesktopApiEndpoints(testApp.page);

    await navigateApp(testApp.page, '/home');
    await expect(testApp.page.getByRole('heading', { name: 'Applications' })).toBeVisible();
    await expect(testApp.page.getByRole('heading', { name: 'Destinations' })).toBeVisible();
    const homeSearch = testApp.page.getByRole('searchbox', { name: 'Search applications and destinations' });
    await homeSearch.fill('Diagnostics');
    await expect(testApp.page.getByRole('button', { name: /Diagnostics System/i })).toBeVisible();
    await expect(testApp.page.getByRole('button', { name: /Chat Agent/i })).toHaveCount(0);

    await navigateApp(testApp.page, '/extensions');
    await expect(testApp.page.locator('body')).toContainText(/Extensions|Installed/i);
    await assertDesktopApiEndpoints(testApp.page);

    await navigateApp(testApp.page, '/conversations/new');
    await testApp.page.getByRole('button', { name: /New chat/i }).click();
    await testApp.page.waitForURL((url) => url.pathname.startsWith('/conversations/') && url.pathname !== '/conversations/new');
    await expect(testApp.page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();

    await navigateApp(testApp.page, '/conversations/new');
    await expect(testApp.page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await assertDesktopApiEndpoints(testApp.page);
  } finally {
    await testApp.close();
  }
});
