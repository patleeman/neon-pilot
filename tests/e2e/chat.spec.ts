/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import {
  apiJson,
  expectCleanViewport,
  launchTestApp,
  seedConversationSession,
  seedRuntimeSettings,
  waitForNoComposerRunIndicators,
} from './fixtures/electronApp';

test('chat composer sends an inline bash command, persists output, and stays idle afterward @chat', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/conversations/new' });
  try {
    const page = testApp.page;
    const marker = `NEON_E2E_CHAT_DONE_${Date.now()}`;
    const shellCommand = `sleep 1; printf ${JSON.stringify(`${marker}\n`)}`;
    const prompt = `!!sh -c ${JSON.stringify(shellCommand)}`;
    const visibleCommand = prompt.slice(2);
    const composer = page.locator('textarea[placeholder*="Message Neon Pilot"]').first();

    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    await composer.fill(prompt);
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.locator('.ui-terminal-block__command').filter({ hasText: visibleCommand })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.ui-terminal-block__output').filter({ hasText: marker })).toBeVisible({ timeout: 45_000 });
    await waitForNoComposerRunIndicators(page);

    const savedPath = new URL(page.url()).pathname;
    expect(savedPath).toMatch(/^\/conversations\/[^/]+$/);
    await page.reload();
    await expect(page.locator('.ui-terminal-block__output').filter({ hasText: marker })).toBeVisible({ timeout: 30_000 });
    await waitForNoComposerRunIndicators(page);
  } finally {
    await testApp.close();
  }
});

test('conversation composer saves the selected model preference @chat', async ({}, testInfo) => {
  const conversationId = `model-pref-e2e-${Date.now()}`;
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: `/conversations/${conversationId}`,
    prepareState: (stateRoot) => {
      seedConversationSession(stateRoot, {
        id: conversationId,
        title: 'Model preference E2E',
        modelId: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: 'hello' }],
      });
      seedRuntimeSettings(stateRoot, {
        openConversationIds: [conversationId],
        activeConversationId: conversationId,
      });
    },
  });
  try {
    const page = testApp.page;
    const responses: Array<{ status: number; body: string }> = [];
    page.on('response', async (response) => {
      if (!response.url().includes(`/api/conversations/${conversationId}/model-preferences`)) return;
      responses.push({ status: response.status(), body: await response.text().catch(() => '') });
    });

    await expect(page.locator('summary[aria-label="Conversation model"]')).toContainText('GPT-5.4 mini');
    await page.locator('summary[aria-label="Conversation model"]').click();
    await page.locator('details[data-model-picker-menu][open] button[role="menuitem"]', { hasText: 'GPT-5.3 Codex Spark' }).click();

    await expect(page.getByText('Model set to GPT-5.3 Codex Spark for this conversation.')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('summary[aria-label="Conversation model"]')).toContainText('GPT-5.3 Codex Spark');
    expect(responses.some((response) => response.status === 200 && response.body.includes('gpt-5.3-codex-spark'))).toBe(true);

    const saved = await apiJson<{ currentModel: string }>(page, `/api/conversations/${conversationId}/model-preferences`);
    expect(saved.currentModel).toBe('gpt-5.3-codex-spark');
    await expectCleanViewport(page);
    await expect(page.locator('body')).not.toContainText('Could not save the model preference.');

    await page.reload();
    await expect(page.locator('summary[aria-label="Conversation model"]')).toContainText('GPT-5.3 Codex Spark', {
      timeout: 30_000,
    });
    await expectCleanViewport(page);
  } finally {
    await testApp.close();
  }
});
