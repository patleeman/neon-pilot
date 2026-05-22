import { beforeEach, describe, expect, it, vi } from 'vitest';

const crypto = vi.hoisted(() => ({ randomUUID: vi.fn(() => 'new-session-id') }));
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  copied: [] as Array<[string, string]>,
  madeDirs: [] as string[],
  copyFileSync: vi.fn((from: string, to: string) => {
    fs.copied.push([from, to]);
    fs.files.set(to, fs.files.get(from) ?? '');
  }),
  existsSync: vi.fn((path: string) => fs.files.has(path)),
  mkdirSync: vi.fn((path: string) => fs.madeDirs.push(path)),
  readFileSync: vi.fn((path: string) => fs.files.get(path) ?? ''),
  writeFileSync: vi.fn((path: string, content: string) => fs.files.set(path, content)),
}));
const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn(() => '/durable/sessions'), getStateRoot: vi.fn(() => '/state') }));
const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn() }));
const sessions = vi.hoisted(() => ({
  clearSessionCaches: vi.fn(),
  listSessions: vi.fn(() => []),
  readSessionMeta: vi.fn(() => null as null | { id: string; title: string; file: string }),
}));

vi.mock('node:crypto', () => crypto);
vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/core', () => core);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('./sessions.js', () => sessions);

import { exportConversationSession, importConversationSession } from './sessionExchange.js';

describe('conversation session exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.files.clear();
    fs.copied.length = 0;
    fs.madeDirs.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:34:56.789Z'));
  });

  it('exports a conversation session using sanitized title, id, and timestamp', () => {
    sessions.readSessionMeta.mockReturnValueOnce({ id: 'conv-1', title: 'My / Session: Title!', file: '/sessions/conv-1.jsonl' });
    fs.files.set('/sessions/conv-1.jsonl', '{"type":"session","id":"conv-1"}\n');

    expect(exportConversationSession({ conversationId: ' conv-1 ' })).toEqual({
      ok: true,
      conversationId: 'conv-1',
      exportPath: '/state/exports/sessions/My-Session-Title-conv-1-2026-05-22T12-34-56-789Z.jsonl',
    });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/state/exports/sessions', { recursive: true });
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/sessions/conv-1.jsonl',
      '/state/exports/sessions/My-Session-Title-conv-1-2026-05-22T12-34-56-789Z.jsonl',
    );
  });

  it('validates export input and missing conversations', () => {
    expect(() => exportConversationSession({ conversationId: '   ' })).toThrow('Conversation id is required.');
    expect(() => exportConversationSession({ conversationId: 'missing' })).toThrow('Conversation missing not found.');
  });

  it('imports a new .jsonl session into a cwd-derived durable sessions directory', () => {
    fs.files.set('/imports/session.jsonl', '{"type":"session","id":"conv-1","cwd":"/Users/patrick/repo"}\n{"role":"user"}\n');

    expect(importConversationSession({ filePath: ' /imports/session.jsonl ' })).toEqual({
      ok: true,
      conversationId: 'conv-1',
      sessionFile: '/durable/sessions/--Users-patrick-repo--/session.jsonl',
      importedAsNewId: false,
    });
    expect(fs.copyFileSync).toHaveBeenCalledWith('/imports/session.jsonl', '/durable/sessions/--Users-patrick-repo--/session.jsonl');
    expect(sessions.clearSessionCaches).toHaveBeenCalledTimes(2);
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
  });

  it('rewrites imported session ids when the original id already exists and avoids destination collisions', () => {
    sessions.listSessions.mockReturnValueOnce([{ id: 'conv-1' }]);
    fs.files.set('/imports/session.jsonl', '{"type":"session","id":"conv-1","cwd":"/repo"}\n{"role":"user"}\n');
    fs.files.set('/durable/sessions/--repo--/session.jsonl', 'existing');

    expect(importConversationSession({ filePath: '/imports/session.jsonl' })).toEqual({
      ok: true,
      conversationId: 'new-session-id',
      sessionFile: '/durable/sessions/--repo--/session-2026-05-22T12-34-56-789Z.jsonl',
      importedAsNewId: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/durable/sessions/--repo--/session-2026-05-22T12-34-56-789Z.jsonl',
      '{"type":"session","id":"new-session-id","cwd":"/repo"}\n{"role":"user"}\n',
      'utf-8',
    );
  });

  it('validates import path, extension, and session header', () => {
    expect(() => importConversationSession({ filePath: '   ' })).toThrow('Session file path is required.');
    expect(() => importConversationSession({ filePath: '/missing.jsonl' })).toThrow('Session file does not exist: /missing.jsonl');
    fs.files.set('/imports/session.txt', '');
    expect(() => importConversationSession({ filePath: '/imports/session.txt' })).toThrow(
      'Session import currently expects a .jsonl session file.',
    );
    fs.files.set('/imports/empty.jsonl', '');
    expect(() => importConversationSession({ filePath: '/imports/empty.jsonl' })).toThrow('Session file is empty.');
    fs.files.set('/imports/bad-json.jsonl', 'not json\n');
    expect(() => importConversationSession({ filePath: '/imports/bad-json.jsonl' })).toThrow(
      'Session file does not start with valid JSON.',
    );
    fs.files.set('/imports/bad-header.jsonl', '{"type":"message","id":"conv-1"}\n');
    expect(() => importConversationSession({ filePath: '/imports/bad-header.jsonl' })).toThrow(
      'Session file must start with a session record.',
    );
  });
});
