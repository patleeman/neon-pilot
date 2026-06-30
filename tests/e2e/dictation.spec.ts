/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { composer, expectCleanViewport, launchTestApp, seedDisabledExtensions, seedRuntimeSettings } from './fixtures/electronApp';

test('composer dictation records, transcribes, and inserts visible text @dictation', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/conversations/new',
    electronArgs: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    prepareState: (stateRoot) => {
      seedRuntimeSettings(stateRoot);
      seedDisabledExtensions(stateRoot, ['system-onboarding']);
    },
  });
  const page = testApp.page;
  try {
    const dictatedText = `visible dictation text ${Date.now()}`;

    await page.evaluate((text) => {
      const target = window as typeof window & {
        __neonPilotDictationOriginalFetch?: typeof window.fetch;
        __neonPilotDictationTranscribePayload?: unknown;
      };
      target.__neonPilotDictationOriginalFetch ??= window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/extensions/system-local-dictation/actions/modelStatus')) {
          return new Response(JSON.stringify({ ok: true, result: { provider: 'local-whisper', model: 'base.en', installed: true } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/extensions/system-local-dictation/actions/transcribeFile')) {
          target.__neonPilotDictationTranscribePayload =
            typeof init?.body === 'string' ? JSON.parse(init.body) : { bodyType: typeof init?.body };
          return new Response(JSON.stringify({ ok: true, result: { text: ` ${text} `, provider: 'local-whisper', model: 'base.en' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return target.__neonPilotDictationOriginalFetch?.(input, init) ?? fetch(input, init);
      };
    }, dictatedText);

    const readTranscribePayload = async () =>
      page.evaluate(() => {
        return ((window as typeof window & { __neonPilotDictationTranscribePayload?: unknown }).__neonPilotDictationTranscribePayload ??
          null) as Record<string, unknown> | null;
      });

    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    const input = composer(page);
    await expect(input).toBeVisible();

    await page.getByRole('button', { name: 'Start dictation' }).click();
    await expect(page.getByRole('button', { name: 'Stop dictation' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Stop dictation' }).click();

    await expect(input).toHaveValue(dictatedText, { timeout: 30_000 });
    const transcribePayload = await readTranscribePayload();
    expect(transcribePayload).toEqual(
      expect.objectContaining({
        mimeType: 'audio/pcm;rate=16000;channels=1',
        fileName: 'dictation.pcm',
      }),
    );
    expect(typeof transcribePayload?.dataBase64).toBe('string');
    expect((transcribePayload?.dataBase64 as string).length).toBeGreaterThan(0);
    await expectCleanViewport(page);
  } finally {
    await page
      .evaluate(() => {
        const target = window as typeof window & { __neonPilotDictationOriginalFetch?: typeof window.fetch };
        if (target.__neonPilotDictationOriginalFetch) {
          window.fetch = target.__neonPilotDictationOriginalFetch;
          delete target.__neonPilotDictationOriginalFetch;
        }
      })
      .catch(() => undefined);
    await testApp.close();
  }
});

test('composer submit waits for active dictation before sending @dictation', async ({}, testInfo) => {
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: '/conversations/new',
    electronArgs: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    prepareState: (stateRoot) => {
      seedRuntimeSettings(stateRoot);
      seedDisabledExtensions(stateRoot, ['system-onboarding']);
    },
  });
  const page = testApp.page;
  try {
    const marker = `DICTATION_SEND_${Date.now()}`;

    await page.evaluate((text) => {
      const target = window as typeof window & {
        __neonPilotDictationOriginalFetch?: typeof window.fetch;
        __neonPilotDictationTranscribePayload?: unknown;
      };
      target.__neonPilotDictationOriginalFetch ??= window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/extensions/system-local-dictation/actions/modelStatus')) {
          return new Response(JSON.stringify({ ok: true, result: { provider: 'local-whisper', model: 'base.en', installed: true } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/extensions/system-local-dictation/actions/transcribeFile')) {
          target.__neonPilotDictationTranscribePayload =
            typeof init?.body === 'string' ? JSON.parse(init.body) : { bodyType: typeof init?.body };
          return new Response(JSON.stringify({ ok: true, result: { text, provider: 'local-whisper', model: 'base.en' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return target.__neonPilotDictationOriginalFetch?.(input, init) ?? fetch(input, init);
      };
    }, marker);

    await expect(page.getByRole('heading', { name: 'New Conversation' })).toBeVisible();
    const input = composer(page);
    await expect(input).toBeVisible();

    await input.fill('!!printf ');
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
    await page.getByRole('button', { name: 'Start dictation' }).click();
    await expect(page.getByRole('button', { name: 'Stop dictation' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(input).toHaveValue('', { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(`printf ${marker}`, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(marker, { timeout: 45_000 });
    await expectCleanViewport(page);
  } finally {
    await page
      .evaluate(() => {
        const target = window as typeof window & { __neonPilotDictationOriginalFetch?: typeof window.fetch };
        if (target.__neonPilotDictationOriginalFetch) {
          window.fetch = target.__neonPilotDictationOriginalFetch;
          delete target.__neonPilotDictationOriginalFetch;
        }
      })
      .catch(() => undefined);
    await testApp.close();
  }
});
