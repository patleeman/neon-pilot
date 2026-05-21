import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const AGENT_PID = process.pid;

// Commands that can send signals to processes
const KILL_COMMANDS = ['kill', 'pkill', 'killall', 'killall5'];

// Process name patterns that represent the agent or its runtime
// Block pkill/killall against any of these
const PROTECTED_PATTERNS = [
  'neon-pilot',
  'Neon Pilot',
  'pi-coding-agent',
  'node', // the agent runs on node - too risky to let pkill node through
];

// Pattern to match our PID as a standalone number in the command
// Handles: kill 12345, kill -9 12345, kill -TERM 12345, kill -SIGKILL 12345
function targetsPid(command: string, pid: number): boolean {
  const pidStr = String(pid);
  // Match PID as a standalone number (not part of another number)
  const pidPattern = new RegExp(`(?<![\\d])${pidStr}(?![\\d])`);
  return pidPattern.test(command);
}

// Extract the base command name from a command string
function getBaseCommand(command: string): string | null {
  const trimmed = command.trim();
  // Skip sudo
  const withoutSudo = trimmed.replace(/^sudo\s+/, '');
  // Get first token
  const firstToken = withoutSudo.split(/\s+/)[0];
  if (!firstToken) return null;
  // Get basename (handle /bin/kill, /usr/bin/kill, etc.)
  const basename = firstToken.split('/').pop() || firstToken;
  return basename;
}

// Check if a command is a kill-family command targeting our PID or protected processes
function isSelfKillAttempt(command: string): { blocked: boolean; reason?: string } {
  const baseCommand = getBaseCommand(command);
  if (!baseCommand || !KILL_COMMANDS.includes(baseCommand)) {
    return { blocked: false };
  }

  const lowerCommand = command.toLowerCase();

  // For pkill and killall, check if the pattern/name matches any protected process
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

  // For kill command, check if it targets our PID
  if (baseCommand === 'kill' && targetsPid(command, AGENT_PID)) {
    return {
      blocked: true,
      reason: `Blocked kill targeting agent PID ${AGENT_PID}`,
    };
  }

  return { blocked: false };
}

export function createSelfPreservationAgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    pi.on('tool_call', async (event) => {
      // Only intercept bash tool calls
      if (event.toolName !== 'bash') return;

      const command = event.input?.command;
      if (typeof command !== 'string') return;

      const result = isSelfKillAttempt(command);
      if (result.blocked) {
        return {
          block: true,
          reason: result.reason,
        };
      }
    });
  };
}
