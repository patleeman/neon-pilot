#!/usr/bin/env node
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(packageRoot, '../..');
const storybookRoot = resolve(packageRoot, 'storybook-static');
const rootRequire = createRequire(join(repoRoot, 'package.json'));
const { chromium } = rootRequire('@playwright/test');

const storyNames = [
  'desktop-composition',
  'dark-desktop-composition',
  'chat-with-attached-workbench',
  'dark-chat-with-attached-workbench',
  'chat-with-collapsed-workbench',
  'dark-chat-with-collapsed-workbench',
  'chat-with-attached-browser-workbench',
  'dark-chat-with-attached-browser-workbench',
  'inherited-chat-chrome',
  'dark-inherited-chat-chrome',
  'settings-page',
  'dark-settings-page',
  'automations-page',
  'dark-automations-page',
  'gateways-page',
  'dark-gateways-page',
  'ai-gateway-page',
  'dark-ai-gateway-page',
  'routines-page',
  'dark-routines-page',
  'workflows-page',
  'dark-workflows-page',
  'model-arena-page',
  'dark-model-arena-page',
  'diagnostics-page',
  'dark-diagnostics-page',
  'extensions-page',
  'dark-extensions-page',
  'skills-page',
  'dark-skills-page',
  'embedded-extension-page',
  'dark-embedded-extension-page',
  'terminal-window',
  'browser-window',
  'drawings-picker-subwindow',
];

const viewports = [
  { name: 'wide', width: 900, height: 720 },
  { name: 'compact', width: 430, height: 720 },
];

const storiesAllowingOffscreenWindows = new Set([
  'windowed-os-desktop-shell--desktop-composition',
  'windowed-os-desktop-shell--dark-desktop-composition',
]);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { updateScreenshots: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--screenshots') {
      result.updateScreenshots = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/qa-storybook.mjs [--screenshots]');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function createStaticServer(root) {
  return createServer((request, response) => {
    const rawUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(rawUrl.pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = resolve(root, relativePath);

    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      const address = server.address();
      if (!address || typeof address === 'string') {
        rejectListen(new Error('Storybook QA server did not bind to a TCP address.'));
        return;
      }
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

function resolveChromeExecutable() {
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return existsSync(macChrome) ? macChrome : undefined;
}

async function inspectStory(page, { allowOffscreenWindows }) {
  return page.evaluate(
    ({ allowOffscreenWindows: canHaveOffscreenWindows }) => {
      const bodyText = document.body.innerText;
      const overflow = [...document.querySelectorAll('*')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: String(element.className || ''),
            text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            insideWindow: Boolean(element.closest('.wos-window')),
          };
        })
        .filter(
          (entry) =>
            entry.width > 0 &&
            entry.height > 0 &&
            entry.bottom >= 0 &&
            entry.top <= window.innerHeight &&
            (!canHaveOffscreenWindows || !entry.insideWindow) &&
            (entry.left < -1 || entry.right > window.innerWidth + 1),
        )
        .slice(0, 8);

      const clippedButtons = [...document.querySelectorAll('button')]
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            text: (button.textContent || '').trim().replace(/\s+/g, ' '),
            label: button.getAttribute('aria-label'),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            scrollWidth: button.scrollWidth,
            scrollHeight: button.scrollHeight,
            className: String(button.className || ''),
          };
        })
        .filter(
          (entry) =>
            entry.width > 0 &&
            entry.height > 0 &&
            (entry.scrollWidth > Math.ceil(entry.width) + 2 || entry.scrollHeight > Math.ceil(entry.height) + 2),
        )
        .slice(0, 8);

      return {
        missingStory: bodyText.includes("Couldn't find story matching"),
        overflow,
        clippedButtons,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    },
    { allowOffscreenWindows },
  );
}

async function main() {
  const args = parseArgs();
  if (!existsSync(join(storybookRoot, 'index.json'))) {
    throw new Error('Missing storybook-static/index.json. Run `pnpm --dir packages/windowed-os-ui run build:storybook` first.');
  }

  const index = JSON.parse(readFileSync(join(storybookRoot, 'index.json'), 'utf8'));
  const storyIds = storyNames.map((name) => `windowed-os-desktop-shell--${name}`);
  const missingIndexStories = storyIds.filter((id) => !index.entries[id]);
  if (missingIndexStories.length > 0) {
    throw new Error(`Missing canonical Storybook entries:\n${missingIndexStories.map((id) => `- ${id}`).join('\n')}`);
  }

  const screenshotDir = resolve(repoRoot, 'artifacts/windowed-os-storybook-qa');
  if (args.updateScreenshots) mkdirSync(screenshotDir, { recursive: true });

  const server = createStaticServer(storybookRoot);
  const baseUrl = await listen(server);
  const browser = await chromium.launch({ executablePath: resolveChromeExecutable() });
  const failures = [];

  try {
    for (const storyId of storyIds) {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });
        const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story&cachebust=${Date.now()}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(200);

        if (args.updateScreenshots) {
          await page.screenshot({
            path: join(screenshotDir, `${storyId.replace('windowed-os-desktop-shell--', '')}-${viewport.name}.png`),
            fullPage: false,
          });
        }

        const result = await inspectStory(page, {
          allowOffscreenWindows: storiesAllowingOffscreenWindows.has(storyId),
        });
        await page.close();

        const hasFailure =
          result.missingStory ||
          result.overflow.length > 0 ||
          result.clippedButtons.length > 0 ||
          result.scrollWidth > result.clientWidth + 1;
        if (hasFailure) {
          failures.push({ storyId, viewport: viewport.name, ...result });
        }
      }
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ checked: storyIds.length * viewports.length, failures }, null, 2));
    process.exit(1);
  }

  console.log(`Windowed OS Storybook QA passed: ${storyIds.length * viewports.length} story viewports checked.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
