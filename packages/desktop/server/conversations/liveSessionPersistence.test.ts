import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ appendFileSync: vi.fn(), existsSync: vi.fn(() => true) }));
vi.mock('node:fs', () => fs);

import { ensureSessionFileExists, patchSessionManagerPersistence, resolveLiveSessionFile } from './liveSessionPersistence.js';

describe('live session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
  });

  it('patches session manager persistence to rewrite first and append later entries', () => {
    const manager = { persist: true, sessionFile: '/sessions/s1.jsonl', flushed: false, _rewriteFile: vi.fn() } as never;
    patchSessionManagerPersistence(manager);

    manager._persist({ type: 'first' });
    manager._persist({ type: 'second' });

    expect(manager._rewriteFile).toHaveBeenCalledOnce();
    expect(fs.appendFileSync).toHaveBeenCalledWith('/sessions/s1.jsonl', '{"type":"second"}\n');
  });

  it('does not patch managers twice or managers without rewrite support', () => {
    const manager = { persist: true, sessionFile: '/sessions/s1.jsonl', flushed: true, _rewriteFile: vi.fn() } as never;
    patchSessionManagerPersistence(manager);
    const persist = manager._persist;
    patchSessionManagerPersistence(manager);
    expect(manager._persist).toBe(persist);

    const unsupported = {} as never;
    patchSessionManagerPersistence(unsupported);
    expect(unsupported._persist).toBeUndefined();
  });

  it('patched persist skips when persistence is disabled or session file is missing', () => {
    const manager = { persist: false, sessionFile: '/sessions/s1.jsonl', flushed: true, _rewriteFile: vi.fn() } as never;
    patchSessionManagerPersistence(manager);
    manager._persist({ type: 'skip' });

    manager.persist = true;
    manager.sessionFile = '';
    manager._persist({ type: 'skip' });

    expect(manager._rewriteFile).not.toHaveBeenCalled();
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('rewrites when patched persist sees a missing existing file despite flushed state', () => {
    fs.existsSync.mockReturnValueOnce(false);
    const manager = { persist: true, sessionFile: '/sessions/s1.jsonl', flushed: true, _rewriteFile: vi.fn() } as never;
    patchSessionManagerPersistence(manager);
    manager._persist({ type: 'rewrite' });

    expect(manager._rewriteFile).toHaveBeenCalledOnce();
    expect(manager.flushed).toBe(true);
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('ensures persisted session files only when needed', () => {
    const manager = { persist: true, sessionFile: '/sessions/s1.jsonl', flushed: false, _rewriteFile: vi.fn() };
    ensureSessionFileExists(manager as never);
    expect(manager._rewriteFile).toHaveBeenCalledOnce();
    expect(manager.flushed).toBe(true);

    ensureSessionFileExists(manager as never);
    expect(manager._rewriteFile).toHaveBeenCalledOnce();

    const disabled = { persist: false, sessionFile: '/sessions/s2.jsonl', flushed: false, _rewriteFile: vi.fn() };
    ensureSessionFileExists(disabled as never);
    expect(disabled._rewriteFile).not.toHaveBeenCalled();
  });

  it('resolves manager session files before session fallback and can ensure persistence first', () => {
    const manager = {
      persist: true,
      sessionFile: '/sessions/manager.jsonl',
      flushed: false,
      _rewriteFile: vi.fn(),
      getSessionFile: vi.fn(() => ' /sessions/manager.jsonl '),
    };

    expect(
      resolveLiveSessionFile({ sessionFile: ' /sessions/fallback.jsonl ', sessionManager: manager } as never, { ensurePersisted: true }),
    ).toBe('/sessions/manager.jsonl');
    expect(manager._rewriteFile).toHaveBeenCalledOnce();

    expect(
      resolveLiveSessionFile({ sessionFile: ' /sessions/fallback.jsonl ', sessionManager: { getSessionFile: vi.fn(() => '  ') } } as never),
    ).toBe('/sessions/fallback.jsonl');
    expect(resolveLiveSessionFile({ sessionFile: '   ' } as never)).toBeUndefined();
  });
});
