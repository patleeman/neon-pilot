// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RoutinesPage } from './RoutinesPage.js';

const state = {
  hooks: [
    {
      id: 'checkpoint',
      title: 'Checkpoint',
      group: 'Tools',
      description: 'Routines that run around checkpointing.',
      ownerExtensionId: 'system-diffs',
      variables: [],
      summary: 'Review code changes',
    },
  ],
  routines: [
    {
      id: 'r1',
      hookId: 'checkpoint',
      position: 'before',
      type: 'decision',
      name: 'Review code changes',
      instruction: 'Use /skill:autoreview',
      enabled: true,
      order: 0,
      failureBehavior: 'block',
      outcomes: [{ id: 'pass', label: 'Pass', target: 'Continue checkpoint', behavior: 'continue' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  runs: [],
};

function pa() {
  return {
    extension: {
      invoke: vi.fn(async (action: string) => (action === 'listSkills' ? { skills: [{ id: 'autoreview', name: 'Autoreview' }] } : state)),
    },
    ui: { toast: vi.fn(), confirm: vi.fn(async () => true) },
  } as never;
}

function props() {
  return {
    pa: pa(),
    context: { extensionId: 'system-routines', surfaceId: 'page', pathname: '/routines', route: '/routines', search: '', hash: '' },
    surface: { id: 'page', title: 'Routines', location: 'main', component: 'RoutinesPage' },
    params: {},
  } as never;
}

describe('RoutinesPage', () => {
  it('renders the timeline and routine inspector', async () => {
    render(<RoutinesPage {...props()} />);
    expect(await screen.findByText('Checkpoint timeline')).toBeTruthy();
    expect(screen.getAllByText('Review code changes').length).toBeGreaterThan(0);
    expect(screen.getByText('Add routine ▾')).toBeTruthy();
    expect(screen.getByText('Decision output is constrained to these enum values.')).toBeTruthy();
  });
});
