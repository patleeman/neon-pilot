import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ files: new Map<string, string>(), readFileSync: vi.fn((path: string) => fs.files.get(path) ?? '') }));
vi.mock('node:fs', () => fs);

import {
  buildParallelImportedContent,
  extractTextFromMessageContent,
  getStableForkBranchEntries,
  resolveLastCompletedConversationEntryId,
  resolveParallelWorkerForkEntryId,
  resolveStableForkEntryId,
} from './liveSessionForking.js';

describe('live session forking helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.files.clear();
  });

  it('resolves the last completed user or assistant message entry from session jsonl', () => {
    fs.files.set(
      '/sessions/s1.jsonl',
      [
        '{bad json}',
        JSON.stringify({ type: 'message', id: 'system', message: { role: 'system' } }),
        JSON.stringify({ type: 'message', id: 'user-1', message: { role: 'user' } }),
        JSON.stringify({ type: 'custom_message', id: 'custom-1' }),
        JSON.stringify({ type: 'message', id: 'assistant-1', message: { role: 'assistant' } }),
        '',
      ].join('\n'),
    );

    expect(resolveLastCompletedConversationEntryId('/sessions/s1.jsonl')).toBe('assistant-1');
  });

  it('returns null when no completed message id is available', () => {
    fs.files.set('/sessions/s1.jsonl', `${JSON.stringify({ type: 'custom_message', id: 'custom-1' })}\n`);
    expect(resolveLastCompletedConversationEntryId('/sessions/s1.jsonl')).toBeNull();
  });

  it('reads stable branch entries with trimmed ids and parent ids while ignoring bad rows', () => {
    fs.files.set(
      '/sessions/s1.jsonl',
      [
        ' ',
        '{bad json}',
        JSON.stringify({ id: ' entry-1 ', parentId: ' parent-1 ', type: 'message' }),
        JSON.stringify({ id: '', type: 'message' }),
      ].join('\n'),
    );

    expect(getStableForkBranchEntries('/sessions/s1.jsonl')).toEqual([{ id: 'entry-1', parentId: 'parent-1', type: 'message' }]);
  });

  it('resolves stable fork entry id for inactive and active-turn branches', () => {
    fs.files.set(
      '/sessions/s1.jsonl',
      [
        JSON.stringify({ id: 'assistant-0', type: 'message', message: { role: 'assistant', stopReason: 'stop' } }),
        JSON.stringify({ id: 'user-1', parentId: 'assistant-0', type: 'message', message: { role: 'user' } }),
        JSON.stringify({
          id: 'assistant-tool',
          parentId: 'user-1',
          type: 'message',
          message: { role: 'assistant', stopReason: 'toolUse' },
        }),
      ].join('\n'),
    );

    expect(resolveStableForkEntryId('/sessions/s1.jsonl')).toBe('assistant-tool');
    expect(resolveStableForkEntryId('/sessions/s1.jsonl', { activeTurnInProgress: true })).toBe('assistant-0');

    fs.files.set(
      '/sessions/s2.jsonl',
      [
        JSON.stringify({ id: 'user-1', type: 'message', message: { role: 'user' } }),
        JSON.stringify({ id: 'summary-1', parentId: 'user-1', type: 'branch_summary' }),
      ].join('\n'),
    );
    expect(resolveStableForkEntryId('/sessions/s2.jsonl', { activeTurnInProgress: true })).toBe('summary-1');
  });

  it('moves parallel worker fork points behind hidden injected context entries', () => {
    fs.files.set(
      '/sessions/s1.jsonl',
      [
        JSON.stringify({ id: 'assistant-1', type: 'message', message: { role: 'assistant', stopReason: 'stop' } }),
        JSON.stringify({
          id: 'ctx-1',
          parentId: 'assistant-1',
          type: 'custom_message',
          customType: 'referenced_context',
          display: false,
        }),
        JSON.stringify({
          id: 'ctx-2',
          parentId: 'ctx-1',
          type: 'custom_message',
          customType: 'goal-continuation',
          display: false,
        }),
        JSON.stringify({
          id: 'visible-context',
          parentId: 'ctx-2',
          type: 'custom_message',
          customType: 'referenced_context',
          display: true,
        }),
      ].join('\n'),
    );

    expect(resolveParallelWorkerForkEntryId('/sessions/s1.jsonl', 'ctx-2')).toBe('assistant-1');
    expect(resolveParallelWorkerForkEntryId('/sessions/s1.jsonl', 'visible-context')).toBe('visible-context');
    expect(resolveParallelWorkerForkEntryId('/sessions/s1.jsonl', 'missing')).toBeNull();
  });

  it('extracts text from string and structured message content', () => {
    expect(extractTextFromMessageContent(' hello ')).toBe('hello');
    expect(
      extractTextFromMessageContent([
        { type: 'text', text: 'first' },
        { type: 'image', data: 'x' },
        { type: 'text', text: 'second' },
      ]),
    ).toBe('first\nsecond');
    expect(extractTextFromMessageContent({ type: 'text', text: 'ignored' })).toBe('');
  });

  it('builds rich parallel imported content for success and failure cases', () => {
    const content = buildParallelImportedContent({
      prompt: ' Do thing ',
      childConversationId: 'child/1',
      resultText: ' Done ',
      imageCount: 2,
      attachmentRefs: ['att-1'],
      touchedFiles: ['src/a.ts'],
      parentTouchedFiles: ['src/b.ts'],
      overlapFiles: ['src/c.ts'],
      sideEffects: ['Ran tests'],
    });

    expect(content).toContain('[Open side thread](/conversations/child%2F1)');
    expect(content).toContain('- Images: 2');
    expect(content).toContain('- `src/a.ts`');
    expect(content).toContain('**Potential overlap**');
    expect(content).toContain('> Do thing');
    expect(content).toContain('**Reply**\n\nDone');

    const failed = buildParallelImportedContent({ prompt: '', childConversationId: 'child-2', error: ' boom ', imageCount: 1 });
    expect(failed).toContain('> (image-only prompt)');
    expect(failed).toContain('**Status**\n\nFailed');
    expect(failed).toContain('**Error**\n\nboom');
  });
});
