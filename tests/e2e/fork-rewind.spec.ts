import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* eslint-disable no-empty-pattern */
import { expect, type Page, test } from '@playwright/test';

import { launchTestApp, navigateApp } from './fixtures/electronApp';

const sourceSessionId = 'fork-rewind-source';
const sourceWorkspace = 'fork-rewind-workspace';
const sourceCwd = '/tmp/neon-fixture/fork-rewind-workspace';
const sourceTitle = 'Fork Rewind E2E Source';
const promptOne = 'E2E user prompt one: put this back in composer on user branch';
const answerOne = 'E2E assistant answer one: fork through this assistant message';
const promptTwo = 'E2E user prompt two: rewind from assistant should restore this';
const answerTwo = 'E2E assistant answer two: this must be absent after assistant rewind';

function sourceSessionFile(stateRoot: string): string {
  return join(stateRoot, 'sync', 'pi-agent', 'sessions', sourceWorkspace, `${sourceSessionId}.jsonl`);
}

function seedSourceSession(stateRoot: string): void {
  mkdirSync(join(stateRoot, 'neon-pilot-runtime'), { recursive: true });
  writeFileSync(join(stateRoot, 'neon-pilot-runtime', 'auth.json'), '{}\n');
  writeFileSync(
    join(stateRoot, 'neon-pilot-runtime', 'settings.json'),
    `${JSON.stringify({ conversationAutoTitle: { reasoning: false } }, null, 2)}\n`,
  );
  mkdirSync(join(stateRoot, 'sync', 'pi-agent', 'sessions', sourceWorkspace), { recursive: true });
  const now = Date.now();
  const lines = [
    { type: 'session', id: sourceSessionId, timestamp: new Date(now).toISOString(), cwd: sourceCwd, version: 3 },
    { type: 'model_change', id: 'entry-model-change', parentId: null, modelId: 'openrouter/test-fork-rewind-model' },
    { type: 'session_info', id: 'entry-session-info', parentId: 'entry-model-change', name: sourceTitle },
    {
      type: 'message',
      id: 'entry-user-1',
      parentId: 'entry-session-info',
      timestamp: new Date(now + 1_000).toISOString(),
      message: { role: 'user', content: promptOne },
    },
    {
      type: 'message',
      id: 'entry-assistant-1',
      parentId: 'entry-user-1',
      timestamp: new Date(now + 2_000).toISOString(),
      message: { role: 'assistant', content: answerOne },
    },
    {
      type: 'message',
      id: 'entry-user-2',
      parentId: 'entry-assistant-1',
      timestamp: new Date(now + 3_000).toISOString(),
      message: { role: 'user', content: promptTwo },
    },
    {
      type: 'message',
      id: 'entry-assistant-2',
      parentId: 'entry-user-2',
      timestamp: new Date(now + 4_000).toISOString(),
      message: { role: 'assistant', content: answerTwo },
    },
  ];
  writeFileSync(sourceSessionFile(stateRoot), `${lines.map(JSON.stringify).join('\n')}\n`);
}

async function resumeSource(page: Page, stateRoot: string): Promise<string> {
  const result = await page.evaluate(
    async ({ file, cwd }) => {
      const response = await fetch('/api/live-sessions/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionFile: file, cwd }),
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, id: body?.id || null, error: body?.error || null };
    },
    { file: sourceSessionFile(stateRoot), cwd: sourceCwd },
  );
  expect(result).toEqual(expect.objectContaining({ ok: true, id: expect.any(String) }));
  return result.id;
}

async function readSessions(page: Page): Promise<Array<Record<string, unknown>>> {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/sessions?limit=100');
    const body = await response.json().catch(() => []);
    return { ok: response.ok, body };
  });
  expect(result.ok).toBe(true);
  expect(Array.isArray(result.body)).toBe(true);
  return result.body as Array<Record<string, unknown>>;
}

