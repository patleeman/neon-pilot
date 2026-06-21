#!/usr/bin/env node
/* eslint-env node */

import { spawn, spawnSync } from 'node:child_process';
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

function stopTestingAppForPort() {
  spawnSync('pkill', ['-f', `Neon Pilot Testing.*--remote-debugging-port=${port}`], { stdio: 'ignore' });
}

async function main() {
  stopTestingAppForPort();
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
    await cdp.send('Network.clearBrowserCache').catch(() => undefined);
    await cdp.send('Page.navigate', { url: 'neon-pilot://app/routines' });
    await waitFor(cdp, `Boolean(document.body && document.body.innerText.includes('Checkpoint timeline'))`, 'Routines page');

    const smoke = await evalJs(
      cdp,
      `
      (async () => {
        window.__routinesSmokeErrors = [];
        window.addEventListener('error', (event) => window.__routinesSmokeErrors.push(event.message || String(event.error || 'error')));
        window.addEventListener('unhandledrejection', (event) => window.__routinesSmokeErrors.push(String(event.reason?.message || event.reason || 'unhandled rejection')));
        const byText = (selector, text) => Array.from(document.querySelectorAll(selector)).find((el) => el.textContent?.includes(text));
        const click = (el, label = 'clickable') => { if (!el) throw new Error('missing ' + label); el.click(); };
        const input = (el, value) => {
          if (!el) throw new Error('missing input');
          const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          setter?.call(el, value);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const selectValue = (el, value) => {
          if (!el) throw new Error('missing select');
          const optionIndex = Array.from(el.options).findIndex((option) => option.value === value);
          if (optionIndex >= 0) el.selectedIndex = optionIndex;
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        };
        const bodyIncludes = (text) => document.body?.innerText.includes(text);
        const waitUntil = async (predicate, label, timeoutMs = 5000) => {
          const started = Date.now();
          while (Date.now() - started < timeoutMs) {
            if (predicate()) return;
            await new Promise((r) => setTimeout(r, 100));
          }
          throw new Error('timed out waiting for ' + label);
        };
        const assertInspectorCanScrollBottom = async () => {
          const scroller = Array.from(document.querySelectorAll('aside .overflow-auto')).at(-1);
          if (!scroller) throw new Error('routine inspector scroll region missing');
          scroller.scrollTop = scroller.scrollHeight;
          await new Promise((r) => requestAnimationFrame(r));
          const variableRow = Array.from(document.querySelectorAll('aside *')).find((el) => el.textContent?.trim() === '{{conversationId}}');
          if (!variableRow) throw new Error('inspector bottom variables missing');
          const rowRect = variableRow.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();
          if (rowRect.bottom > scrollerRect.bottom + 2) throw new Error('inspector bottom content is cut off');
        };
        const assertNoUiErrors = () => {
          const text = document.body?.innerText || '';
          const errors = window.__routinesSmokeErrors || [];
          if (text.includes('requires permission') || text.includes('Unhandled rejection') || errors.some((error) => /requires permission|Unhandled/i.test(error))) {
            throw new Error('Routines UI surfaced runtime/permission error: ' + [...errors, text].join('\\n').slice(0, 1000));
          }
        };
        await new Promise((r) => setTimeout(r, 100));
        const smokeInstructionName = 'Smoke temporary routine ' + Date.now();
        if (!bodyIncludes('ROUTE CONTINUES') || !bodyIncludes('ROUTE STOPS HERE')) {
          throw new Error('branch path reaction labels missing');
        }

        click(byText('button', 'Add routine'), 'Add routine');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Judge'), 'Judge menu item');
        await new Promise((r) => setTimeout(r, 150));
        input(Array.from(document.querySelectorAll('input')).find((el) => el.value === 'New judge'), 'Smoke judge routine');
        input(Array.from(document.querySelectorAll('textarea')).at(-1), 'Return OUTCOME: smoke_branch when this smoke test asks.');
        await waitUntil(() => bodyIncludes('Unsaved changes'), 'new decision unsaved state');
        await assertInspectorCanScrollBottom();
        for (let index = 1; index <= 10; index += 1) {
          click(byText('button', 'Add route'), 'Add route');
          await new Promise((r) => setTimeout(r, 60));
          input(Array.from(document.querySelectorAll('input')).filter((el) => el.value === 'new_path').at(-1), 'smoke_' + index);
          input(
            Array.from(document.querySelectorAll('input')).filter((el) => el.value === 'Describe this path').at(-1),
            'Smoke path ' + index,
          );
        }
        if (!Array.from(document.querySelectorAll('input')).some((el) => el.value === 'smoke_10')) {
          throw new Error('ten added branch paths did not render');
        }
        const removeButtons = Array.from(document.querySelectorAll('button')).filter((el) => el.textContent?.trim() === 'Remove route');
        click(removeButtons.at(-1), 'Remove route');
        await new Promise((r) => setTimeout(r, 100));
        if (Array.from(document.querySelectorAll('input')).some((el) => el.value === 'smoke_10')) {
          throw new Error('removed branch path still rendered');
        }
        const branchableSelect = Array.from(document.querySelectorAll('select'))
          .filter((el) => Array.from(el.options).some((option) => option.value === 'branch') && el.value === 'continue')
          .at(-1);
        if (!branchableSelect) throw new Error('branch path action option missing after adding many paths');
        click(Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Save'), 'Save decision');
        await new Promise((r) => setTimeout(r, 700));
        assertNoUiErrors();
        if (!bodyIncludes('Smoke judge routine')) throw new Error('saved judge routine missing');
        await waitUntil(() => !bodyIncludes('Unsaved changes'), 'decision saved state');
        click(Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Delete'), 'Delete decision');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Confirm'), 'Confirm delete decision');
        await new Promise((r) => setTimeout(r, 500));
        if (bodyIncludes('Smoke judge routine')) throw new Error('temporary judge routine was not deleted');

        click(byText('button', 'Add routine'), 'Add routine');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Instruction'), 'Instruction menu item');
        await new Promise((r) => setTimeout(r, 100));
        const name = Array.from(document.querySelectorAll('input')).find((el) => el.value === 'New instruction');
        input(name, smokeInstructionName);
        const instruction = Array.from(document.querySelectorAll('textarea')).at(-1);
        input(instruction, 'Smoke instruction /skill:');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', '/skill:autoreview'), 'skill autocomplete option');
        await new Promise((r) => setTimeout(r, 250));
        if (!Array.from(document.querySelectorAll('textarea')).some((el) => el.value.includes('/skill:autoreview'))) throw new Error('skill autocomplete did not insert');
        click(Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Save'), 'Save instruction');
        await new Promise((r) => setTimeout(r, 700));
        assertNoUiErrors();
        if (!document.body.innerText.includes(smokeInstructionName)) throw new Error('saved instruction missing');
        await waitUntil(() => !bodyIncludes('Unsaved changes'), 'instruction saved state');
        const block = Array.from(document.querySelectorAll('[data-routine-id]')).find((el) => el.textContent?.includes(smokeInstructionName));
        const targetRoute = document.querySelector('[data-routine-route][data-parent-outcome-id="pass"]');
        if (!block || !targetRoute) throw new Error('drag route candidates missing');
        const handle = block.querySelector('button[aria-label^="Drag"]');
        const rect = handle.getBoundingClientRect();
        const targetRect = targetRoute.getBoundingClientRect();
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 2, clientY: rect.top + 2 }));
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: targetRect.left + 30, clientY: targetRect.bottom - 10 }));
        await new Promise((r) => setTimeout(r, 100));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: targetRect.left + 30, clientY: targetRect.bottom - 10 }));
        await new Promise((r) => setTimeout(r, 500));
        assertNoUiErrors();
        click(Array.from(document.querySelectorAll('[data-routine-id]')).find((el) => el.textContent?.includes(smokeInstructionName)), 'temporary routine block');
        await new Promise((r) => setTimeout(r, 100));
        click(Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Delete'), 'Delete instruction');
        await new Promise((r) => setTimeout(r, 100));
        click(byText('button', 'Confirm'), 'Confirm delete instruction');
        await new Promise((r) => setTimeout(r, 500));
        assertNoUiErrors();
        if (document.body.innerText.includes(smokeInstructionName)) throw new Error('temporary instruction was not deleted');
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
    stopTestingAppForPort();
  }
}

await main();
