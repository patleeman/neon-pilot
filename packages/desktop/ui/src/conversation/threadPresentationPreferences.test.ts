// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  normalizeStoredThreadStringList,
  readConversationGroupLabelOverrides,
  readManualConversationGroupOrder,
  readThreadsFilterMode,
  readThreadsOrganizeMode,
  readThreadsSortMode,
  writeConversationGroupLabelOverrides,
  writeManualConversationGroupOrder,
  writeThreadsFilterMode,
  writeThreadsOrganizeMode,
  writeThreadsSortMode,
} from './threadPresentationPreferences';

describe('threadPresentationPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes stored thread string lists', () => {
    expect(normalizeStoredThreadStringList([' a ', '', 'a', 'b', null])).toEqual(['a', 'b']);
  });

  it('persists thread view modes with safe defaults', () => {
    expect(readThreadsOrganizeMode()).toBe('project');
    expect(readThreadsFilterMode()).toBe('all');
    expect(readThreadsSortMode()).toBe('created');

    writeThreadsOrganizeMode('chronological');
    writeThreadsFilterMode('automation');
    writeThreadsSortMode('updated');

    expect(readThreadsOrganizeMode()).toBe('chronological');
    expect(readThreadsFilterMode()).toBe('automation');
    expect(readThreadsSortMode()).toBe('updated');
  });

  it('lets manual ordering coexist with project organization', () => {
    writeThreadsOrganizeMode('project');
    writeThreadsSortMode('manual');

    expect(readThreadsOrganizeMode()).toBe('project');
    expect(readThreadsSortMode()).toBe('manual');
  });

  it('preserves legacy manual organize mode as manual sort', () => {
    writeThreadsOrganizeMode('project');
    window.localStorage.setItem('pa:sidebar-nav-section:threads-organize', 'manual');

    expect(readThreadsOrganizeMode()).toBe('chronological');
    expect(readThreadsSortMode()).toBe('manual');
  });

  it('persists group ordering and labels', () => {
    writeManualConversationGroupOrder(['repo', 'repo', 'chats']);
    writeConversationGroupLabelOverrides({ repo: ' Repo ', empty: ' ' });

    expect(readManualConversationGroupOrder()).toEqual(['repo', 'chats']);
    expect(readConversationGroupLabelOverrides()).toEqual({ repo: 'Repo' });
  });
});
