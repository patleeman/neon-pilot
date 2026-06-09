#!/usr/bin/env node

/**
 * End-to-end test: start a chat session and send a message.
 *
 * Usage:
 *   node scripts/e2e-chat-test.mjs [--cdp-port <port>]
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function ab(args, options = {}) {
  return new Promise((resolve, reject) => {
    const cmd = 'npx';
    const cmdArgs = ['agent-browser', ...args];
    const child = spawn(cmd, cmdArgs, {
      cwd: REPO_ROOT,
      stdio: options.silent ? 'pipe' : 'inherit',
      env: { ...process.env, PATH: process.env.PATH },
    });
    let stdout = '';
    let stderr = '';
    if (options.silent) {
      child.stdout.on('data', (d) => {
        stdout += d;
      });
      child.stderr.on('data', (d) => {
        stderr += d;
      });
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(options.silent ? stdout.trim() : undefined);
      else reject(new Error(`agent-browser exited with code ${code}: ${(stderr || stdout).slice(0, 200)}`));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function snapshot(options = {}) {
  return ab(['snapshot', '-i', '--max-depth', '6', ...(options.args || [])], { silent: true });
}

async function retrySnapshot(fn, maxRetries = 10, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const s = await snapshot();
    const result = fn(s);
    if (result) return { snapshot: s, ...result };
    if (i < maxRetries - 1) await sleep(delayMs);
  }
  return { snapshot: await snapshot(), value: null };
}

async function extractRef(snap, pattern) {
  const match = snap.match(pattern);
  return match ? match[1] : null;
}

async function main() {
  const cdpPort = process.argv.find((a) => a.startsWith('--cdp-port='))
    ? process.argv.find((a) => a.startsWith('--cdp-port=')).split('=')[1]
    : '9223';

  console.log(`\n🧪 E2E Chat Test — CDP port ${cdpPort}\n`);

  // ── Step 1: Connect ──────────────────────────────────────────────────────
  console.log('1. Connecting to Electron app...');
  await ab(['connect', cdpPort]);
  assert('Connected to CDP', true);

  // ── Step 2: Navigate to new conversation ──────────────────────────────────
  console.log('\n2. Navigating to /conversations/new...');
  await ab(['eval', 'window.location.href = "neon-pilot://app/conversations/new"']);
  await sleep(3000);
  const s2 = await snapshot();
  assert('Page loaded', s2.includes('New Conversation') || s2.includes('Ctrl+C clears'), 'No composer found');

  // ── Step 3: Find the composer textarea ────────────────────────────────────
  console.log('\n3. Finding composer...');
  const composerRef = await extractRef(s2, /textbox "([^"]*Ctrl\+C[^"]*)" \[ref=e(\d+)\]/);
  assert('Composer textarea found', Boolean(composerRef));

  // ── Step 4: Create a new conversation via sidebar ─────────────────────────
  console.log('\n4. Creating new conversation...');
  const newBtnRef =
    (await extractRef(s2, /button "New conversation in neon-pilot" \[ref=e(\d+)\]/)) ||
    (await extractRef(s2, /button "New conversation in Chats" \[ref=e(\d+)\]/));

  if (newBtnRef) {
    await ab(['click', `@e${newBtnRef}`]);
    await sleep(2000);
    const s4 = await snapshot();
    assert('New conversation page rendered', s4.includes('New Conversation'));
  } else {
    assert('New conversation button found', false, 'No sidebar button found');
  }

  // ── Step 5: Type a message ───────────────────────────────────────────────
  console.log('\n5. Typing a message...');
  const textareaRef = await extractRef(await snapshot(), /textbox "([^"]*Ctrl\+C[^"]*)" \[ref=e(\d+)\]/);
  if (textareaRef) {
    await ab(['type', `@e${textareaRef}`, 'Hello from E2E test!']);
    await sleep(500);
    const s5 = await snapshot();
    assert('Message appears in composer', s5.includes('Hello from E2E test'));
  } else {
    assert('Textarea available for typing', false);
  }

  // ── Step 6: Verify Send button enabled ────────────────────────────────────
  console.log('\n6. Checking Send button...');
  const s6 = await snapshot();
  const sendDisabled = s6.includes('button "Send" [disabled');
  assert('Send button enabled', !sendDisabled);

  // ── Step 7: Send the message ──────────────────────────────────────────────
  console.log('\n7. Sending message...');
  const sendRef = await extractRef(s6, /button "Send" \[ref=e(\d+)\]/);
  if (sendRef) {
    await ab(['click', `@e${sendRef}`]);
    // Wait for the user message to appear in the transcript (optimistic update,
    // should be instant — not waiting for the LLM response).
    const result = await retrySnapshot((s) => (s.includes('Hello from E2E test') ? { value: true } : null), 10, 1000);
    assert('User message appeared in transcript', Boolean(result.value), 'User message should appear immediately after send');
  } else {
    assert('Send button clickable', false);
  }

  // ── Step 8: Open workbench ────────────────────────────────────────────────
  console.log('\n8. Opening workbench...');
  const s8 = await snapshot();
  const hideWorkbench = await extractRef(s8, /button "Hide workbench" \[ref=e(\d+)\]/);
  const showWorkbench = await extractRef(s8, /button "Show workbench" \[ref=e(\d+)\]/);
  const toggleRef = hideWorkbench || showWorkbench;

  if (toggleRef) {
    await ab(['click', `@e${toggleRef}`]);
    await sleep(2000);
    const s8b = await snapshot();
    const workbenchOpen = s8b.includes('Workbench note') && s8b.includes('Open a tab');
    assert('Workbench panel visible', workbenchOpen);
  } else {
    assert('Workbench toggle found', false);
  }

  // ── Step 9: Open side chat ────────────────────────────────────────────────
  console.log('\n9. Opening side chat...');
  const s9 = await snapshot();
  const chatBtnRef = await extractRef(s9, /button "Chat Open a new chat tab\." \[ref=e(\d+)\]/);

  if (chatBtnRef) {
    await ab(['click', `@e${chatBtnRef}`]);
    // Wait for side chat tab to appear (may take time on cold module load)
    const result = await retrySnapshot((s) => (s.includes('Close Chat') ? { value: true } : null), 20, 1500);
    assert('Side chat tab opened', Boolean(result.value), 'Side chat tab may not have appeared within 30s');

    // ── Step 10: Type in side chat ──────────────────────────────────────────
    if (result.value) {
      console.log('\n10. Typing in side chat...');
      const s10 = await snapshot();
      // Find the side chat textarea (the one AFTER "Side chat composer")
      const lines = s10.split('\n');
      let inSideChat = false;
      let sideTextareaRef = null;
      for (const line of lines) {
        if (line.includes('Side chat composer')) inSideChat = true;
        if (inSideChat && line.includes('textbox') && line.includes('ref=e')) {
          const m = line.match(/ref=e(\d+)/);
          if (m) sideTextareaRef = m[1];
          break;
        }
      }
      // Fallback: find the last textarea in the workbench area
      if (!sideTextareaRef) {
        const textareas = [...s10.matchAll(/textbox "[^"]*Ctrl\+C[^"]*" \[ref=e(\d+)\]/g)];
        if (textareas.length > 1) {
          sideTextareaRef = textareas[textareas.length - 1][1];
        }
      }
      if (sideTextareaRef) {
        await ab(['type', `@e${sideTextareaRef}`, 'Side chat test message']);
        await sleep(500);
        const s10b = await snapshot();
        assert('Side chat accepts input', s10b.includes('Side chat test message'));
      } else {
        assert('Side chat textarea found', false);
      }

      // ── Step 11: Close side chat tab ──────────────────────────────────────
      console.log('\n11. Closing side chat tab...');
      const closeRef = await extractRef(await snapshot(), /button "Close Chat [0-9a-f]+" \[ref=e(\d+)\]/);
      if (closeRef) {
        await ab(['click', `@e${closeRef}`]);
        await sleep(1000);
        const s11 = await snapshot();
        assert('Side chat tab closed', !s11.includes('Close Chat'));
      } else {
        assert('Close tab button found', false);
      }
    }
  } else {
    assert('Chat button in workbench', false, 'No "Chat Open a new chat tab" button found');
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'━'.repeat(40)}`);
  console.log(`Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ''}`);
  console.log(`${'━'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n❌ E2E test error: ${err.message}\n`);
  process.exit(1);
});
