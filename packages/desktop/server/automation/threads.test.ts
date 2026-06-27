import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn() }));
const sessionManagers = vi.hoisted(() => ({
  opened: new Map<string, unknown>(),
  create: vi.fn(),
  open: vi.fn(),
}));
const core = vi.hoisted(() => ({
  getDurableSessionsDir: vi.fn(),
  listStoredSessions: vi.fn(),
  resolveNeutralChatCwd: vi.fn(),
}));
const store = vi.hoisted(() => ({
  getStoredAutomation: vi.fn(),
  setStoredAutomationThreadBinding: vi.fn(),
}));

vi.mock('node:fs', () => fs);
vi.mock('@earendil-works/pi-coding-agent', () => ({
  SessionManager: { create: sessionManagers.create, open: sessionManagers.open },
}));
vi.mock('@neon-pilot/core', () => core);
vi.mock('./store.js', () => store);

import { ensureAutomationThread, normalizeAutomationThreadModeForSelection, resolveAutomationThreadTitle } from './threads.js';

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Task One',
    profile: 'shared',
    cwd: '/repo',
    threadMode: 'dedicated',
    ...overrides,
  };
}

function manager(overrides: Record<string, unknown> = {}) {
  return {
    getSessionId: vi.fn(() => 'conv-1'),
    getCwd: vi.fn(() => '/repo'),
    getSessionName: vi.fn(() => 'Automation: Task One'),
    appendSessionInfo: vi.fn(),
    getSessionFile: vi.fn(() => '/session.json'),
    _rewriteFile: vi.fn(),
    flushed: false,
    ...overrides,
  };
}

describe('automation threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    core.getDurableSessionsDir.mockReturnValue('/sessions');
    core.listStoredSessions.mockReturnValue([]);
    core.resolveNeutralChatCwd.mockReturnValue('/neutral/shared');
    store.setStoredAutomationThreadBinding.mockImplementation((_id, input) => ({
      ...task(),
      threadMode: input.mode,
      threadConversationId: input.conversationId,
      threadSessionFile: input.sessionFile,
    }));
  });

  it('normalizes thread mode selections and resolves display titles', () => {
    expect(normalizeAutomationThreadModeForSelection('none')).toBe('dedicated');
    expect(normalizeAutomationThreadModeForSelection('existing')).toBe('existing');
    expect(normalizeAutomationThreadModeForSelection('dedicated')).toBe('dedicated');
    expect(normalizeAutomationThreadModeForSelection('bad')).toBe('dedicated');
    expect(resolveAutomationThreadTitle({ id: 'task-1', title: 'Title', threadMode: 'dedicated' })).toBe('Automation: Title');
    expect(resolveAutomationThreadTitle({ id: 'task-1', title: ' ', threadMode: 'existing' })).toBe('Automation: task-1');
    expect(resolveAutomationThreadTitle({ id: 'task-1', title: 'Title', threadMode: 'none' })).toBe('Automation: Title');
  });

  it('rejects none-mode automations and errors for missing tasks', () => {
    const noneTask = task({ threadMode: 'none' });
    store.getStoredAutomation.mockReturnValueOnce(noneTask);
    expect(() => ensureAutomationThread('task-1')).toThrow('Automation @task-1 is missing an owner thread.');

    store.getStoredAutomation.mockReturnValueOnce(undefined);
    expect(() => ensureAutomationThread('missing')).toThrow('Automation not found: missing');
  });

  it('reuses a valid dedicated session and updates title or binding when needed', () => {
    const existing = task({ threadMode: 'dedicated', threadSessionFile: '/session.json', threadConversationId: 'old-conv' });
    const opened = manager({ getSessionId: vi.fn(() => 'conv-1'), getSessionName: vi.fn(() => 'Old title') });
    store.getStoredAutomation.mockReturnValue(existing);
    fs.existsSync.mockReturnValue(true);
    sessionManagers.open.mockReturnValue(opened);

    const result = ensureAutomationThread('task-1', { dbPath: '/db' });

    expect(opened.appendSessionInfo).toHaveBeenCalledWith('Automation: Task One');
    expect(opened._rewriteFile).toHaveBeenCalled();
    expect(opened.flushed).toBe(true);
    expect(store.setStoredAutomationThreadBinding).toHaveBeenCalledWith('task-1', {
      dbPath: '/db',
      mode: 'dedicated',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
    });
    expect(result).toMatchObject({ threadMode: 'dedicated', threadConversationId: 'conv-1' });
  });

  it('creates a dedicated session when no reusable session exists', () => {
    const created = manager({ getSessionId: vi.fn(() => 'new-conv'), getSessionFile: vi.fn(() => '/new-session.json') });
    store.getStoredAutomation.mockReturnValue(task({ cwd: undefined }));
    sessionManagers.create.mockReturnValue(created);

    const result = ensureAutomationThread('task-1', { stateRoot: '/state' });

    expect(core.resolveNeutralChatCwd).toHaveBeenCalledWith('shared', '/state');
    expect(sessionManagers.create).toHaveBeenCalledWith('/neutral/shared', '/sessions');
    expect(created.appendSessionInfo).toHaveBeenCalledWith('Automation: Task One');
    expect(result).toMatchObject({ threadConversationId: 'new-conv', threadSessionFile: '/new-session.json' });
  });

  it('resolves existing thread bindings from direct files or stored session ids', () => {
    const opened = manager({ getSessionId: vi.fn(() => 'direct-conv') });
    store.getStoredAutomation.mockReturnValue(
      task({ threadMode: 'existing', threadSessionFile: '/direct.json', threadConversationId: 'old' }),
    );
    fs.existsSync.mockReturnValue(true);
    sessionManagers.open.mockReturnValue(opened);

    expect(ensureAutomationThread('task-1')).toMatchObject({
      threadMode: 'existing',
      threadConversationId: 'direct-conv',
      threadSessionFile: '/direct.json',
    });

    fs.existsSync.mockReturnValue(false);
    core.listStoredSessions.mockReturnValue([{ id: 'conv-2', file: '/conv-2.json' }]);
    store.getStoredAutomation.mockReturnValue(task({ threadMode: 'existing', threadConversationId: 'conv-2' }));
    expect(ensureAutomationThread('task-1')).toMatchObject({
      threadMode: 'existing',
      threadConversationId: 'conv-2',
      threadSessionFile: '/conv-2.json',
    });
  });

  it('errors when an existing thread binding cannot be resolved', () => {
    store.getStoredAutomation.mockReturnValue(task({ threadMode: 'existing', threadConversationId: 'missing' }));
    expect(() => ensureAutomationThread('task-1')).toThrow('Automation @task-1 is bound to a missing thread.');
  });
});
