import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readSavedModelPreferencesMock, runAgentTaskMock } = vi.hoisted(() => ({
  readSavedModelPreferencesMock: vi.fn(() => ({ currentVisionModel: 'openai/gpt-4o' })),
  runAgentTaskMock: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/agent', () => ({ runAgentTask: runAgentTaskMock }));
vi.mock('@neon-pilot/extensions/backend/audio', () => ({
  getAudioProbeAttachments: vi.fn(() => []),
  getAudioProbeAttachmentsById: vi.fn(() => []),
  getAudioProbeAttachmentsByIdFromAnySession: vi.fn(() => []),
  transcribeAudioAttachment: vi.fn(),
}));
vi.mock('@neon-pilot/extensions/backend/documents', () => ({
  extractDocumentText: vi.fn(),
  getDocumentProbeAttachments: vi.fn(() => []),
  getDocumentProbeAttachmentsById: vi.fn(() => []),
  getDocumentProbeAttachmentsByIdFromAnySession: vi.fn(() => []),
}));

vi.mock('../models/modelPreferences.js', () => ({
  readSavedModelPreferences: readSavedModelPreferencesMock,
}));

vi.mock('../ui/settingsPersistence.js', () => ({
  getRuntimeSettingsFilePath: () => '/runtime/settings.json',
}));

import { probeImage } from '../../../../extensions/system-image-probe/src/backend.js';
import { clearImageProbeAttachmentCacheForTests } from '../extensions/imageProbeAttachmentStore.js';
import { runPromptOnLiveEntry } from './liveSessionPromptOps.js';

const tempDirs: string[] = [];
const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'pa-live-image-probe-e2e-'));
  tempDirs.push(dir);
  process.env.NEON_PILOT_STATE_ROOT = dir;
  readSavedModelPreferencesMock.mockReset();
  runAgentTaskMock.mockReset();
  readSavedModelPreferencesMock.mockReturnValue({ currentVisionModel: 'openai/gpt-4o' });
  clearImageProbeAttachmentCacheForTests();
});

afterEach(async () => {
  clearImageProbeAttachmentCacheForTests();
  if (originalStateRoot === undefined) {
    delete process.env.NEON_PILOT_STATE_ROOT;
  } else {
    process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('text-only live session image probing flow', () => {
  it('stores text-only prompt images, exposes stable IDs, and sends selected bytes to the vision subagent', async () => {
    const originalImageData = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('fake-image-pixels'),
    ]).toString('base64');
    const entry = {
      sessionId: 'session-e2e',
      session: {
        model: { provider: 'local', id: 'text-only', input: ['text'] },
        prompt: vi.fn(async () => undefined),
        steer: vi.fn(async () => undefined),
        followUp: vi.fn(async () => undefined),
      },
    };

    await runPromptOnLiveEntry(
      entry as never,
      'What does this screenshot show?',
      undefined,
      [{ type: 'image', data: originalImageData, mimeType: 'image/png', name: 'screen.png' }],
      undefined,
      undefined,
      undefined,
      {
        repairLiveSessionTranscriptTail: vi.fn(),
        broadcastQueueState: vi.fn(),
      },
    );

    const promptText = entry.session.prompt.mock.calls[0]?.[0] as string;
    const imageId = promptText.match(/img_[a-f0-9]{12}/)?.[0];
    expect(imageId).toBeTruthy();
    expect(promptText).toContain(`- ${imageId}: screen.png (image/png)`);
    expect(entry.session.prompt).toHaveBeenCalledWith(expect.any(String));

    runAgentTaskMock.mockResolvedValue({ text: 'It shows a fake screenshot.', model: 'gpt-4o', provider: 'openai' });

    const result = await probeImage({ imageIds: [imageId!], question: 'What does this screenshot show?' }, {
      toolContext: { cwd: '/repo', preferredVisionModel: 'openai/gpt-4o', sessionId: 'session-e2e' },
    } as never);

    expect(runAgentTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        modelRef: 'openai/gpt-4o',
        prompt: expect.stringContaining(`${imageId}: screen.png (image/png)`),
        images: [{ type: 'image', data: originalImageData, mimeType: 'image/png' }],
        tools: 'none',
      }),
      expect.anything(),
    );
    expect(result.content).toEqual([{ type: 'text', text: 'It shows a fake screenshot.' }]);
    expect(result.details).toMatchObject({ imageIds: [imageId], model: 'gpt-4o', provider: 'openai' });
  });
});
