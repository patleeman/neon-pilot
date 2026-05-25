import { describe, expect, it, vi } from 'vitest';

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport: vi.fn(async (specifier: string, name: string) => {
    if (specifier === '@neon-pilot/core' && name === 'getPiAgentRuntimeDir') return '/runtime/pi-agent';
    throw new Error(`Unexpected server module call: ${specifier}#${name}`);
  }),
}));

const { buildSessionContextForRuntime, getRuntimeDir } = await import('./runtime.js');

describe('backendApi runtime', () => {
  it('returns the Pi agent runtime directory from core', async () => {
    await expect(getRuntimeDir()).resolves.toBe('/runtime/pi-agent');
  });

  it('returns no messages when the leaf id is null or no entries exist', async () => {
    await expect(buildSessionContextForRuntime([{ id: 'm1', type: 'message', message: { role: 'user' } }], null)).resolves.toEqual({
      messages: [],
    });
    await expect(buildSessionContextForRuntime([], 'missing')).resolves.toEqual({ messages: [] });
  });

  it('builds message context by walking parent links from the selected leaf', async () => {
    const entries = [
      { id: 'root', type: 'message', message: { role: 'user', content: 'root' } },
      { id: 'tool', parentId: 'root', type: 'tool', message: { ignored: true } },
      { id: 'assistant', parentId: 'tool', type: 'message', message: { role: 'assistant', content: 'answer' } },
      { id: 'sibling', parentId: 'root', type: 'message', message: { role: 'assistant', content: 'other' } },
    ];

    await expect(buildSessionContextForRuntime(entries, 'assistant')).resolves.toEqual({
      messages: [
        { role: 'user', content: 'root' },
        { role: 'assistant', content: 'answer' },
      ],
    });
  });

  it('falls back to the last entry when the requested leaf id is missing', async () => {
    const entries = [
      { id: 'first', type: 'message', message: 'first' },
      { id: 'last', parentId: 'first', type: 'message', message: 'last' },
    ];

    await expect(buildSessionContextForRuntime(entries, 'missing')).resolves.toEqual({ messages: ['first', 'last'] });
  });

  it('skips entries without message payloads', async () => {
    const entries = [
      { id: 'first', type: 'message' },
      { id: 'last', parentId: 'first', type: 'message', message: 'last' },
    ];

    await expect(buildSessionContextForRuntime(entries, 'last')).resolves.toEqual({ messages: ['last'] });
  });
});
