/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { apiJson, expectCleanViewport, launchTestApp, seedDisabledExtensions } from './fixtures/electronApp';

async function capture(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function expectPathname(page: import('@playwright/test').Page, pathname: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

test('open application tabs, launcher navigation, close controls, and persistence work together @application-shell', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/home',
    prepareState: (stateRoot) => seedDisabledExtensions(stateRoot, ['system-onboarding']),
  });
  try {
    const page = testApp.page;
    await page.evaluate(() => localStorage.removeItem('neon-pilot:application-workspace:v1'));
    await page.reload();
    await expectPathname(page, '/home');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.locator('.ui-application-taskbar')).toBeVisible();
    await expect(page.locator('[data-application-id="system-home:home"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-application-id="system-agent:agent"]')).toHaveCount(0);
    await expect(page.locator('[data-application-id="system-settings:system"]')).toHaveCount(0);
    const topBarCenter = page.locator('.ui-desktop-top-bar__center');
    await expect(topBarCenter).toHaveCSS('-webkit-app-region', 'drag');
    await expect(page.locator('[data-application-id="system-home:home"]')).toHaveCSS('-webkit-app-region', 'no-drag');
    await expectCleanViewport(page);
    await capture(page, testInfo, 'application-shell-home');

    await page.getByRole('button', { name: 'Close Home' }).click();
    await expectPathname(page, '/conversations/new');
    await expect(page.locator('[data-application-id="system-home:home"]')).toHaveCount(0);
    await expect(page.locator('[data-application-id="system-agent:agent"]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Open Neon Pilot' }).click();
    await page.getByRole('dialog', { name: 'Launcher' }).getByLabel('Pinned').getByRole('button', { name: 'Home', exact: true }).click();
    await expectPathname(page, '/home');

    await page.getByRole('button', { name: 'Open Neon Pilot' }).click();
    const launcher = page.getByRole('dialog', { name: 'Launcher' });
    await expect(launcher).toBeVisible();
    await expect(launcher.getByText('Pinned', { exact: true })).toBeVisible();
    await expect(launcher.locator('.ui-launcher-pinned-grid')).toBeVisible();
    await expect(launcher.getByLabel('Pinned').getByRole('button', { name: 'Agent', exact: true })).toBeVisible();
    await capture(page, testInfo, 'application-shell-launcher-applications');
    await launcher.getByLabel('Search launcher').fill('evaluations');
    await expect(launcher.getByText('Evaluations', { exact: true })).toBeVisible();
    await capture(page, testInfo, 'application-shell-launcher-search');
    await launcher.getByText('Evaluations', { exact: true }).click();
    await expectPathname(page, '/model-arena');
    await expect(page.locator('[data-application-id="system-agent:agent"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Automations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Channels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evaluations' })).toBeVisible();
    await expect(page.getByText('Threads', { exact: true })).toBeVisible();

    await page.locator('[data-application-id="system-agent:agent"]').click();
    await expectPathname(page, '/model-arena');

    await page.getByRole('button', { name: 'Open Neon Pilot' }).click();
    await launcher.getByLabel('Search launcher').fill('System');
    await launcher.getByRole('button', { name: 'System', exact: true }).click();
    await expectPathname(page, '/settings');
    await page.getByRole('button', { name: 'Open Neon Pilot' }).click();
    await launcher.getByLabel('Search launcher').fill('Extensions');
    await launcher.getByRole('button', { name: /^Extensions\s*System/ }).click();
    await expectPathname(page, '/extensions');
    await page.locator('[data-application-id="system-agent:agent"]').click();
    await expectPathname(page, '/model-arena');

    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expectPathname(page, '/conversations/new');
    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await expect(page.getByText('Threads', { exact: true })).toBeVisible();
    await capture(page, testInfo, 'application-shell-agent');

    await page.setViewportSize({ width: 360, height: 720 });
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agent', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'System', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /more applications/ })).toHaveCount(0);
    await expectCleanViewport(page);
    await capture(page, testInfo, 'application-shell-narrow-taskbar');
    await page.setViewportSize({ width: 1440, height: 960 });

    const agentTaskbar = page.locator('[data-application-id="system-agent:agent"]');
    await agentTaskbar.click();
    await expectPathname(page, '/conversations/new');
    await page.getByRole('button', { name: 'Close Agent' }).click();
    await expect(agentTaskbar).toHaveCount(0);
    await expectPathname(page, '/extensions');
    await page.reload();
    await expect(page.locator('[data-application-id="system-agent:agent"]')).toHaveCount(0);
    const storedWorkspace = await page.evaluate(() => JSON.parse(localStorage.getItem('neon-pilot:application-workspace:v1') ?? '{}'));
    expect(storedWorkspace.pinnedApplicationIds).toContain('system-agent:agent');
  } finally {
    await testApp.close();
  }
});

test('disabled applications retain a recovery view and Home disablement falls back to a pin @application-shell', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/home',
    prepareState: (stateRoot) => seedDisabledExtensions(stateRoot, ['system-onboarding']),
  });
  try {
    const page = testApp.page;
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await apiJson(page, '/api/extensions/system-home', { method: 'PATCH', body: { enabled: false } });
    await page.reload();
    await expectPathname(page, '/conversations/new');
    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await capture(page, testInfo, 'application-shell-disabled-home-fallback');
  } finally {
    await testApp.close();
  }
});
