import { describe, expect, it } from 'vitest';

import { shouldUseDocumentNavigationForSidebarRoute } from './sidebarNavigationRouting';

describe('shouldUseDocumentNavigationForSidebarRoute', () => {
  const documentNavigationRoutes = ['/automations', '/gateways', '/routines', '/telemetry'];

  it('uses document navigation when switching between legacy extension pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/ext/hermes')).toBe(true);
  });

  it('uses document navigation when switching between registered top-level app pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/routines', documentNavigationRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/routines', '/gateways', documentNavigationRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways/setup', '/routines', documentNavigationRoutes)).toBe(true);
  });

  it('keeps router navigation for core routes and same-app clicks', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/settings')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/hermes', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/settings', documentNavigationRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/gateways', documentNavigationRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/gateways', documentNavigationRoutes)).toBe(false);
  });
});
