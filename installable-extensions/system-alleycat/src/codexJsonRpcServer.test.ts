import { connect, type Socket } from 'node:net';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { type CodexServerHandle, createCodexServer, setCodexProtocolLogger } from './codexJsonRpcServer.js';

const TOKEN = 'test-token';

function testAuth() {
  return {
    validate: (token: string) => token === TOKEN,
    getToken: () => TOKEN,
    rotateToken: () => TOKEN,
    ensurePairing: async () => TOKEN,
  };
}

function testContext(): ExtensionBackendContext {
  return {
    conversations: {
      subscribe: () => undefined,
    },
    models: {
      list: async () => [{ id: 'gpt-test', name: 'GPT Test', supportedReasoningEfforts: ['low', 'high'] }],
    },
    log: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  } as unknown as ExtensionBackendContext;
}

class SocketLineReader {
  private buffer = '';
  private queue: string[] = [];
  private ended = false;
  private waiters: Array<{ resolve: (line: string | null) => void; reject: (error: Error) => void }> = [];

  constructor(private readonly socket: Socket) {
    const onData = (chunk: Buffer | string) => {
      this.buffer += chunk.toString();
      let index = this.buffer.indexOf('\n');
      while (index !== -1) {
        const line = this.buffer.slice(0, index);
        this.buffer = this.buffer.slice(index + 1);
        const waiter = this.waiters.shift();
        if (waiter) waiter.resolve(line);
        else this.queue.push(line);
        index = this.buffer.indexOf('\n');
      }
    };
    const onEnd = () => {
      this.ended = true;
      for (const waiter of this.waiters.splice(0)) waiter.resolve(null);
    };
    const onError = (error: Error) => {
      for (const waiter of this.waiters.splice(0)) waiter.reject(error);
    };
    socket.on('data', onData);
    socket.once('end', onEnd);
    socket.once('close', onEnd);
    socket.once('error', onError);
  }

  readLine(): Promise<string | null> {
    const line = this.queue.shift();
    if (line !== undefined) return Promise.resolve(line);
    if (this.ended) return Promise.resolve(null);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }
}

function connectJsonl(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port }, () => resolve(socket));
    socket.once('error', reject);
  });
}

describe('system-alleycat Codex JSON-RPC server', () => {
  const handles: CodexServerHandle[] = [];

  afterEach(() => {
    for (const handle of handles.splice(0)) handle.stop();
    setCodexProtocolLogger(null);
  });

  async function startServer(logs: string[] = []) {
    setCodexProtocolLogger((line) => logs.push(line));
    const handle = await createCodexServer({ port: 0, auth: testAuth(), ctx: testContext(), bindAddress: '127.0.0.1' });
    handles.push(handle);
    return handle;
  }

  it('rejects unauthorized JSONL bridge clients without surfacing an uncaught socket error', async () => {
    const logs: string[] = [];
    const handle = await startServer(logs);
    const socket = await connectJsonl(handle.jsonlPort);
    const reader = new SocketLineReader(socket);

    socket.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');

    await expect(reader.readLine()).resolves.toBeNull();
    expect(logs).toContain('jsonl unauthorized connection rejected');
  });

  it('rejects malformed or wrong-token JSONL auth lines before processing RPC', async () => {
    const logs: string[] = [];
    const handle = await startServer(logs);

    for (const line of ['not-json', JSON.stringify({ type: 'auth', token: 'wrong' })]) {
      const socket = await connectJsonl(handle.jsonlPort);
      const reader = new SocketLineReader(socket);
      socket.write(`${line}\n`);
      await expect(reader.readLine()).resolves.toBeNull();
    }

    expect(logs.filter((line) => line === 'jsonl unauthorized connection rejected')).toHaveLength(2);
  });

  it('returns Not initialized for authenticated JSONL requests before initialize', async () => {
    const handle = await startServer();
    const socket = await connectJsonl(handle.jsonlPort);
    const reader = new SocketLineReader(socket);

    socket.write(`${JSON.stringify({ type: 'auth', token: TOKEN })}\n`);
    socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'model/list', params: {} })}\n`);

    const response = JSON.parse((await reader.readLine())!);
    expect(response).toMatchObject({ id: 1, error: { code: -32000, message: 'Not initialized' } });
  });

  it('authenticates JSONL clients and serves initialize plus follow-up protocol calls in order', async () => {
    const handle = await startServer();
    const socket = await connectJsonl(handle.jsonlPort);
    const reader = new SocketLineReader(socket);

    socket.write(`${JSON.stringify({ type: 'auth', token: TOKEN })}\n`);
    socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'kitty-test' } } })}\n`);
    socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'model/list', params: {} })}\n`);

    const initialize = JSON.parse((await reader.readLine())!);
    const models = JSON.parse((await reader.readLine())!);

    expect(initialize.id).toBe(1);
    expect(initialize.result.capabilities).toMatchObject({ streams: true, files: true, commands: true });
    expect(models.id).toBe(2);
    expect(models.result.data[0]).toMatchObject({ id: 'gpt-test', model: 'gpt-test', displayName: 'GPT Test' });
  });

  it('rejects WebSocket clients without a bearer token and accepts authenticated clients', async () => {
    const handle = await startServer();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${handle.port}`);
      ws.once('close', (code) => {
        try {
          expect(code).toBe(4001);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      ws.once('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${handle.port}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      ws.once('open', () => {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
      });
      ws.once('message', (raw) => {
        try {
          const response = JSON.parse(raw.toString());
          expect(response.id).toBe(1);
          expect(response.result.userAgent).toContain('neon-pilot');
          ws.close();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      ws.once('error', reject);
    });
  });
});
