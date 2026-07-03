import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WindowedEmptyState, WindowedPageMain, WindowedPageShell } from './windowedOs';

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

describe('WindowedEmptyState', () => {
  it('renders compact empty content with an optional action', () => {
    const html = renderToStaticMarkup(
      <WindowedEmptyState action={<button type="button">Create</button>}>No workflow runs yet.</WindowedEmptyState>,
    );

    expect(html).toContain('class="wos-empty-state"');
    expect(html).toContain('No workflow runs yet.');
    expect(html).toContain('wos-empty-state__action');
    expect(html).toContain('Create');
  });

  it('supports danger tone for inline recoverable errors', () => {
    const html = renderToStaticMarkup(<WindowedEmptyState tone="danger">Could not load workflows.</WindowedEmptyState>);

    expect(html).toContain('data-tone="danger"');
    expect(html).toContain('Could not load workflows.');
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

  it('documents the canonical Automations desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const AutomationsPage');
    expect(source).toContain('title="Automations"');
    expect(source).toContain('eyebrow="Scheduled work"');
    expect(source).toContain('title="Queue"');
    expect(source).toContain('title="Selected automation"');
    expect(source).toContain('ariaLabel="Automation filter"');
  });

  it('documents the canonical Gateways desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const GatewaysPage');
    expect(source).toContain('title="Gateways"');
    expect(source).toContain('eyebrow="Ingress"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Selected gateway"');
    expect(source).toContain('ariaLabel="Gateway filter"');
  });

  it('documents the canonical Routines desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const RoutinesPage');
    expect(source).toContain('title="Routines"');
    expect(source).toContain('eyebrow="Agent hooks"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Selected routine"');
    expect(source).toContain('title="Recent runs"');
    expect(source).toContain('ariaLabel="Routine scope"');
  });

  it('documents the canonical Model Arena desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const ModelArenaPage');
    expect(source).toContain('title="Model Arena"');
    expect(source).toContain('eyebrow="Model duels"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Active duel"');
    expect(source).toContain('title="Rankings"');
    expect(source).toContain('title="Challengers"');
    expect(source).toContain('Toggle automatic duels');
  });

  it('documents the canonical Diagnostics desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const DiagnosticsPage');
    expect(source).toContain('title="Diagnostics"');
    expect(source).toContain('eyebrow="Telemetry"');
    expect(source).toContain('title="Health"');
    expect(source).toContain('title="Usage"');
    expect(source).toContain('title="Traces"');
    expect(source).toContain('Export trace');
  });

  it('documents the canonical Skills desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const SkillsPage');
    expect(source).toContain('title="Skills"');
    expect(source).toContain('eyebrow="Skill library"');
    expect(source).toContain('title="Inventory"');
    expect(source).toContain('title="Installed skills"');
    expect(source).toContain('title="Marketplace"');
    expect(source).toContain('ariaLabel="Skills view"');
  });

  it('documents the canonical Extensions desktop page and detail subwindow pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const ExtensionsPage');
    expect(source).toContain('title="Extensions"');
    expect(source).toContain('eyebrow="Extension manager"');
    expect(source).toContain('title="Inventory"');
    expect(source).toContain('title="Installed extensions"');
    expect(source).toContain('title="Sources"');
    expect(source).toContain('title="Review queue"');
    expect(source).toContain('ariaLabel="Extensions view"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="system-browser"');
    expect(source).toContain('export const ExtensionsInstallDialog');
    expect(source).toContain('title="Install extension"');
    expect(source).toContain('wos-extension-install-dialog');
    expect(source).toContain('title="Repositories"');
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
