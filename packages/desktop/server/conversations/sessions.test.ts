import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendChildConversationTopologyEntry,
  appendConversationCompactionSummary,
  appendConversationOffshootDetachedMetadata,
  appendConversationOffshootMetadata,
  appendConversationWorkspaceMetadata,
  appendParentConversationBacklinkEntry,
  buildAppendOnlySessionDetailResponse,
  buildDisplayBlocksFromEntries,
  clearSessionCaches,
  flushSessionIndexWrite,
  listSessions,
  readSessionBlock,
  readSessionBlocks,
  readSessionBlocksWithTelemetry,
  readSessionEntryBlocks,
  readSessionImageAsset,
  readSessionMetaByFile,
  readSessionSearchText,
  renameStoredSession,
} from './sessions.js';

const originalEnv = process.env;
const tempDirs: string[] = [];

function createTempSessionsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-web-sessions-'));
  tempDirs.push(dir);
  return dir;
}

function sessionIndexPathFor(sessionsDir: string): string {
  return join(dirname(sessionsDir), `${basename(sessionsDir)}-session-meta-index.json`);
}

function configureSessionEnv(sessionsDir: string): string {
  const indexFile = sessionIndexPathFor(sessionsDir);
  process.env.PA_SESSIONS_DIR = sessionsDir;
  process.env.PA_SESSIONS_INDEX_FILE = indexFile;
  return indexFile;
}

function writeSessionFile(options: {
  sessionsDir: string;
  cwdSlug?: string | null;
  fileName?: string;
  sessionId: string;
  timestamp?: string;
  cwd?: string;
  modelId?: string;
  title?: string;
  assistantTexts?: string[];
  sessionName?: string;
  parentSession?: string;
}): string {
  const cwdSlug = options.cwdSlug ?? '--tmp-project--';
  const fileName = options.fileName ?? `2026-03-11T12-00-00-000Z_${options.sessionId}.jsonl`;
  const dir = cwdSlug ? join(options.sessionsDir, cwdSlug) : options.sessionsDir;
  mkdirSync(dir, { recursive: true });

  const timestamp = options.timestamp ?? '2026-03-11T12:00:00.000Z';
  const cwd = options.cwd ?? '/tmp/project';
  const title = options.title ?? 'Initial title';
  const assistantTexts = options.assistantTexts ?? ['Assistant reply'];
  const lastAssistantId =
    assistantTexts.length > 0 ? `${options.sessionId}-assistant-${assistantTexts.length}` : `${options.sessionId}-user-1`;

  const lines = [
    JSON.stringify({
      type: 'session',
      id: options.sessionId,
      timestamp,
      cwd,
      ...(options.parentSession ? { parentSession: options.parentSession } : {}),
    }),
    JSON.stringify({ type: 'model_change', modelId: options.modelId ?? 'test-model' }),
    JSON.stringify({
      type: 'message',
      id: `${options.sessionId}-user-1`,
      parentId: null,
      timestamp,
      message: { role: 'user', content: title },
    }),
    ...assistantTexts.map((text, index) =>
      JSON.stringify({
        type: 'message',
        id: `${options.sessionId}-assistant-${index + 1}`,
        parentId: index === 0 ? `${options.sessionId}-user-1` : `${options.sessionId}-assistant-${index}`,
        timestamp: `2026-03-11T12:00:0${index + 1}.000Z`,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text }],
        },
      }),
    ),
    ...(options.sessionName
      ? [
          JSON.stringify({
            type: 'session_info',
            id: `${options.sessionId}-session-info`,
            parentId: lastAssistantId,
            timestamp: '2026-03-11T12:00:59.000Z',
            name: options.sessionName,
          }),
        ]
      : []),
  ];

  const filePath = join(dir, fileName);
  writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

beforeEach(() => {
  process.env = { ...originalEnv };
  clearSessionCaches();
});

