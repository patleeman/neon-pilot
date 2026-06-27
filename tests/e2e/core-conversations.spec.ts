/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import {
  apiJson,
  expectCleanViewport,
  launchTestApp,
  navigateApp,
  openSidebarConversation,
  resumeSession,
  seedConversationSession,
  seedRuntimeSettings,
  sidebarConversationRow,
  waitForConversationWorkspace,
} from './fixtures/electronApp';

const alphaId = 'e2e-core-alpha';
const betaId = 'e2e-core-beta';
const archivedId = 'e2e-core-archived';
const workspaceName = 'e2e-core-workspace';
const cwd = '/tmp/neon-pilot-e2e-core-workspace';
let betaSessionFile = '';
let archivedSessionFile = '';

function seedCoreConversations(stateRoot: string): void {
  seedRuntimeSettings(stateRoot, {
    openConversationIds: [alphaId, betaId],
    archivedConversationIds: [archivedId],
    activeConversationId: alphaId,
    workspacePaths: [cwd],
  });
  seedConversationSession(stateRoot, {
    id: alphaId,
    title: 'E2E Core Alpha',
    workspace: workspaceName,
    cwd,
    messages: [
      { role: 'user', content: 'Alpha seeded user prompt' },
      { role: 'assistant', content: 'Alpha seeded assistant answer' },
    ],
  });
  betaSessionFile = seedConversationSession(stateRoot, {
    id: betaId,
    title: 'E2E Core Beta',
    workspace: workspaceName,
    cwd,
    messages: [
      { role: 'user', content: 'Beta seeded user prompt' },
      { role: 'assistant', content: 'Beta seeded assistant answer' },
    ],
  });
  archivedSessionFile = seedConversationSession(stateRoot, {
    id: archivedId,
    title: 'E2E Core Archived',
    workspace: workspaceName,
    cwd,
    messages: [
      { role: 'user', content: 'Archived seeded user prompt' },
      { role: 'assistant', content: 'Archived seeded assistant answer' },
    ],
  });
}

function dispatchConversationCommand(page: import('@playwright/test').Page, command: string): Promise<void> {
  return page.evaluate((nextCommand) => {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: nextCommand, source: 'command-palette' } }));
  }, command);
}

test('seeded conversations navigate, persist, and update sidebar placement state @core-conversations', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: `/conversations/${alphaId}`,
    prepareState: seedCoreConversations,
  });
  try {
    const page = testApp.page;

    await expect(page.locator('body')).toContainText('Alpha seeded assistant answer', { timeout: 30_000 });
    const betaConversationId = await resumeSession(page, { sessionFile: betaSessionFile, cwd });
    const archivedConversationId = await resumeSession(page, { sessionFile: archivedSessionFile, cwd });
    await apiJson(page, '/api/conversation-workspace/operation', {
      method: 'POST',
      body: { operation: 'open', sessionId: betaConversationId, active: false },
    });
    await apiJson(page, '/api/conversation-workspace/operation', {
      method: 'POST',
      body: { operation: 'archive', sessionId: archivedConversationId },
    });
    await expect(sidebarConversationRow(page, alphaId)).toBeVisible();
    await expect(sidebarConversationRow(page, betaConversationId)).toBeVisible();
    await expect(sidebarConversationRow(page, archivedConversationId)).toHaveCount(0);
    await expectCleanViewport(page);

    await openSidebarConversation(page, betaConversationId);
    await expect(page.locator('body')).toContainText('Beta seeded assistant answer', { timeout: 30_000 });
    await waitForConversationWorkspace(page, (workspace) => workspace.activeConversationId === betaConversationId);

    await dispatchConversationCommand(page, 'conversation.togglePinned');
    await waitForConversationWorkspace(
      page,
      (workspace) => Array.isArray(workspace.pinnedSessionIds) && workspace.pinnedSessionIds.includes(betaConversationId),
    );
    await expect(sidebarConversationRow(page, betaConversationId)).toBeVisible();

    await dispatchConversationCommand(page, 'conversation.toggleArchived');
    await waitForConversationWorkspace(
      page,
      (workspace) => Array.isArray(workspace.archivedSessionIds) && workspace.archivedSessionIds.includes(betaConversationId),
    );
    await page.waitForURL((url) => url.pathname === `/conversations/${alphaId}`, { timeout: 30_000 });
    await expect(sidebarConversationRow(page, betaConversationId)).toHaveCount(0);

    await apiJson(page, '/api/conversation-workspace/operation', {
      method: 'POST',
      body: { operation: 'restore', sessionId: betaConversationId },
    });
    await navigateApp(page, `/conversations/${betaConversationId}`);
    await expect(page.locator('body')).toContainText('Beta seeded assistant answer', { timeout: 30_000 });
    await waitForConversationWorkspace(
      page,
      (workspace) =>
        Array.isArray(workspace.sessionIds) &&
        workspace.sessionIds.includes(betaConversationId) &&
        workspace.activeConversationId === betaConversationId,
    );

    await page.reload();
    await expect(page.locator('body')).toContainText('Beta seeded assistant answer', { timeout: 30_000 });
    await expect(sidebarConversationRow(page, betaConversationId)).toBeVisible();
    await expectCleanViewport(page);
  } finally {
    await testApp.close();
  }
});
