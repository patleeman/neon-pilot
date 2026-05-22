import { beforeEach, describe, expect, it, vi } from 'vitest';

const createScheduledTaskAgentExtension = vi.fn();

vi.mock('./scheduledTaskTool.js', () => ({ createScheduledTaskAgentExtension }));

const { scheduledTask } = await import('./scheduledTaskBackend.js');

describe('scheduledTask backend', () => {
  beforeEach(() => {
    createScheduledTaskAgentExtension.mockReset();
  });

  it('executes the registered scheduled task tool with conversation context and invalidates related UI topics', async () => {
    const execute = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Saved task.' }],
      details: { action: 'save', taskId: 'task-1' },
    });
    createScheduledTaskAgentExtension.mockImplementation(() => (pi: { registerTool(tool: unknown): void }) => {
      pi.registerTool({ execute });
    });
    const invalidate = vi.fn();

    await expect(
      scheduledTask(
        { action: 'save', taskId: 'task-1' },
        { toolContext: { conversationId: 'c1', sessionFile: '/session.json', cwd: '/repo' }, ui: { invalidate } },
      ),
    ).resolves.toEqual({ text: 'Saved task.', details: { action: 'save', taskId: 'task-1' } });

    expect(createScheduledTaskAgentExtension).toHaveBeenCalledWith({ getRuntimeScope: expect.any(Function) });
    expect(execute).toHaveBeenCalledWith(
      'extension-backend-scheduled-task',
      { action: 'save', taskId: 'task-1' },
      undefined,
      undefined,
      expect.objectContaining({ cwd: '/repo', sessionManager: expect.any(Object) }),
    );
    const executionContext = execute.mock.calls[0][4];
    expect(executionContext.sessionManager.getSessionId()).toBe('c1');
    expect(executionContext.sessionManager.getSessionFile()).toBe('/session.json');
    expect(executionContext.sessionManager.getCwd()).toBe('/repo');
    expect(invalidate).toHaveBeenCalledWith(['tasks', 'runs', 'sessions']);
  });

  it('falls back to sessionId when conversationId is absent', async () => {
    const execute = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Listed.' }] });
    createScheduledTaskAgentExtension.mockImplementation(() => (pi: { registerTool(tool: unknown): void }) => pi.registerTool({ execute }));

    await scheduledTask({ action: 'list' }, { toolContext: { sessionId: 'session-id' } });

    expect(execute.mock.calls[0][4].sessionManager.getSessionId()).toBe('session-id');
  });

  it('serializes non-text content and whole-result fallbacks', async () => {
    createScheduledTaskAgentExtension.mockImplementationOnce(
      () => (pi: { registerTool(tool: unknown): void }) =>
        pi.registerTool({ execute: vi.fn().mockResolvedValue({ content: [{ type: 'image', data: 'abc' }] }) }),
    );
    await expect(scheduledTask({ action: 'get' }, {})).resolves.toEqual({ text: '{"type":"image","data":"abc"}' });

    createScheduledTaskAgentExtension.mockImplementationOnce(
      () => (pi: { registerTool(tool: unknown): void }) => pi.registerTool({ execute: vi.fn().mockResolvedValue({ ok: true }) }),
    );
    await expect(scheduledTask({ action: 'get' }, {})).resolves.toEqual({ text: JSON.stringify({ ok: true }, null, 2) });
  });

  it('throws if the agent extension does not register an executable tool', async () => {
    createScheduledTaskAgentExtension.mockImplementation(() => (pi: { registerTool(tool: unknown): void }) => pi.registerTool({}));

    await expect(scheduledTask({ action: 'list' }, {})).rejects.toThrow('Scheduled task backend did not register an executable tool');
  });
});
