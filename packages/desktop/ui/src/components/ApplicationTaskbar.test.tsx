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

describe('ApplicationTaskbar', () => {
  const home = application('system-home:home', 'Home');
  const agent = application('system-agent:agent', 'Agent');

  it('keeps pinned applications stable before recency-ordered unpinned work', () => {
    const workspace: ApplicationWorkspaceState = {
      pinnedApplicationIds: [home.id, agent.id],
      pinsInitialized: true,
      activeViewId: agent.id,
      openViews: [
        { id: home.id, applicationId: home.id, route: '/home', title: 'Home', lastActiveAt: '2026-01-01T00:00:00.000Z' },
        { id: agent.id, applicationId: agent.id, route: '/conversations/new', title: 'Agent', lastActiveAt: '2026-01-02T00:00:00.000Z' },
      ],
    };
    expect(applicationTaskbarOrder([home, agent], workspace).map((item) => item.id)).toEqual([home.id, agent.id]);
  });

  it('activates an application and exposes pinning through its context menu', () => {
    const activate = vi.fn();
    const togglePinned = vi.fn();
    render(
      <ApplicationTaskbar
        applications={[home, agent]}
        workspace={{ pinnedApplicationIds: [home.id, agent.id], pinsInitialized: true, openViews: [], activeViewId: null }}
        activeApplicationId={null}
        onActivate={activate}
        onActivateView={() => undefined}
        onTogglePinned={togglePinned}
        onCloseView={() => undefined}
      />,
    );

    const agentButton = screen.getByRole('button', { name: 'Agent' });
    fireEvent.click(agentButton);
    expect(activate).toHaveBeenCalledWith(agent);

    fireEvent.contextMenu(agentButton);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin application' }));
    expect(togglePinned).toHaveBeenCalledWith(agent.id);
  });

  it('activates the exact selected view when a singleton application has resource views', () => {
    const runner = application('models:runner', 'Models');
    const activateView = vi.fn();
    const secondView = {
      id: 'models:runner:/models/two',
      applicationId: runner.id,
      route: '/models/two',
      title: 'Models · two',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
    };
    render(
      <ApplicationTaskbar
        applications={[runner]}
        workspace={{
          pinnedApplicationIds: [runner.id],
          pinsInitialized: true,
          activeViewId: runner.id,
          openViews: [
            {
              id: 'models:runner:/models/one',
              applicationId: runner.id,
              route: '/models/one',
              title: 'Models · one',
              lastActiveAt: '2026-01-01T00:00:00.000Z',
            },
            secondView,
          ],
        }}
        activeApplicationId={runner.id}
        onActivate={() => undefined}
        onActivateView={activateView}
        onTogglePinned={() => undefined}
        onCloseView={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Models, 2 open/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Models · two' }));
    expect(activateView).toHaveBeenCalledWith(secondView);
  });

  it('keeps a missing application visible as an unavailable recovery item', () => {
    const workspace: ApplicationWorkspaceState = {
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
    expect(applicationTaskbarOrder([], workspace)).toEqual([
      expect.objectContaining({ id: 'missing:app', title: 'Missing App', available: false }),
    ]);
  });

  it('keeps view activation and pin management available in overflow', () => {
    const applications = ['Home', 'Agent', 'System', 'Models', 'Reports'].map((title, index) =>
      application(`fixture-${index}:${title.toLowerCase()}`, title),
    );
    const reports = applications[4]!;
    const reportsView = {
      id: `${reports.id}:quarterly`,
      applicationId: reports.id,
      route: '/reports/quarterly',
      title: 'Reports · quarterly',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    };
    const activateView = vi.fn();
    const togglePinned = vi.fn();
    render(
      <ApplicationTaskbar
        applications={applications}
        workspace={{
          pinnedApplicationIds: applications.map((item) => item.id),
          pinsInitialized: true,
          activeViewId: reportsView.id,
          openViews: [reportsView],
        }}
        activeApplicationId={reports.id}
        onActivate={() => undefined}
        onActivateView={activateView}
        onTogglePinned={togglePinned}
        onCloseView={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '1 more applications' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Reports' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reports · quarterly' }));
    expect(activateView).toHaveBeenCalledWith(reportsView);
    expect(screen.queryByRole('menu', { name: 'More applications' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1 more applications' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Reports' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin application' }));
    expect(togglePinned).toHaveBeenCalledWith(reports.id);
  });
});
