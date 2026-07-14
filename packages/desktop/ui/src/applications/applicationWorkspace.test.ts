import { describe, expect, it } from 'vitest';

import type { ApplicationNavigationRegistration, ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import {
  closeApplicationView,
  EMPTY_APPLICATION_WORKSPACE,
  fallbackApplication,
  focusApplicationRoute,
  reconcileApplicationWorkspace,
  resolveApplicationForRoute,
  toggleApplicationPinned,
} from './applicationWorkspace';

function application(overrides: Partial<ApplicationRegistration> = {}): ApplicationRegistration {
  return {
    id: 'system-agent:agent',
    extensionId: 'system-agent',
    localId: 'agent',
    title: 'Agent',
    startRoute: '/conversations/new',
    instancePolicy: 'singleton',
    defaultPinned: true,
    order: 10,
    available: true,
    implicit: false,
    navigationSlots: [],
    ...overrides,
  };
}

function navigation(overrides: Partial<ApplicationNavigationRegistration> = {}): ApplicationNavigationRegistration {
  return {
    id: 'system-agent:chat',
    extensionId: 'system-agent',
    applicationId: 'system-agent:agent',
    label: 'Chat',
    route: '/conversations',
    slot: 'primary',
    slotOrder: 0,
    order: 0,
    ...overrides,
  };
}

describe('application workspace', () => {
  it('resolves the longest matching application route', () => {
    const agent = application();
    const system = application({
      id: 'system-settings:system',
      extensionId: 'system-settings',
      localId: 'system',
      title: 'System',
      startRoute: '/settings',
    });
    expect(
      resolveApplicationForRoute(
        '/conversations/abc',
        [agent, system],
        [navigation(), navigation({ id: 'settings', applicationId: system.id, route: '/settings' })],
      )?.id,
    ).toBe(agent.id);
  });

  it('resolves application-owned main routes that are not navigation entries', () => {
    const reports = application({
      id: 'reports:app',
      extensionId: 'reports',
      localId: 'app',
      startRoute: '/reports',
      routes: ['/reports', '/documents'],
    });
    expect(resolveApplicationForRoute('/documents/quarterly', [reports], [])?.id).toBe(reports.id);
  });

  it('reuses a singleton while preserving its latest internal route', () => {
    const agent = application();
    const opened = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, agent, '/conversations/one', '2026-01-01T00:00:00.000Z');
    const moved = focusApplicationRoute(opened, agent, '/automations', '2026-01-01T00:01:00.000Z');
    expect(moved.openViews).toEqual([expect.objectContaining({ id: agent.id, applicationId: agent.id, route: '/automations' })]);
  });

  it('creates distinct route views for a multiple-instance application', () => {
    const multi = application({ id: 'models:runner', instancePolicy: 'multiple' });
    const first = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, multi, '/models/one');
    const second = focusApplicationRoute(first, multi, '/models/two');
    expect(second.openViews.map((view) => view.route)).toEqual(['/models/one', '/models/two']);
  });

  it('opens resource views separately inside an otherwise singleton application', () => {
    const agent = application();
    const first = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, agent, '/evaluations/one', undefined, 'resource');
    const second = focusApplicationRoute(first, agent, '/evaluations/two', undefined, 'resource');
    expect(second.openViews.map((view) => view.route)).toEqual(['/evaluations/one', '/evaluations/two']);
    expect(second.openViews.map((view) => view.title)).toEqual(['Agent · one', 'Agent · two']);
  });

  it('keeps resource views intact when a singleton application opens its internal view', () => {
    const agent = application();
    const resource = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, agent, '/evaluations/one', undefined, 'resource');
    const internal = focusApplicationRoute(resource, agent, '/automations', undefined, 'internal');
    expect(internal.openViews).toEqual([
      expect.objectContaining({ id: `${agent.id}:${encodeURIComponent('/evaluations/one')}`, route: '/evaluations/one' }),
      expect.objectContaining({ id: agent.id, route: '/automations' }),
    ]);
  });

  it('retains missing application views so the shell can offer recovery', () => {
    const opened = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, application(), '/automations');
    const reconciled = reconcileApplicationWorkspace(opened, []);
    expect(reconciled.openViews).toEqual(opened.openViews);
    expect(reconciled.activeViewId).toBe(opened.activeViewId);
  });

  it('closing dismisses only the shell view and pinning remains independent', () => {
    const agent = application();
    const opened = focusApplicationRoute(EMPTY_APPLICATION_WORKSPACE, agent, '/conversations/one');
    const pinned = toggleApplicationPinned(opened, agent.id);
    const closed = closeApplicationView(pinned, agent.id);
    expect(closed.openViews).toEqual([]);
    expect(closed.pinnedApplicationIds).toEqual([agent.id]);
  });

  it('uses default pins only before a user pin selection exists and falls back to the first pin', () => {
    const home = application({
      id: 'system-home:home',
      extensionId: 'system-home',
      localId: 'home',
      title: 'Home',
      startRoute: '/home',
      order: 0,
    });
    const agent = application();
    const reconciled = reconcileApplicationWorkspace(EMPTY_APPLICATION_WORKSPACE, [home, agent]);
    expect(reconciled.pinnedApplicationIds).toEqual([home.id, agent.id]);
    expect(fallbackApplication(reconciled, [home, agent])?.id).toBe(home.id);

    const allUnpinned = reconcileApplicationWorkspace({ ...reconciled, pinnedApplicationIds: [], pinsInitialized: true }, [home, agent]);
    expect(allUnpinned.pinnedApplicationIds).toEqual([]);
  });
});
