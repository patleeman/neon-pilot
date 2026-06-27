import { describe, expect, it } from 'vitest';

import { shouldUseDocumentNavigationForSidebarRoute } from './sidebarNavigationRouting';

describe('shouldUseDocumentNavigationForSidebarRoute', () => {
  const extensionRoutes = ['/automations', '/gateways', '/routines', '/telemetry'];

  it('uses document navigation when switching between different extension pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/ext/hermes')).toBe(true);
  });

  it('uses document navigation when switching between registered top-level extension pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/routines', extensionRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/routines', '/gateways', extensionRoutes)).toBe(true);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways/setup', '/routines', extensionRoutes)).toBe(true);
  });

  it('keeps router navigation for core routes and same-extension clicks', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/settings')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/hermes', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/settings', extensionRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/gateways', extensionRoutes)).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/gateways', '/gateways', extensionRoutes)).toBe(false);
  });
});
