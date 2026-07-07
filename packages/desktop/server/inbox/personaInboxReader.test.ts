import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateAppTopicsMock, logErrorMock, logWarnMock, publishExtensionHostEventMock, currentLayout, currentStateRoot } = vi.hoisted(
  () => {
    const layoutRef: { current: ReturnType<typeof import('@neon-pilot/core').resolveDesktopRootLayout> | undefined } = {
      current: undefined,
    };
    const stateRef: { current: string } = { current: '/tmp/fallback' };
    return {
      invalidateAppTopicsMock: vi.fn(),
      logErrorMock: vi.fn(),
      logWarnMock: vi.fn(),
      publishExtensionHostEventMock: vi.fn(),
      currentLayout: layoutRef,
      currentStateRoot: stateRef,
    };
  },
);

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@neon-pilot/core')>();
  return {
    ...mod,
    getStateRoot: () => currentStateRoot.current,
    resolveDesktopRootLayout: ((options?: Parameters<typeof mod.resolveDesktopRootLayout>[0]) =>
      options ? mod.resolveDesktopRootLayout(options) : currentLayout.current) as typeof mod.resolveDesktopRootLayout,
  };
});

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
  logWarn: logWarnMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    publishEvent: publishExtensionHostEventMock,
  }),
}));

import { getDocumentsStore, resetDocumentsStoreSingleton } from '../documents/store.js';
import { writeInboxMessage } from './messages.js';
import { PersonaInboxReadValidationError, readPersonaInbox } from './personaInboxReader.js';

describe('readPersonaInbox', () => {
  let tmpDir: string;
  let layout: ReturnType<typeof resolveDesktopRootLayout>;

  function seedMessages(count: number): string[] {
    const store = getDocumentsStore(tmpDir, layout);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const kind = i % 2 === 0 ? 'note' : 'question';
      const doc = writeInboxMessage(store, {
        from: 'Persona',
        fromKind: 'persona',
        subject: `Message ${i + 1}`,
        body: `Body content for message ${i + 1}.`,
        kind,
      });
      ids.push(doc.id);
    }
    return ids;
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'persona-inbox-reader-test-'));
    layout = resolveDesktopRootLayout({ root: join(tmpDir, 'desktop-root') });

    currentStateRoot.current = tmpDir;
    currentLayout.current = layout;

    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    logWarnMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty when inbox has no messages', () => {
    const result = readPersonaInbox();
    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns unread, non-archived messages by default', () => {
    const ids = seedMessages(3);
    const store = getDocumentsStore(tmpDir, layout);

    const doc1 = store.getDocument('system-inbox', 'messages', ids[0]);
    if (doc1) {
      const body = doc1.body as Record<string, unknown>;
      body.read = true;
      store.putDocument('system-inbox', 'messages', ids[0], body);
    }

    const result = readPersonaInbox();
    expect(result.total).toBe(2);
    expect(result.messages).toHaveLength(2);
    expect(result.messages.find((m) => m.id === ids[0])).toBeUndefined();
  });

  it('excludes archived messages by default', () => {
    const ids = seedMessages(2);
    const store = getDocumentsStore(tmpDir, layout);
    const doc = store.getDocument('system-inbox', 'messages', ids[0]);
    if (doc) {
      store.putDocument('system-inbox', 'messages', ids[0], { ...(doc.body as Record<string, unknown>), archived: true });
    }

    const result = readPersonaInbox();
    expect(result.total).toBe(1);
    expect(result.messages.find((m) => m.id === ids[0])).toBeUndefined();
  });

  it('filters by kind', () => {
    seedMessages(4);
    const result = readPersonaInbox({ kind: 'question' });
    expect(result.total).toBeGreaterThanOrEqual(2);
    for (const msg of result.messages) {
      expect(msg.kind).toBe('question');
    }
  });

  it('returns answered-only messages', () => {
    const ids = seedMessages(4);
    const store = getDocumentsStore(tmpDir, layout);

    const doc2 = store.getDocument('system-inbox', 'messages', ids[1]);
    if (doc2) {
      const body = doc2.body as Record<string, unknown>;
      body.answer = { text: 'User said yes', answeredAt: new Date().toISOString() };
      store.putDocument('system-inbox', 'messages', ids[1], body);
    }

    const result = readPersonaInbox({ answeredOnly: true });
    expect(result.total).toBe(1);
    expect(result.messages[0]?.answer).toBe('User said yes');
  });

  it('respects limit parameter', () => {
    seedMessages(10);
    const result = readPersonaInbox({ limit: 3 });
    expect(result.messages).toHaveLength(3);
    expect(result.total).toBe(10);
  });

  it('marks messages as read when markRead is true', () => {
    const ids = seedMessages(3);
    const store = getDocumentsStore(tmpDir, layout);

    const result = readPersonaInbox({ markRead: true });

    expect(result.markedRead).toBe(3);
    for (const id of ids) {
      const doc = store.getDocument('system-inbox', 'messages', id);
      const body = doc?.body as { read?: boolean } | null;
      expect(body?.read).toBe(true);
    }
  });

  it('idempotent markRead: subsequent calls return empty and do not write activity', () => {
    seedMessages(3);

    const result1 = readPersonaInbox({ markRead: true });
    expect(result1.markedRead).toBe(3);

    invalidateAppTopicsMock.mockReset();
    publishExtensionHostEventMock.mockReset();

    const result2 = readPersonaInbox({ markRead: true });
    expect(result2.messages).toHaveLength(0);
    expect(result2.total).toBe(0);
    expect(result2.markedRead).toBe(0);
    expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
  });

  it('returns body and bodyPreview for each message', () => {
    seedMessages(1);
    const result = readPersonaInbox();
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.body).toContain('Body content for message 1');
    expect(result.messages[0]?.bodyPreview).toContain('Body content for message 1');
  });

  it('truncates bodyPreview for long bodies', () => {
    const store = getDocumentsStore(tmpDir, layout);
    writeInboxMessage(store, {
      from: 'Persona',
      fromKind: 'persona',
      subject: 'Long body',
      body: 'x'.repeat(500),
      kind: 'note',
    });

    const result = readPersonaInbox();
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.bodyPreview).toHaveLength(203);
    expect(result.messages[0]?.bodyPreview).toMatch(/\.\.\.$/);
  });

  it('returns subject, kind, from, fromKind for each message', () => {
    seedMessages(2);
    const result = readPersonaInbox();
    expect(result.messages).toHaveLength(2);
    for (const msg of result.messages) {
      expect(msg.subject).toBeTruthy();
      expect(msg.kind).toMatch(/^(note|question|result|alert)$/);
      expect(msg.from).toBeTruthy();
      expect(msg.fromKind).toBeTruthy();
    }
  });

  it('throws for invalid kind', () => {
    expect(() => readPersonaInbox({ kind: 'invalid-kind' })).toThrow(PersonaInboxReadValidationError);
    expect(() => readPersonaInbox({ kind: 'invalid-kind' })).toThrow('Kind must be one of');
  });

  it('throws for non-finite limit', () => {
    expect(() => readPersonaInbox({ limit: Number.NaN })).toThrow(PersonaInboxReadValidationError);
    expect(() => readPersonaInbox({ limit: Number.POSITIVE_INFINITY })).toThrow('Limit must be a finite number');
  });
});
