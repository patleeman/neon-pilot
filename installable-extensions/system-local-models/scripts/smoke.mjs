#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(here, '..');
const repoRoot = resolve(extensionRoot, '..', '..', '..');
const args = new Set(process.argv.slice(2));
const full = args.has('--full');
const skipBuild = args.has('--skip-build');
const ggufModel =
  process.env.LOCAL_MODELS_GGUF_MODEL || '/Users/patrick/.cache/neon-pilot/llama-cpp/models/unsloth__Qwen3.5-4B-GGUF/Qwen3.5-4B-BF16.gguf';
const mlxModel = process.env.LOCAL_MODELS_MLX_MODEL || 'mlx-community/SmolLM-135M-Instruct-4bit';

function log(message) {
  console.log(`\n== ${message}`);
}
function pass(message) {
  console.log(`✓ ${message}`);
}
function fail(message) {
  throw new Error(message);
}
function run(command, options = {}) {
  execFileSync(command, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NEON_PILOT_REPO_ROOT: repoRoot },
    ...options,
  });
}

class MemoryStorage {
  values = new Map();
  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  async put(key, value) {
    this.values.set(key, value);
  }
}

function createContext() {
  return {
    storage: new MemoryStorage(),
    shell: {
      async exec(input) {
        const child = spawn(input.command, input.args ?? [], {
          cwd: repoRoot,
          env: { ...process.env, NEON_PILOT_REPO_ROOT: repoRoot },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        const timeout = input.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), input.timeoutMs) : null;
        const code = await new Promise((resolve, reject) => {
          child.on('error', reject);
          child.on('close', resolve);
        });
        if (timeout) clearTimeout(timeout);
        if (code !== 0) throw new Error(stderr || stdout || `${input.command} exited with code ${code}`);
        return { stdout, stderr };
      },
    },
  };
}

async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return response;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`timed out waiting for ${url}: ${lastError}`);
}

async function waitForCurl(ctx, url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      return await ctx.shell.exec({ command: 'curl', args: ['-fsS', '--max-time', '2', url], timeoutMs: 3000, maxBuffer: 1024 * 1024 });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`timed out waiting for ${url}: ${lastError}`);
}

async function main() {
  if (!skipBuild) {
    log('building system-local-models extension');
    run(`node scripts/extension-build.mjs ${extensionRoot}`);
  }

  log('checking llama.cpp runtime bundle');
  run('node installable-extensions/shared/local-model-runtimes/scripts/check-runtime.mjs');

  log('importing backend actions');
  const backend = await import(pathToFileURL(join(extensionRoot, 'dist', 'backend.mjs')).href + `?smoke=${Date.now()}`);
  const ctx = createContext();
  const initial = await backend.status({}, ctx);
  if (!initial.ok) fail('status action did not return ok');
  pass(`status action works: mlx=${initial.mlx.providerId}, gguf=${initial.gguf.baseUrl}`);

  log('checking MLX command surface');
  const mlxSearch = await backend.mlxSearch({ query: 'tinyllama' }, ctx);
  if (!mlxSearch.ok || !Array.isArray(mlxSearch.models)) fail('mlxSearch failed');
  pass(`mlx search works (${mlxSearch.models.length} results)`);

  if (!full) {
    pass('fast smoke complete; use --full for real server/model load tests');
    return;
  }

  log('running GGUF server smoke');
  await backend.ggufSetModel({ modelPath: ggufModel }, ctx);
  const ggufStatus = await backend.status({}, ctx);
  if ((ggufStatus.gguf.recommendedContextSize ?? 0) < 32768) fail('GGUF recommended context did not auto-detect a long-context default');
  pass(`GGUF context detected=${ggufStatus.gguf.detectedContextLength ?? 'unknown'} recommended=${ggufStatus.gguf.recommendedContextSize}`);
  await backend.ggufStart({ modelPath: ggufModel, contextSize: 1024, gpuLayers: 999 }, ctx);
  try {
    const models = await waitFor('http://127.0.0.1:8012/v1/models');
    pass(`GGUF /v1/models reachable: ${(await models.text()).slice(0, 160)}`);
    const prompt = await backend.ggufRunPrompt(
      { modelPath: ggufModel, prompt: 'Reply with exactly: ok', contextSize: 1024, gpuLayers: 999, maxTokens: 16 },
      ctx,
    );
    if (!prompt.output) fail('GGUF prompt returned no output');
    pass(`GGUF prompt works: ${prompt.output.slice(0, 120).replaceAll('\n', ' ')}`);
  } finally {
    await backend.ggufStop({}, ctx).catch(() => undefined);
  }

  log('running MLX server smoke');
  await backend.mlxSetModel({ modelId: mlxModel }, ctx);
  const setup = await backend.mlxSetup({ modelId: mlxModel }, ctx);
  if (!setup.ok) fail(`MLX setup failed to start: ${setup.error ?? 'unknown error'}`);
  let setupStatus;
  const setupDeadline = Date.now() + 20 * 60_000;
  while (Date.now() < setupDeadline) {
    setupStatus = await backend.status({}, ctx);
    if (!setupStatus.mlx.process.setupRunning) break;
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log('');
  setupStatus = await backend.status({}, ctx);
  if (!setupStatus.mlx.installed) fail(`MLX setup did not install ${mlxModel}. Last log:\n${setupStatus.mlx.log.slice(-4000)}`);
  pass(`MLX setup installed ${mlxModel}`);
  if (!setupStatus.mlx.recommendedContextSize) fail('MLX recommended context was not reported');
  pass(`MLX context detected=${setupStatus.mlx.detectedContextLength ?? 'unknown'} recommended=${setupStatus.mlx.recommendedContextSize}`);

  await backend.mlxStart({ maxTokens: 16 }, ctx);
  try {
    const response = await waitForCurl(ctx, 'http://127.0.0.1:8011/v1/models', 180_000);
    pass(`MLX /v1/models reachable: ${response.stdout.slice(0, 160)}`);
    const completionBody = JSON.stringify({
      model: mlxModel,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      max_tokens: 8,
      stream: false,
    });
    const completion = await ctx.shell.exec({
      command: 'curl',
      args: [
        '-fsS',
        '--max-time',
        '120',
        'http://127.0.0.1:8011/v1/chat/completions',
        '-H',
        'Content-Type: application/json',
        '-d',
        completionBody,
      ],
      timeoutMs: 130_000,
      maxBuffer: 1024 * 1024,
    });
    pass(`MLX chat completion works: ${completion.stdout.slice(0, 160)}`);
  } finally {
    await backend.mlxStop({}, ctx).catch(() => undefined);
  }
}

const tempState = mkdtempSync(join(tmpdir(), 'pa-local-models-smoke-'));
process.env.NEON_PILOT_REPO_ROOT = repoRoot;
process.env.NEON_PILOT_STATE_ROOT = tempState;
main()
  .finally(() => rmSync(tempState, { recursive: true, force: true }))
  .catch((error) => {
    console.error(`\n✗ local models smoke failed\n${error.stack || error.message || String(error)}`);
    process.exit(1);
  });
