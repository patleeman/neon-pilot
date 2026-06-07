#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const seconds = Math.max(5, Number(arg('seconds', '30')) || 30);
const sessions = Math.max(1, Number(arg('sessions', '1000')) || 1000);
const blocks = Math.max(2, Number(arg('blocks', '80')) || 80);
const maxCpu = Math.max(10, Number(arg('max-cpu', '130')) || 130);
const maxPeakCpu = Math.max(maxCpu * 3, cpus().length * 100);
const app = arg('app', '');
const keep = process.argv.includes('--keep');
const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-startup-idle-'));
const desktopMainFile = join(repo, 'packages', 'desktop', 'dist', 'main.js');
const devApp = join(repo, 'dist', 'dev-desktop', 'Neon Pilot Testing.app');

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
  const rows = [];
  for (const line of stdout.split('\n').slice(1)) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([0-9.]+)\s+(.+)$/);
    if (!match) continue;
    const [, rawPid, rawPpid, rawCpu, command] = match;
    rows.push({ pid: Number(rawPid), ppid: Number(rawPpid), cpu: Number(rawCpu), command });
  }

  const descendants = new Set([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (!descendants.has(row.pid) && descendants.has(row.ppid)) {
        descendants.add(row.pid);
        changed = true;
      }
    }
  }

  let total = 0;
  const offenders = [];
  for (const row of rows) {
    if (descendants.has(row.pid)) {
      const cpu = row.cpu;
      total += cpu;
      if (cpu > 5) offenders.push({ pid: row.pid, ppid: row.ppid, cpu, command: row.command.slice(0, 180) });
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
  const launchApp = app || (process.platform === 'darwin' ? devApp : '');
  if (launchApp) {
    if (!app) {
      await run('pnpm', ['--dir', 'packages/desktop', 'run', 'build'], { cwd: repo, env });
      await run('pnpm', ['--dir', 'packages/desktop', 'run', 'launch', '--', '--prepare-only'], { cwd: repo, env }).catch(() => undefined);
    }
    const executablePath = join(launchApp, 'Contents', 'MacOS', basename(launchApp, '.app'));
    if (!existsSync(executablePath)) throw new Error(`Packaged app executable not found: ${executablePath}`);
    child = spawn(executablePath, [desktopMainFile, '--no-quit-confirmation', `--neon-pilot-state-root=${stateRoot}`], {
      env: {
        ...env,
        NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
        NEON_PILOT_REPO_ROOT: repo,
        NEON_PILOT_RUNTIME_CHANNEL: 'test',
        NEON_PILOT_DESKTOP_USER_DATA_DIR: join(stateRoot, 'user-data'),
        NEON_PILOT_DAEMON_SOCKET_PATH: join(stateRoot, 'daemon.sock'),
        NEON_PILOT_COMPANION_PORT: '0',
      },
      stdio: 'ignore',
    });
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
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(resolvePromise, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolvePromise) => {
      const timeout = setTimeout(resolvePromise, 5_000);
      child.once('exit', () => {
        clearTimeout(timeout);
        resolvePromise();
      });
    });
  }
  const peak = Math.max(...samples.map((sample) => sample.total), 0);
  const avg = samples.reduce((sum, sample) => sum + sample.total, 0) / Math.max(samples.length, 1);
  const worst = samples.toSorted((a, b) => b.total - a.total)[0];

  if (pythonHits.length > 0) throw new Error(`Idle startup spawned local model process:\n${[...new Set(pythonHits)].join('\n')}`);
  if (avg > maxCpu || peak > maxPeakCpu) {
    throw new Error(
      `Idle startup CPU too high: peak=${peak.toFixed(1)} avg=${avg.toFixed(1)} avgLimit=${maxCpu} peakLimit=${maxPeakCpu}\n${JSON.stringify(worst, null, 2)}`,
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
