#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const seconds = Math.max(5, Number(arg('seconds', '30')) || 30);
const sessions = Math.max(1, Number(arg('sessions', '1000')) || 1000);
const blocks = Math.max(2, Number(arg('blocks', '80')) || 80);
const maxCpu = Math.max(10, Number(arg('max-cpu', '120')) || 120);
const app = arg('app', '');
const keep = process.argv.includes('--keep');
const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-startup-idle-'));

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed code=${code} signal=${signal}\n${stdout}\n${stderr}`));
    });
  });
}

async function sampleCpu(pid) {
  const { stdout } = await run('ps', ['-axo', 'pid,ppid,%cpu,command']);
  let total = 0;
  const offenders = [];
  for (const line of stdout.split('\n').slice(1)) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([0-9.]+)\s+(.+)$/);
    if (!match) continue;
    const [, rawPid, rawPpid, rawCpu, command] = match;
    if (rawPid === String(pid) || rawPpid === String(pid) || command.includes('Neon Pilot')) {
      const cpu = Number(rawCpu);
      total += cpu;
      if (cpu > 5) offenders.push({ pid: Number(rawPid), ppid: Number(rawPpid), cpu, command: command.slice(0, 180) });
    }
  }
  return { total, offenders };
}

async function main() {
  await run(process.execPath, [
    join(repo, 'scripts/seed-startup-profile.mjs'),
    `--root=${stateRoot}`,
    `--sessions=${sessions}`,
    `--blocks=${blocks}`,
  ]);

  const env = { ...process.env, NEON_PILOT_STATE_ROOT: stateRoot, NEON_PILOT_CONFIG_ROOT: join(stateRoot, 'config') };
  let child;
  if (app) {
    child = spawn('open', ['-n', '-W', app, '--args', `--neon-pilot-state-root=${stateRoot}`], { env, stdio: 'ignore' });
  } else {
    child = spawn('pnpm', ['--dir', 'packages/desktop', 'run', 'start', '--', `--neon-pilot-state-root=${stateRoot}`], {
      cwd: repo,
      env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  }

  const samples = [];
  const pythonHits = [];
  const started = Date.now();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
  while (Date.now() - started < seconds * 1000) {
    if (child.exitCode !== null) throw new Error(`App exited early with code ${child.exitCode}`);
    const sample = await sampleCpu(child.pid);
    samples.push(sample);
    const { stdout } = await run('ps', ['-axo', 'command']);
    for (const line of stdout.split('\n')) {
      if (/mlx_lm|mlx_vlm|llama-server|\.cache\/neon-pilot.*python/i.test(line)) pythonHits.push(line.trim());
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }

  child.kill('SIGTERM');
  const peak = Math.max(...samples.map((sample) => sample.total), 0);
  const avg = samples.reduce((sum, sample) => sum + sample.total, 0) / Math.max(samples.length, 1);
  const worst = samples.toSorted((a, b) => b.total - a.total)[0];

  if (pythonHits.length > 0) throw new Error(`Idle startup spawned local model process:\n${[...new Set(pythonHits)].join('\n')}`);
  if (peak > maxCpu) {
    throw new Error(
      `Idle startup CPU too high: peak=${peak.toFixed(1)} avg=${avg.toFixed(1)} limit=${maxCpu}\n${JSON.stringify(worst, null, 2)}`,
    );
  }

  console.log(JSON.stringify({ ok: true, stateRoot, seconds, sessions, blocks, peakCpu: peak, avgCpu: Number(avg.toFixed(1)) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    if (!keep) rmSync(stateRoot, { recursive: true, force: true });
  });
