import { describe, expect, it } from 'vitest';

import { shouldUseDocumentNavigationForSidebarRoute } from './sidebarNavigationRouting';

describe('shouldUseDocumentNavigationForSidebarRoute', () => {
  const documentNavigationRoutes = ['/automations', '/extensions', '/apps'];

  it('uses document navigation when switching between legacy extension pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/ext/hermes')).toBe(true);
  });

  it('uses document navigation when switching between registered top-level app pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/automations', '/extensions', documentNavigationRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/extensions', '/automations', documentNavigationRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/automations/detail', '/extensions', documentNavigationRoutes)).toBe(true);
  });

  it('keeps router navigation for core routes and same-app clicks', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/settings')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/hermes', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/automations', '/settings', documentNavigationRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/automations', documentNavigationRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/automations', '/automations', documentNavigationRoutes)).toBe(false);
  });
});
