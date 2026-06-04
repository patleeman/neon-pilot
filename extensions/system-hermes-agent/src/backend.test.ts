import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSession, getRun, listSessions, readConfig, sendMessage, startSessionRun, updateConfig } from './backend';

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
      activeDeploymentId: 'local',
      config: {
        id: 'local',
        name: 'Local Hermes',
        baseUrl: 'http://127.0.0.1:8642',
        sessionKey: 'agent:main',
        hasApiKey: true,
      },
      deployments: [
        {
          id: 'local',
          name: 'Local Hermes',
          baseUrl: 'http://127.0.0.1:8642',
          sessionKey: 'agent:main',
          hasApiKey: true,
        },
      ],
    });
    expect(ctx.ui.invalidate).toHaveBeenCalledWith(['extensions:system-hermes-agent']);
  });

  it('stores multiple deployments and routes requests to the selected deployment', async () => {
    const ctx = createContext();
    await updateConfig({ id: 'local', name: 'Local Hermes', baseUrl: 'http://127.0.0.1:8642', apiKey: 'local-token' }, ctx);
    await updateConfig({ id: 'bender', name: 'Bender', baseUrl: 'http://bender.tail.ts.net:8642', apiKey: 'bender-token' }, ctx);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ object: 'list', data: [] }));

    await listSessions({ deploymentId: 'bender', limit: 10 }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://bender.tail.ts.net:8642/api/sessions?limit=10&offset=0&include_children=false');
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer bender-token');
    await expect(readConfig(null, ctx)).resolves.toMatchObject({
      activeDeploymentId: 'bender',
      deployments: [
        { id: 'local', name: 'Local Hermes', baseUrl: 'http://127.0.0.1:8642', hasApiKey: true },
        { id: 'bender', name: 'Bender', baseUrl: 'http://bender.tail.ts.net:8642', hasApiKey: true },
      ],
    });
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
    expect(JSON.parse(String(init?.body))).toEqual({ input: 'hi', instructions: 'be terse' });
    expect(result).toMatchObject({ session_id: 'session-id', message: { content: 'hello' } });
  });

  it('compacts chat responses before returning them across the extension boundary', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        object: 'hermes.session.chat.completion',
        session_id: 'session-id',
        message: { id: 'msg-1', role: 'assistant', content: 'hello', private_blob: 'omit me' },
        events: [{ payload: 'large internal run event' }],
        tools: [{ result: 'large tool payload' }],
      }),
    );

    const result = await sendMessage({ sessionId: 'session-id', message: 'hi' }, ctx);

    expect(result).toEqual({
      object: 'hermes.session.chat.completion',
      session_id: 'session-id',
      message: { id: 'msg-1', role: 'assistant', content: 'hello' },
    });
  });

  it('creates Hermes API sessions with an optional title', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ session_id: 'new-session', title: 'Neon Pilot session' }));

    const result = await createSession({ title: 'Neon Pilot session' }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://127.0.0.1:8642/api/sessions');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'Neon Pilot session' });
    expect(result).toMatchObject({ session_id: 'new-session' });
  });

  it('starts Hermes runs with the selected session id', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ run_id: 'run-1', status: 'started', session_id: 'session-id' }));

    const result = await startSessionRun({ sessionId: 'session-id', message: 'hi' }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://127.0.0.1:8642/v1/runs');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ input: 'hi', session_id: 'session-id' });
    expect(result).toMatchObject({ run_id: 'run-1', status: 'started', session_id: 'session-id' });
  });

  it('reads and compacts Hermes run output', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ run_id: 'run-1', status: 'completed', session_id: 'session-id', output: 'five tidy words only', events: [] }),
    );

    const result = await getRun({ runId: 'run-1' }, ctx);

    const [url, init] = fetchCalls()[0];
    expect(url).toBe('http://127.0.0.1:8642/v1/runs/run-1');
    expect(init?.method).toBe('GET');
    expect(result).toEqual({
      run_id: 'run-1',
      status: 'completed',
      session_id: 'session-id',
      output: 'five tidy words only',
      message: { role: 'assistant', content: 'five tidy words only' },
    });
  });

  it('surfaces Hermes error messages from non-OK responses', async () => {
    const ctx = createContext();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { message: 'Hermes says no.' } }, { status: 503 }));

    await expect(sendMessage({ sessionId: 'session-id', message: 'hi' }, ctx)).rejects.toThrow('Hermes says no.');
  });
});
