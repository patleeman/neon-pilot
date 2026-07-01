/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import {
  expectCleanViewport,
  launchTestApp,
  seedConversationSession,
  seedRuntimeSettings,
  sidebarConversationRow,
} from './fixtures/electronApp';

const conversationIds = Array.from({ length: 6 }, (_, index) => `e2e-transcript-stress-${index + 1}`);
const workspaceName = 'e2e-transcript-stress-workspace';
const cwd = '/tmp/neon-pilot-e2e-transcript-stress-workspace';
const filler = 'large transcript payload '.repeat(28);

function seedLargeTranscriptConversations(stateRoot: string): void {
  seedRuntimeSettings(stateRoot, {
    openConversationIds: conversationIds,
    activeConversationId: conversationIds[0] ?? null,
    workspacePaths: [cwd],
  });

  for (const [conversationIndex, id] of conversationIds.entries()) {
    seedConversationSession(stateRoot, {
      id,
      title: `Transcript Stress ${conversationIndex + 1}`,
      workspace: workspaceName,
      cwd,
      messages: Array.from({ length: 180 }, (_, messageIndex) => ({
        role: messageIndex % 2 === 0 ? 'user' : 'assistant',
        content: `stress-${conversationIndex + 1}-message-${messageIndex} ${filler}`,
      })),
    });
  }
}

test('rapid sidebar transcript switching keeps only the latest large transcript visible @transcript-stampede', async ({}, testInfo) => {
  const finalConversationId = conversationIds[conversationIds.length - 1] ?? '';
  const firstConversationId = conversationIds[0] ?? '';
  const finalMarker = `stress-${conversationIds.length}-message-179`;
  const staleMarker = 'stress-1-message-179';
  const aggregateRequests: string[] = [];
  const aggregateFailures: string[] = [];

  const testApp = await launchTestApp({
    testInfo,
    initialRoute: `/conversations/${firstConversationId}`,
    prepareState: seedLargeTranscriptConversations,
  });
  try {
    const page = testApp.page;
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/\/api\/conversations\/[^/]+\/aggregate$/.test(url.pathname)) {
        aggregateRequests.push(url.pathname);
      }
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (/\/api\/conversations\/[^/]+\/aggregate$/.test(url.pathname)) {
        aggregateFailures.push(`${url.pathname}: ${request.failure()?.errorText ?? 'unknown'}`);
      }
    });

    await expect(page.locator('body')).toContainText('stress-1-message-179', { timeout: 30_000 });
    for (const id of conversationIds.slice(1)) {
      await sidebarConversationRow(page, id).click();
    }
    await page.waitForURL((url) => url.pathname === `/conversations/${finalConversationId}`, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText(finalMarker, { timeout: 30_000 });

    await page.waitForTimeout(2_000);
    await expect(page.locator('body')).toContainText(finalMarker);
    await expect(page.locator('[data-chat-transcript-panel="1"]')).not.toContainText(staleMarker);
    await expectCleanViewport(page);
    expect(aggregateRequests.length).toBeGreaterThan(0);
    expect(
      aggregateFailures.filter((failure) => !/aborted|cancelled|canceled/i.test(failure)),
      aggregateFailures.join('\n'),
    ).toEqual([]);
  } finally {
    await testApp.close();
  }
});
