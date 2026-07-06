import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/extensions/backend/desktop', () => ({
  captureDesktopScreenshot: vi.fn(),
  controlDesktop: vi.fn(),
  readDesktopState: vi.fn(),
  readDesktopUserActionEvents: vi.fn(),
}));

import {
  captureDesktopScreenshot,
  controlDesktop,
  readDesktopState,
  readDesktopUserActionEvents,
} from '@neon-pilot/extensions/backend/desktop';

import { desktopControl, desktopScreenshot, desktopState, desktopWindowEvents } from './backend.js';

function mockContext() {
  return {
    extensionId: 'system-desktop-tools',
    runtimeScope: 'shared',
    runtimeDir: '/tmp',
    runtimeSettingsFilePath: '/tmp/settings.json',
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    database: { open: vi.fn(), close: vi.fn(), closeAll: vi.fn() },
    attention: { enqueue: vi.fn() },
    automations: { create: vi.fn(), remove: vi.fn(), list: vi.fn() },
    executions: { start: vi.fn(), cancel: vi.fn(), list: vi.fn(), getLog: vi.fn() },
    models: { complete: vi.fn() },
    knowledge: { search: vi.fn(), get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    conversations: { list: vi.fn(), getMeta: vi.fn(), getBlocks: vi.fn(), create: vi.fn() },
    filesystem: { workspace: vi.fn(), temp: vi.fn() },
    workspace: vi.fn(),
    git: { status: vi.fn(), diff: vi.fn() },
    shell: { exec: vi.fn() },
    runtime: {
      getLiveSessionResourceOptions: vi.fn(),
      getRepoRoot: vi.fn(() => '/repo'),
      refreshSkillMcpConfig: vi.fn(),
    },
  } as never;
}

describe('desktopState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the host semantic desktop state as tool content and details', async () => {
    const state = {
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 10, y: 20, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
          workspaceCwd: null,
          routeMetadata: { sessionId: 'draft' },
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-06T00:00:00.000Z',
      revision: 7,
      publisherId: 'windowed-layout:test',
    };
    vi.mocked(readDesktopState).mockResolvedValue(state);

    const result = await desktopState({}, mockContext());

    expect(readDesktopState).toHaveBeenCalledWith();
    expect(result.details).toEqual(state);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(state, null, 2) }]);
    expect(result.content[0]?.text).not.toContain('screenshot');
  });
});

describe('desktopControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the host renderer acknowledgement as tool content and details', async () => {
    const input = { action: 'focus', windowId: 'chat:draft' };
    const result = {
      ok: true,
      commandId: 'desktop-control-1',
      action: 'focus',
      status: 'completed',
    };
    vi.mocked(controlDesktop).mockResolvedValue(result);

    const output = await desktopControl(input, mockContext());

    expect(controlDesktop).toHaveBeenCalledWith(input);
    expect(output.details).toEqual(result);
    expect(output.content).toEqual([{ type: 'text', text: JSON.stringify(result, null, 2) }]);
  });
});

describe('desktopScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns screenshot metadata as text/details and PNG content as an image block', async () => {
    const input = { windowId: 'chat:draft' };
    const result = {
      ok: true,
      requestId: 'desktop-screenshot-1',
      status: 'completed',
      image: {
        mimeType: 'image/png' as const,
        data: 'cG5n',
        width: 640,
        height: 400,
        capturedAt: '2026-07-06T00:00:00.000Z',
        windowId: 'chat:draft',
      },
    };
    vi.mocked(captureDesktopScreenshot).mockResolvedValue(result);

    const output = await desktopScreenshot(input, mockContext());

    expect(captureDesktopScreenshot).toHaveBeenCalledWith(input);
    expect(output.details).toEqual({
      ...result,
      image: {
        mimeType: 'image/png',
        width: 640,
        height: 400,
        capturedAt: '2026-07-06T00:00:00.000Z',
        windowId: 'chat:draft',
      },
    });
    expect(output.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify(output.details, null, 2),
      },
      { type: 'image', data: 'cG5n', mimeType: 'image/png' },
    ]);
    expect(output.content[0]?.text).not.toContain('cG5n');
  });

  it('returns useful text for failed screenshot requests', async () => {
    const result = {
      ok: false,
      requestId: 'desktop-screenshot-2',
      status: 'failed',
      error: 'Window is minimized: chat:draft',
    };
    vi.mocked(captureDesktopScreenshot).mockResolvedValue(result);

    const output = await desktopScreenshot({ windowId: 'chat:draft' }, mockContext());

    expect(output.details).toEqual(result);
    expect(output.content).toEqual([{ type: 'text', text: 'desktop_screenshot failed: Window is minimized: chat:draft' }]);
  });
});

describe('desktopWindowEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the recent user action events as tool content and details', async () => {
    const events = [
      {
        id: 'desktop-user-action-test-1',
        source: 'user' as const,
        action: 'focus',
        windowId: 'chat:draft',
        title: 'New conversation',
        route: '/conversations/new',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
      {
        id: 'desktop-user-action-test-2',
        source: 'user' as const,
        action: 'close',
        windowId: 'route:system-notes:notes',
        title: 'Notes',
        route: '/notes',
        createdAt: '2026-07-06T00:00:01.000Z',
      },
    ];
    vi.mocked(readDesktopUserActionEvents).mockResolvedValue(events);

    const result = await desktopWindowEvents({}, mockContext());

    expect(readDesktopUserActionEvents).toHaveBeenCalledWith({});
    expect(result.details).toEqual(events);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(events, null, 2) }]);
  });

  it('passes lastEventId and limit through to the backend seam', async () => {
    const events = [
      {
        id: 'desktop-user-action-test-2',
        source: 'user' as const,
        action: 'close',
        windowId: 'route:system-notes:notes',
        createdAt: '2026-07-06T00:00:01.000Z',
      },
    ];
    vi.mocked(readDesktopUserActionEvents).mockResolvedValue(events);

    const input = { lastEventId: 'desktop-user-action-test-1', limit: 5 };
    const result = await desktopWindowEvents(input, mockContext());

    expect(readDesktopUserActionEvents).toHaveBeenCalledWith(input);
    expect(result.details).toEqual(events);
  });

  it('returns an empty array when no events are available', async () => {
    vi.mocked(readDesktopUserActionEvents).mockResolvedValue([]);

    const result = await desktopWindowEvents({}, mockContext());

    expect(result.details).toEqual([]);
    expect(result.content).toEqual([{ type: 'text', text: '[]' }]);
  });
});
