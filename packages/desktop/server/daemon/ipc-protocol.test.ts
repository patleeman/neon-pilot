import { describe, expect, it } from 'vitest';

import { parseRequest, serializeResponse } from './ipc-protocol.js';

describe('daemon ipc protocol', () => {
  it('parses simple request envelopes', () => {
    expect(parseRequest(JSON.stringify({ id: '1', type: 'status' }))).toEqual({ id: '1', type: 'status' });
    expect(parseRequest(JSON.stringify({ id: '2', type: 'stop' }))).toEqual({ id: '2', type: 'stop' });
    expect(parseRequest(JSON.stringify({ id: '3', type: 'ping' }))).toEqual({ id: '3', type: 'ping' });
    expect(parseRequest(JSON.stringify({ id: '4', type: 'emit', event: { type: 'task' } }))).toEqual({
      id: '4',
      type: 'emit',
      event: { type: 'task' },
    });
  });

  it('parses background run requests with shell, agent, source, callback, and checkpoint payloads', () => {
    expect(
      parseRequest(
        JSON.stringify({
          id: '1',
          type: 'runs.startBackground',
          input: {
            taskSlug: ' task ',
            cwd: ' /repo ',
            argv: ['pnpm', 'test'],
            shellCommand: ' echo hi ',
            agent: { prompt: ' work ', model: ' model ', noSession: true },
            source: { type: 'tool', id: 'conv-1', filePath: '/session.json' },
            callbackConversation: { conversationId: 'conv-1', sessionFile: '/session.json', profile: 'shared', repoRoot: '/repo' },
            manifestMetadata: { a: 1 },
            checkpointPayload: { resumeParentOnExit: true },
          },
        }),
      ),
    ).toEqual({
      id: '1',
      type: 'runs.startBackground',
      input: {
        taskSlug: 'task',
        cwd: '/repo',
        argv: ['pnpm', 'test'],
        shellCommand: 'echo hi',
        agent: { prompt: 'work', model: 'model', noSession: true },
        source: { type: 'tool', id: 'conv-1', filePath: '/session.json' },
        callbackConversation: { conversationId: 'conv-1', sessionFile: '/session.json', profile: 'shared', repoRoot: '/repo' },
        manifestMetadata: { a: 1 },
        checkpointPayload: { resumeParentOnExit: true },
      },
    });

    expect(() =>
      parseRequest(JSON.stringify({ id: '1', type: 'runs.startBackground', input: { taskSlug: 'x', cwd: '/repo', argv: ['ok', ''] } })),
    ).toThrow('runs.startBackground argv[1] must be a non-empty string');
    expect(() =>
      parseRequest(JSON.stringify({ id: '1', type: 'runs.startBackground', input: { taskSlug: 'x', cwd: '/repo', agent: {} } })),
    ).toThrow('runs.startBackground agent.prompt must be a non-empty string');
  });

  it('parses durable run and conversation sync requests', () => {
    expect(parseRequest(JSON.stringify({ id: '1', type: 'runs.get', runId: ' run-1 ' }))).toEqual({
      id: '1',
      type: 'runs.get',
      runId: 'run-1',
    });
    expect(parseRequest(JSON.stringify({ id: '1', type: 'runs.followUp', runId: 'run-1', prompt: ' continue ' }))).toEqual({
      id: '1',
      type: 'runs.followUp',
      runId: 'run-1',
      prompt: 'continue',
    });
    expect(parseRequest(JSON.stringify({ id: '1', type: 'conversations.recoverable' }))).toEqual({
      id: '1',
      type: 'conversations.recoverable',
    });
    expect(
      parseRequest(
        JSON.stringify({
          id: '1',
          type: 'conversations.sync',
          input: {
            conversationId: 'conv-1',
            sessionFile: '/session.json',
            cwd: '/repo',
            state: 'running',
            pendingOperation: { kind: 'prompt' },
          },
        }),
      ),
    ).toEqual({
      id: '1',
      type: 'conversations.sync',
      input: {
        conversationId: 'conv-1',
        sessionFile: '/session.json',
        cwd: '/repo',
        state: 'running',
        pendingOperation: { kind: 'prompt' },
      },
    });
    expect(() =>
      parseRequest(
        JSON.stringify({
          id: '1',
          type: 'conversations.sync',
          input: { conversationId: 'conv-1', sessionFile: '/session.json', cwd: '/repo', state: 'done' },
        }),
      ),
    ).toThrow('conversations.sync state must be waiting, running, interrupted, or failed');
  });

  it('rejects invalid envelopes and unknown request types', () => {
    expect(() => parseRequest('{}')).toThrow('Invalid request envelope');
    expect(() => parseRequest(JSON.stringify({ id: '', type: 'status' }))).toThrow('Invalid request envelope');
    expect(() => parseRequest(JSON.stringify({ id: '1', type: 'emit' }))).toThrow('emit request must include event');
    expect(() => parseRequest(JSON.stringify({ id: '1', type: 'unknown' }))).toThrow('Unknown request type: unknown');
  });

  it('serializes responses as newline-delimited JSON', () => {
    expect(serializeResponse({ id: '1', ok: true, result: { pong: true } })).toBe('{"id":"1","ok":true,"result":{"pong":true}}\n');
    expect(serializeResponse({ id: '2', ok: false, error: 'boom' })).toBe('{"id":"2","ok":false,"error":"boom"}\n');
  });
});
