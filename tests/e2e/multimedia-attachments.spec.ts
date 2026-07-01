/* eslint-disable no-empty-pattern */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchTestApp, seedConversationSession, seedRuntimeSettings } from './fixtures/electronApp';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');

function writeMultimediaFixtures(root: string): Record<'image' | 'video' | 'audio' | 'pdf' | 'markdown', string> {
  const fixtureDir = join(root, 'multimedia-fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  const image = join(fixtureDir, 'probe-pixel.png');
  const video = join(fixtureDir, 'probe-clip.mp4');
  const audio = join(fixtureDir, 'probe-tone.wav');
  const pdf = join(fixtureDir, 'probe-brief.pdf');
  const markdown = join(fixtureDir, 'probe-notes.md');

  writeFileSync(image, PNG_1X1);
  writeFileSync(video, Buffer.from('not a playable video, but a real local file for composer payload QA\n'));
  writeFileSync(audio, Buffer.from('RIFF$\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0@\x1f\0\0\x80>\0\0\x02\0\x10\0data\0\0\0\0', 'binary'));
  writeFileSync(
    pdf,
    Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << >> >> endobj\n4 0 obj << /Length 0 >> stream\n\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
    ),
  );
  writeFileSync(markdown, '# Probe Notes\n\nMarkdown fixture for multimedia attachment QA.\n');

  return { image, video, audio, pdf, markdown };
}

function readProbeAttachmentNames(stateRoot: string, probeDirName: string): string[] {
  const probesDir = join(stateRoot, 'neon-pilot-runtime', probeDirName);
  if (!existsSync(probesDir)) return [];
  return readdirSync(probesDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const metadataPath = join(probesDir, entry.name, 'metadata.json');
    if (!existsSync(metadataPath)) return [];
    const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as { attachments?: Array<{ name?: unknown }> };
    return (parsed.attachments ?? []).flatMap((attachment) => (typeof attachment.name === 'string' ? [attachment.name] : []));
  });
}

test('conversation composer attaches multimedia files and serializes audio/document payloads @chat @multimedia', async ({}, testInfo) => {
  const conversationId = `multimedia-attachments-e2e-${Date.now()}`;
  const testApp = await launchTestApp({
    testInfo,
    initialRoute: `/conversations/${conversationId}`,
    prepareState: (stateRoot) => {
      seedConversationSession(stateRoot, {
        id: conversationId,
        title: 'Multimedia attachment E2E',
        messages: [{ role: 'assistant', content: 'Ready for multimedia attachment QA.' }],
      });
      seedRuntimeSettings(stateRoot, {
        openConversationIds: [conversationId],
        activeConversationId: conversationId,
      });
    },
  });

  try {
    const page = testApp.page;
    const fixtures = writeMultimediaFixtures(testApp.tempRoot);

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', /audio\/\*/);
    await fileInput.setInputFiles([fixtures.image, fixtures.video, fixtures.audio, fixtures.pdf, fixtures.markdown]);

    await expect(page.getByText('probe-pixel.png')).toBeVisible();
    await expect(page.getByText('probe-clip.mp4')).toBeVisible();
    await expect(page.getByText('probe-tone.wav')).toBeVisible();
    await expect(page.getByText('probe-brief.pdf')).toBeVisible();
    await expect(page.getByText('probe-notes.md')).toBeVisible();

    await page.getByRole('button', { name: 'Remove probe-notes.md' }).click();
    await expect(page.getByText('probe-notes.md')).toHaveCount(0);
    await fileInput.setInputFiles(fixtures.markdown);
    await expect(page.getByText('probe-notes.md')).toBeVisible();

    await page.evaluate(() => {
      const originalFetch = window.fetch.bind(window);
      const sentRequests: Array<{ url: string; body: unknown }> = [];
      Object.defineProperty(window, '__multimediaAttachmentRequests', {
        configurable: true,
        value: sentRequests,
      });
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (typeof url === 'string' && url.includes('/api/conversations/') && url.endsWith('/messages')) {
          let body: unknown = init?.body ?? null;
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body);
            } catch {
              body = init?.body;
            }
          }
          sentRequests.push({ url, body });
        }
        return originalFetch(input, init);
      };
    });

    await page.locator('textarea[placeholder*="Message Neon Pilot"]').fill('Please inspect these multimedia attachments.');
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Working…')).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            return (window as unknown as { __multimediaAttachmentRequests?: Array<{ body?: Record<string, unknown> }> })
              .__multimediaAttachmentRequests;
          }),
        { timeout: 5_000 },
      )
      .toEqual([
        expect.objectContaining({
          body: expect.objectContaining({
            audios: [expect.objectContaining({ name: 'probe-tone.wav' })],
            documents: expect.arrayContaining([
              expect.objectContaining({ name: 'probe-brief.pdf' }),
              expect.objectContaining({ name: 'probe-notes.md' }),
            ]),
          }),
        }),
      ]);
    await expect
      .poll(
        () => ({
          audio: readProbeAttachmentNames(testApp.stateRoot, 'audio-probes'),
          documents: readProbeAttachmentNames(testApp.stateRoot, 'document-probes'),
        }),
        { timeout: 10_000 },
      )
      .toEqual({
        audio: expect.arrayContaining(['probe-tone.wav']),
        documents: expect.arrayContaining(['probe-brief.pdf', 'probe-notes.md']),
      });
  } finally {
    await testApp.close();
  }
});
