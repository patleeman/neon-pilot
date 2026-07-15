// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApplicationWorkspaceState } from '../applications/applicationWorkspace';
import type { ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { ApplicationTaskbar, applicationTaskbarOrder } from './ApplicationTaskbar';

function application(id: string, title: string): ApplicationRegistration {
  return {
    id,
    extensionId: id.split(':')[0]!,
    localId: id.split(':')[1]!,
    title,
    startRoute: `/${title.toLowerCase()}`,
    instancePolicy: 'singleton',
    defaultPinned: false,
    order: 0,
    available: true,
    implicit: false,
    navigationSlots: [],
  };
}

function workspace(open: ApplicationRegistration[], activeViewId: string | null = open.at(-1)?.id ?? null): ApplicationWorkspaceState {
  return {
    pinnedApplicationIds: [],
    pinsInitialized: true,
    activeViewId,
    openViews: open.map((item) => ({
      id: item.id,
      applicationId: item.id,
      route: item.startRoute,
      title: item.title,
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    })),
  };
}

describe('ApplicationTaskbar', () => {
  const home = application('system-home:home', 'Home');
  const agent = application('system-agent:agent', 'Agent');
  const system = application('system-settings:system', 'System');

  it('shows only open applications in stable workspace order', () => {
    const state = { ...workspace([home, agent]), pinnedApplicationIds: [home.id, agent.id, system.id] };
    expect(applicationTaskbarOrder([system, agent, home], state).map((item) => item.id)).toEqual([home.id, agent.id]);
  });

  it('keeps every open application label visible and marks the active application', () => {
    render(
      <ApplicationTaskbar
        applications={[home, agent, system]}
        workspace={workspace([home, agent, system], agent.id)}
        activeApplicationId={agent.id}
        onActivate={() => undefined}
        onCloseApplication={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Agent' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('activates from the labeled tab and closes the whole application from its direct control', () => {
    const activate = vi.fn();
    const close = vi.fn();
    render(
      <ApplicationTaskbar
        applications={[home, agent]}
        workspace={workspace([home, agent], home.id)}
        activeApplicationId={home.id}
        onActivate={activate}
        onCloseApplication={close}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Agent' }));
    expect(activate).toHaveBeenCalledWith(agent);
    fireEvent.click(screen.getByRole('button', { name: 'Close Agent' }));
    expect(close).toHaveBeenCalledWith(agent.id);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('shows a count for multiple views without introducing a view dropdown', () => {
    const state = workspace([agent], agent.id);
    state.openViews.push({
      id: `${agent.id}:second`,
      applicationId: agent.id,
      route: '/evaluations/two',
      title: 'Agent · two',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
    });
    render(
      <ApplicationTaskbar
        applications={[agent]}
        workspace={state}
        activeApplicationId={agent.id}
        onActivate={() => undefined}
        onCloseApplication={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Agent, 2 open' })).not.toBeNull();
    expect(screen.getByText('2').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps a missing application readable and directly dismissible', () => {
    const close = vi.fn();
    const state: ApplicationWorkspaceState = {
      pinnedApplicationIds: [],
      pinsInitialized: true,
      activeViewId: 'missing:app',
      openViews: [
        {
          id: 'missing:app',
          applicationId: 'missing:app',
          route: '/missing/resource',
          title: 'Missing App',
          lastActiveAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    render(
      <ApplicationTaskbar
        applications={[]}
        workspace={state}
        activeApplicationId="missing:app"
        onActivate={() => undefined}
        onCloseApplication={close}
      />,
    );

    expect(screen.getByRole('button', { name: 'Missing App' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close Missing App' }));
    expect(close).toHaveBeenCalledWith('missing:app');
  });
});
