import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { _electron as electron, type ElectronApplication, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

interface LaunchOptions {
  backgroundLaunch?: boolean;
  initialRoute?: string;
  electronArgs?: string[];
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

interface SeedConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SeedConversationOptions {
  id: string;
  title: string;
  workspace?: string;
  cwd?: string;
  modelId?: string;
  messages?: SeedConversationMessage[];
}

export interface SeedWorkspaceOptions {
  openConversationIds?: string[];
  pinnedConversationIds?: string[];
  archivedConversationIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
}

const repoRoot = process.cwd();
const desktopMainFile = resolve(repoRoot, 'packages/desktop/dist/main.js');
const require = createRequire(resolve(repoRoot, 'package.json'));
const APP_CLOSE_TIMEOUT_MS = 5_000;

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
  };
}

export async function launchTestApp(options: LaunchOptions): Promise<TestApp> {
  const initialRoute = normalizeInitialRoute(options.initialRoute);
  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-e2e-'));
  const stateRoot = options.stateRoot ?? join(tempRoot, 'state');
  await options.prepareState?.(stateRoot);
  const electronExecutable = require('electron') as string;
  const logs: string[] = [];
  const backgroundLaunchArgs = options.backgroundLaunch === false ? [] : ['--neon-pilot-background-launch'];
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [
      ...(options.electronArgs ?? []),
      desktopMainFile,
      '--no-quit-confirmation',
      ...backgroundLaunchArgs,
      `--neon-pilot-initial-route=${initialRoute}`,
    ],
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
      let closed = false;
      await Promise.race([
        app.close().then(() => {
          closed = true;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, APP_CLOSE_TIMEOUT_MS)),
      ]).catch(() => undefined);
      if (!closed && !child?.killed) {
        child?.kill();
      }
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

export async function apiJson<T = unknown>(page: Page, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const result = await page.evaluate(
    async ({ requestPath, requestInit }) => {
      const response = await fetch(requestPath, {
        method: requestInit?.method,
        headers: requestInit?.body === undefined ? undefined : { 'content-type': 'application/json' },
        body: requestInit?.body === undefined ? undefined : JSON.stringify(requestInit.body),
      });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { ok: response.ok, status: response.status, body, preview: text.slice(0, 500) };
    },
    { requestPath: path, requestInit: init },
  );
  expect(result, `${path} returned ${result.status}: ${result.preview}`).toEqual(expect.objectContaining({ ok: true }));
  return result.body as T;
}

export async function readSessions(page: Page, limit = 100): Promise<Array<Record<string, unknown>>> {
  const body = await apiJson<unknown>(page, `/api/sessions?limit=${limit}`);
  expect(Array.isArray(body)).toBe(true);
  return body as Array<Record<string, unknown>>;
}

export async function readSessionMeta(page: Page, sessionId: string): Promise<Record<string, unknown>> {
  return apiJson<Record<string, unknown>>(page, `/api/sessions/${encodeURIComponent(sessionId)}/meta`);
}

export async function resumeSession(page: Page, input: { sessionFile: string; cwd: string }): Promise<string> {
  const result = await apiJson<{ id?: unknown; error?: unknown }>(page, '/api/live-sessions/resume', {
    method: 'POST',
    body: { sessionFile: input.sessionFile, cwd: input.cwd },
  });
  expect(typeof result.id).toBe('string');
  return result.id as string;
}

export async function waitForNoComposerRunIndicators(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('.ui-composer-state-streaming')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText('Working…')).toHaveCount(0, { timeout: 45_000 });
}

export function composer(page: Page): Locator {
  return page.locator('textarea[placeholder*="Message Neon Pilot"]').first();
}

export function sidebarConversationRow(page: Page, sessionId: string): Locator {
  return page.locator(`[data-sidebar-session-id="${sessionId}"]`).first();
}

