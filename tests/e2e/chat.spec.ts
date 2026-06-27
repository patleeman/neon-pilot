/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { launchTestApp, waitForNoComposerRunIndicators } from './fixtures/electronApp';

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
