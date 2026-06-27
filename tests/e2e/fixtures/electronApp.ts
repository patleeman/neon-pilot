import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { _electron as electron, type ElectronApplication, expect, type Page, type TestInfo } from '@playwright/test';

interface LaunchOptions {
  initialRoute?: string;
  stateRoot?: string;
  testInfo: TestInfo;
  prepareState?: (stateRoot: string) => Promise<void> | void;
}

interface TestApp {
  app: ElectronApplication;
  page: Page;
  tempRoot: string;
  stateRoot: string;
  logs: () => string;
  close: () => Promise<void>;
}

const repoRoot = process.cwd();
const desktopMainFile = resolve(repoRoot, 'packages/desktop/dist/main.js');
const require = createRequire(resolve(repoRoot, 'package.json'));

function normalizeInitialRoute(route: string | undefined): string {
  if (!route || !route.startsWith('/') || route.startsWith('//')) {
    return '/';
  }
  return route;
}

function buildLaunchEnv(tempRoot: string, stateRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  delete env.ELECTRON_RUN_AS_NODE;
  return {
    ...env,
    NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
    NEON_PILOT_REPO_ROOT: repoRoot,
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_DESKTOP_VARIANT: 'testing',
    NEON_PILOT_DAEMON_NAMESPACE: `e2e-${process.pid}-${Date.now()}`,
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_CONFIG_ROOT: join(stateRoot, 'config'),
    NEON_PILOT_DESKTOP_USER_DATA_DIR: join(tempRoot, 'user-data'),
    NEON_PILOT_DAEMON_SOCKET_PATH: join(tempRoot, 'daemon.sock'),
    NEON_PILOT_COMPANION_PORT: '0',
  };
}

export async function launchTestApp(options: LaunchOptions): Promise<TestApp> {
  const initialRoute = normalizeInitialRoute(options.initialRoute);
  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-e2e-'));
  const stateRoot = options.stateRoot ?? join(tempRoot, 'state');
  await options.prepareState?.(stateRoot);
  const electronExecutable = require('electron') as string;
  const logs: string[] = [];
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [desktopMainFile, '--no-quit-confirmation', `--neon-pilot-initial-route=${initialRoute}`],
    env: buildLaunchEnv(tempRoot, stateRoot),
  });
  const child = app.process();
  child?.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child?.stderr?.on('data', (chunk) => logs.push(String(chunk)));
  const page = await app.firstWindow({ timeout: 45_000 });
  await waitForAppReady(page);

  return {
    app,
    page,
    tempRoot,
    stateRoot,
    logs: () => logs.join(''),
    close: async () => {
      await options.testInfo.attach('electron-log.txt', {
        body: logs.join(''),
        contentType: 'text/plain',
      });
      await app.close().catch(() => undefined);
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#app-loader')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('body')).not.toContainText(/startup error|could not load|was compiled against a different node\.js version/i, {
    timeout: 45_000,
  });
}

export async function navigateApp(page: Page, route: string): Promise<void> {
  const normalized = normalizeInitialRoute(route);
  await page.evaluate((nextRoute) => {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: nextRoute } }));
  }, normalized);
  await page.waitForURL((url) => url.pathname === normalized, { timeout: 30_000 });
  await waitForAppReady(page);
}

export async function assertDesktopApiEndpoints(page: Page): Promise<void> {
  const endpoints = [
    '/api/extensions/installed',
    '/api/extensions/routes',
    '/api/extensions/surfaces',
    '/api/gateways',
    '/api/extensions/keybindings',
    '/api/extensions',
    '/api/extensions/slash-commands',
    '/api/extensions/mentions',
  ];
  const checks = await page.evaluate(async (paths) => {
    return Promise.all(
      paths.map(async (path) => {
        try {
          const response = await fetch(path);
          const body = await response.text();
          return { path, status: response.status, ok: response.ok, body: body.slice(0, 500) };
        } catch (error) {
          return { path, status: 0, ok: false, body: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
  }, endpoints);
  expect(checks.filter((check) => !check.ok)).toEqual([]);
}

export async function waitForNoComposerRunIndicators(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('.ui-composer-state-streaming')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText('Working…')).toHaveCount(0, { timeout: 45_000 });
}
