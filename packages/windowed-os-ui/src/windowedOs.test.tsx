import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WindowedPageMain, WindowedPageShell } from './windowedOs';

describe('WindowedPageShell', () => {
  it('defaults to the canonical single-pane page layout', () => {
    const html = renderToStaticMarkup(
      <WindowedPageShell>
        <WindowedPageMain title="Applications" />
      </WindowedPageShell>,
    );

    expect(html).toContain('data-layout="standard"');
  });

  it('still supports explicit two-column layouts for narrow legacy cases', () => {
    const html = renderToStaticMarkup(
      <WindowedPageShell layout="two-column">
        <WindowedPageMain title="Applications" />
      </WindowedPageShell>,
    );

    expect(html).toContain('data-layout="two-column"');
  });
});

describe('Windowed OS Storybook examples', () => {
  it('keeps canonical windowed page examples free of stable context rails', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).not.toContain('ui-context-rail');
    expect(source).not.toContain('ui-app-page-');
  });

  it('documents the Settings-only two-column rail pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const SettingsTwoColumnPage');
    expect(source).toContain('layout="two-column"');
    expect(source).toContain('<WindowedPageRail');
    expect(source).toContain('showHeader={false}');
    expect(source).toContain('title="Settings sections"');
  });

  it('documents the canonical Workflows desktop page and subwindow pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const WorkflowsPage');
    expect(source).toContain('title="Workflows"');
    expect(source).toContain('eyebrow="Dynamic workflows"');
    expect(source).toContain('title="Inventory"');
    expect(source).toContain('title="Runs"');
    expect(source).toContain('title="Library"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="Repo audit"');
  });

  it('keeps the desktop composition aligned with the canonical top-level app roster', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const canonicalTitles = [
      'Chat',
      'Automations',
      'Workflows',
      'Gateways',
      'Model Arena',
      'Routines',
      'Extensions',
      'Skills',
      'Diagnostics',
      'Settings',
    ];

    for (const title of canonicalTitles) {
      expect(source).toContain(`title: '${title}'`);
    }
    expect(source).not.toContain("title: 'Prompt Assembly'");

    const rosterStart = source.indexOf('const canonicalDesktopApps = [');
    expect(rosterStart).toBeGreaterThanOrEqual(0);
    let previousIndex = rosterStart;
    for (const title of canonicalTitles) {
      const nextIndex = source.indexOf(`title: '${title}'`, previousIndex);
      expect(nextIndex).toBeGreaterThan(previousIndex);
      previousIndex = nextIndex;
    }
  });
});
