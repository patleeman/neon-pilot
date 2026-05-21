import { describe, expect, it } from 'vitest';

// We need to test the pure logic functions, so let's re-implement them here
// or import them. Since the extension uses process.pid, we'll mock that.

const AGENT_PID = 12345; // Fake PID for testing

const KILL_COMMANDS = ['kill', 'pkill', 'killall', 'killall5'];

const PROTECTED_PATTERNS = ['neon-pilot', 'Neon Pilot', 'pi-coding-agent', 'node'];

function targetsPid(command: string, pid: number): boolean {
  const pidStr = String(pid);
  const pidPattern = new RegExp(`(?<![\\d])${pidStr}(?![\\d])`);
  return pidPattern.test(command);
}

function getBaseCommand(command: string): string | null {
  const trimmed = command.trim();
  const withoutSudo = trimmed.replace(/^sudo\s+/, '');
  const firstToken = withoutSudo.split(/\s+/)[0];
  if (!firstToken) return null;
  const basename = firstToken.split('/').pop() || firstToken;
  return basename;
}

function isSelfKillAttempt(command: string): {
  blocked: boolean;
  reason?: string;
} {
  const baseCommand = getBaseCommand(command);
  if (!baseCommand || !KILL_COMMANDS.includes(baseCommand)) {
    return { blocked: false };
  }

  const lowerCommand = command.toLowerCase();

  if (baseCommand === 'pkill' || baseCommand === 'killall' || baseCommand === 'killall5') {
    for (const pattern of PROTECTED_PATTERNS) {
      if (lowerCommand.includes(pattern.toLowerCase())) {
        return {
          blocked: true,
          reason: `Blocked ${baseCommand} targeting protected process pattern "${pattern}"`,
        };
      }
    }
    return { blocked: false };
  }

  if (baseCommand === 'kill' && targetsPid(command, AGENT_PID)) {
    return {
      blocked: true,
      reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
    };
  }

  return { blocked: false };
}

type ToolCallHandler = (event: {
  toolName: string;
  input: Record<string, unknown>;
}) => Promise<{ block: boolean; reason: string } | undefined>;

interface MockPi {
  on: (event: string, handler: ToolCallHandler) => void;
}

