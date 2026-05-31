#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, '..');
const uiRoot = resolve(desktopRoot, 'ui');
const devUrl = new URL('http://127.0.0.1:5173/');

function probeDevServer() {
  return new Promise((resolveProbe) => {
    const request = http.get(
      {
        hostname: devUrl.hostname,
        port: Number(devUrl.port),
        path: '/',
        timeout: 750,
      },
      (response) => {
        response.resume();
        resolveProbe(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 500);
      },
    );
    request.on('timeout', () => {
      request.destroy();
      resolveProbe(false);
    });
    request.on('error', () => resolveProbe(false));
  });
}

if (await probeDevServer()) {
  console.log(`[desktop-dev] Reusing existing Vite dev server at ${devUrl.href}`);
  process.exit(0);
}

const vite = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--strictPort'], {
  cwd: uiRoot,
  stdio: 'inherit',
});

vite.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
