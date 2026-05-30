import { describe, expect, it, vi } from 'vitest';

const spawn = vi.fn();
vi.mock('node-pty', () => ({ spawn }));

const { resolveProcessLaunch } = await import('./processLauncher.js');
const { createPtyProcess } = await import('./ptyLauncher.js');

vi.mock('./processLauncher.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./processLauncher.js')>();
  return {
    ...actual,
    resolveProcessLaunch: vi.fn(actual.resolveProcessLaunch),
  };
});

interface MockPty {
  pid: number;
  onData: ReturnType<typeof vi.fn>;
  onExit: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
}

function createMockPty(overrides?: Partial<MockPty>): MockPty {
  return {
    pid: 999,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    ...overrides,
  };
}

describe('createPtyProcess', () => {
  beforeEach(() => {
    spawn.mockReset();
    vi.mocked(resolveProcessLaunch).mockClear();
  });

  it('spawns the shell via node-pty with default dimensions', () => {
    const mockPty = createMockPty({ pid: 456 });
    spawn.mockReturnValue(mockPty);

    const result = createPtyProcess({ command: '/bin/bash' });

    expect(spawn).toHaveBeenCalledWith(
      '/bin/bash',
      [],
      expect.objectContaining({
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
      }),
    );
    expect(result.pty.pid).toBe(456);
    expect(result.launch).toBeDefined();
  });

  it('passes args and custom dimensions to node-pty', () => {
    const mockPty = createMockPty({ pid: 789 });
    spawn.mockReturnValue(mockPty);

    createPtyProcess({
      command: '/bin/zsh',
      args: ['-c', 'echo hello'],
      cols: 120,
      rows: 40,
      cwd: '/workspace',
      env: { TERM: 'xterm-256color', PATH: '/usr/bin' },
    });

    expect(spawn).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-c', 'echo hello'],
      expect.objectContaining({
        cols: 120,
        rows: 40,
        cwd: '/workspace',
        env: expect.objectContaining({ TERM: 'xterm-256color', PATH: '/usr/bin' }),
      }),
    );
  });

  it('removes undefined env values before spawning node-pty', () => {
    const mockPty = createMockPty();
    spawn.mockReturnValue(mockPty);

    createPtyProcess({
      command: '/bin/zsh',
      env: { PATH: '/usr/bin', BROKEN: undefined },
    });

    expect(spawn).toHaveBeenCalledWith(
      '/bin/zsh',
      [],
      expect.objectContaining({
        env: expect.not.objectContaining({ BROKEN: expect.anything() }),
      }),
    );
  });

  it('resolves process launch through execution wrappers', () => {
    const mockPty = createMockPty({ pid: 111 });
    spawn.mockReturnValue(mockPty);

    createPtyProcess({ command: '/bin/bash', cwd: '/project' });

    expect(resolveProcessLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: '/bin/bash',
        cwd: '/project',
      }),
    );
  });

  it('uses SHELL env when available', () => {
    const originalShell = process.env.SHELL;
    process.env.SHELL = '/bin/zsh';
    const mockPty = createMockPty();
    spawn.mockReturnValue(mockPty);

    createPtyProcess({ command: '/bin/zsh' });

    expect(spawn).toHaveBeenCalledWith('/bin/zsh', [], expect.any(Object));
    process.env.SHELL = originalShell;
  });

  it('returns IPty-compatible handle with write, resize, kill, onData, onExit', () => {
    const mockPty = createMockPty({ pid: 333 });
    spawn.mockReturnValue(mockPty);

    const { pty } = createPtyProcess({ command: '/bin/bash' });

    // Should expose the full IPty interface
    expect(typeof pty.write).toBe('function');
    expect(typeof pty.resize).toBe('function');
    expect(typeof pty.kill).toBe('function');
    expect(typeof pty.onData).toBe('function');
    expect(typeof pty.onExit).toBe('function');
    expect(pty.pid).toBe(333);
  });
});
