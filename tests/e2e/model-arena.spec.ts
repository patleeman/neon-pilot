/* eslint-disable no-empty-pattern */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { apiJson, expectCleanViewport, launchTestApp, seedConversationSession, seedRuntimeSettings } from './fixtures/electronApp';

const conversationId = 'model-arena-manual-e2e';
const prompt = 'Explain why the manual Model Arena compare action should show a loading duel immediately.';
const answer = 'The primary answer is already complete, so the compare view should appear before the challenger finishes.';
const challengerRef = 'arena-e2e/e2e-challenger';

async function configureArena(page: Page) {
  await apiJson(page, '/api/model-providers/arena-e2e', {
    method: 'PATCH',
    body: {
      api: 'openai-responses',
      baseUrl: 'http://127.0.0.1:9/v1',
      authHeader: true,
    },
  });
  await apiJson(page, '/api/provider-auth/arena-e2e/api-key', {
    method: 'PATCH',
    body: { apiKey: 'arena-e2e-fake-key' },
  });
  await apiJson(page, '/api/model-providers/arena-e2e/models/e2e-challenger', {
    method: 'PATCH',
    body: {
      name: 'Arena E2E Challenger',
      input: ['text'],
      contextWindow: 8192,
    },
  });
  await apiJson(page, '/api/models/refresh', { method: 'POST' });
  const saved = await apiJson<{ ok: true; result: { settings: { challengerModels: string[] } } }>(
    page,
    '/api/extensions/system-model-arena/actions/saveArenaSettings',
    {
      method: 'POST',
      body: {
        automaticDuels: false,
        sampleRate: 0,
        rampedSampleRate: 0,
        rampDownAfterVotes: 0,
        minPromptChars: 1,
        challengerModels: [challengerRef],
      },
    },
  );
  expect(saved.result.settings.challengerModels).toContain(challengerRef);
  const state = await apiJson<{ ok: true; result: { settings: { challengerModels: string[] } } }>(
    page,
    '/api/extensions/system-model-arena/actions/getArenaState',
    {
      method: 'POST',
      body: {},
    },
  );
  expect(state.result.settings.challengerModels).toContain(challengerRef);
}

async function clickCompareModels(page: Page) {
  const clicked = await page.evaluate((needle) => {
    const blocks = Array.from(document.querySelectorAll('[data-transcript-block-id]')).filter(
      (candidate) => !candidate.closest('[data-chat-rail="1"]'),
    );
    const block = blocks.find((candidate) => (candidate.textContent || '').includes(needle));
    if (!block) return { ok: false, reason: 'assistant block not found' };
    block.scrollIntoView({ block: 'center', inline: 'nearest' });
    const button = Array.from(block.querySelectorAll('button')).find((candidate) =>
      (candidate.getAttribute('aria-label') || '').startsWith('Compare models'),
    ) as HTMLButtonElement | undefined;
    if (!button) {
      return {
        ok: false,
        reason: 'compare button not found',
        buttons: Array.from(block.querySelectorAll('button')).map(
          (candidate) => candidate.getAttribute('aria-label') || candidate.textContent,
        ),
      };
    }
    button.click();
    return { ok: true };
  }, answer);
  expect(clicked).toEqual(expect.objectContaining({ ok: true }));
}

test('manual Model Arena compare renders immediately and does not surface worker timeout @chat', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const workspace = `model-arena-e2e-${Date.now()}`;
  const cwd = join(tmpdir(), workspace);
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: `/conversations/${conversationId}`,
    prepareState: (stateRoot) => {
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, 'CONTEXT.md'), '# Test workspace\n\nModel Arena e2e workspace.\n', 'utf-8');
      seedConversationSession(stateRoot, {
        id: conversationId,
        title: 'Model Arena manual compare E2E',
        workspace,
        cwd,
        modelId: 'arena-e2e/e2e-primary',
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: answer },
        ],
      });
      seedRuntimeSettings(stateRoot, {
        openConversationIds: [conversationId],
        activeConversationId: conversationId,
        workspacePaths: [cwd],
      });
    },
  });
  try {
    const page = testApp.page;
    await configureArena(page);
    await page.reload();
    await expect(page.getByText(answer)).toBeVisible({ timeout: 30_000 });

    await clickCompareModels(page);

    const duel = page.locator('section[data-model-arena-duel]').first();
    await expect(duel.getByText('Model Arena duel')).toBeVisible({ timeout: 5_000 });
    await expect(duel.getByText('Waiting for answer...')).toBeVisible({ timeout: 5_000 });
    await expect(duel.getByText(answer)).toBeVisible();
    await testInfo.attach('model-arena-duel-immediate.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.waitForTimeout(20_000);
    await expect(page.locator('body')).not.toContainText(/run export timed out|Compare models failed/i);
    await testInfo.attach('model-arena-duel-after-timeout-window.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await expectCleanViewport(page);
  } finally {
    await testApp.close();
  }
});