async function readSessionMeta(page: Page, sessionId: string): Promise<Record<string, unknown>> {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/meta`);
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, body };
  }, sessionId);
  expect(result.ok).toBe(true);
  return result.body as Record<string, unknown>;
}

async function clickMessageAction(page: Page, text: string, action: 'fork' | 'rewind', sourceId: string): Promise<string> {
  const existing = new Set((await readSessions(page)).map((session) => session.id).filter((id): id is string => typeof id === 'string'));
  const clicked = await page.evaluate(
    ({ needle, actionText }) => {
      const expectedButtonLabel = actionText === 'fork' ? 'Fork into a new conversation' : 'Rewind into a new conversation';
      const blocks = Array.from(document.querySelectorAll('[data-transcript-block-id]')).filter(
        (candidate) => !candidate.closest('[data-chat-rail="1"]'),
      );
      const block = blocks.find((candidate) => (candidate.textContent || '').includes(needle));
      if (!block) return { ok: false, reason: 'block not found' };
      block.scrollIntoView({ block: 'center', inline: 'nearest' });
      const button = Array.from(block.querySelectorAll('button')).find((candidate) =>
        (candidate.getAttribute('aria-label') || '').startsWith(expectedButtonLabel),
      ) as HTMLButtonElement | undefined;
      if (!button)
        return {
          ok: false,
          reason: 'button not found',
          buttons: Array.from(block.querySelectorAll('button')).map((candidate) => candidate.getAttribute('aria-label')),
        };
      button.click();
      return { ok: true };
    },
    { needle: text, actionText: action },
  );
  expect(clicked).toEqual(expect.objectContaining({ ok: true }));

  const expectedKind = action === 'rewind' ? 'rewind' : 'fork';
  await expect
    .poll(
      async () => {
        const sessions = await readSessions(page);
        return (
          sessions.find(
            (session) =>
              typeof session.id === 'string' &&
              !existing.has(session.id) &&
              session.parentSessionId === sourceId &&
              session.offshootKind === expectedKind,
          )?.id ?? null
        );
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();

  const sessions = await readSessions(page);
  return sessions.find(
    (session) =>
      typeof session.id === 'string' &&
      !existing.has(session.id) &&
      session.parentSessionId === sourceId &&
      session.offshootKind === expectedKind,
  )?.id as string;
}

function readJsonl(file: string): Array<Record<string, unknown>> {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function expectOffshoot(page: Page, stateRoot: string, childId: string, kind: 'fork' | 'rewind'): Promise<void> {
  const meta = await readSessionMeta(page, childId);
  expect(meta.cwd).toBe(sourceCwd);
  expect(meta.parentSessionId).toBe(sourceSessionId);
  expect(meta.offshootKind).toBe(kind);
  expect(typeof meta.file).toBe('string');
  const childLines = readJsonl(meta.file as string);
  expect(childLines.some((line) => line.customType === 'conversation_offshoot_metadata')).toBe(true);
  const sourceLines = readJsonl(sourceSessionFile(stateRoot));
  expect(
    sourceLines.some(
      (line) => line.customType === 'child_conversation_topology' && typeof line.content === 'string' && line.content.includes(childId),
    ),
  ).toBe(true);
}

test('fork and rewind create linked child conversations @fork-rewind', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/',
    prepareState: seedSourceSession,
  });
  try {
    const page = testApp.page;
    const sourceId = await resumeSource(page, testApp.stateRoot);

    await navigateApp(page, `/conversations/${sourceId}`);
    await expect(page.locator('body')).toContainText(promptOne, { timeout: 30_000 });

    const forkId = await clickMessageAction(page, promptOne, 'fork', sourceId);
    await expect(page.locator('[data-chat-rail="1"]')).toContainText('Forked from', { timeout: 30_000 });
    await expectOffshoot(page, testApp.stateRoot, forkId, 'fork');

    await navigateApp(page, `/conversations/${sourceId}`);
    await expect(page.locator('body')).toContainText(answerOne, { timeout: 30_000 });
    const rewindId = await clickMessageAction(page, answerOne, 'rewind', sourceId);
    await expect(page.locator('[data-chat-rail="1"]')).toContainText('Rewound from', { timeout: 30_000 });
    await expectOffshoot(page, testApp.stateRoot, rewindId, 'rewind');
  } finally {
    await testApp.close();
  }
});
