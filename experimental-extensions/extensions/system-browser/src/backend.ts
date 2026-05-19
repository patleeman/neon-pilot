import type { ExtensionBackendContext } from '@personal-agent/extensions';
import { getWorkbenchBrowserToolHost, type WorkbenchBrowserToolHost } from '@personal-agent/extensions/backend/browser';

function requireHost(): WorkbenchBrowserToolHost {
  const host = getWorkbenchBrowserToolHost();
  if (!host) {
    throw new Error('Workbench Browser tools are only available in the desktop app.');
  }
  return host;
}

async function requireActiveHost(conversationId: string, signal: AbortSignal | undefined): Promise<WorkbenchBrowserToolHost> {
  const host = requireHost();
  const active = await withBrowserToolDeadline('Browser active check', signal, host.isActive(conversationId));
  if (!active) {
    throw new Error('Workbench Browser is not active for this conversation. Open the Browser workbench panel before using browser tools.');
  }
  return host;
}

const BROWSER_TOOL_TIMEOUT_MS = 10_000;

class BrowserToolAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserToolAbortError';
  }
}

function tabIdFromSessionKey(sessionKey: string): string {
  const prefix = '@global:tab-';
  return sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
}

function normalizeScreenshotImage(screenshot: { dataBase64?: string; mimeType?: string }): { data: string; mimeType: string } | undefined {
  const data = typeof screenshot.dataBase64 === 'string' ? screenshot.dataBase64.trim() : '';
  const mimeType = typeof screenshot.mimeType === 'string' ? screenshot.mimeType.trim() : 'image/png';
  if (!data || !mimeType.toLowerCase().startsWith('image/')) return undefined;
  return { data, mimeType };
}

async function withBrowserToolDeadline<T>(label: string, signal: AbortSignal | undefined, operation: Promise<T>): Promise<T> {
  if (signal?.aborted) {
    throw new BrowserToolAbortError(`${label} cancelled.`);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new BrowserToolAbortError(`${label} timed out after ${BROWSER_TOOL_TIMEOUT_MS / 1000}s.`)),
      BROWSER_TOOL_TIMEOUT_MS,
    );
    abortHandler = () => reject(new BrowserToolAbortError(`${label} cancelled.`));
    signal?.addEventListener('abort', abortHandler, { once: true });
  });

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (abortHandler) {
      signal?.removeEventListener('abort', abortHandler);
    }
  }
}

