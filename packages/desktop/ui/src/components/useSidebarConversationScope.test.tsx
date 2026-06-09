// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useSidebarConversationScope } from './useSidebarConversationScope';

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

function renderScope(locationPathname: string): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ root, container });

  function Harness() {
    const scope = useSidebarConversationScope({
      draftCwd: '',
      liveTitles: new Map(),
      locationPathname,
      pinnedSessions: [],
      sessions: [],
      tabs: [],
    });
    return <span data-active-conversation-id={scope.activeConversationId ?? ''}>{scope.activeConversationId ?? 'none'}</span>;
  }

  root.render(<Harness />);
  return container.textContent ?? '';
}

describe('useSidebarConversationScope', () => {
  afterEach(() => {
    for (const { root, container } of roots.splice(0)) {
      root.unmount();
      container.remove();
    }
  });

  it('ignores malformed conversation route ids without throwing', () => {
    expect(() => renderScope('/conversations/%E0%A4%A')).not.toThrow();
  });
});
