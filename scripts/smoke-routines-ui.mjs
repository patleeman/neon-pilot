#!/usr/bin/env node
/* eslint-env node */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const port = Number(process.env.NEON_PILOT_SMOKE_PORT || 9337);

function run(command, args, options = {}) {
  return spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForPage() {
  const deadline = Date.now() + 45_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
      lastError = 'no page target';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for app CDP target: ${lastError}`);
}

function connect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const opened = new Promise((resolveOpen, rejectOpen) => {
    ws.once('open', resolveOpen);
    ws.once('error', rejectOpen);
  });
  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolvePending, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
    else resolvePending(message.result);
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolveCommand, rejectCommand) => pending.set(id, { resolve: resolveCommand, reject: rejectCommand }));
      ws.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      ws.close();
    },
  };
}

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails),
    );
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evalJs(cdp, expression);
    if (last) return last;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(last)}`);
}

async function main() {
  const childEnv = { ...process.env };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const child = run(
    process.execPath,
    ['packages/desktop/scripts/launch-dev-app.mjs', `--remote-debugging-port=${port}`, '--no-quit-confirmation'],
    { env: childEnv },
  );
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));

  let cdp;
  try {
    const page = await waitForPage();
    cdp = connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.navigate', { url: 'neon-pilot://app/routines' });
    await waitFor(cdp, `Boolean(document.body && document.body.innerText.includes('Checkpoint timeline'))`, 'Routines page');

    const smoke = await evalJs(
      cdp,
      `
      (async () => {
        const byText = (selector, text) => Array.from(document.querySelectorAll(selector)).find((el) => el.textContent?.includes(text));
        const click = (el) => { if (!el) throw new Error('missing clickable'); el.click(); };
        const input = (el, value) => {
          if (!el) throw new Error('missing input');
          const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          setter?.call(el, value);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Add routine'));
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Instruction'));
        await new Promise((r) => setTimeout(r, 100));
        const name = Array.from(document.querySelectorAll('input')).find((el) => el.value === 'New instruction');
        input(name, 'Smoke temporary routine');
        const instruction = Array.from(document.querySelectorAll('textarea')).at(-1);
        input(instruction, 'Smoke instruction /skill:');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', '/skill:autoreview'));
        await new Promise((r) => setTimeout(r, 250));
        if (!Array.from(document.querySelectorAll('textarea')).some((el) => el.value.includes('/skill:autoreview'))) throw new Error('skill autocomplete did not insert');
        click(byText('button', 'Save'));
        await new Promise((r) => setTimeout(r, 500));
        if (!document.body.innerText.includes('Smoke temporary routine')) throw new Error('saved instruction missing');
        const block = Array.from(document.querySelectorAll('[data-routine-id]')).find((el) => el.textContent?.includes('Smoke temporary routine'));
        const target = Array.from(document.querySelectorAll('[data-routine-id]')).find((el) => el.textContent?.includes('Review code changes'));
        if (!block || !target) throw new Error('drag candidates missing');
        const handle = block.querySelector('button[aria-label^="Drag"]');
        const rect = handle.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 2, clientY: rect.top + 2 }));
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: targetRect.left + 10, clientY: targetRect.top + 10 }));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: targetRect.left + 10, clientY: targetRect.top + 10 }));
        await new Promise((r) => setTimeout(r, 500));
        click(Array.from(document.querySelectorAll('[data-routine-id]')).find((el) => el.textContent?.includes('Smoke temporary routine')));
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Delete'));
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Confirm'));
        await new Promise((r) => setTimeout(r, 500));
        if (document.body.innerText.includes('Smoke temporary routine')) throw new Error('temporary instruction was not deleted');
        return 'ok';
      })()
    `,
    );
    if (smoke !== 'ok') throw new Error(`Unexpected smoke result: ${JSON.stringify(smoke)}`);
    console.log('Routines UI smoke passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    console.error(logs.join(''));
    process.exitCode = 1;
  } finally {
    cdp?.close();
    child.kill('SIGTERM');
  }
}

await main();
