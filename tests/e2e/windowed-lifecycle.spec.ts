import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { apiJson, launchTestApp } from './fixtures/electronApp';

const APP_ID = 'e2e-lifecycle-test';
const APP_NAME = 'E2E Lifecycle Test';
const MANAGER_ACTION_PATH = '/api/extensions/system-extension-manager/actions/manageExtension';

type ActionResponse = { ok?: unknown; result?: unknown; error?: unknown };

async function manageExtension(page: Page, body: Record<string, unknown>): Promise<ActionResponse> {
  return apiJson<ActionResponse>(page, MANAGER_ACTION_PATH, { method: 'POST', body });
}

function actionResult(response: ActionResponse): Record<string, unknown> {
  expect(response.ok).toBe(true);
  expect(response.result).toEqual(expect.any(Object));
  return response.result as Record<string, unknown>;
}

async function installedApp(page: Page): Promise<Record<string, unknown> | undefined> {
  const installed = await apiJson<Array<Record<string, unknown>>>(page, '/api/extensions/installed');
  return installed.find((entry) => entry.id === APP_ID);
}

async function openFromStart(page: Page): Promise<void> {
  await page.locator('.wos-taskbar__start').click();
  const startMenu = page.getByRole('dialog', { name: 'Start menu' });
  await startMenu.getByRole('searchbox', { name: 'Search apps' }).fill('lifecycle');
  await expect(startMenu.getByRole('button', { name: APP_NAME })).toBeVisible();
  await startMenu.getByRole('button', { name: APP_NAME }).click();
  await expect(page.locator(`[data-window-id][aria-label="${APP_NAME}"]`)).toBeVisible();
}

async function waitForDesktopLauncher(page: Page): Promise<void> {
  await page.locator('.wos-taskbar__start').click();
  const startMenu = page.getByRole('dialog', { name: 'Start menu' });
  await expect(startMenu.getByRole('button', { name: 'App Manager' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(startMenu).toHaveCount(0);
}

// Electron owns this test's page; destructuring an unused Playwright page fixture would launch a second browser.
// eslint-disable-next-line no-empty-pattern
test('agent-created windowed app can launch from Start, survive a broken build, and repair @windowed-lifecycle', async ({}, testInfo) => {
  const persistenceRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-lifecycle-e2e-'));
  const stateRoot = join(persistenceRoot, 'state');
  const desktopRoot = join(persistenceRoot, 'desktop-root');
  let testApp = await launchTestApp({ testInfo, initialRoute: '/', stateRoot, desktopRoot });
  let page = testApp.page;

  const brokenBackend = 'export async function ping() { BROKEN_SYNTAX( return { ok: true }; }';
  const repairedBackend = [
    "import type { ExtensionBackendContext } from '@neon-pilot/extensions';",
    '',
    'export async function ping(_input: unknown, ctx: ExtensionBackendContext) {',
    "  ctx.log.info('ping');",
    '  return { ok: true, at: new Date().toISOString() };',
    '}',
  ].join('\n');

  try {
    await waitForDesktopLauncher(page);
    const created = actionResult(
      await manageExtension(page, {
        action: 'create',
        id: APP_ID,
        name: APP_NAME,
        template: 'windowed-app',
        appearance: { aliases: ['lifecycle app'], window: { defaultWidth: 920, defaultHeight: 640 } },
      }),
    );
    expect(created).toMatchObject({ ok: true, built: true, extension: { id: APP_ID } });

    await expect
      .poll(() => installedApp(page))
      .toMatchObject({
        id: APP_ID,
        packageType: 'user',
        status: 'enabled',
        packageRoot: join(testApp.desktopRoot, 'apps', 'extensions', APP_ID),
      });
    const registry = await apiJson<{ extensions?: Array<Record<string, unknown>> }>(page, '/api/extensions/registry');
    expect(registry.extensions?.find((extension) => extension.id === APP_ID)).toMatchObject({
      id: APP_ID,
      packageType: 'user',
      manifest: { contributes: { nav: [{ route: `/ext/${APP_ID}` }] } },
    });
    await openFromStart(page);

    const initialPing = await apiJson<ActionResponse>(page, `/api/extensions/${APP_ID}/actions/ping`, { method: 'POST' });
    expect(actionResult(initialPing)).toMatchObject({ ok: true });

    const broken = await manageExtension(page, {
      action: 'update',
      extensionId: APP_ID,
      source: { backend: brokenBackend },
    });
    expect(broken).toMatchObject({ ok: false, error: expect.any(String) });
    expect(String(broken.error)).toContain('build');

    await testApp.close();
    testApp = await launchTestApp({ testInfo, initialRoute: '/', stateRoot, desktopRoot });
    page = testApp.page;
    await waitForDesktopLauncher(page);
    await expect.poll(() => installedApp(page)).toMatchObject({ id: APP_ID, buildError: expect.any(String) });

    const source = actionResult(await manageExtension(page, { action: 'readSource', extensionId: APP_ID }));
    expect((source.source as Record<string, unknown>).backend).toContain('BROKEN_SYNTAX');

    const repaired = actionResult(
      await manageExtension(page, {
        action: 'update',
        extensionId: APP_ID,
        source: { backend: repairedBackend },
      }),
    );
    expect(repaired).toMatchObject({ ok: true, built: true });

    await testApp.close();
    testApp = await launchTestApp({ testInfo, initialRoute: '/', stateRoot, desktopRoot });
    page = testApp.page;
    await waitForDesktopLauncher(page);
    await expect.poll(async () => (await installedApp(page))?.buildError).toBeUndefined();
    const repairedPing = await apiJson<ActionResponse>(page, `/api/extensions/${APP_ID}/actions/ping`, { method: 'POST' });
    expect(actionResult(repairedPing)).toMatchObject({ ok: true, at: expect.any(String) });

    await openFromStart(page);
  } finally {
    try {
      await manageExtension(page, { action: 'delete', extensionId: APP_ID });
    } catch {
      // The isolated Electron fixture removes its state root after the test.
    }
    await testApp.close();
    rmSync(persistenceRoot, { recursive: true, force: true });
  }
});
