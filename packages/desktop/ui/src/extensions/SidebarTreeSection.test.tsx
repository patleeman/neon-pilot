// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from '../activity/activityTree';
import { SidebarTreeSection } from './SidebarTreeSection';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: ActivityTreeItem[] = [
  { id: 'group:prompts', kind: 'group', title: 'Prompt Presets', status: 'idle' },
  {
    id: 'conversation:review',
    kind: 'conversation',
    parentId: 'group:prompts',
    title: 'Code review',
    status: 'idle',
    metadata: { conversationId: 'review' },
  },
];

describe('SidebarTreeSection', () => {
  it('combines native sidebar section chrome with the activity tree', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<SidebarTreeSection title="Presets" items={items} ariaLabel="Preset tree" />);
      });

      expect(container.querySelector('.ui-sidebar-section-title')?.textContent).toBe('Presets');
      expect(container.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe('Preset tree');
      expect(container.textContent).toContain('Prompt Presets');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
