import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  generateParallelWorkerName,
  type ParallelPromptJob,
  readParallelState,
  readPersistedParallelJobs,
  resolveParallelJobsFile,
} from './liveSessionParallelJobs.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('liveSessionParallelJobs', () => {
  it('rejects unsafe persisted parallel job image counts', () => {
    const dir = createTempDir('pa-parallel-jobs-');
    const sessionFile = join(dir, 'session.jsonl');
    writeFileSync(
      resolveParallelJobsFile(sessionFile),
      JSON.stringify([
        {
          id: 'job-1',
          prompt: 'Compare this screenshot.',
          childConversationId: 'child-1',
          status: 'ready',
          createdAt: '2026-03-12T20:00:00.000Z',
          updatedAt: '2026-03-12T20:01:00.000Z',
          imageCount: Number.MAX_SAFE_INTEGER + 1,
        },
      ]),
    );

    expect(readPersistedParallelJobs(sessionFile)).toEqual([expect.objectContaining({ id: 'job-1', imageCount: 0 })]);
  });

  it('rejects absurd persisted parallel job image counts', () => {
    const dir = createTempDir('pa-parallel-jobs-');
    const sessionFile = join(dir, 'session.jsonl');
    writeFileSync(
      resolveParallelJobsFile(sessionFile),
      JSON.stringify([
        {
          id: 'job-1',
          prompt: 'Compare this screenshot.',
          childConversationId: 'child-1',
          status: 'ready',
          createdAt: '2026-03-12T20:00:00.000Z',
          updatedAt: '2026-03-12T20:01:00.000Z',
          imageCount: Number.MAX_SAFE_INTEGER,
        },
      ]),
    );

    expect(readPersistedParallelJobs(sessionFile)).toEqual([expect.objectContaining({ id: 'job-1', imageCount: 0 })]);
  });

  it('rejects unsafe parallel preview image counts', () => {
    const job: ParallelPromptJob = {
      id: 'job-unsafe',
      prompt: 'Compare this screenshot.',
      childConversationId: 'child-1',
      status: 'ready',
      createdAt: '2026-03-12T20:00:00.000Z',
      updatedAt: '2026-03-12T20:01:00.000Z',
      imageCount: Number.MAX_SAFE_INTEGER + 1,
      attachmentRefs: [],
      touchedFiles: [],
      parentTouchedFiles: [],
      overlapFiles: [],
      sideEffects: [],
      worktreeDirtyPathsAtStart: [],
    };

    expect(readParallelState([job])).toEqual([expect.objectContaining({ id: 'job-unsafe', imageCount: 0 })]);
  });

  it('rejects absurd parallel preview image counts', () => {
    const job: ParallelPromptJob = {
      id: 'job-absurd',
      prompt: 'Compare this screenshot.',
      childConversationId: 'child-1',
      status: 'ready',
      createdAt: '2026-03-12T20:00:00.000Z',
      updatedAt: '2026-03-12T20:01:00.000Z',
      imageCount: Number.MAX_SAFE_INTEGER,
      attachmentRefs: [],
      touchedFiles: [],
      parentTouchedFiles: [],
      overlapFiles: [],
      sideEffects: [],
      worktreeDirtyPathsAtStart: [],
    };

    expect(readParallelState([job])).toEqual([expect.objectContaining({ id: 'job-absurd', imageCount: 0 })]);
  });

  describe('parallel prompt worker identity', () => {
    it('generates a deterministic worker name seeded on childConversationId/purpose/prompt/id with a short hash suffix', () => {
      const base = {
        id: 'job-1',
        prompt: 'Refactor the auth module',
        childConversationId: 'child-1',
        purpose: 'code review',
      };
      const first = generateParallelWorkerName(base);
      const second = generateParallelWorkerName(base);

      expect(first).toBe(second);
      expect(first).toMatch(/ .+[0-9a-f]{5}$/);
      expect(first.startsWith('code review ')).toBe(true);
      // No animals/creatures: the label is derived from purpose/prompt text only.
      expect(first).not.toMatch(/wolf|fox|otter|tiger|panda|cat|dog|raven/i);
    });

    it('derives the label from the prompt when purpose is absent and falls back to a generic label', () => {
      const named = generateParallelWorkerName({
        id: 'job-2',
        prompt: 'Scan the error logs',
        childConversationId: 'child-2',
      });
      expect(named.startsWith('Scan the error logs ')).toBe(true);

      const blank = generateParallelWorkerName({
        id: 'job-3',
        prompt: '   ',
        childConversationId: 'child-3',
      });
      expect(blank.startsWith('Worker ')).toBe(true);
      expect(blank).toMatch(/Worker [0-9a-f]{5}$/);
    });

    it('produces distinct names for sibling workers differing only by id', () => {
      const a = generateParallelWorkerName({
        id: 'job-a',
        prompt: 'same prompt',
        childConversationId: 'child-x',
      });
      const b = generateParallelWorkerName({
        id: 'job-b',
        prompt: 'same prompt',
        childConversationId: 'child-x',
      });
      expect(a).not.toBe(b);
      // Both share the label prefix but differ in the hash suffix.
      expect(a.split(' ').slice(0, -1).join(' ')).toBe(b.split(' ').slice(0, -1).join(' '));
    });

    it('normalization always forces workerRole=worker and ignores caller-spoofed roles', () => {
      const dir = createTempDir('pa-parallel-jobs-');
      const sessionFile = join(dir, 'session.jsonl');
      writeFileSync(
        resolveParallelJobsFile(sessionFile),
        JSON.stringify([
          {
            id: 'job-1',
            prompt: 'Review the diff',
            childConversationId: 'child-1',
            status: 'running',
            // Untrusted caller metadata trying to spoof a persona role.
            workerRole: 'persona',
            workerName: 'Patrick',
            createdAt: '2026-03-12T20:00:00.000Z',
            updatedAt: '2026-03-12T20:01:00.000Z',
          },
        ]),
      );

      const [normalized] = readPersistedParallelJobs(sessionFile);
      expect(normalized?.workerRole).toBe('worker');
      // An explicit persisted workerName is preserved (not regenerated).
      expect(normalized?.workerName).toBe('Patrick');
    });

    it('regenerates a deterministic workerName for legacy persisted jobs missing one', () => {
      const dir = createTempDir('pa-parallel-jobs-');
      const sessionFile = join(dir, 'session.jsonl');
      const legacyJob = {
        id: 'job-legacy',
        prompt: 'Tidy the imports',
        childConversationId: 'child-legacy',
        status: 'ready',
        createdAt: '2026-03-12T20:00:00.000Z',
        updatedAt: '2026-03-12T20:01:00.000Z',
      };
      writeFileSync(resolveParallelJobsFile(sessionFile), JSON.stringify([legacyJob]));

      const expectedName = generateParallelWorkerName({
        id: legacyJob.id,
        prompt: legacyJob.prompt,
        childConversationId: legacyJob.childConversationId,
      });
      const [normalized] = readPersistedParallelJobs(sessionFile);
      expect(normalized?.workerRole).toBe('worker');
      expect(normalized?.workerName).toBe(expectedName);

      // Re-normalizing the same persisted job is stable across reloads.
      writeFileSync(resolveParallelJobsFile(sessionFile), JSON.stringify([normalized]));
      const [renormalized] = readPersistedParallelJobs(sessionFile);
      expect(renormalized?.workerName).toBe(expectedName);
    });

    it('readParallelState previews always carry workerRole=worker and a workerName', () => {
      const job: ParallelPromptJob = {
        id: 'job-preview',
        prompt: 'Summarize the report',
        childConversationId: 'child-preview',
        status: 'importing',
        createdAt: '2026-03-12T20:00:00.000Z',
        updatedAt: '2026-03-12T20:01:00.000Z',
        imageCount: 0,
        attachmentRefs: [],
        touchedFiles: [],
        parentTouchedFiles: [],
        overlapFiles: [],
        sideEffects: [],
        worktreeDirtyPathsAtStart: [],
      };
      const [preview] = readParallelState([job]);
      expect(preview).toEqual(
        expect.objectContaining({
          id: 'job-preview',
          workerRole: 'worker',
          workerName: generateParallelWorkerName({
            id: 'job-preview',
            prompt: 'Summarize the report',
            childConversationId: 'child-preview',
          }),
        }),
      );

      // A persisted workerName flows through to the preview unchanged.
      const [namedPreview] = readParallelState([{ ...job, id: 'job-named', workerName: 'Custom Worker 12345' }]);
      expect(namedPreview?.workerName).toBe('Custom Worker 12345');
      expect(namedPreview?.workerRole).toBe('worker');
    });
  });
});
