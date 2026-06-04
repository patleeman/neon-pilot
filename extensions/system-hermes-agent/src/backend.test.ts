import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listSessions, readConfig, sendMessage, updateConfig } from './backend';

function createContext(): ExtensionBackendContext {
  const storage = new Map<string, unknown>();
  return {
    storage: {
      get: vi.fn(async (key: string) => storage.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
      }),
    },
    ui: {
      invalidate: vi.fn(),
    },
  } as unknown as ExtensionBackendContext;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

function fetchCalls() {
  return vi.mocked(fetch).mock.calls;
}

describe('system-hermes-agent backend', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores connection config and redacts the API key when read', async () => {
    const ctx = createContext();

    await updateConfig(
      {
        baseUrl: 'http://127.0.0.1:8642/',
        apiKey: 'secret-token',
        sessionKey: 'agent:main',
      },
      ctx,
    );

    await expect(readConfig(null, ctx)).resolves.toEqual({
      config: {
        baseUrl: 'http://127.0.0.1:8642',
        sessionKey: 'agent:main',
        hasApiKey: true,
      },
    });
    expect(ctx.ui.invalidate).toHaveBeenCalledWith(['extensions:system-hermes-agent']);
  });

  it('maps listSessions to the Hermes sessions endpoint with auth headers', async () => {
    const ctx = createContext();
    await updateConfig({ apiKey: 'secret-token', sessionKey: 'agent:main' }, ctx);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ object: 'list', data: [] }));

    await listSessions({ limit: 25, offset: 5, includeChildren: true }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://127.0.0.1:8642/api/sessions?limit=25&offset=5&include_children=true');
    const headers = init?.headers as Headers;
    expect(init?.method).toBe('GET');
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('X-Hermes-Session-Key')).toBe('agent:main');
  });

  it('posts user turns to the Hermes synchronous session chat endpoint', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        object: 'hermes.session.chat.completion',
        session_id: 'session-id',
        message: { role: 'assistant', content: 'hello' },
      }),
    );

    const result = await sendMessage({ sessionId: 'session-id', message: 'hi', instructions: 'be terse' }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://127.0.0.1:8642/api/sessions/session-id/chat');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ message: 'hi', instructions: 'be terse' });
    expect(result).toMatchObject({ session_id: 'session-id', message: { content: 'hello' } });
  });

  it('surfaces Hermes error messages from non-OK responses', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { message: 'Hermes says no.' } }, { status: 503 }));

    await expect(sendMessage({ sessionId: 'session-id', message: 'hi' }, ctx)).rejects.toThrow('Hermes says no.');
  });
});