export async function openSidebarConversation(page: Page, sessionId: string): Promise<void> {
  await sidebarConversationRow(page, sessionId).click();
  await page.waitForURL((url) => url.pathname === `/conversations/${sessionId}`, { timeout: 30_000 });
  await waitForAppReady(page);
}

export function seedConversationSession(stateRoot: string, options: SeedConversationOptions): string {
  const workspace = options.workspace ?? 'e2e-workspace';
  const cwd = options.cwd ?? join(tmpdir(), workspace);
  const sessionDir = join(stateRoot, 'sync', 'pi-agent', 'sessions', workspace);
  const sessionFile = join(sessionDir, `${options.id}.jsonl`);
  mkdirSync(sessionDir, { recursive: true });
  const now = Date.now();
  const lines: Array<Record<string, unknown>> = [
    { type: 'session', id: options.id, timestamp: new Date(now).toISOString(), cwd, version: 3 },
    {
      type: 'model_change',
      id: `${options.id}-model`,
      parentId: null,
      modelId: options.modelId ?? 'openrouter/e2e-core-model',
    },
    {
      type: 'session_info',
      id: `${options.id}-title`,
      parentId: `${options.id}-model`,
      name: options.title,
    },
  ];
  let parentId = `${options.id}-title`;
  for (const [index, message] of (options.messages ?? []).entries()) {
    const id = `${options.id}-message-${index}`;
    lines.push({
      type: 'message',
      id,
      parentId,
      timestamp: new Date(now + (index + 1) * 1_000).toISOString(),
      message: { role: message.role, content: message.content },
    });
    parentId = id;
  }
  writeFileSync(sessionFile, `${lines.map(JSON.stringify).join('\n')}\n`);
  return sessionFile;
}

export function seedRuntimeSettings(stateRoot: string, workspace: SeedWorkspaceOptions = {}): void {
  const runtimeDir = join(stateRoot, 'neon-pilot-runtime');
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, 'auth.json'), '{}\n');
  writeFileSync(
    join(runtimeDir, 'settings.json'),
    `${JSON.stringify(
      {
        conversationAutoTitle: { reasoning: false },
        ui: {
          openConversationIds: workspace.openConversationIds ?? [],
          pinnedConversationIds: workspace.pinnedConversationIds ?? [],
          archivedConversationIds: workspace.archivedConversationIds ?? [],
          activeConversationId: workspace.activeConversationId ?? null,
          workspacePaths: workspace.workspacePaths ?? [],
          conversationWorkspaceRevision: 1,
          conversationWorkspaceUpdatedAt: new Date().toISOString(),
          conversationWorkspaceMigratedAt: new Date().toISOString(),
        },
      },
      null,
      2,
    )}\n`,
  );
}

export function seedDisabledExtensions(stateRoot: string, extensionIds: string[]): void {
  const extensionsDir = join(stateRoot, 'extensions');
  mkdirSync(extensionsDir, { recursive: true });
  writeFileSync(
    join(extensionsDir, 'registry.json'),
    `${JSON.stringify(
      {
        disabledIds: [...new Set(extensionIds)].sort((left, right) => left.localeCompare(right)),
        enabledIds: [],
        removedDefaultInstalledIds: [],
        disabledKeybindings: [],
        keybindingOverrides: {},
        commandKeybindings: {},
        quarantined: {},
      },
      null,
      2,
    )}\n`,
  );
}

export async function readConversationWorkspace(page: Page): Promise<Record<string, unknown>> {
  return apiJson<Record<string, unknown>>(page, '/api/conversation-workspace');
}

export async function waitForConversationWorkspace(
  page: Page,
  predicate: (workspace: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  let latest: Record<string, unknown> = {};
  await expect
    .poll(
      async () => {
        latest = await readConversationWorkspace(page);
        return predicate(latest);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return latest;
}

export async function expectCleanViewport(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText(
    /Unhandled rejection|Cannot find module|Local API route|file:\/\/|TypeError|ReferenceError|ENOENT|Module\./i,
  );
}