function formatSnapshot(snapshot: unknown, tabs: Array<{ sessionKey: string; url: string; title: string }>, targetTabId?: string): string {
  const data = snapshot as {
    url?: string;
    title?: string;
    loading?: boolean;
    browserRevision?: number;
    lastSnapshotRevision?: number;
    changedSinceLastSnapshot?: boolean;
    lastChangeReason?: string;
    lastChangedAt?: string;
    text?: string;
    elements?: Array<{
      ref?: string;
      role?: string;
      name?: string;
      selector?: string;
      text?: string;
      enabled?: boolean;
      checked?: boolean;
    }>;
  };

  const snapshotUrl = data.url ?? '';

  const lines = [
    `URL: ${snapshotUrl}`,
    `Title: ${data.title ?? ''}`,
    `Loading: ${data.loading === true ? 'yes' : 'no'}`,
    `Browser revision: ${data.browserRevision ?? 0}`,
    `Changed since last snapshot: ${data.changedSinceLastSnapshot === true ? 'yes' : 'no'}`,
  ];
  if (data.lastChangeReason || data.lastChangedAt) {
    lines.push(`Last browser change: ${data.lastChangeReason ?? 'unknown'}${data.lastChangedAt ? ` at ${data.lastChangedAt}` : ''}`);
  }

  if (tabs.length > 0) {
    lines.push('', `Open tabs (${tabs.length}):`);
    for (const tab of tabs) {
      const tabId = tabIdFromSessionKey(tab.sessionKey);
      const isActive = tabId === targetTabId || (!targetTabId && tab.url === snapshotUrl);
      const isActiveMarker = isActive ? ' (active)' : '';
      lines.push(`  tabId=${tabId} title=${JSON.stringify(tab.title)} url=${tab.url}${isActiveMarker}`);
    }
  }

  if (data.elements?.length) {
    lines.push('', 'Elements:');
    for (const element of data.elements.slice(0, 120)) {
      const state = [
        element.enabled === false ? 'disabled' : 'enabled',
        typeof element.checked === 'boolean' ? `checked=${element.checked}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `${element.ref ?? ''} role=${element.role ?? ''} name=${JSON.stringify(element.name ?? '')} selector=${JSON.stringify(
          element.selector ?? '',
        )} ${state}`.trim(),
      );
      if (element.text && element.text !== element.name) {
        lines.push(`  text=${JSON.stringify(element.text)}`);
      }
    }
  }

  if (data.text) {
    lines.push('', 'Visible text:', data.text.slice(0, 20_000));
  }

  return lines.join('\n');
}

function getToolContext(ctx: ExtensionBackendContext): { conversationId: string; signal: AbortSignal | undefined } {
  const conversationId = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? '';
  const signal = (ctx.agentToolContext as { signal?: AbortSignal } | undefined)?.signal;
  return { conversationId, signal };
}

export async function browserSnapshot(input: unknown, ctx: ExtensionBackendContext) {
  const { conversationId, signal } = getToolContext(ctx);
  const tabId = (input as { tabId?: string }).tabId;
  try {
    const host = await requireActiveHost(conversationId, signal);
    const tabs = await withBrowserToolDeadline('Browser tab listing', signal, host.listTabs());
    const snapshot = await withBrowserToolDeadline('Browser snapshot', signal, host.snapshot(conversationId, tabId));
    return {
      content: [{ type: 'text' as const, text: formatSnapshot(snapshot, tabs, tabId) }],
      details: { snapshot, tabs } as Record<string, unknown>,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Browser snapshot failed: ${message}` }],
      isError: true,
      details: { action: 'snapshot', error: message },
    };
  }
}

export async function browserCdp(input: unknown, ctx: ExtensionBackendContext) {
  const { conversationId, signal } = getToolContext(ctx);
  const params = input as { command: unknown; continueOnError?: boolean; tabId?: string };
  try {
    const host = await requireActiveHost(conversationId, signal);
    const result = await withBrowserToolDeadline(
      'Browser CDP command',
      signal,
      host.cdp({
        conversationId,
        command: params.command,
        ...(params.continueOnError !== undefined ? { continueOnError: params.continueOnError } : {}),
        ...(params.tabId ? { tabId: params.tabId } : {}),
      }),
    );
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2).slice(0, 80_000) }],
      details: result as Record<string, unknown>,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: 'text' as const, text: `Browser CDP command failed: ${message}. Try browser_snapshot first to check the browser state.` },
      ],
      isError: true,
      details: { action: 'cdp', error: message },
    };
  }
}

export async function browserScreenshot(input: unknown, ctx: ExtensionBackendContext) {
  const { conversationId, signal } = getToolContext(ctx);
  const tabId = (input as { tabId?: string }).tabId;
  try {
    const host = await requireActiveHost(conversationId, signal);
    const screenshot = (await withBrowserToolDeadline('Browser screenshot', signal, host.screenshot(conversationId, tabId))) as {
      dataBase64?: string;
      mimeType?: string;
      url?: string;
      title?: string;
      viewport?: unknown;
      capturedAt?: string;
    };
    const image = normalizeScreenshotImage(screenshot);
    if (!image) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Browser screenshot failed: captured image data was empty or invalid. Try browser_snapshot first to check the browser state.',
          },
        ],
        isError: true,
        details: { action: 'screenshot', error: 'empty_image_data' },
      };
    }
    return {
      content: [
        { type: 'text' as const, text: 'Captured Workbench Browser screenshot.' },
        { type: 'image' as const, data: image.data, mimeType: image.mimeType },
      ],
      details: { url: screenshot.url, title: screenshot.title, viewport: screenshot.viewport, capturedAt: screenshot.capturedAt },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: 'text' as const, text: `Browser screenshot failed: ${message}. Try browser_snapshot first to check the browser state.` },
      ],
      isError: true,
      details: { action: 'screenshot', error: message },
    };
  }
}