describe('self-preservation', () => {
  describe('kill command with PID', () => {
    it('blocks kill with agent PID', () => {
      expect(isSelfKillAttempt(`kill ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('blocks kill -9 with agent PID', () => {
      expect(isSelfKillAttempt(`kill -9 ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('blocks kill -SIGTERM with agent PID', () => {
      expect(isSelfKillAttempt(`kill -SIGTERM ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('blocks kill -TERM with agent PID', () => {
      expect(isSelfKillAttempt(`kill -TERM ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('blocks sudo kill with agent PID', () => {
      expect(isSelfKillAttempt(`sudo kill -9 ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('blocks /bin/kill with agent PID', () => {
      expect(isSelfKillAttempt(`/bin/kill ${AGENT_PID}`)).toEqual({
        blocked: true,
        reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
      });
    });

    it('allows kill with different PID', () => {
      expect(isSelfKillAttempt('kill 99999')).toEqual({ blocked: false });
    });

    it('allows kill -9 with different PID', () => {
      expect(isSelfKillAttempt('kill -9 99999')).toEqual({ blocked: false });
    });

    it('allows kill with job control ID', () => {
      expect(isSelfKillAttempt('kill %1')).toEqual({ blocked: false });
    });

    it('does not confuse agent PID embedded in larger number', () => {
      expect(isSelfKillAttempt(`kill 1${AGENT_PID}9`)).toEqual({
        blocked: false,
      });
      expect(isSelfKillAttempt(`kill ${AGENT_PID}9`)).toEqual({
        blocked: false,
      });
      expect(isSelfKillAttempt(`kill 1${AGENT_PID}`)).toEqual({
        blocked: false,
      });
    });
  });

  describe('pkill command', () => {
    it('blocks pkill neon-pilot', () => {
      const result = isSelfKillAttempt('pkill neon-pilot');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('neon-pilot');
    });

    it('blocks pkill -f neon-pilot', () => {
      const result = isSelfKillAttempt('pkill -f neon-pilot');
      expect(result.blocked).toBe(true);
    });

    it('blocks pkill Neon Pilot (case insensitive)', () => {
      const result = isSelfKillAttempt('pkill "Neon Pilot"');
      expect(result.blocked).toBe(true);
    });

    it('blocks pkill neon-pilot-rc', () => {
      const result = isSelfKillAttempt('pkill neon-pilot-rc');
      expect(result.blocked).toBe(true);
    });

    it('blocks pkill node', () => {
      const result = isSelfKillAttempt('pkill node');
      expect(result.blocked).toBe(true);
    });

    it('blocks pkill pi-coding-agent', () => {
      const result = isSelfKillAttempt('pkill pi-coding-agent');
      expect(result.blocked).toBe(true);
    });

    it('allows pkill with unrelated pattern', () => {
      expect(isSelfKillAttempt('pkill nginx')).toEqual({ blocked: false });
    });

    it('allows pkill with unrelated process', () => {
      expect(isSelfKillAttempt('pkill -f "some other process"')).toEqual({
        blocked: false,
      });
    });
  });

  describe('killall command', () => {
    it('blocks killall neon-pilot', () => {
      const result = isSelfKillAttempt('killall neon-pilot');
      expect(result.blocked).toBe(true);
    });

    it('blocks killall Neon Pilot', () => {
      const result = isSelfKillAttempt('killall "Neon Pilot"');
      expect(result.blocked).toBe(true);
    });

    it('blocks killall node', () => {
      const result = isSelfKillAttempt('killall node');
      expect(result.blocked).toBe(true);
    });

    it('allows killall with unrelated process', () => {
      expect(isSelfKillAttempt('killall nginx')).toEqual({ blocked: false });
    });
  });

  describe('killall5 command', () => {
    it('blocks killall5 neon-pilot', () => {
      const result = isSelfKillAttempt('killall5 neon-pilot');
      expect(result.blocked).toBe(true);
    });
  });

  describe('non-kill commands', () => {
    it('allows normal bash commands', () => {
      expect(isSelfKillAttempt('ls -la')).toEqual({ blocked: false });
    });

    it('allows echo with kill-like strings', () => {
      expect(isSelfKillAttempt('echo "kill 123"')).toEqual({ blocked: false });
    });

    it('allows grep for kill', () => {
      expect(isSelfKillAttempt('grep kill /var/log/syslog')).toEqual({
        blocked: false,
      });
    });

    it('allows ps aux | grep kill', () => {
      expect(isSelfKillAttempt('ps aux | grep kill')).toEqual({
        blocked: false,
      });
    });
  });
});

describe('agent extension hook', () => {
  it('registers tool_call handler', async () => {
    const handlers: Record<string, ToolCallHandler> = {};
    const mockPi: MockPi = {
      on: (event: string, handler: ToolCallHandler) => {
        handlers[event] = handler;
      },
    };

    const { createSelfPreservationAgentExtension } = await import('./backend.js');
    const ext = createSelfPreservationAgentExtension();
    ext(mockPi as unknown as Parameters<typeof ext>[0]);

    expect(handlers['tool_call']).toBeDefined();
  });

  it('blocks bash tool with kill command targeting agent PID', async () => {
    const handlers: Record<string, ToolCallHandler> = {};
    const mockPi: MockPi = {
      on: (event: string, handler: ToolCallHandler) => {
        handlers[event] = handler;
      },
    };

    const { createSelfPreservationAgentExtension } = await import('./backend.js');
    const ext = createSelfPreservationAgentExtension();
    ext(mockPi as unknown as Parameters<typeof ext>[0]);

    const handler = handlers['tool_call'];
    const result = await handler({
      toolName: 'bash',
      input: { command: `kill ${process.pid}` },
    });

    expect(result).toEqual({
      block: true,
      reason: `Blocked kill targeting agent PID ${process.pid}`,
    });
  });

  it('allows bash tool with non-kill command', async () => {
    const handlers: Record<string, ToolCallHandler> = {};
    const mockPi: MockPi = {
      on: (event: string, handler: ToolCallHandler) => {
        handlers[event] = handler;
      },
    };

    const { createSelfPreservationAgentExtension } = await import('./backend.js');
    const ext = createSelfPreservationAgentExtension();
    ext(mockPi as unknown as Parameters<typeof ext>[0]);

    const handler = handlers['tool_call'];
    const result = await handler({
      toolName: 'bash',
      input: { command: 'ls -la' },
    });

    expect(result).toBeUndefined();
  });

  it('ignores non-bash tools', async () => {
    const handlers: Record<string, ToolCallHandler> = {};
    const mockPi: MockPi = {
      on: (event: string, handler: ToolCallHandler) => {
        handlers[event] = handler;
      },
    };

    const { createSelfPreservationAgentExtension } = await import('./backend.js');
    const ext = createSelfPreservationAgentExtension();
    ext(mockPi as unknown as Parameters<typeof ext>[0]);

    const handler = handlers['tool_call'];
    const result = await handler({
      toolName: 'read',
      input: { path: '/etc/passwd' },
    });

    expect(result).toBeUndefined();
  });
});
