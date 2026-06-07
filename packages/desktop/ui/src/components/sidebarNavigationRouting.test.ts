import { describe, expect, it } from 'vitest';

import { shouldUseDocumentNavigationForSidebarRoute } from './sidebarNavigationRouting';

describe('shouldUseDocumentNavigationForSidebarRoute', () => {
  it('uses document navigation when switching between different extension pages', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/ext/hermes')).toBe(true);
  });

  it('keeps router navigation for core routes and same-extension clicks', () => {
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/writing-studio', '/settings')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/settings', '/ext/hermes')).toBe(false);
    expect(shouldUseDocumentNavigationForSidebarRoute('/ext/hermes', '/ext/hermes')).toBe(false);
  });
});
