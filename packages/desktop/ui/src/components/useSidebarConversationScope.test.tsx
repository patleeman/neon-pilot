// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { conversationRuntimeStore } from '../store';
import { useSidebarConversationScope } from './useSidebarConversationScope';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

function renderScope({
  liveTitles = new Map<string, string>(),
  locationPathname,
  sessionsReady = true,
}: {
  liveTitles?: Map<string, string>;
  locationPathname: string;
  sessionsReady?: boolean;
}): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ root, container });

  function Harness() {
    const scope = useSidebarConversationScope({
      draftCwd: '',
      liveTitles,
      locationPathname,
      pinnedSessions: [],
      sessions: [],
      sessionsReady,
      tabs: [],
    });
    return (
      <span data-active-conversation-id={scope.activeConversationId ?? ''} data-visible-tab-count={scope.visibleConversationTabs.length}>
        {scope.visibleConversationTabs.map((session) => session.title).join(',') || 'none'}
      </span>
    );
  }

  act(() => {
    root.render(<Harness />);
  });
  return container.textContent ?? '';
}

describe('useSidebarConversationScope', () => {
  afterEach(() => {
    for (const { root, container } of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    conversationRuntimeStore.reset?.();
  });

  it('ignores malformed conversation route ids without throwing', () => {
    expect(() => renderScope({ locationPathname: '/conversations/%E0%A4%A' })).not.toThrow();
  });

  it('does not synthesize a placeholder row for a missing conversation after sessions load', () => {
    expect(renderScope({ locationPathname: '/conversations/missing-thread', sessionsReady: true })).toBe('none');
  });

  it('keeps a temporary row while active conversation metadata can still arrive', () => {
    expect(renderScope({ locationPathname: '/conversations/loading-thread', sessionsReady: false })).toBe('Connecting…');
  });

  it('keeps a temporary row for a live title even when the session snapshot is loaded', () => {
    expect(
      renderScope({
        liveTitles: new Map([['live-thread', 'Live thread']]),
        locationPathname: '/conversations/live-thread',
        sessionsReady: true,
      }),
    ).toBe('Live thread');
  });
});
