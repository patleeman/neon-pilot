import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeDesktopControlCommand,
  type DesktopControlCommand,
  issueDesktopControlCommand,
  resetDesktopControlForTests,
  subscribeDesktopControlCommands,
} from './localApiDesktopControl.js';
import {
  publishDesktopUserActionEvent,
  readDesktopUserActionEvents,
  resetDesktopUserActionEventsForTests,
} from './localApiDesktopEvents.js';
import {
  acknowledgeDesktopScreenshotRequest,
  type DesktopScreenshotImage,
  type DesktopScreenshotRequest,
  issueDesktopScreenshotRequest,
  resetDesktopScreenshotForTests,
  subscribeDesktopScreenshotRequests,
} from './localApiDesktopScreenshot.js';
import {
  type DesktopStateSnapshotInput,
  readDesktopStateSnapshot,
  resetDesktopStateSnapshotForTests,
  storeDesktopStateSnapshot,
} from './localApiDesktopState.js';

describe('agent-visible desktop-control workflow integration', () => {
  beforeEach(() => {
    resetDesktopControlForTests();
    resetDesktopScreenshotForTests();
    resetDesktopStateSnapshotForTests();
    resetDesktopUserActionEventsForTests();
  });

  it('chains open command, state publish, and screenshot request as an agent would', async () => {
    // Step 1-2: issue a desktop_control open command and capture it as the renderer would.
    const controlListener = vi.fn();
    const unsubscribeControl = subscribeDesktopControlCommands(controlListener);

    const openPromise = issueDesktopControlCommand({
      action: 'open',
      appId: 'system-notes',
      route: '/notes',
      timeoutMs: 500,
    });

    expect(controlListener).toHaveBeenCalledTimes(1);
    const command = controlListener.mock.calls[0]?.[0] as DesktopControlCommand;
    expect(command.action).toBe('open');
    expect(command.appId).toBe('system-notes');
    expect(command.route).toBe('/notes');
    expect(command.id).toMatch(/^desktop-control-/);

    // Step 3: renderer acknowledges the command.
    const ackResult = acknowledgeDesktopControlCommand({
      commandId: command.id,
      ok: true,
    });
    expect(ackResult.ok).toBe(true);
    expect(ackResult.status).toBe('completed');

    // Step 4: agent-side promise resolves with expected result.
    await expect(openPromise).resolves.toEqual({
      ok: true,
      commandId: command.id,
      action: 'open',
      status: 'completed',
    });

    unsubscribeControl();

    // Step 5: renderer publishes desktop state with the opened window.
    const stateInput: DesktopStateSnapshotInput = {
      windows: [
        {
          id: 'route:system-notes:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
          routeMetadata: { appId: 'system-notes', singleton: true },
        },
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 9,
          workspaceCwd: null,
          routeMetadata: { sessionId: 'draft' },
        },
      ],
      focusedWindowId: 'route:system-notes:notes',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    };

    const stored = storeDesktopStateSnapshot(stateInput);
    expect(stored.ok).toBe(true);
    expect(stored.windows).toHaveLength(2);

    // Step 6: agent reads state and finds the opened window.
    const snapshot = readDesktopStateSnapshot();
    expect(snapshot.windows).toHaveLength(2);
    const notesWindow = snapshot.windows.find((w) => w.id === 'route:system-notes:notes');
    expect(notesWindow).toBeDefined();
    expect(notesWindow?.kind).toBe('route');
    expect(notesWindow?.title).toBe('Notes');
    expect(notesWindow?.route).toBe('/notes');
    expect(notesWindow?.focused).toBe(true);
    expect(notesWindow?.routeMetadata).toEqual({ appId: 'system-notes', singleton: true });
    expect(notesWindow?.bounds).toEqual({ x: 90, y: 70, width: 760, height: 520 });
    expect(snapshot.focusedWindowId).toBe('route:system-notes:notes');

    // Step 7: agent issues a screenshot request for the opened window.
    const screenshotListener = vi.fn();
    const unsubscribeScreenshot = subscribeDesktopScreenshotRequests(screenshotListener);

    const screenshotPromise = issueDesktopScreenshotRequest({
      windowId: 'route:system-notes:notes',
      timeoutMs: 500,
    });

    expect(screenshotListener).toHaveBeenCalledTimes(1);
    const request = screenshotListener.mock.calls[0]?.[0] as DesktopScreenshotRequest;
    expect(request.windowId).toBe('route:system-notes:notes');
    expect(request.id).toMatch(/^desktop-screenshot-/);

    // Step 8-9: renderer acknowledges with a valid image payload.
    const image: DesktopScreenshotImage = {
      mimeType: 'image/png',
      data: Buffer.from('screenshot-payload').toString('base64'),
      width: 760,
      height: 520,
      capturedAt: '2026-07-05T12:34:57.000Z',
      windowId: 'route:system-notes:notes',
    };

    const screenshotAck = acknowledgeDesktopScreenshotRequest({
      requestId: request.id,
      ok: true,
      image,
    });
    expect(screenshotAck.ok).toBe(true);
    expect(screenshotAck.status).toBe('completed');
    expect(screenshotAck.image).toBeDefined();
    expect(screenshotAck.image?.mimeType).toBe('image/png');
    expect(screenshotAck.image?.windowId).toBe('route:system-notes:notes');
    expect(screenshotAck.image?.width).toBe(760);
    expect(screenshotAck.image?.height).toBe(520);

    // Step 10: agent-side promise resolves with the expected image.
    await expect(screenshotPromise).resolves.toEqual({
      ok: true,
      requestId: request.id,
      status: 'completed',
      image,
    });

    unsubscribeScreenshot();
  });

  it('rejects screenshot for a window that was opened but then closed (state reflects close)', async () => {
    // Issue open command and acknowledge it
    const controlListener = vi.fn();
    const unsubscribeControl = subscribeDesktopControlCommands(controlListener);

    const openPromise = issueDesktopControlCommand({
      action: 'open',
      appId: 'system-notes',
      route: '/notes',
      timeoutMs: 500,
    });

    const command = controlListener.mock.calls[0]?.[0] as DesktopControlCommand;
    acknowledgeDesktopControlCommand({ commandId: command.id, ok: true });
    await expect(openPromise).resolves.toMatchObject({ ok: true, status: 'completed' });
    unsubscribeControl();

    // Publish state where the window exists
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:system-notes:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:system-notes:notes',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
    });

    // Publish state where the window is gone (closed)
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-05T12:35:00.000Z',
      revision: 2,
    });

    // Agent reads state; opened window is no longer present.
    const snapshot = readDesktopStateSnapshot();
    expect(snapshot.windows.find((w) => w.id === 'route:system-notes:notes')).toBeUndefined();

    // Issue a screenshot request for the closed window
    const screenshotListener = vi.fn();
    subscribeDesktopScreenshotRequests(screenshotListener);

    const screenshotPromise = issueDesktopScreenshotRequest({
      windowId: 'route:system-notes:notes',
      timeoutMs: 500,
    });

    const request = screenshotListener.mock.calls[0]?.[0] as DesktopScreenshotRequest;

    // Renderer acknowledges with failure because the window no longer exists
    acknowledgeDesktopScreenshotRequest({
      requestId: request.id,
      ok: false,
      error: 'Window no longer exists in desktop state.',
    });

    await expect(screenshotPromise).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      error: 'Window no longer exists in desktop state.',
    });
  });

  it('preserves control timeout independent of state fetching and screenshot lifecycles', async () => {
    // Issue a control command that will time out
    const timeoutPromise = issueDesktopControlCommand({ action: 'focus', windowId: 'chat:draft', timeoutMs: 100 });

    // Meanwhile, agent can still read state (which is empty) without interfering
    expect(readDesktopStateSnapshot()).toMatchObject({ windows: [], focusedWindowId: null });

    // The control command eventually times out
    await expect(timeoutPromise).resolves.toMatchObject({
      ok: false,
      action: 'focus',
      status: 'timeout',
    });

    // State lifecycle is unaffected by the timeout
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'Draft',
          route: '/conversations/new',
          bounds: { x: 0, y: 0, width: 640, height: 480 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:56.000Z',
    });
    expect(readDesktopStateSnapshot().windows).toHaveLength(1);
  });

  it('proves desktop events readback and pagination alongside agent-touched state', async () => {
    // Step 1: Store semantic desktop state with agent-touched windows.
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
          agentTouched: true,
          workspaceCwd: null,
          routeMetadata: { sessionId: 'draft' },
        },
        {
          id: 'route:system-notes:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 9,
          agentTouched: true,
          routeMetadata: { appId: 'system-notes', singleton: true },
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-07T00:00:00.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    });

    // Step 2: Publish renderer-reported user-action events for those windows.
    const moveEvent = publishDesktopUserActionEvent({
      action: 'move',
      windowId: 'chat:draft',
      kind: 'chat',
      title: 'New conversation',
      route: '/conversations/new',
      createdAt: '2026-07-07T00:01:00.000Z',
    });

    const resizeEvent = publishDesktopUserActionEvent({
      action: 'resize',
      windowId: 'chat:draft',
      kind: 'chat',
      title: 'New conversation',
      route: '/conversations/new',
      createdAt: '2026-07-07T00:01:01.000Z',
    });

    const maximizeEvent = publishDesktopUserActionEvent({
      action: 'maximize',
      windowId: 'route:system-notes:notes',
      kind: 'route',
      title: 'Notes',
      route: '/notes',
      createdAt: '2026-07-07T00:01:02.000Z',
    });

    // Step 3: Agent reads state and confirms the touched windows exist.
    const snapshot = readDesktopStateSnapshot();
    expect(snapshot.windows).toHaveLength(2);
    expect(snapshot.windows.map((w) => w.id)).toEqual(['chat:draft', 'route:system-notes:notes']);
    expect(snapshot.windows.every((w) => w.agentTouched === true)).toBe(true);

    // Step 4: Agent reads all user-action events
    const allEvents = readDesktopUserActionEvents({ limit: 10 });
    expect(allEvents).toHaveLength(3);
    expect(allEvents[0]).toEqual(moveEvent.event);
    expect(allEvents[1]).toEqual(resizeEvent.event);
    expect(allEvents[2]).toEqual(maximizeEvent.event);

    // Step 5: Agent paginates after the first event
    const afterMove = readDesktopUserActionEvents({ lastEventId: moveEvent.event.id, limit: 10 });
    expect(afterMove).toHaveLength(2);
    expect(afterMove[0]).toEqual(resizeEvent.event);
    expect(afterMove[1]).toEqual(maximizeEvent.event);

    // Step 6: Agent paginates after the last event (empty result)
    const afterLast = readDesktopUserActionEvents({ lastEventId: maximizeEvent.event.id });
    expect(afterLast).toEqual([]);

    // Step 7: Agent can still read state independently
    const refreshedSnapshot = readDesktopStateSnapshot();
    expect(refreshedSnapshot.windows).toHaveLength(2);
  });
});
