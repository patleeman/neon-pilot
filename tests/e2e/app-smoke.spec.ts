/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { assertDesktopApiEndpoints, launchTestApp, navigateApp } from './fixtures/electronApp';

test('desktop app routes and API endpoints are healthy @desktop-smoke', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/' });
  try {
    await assertDesktopApiEndpoints(testApp.page);

    await navigateApp(testApp.page, '/extensions');
    await expect(testApp.page.locator('body')).toContainText(/Extensions|Installed/i);
    await assertDesktopApiEndpoints(testApp.page);

    await navigateApp(testApp.page, '/conversations/new');
    await expect(testApp.page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await assertDesktopApiEndpoints(testApp.page);
  } finally {
    await testApp.close();
  }
});