afterEach(() => {
  clearSessionCaches();
  process.env = originalEnv;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('sessions', () => {
  it('reads a session directly even before the session list was built', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-0',
      title: 'Direct open',
      assistantTexts: ['Loaded without listing first'],
    });

    const detail = readSessionBlocks('session-0');
    expect(detail).not.toBeNull();
    expect(detail?.meta).toEqual(
      expect.objectContaining({
        id: 'session-0',
        title: 'Direct open',
      }),
    );
    expect(detail?.blocks.filter((block) => block.type === 'text').map((block) => block.text)).toEqual(['Loaded without listing first']);
  });

  it('can load only the newest tail of conversation blocks for large archived transcripts', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-tail',
      title: 'Tail block test',
      assistantTexts: ['Reply 1', 'Reply 2', 'Reply 3', 'Reply 4'],
    });

    const detail = readSessionBlocks('session-tail', { tailBlocks: 2 });
    expect(detail).not.toBeNull();
    expect(detail?.totalBlocks).toBe(5);
    expect(detail?.blockOffset).toBe(3);
    expect(detail?.blocks.map((block) => (block.type === 'text' ? block.text : block.type))).toEqual(['Reply 3', 'Reply 4']);
  });

  it('indexes the most recent conversation text first for related-thread search', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-search',
      title: 'Older setup notes',
      assistantTexts: ['volcanic legacy details', 'recent needle update'],
    });

    expect(readSessionSearchText('session-search', 20)).toBe('recent needle update');
  });

  it('builds append-only transcript responses when a cached tail window only needs new blocks', () => {
    const detail = {
      meta: {
        id: 'session-append-only',
        file: '/tmp/session-append-only.jsonl',
        timestamp: '2026-03-11T12:00:00.000Z',
        cwd: '/tmp/project',
        cwdSlug: '--tmp-project--',
        model: 'test-model',
        title: 'Append only',
        messageCount: 6,
      },
      blocks: [
        { type: 'text' as const, id: 'assistant-2', ts: '2026-03-11T12:00:02.000Z', text: 'Reply 2' },
        { type: 'text' as const, id: 'assistant-3', ts: '2026-03-11T12:00:03.000Z', text: 'Reply 3' },
        { type: 'text' as const, id: 'assistant-4', ts: '2026-03-11T12:00:04.000Z', text: 'Reply 4' },
      ],
      blockOffset: 3,
      totalBlocks: 6,
      contextUsage: null,
      signature: 'sig-2',
    };

    expect(
      buildAppendOnlySessionDetailResponse({
        detail,
        knownBlockOffset: 2,
        knownTotalBlocks: 5,
        knownLastBlockId: 'assistant-3',
      }),
    ).toEqual({
      appendOnly: true,
      meta: detail.meta,
      blocks: [{ type: 'text', id: 'assistant-4', ts: '2026-03-11T12:00:04.000Z', text: 'Reply 4' }],
      blockOffset: 3,
      totalBlocks: 6,
      contextUsage: null,
      signature: 'sig-2',
    });
  });

  it('refuses append-only transcript reuse when the cached tail no longer matches the current branch', () => {
    const detail = {
      meta: {
        id: 'session-append-mismatch',
        file: '/tmp/session-append-mismatch.jsonl',
        timestamp: '2026-03-11T12:00:00.000Z',
        cwd: '/tmp/project',
        cwdSlug: '--tmp-project--',
        model: 'test-model',
        title: 'Append mismatch',
        messageCount: 6,
      },
      blocks: [
        { type: 'text' as const, id: 'assistant-2', ts: '2026-03-11T12:00:02.000Z', text: 'Reply 2' },
        { type: 'text' as const, id: 'assistant-3b', ts: '2026-03-11T12:00:03.000Z', text: 'Forked reply' },
        { type: 'text' as const, id: 'assistant-4', ts: '2026-03-11T12:00:04.000Z', text: 'Reply 4' },
      ],
      blockOffset: 3,
      totalBlocks: 6,
      contextUsage: null,
      signature: 'sig-2',
    };

    expect(
      buildAppendOnlySessionDetailResponse({
        detail,
        knownBlockOffset: 2,
        knownTotalBlocks: 5,
        knownLastBlockId: 'assistant-3',
      }),
    ).toBeNull();
  });

  it('rejects unsafe append-only transcript cache offsets', () => {
    const detail = {
      meta: {
        id: 'session-append-unsafe',
        file: '/tmp/session-append-unsafe.jsonl',
        timestamp: '2026-03-11T12:00:00.000Z',
        cwd: '/tmp/project',
        cwdSlug: '--tmp-project--',
        model: 'test-model',
        title: 'Append unsafe',
        messageCount: 1,
      },
      blocks: [{ type: 'text' as const, id: 'assistant-1', ts: '2026-03-11T12:00:01.000Z', text: 'Reply 1' }],
      blockOffset: 0,
      totalBlocks: 1,
      contextUsage: null,
      signature: 'sig-unsafe',
    };

    expect(
      buildAppendOnlySessionDetailResponse({
        detail,
        knownBlockOffset: Number.MAX_SAFE_INTEGER + 1,
        knownTotalBlocks: 0,
        knownLastBlockId: 'assistant-1',
      }),
    ).toBeNull();

    expect(
      buildAppendOnlySessionDetailResponse({
        detail: {
          ...detail,
          blockOffset: Number.MAX_SAFE_INTEGER + 1,
          totalBlocks: Number.MAX_SAFE_INTEGER + 3,
        },
        knownBlockOffset: 0,
        knownTotalBlocks: Number.MAX_SAFE_INTEGER + 1,
        knownLastBlockId: 'assistant-1',
      }),
    ).toBeNull();
  });

  it('reports cache and loader telemetry for archived transcript tail reads', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-telemetry',
      title: 'Telemetry test',
      assistantTexts: ['Reply 1', 'Reply 2', 'Reply 3'],
    });

    const firstRead = readSessionBlocksWithTelemetry('session-telemetry', { tailBlocks: 2 });
    expect(firstRead.detail?.blocks.map((block) => (block.type === 'text' ? block.text : block.type))).toEqual(['Reply 2', 'Reply 3']);
    expect(firstRead.telemetry).toMatchObject({
      cache: 'miss',
      loader: 'fast-tail',
      requestedTailBlocks: 2,
      totalBlocks: 4,
      blockOffset: 2,
      contextUsageIncluded: false,
    });
    expect(firstRead.telemetry?.durationMs).toBeGreaterThanOrEqual(0);

    const secondRead = readSessionBlocksWithTelemetry('session-telemetry', { tailBlocks: 2 });
    expect(secondRead.telemetry).toMatchObject({
      cache: 'hit',
      loader: 'fast-tail',
      requestedTailBlocks: 2,
      totalBlocks: 4,
      blockOffset: 2,
      contextUsageIncluded: false,
    });
    expect(secondRead.telemetry?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores unsafe archived transcript tail read limits', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-unsafe-tail',
      title: 'Unsafe tail test',
      assistantTexts: ['Reply 1', 'Reply 2'],
    });

    const read = readSessionBlocksWithTelemetry('session-unsafe-tail', { tailBlocks: Number.MAX_SAFE_INTEGER + 1 });
    expect(read.detail?.blocks.map((block) => (block.type === 'text' ? block.text : block.type))).toEqual(['user', 'Reply 1', 'Reply 2']);
    expect(read.telemetry).toMatchObject({
      cache: 'miss',
      loader: 'full',
      totalBlocks: 3,
      blockOffset: 0,
      contextUsageIncluded: true,
    });
    expect(read.telemetry).not.toHaveProperty('requestedTailBlocks');
  });

  it('caps expensive archived transcript tail read limits', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-expensive-tail',
      title: 'Expensive tail test',
      assistantTexts: Array.from({ length: 1200 }, (_, index) => `Reply ${index + 1}`),
    });

    const read = readSessionBlocksWithTelemetry('session-expensive-tail', { tailBlocks: 5000 });
    expect(read.detail?.blocks).toHaveLength(1201);
    expect(read.detail?.blockOffset).toBe(0);
    expect(read.telemetry).toMatchObject({
      requestedTailBlocks: 5000,
      totalBlocks: 1201,
      blockOffset: 0,
    });
  });

  it('keeps older transcript blocks loadable when rendered blocks outnumber message metadata', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const sessionId = 'session-tail-tools';
    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `2026-03-11T12-00-00-000Z_${sessionId}.jsonl`);
    const lines = [
      JSON.stringify({
        type: 'session',
        id: sessionId,
        timestamp: '2026-03-11T12:00:00.000Z',
        cwd: '/tmp/project',
      }),
      JSON.stringify({
        type: 'message',
        id: `${sessionId}-user-1`,
        parentId: null,
        timestamp: '2026-03-11T12:00:00.000Z',
        message: { role: 'user', content: 'Run a few commands' },
      }),
    ];
    let parentId = `${sessionId}-user-1`;
    for (let index = 0; index < 8; index += 1) {
      const id = `${sessionId}-bash-${index}`;
      lines.push(
        JSON.stringify({
          type: 'message',
          id,
          parentId,
          timestamp: `2026-03-11T12:00:${String(index + 1).padStart(2, '0')}.000Z`,
          message: { role: 'bashExecution', command: `echo ${index}`, output: `result ${index}` },
        }),
      );
      parentId = id;
    }
    lines.push(
      JSON.stringify({
        type: 'message',
        id: `${sessionId}-assistant-1`,
        parentId,
        timestamp: '2026-03-11T12:00:10.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Done' }] },
      }),
    );
    writeFileSync(filePath, lines.join('\n') + '\n');

    const initialDetail = readSessionBlocks(sessionId, { tailBlocks: 4 });
    expect(initialDetail?.blockOffset).toBeGreaterThan(0);

    const expandedDetail = readSessionBlocks(sessionId, { tailBlocks: 8 });
    expect(expandedDetail?.totalBlocks).toBe(10);
    expect(expandedDetail?.blockOffset).toBe(2);
    expect(expandedDetail?.blocks).toHaveLength(8);
    expect(expandedDetail?.blocks[0]).toEqual(expect.objectContaining({ type: 'tool_use', output: 'result 1' }));
  });

  it('invalidates cached archived transcript detail when the session file changes', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-cache',
      title: 'Cache invalidation test',
      assistantTexts: ['Reply 1'],
    });

    const initialDetail = readSessionBlocks('session-cache', { tailBlocks: 2 });
    expect(initialDetail?.blocks.map((block) => (block.type === 'text' ? block.text : block.type))).toEqual(['user', 'Reply 1']);
    expect(initialDetail?.signature).toMatch(/^\d+:\d+(?:\.\d+)?$/);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-cache',
      title: 'Cache invalidation test',
      assistantTexts: ['Reply 1', 'Reply 2'],
    });

    const detail = readSessionBlocks('session-cache', { tailBlocks: 2 });
    expect(detail?.signature).toMatch(/^\d+:\d+(?:\.\d+)?$/);
    expect(detail?.signature).not.toBe(initialDetail?.signature);
    expect(detail?.totalBlocks).toBe(3);
    expect(detail?.blockOffset).toBe(1);
    expect(detail?.blocks.map((block) => (block.type === 'text' ? block.text : block.type))).toEqual(['Reply 1', 'Reply 2']);
  });

  it('keeps exact tail counts when archived sessions include compaction summaries', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T12-00-00-000Z_session-tail-compaction.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-tail-compaction',
          timestamp: '2026-03-11T12:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'session-tail-compaction-model',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          modelId: 'test-model',
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: 'Before compaction' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-assistant-1',
          parentId: 'c-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Older reply' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-user-2',
          parentId: 'c-assistant-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'user', content: 'Keep this prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-assistant-2',
          parentId: 'c-user-2',
          timestamp: '2026-03-11T12:00:03.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Keep this reply' }] },
        }),
        JSON.stringify({
          type: 'compaction',
          id: 'c-compaction-1',
          parentId: 'c-assistant-2',
          timestamp: '2026-03-11T12:00:04.000Z',
          summary: 'Compacted.',
          firstKeptEntryId: 'c-user-2',
          tokensBefore: 1234,
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-user-3',
          parentId: 'c-compaction-1',
          timestamp: '2026-03-11T12:00:05.000Z',
          message: { role: 'user', content: 'Continue after compaction' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'c-assistant-3',
          parentId: 'c-user-3',
          timestamp: '2026-03-11T12:00:06.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Newest reply' }] },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-tail-compaction', { tailBlocks: 2 });
    expect(detail?.totalBlocks).toBe(7);
    expect(detail?.blockOffset).toBe(5);
    expect(detail?.blocks).toEqual([
      expect.objectContaining({ type: 'user', text: 'Continue after compaction' }),
      expect.objectContaining({ type: 'text', text: 'Newest reply' }),
    ]);
  });

  it('keeps legacy hidden archived automation turns visible in the tail', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T12-00-00-000Z_session-tail-hidden.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-tail-hidden',
          timestamp: '2026-03-11T12:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'session-tail-hidden-model',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          modelId: 'test-model',
        }),
        JSON.stringify({
          type: 'message',
          id: 'h-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: 'Visible prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'h-assistant-1',
          parentId: 'h-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Visible answer' }] },
        }),
        JSON.stringify({
          type: 'custom_message',
          id: 'h-hidden-1',
          parentId: 'h-assistant-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          customType: 'conversation_automation_review',
          content: [{ type: 'text', text: 'Legacy bookkeeping prompt.' }],
          display: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'h-assistant-2',
          parentId: 'h-hidden-1',
          timestamp: '2026-03-11T12:00:03.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Legacy assistant reply' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'h-tool-1',
          parentId: 'h-assistant-2',
          timestamp: '2026-03-11T12:00:04.000Z',
          message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'bash', content: [{ type: 'text', text: 'ls' }] },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-tail-hidden', { tailBlocks: 5 });
    expect(detail?.totalBlocks).toBe(5);
    expect(detail?.blockOffset).toBe(0);
    expect(detail?.blocks).toEqual([
      expect.objectContaining({ type: 'user', text: 'Visible prompt' }),
      expect.objectContaining({ type: 'text', text: 'Visible answer' }),
      expect.objectContaining({ type: 'context', customType: 'conversation_automation_review', text: 'Legacy bookkeeping prompt.' }),
      expect.objectContaining({ type: 'text', text: 'Legacy assistant reply' }),
      expect.objectContaining({ type: 'tool_use', tool: 'bash', output: 'ls' }),
    ]);
  });

  it('keeps later user turns visible in archived tails after legacy hidden automation turns', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T12-00-00-000Z_session-tail-user-after-hidden.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-tail-user-after-hidden',
          timestamp: '2026-03-11T12:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'uah-model',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          modelId: 'test-model',
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-user-1',
          parentId: 'uah-model',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: { role: 'user', content: 'First prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-assistant-1',
          parentId: 'uah-user-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'First answer' }] },
        }),
        JSON.stringify({
          type: 'custom_message',
          id: 'uah-hidden-1',
          parentId: 'uah-assistant-1',
          timestamp: '2026-03-11T12:00:03.000Z',
          customType: 'conversation_automation_review',
          content: [{ type: 'text', text: 'Legacy bookkeeping prompt.' }],
          display: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-assistant-2',
          parentId: 'uah-hidden-1',
          timestamp: '2026-03-11T12:00:04.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Legacy automation reply' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-tool-1',
          parentId: 'uah-assistant-2',
          timestamp: '2026-03-11T12:00:05.000Z',
          message: {
            role: 'toolResult',
            toolCallId: 'call-1',
            toolName: 'wait_for_user',
            content: [{ type: 'text', text: 'Waiting for user.' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-assistant-3',
          parentId: 'uah-tool-1',
          timestamp: '2026-03-11T12:00:06.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Still hidden automation summary.' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-user-2',
          parentId: 'uah-assistant-3',
          timestamp: '2026-03-11T12:00:07.000Z',
          message: { role: 'user', content: 'Second prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'uah-assistant-4',
          parentId: 'uah-user-2',
          timestamp: '2026-03-11T12:00:08.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Second answer' }] },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-tail-user-after-hidden', { tailBlocks: 400 });
    expect(detail?.totalBlocks).toBe(8);
    expect(detail?.blockOffset).toBe(0);
    expect(detail?.blocks).toEqual([
      expect.objectContaining({ type: 'user', text: 'First prompt' }),
      expect.objectContaining({ type: 'text', text: 'First answer' }),
      expect.objectContaining({ type: 'context', customType: 'conversation_automation_review', text: 'Legacy bookkeeping prompt.' }),
      expect.objectContaining({ type: 'text', text: 'Legacy automation reply' }),
      expect.objectContaining({ type: 'tool_use', tool: 'wait_for_user', output: 'Waiting for user.' }),
      expect.objectContaining({ type: 'text', text: 'Still hidden automation summary.' }),
      expect.objectContaining({ type: 'user', text: 'Second prompt' }),
      expect.objectContaining({ type: 'text', text: 'Second answer' }),
    ]);
  });

  it('keeps walking backward through non-display parent links when reading archived tails', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T12-00-00-000Z_session-tail-lineage.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-tail-lineage',
          timestamp: '2026-03-11T12:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'lineage-model',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          modelId: 'test-model',
        }),
        JSON.stringify({
          type: 'message',
          id: 'lineage-user-1',
          parentId: 'lineage-model',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: { role: 'user', content: 'First prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'lineage-assistant-1',
          parentId: 'lineage-user-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'First answer' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'lineage-user-2',
          parentId: 'lineage-assistant-1',
          timestamp: '2026-03-11T12:00:03.000Z',
          message: { role: 'user', content: 'Second prompt' },
        }),
        JSON.stringify({
          type: 'session_info',
          id: 'lineage-session-info',
          parentId: 'lineage-user-2',
          timestamp: '2026-03-11T12:00:04.000Z',
          name: 'Renamed session',
        }),
        JSON.stringify({
          type: 'message',
          id: 'lineage-assistant-2',
          parentId: 'lineage-session-info',
          timestamp: '2026-03-11T12:00:05.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Second answer' }] },
        }),
        JSON.stringify({
          type: 'custom_message',
          id: 'lineage-hidden-1',
          parentId: 'lineage-assistant-2',
          timestamp: '2026-03-11T12:00:06.000Z',
          customType: 'conversation_automation_review',
          content: [{ type: 'text', text: 'Legacy bookkeeping prompt.' }],
          display: false,
        }),
        JSON.stringify({
          type: 'message',
          id: 'lineage-hidden-assistant-1',
          parentId: 'lineage-hidden-1',
          timestamp: '2026-03-11T12:00:07.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Legacy assistant reply' }] },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-tail-lineage', { tailBlocks: 400 });
    expect(detail?.totalBlocks).toBe(6);
    expect(detail?.blockOffset).toBe(0);
    expect(detail?.blocks).toEqual([
      expect.objectContaining({ type: 'user', text: 'First prompt' }),
      expect.objectContaining({ type: 'text', text: 'First answer' }),
      expect.objectContaining({ type: 'user', text: 'Second prompt' }),
      expect.objectContaining({ type: 'text', text: 'Second answer' }),
      expect.objectContaining({ type: 'context', customType: 'conversation_automation_review', text: 'Legacy bookkeeping prompt.' }),
      expect.objectContaining({ type: 'text', text: 'Legacy assistant reply' }),
    ]);
  });

  it('serves persisted session images through routes instead of inline data urls', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-images.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-images', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-images-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'Here is an image' },
              { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'hello.png' },
            ],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-images-tool-1',
          parentId: 'session-images-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: {
            role: 'toolResult',
            toolCallId: 'tool-1',
            toolName: 'render',
            content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'result.png' }],
          },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-images');
    const userBlock = detail?.blocks.find((block) => block.type === 'user');
    const imageBlock = detail?.blocks.find((block) => block.type === 'image');
    expect(userBlock).toEqual(
      expect.objectContaining({
        type: 'user',
        images: [expect.objectContaining({ src: `/api/sessions/session-images/blocks/${userBlock?.id}/images/0` })],
      }),
    );
    expect(imageBlock).toEqual(
      expect.objectContaining({
        type: 'image',
        src: `/api/sessions/session-images/blocks/${imageBlock?.id}/image`,
      }),
    );

    expect(imageBlock ? readSessionBlock('session-images', imageBlock.id) : null).toEqual(
      expect.objectContaining({
        type: 'image',
        src: `/api/sessions/session-images/blocks/${imageBlock?.id}/image`,
      }),
    );

    expect(userBlock ? readSessionImageAsset('session-images', userBlock.id, 0) : null).toEqual(
      expect.objectContaining({
        mimeType: 'image/png',
        fileName: 'hello.png',
        data: Buffer.from('aGVsbG8=', 'base64'),
      }),
    );
    expect(imageBlock ? readSessionImageAsset('session-images', imageBlock.id) : null).toEqual(
      expect.objectContaining({
        mimeType: 'image/png',
        fileName: 'result.png',
        data: Buffer.from('aGVsbG8=', 'base64'),
      }),
    );
  });

  it('keeps user image asset indexes aligned when malformed image blocks are skipped', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-mixed-images.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-mixed-images', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-mixed-images-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'Here is a valid image after a bad one' },
              { type: 'image', data: 'not-valid-base64!', mimeType: 'image/png', name: 'bad.png' },
              { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'hello.png' },
            ],
          },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-mixed-images');
    const userBlock = detail?.blocks.find((block) => block.type === 'user');
    expect(userBlock).toEqual(
      expect.objectContaining({
        type: 'user',
        images: [expect.objectContaining({ src: `/api/sessions/session-mixed-images/blocks/${userBlock?.id}/images/0` })],
      }),
    );
    expect(userBlock ? readSessionImageAsset('session-mixed-images', userBlock.id, 0) : null).toEqual(
      expect.objectContaining({
        mimeType: 'image/png',
        fileName: 'hello.png',
        data: Buffer.from('aGVsbG8=', 'base64'),
      }),
    );
  });

  it('skips archived user image blocks with non-image mime types', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-non-image-mime.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-non-image-mime', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-non-image-mime-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'Here is a valid image after a bad mime' },
              { type: 'image', data: 'aGVsbG8=', mimeType: 'text/plain', name: 'bad.txt' },
              { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'hello.png' },
            ],
          },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-non-image-mime');
    const userBlock = detail?.blocks.find((block) => block.type === 'user');
    expect(userBlock).toEqual(
      expect.objectContaining({
        type: 'user',
        images: [expect.objectContaining({ mimeType: 'image/png' })],
      }),
    );
    expect(userBlock ? readSessionImageAsset('session-non-image-mime', userBlock.id, 0) : null).toEqual(
      expect.objectContaining({
        mimeType: 'image/png',
        fileName: 'hello.png',
        data: Buffer.from('aGVsbG8=', 'base64'),
      }),
    );
  });

  it('keeps tool image block ids aligned when malformed image blocks are skipped', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-mixed-tool-images.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-mixed-tool-images', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-mixed-tool-images-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'capture a screenshot' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-mixed-tool-images-tool-1',
          parentId: 'session-mixed-tool-images-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: {
            role: 'toolResult',
            toolCallId: 'tool-1',
            toolName: 'screenshot',
            content: [
              { type: 'image', data: '   ', mimeType: 'image/png', name: 'bad.png' },
              { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'hello.png' },
            ],
          },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-mixed-tool-images');
    const imageBlock = detail?.blocks.find((block) => block.type === 'image');
    expect(imageBlock).toEqual(
      expect.objectContaining({
        type: 'image',
        id: expect.stringMatching(/-i0$/),
      }),
    );
    expect(imageBlock && 'src' in imageBlock ? imageBlock.src : undefined).toBe(
      `/api/sessions/session-mixed-tool-images/blocks/${imageBlock?.id}/image`,
    );
    expect(imageBlock ? readSessionImageAsset('session-mixed-tool-images', imageBlock.id) : null).toEqual(
      expect.objectContaining({
        mimeType: 'image/png',
        fileName: 'hello.png',
        data: Buffer.from('aGVsbG8=', 'base64'),
      }),
    );
  });

  it('defers heavy tool output and image payloads in partial archived transcript loads', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const sessionId = 'session-heavy';
    const cwdSlug = '--tmp-project--';
    const dir = join(sessionsDir, cwdSlug);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `2026-03-11T12-00-00-000Z_${sessionId}.jsonl`);

    const lines: string[] = [
      JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project', version: 3 }),
      JSON.stringify({ type: 'model_change', id: 'm1', parentId: null, timestamp: '2026-03-11T12:00:00.100Z', modelId: 'test-model' }),
      JSON.stringify({
        type: 'message',
        id: 'u1',
        parentId: 'm1',
        timestamp: '2026-03-11T12:00:01.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'warmup' }] },
      }),
      JSON.stringify({
        type: 'message',
        id: 'a1',
        parentId: 'u1',
        timestamp: '2026-03-11T12:00:02.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'ack' }] },
      }),
      JSON.stringify({
        type: 'message',
        id: 'u2',
        parentId: 'a1',
        timestamp: '2026-03-11T12:00:03.000Z',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'inspect this screenshot' },
            { type: 'image', data: 'QUJDRA==', mimeType: 'image/png', name: 'diagram.png' },
          ],
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 'a2',
        parentId: 'u2',
        timestamp: '2026-03-11T12:00:04.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', id: 'tool-1', name: 'bash', arguments: { command: 'printf heavy' } }],
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 't1',
        parentId: 'a2',
        timestamp: '2026-03-11T12:00:05.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-1',
          toolName: 'bash',
          content: [
            { type: 'text', text: 'x'.repeat(1200) },
            { type: 'image', data: 'RUZHSA==', mimeType: 'image/png' },
          ],
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 'a3',
        parentId: 't1',
        timestamp: '2026-03-11T12:00:06.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'continuing' }] },
      }),
    ];

    let parentId = 'a3';
    for (let index = 0; index < 50; index += 1) {
      const userId = `u${index + 10}`;
      const assistantId = `a${index + 10}`;
      lines.push(
        JSON.stringify({
          type: 'message',
          id: userId,
          parentId,
          timestamp: `2026-03-11T12:01:${String(index).padStart(2, '0')}.000Z`,
          message: { role: 'user', content: [{ type: 'text', text: `follow-up ${index}` }] },
        }),
      );
      lines.push(
        JSON.stringify({
          type: 'message',
          id: assistantId,
          parentId: userId,
          timestamp: `2026-03-11T12:02:${String(index).padStart(2, '0')}.000Z`,
          message: { role: 'assistant', content: [{ type: 'text', text: `answer ${index}` }] },
        }),
      );
      parentId = assistantId;
    }

    writeFileSync(filePath, lines.join('\n') + '\n');

    const detail = readSessionBlocks(sessionId, { tailBlocks: 104 });
    expect(detail).not.toBeNull();
    expect(detail?.blockOffset).toBeGreaterThan(0);

    const toolBlock = detail?.blocks.find((block) => block.type === 'tool_use');
    expect(toolBlock).toEqual(expect.objectContaining({ type: 'tool_use', outputDeferred: true }));
    expect(toolBlock && 'output' in toolBlock ? toolBlock.output.endsWith('…') : false).toBe(true);

    const imageBlock = detail?.blocks.find((block) => block.type === 'image');
    expect(imageBlock).toEqual(expect.objectContaining({ type: 'image', deferred: true, src: undefined }));

    const hydratedToolBlock = toolBlock ? readSessionBlock(sessionId, toolBlock.id) : null;
    expect(hydratedToolBlock).toEqual(expect.objectContaining({ type: 'tool_use' }));
    expect(hydratedToolBlock && 'outputDeferred' in hydratedToolBlock ? hydratedToolBlock.outputDeferred : undefined).toBeUndefined();
    expect(hydratedToolBlock && 'output' in hydratedToolBlock ? hydratedToolBlock.output.length : 0).toBe(1200);
  });

  it('hydrates a block by rebased tail id when the original suffix differs', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);
    const sessionId = 'session-rebased-hydrate';
    const sessionDir = join(sessionsDir, '--tmp-project--');
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      join(sessionDir, `2026-03-11T12-00-00-000Z_${sessionId}.jsonl`),
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'read it' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          parentId: 'user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: 'src/app.ts' } }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          parentId: 'assistant-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'read', content: [{ type: 'text', text: 'file contents' }] },
        }),
      ].join('\n') + '\n',
    );

    const originalToolBlock = readSessionBlocks(sessionId)?.blocks.find((block) => block.type === 'tool_use');
    expect(originalToolBlock).toEqual(expect.objectContaining({ type: 'tool_use' }));

    const rebasedId = originalToolBlock?.id.replace(/-c\d+$/, '-c99') ?? '';
    expect(readSessionBlock(sessionId, rebasedId)).toEqual(expect.objectContaining({ type: 'tool_use', output: 'file contents' }));
  });

  it('hydrates transcript tool details by stable source entry ids', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);
    const sessionId = 'session-entry-hydrate';
    const sessionDir = join(sessionsDir, '--tmp-project--');
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      join(sessionDir, `2026-03-11T12-00-00-000Z_${sessionId}.jsonl`),
      [
        JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({
          type: 'message',
          id: 'user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'read it' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'assistant-1',
          parentId: 'user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: 'src/app.ts' } }],
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'tool-1',
          parentId: 'assistant-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'read', content: [{ type: 'text', text: 'file contents' }] },
        }),
      ].join('\n') + '\n',
    );

    const sourceEntryIds =
      readSessionBlocks(sessionId)?.blocks.flatMap((block) =>
        block.type === 'tool_use' ? ((block as typeof block & { sourceEntryIds?: string[] }).sourceEntryIds ?? []) : [],
      ) ?? [];
    expect(sourceEntryIds.length).toBeGreaterThan(0);
    expect(readSessionEntryBlocks(sessionId, sourceEntryIds)).toEqual([
      expect.objectContaining({ type: 'tool_use', tool: 'read', output: 'file contents' }),
    ]);
  });

  it('prefers a persisted session display name over the first user message fallback', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-named',
      title: 'Fallback first user prompt',
      assistantTexts: ['Generated answer'],
      sessionName: 'Generated conversation title',
    });

    expect(listSessions()[0]).toEqual(
      expect.objectContaining({
        id: 'session-named',
        title: 'Generated conversation title',
        messageCount: 2,
      }),
    );
    expect(readSessionBlocks('session-named')?.meta.title).toBe('Generated conversation title');
  });

  it('does not derive image-only titles from malformed image content', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-bad-image-title.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-bad-image-title', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-bad-image-title-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'image', data: '   ', mimeType: 'image/png' }] },
        }),
      ].join('\n') + '\n',
    );

    expect(listSessions()[0]?.title).toBe('New Conversation');
  });

  it('renders visible custom message entries as transcript text blocks', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-03-11T12-00-00-000Z_session-custom.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-custom', timestamp: '2026-03-11T12:00:00.000Z', cwd: '/tmp/project' }),
        JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
        JSON.stringify({
          type: 'message',
          id: 'session-custom-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Investigate this result' }] },
        }),
        JSON.stringify({
          type: 'custom_message',
          id: 'session-custom-note-1',
          parentId: 'session-custom-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          customType: 'note',
          content: [{ type: 'text', text: 'Imported summary note.' }],
          display: true,
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-custom');
    expect(detail?.meta.messageCount).toBe(2);
    expect(detail?.blocks.filter((block) => block.type === 'text').map((block) => block.text)).toContain('Imported summary note.');
  });

  it('canonicalizes shell tool aliases in display blocks', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'assistant-shell-call',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', id: 'call-1', name: '_shell', arguments: { command: 'pwd', background: true } }],
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        tool: 'bash',
        input: { command: 'pwd', background: true },
      }),
    ]);
  });

  it('renders legacy hidden custom context entries in the visible transcript', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'context-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'custom',
          customType: 'referenced_context',
          display: false,
          content: [{ type: 'text', text: 'Conversation automation context:\n- Review the agent reminders.' }],
        },
      },
    ]);

    expect(blocks).toEqual([
      {
        type: 'context',
        id: 'context-1-m0',
        ts: '2026-03-12T16:00:00.000Z',
        customType: 'referenced_context',
        text: 'Conversation automation context:\n- Review the agent reminders.',
      },
    ]);
  });

  it('renders visible goal continuations as context blocks instead of assistant messages', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'goal-continuation-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'custom',
          customType: 'goal-continuation',
          display: true,
          content: [{ type: 'text', text: 'Goal continuation.\n\nObjective: keep shipping' }],
        },
      },
    ]);

    expect(blocks).toEqual([
      {
        type: 'context',
        id: 'goal-continuation-1-m0',
        ts: '2026-03-12T16:00:00.000Z',
        customType: 'goal-continuation',
        text: 'Goal continuation.\n\nObjective: keep shipping',
      },
    ]);
  });

  it('falls back for malformed transcript entry timestamps', () => {
    expect(
      buildDisplayBlocksFromEntries([
        {
          id: 'bad-string-timestamp',
          timestamp: 'not-a-date',
          message: { role: 'user', content: 'bad string timestamp' },
        },
        {
          id: 'bad-number-timestamp',
          timestamp: Number.MAX_VALUE,
          message: { role: 'assistant', content: [{ type: 'text', text: 'bad number timestamp' }] },
        },
      ]),
    ).toEqual([
      { type: 'user', id: 'bad-string-timestamp', ts: '1970-01-01T00:00:00.000Z', text: 'bad string timestamp' },
      { type: 'text', id: 'bad-number-timestamp-x1', ts: '1970-01-01T00:00:00.000Z', text: 'bad number timestamp' },
    ]);
  });

  it('falls back for non-ISO transcript entry timestamps', () => {
    expect(
      buildDisplayBlocksFromEntries([
        {
          id: 'bad-string-timestamp',
          timestamp: '1',
          message: { role: 'user', content: 'bad string timestamp' },
        },
      ]),
    ).toEqual([{ type: 'user', id: 'bad-string-timestamp', ts: '1970-01-01T00:00:00.000Z', text: 'bad string timestamp' }]);
  });

  it('falls back for overflowed transcript entry timestamps', () => {
    expect(
      buildDisplayBlocksFromEntries([
        {
          id: 'overflowed-timestamp',
          timestamp: '2026-02-31T12:00:00.000Z',
          message: { role: 'user', content: 'overflowed timestamp' },
        },
      ]),
    ).toEqual([{ type: 'user', id: 'overflowed-timestamp', ts: '1970-01-01T00:00:00.000Z', text: 'overflowed timestamp' }]);
  });

  it('renders hidden related thread context as a visible summary event', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'related-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'custom',
          customType: 'related_threads_context',
          display: false,
          content: [
            {
              type: 'text',
              text: [
                'The user explicitly selected previous conversations to reuse as background context for the next prompt.',
                'Use only the parts that still help. Prefer the current prompt and current repo state over stale historical details.',
                '',
                'Conversation 1 — Release signing',
                'Workspace: /repo/a',
                'Created: 2026-04-10T10:00:00.000Z',
                '',
                'Keep the notarization mapping fix.',
                '',
                'Conversation 2 — Auto mode wakeups',
                'Workspace: /repo/b',
                'Created: 2026-04-11T10:00:00.000Z',
                '',
                'Wakeups use durable run callbacks.',
              ].join('\n'),
            },
          ],
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'summary',
        kind: 'related',
        title: 'Reused thread summaries',
        detail: '2 selected conversations were summarized and injected before this prompt so this thread could start with reused context.',
      }),
    ]);
    expect(blocks[0]).toMatchObject({
      text: expect.stringContaining('### Conversation 1 — Release signing'),
    });
    expect((blocks[0] as Extract<(typeof blocks)[number], { type: 'summary' }>).text).toContain('- Workspace: `/repo/a`');
    expect((blocks[0] as Extract<(typeof blocks)[number], { type: 'summary' }>).text).toContain('Wakeups use durable run callbacks.');
  });

  it('shows assistant replies from generic legacy hidden custom turns in the visible transcript', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'user-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Create a new project.' }],
        },
      },
      {
        id: 'hidden-1',
        parentId: 'user-1',
        timestamp: '2026-03-12T16:00:01.000Z',
        message: {
          role: 'custom',
          customType: 'conversation_automation_review',
          display: false,
          content: [{ type: 'text', text: 'Legacy bookkeeping prompt.' }],
        },
      },
      {
        id: 'assistant-1',
        parentId: 'hidden-1',
        timestamp: '2026-03-12T16:00:02.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'No automation changes needed.' }],
        },
      },
      {
        id: 'tool-1',
        parentId: 'assistant-1',
        timestamp: '2026-03-12T16:00:03.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'call-1',
          toolName: 'bash',
          content: [{ type: 'text', text: 'ls' }],
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'user',
        text: 'Create a new project.',
      }),
      expect.objectContaining({
        type: 'context',
        customType: 'conversation_automation_review',
        text: 'Legacy bookkeeping prompt.',
      }),
      expect.objectContaining({
        type: 'text',
        text: 'No automation changes needed.',
      }),
      expect.objectContaining({
        type: 'tool_use',
        tool: 'bash',
        output: 'ls',
      }),
    ]);
  });

  it('shows auto review descendants in the visible transcript as internal work', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'user-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'First visible user message.' }],
        },
      },
      {
        id: 'assistant-1',
        parentId: 'user-1',
        timestamp: '2026-03-12T16:00:01.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'First visible assistant reply.' }],
        },
      },
      {
        id: 'hidden-1',
        parentId: 'assistant-1',
        timestamp: '2026-03-12T16:00:02.000Z',
        message: {
          role: 'custom',
          customType: 'conversation_automation_post_turn_review',
          display: false,
          content: [{ type: 'text', text: 'Legacy bookkeeping prompt.' }],
        },
      },
      {
        id: 'assistant-2',
        parentId: 'hidden-1',
        timestamp: '2026-03-12T16:00:03.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Reviewing whether auto mode should keep going.' },
            { type: 'toolCall', id: 'call-1', name: 'conversation_auto_control', arguments: { action: 'stop', reason: 'done' } },
          ],
        },
      },
      {
        id: 'tool-1',
        parentId: 'assistant-2',
        timestamp: '2026-03-12T16:00:04.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'call-1',
          toolName: 'conversation_auto_control',
          content: [{ type: 'text', text: 'Stopped auto mode: done.' }],
        },
      },
      {
        id: 'user-2',
        parentId: 'tool-1',
        timestamp: '2026-03-12T16:00:05.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Second visible user message.' }],
        },
      },
      {
        id: 'assistant-3',
        parentId: 'user-2',
        timestamp: '2026-03-12T16:00:06.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second visible assistant reply.' }],
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'user',
        text: 'First visible user message.',
      }),
      expect.objectContaining({
        type: 'text',
        text: 'First visible assistant reply.',
      }),
      expect.objectContaining({
        type: 'context',
        customType: 'conversation_automation_post_turn_review',
        text: 'Legacy bookkeeping prompt.',
      }),
      expect.objectContaining({
        type: 'thinking',
        text: 'Reviewing whether auto mode should keep going.',
      }),
      expect.objectContaining({
        type: 'tool_use',
        tool: 'conversation_auto_control',
        input: { action: 'stop', reason: 'done' },
        output: 'Stopped auto mode: done.',
      }),
      expect.objectContaining({
        type: 'user',
        text: 'Second visible user message.',
      }),
      expect.objectContaining({
        type: 'text',
        text: 'Second visible assistant reply.',
      }),
    ]);
  });

  it('keeps assistant replies visible when hidden prompt context precedes the turn', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'user-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Use the referenced project context.' }],
        },
      },
      {
        id: 'context-1',
        parentId: 'user-1',
        timestamp: '2026-03-12T16:00:01.000Z',
        message: {
          role: 'custom',
          customType: 'referenced_context',
          display: false,
          content: [{ type: 'text', text: 'Referenced project: @foo' }],
        },
      },
      {
        id: 'assistant-1',
        parentId: 'context-1',
        timestamp: '2026-03-12T16:00:02.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Using the referenced project context now.' }],
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'user',
        text: 'Use the referenced project context.',
      }),
      expect.objectContaining({
        type: 'context',
        customType: 'referenced_context',
        text: 'Referenced project: @foo',
      }),
      expect.objectContaining({
        type: 'text',
        text: 'Using the referenced project context now.',
      }),
    ]);
  });

  it('renames a stored conversation by appending session metadata', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-rename',
      title: 'Fallback first prompt',
      assistantTexts: ['Generated answer'],
    });

    expect(renameStoredSession('session-rename', '  Better manual title  ')).toEqual(
      expect.objectContaining({
        id: 'session-rename',
        title: 'Better manual title',
      }),
    );
    expect(listSessions()[0]).toEqual(
      expect.objectContaining({
        id: 'session-rename',
        title: 'Better manual title',
        messageCount: 2,
      }),
    );
    expect(readSessionBlocks('session-rename')?.meta.title).toBe('Better manual title');
    expect(readFileSync(filePath, 'utf-8')).toContain('"name":"Better manual title"');
  });

  it('applies latest workspace metadata without rewriting the session header', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-workspace-move',
      cwd: '/tmp/original',
      title: 'Move me',
    });

    appendConversationWorkspaceMetadata({
      sessionFile: filePath,
      previousCwd: '/tmp/original',
      previousWorkspaceCwd: null,
      cwd: '/tmp/attached-project',
      workspaceCwd: '/tmp/attached-project',
      visibleMessage: true,
    });

    const detail = readSessionBlocks('session-workspace-move');
    expect(detail?.meta.cwd).toBe('/tmp/attached-project');
    expect(detail?.meta.workspaceCwd).toBe('/tmp/attached-project');
    expect(readFileSync(filePath, 'utf-8').split('\n')[0]).toContain('"cwd":"/tmp/original"');
    expect(detail?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'user', text: 'Move me' }),
        expect.objectContaining({ type: 'text', text: 'Assistant reply' }),
      ]),
    );
    expect(detail?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'context',
          customType: 'conversation_workspace_change',
          text: 'Working directory changed from Chats to /tmp/attached-project.',
        }),
      ]),
    );

    const appendedLines = readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .slice(-2)
      .map((line) => JSON.parse(line));
    expect(appendedLines[0]).toEqual(
      expect.objectContaining({
        type: 'custom',
      }),
    );
    expect(appendedLines[0].parentId).toEqual(expect.any(String));
    expect(appendedLines[1]).toEqual(
      expect.objectContaining({
        type: 'custom_message',
        parentId: appendedLines[0].id,
      }),
    );
  });

  it('infers neutral chat workspaces as chat conversations without metadata', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);
    const stateRoot = join(sessionsDir, 'state');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const chatCwd = join(stateRoot, 'neon-pilot-runtime', 'chat-workspaces', 'shared');

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-chat-fallback',
      cwd: chatCwd,
      title: 'Plain chat',
    });

    const detail = readSessionBlocks('session-chat-fallback');
    expect(detail?.meta.cwd).toBe(chatCwd);
    expect(detail?.meta.workspaceCwd).toBeNull();
  });

  it('uses legacy cwd tool results to associate old cwd-less chats with the requested workspace', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);
    const stateRoot = join(sessionsDir, 'state');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const chatCwd = join(stateRoot, 'neon-pilot-runtime', 'chat-workspaces', 'shared');

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-legacy-cwd-tool',
      cwd: chatCwd,
      title: 'Move from chat',
    });

    appendConversationWorkspaceMetadata({
      sessionFile: filePath,
      cwd: chatCwd,
      workspaceCwd: null,
    });
    appendFileSync(
      filePath,
      `${JSON.stringify({
        type: 'message',
        id: 'legacy-cwd-tool-result',
        parentId: 'session-legacy-cwd-tool-assistant-1',
        timestamp: '2026-03-11T12:00:03.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'call-cwd',
          toolName: 'change_working_directory',
          content: [{ type: 'text', text: 'Queued working directory change to /tmp/project.' }],
          details: {
            action: 'queue',
            cwd: '/tmp/project',
            queued: true,
          },
        },
      })}\n`,
      'utf-8',
    );

    const detail = readSessionBlocks('session-legacy-cwd-tool');
    expect(detail?.meta.cwd).toBe('/tmp/project');
    expect(detail?.meta.workspaceCwd).toBe('/tmp/project');
  });

  it('ignores a stale chat workspace marker when metadata points at a project cwd', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-stale-chat-workspace-marker',
      cwd: '/tmp/original-chat-workspace',
      title: 'Moved from chat',
    });

    appendConversationWorkspaceMetadata({
      sessionFile: filePath,
      previousCwd: '/tmp/original-chat-workspace',
      previousWorkspaceCwd: null,
      cwd: '/tmp/neon-pilot',
      workspaceCwd: null,
      visibleMessage: true,
    });

    const detail = readSessionBlocks('session-stale-chat-workspace-marker');
    expect(detail?.meta.cwd).toBe('/tmp/neon-pilot');
    expect(detail?.meta).not.toHaveProperty('workspaceCwd');
  });

  it('lets the latest manual rename win over earlier session names', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-renamed-twice',
      title: 'Fallback first prompt',
      assistantTexts: ['Generated answer'],
      sessionName: 'Original generated title',
    });

    renameStoredSession('session-renamed-twice', 'Updated manual title');

    expect(listSessions()[0]).toEqual(
      expect.objectContaining({
        id: 'session-renamed-twice',
        title: 'Updated manual title',
      }),
    );
    expect(readSessionBlocks('session-renamed-twice')?.meta.title).toBe('Updated manual title');
  });

  it('writes a persistent session index and reuses it after cache clear', async () => {
    const sessionsDir = createTempSessionsDir();
    const indexFile = configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-persist',
      title: 'Persistent title',
      assistantTexts: ['Persisted reply'],
    });
    appendConversationWorkspaceMetadata({
      sessionFile: filePath,
      cwd: '/tmp/persistent-project',
      workspaceCwd: '/tmp/persistent-project',
    });

    const first = listSessions();
    expect(first[0]?.title).toBe('Persistent title');
    expect(first[0]?.workspaceCwd).toBe('/tmp/persistent-project');
    await flushSessionIndexWrite();
    expect(existsSync(indexFile)).toBe(true);
    expect(readFileSync(indexFile, 'utf-8')).toContain('session-persist');

    clearSessionCaches();

    chmodSync(filePath, 0o000);
    try {
      const second = listSessions();
      expect(second).toHaveLength(1);
      expect(second[0]).toEqual(
        expect.objectContaining({
          id: 'session-persist',
          title: 'Persistent title',
          messageCount: 2,
          cwd: '/tmp/persistent-project',
          workspaceCwd: '/tmp/persistent-project',
        }),
      );
    } finally {
      chmodSync(filePath, 0o644);
    }
  });

  it('refreshes cached session metadata when the file changes', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-1',
      title: 'Original title',
      assistantTexts: ['First reply'],
    });

    const first = listSessions();
    expect(first).toHaveLength(1);
    expect(first[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        title: 'Original title',
        messageCount: 2,
        model: 'test-model',
      }),
    );

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-1',
      title: 'Updated title that is definitely different',
      assistantTexts: ['First reply', 'Second reply with extra text'],
    });

    const second = listSessions();
    expect(second).toHaveLength(1);
    expect(second[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        title: 'Updated title that is definitely different',
        messageCount: 3,
      }),
    );
  });

  it('lists sessions stored directly in the sessions root after restart', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      cwdSlug: null,
      sessionId: 'session-root',
      title: 'Root-level session',
      assistantTexts: ['Root reply'],
    });

    expect(listSessions()).toEqual([
      expect.objectContaining({
        id: 'session-root',
        title: 'Root-level session',
        cwd: '/tmp/project',
      }),
    ]);

    clearSessionCaches();

    expect(listSessions()).toEqual([
      expect.objectContaining({
        id: 'session-root',
        title: 'Root-level session',
      }),
    ]);
    expect(
      readSessionBlocks('session-root')
        ?.blocks.filter((block) => block.type === 'text')
        .map((block) => block.text),
    ).toEqual(['Root reply']);
  });

  it('records parent session ids and source run ids for nested session lineage', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'parent-session',
      title: 'Parent session',
      assistantTexts: ['Parent reply'],
    });

    writeSessionFile({
      sessionsDir,
      cwdSlug: '__runs/run-subagent-123',
      sessionId: 'child-session',
      title: 'Child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    expect(listSessions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'child-session',
          parentSessionFile,
          parentSessionId: 'parent-session',
          sourceRunId: 'run-subagent-123',
        }),
      ]),
    );
  });

  it('can detach a forked session from sidebar lineage when it becomes a moved workspace conversation', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'detached-parent-session',
      title: 'Detached parent session',
      assistantTexts: ['Parent reply'],
    });

    const childSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'detached-child-session',
      title: 'Detached child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });
    appendConversationOffshootDetachedMetadata({ sessionFile: childSessionFile });

    const childMeta = listSessions().find((session) => session.id === 'detached-child-session');
    expect(childMeta).toBeTruthy();
    expect(childMeta).not.toHaveProperty('parentSessionFile');
    expect(childMeta).not.toHaveProperty('parentSessionId');
    expect(childMeta).not.toHaveProperty('offshootKind');
  });

  it('does not render tool-created side conversations as loose transcript topology events', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'topology-parent-session',
      title: 'Topology parent session',
      assistantTexts: ['Parent reply'],
    });

    const childSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'topology-child-session',
      title: 'Topology child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });
    appendConversationOffshootMetadata({
      sessionFile: childSessionFile,
      kind: 'side',
      parentSessionFile,
      parentSessionId: 'topology-parent-session',
    });

    const detail = readSessionBlocks('topology-parent-session');

    expect(detail?.blocks).not.toEqual(expect.arrayContaining([expect.objectContaining({ customType: 'child_conversation_topology' })]));
  });

  it('pins subagent child conversations onto the subagent tool block instead of a separate topology event', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'subagent-parent-session',
      title: 'Subagent parent session',
      assistantTexts: [],
    });
    appendFileSync(
      parentSessionFile,
      `${JSON.stringify({
        type: 'message',
        id: 'subagent-call-message',
        parentId: 'subagent-parent-session-user-1',
        timestamp: '2026-03-11T12:00:01.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', id: 'tool-subagent-1', name: 'subagent', arguments: { prompt: 'Check it' } }],
        },
      })}\n${JSON.stringify({
        type: 'message',
        id: 'subagent-result-message',
        parentId: 'subagent-call-message',
        timestamp: '2026-03-11T12:00:02.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-subagent-1',
          toolName: 'subagent',
          content: 'Started subagent run-child-tool for subagent-child-session.',
        },
      })}\n`,
    );

    writeSessionFile({
      sessionsDir,
      cwdSlug: '__runs/run-child-tool',
      sessionId: 'subagent-child-session',
      title: 'Subagent child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    const blocks = readSessionBlocks('subagent-parent-session')?.blocks ?? [];
    expect(blocks).not.toEqual(expect.arrayContaining([expect.objectContaining({ customType: 'child_conversation_topology' })]));
    expect(blocks.find((block) => block.type === 'tool_use' && block.tool === 'subagent')).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({ childConversationId: 'subagent-child-session', branchKind: 'subagent' }),
      }),
    );
  });

  it('adds a parent backlink inside subagent child conversations even when only parentSessionFile is stored', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'subagent-backlink-parent',
      title: 'Subagent backlink parent',
      assistantTexts: ['Parent reply'],
    });

    writeSessionFile({
      sessionsDir,
      cwdSlug: '__runs/run-subagent-backlink',
      sessionId: 'subagent-backlink-child',
      title: 'Subagent backlink child',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    const childBlocks = readSessionBlocks('subagent-backlink-child')?.blocks ?? [];
    expect(childBlocks[0]).toEqual(
      expect.objectContaining({
        type: 'context',
        customType: 'parent_conversation_backlink',
        text: expect.stringContaining('Subagent conversation from parent: Subagent backlink parent'),
      }),
    );
  });

  it('preserves conversation history in getBranch() after offshoot metadata is appended', () => {
    // Regression: appendConversationOffshootMetadata used parentId: null which made the
    // offshoot entry become the new session leaf. getBranch() then started traversal from
    // the offshoot entry (parentId: null → empty path) → empty transcript in forked sessions.
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'offshoot-parent',
      title: 'Offshoot parent',
      assistantTexts: ['Hello from parent'],
    });

    // Simulate the branch: create a SessionManager on the parent file and branch from the last entry.
    const sourceManager = SessionManager.open(parentSessionFile);
    const leafId = sourceManager.getLeafId();
    expect(leafId).toBeTruthy();
    const branchedFile = sourceManager.createBranchedSession(leafId!);
    expect(branchedFile).toBeTruthy();

    // Append offshoot metadata — this must NOT break getBranch().
    appendConversationOffshootMetadata({
      sessionFile: branchedFile!,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'offshoot-parent',
      parentMessageId: leafId!,
    });

    // The branched session must still expose its full history via getBranch().
    const branchedManager = SessionManager.open(branchedFile!);
    const branch = branchedManager.getBranch();
    // Branch should contain the real conversation entries, not just the offshoot entry.
    const messageEntries = branch.filter((e) => e.type === 'message');
    expect(messageEntries.length).toBeGreaterThan(0);

    // And readSessionBlocks on the branched file must return display blocks.
    const blocks = readSessionBlocks(branchedManager.getSessionId()!)?.blocks ?? [];
    expect(blocks.some((b) => b.type === 'user' || b.type === 'text')).toBe(true);
  });

  it('anchors fork offshoot events after their source message and adds a child backlink', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'fork-parent-session',
      title: 'Fork parent session',
      assistantTexts: ['Parent reply'],
    });
    const childSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'fork-child-session',
      title: 'Fork child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });
    const parentMessageId = readSessionBlocks('fork-parent-session')?.blocks.find((block) => block.type === 'user')?.id;
    expect(parentMessageId).toBeTruthy();
    appendConversationOffshootMetadata({
      sessionFile: childSessionFile,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'fork-parent-session',
      parentMessageId,
    });

    const parentBlocks = readSessionBlocks('fork-parent-session')?.blocks ?? [];
    const userIndex = parentBlocks.findIndex((block) => block.id === parentMessageId);
    expect(parentBlocks[userIndex + 1]).toEqual(
      expect.objectContaining({
        type: 'context',
        customType: 'child_conversation_topology',
        text: expect.stringContaining('Fork conversation created: Fork child session'),
      }),
    );

    // Synthetic child files whose metadata is appended after child messages still fall back to the end.
    const childBlocks = readSessionBlocks('fork-child-session')?.blocks ?? [];
    expect(childBlocks[childBlocks.length - 1]).toEqual(
      expect.objectContaining({
        type: 'context',
        customType: 'parent_conversation_backlink',
        text: expect.stringContaining('Fork conversation from parent: Fork parent session'),
      }),
    );
  });

  it('strips generated fork and rewind prefixes from offshoot conversation titles', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'title-prefix-parent',
      title: 'Original thread',
      assistantTexts: ['Parent reply'],
    });
    const forkSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'title-prefix-fork',
      title: 'Fork source prompt',
      sessionName: 'fork: Original thread',
      assistantTexts: ['Fork reply'],
      parentSession: parentSessionFile,
    });
    const rewindSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'title-prefix-rewind',
      title: 'Rewind source prompt',
      sessionName: 'rewind: Original thread',
      assistantTexts: ['Rewind reply'],
      parentSession: parentSessionFile,
    });

    appendConversationOffshootMetadata({
      sessionFile: forkSessionFile,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'title-prefix-parent',
      parentMessageId: 'title-prefix-parent-user-1',
    });
    appendConversationOffshootMetadata({
      sessionFile: rewindSessionFile,
      kind: 'rewind',
      parentSessionFile,
      parentSessionId: 'title-prefix-parent',
      parentMessageId: 'title-prefix-parent-user-1',
    });

    expect(readSessionMetaByFile(forkSessionFile)?.title).toBe('Original thread');
    expect(readSessionMetaByFile(rewindSessionFile)?.title).toBe('Original thread');
    expect(listSessions().map((session) => session.title)).toEqual(expect.arrayContaining(['Original thread', 'Original thread']));
  });

  it('appends child topology as a chronological parent event', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'chronological-topology-parent',
      title: 'Chronological topology parent',
      assistantTexts: ['Parent reply'],
    });
    const parentMessageId = readSessionBlocks('chronological-topology-parent')?.blocks.find((block) => block.type === 'user')?.id;
    expect(parentMessageId).toBeTruthy();

    appendChildConversationTopologyEntry({
      parentSessionFile,
      childSessionId: 'chronological-topology-child',
      childTitle: 'Chronological topology child',
      kind: 'fork',
      parentMessageId,
    });

    const blocks = readSessionBlocks('chronological-topology-parent')?.blocks ?? [];
    expect(blocks[blocks.length - 1]).toEqual(
      expect.objectContaining({
        customType: 'child_conversation_topology',
        text: expect.stringContaining('Chronological topology child'),
      }),
    );
    expect(blocks[blocks.length - 1]?.text).toContain(`Source message: ${parentMessageId}`);
    expect(blocks[blocks.length - 1]?.text).toContain('Source preview: Chronological topology parent');
  });

  it('keeps child backlink anchored at the rewind point after later messages', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'rewind-parent-session',
      title: 'Rewind parent session',
      assistantTexts: ['Parent reply'],
    });
    const sourceManager = SessionManager.open(parentSessionFile);
    const parentMessageId = sourceManager.getLeafId();
    expect(parentMessageId).toBeTruthy();
    const childSessionFile = sourceManager.createBranchedSession(parentMessageId!);
    expect(childSessionFile).toBeTruthy();
    appendFileSync(
      childSessionFile!,
      `${JSON.stringify({
        type: 'message',
        id: 'rewind-child-later-user',
        parentId: parentMessageId,
        timestamp: '2026-03-11T12:00:10.000Z',
        message: { role: 'user', content: 'Later child prompt' },
      })}\n${JSON.stringify({
        type: 'message',
        id: 'rewind-child-later-assistant',
        parentId: 'rewind-child-later-user',
        timestamp: '2026-03-11T12:00:11.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Later child reply' }] },
      })}\n`,
    );

    appendConversationOffshootMetadata({
      sessionFile: childSessionFile!,
      kind: 'rewind',
      parentSessionFile,
      parentSessionId: 'rewind-parent-session',
      parentMessageId: parentMessageId!,
    });

    const childId = SessionManager.open(childSessionFile!).getSessionId();
    expect(childId).toBeTruthy();
    const childBlocks = readSessionBlocks(childId!)?.blocks ?? [];
    const anchorIndex = childBlocks.findIndex((block) => block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`));
    const laterReplyIndex = childBlocks.findIndex((block) => block.type === 'text' && block.text === 'Later child reply');
    const backlinkIndex = childBlocks.findIndex((block) => block.type === 'context' && block.customType === 'parent_conversation_backlink');

    expect(backlinkIndex).toBe(anchorIndex + 1);
    expect(backlinkIndex).toBeLessThan(laterReplyIndex);
  });

  it.each(['fork', 'rewind'] as const)('anchors %s markers in both parent and child transcripts', (kind) => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: `${kind}-both-sides-parent`,
      title: `${kind} both sides parent`,
      assistantTexts: ['Parent reply'],
    });
    const sourceManager = SessionManager.open(parentSessionFile);
    const parentMessageId = sourceManager.getLeafId();
    expect(parentMessageId).toBeTruthy();

    const childSessionFile = sourceManager.createBranchedSession(parentMessageId!);
    expect(childSessionFile).toBeTruthy();
    const childManager = SessionManager.open(childSessionFile!);
    const childSessionId = childManager.getSessionId();
    expect(childSessionId).toBeTruthy();
    appendFileSync(
      childSessionFile!,
      `${JSON.stringify({
        type: 'message',
        id: `${kind}-both-sides-later-user`,
        parentId: parentMessageId,
        timestamp: '2026-03-11T12:00:10.000Z',
        message: { role: 'user', content: 'Later child prompt' },
      })}\n${JSON.stringify({
        type: 'message',
        id: `${kind}-both-sides-later-assistant`,
        parentId: `${kind}-both-sides-later-user`,
        timestamp: '2026-03-11T12:00:11.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Later child reply' }] },
      })}\n`,
    );

    appendConversationOffshootMetadata({
      sessionFile: childSessionFile!,
      kind,
      parentSessionFile,
      parentSessionId: `${kind}-both-sides-parent`,
      parentMessageId: parentMessageId!,
    });

    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    const parentBlocks = readSessionBlocks(`${kind}-both-sides-parent`)?.blocks ?? [];
    const parentAnchorIndex = parentBlocks.findIndex((block) => block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`));
    const parentTopologyIndex = parentBlocks.findIndex(
      (block) => block.type === 'context' && block.customType === 'child_conversation_topology',
    );
    expect(parentTopologyIndex).toBe(parentAnchorIndex + 1);
    expect(parentBlocks[parentTopologyIndex]).toEqual(
      expect.objectContaining({ text: expect.stringContaining(`${label} conversation created:`) }),
    );
    expect(parentBlocks[parentTopologyIndex]).toEqual(expect.objectContaining({ text: expect.stringContaining(childSessionId!) }));

    const childBlocks = readSessionBlocks(childSessionId!)?.blocks ?? [];
    const childAnchorIndex = childBlocks.findIndex((block) => block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`));
    const childBacklinkIndex = childBlocks.findIndex(
      (block) => block.type === 'context' && block.customType === 'parent_conversation_backlink',
    );
    const laterReplyIndex = childBlocks.findIndex((block) => block.type === 'text' && block.text === 'Later child reply');
    expect(childBacklinkIndex).toBe(childAnchorIndex + 1);
    expect(childBacklinkIndex).toBeLessThan(laterReplyIndex);
    expect(childBlocks[childBacklinkIndex]).toEqual(
      expect.objectContaining({ text: expect.stringContaining(`${label} conversation from parent: ${kind} both sides parent`) }),
    );
  });

  it('anchors rewind backlink at inherited snapshot end when source entry is not copied into child', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'rewind-missing-source-parent',
      title: 'Rewind missing source parent',
      assistantTexts: ['First reply', 'Second reply'],
    });
    const sourceManager = SessionManager.open(parentSessionFile);
    const sourceEntryId = sourceManager.getLeafId();
    expect(sourceEntryId).toBeTruthy();
    const sourceEntry = sourceManager.getEntry(sourceEntryId!);
    expect(sourceEntry?.parentId).toBeTruthy();

    const childSessionFile = sourceManager.createBranchedSession(sourceEntry!.parentId!);
    expect(childSessionFile).toBeTruthy();
    const childSessionId = SessionManager.open(childSessionFile!).getSessionId();
    expect(childSessionId).toBeTruthy();

    appendConversationOffshootMetadata({
      sessionFile: childSessionFile!,
      kind: 'rewind',
      parentSessionFile,
      parentSessionId: 'rewind-missing-source-parent',
      parentMessageId: sourceEntryId!,
    });
    appendFileSync(
      childSessionFile!,
      `${JSON.stringify({
        type: 'message',
        id: 'rewind-missing-source-later-user',
        parentId: sourceEntry!.parentId!,
        timestamp: '2099-03-11T12:00:10.000Z',
        message: { role: 'user', content: 'Later child prompt' },
      })}\n${JSON.stringify({
        type: 'message',
        id: 'rewind-missing-source-later-assistant',
        parentId: 'rewind-missing-source-later-user',
        timestamp: '2099-03-11T12:00:11.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Later child reply' }] },
      })}\n`,
    );

    const childBlocks = readSessionBlocks(childSessionId!)?.blocks ?? [];
    const backlinkIndex = childBlocks.findIndex((block) => block.type === 'context' && block.customType === 'parent_conversation_backlink');
    const sourceIndex = childBlocks.findIndex((block) => block.id === sourceEntryId || block.id.startsWith(`${sourceEntryId}-`));
    const laterReplyIndex = childBlocks.findIndex((block) => block.type === 'text' && block.text === 'Later child reply');

    expect(sourceIndex).toBe(-1);
    expect(backlinkIndex).toBeGreaterThanOrEqual(0);
    expect(backlinkIndex).toBeLessThan(laterReplyIndex);
  });

  it('repositions a persisted child parent-backlink entry instead of leaving it at the bottom', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'persisted-backlink-parent',
      title: 'Persisted backlink parent',
      assistantTexts: ['Parent reply'],
    });
    const sourceManager = SessionManager.open(parentSessionFile);
    const parentMessageId = sourceManager.getLeafId();
    expect(parentMessageId).toBeTruthy();
    const childSessionFile = sourceManager.createBranchedSession(parentMessageId!);
    expect(childSessionFile).toBeTruthy();
    const childSessionId = SessionManager.open(childSessionFile!).getSessionId();
    expect(childSessionId).toBeTruthy();

    appendConversationOffshootMetadata({
      sessionFile: childSessionFile!,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'persisted-backlink-parent',
      parentMessageId: parentMessageId!,
    });
    appendParentConversationBacklinkEntry({
      sessionFile: childSessionFile!,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'persisted-backlink-parent',
      parentMessageId: parentMessageId!,
    });
    appendFileSync(
      childSessionFile!,
      `${JSON.stringify({
        type: 'message',
        id: 'persisted-backlink-later-user',
        parentId: parentMessageId,
        timestamp: '2099-03-11T12:00:10.000Z',
        message: { role: 'user', content: 'Later child prompt' },
      })}\n${JSON.stringify({
        type: 'message',
        id: 'persisted-backlink-later-assistant',
        parentId: 'persisted-backlink-later-user',
        timestamp: '2099-03-11T12:00:11.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Later child reply' }] },
      })}\n`,
    );

    const childBlocks = readSessionBlocks(childSessionId!)?.blocks ?? [];
    const backlinks = childBlocks.filter((block) => block.type === 'context' && block.customType === 'parent_conversation_backlink');
    const anchorIndex = childBlocks.findIndex((block) => block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`));
    const laterReplyIndex = childBlocks.findIndex((block) => block.type === 'text' && block.text === 'Later child reply');
    const backlinkIndex = childBlocks.indexOf(backlinks[0]!);
    expect(backlinks).toHaveLength(1);
    expect(backlinkIndex).toBe(anchorIndex + 1);
    expect(backlinkIndex).toBeLessThan(laterReplyIndex);
    expect(backlinks[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('Fork conversation from parent: Persisted backlink parent') }),
    );
  });

  it('anchors tombstone when parentMessageId is the bare entry id (assistant block suffix stripped)', () => {
    // In the real fork flow, resolveSessionEntryIdFromBlockId strips block ID suffixes
    // like "-t0" or "-x0" from assistant blocks so parentMessageId is the bare entry id.
    // mergeTopologyBlocks must match this against block.id which still has the suffix.
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'stripped-parent',
      title: 'Stripped parent',
      assistantTexts: ['Reply'],
    });
    const childSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'stripped-child',
      title: 'Stripped child',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    // Assistant blocks get IDs like "{entryId}-t0" (not the bare entry id).
    const assistantBlock = readSessionBlocks('stripped-parent')?.blocks.find((b) => b.type === 'text');
    expect(assistantBlock).toBeDefined();
    const assistantBlockId = assistantBlock!.id; // e.g. "stripped-parent-assistant-1"
    // Strip the "-t0" / "-x0" style suffix. In this test the entry id IS the message id
    // as written by writeSessionFile; we derive the bare entry id to simulate the real flow.
    // The assistant entry id in writeSessionFile is `${sessionId}-assistant-1`.
    // readSessionBlocks rewrites assistant blocks to "{entryId}-t{n}" so we strip that suffix.
    const bareEntryId = assistantBlockId.replace(/-[txceim]\d+$/, '');
    expect(bareEntryId).not.toBe(assistantBlockId); // Confirm suffix was stripped.

    appendConversationOffshootMetadata({
      sessionFile: childSessionFile,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'stripped-parent',
      parentMessageId: bareEntryId, // bare entry id, not the block id with suffix
    });

    const parentBlocks = readSessionBlocks('stripped-parent')?.blocks ?? [];
    const assistantIndex = parentBlocks.findIndex((b) => b.type === 'text');
    // Tombstone should be anchored immediately after the assistant block, not at the end.
    expect(parentBlocks[assistantIndex + 1]).toEqual(
      expect.objectContaining({
        type: 'context',
        customType: 'child_conversation_topology',
        text: expect.stringContaining('Fork conversation created: Stripped child'),
      }),
    );
  });

  it('refreshes transcript topology events when a child conversation appears after parent detail is cached', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'cached-topology-parent-session',
      title: 'Cached topology parent session',
      assistantTexts: ['Parent reply'],
    });

    expect(readSessionBlocks('cached-topology-parent-session')?.blocks.some((block) => block.type === 'context')).toBe(false);

    const childSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'cached-topology-child-session',
      title: 'Cached topology child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });
    appendConversationOffshootMetadata({
      sessionFile: childSessionFile,
      kind: 'fork',
      parentSessionFile,
      parentSessionId: 'cached-topology-parent-session',
    });

    expect(readSessionBlocks('cached-topology-parent-session')?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'context',
          customType: 'child_conversation_topology',
          text: expect.stringContaining('Cached topology child session'),
        }),
      ]),
    );
  });

  it('preserves nested session lineage in the persisted metadata index', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'indexed-parent-session',
      title: 'Indexed parent session',
      assistantTexts: ['Parent reply'],
    });

    writeSessionFile({
      sessionsDir,
      cwdSlug: '__runs/run-indexed-subagent',
      sessionId: 'indexed-child-session',
      title: 'Indexed child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    expect(listSessions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'indexed-child-session',
          parentSessionFile,
          parentSessionId: 'indexed-parent-session',
          sourceRunId: 'run-indexed-subagent',
        }),
      ]),
    );

    clearSessionCaches();

    expect(listSessions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'indexed-child-session',
          parentSessionFile,
          parentSessionId: 'indexed-parent-session',
          sourceRunId: 'run-indexed-subagent',
        }),
      ]),
    );
  });

  it('resolves parent ids when opening a child conversation by file from the metadata index', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const parentSessionFile = writeSessionFile({
      sessionsDir,
      sessionId: 'file-parent-session',
      title: 'File parent session',
      assistantTexts: ['Parent reply'],
    });

    const childSessionFile = writeSessionFile({
      sessionsDir,
      cwdSlug: '__runs/run-file-subagent',
      sessionId: 'file-child-session',
      title: 'File child session',
      assistantTexts: ['Child reply'],
      parentSession: parentSessionFile,
    });

    expect(listSessions()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'file-child-session' })]));

    expect(readSessionMetaByFile(childSessionFile)).toEqual(
      expect.objectContaining({
        id: 'file-child-session',
        parentSessionFile,
        parentSessionId: 'file-parent-session',
        sourceRunId: 'run-file-subagent',
      }),
    );
  });

  it('refreshes persisted metadata after a restart when the file changes', async () => {
    const sessionsDir = createTempSessionsDir();
    const indexFile = configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-restart',
      title: 'Before restart',
      assistantTexts: ['Old reply'],
    });

    expect(listSessions()[0]?.title).toBe('Before restart');
    await flushSessionIndexWrite();
    expect(existsSync(indexFile)).toBe(true);

    clearSessionCaches();

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-restart',
      title: 'After restart',
      assistantTexts: ['Old reply', 'Newest reply'],
    });

    const afterRestart = listSessions();
    expect(afterRestart[0]).toEqual(
      expect.objectContaining({
        id: 'session-restart',
        title: 'After restart',
        messageCount: 3,
      }),
    );
  });

  it('reads the latest session blocks even when metadata was cached earlier', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-2',
      title: 'Before update',
      assistantTexts: ['Old reply'],
    });

    const listed = listSessions();
    expect(listed[0]?.title).toBe('Before update');

    writeSessionFile({
      sessionsDir,
      sessionId: 'session-2',
      title: 'After update',
      assistantTexts: ['Old reply', 'Newest reply'],
    });

    const detail = readSessionBlocks('session-2');
    expect(detail).not.toBeNull();
    expect(detail?.meta.title).toBe('After update');
    expect(detail?.blocks.filter((block) => block.type === 'text').map((block) => block.text)).toEqual(['Old reply', 'Newest reply']);
  });

  it('shows the latest compaction summary and only the kept transcript tail', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T12-00-00-000Z_session-compact.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-compact',
          timestamp: '2026-03-11T12:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'session-compact-model',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          modelId: 'test-model',
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-user-1',
          parentId: null,
          timestamp: '2026-03-11T12:00:00.000Z',
          message: { role: 'user', content: 'Before compaction' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-assistant-1',
          parentId: 'session-compact-user-1',
          timestamp: '2026-03-11T12:00:01.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Older reply' }] },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-user-2',
          parentId: 'session-compact-assistant-1',
          timestamp: '2026-03-11T12:00:02.000Z',
          message: { role: 'user', content: 'Keep this prompt' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-assistant-2',
          parentId: 'session-compact-user-2',
          timestamp: '2026-03-11T12:00:03.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Keep this reply' }] },
        }),
        JSON.stringify({
          type: 'compaction',
          id: 'session-compact-compaction-1',
          parentId: 'session-compact-assistant-2',
          timestamp: '2026-03-11T12:00:04.000Z',
          summary: '## Goal\nKeep only the latest summary.\n\n## Progress\n- Preserved the recent turn.',
          firstKeptEntryId: 'session-compact-user-2',
          tokensBefore: 1234,
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-user-3',
          parentId: 'session-compact-compaction-1',
          timestamp: '2026-03-11T12:00:05.000Z',
          message: { role: 'user', content: 'Continue after compaction' },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-compact-assistant-3',
          parentId: 'session-compact-user-3',
          timestamp: '2026-03-11T12:00:06.000Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Newest reply' }] },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-compact');
    expect(detail?.blocks).toEqual([
      {
        type: 'user',
        id: 'session-compact-user-1',
        ts: '2026-03-11T12:00:00.000Z',
        text: 'Before compaction',
      },
      {
        type: 'text',
        id: 'session-compact-assistant-1-x1',
        ts: '2026-03-11T12:00:01.000Z',
        text: 'Older reply',
      },
      {
        type: 'user',
        id: 'session-compact-user-2',
        ts: '2026-03-11T12:00:02.000Z',
        text: 'Keep this prompt',
      },
      {
        type: 'text',
        id: 'session-compact-assistant-2-x3',
        ts: '2026-03-11T12:00:03.000Z',
        text: 'Keep this reply',
      },
      {
        type: 'summary',
        id: 'session-compact-compaction-1',
        ts: '2026-03-11T12:00:04.000Z',
        kind: 'compaction',
        title: 'Compaction summary',
        text: '## Goal\nKeep only the latest summary.\n\n## Progress\n- Preserved the recent turn.',
      },
      {
        type: 'user',
        id: 'session-compact-user-3',
        ts: '2026-03-11T12:00:05.000Z',
        text: 'Continue after compaction',
      },
      {
        type: 'text',
        id: 'session-compact-assistant-3-x6',
        ts: '2026-03-11T12:00:06.000Z',
        text: 'Newest reply',
      },
    ]);
  });

  it('surfaces Codex compaction metadata on persisted compaction summaries', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const dir = join(sessionsDir, '--tmp-project--');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '2026-03-11T13-00-00-000Z_session-codex-compact.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'session-codex-compact',
          timestamp: '2026-03-11T13:00:00.000Z',
          cwd: '/tmp/project',
        }),
        JSON.stringify({
          type: 'model_change',
          id: 'session-codex-compact-model',
          parentId: null,
          timestamp: '2026-03-11T13:00:00.000Z',
          modelId: 'gpt-5.4',
        }),
        JSON.stringify({
          type: 'compaction',
          id: 'session-codex-compact-compaction-1',
          parentId: null,
          timestamp: '2026-03-11T13:00:01.000Z',
          summary: '## Goal\nKeep only the latest summary.',
          firstKeptEntryId: 'session-codex-compact-user-1',
          tokensBefore: 1234,
          details: {
            nativeCompaction: {
              version: 1,
              provider: 'openai-responses-compact',
              modelKey: 'openai-codex:openai-codex-responses:gpt-5.4',
              replacementHistory: [
                {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: 'Prompt after compaction' }],
                },
              ],
            },
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'session-codex-compact-user-1',
          parentId: 'session-codex-compact-compaction-1',
          timestamp: '2026-03-11T13:00:02.000Z',
          message: { role: 'user', content: 'Continue after compaction' },
        }),
      ].join('\n') + '\n',
    );

    const detail = readSessionBlocks('session-codex-compact');
    expect(detail?.blocks).toEqual([
      {
        type: 'summary',
        id: 'session-codex-compact-compaction-1',
        ts: '2026-03-11T13:00:01.000Z',
        kind: 'compaction',
        title: 'Compaction summary',
        text: '## Goal\nKeep only the latest summary.',
        detail: 'This used Codex compaction under the hood. Pi kept the text summary for display and portability.',
      },
      {
        type: 'user',
        id: 'session-codex-compact-user-1',
        ts: '2026-03-11T13:00:02.000Z',
        text: 'Continue after compaction',
      },
    ]);
  });

  it('persists overflow compaction summaries to transcript files', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-overflow-append',
      assistantTexts: ['Start'],
    });

    appendConversationCompactionSummary({
      sessionFile: filePath,
      summary: 'Recovered from overflow with summary',
      tokensBefore: 120000,
      firstKeptEntryId: 'session-overflow-append-user-1',
      details: { nativeCompaction: { version: 2, provider: 'openai' } },
    });

    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    const persisted = JSON.parse(lines.at(-1) as string) as {
      type: string;
      summary: string;
      firstKeptEntryId: string;
      tokensBefore: number;
      details?: { nativeCompaction?: { version: number; provider: string } };
    };

    expect(persisted).toMatchObject({
      type: 'compaction',
      summary: 'Recovered from overflow with summary',
      firstKeptEntryId: 'session-overflow-append-user-1',
      tokensBefore: 120000,
      details: { nativeCompaction: { version: 2, provider: 'openai' } },
    });

    const detail = readSessionBlocks('session-overflow-append');
    expect(detail?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'summary',
          kind: 'compaction',
          title: 'Compaction summary',
          text: 'Recovered from overflow with summary',
        }),
      ]),
    );
  });

  it('falls back to the current leaf id when firstKeptEntryId is omitted', () => {
    const sessionsDir = createTempSessionsDir();
    configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-overflow-append-fallback',
      assistantTexts: ['Start'],
    });

    appendConversationCompactionSummary({
      sessionFile: filePath,
      summary: 'Recovered from overflow',
      tokensBefore: 120000,
    });

    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    const persisted = JSON.parse(lines.at(-1) as string) as {
      type: string;
      firstKeptEntryId?: string;
    };

    expect(persisted.firstKeptEntryId).toBe('session-overflow-append-fallback-assistant-1');
  });

  it('removes deleted session files from the cache and persistent index', async () => {
    const sessionsDir = createTempSessionsDir();
    const indexFile = configureSessionEnv(sessionsDir);

    const filePath = writeSessionFile({
      sessionsDir,
      sessionId: 'session-3',
      title: 'To be deleted',
    });

    expect(listSessions()).toHaveLength(1);

    unlinkSync(filePath);

    expect(listSessions()).toEqual([]);
    expect(readSessionBlocks('session-3')).toBeNull();
    await flushSessionIndexWrite();
    expect(readFileSync(indexFile, 'utf-8')).toContain('"entries":[]');
  });

  it('preserves tool result details on parsed tool blocks', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'assistant-1',
        timestamp: '2026-03-12T16:00:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              id: 'tool-1',
              name: 'artifact',
              arguments: { action: 'save', title: 'Counter demo', kind: 'html' },
            },
          ],
        },
      },
      {
        id: 'tool-result-1',
        timestamp: '2026-03-12T16:00:01.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-1',
          toolName: 'artifact',
          content: [{ type: 'text', text: 'Saved artifact counter-demo [html] "Counter demo".' }],
          details: {
            action: 'save',
            conversationId: 'conv-123',
            artifactId: 'counter-demo',
            title: 'Counter demo',
            kind: 'html',
            revision: 1,
            openRequested: true,
          },
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        tool: 'artifact',
        output: 'Saved artifact counter-demo [html] "Counter demo".',
        details: expect.objectContaining({
          artifactId: 'counter-demo',
          revision: 1,
          openRequested: true,
        }),
      }),
    ]);
  });

  it('renders bash execution messages as terminal-style bash blocks', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'bash-1',
        timestamp: '2026-03-12T16:02:00.000Z',
        message: {
          role: 'bashExecution',
          command: 'git status --short',
          output: ' M src/index.ts',
          exitCode: 0,
          excludeFromContext: true,
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        tool: 'bash',
        input: { command: 'git status --short' },
        output: ' M src/index.ts',
        details: expect.objectContaining({
          displayMode: 'terminal',
          exitCode: 0,
          excludeFromContext: true,
        }),
      }),
    ]);
  });

  it('preserves execution wrapper annotations on persisted bash execution messages', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'bash-1',
        timestamp: '2026-03-12T16:02:00.000Z',
        message: {
          role: 'bashExecution',
          command: 'git status --short',
          output: ' M src/index.ts',
          details: {
            executionWrappers: [
              { id: 'shadowfax', label: 'Shadowfax' },
              { id: 'repo-guard', label: 'Repo Guard' },
            ],
          },
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'tool_use',
        tool: 'bash',
        details: expect.objectContaining({
          displayMode: 'terminal',
          executionWrappers: [
            { id: 'shadowfax', label: 'Shadowfax' },
            { id: 'repo-guard', label: 'Repo Guard' },
          ],
        }),
      }),
    ]);
  });

  it('surfaces assistant error messages as error blocks', () => {
    const blocks = buildDisplayBlocksFromEntries([
      {
        id: 'assistant-error',
        timestamp: '2026-03-12T16:05:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'Checking the provider response…' }],
          stopReason: 'error',
          errorMessage: 'Codex error: upstream overloaded',
        },
      },
    ]);

    expect(blocks).toEqual([
      {
        type: 'thinking',
        id: 'assistant-error-t0',
        ts: '2026-03-12T16:05:00.000Z',
        text: 'Checking the provider response…',
      },
      {
        type: 'error',
        id: 'assistant-error-e1',
        ts: '2026-03-12T16:05:00.000Z',
        message: 'Codex error: upstream overloaded',
      },
    ]);
  });
});
