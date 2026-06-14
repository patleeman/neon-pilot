#!/usr/bin/env node
import { spawn } from 'node:child_process';

const SERVER = {
  name: 'neon-pilot',
  version: '0.1.1',
};

const tools = [
  {
    name: 'neon_pilot_delegate',
    description: 'Start a focused durable Neon Pilot delegated agent run. Use for bounded side work, not ordinary one-off questions.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Concrete delegated task prompt.' },
        cwd: { type: 'string', description: 'Working directory for the delegated run.' },
        taskSlug: { type: 'string', description: 'Short stable task slug.' },
        model: { type: 'string', description: 'Optional Neon Pilot model reference.' },
        allowedTools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional allowlist of tool names for the delegated run.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_list_delegates',
    description: 'List recent Neon Pilot delegated agent runs.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_get_delegate',
    description: 'Inspect one Neon Pilot delegated agent run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_wait_any_delegate',
    description: 'Wait until any delegated Neon Pilot run in a supplied set reaches a terminal state or a timeout expires.',
    inputSchema: {
      type: 'object',
      properties: {
        runIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Delegated run ids to watch.',
        },
        timeoutMs: { type: 'number', minimum: 0, description: 'Maximum time to wait before returning a timeout result.' },
        pollIntervalMs: { type: 'number', minimum: 100, maximum: 10000, description: 'Polling interval while waiting.' },
      },
      required: ['runIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_delegate_logs',
    description: 'Read recent logs for one Neon Pilot delegated agent run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        tail: { type: 'number', minimum: 1, maximum: 1000 },
      },
      required: ['runId'],
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_follow_up',
    description: 'Send a follow-up prompt to an existing Neon Pilot delegated run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['runId', 'prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'neon_pilot_cancel_delegate',
    description: 'Cancel a Neon Pilot delegated agent run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
      additionalProperties: false,
    },
  },
];

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringArg(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function pushFlag(args, flag, value) {
  if (value === undefined || value === null || value === '') return;
  args.push(flag, String(value));
}

function cliArgsForTool(name, rawArgs) {
  const input = asRecord(rawArgs);
  if (name === 'neon_pilot_delegate') {
    const args = ['protocol', 'neon-pilot-agent', 'start', '--prompt', stringArg(input.prompt, 'prompt'), '--json'];
    pushFlag(args, '--cwd', input.cwd);
    pushFlag(args, '--task-slug', input.taskSlug);
    pushFlag(args, '--model', input.model);
    if (Array.isArray(input.allowedTools) && input.allowedTools.length > 0) {
      args.push('--allowed-tools', input.allowedTools.map(String).join(','));
    }
    return args;
  }
  if (name === 'neon_pilot_list_delegates') {
    return ['protocol', 'neon-pilot-agent', 'runs', 'list', '--kind', 'subagent', '--json'];
  }
  if (name === 'neon_pilot_get_delegate') {
    return ['protocol', 'neon-pilot-agent', 'runs', 'get', stringArg(input.runId, 'runId'), '--json'];
  }
  if (name === 'neon_pilot_wait_any_delegate') {
    const runIds = Array.isArray(input.runIds) ? input.runIds.map((runId) => stringArg(runId, 'runIds[]')) : [];
    if (runIds.length === 0) throw new Error('runIds is required.');
    const args = ['protocol', 'neon-pilot-agent', 'runs', 'wait-any', '--run-ids', runIds.join(','), '--json'];
    pushFlag(args, '--timeout-ms', input.timeoutMs);
    pushFlag(args, '--poll-interval-ms', input.pollIntervalMs);
    return args;
  }
  if (name === 'neon_pilot_delegate_logs') {
    const args = ['protocol', 'neon-pilot-agent', 'runs', 'logs', stringArg(input.runId, 'runId')];
    pushFlag(args, '--tail', input.tail ?? 200);
    return args;
  }
  if (name === 'neon_pilot_follow_up') {
    return [
      'protocol',
      'neon-pilot-agent',
      'runs',
      'follow-up',
      stringArg(input.runId, 'runId'),
      '--prompt',
      stringArg(input.prompt, 'prompt'),
      '--json',
    ];
  }
  if (name === 'neon_pilot_cancel_delegate') {
    return ['protocol', 'neon-pilot-agent', 'runs', 'cancel', stringArg(input.runId, 'runId'), '--json'];
  }
  throw new Error(`Unknown tool: ${name}`);
}

function runNeonPilot(args) {
  return new Promise((resolve) => {
    const child = spawn('neon-pilot', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr: `${stderr}${error.message}`, exitCode: 127 });
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

async function callTool(params) {
  const toolName = stringArg(params?.name, 'name');
  const result = await runNeonPilot(cliArgsForTool(toolName, params?.arguments));
  const text = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n\n');
  return {
    content: [{ type: 'text', text: text || `(neon-pilot exited ${result.exitCode})` }],
    isError: !result.ok,
  };
}

function response(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function errorResponse(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMessage(message) {
  const request = JSON.parse(message);
  if (!request || typeof request !== 'object') return null;
  const id = request.id ?? null;
  try {
    if (request.method === 'initialize') {
      return response(id, {
        protocolVersion: request.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER,
      });
    }
    if (request.method === 'tools/list') {
      return response(id, { tools });
    }
    if (request.method === 'tools/call') {
      return response(id, await callTool(request.params));
    }
    if (request.method === 'notifications/initialized') {
      return null;
    }
    return errorResponse(id, -32601, `Unknown method: ${request.method}`);
  } catch (error) {
    return errorResponse(id, -32000, error instanceof Error ? error.message : String(error));
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    void handleMessage(line).then((payload) => {
      if (payload) process.stdout.write(`${payload}\n`);
    });
  }
});
