import { beforeEach, describe, expect, it, vi } from 'vitest';

const daemon = vi.hoisted(() => ({
  ensureAutomationThread: vi.fn(),
  normalizeAutomationThreadModeForSelection: vi.fn((mode) => (mode === 'none' || mode === 'existing' ? mode : 'dedicated')),
  resolveAutomationThreadTitle: vi.fn(),
  setStoredAutomationThreadBinding: vi.fn(),
}));
const conversationService = vi.hoisted(() => ({
  readConversationSessionMeta: vi.fn(),
  readConversationSessionMetaByFile: vi.fn(),
  resolveConversationSessionFile: vi.fn(),
}));

vi.mock('@neon-pilot/daemon', () => daemon);
vi.mock('../conversations/conversationService.js', () => conversationService);

import {
  applyScheduledTaskThreadBinding,
  buildScheduledTaskThreadDetail,
  resolveScheduledTaskThreadBinding,
} from './scheduledTaskThreads.js';

describe('scheduledTaskThreads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationService.resolveConversationSessionFile.mockReturnValue('/session.json');
    conversationService.readConversationSessionMeta.mockReturnValue({ title: 'Planning', cwd: '/repo' });
    conversationService.readConversationSessionMetaByFile.mockReturnValue({ title: 'Explicit thread', cwd: '/repo' });
    daemon.resolveAutomationThreadTitle.mockReturnValue('Dedicated thread');
  });

  it('rejects none mode and resolves dedicated mode without requiring conversation state', () => {
    expect(() => resolveScheduledTaskThreadBinding({ threadMode: 'none' })).toThrow('Automations require an owner thread.');
    expect(resolveScheduledTaskThreadBinding({ threadMode: 'dedicated' })).toEqual({ mode: 'dedicated' });
    expect(conversationService.resolveConversationSessionFile).not.toHaveBeenCalled();
  });

  it('resolves existing thread bindings and validates cwd compatibility', () => {
    expect(resolveScheduledTaskThreadBinding({ threadMode: 'existing', threadConversationId: ' conv-1 ', cwd: '/repo' })).toEqual({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
    });
    expect(conversationService.resolveConversationSessionFile).toHaveBeenCalledWith('conv-1');

    expect(
      resolveScheduledTaskThreadBinding({ threadMode: 'existing', threadConversationId: 'conv-1', threadSessionFile: ' /explicit.json ' }),
    ).toEqual({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/explicit.json',
    });
    expect(conversationService.readConversationSessionMetaByFile).toHaveBeenCalledWith('/explicit.json');
  });

  it('uses explicit session files without requiring conversation service lookup', () => {
    conversationService.resolveConversationSessionFile.mockImplementation(() => {
      throw new Error('conversation lookup should not be used');
    });
    conversationService.readConversationSessionMeta.mockImplementation(() => {
      throw new Error('conversation metadata should not be used');
    });

    expect(
      resolveScheduledTaskThreadBinding({
        threadMode: 'existing',
        threadConversationId: 'conv-1',
        threadSessionFile: ' /explicit.json ',
        cwd: '/repo',
      }),
    ).toEqual({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/explicit.json',
    });
  });

  it('rejects invalid existing thread selections', () => {
    expect(() => resolveScheduledTaskThreadBinding({ threadMode: 'existing' })).toThrow('Choose an existing thread.');
    conversationService.resolveConversationSessionFile.mockReturnValueOnce(undefined);
    expect(() => resolveScheduledTaskThreadBinding({ threadMode: 'existing', threadConversationId: 'missing' })).toThrow(
      'Selected thread was not found.',
    );
    conversationService.readConversationSessionMeta.mockReturnValueOnce({ cwd: '/other' });
    expect(() => resolveScheduledTaskThreadBinding({ threadMode: 'existing', threadConversationId: 'conv-1', cwd: '/repo' })).toThrow(
      'Selected thread must use the same working directory as the automation.',
    );
  });

  it('applies thread bindings through daemon storage and ensures owner threads', () => {
    daemon.setStoredAutomationThreadBinding.mockReturnValueOnce({ id: 'task-1', threadMode: 'existing' });
    daemon.ensureAutomationThread.mockReturnValueOnce({ id: 'task-1', threadMode: 'existing', threadConversationId: 'conv-1' });

    expect(applyScheduledTaskThreadBinding('task-1', { threadMode: 'existing', threadConversationId: 'conv-1', dbPath: '/db' })).toEqual({
      id: 'task-1',
      threadMode: 'existing',
      threadConversationId: 'conv-1',
    });
    expect(daemon.setStoredAutomationThreadBinding).toHaveBeenCalledWith('task-1', {
      dbPath: '/db',
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
    });
    expect(daemon.ensureAutomationThread).toHaveBeenCalledWith('task-1', { dbPath: '/db' });

    expect(() => applyScheduledTaskThreadBinding('task-1', { threadMode: 'none' })).toThrow('Automations require an owner thread.');
  });

  it('builds thread details from conversation metadata or daemon title fallback', () => {
    expect(
      buildScheduledTaskThreadDetail({ threadMode: 'existing', threadConversationId: 'conv-1' } as never, { profile: 'shared' }),
    ).toEqual({
      threadMode: 'existing',
      threadConversationId: 'conv-1',
      threadTitle: 'Planning',
    });
    expect(conversationService.readConversationSessionMeta).toHaveBeenCalledWith('conv-1', { profile: 'shared' });
    conversationService.readConversationSessionMeta.mockReturnValueOnce(undefined);
    expect(buildScheduledTaskThreadDetail({ threadMode: 'dedicated' } as never)).toEqual({
      threadMode: 'dedicated',
      threadTitle: 'Dedicated thread',
    });
  });
});
