import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgentBrowser } from './backend.js';

describe('system-agent-browser backend', () => {
  const exec = vi.fn();
  const ctx = { shell: { exec }, toolContext: { conversationId: 'conversation/1' } } as never;

  beforeEach(() => {
    exec.mockReset().mockResolvedValue({ stdout: 'ok\n', stderr: '', executionWrappers: [{ id: 'sandbox' }] });
  });

  it('runs agent-browser commands with native defaults, session, platform, headed, timeout, and signal', async () => {
    await expect(
      runAgentBrowser(
        { command: 'open', args: ['https://example.com'], session: 's1', headed: true, platform: 'chrome', timeoutSeconds: 2 },
        ctx,
      ),
    ).resolves.toEqual({
      content: [{ type: 'text', text: 'ok' }],
      details: {
        command: ['agent-browser', '--native', '--headed', '--session', 's1', '-p', 'chrome', 'open', 'https://example.com'],
        truncated: false,
        executionWrappers: [{ id: 'sandbox' }],
      },
    });
    expect(exec).toHaveBeenCalledWith({
      command: 'agent-browser',
      args: ['--native', '--headed', '--session', 's1', '-p', 'chrome', 'open', 'https://example.com'],
      timeoutMs: 2_000,
    });
  });

  it('omits native for non-navigation commands unless requested and clamps timeout', async () => {
    await runAgentBrowser({ command: 'click', native: true, timeoutSeconds: 999 }, ctx);

    expect(exec.mock.calls[0][0].args).toEqual(['--native', '--session', 'neon-pilot-conversation-1', 'click']);
    expect(exec.mock.calls[0][0].timeoutMs).toBe(300_000);
  });

  it('combines stdout and stderr, substitutes empty output, and truncates long output', async () => {
    exec.mockResolvedValueOnce({ stdout: 'out\n', stderr: 'err\n' });
    await expect(runAgentBrowser({ command: 'snapshot' }, ctx)).resolves.toMatchObject({ content: [{ text: 'out\nerr' }] });

    exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    await expect(runAgentBrowser({ command: 'snapshot' }, ctx)).resolves.toMatchObject({ content: [{ text: '(no output)' }] });

    exec.mockResolvedValueOnce({ stdout: 'x'.repeat(60_010), stderr: '' });
    const result = await runAgentBrowser({ command: 'snapshot' }, ctx);
    expect(result.details.truncated).toBe(true);
    expect(result.content[0].text).toContain('[Truncated: showing first 60000 of 60010 characters]');
  });

  it('returns tool errors when execution fails', async () => {
    exec.mockRejectedValue(new Error('boom'));

    await expect(runAgentBrowser({ command: 'snapshot' }, ctx)).resolves.toEqual({
      content: [{ type: 'text', text: 'boom' }],
      isError: true,
      details: { command: ['agent-browser', '--session', 'neon-pilot-conversation-1', 'snapshot'] },
    });
  });

  it('validates input shape and fields', async () => {
    await expect(runAgentBrowser(null, ctx)).rejects.toThrow('Input must be an object');
    await expect(runAgentBrowser({ command: '../bad' }, ctx)).rejects.toThrow('command must be a valid');
    await expect(runAgentBrowser({ command: 'open', args: [1] }, ctx)).rejects.toThrow('args must be an array of strings');
    await expect(runAgentBrowser({ command: 'open', session: 1 }, ctx)).rejects.toThrow('session must be a string');
    await expect(runAgentBrowser({ command: 'open', timeoutSeconds: 'x' }, ctx)).rejects.toThrow('timeoutSeconds must be a number');
  });
});
