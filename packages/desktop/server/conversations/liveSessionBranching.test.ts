import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({
  managers: new Map<string, { getEntry: ReturnType<typeof vi.fn>; createBranchedSession: ReturnType<typeof vi.fn> }>(),
  SessionManager: {
    open: vi.fn((sessionFile: string) => agent.managers.get(sessionFile)),
  },
}));
const core = vi.hoisted(() => ({
  getPiAgentRuntimeDir: vi.fn(() => '/runtime/neon-pilot'),
}));
const sessions = vi.hoisted(() => ({
  appendChildConversationTopologyEntry: vi.fn(),
  appendConversationOffshootMetadata: vi.fn(),
  appendConversationWorkspaceMetadata: vi.fn(),
  appendParentConversationBacklinkEntry: vi.fn(),
  readSessionMetaByFile: vi.fn(() => ({ cwd: '/repo', workspaceCwd: '/workspace-repo' })),
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({ SessionManager: agent.SessionManager }));
vi.mock('@neon-pilot/core', () => core);
vi.mock('./conversationTranscriptOps.js', () => ({
  appendChildConversationTopologyEntry: sessions.appendChildConversationTopologyEntry,
  appendConversationOffshootMetadata: sessions.appendConversationOffshootMetadata,
  appendConversationWorkspaceMetadata: sessions.appendConversationWorkspaceMetadata,
  appendParentConversationBacklinkEntry: sessions.appendParentConversationBacklinkEntry,
  readConversationSessionMetaByFilePath: sessions.readSessionMetaByFile,
}));

import { branchLiveSession, forkLiveSession } from './liveSessionBranching.js';

describe('live session branching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.managers.clear();
    core.getPiAgentRuntimeDir.mockReturnValue('/runtime/neon-pilot');
    sessions.readSessionMetaByFile.mockReturnValue({ cwd: '/repo', workspaceCwd: '/workspace-repo' });
  });

  function manager(entry: unknown = { id: 'entry-1', parentId: 'parent-1' }, branchFile = '/sessions/branch.jsonl') {
    return { getEntry: vi.fn(() => entry), createBranchedSession: vi.fn(() => branchFile) };
  }

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 'source-id',
      cwd: '/repo',
      session: { sessionFile: '/sessions/source.jsonl', isStreaming: false, model: { id: 'model-1' }, thinkingLevel: 'high' },
      ...overrides,
    };
  }

  it('branches from an entry, writes offshoot metadata before resume, and writes source topology', async () => {
    const sourceManager = manager();
    agent.managers.set('/sessions/source.jsonl', sourceManager);
    const resumeSession = vi.fn(async () => ({ id: 'branch-id' }));

    await expect(branchLiveSession(entry() as never, 'entry-1', { model: 'm1' } as never, { resumeSession })).resolves.toEqual(
      expect.objectContaining({
        newSessionId: 'branch-id',
        sessionFile: '/sessions/branch.jsonl',
      }),
    );

    expect(agent.SessionManager.open).toHaveBeenCalledWith('/sessions/source.jsonl', undefined, '/repo');
    expect(sourceManager.getEntry).toHaveBeenCalledWith('entry-1');
    expect(sourceManager.createBranchedSession).toHaveBeenCalledWith('entry-1');
    expect(sessions.appendConversationOffshootMetadata).toHaveBeenCalledWith({
      sessionFile: '/sessions/branch.jsonl',
      kind: 'fork',
      parentSessionFile: '/sessions/source.jsonl',
      parentSessionId: 'source-id',
      parentMessageId: 'entry-1',
    });
    expect(sessions.appendParentConversationBacklinkEntry).toHaveBeenCalledWith({
      sessionFile: '/sessions/branch.jsonl',
      kind: 'fork',
      parentSessionFile: '/sessions/source.jsonl',
      parentSessionId: 'source-id',
      parentMessageId: 'entry-1',
    });
    expect(sessions.appendConversationWorkspaceMetadata).toHaveBeenCalledWith({
      sessionFile: '/sessions/branch.jsonl',
      cwd: '/repo',
      workspaceCwd: '/workspace-repo',
    });
    expect(resumeSession).toHaveBeenCalledWith('/sessions/branch.jsonl', { model: 'm1', cwdOverride: '/repo' });
    expect(sessions.appendChildConversationTopologyEntry).toHaveBeenCalledWith({
      parentSessionFile: '/sessions/source.jsonl',
      childSessionId: 'branch-id',
      kind: 'fork',
      parentMessageId: 'entry-1',
    });
  });

  it('validates branch source session, entry, and branch file', async () => {
    await expect(
      branchLiveSession(entry({ session: { sessionFile: '' } }) as never, 'entry-1', {} as never, { resumeSession: vi.fn() }),
    ).rejects.toThrow('Cannot branch a live session without a session file.');

    agent.managers.set('/sessions/source.jsonl', manager(null));
    await expect(branchLiveSession(entry() as never, 'missing', {} as never, { resumeSession: vi.fn() })).rejects.toThrow(
      'Session entry not found: missing',
    );

    agent.managers.set('/sessions/source.jsonl', manager({ id: 'entry-1' }, ''));
    await expect(branchLiveSession(entry() as never, 'entry-1', {} as never, { resumeSession: vi.fn() })).rejects.toThrow(
      'Unable to create a branched session file.',
    );
  });

  it('forks before a root entry by creating a fresh session with inherited defaults', async () => {
    agent.managers.set('/sessions/source.jsonl', manager({ id: 'root', parentId: undefined }));
    const callbacks = {
      createSession: vi.fn(async () => ({ id: 'created-id', sessionFile: '/sessions/created.jsonl' })),
      resumeSession: vi.fn(),
      destroySession: vi.fn(),
      resolveDefaultServiceTier: vi.fn(() => 'auto'),
    };

    await expect(forkLiveSession(entry() as never, 'root', { beforeEntry: true } as never, callbacks)).resolves.toEqual(
      expect.objectContaining({
        newSessionId: 'created-id',
        sessionFile: '/sessions/created.jsonl',
      }),
    );

    expect(callbacks.createSession).toHaveBeenCalledWith('/repo', {
      initialModel: 'model-1',
      initialThinkingLevel: 'high',
      initialServiceTier: 'auto',
    });
    expect(callbacks.destroySession).toHaveBeenCalledWith('source-id');
    expect(sessions.appendConversationOffshootMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ sessionFile: '/sessions/created.jsonl', kind: 'rewind' }),
    );
    expect(sessions.appendParentConversationBacklinkEntry).toHaveBeenCalledWith(
      expect.objectContaining({ sessionFile: '/sessions/created.jsonl', kind: 'rewind', parentMessageId: 'root' }),
    );
    expect(sessions.appendConversationWorkspaceMetadata).toHaveBeenCalledWith({
      sessionFile: '/sessions/created.jsonl',
      cwd: '/repo',
      workspaceCwd: '/workspace-repo',
    });
    expect(sessions.appendChildConversationTopologyEntry).not.toHaveBeenCalled();
  });

  it('keeps forked neutral chat conversations in the Chats group when source metadata lacks workspaceCwd', async () => {
    sessions.readSessionMetaByFile.mockReturnValue({ cwd: '/runtime/neon-pilot/chat-workspaces/chat-123' });
    const sourceManager = manager();
    agent.managers.set('/sessions/source.jsonl', sourceManager);
    const resumeSession = vi.fn(async () => ({ id: 'branch-id' }));

    await branchLiveSession(entry({ cwd: '/runtime/neon-pilot/chat-workspaces/chat-123' }) as never, 'entry-1', { model: 'm1' } as never, {
      resumeSession,
    });

    expect(sessions.appendConversationWorkspaceMetadata).toHaveBeenCalledWith({
      sessionFile: '/sessions/branch.jsonl',
      cwd: '/runtime/neon-pilot/chat-workspaces/chat-123',
      workspaceCwd: null,
    });
  });

  it('forks/rewinds via branched session file, optionally preserving source and topology', async () => {
    agent.managers.set('/sessions/source.jsonl', manager({ id: 'entry-1', parentId: 'parent-1' }, '/sessions/forked.jsonl'));
    const callbacks = {
      createSession: vi.fn(),
      resumeSession: vi.fn(async () => ({ id: 'forked-id' })),
      destroySession: vi.fn(),
      resolveDefaultServiceTier: vi.fn(),
    };

    await expect(
      forkLiveSession(
        entry() as never,
        'entry-1',
        { beforeEntry: true, preserveSource: true, initialModel: 'explicit' } as never,
        callbacks,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        newSessionId: 'forked-id',
        sessionFile: '/sessions/forked.jsonl',
      }),
    );

    const sourceManager = agent.managers.get('/sessions/source.jsonl')!;
    expect(sourceManager.createBranchedSession).toHaveBeenCalledWith('parent-1');
    expect(sessions.appendConversationOffshootMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rewind', parentMessageId: 'entry-1' }),
    );
    expect(sessions.appendParentConversationBacklinkEntry).toHaveBeenCalledWith(
      expect.objectContaining({ sessionFile: '/sessions/forked.jsonl', kind: 'rewind', parentMessageId: 'entry-1' }),
    );
    expect(callbacks.resumeSession).toHaveBeenCalledWith('/sessions/forked.jsonl', { initialModel: 'explicit', cwdOverride: '/repo' });
    expect(sessions.appendChildConversationTopologyEntry).toHaveBeenCalledWith({
      parentSessionFile: '/sessions/source.jsonl',
      childSessionId: 'forked-id',
      kind: 'rewind',
      parentMessageId: 'entry-1',
    });
    expect(callbacks.destroySession).not.toHaveBeenCalled();
  });

  it('uses explicit branch kind for user-message forks before an entry', async () => {
    agent.managers.set('/sessions/source.jsonl', manager({ id: 'entry-2', parentId: 'entry-1' }, '/sessions/forked.jsonl'));
    const callbacks = {
      createSession: vi.fn(),
      resumeSession: vi.fn(async () => ({ id: 'forked-id' })),
      destroySession: vi.fn(),
      resolveDefaultServiceTier: vi.fn(),
    };

    await forkLiveSession(entry() as never, 'entry-2', { beforeEntry: true, preserveSource: true, branchKind: 'fork' } as never, callbacks);

    expect(sessions.appendConversationOffshootMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ sessionFile: '/sessions/forked.jsonl', kind: 'fork', parentMessageId: 'entry-2' }),
    );
    expect(sessions.appendParentConversationBacklinkEntry).toHaveBeenCalledWith(
      expect.objectContaining({ sessionFile: '/sessions/forked.jsonl', kind: 'fork', parentMessageId: 'entry-2' }),
    );
    expect(sessions.appendChildConversationTopologyEntry).toHaveBeenCalledWith({
      parentSessionFile: '/sessions/source.jsonl',
      childSessionId: 'forked-id',
      kind: 'fork',
      parentMessageId: 'entry-2',
    });
  });

  it('prevents replacing streaming sources and validates fork source state', async () => {
    const callbacks = { createSession: vi.fn(), resumeSession: vi.fn(), destroySession: vi.fn(), resolveDefaultServiceTier: vi.fn() };
    await expect(
      forkLiveSession(
        entry({ session: { sessionFile: '/sessions/source.jsonl', isStreaming: true } }) as never,
        'entry-1',
        {} as never,
        callbacks,
      ),
    ).rejects.toThrow('Cannot replace a running conversation while forking. Keep the source conversation open instead.');
    await expect(
      forkLiveSession(entry({ session: { sessionFile: '' } }) as never, 'entry-1', { preserveSource: true } as never, callbacks),
    ).rejects.toThrow('Cannot fork a live session without a session file.');
    agent.managers.set('/sessions/source.jsonl', manager(null));
    await expect(forkLiveSession(entry() as never, 'missing', { preserveSource: true } as never, callbacks)).rejects.toThrow(
      'Session entry not found: missing',
    );
  });
});
