/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { expectCleanViewport, launchTestApp, seedDisabledExtensions } from './fixtures/electronApp';

async function clickRouteButton(page: import('@playwright/test').Page, route: string): Promise<void> {
  await page.locator(`button[data-route="${route}"]`).first().click();
  await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
}

test('Agent sidebar navigation stays flat and never flashes an unregistered route @agent-sidebar', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/conversations/new',
    prepareState: (stateRoot) => seedDisabledExtensions(stateRoot, ['system-onboarding']),
  });
  try {
    const page = testApp.page;
    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await expect(page.getByText('Start a conversation', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Choose a saved workspace/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Saved workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Automations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Channels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evaluations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Routines' })).toBeVisible();
    await expect(page.getByText('Work', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tools', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Application settings navigation' })).toHaveCount(0);

    await page.addInitScript(() => {
      const observeRouteFallback = () => {
        if (!document.body) return;
        new MutationObserver(() => {
          if (document.body.textContent?.includes('No page is registered here')) {
            window.sessionStorage.setItem('__routeUnavailableSeen', 'true');
          }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      };
      if (document.body) observeRouteFallback();
      else window.addEventListener('DOMContentLoaded', observeRouteFallback, { once: true });
    });
    await page.evaluate(() => {
      window.sessionStorage.setItem('__routeUnavailableSeen', 'false');
      new MutationObserver(() => {
        if (document.body.textContent?.includes('No page is registered here')) {
          window.sessionStorage.setItem('__routeUnavailableSeen', 'true');
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });

    await clickRouteButton(page, '/automations');
    await expect(page.getByRole('heading', { name: 'Automations', exact: true })).toBeVisible({ timeout: 45_000 });
    await clickRouteButton(page, '/gateways');
    await expect(page.getByRole('heading', { name: 'Gateways', exact: true })).toBeVisible({ timeout: 45_000 });
    await clickRouteButton(page, '/model-arena');
    await expect(page.getByRole('heading', { name: 'Model Arena', exact: true })).toBeVisible({ timeout: 45_000 });
    await clickRouteButton(page, '/routines');
    await expect(page.getByRole('heading', { name: 'Routines', exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/conversations/new', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();

    expect(await page.evaluate(() => window.sessionStorage.getItem('__routeUnavailableSeen'))).toBe('false');
    await expectCleanViewport(page);
    await page.screenshot({ path: testInfo.outputPath('agent-sidebar.png'), fullPage: true });
  } finally {
    await testApp.close();
  }
});
