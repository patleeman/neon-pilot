import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  WindowedDialogCopy,
  WindowedDialogStack,
  WindowedEmptyState,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageShell,
  WindowedToolbar,
} from './windowedOs';

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

  it('keeps empty states neutral so errors use state blocks instead', () => {
    const html = renderToStaticMarkup(<WindowedEmptyState>No workflow runs yet.</WindowedEmptyState>);

    expect(html).toContain('data-tone="neutral"');
    expect(html).not.toContain('data-tone="danger"');
    expect(html).toContain('No workflow runs yet.');
  });
});

describe('WindowedToolbar', () => {
  it('renders compact toolbar primary and end slots', () => {
    const html = renderToStaticMarkup(
      <WindowedToolbar end={<WindowedPageButton>Clear</WindowedPageButton>}>
        <input aria-label="Search" />
      </WindowedToolbar>,
    );

    expect(html).toContain('class="wos-toolbar"');
    expect(html).toContain('wos-toolbar__primary');
    expect(html).toContain('wos-toolbar__end');
    expect(html).toContain('Search');
    expect(html).toContain('Clear');
  });

  it('can render as a form for search and filter controls', () => {
    const html = renderToStaticMarkup(
      <WindowedToolbar as="form">
        <input aria-label="Search" />
      </WindowedToolbar>,
    );

    expect(html).toContain('<form');
    expect(html).toContain('class="wos-toolbar"');
  });
});

describe('WindowedDialog content primitives', () => {
  it('renders scoped dialog stack and copy classes for reusable subwindow content', () => {
    const html = renderToStaticMarkup(
      <WindowedDialogStack>
        <WindowedDialogCopy>Browser and app checks for local product QA.</WindowedDialogCopy>
      </WindowedDialogStack>,
    );

    expect(html).toContain('class="wos-dialog-stack"');
    expect(html).toContain('class="wos-dialog-copy"');
    expect(html).toContain('Browser and app checks for local product QA.');
  });
});

describe('Windowed OS Storybook examples', () => {
  it('keeps canonical design tokens in the scoped token stylesheet', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const tokensPath = fileURLToPath(new URL('./tokens.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');
    const tokensSource = readFileSync(tokensPath, 'utf8');

    expect(stylesSource.startsWith("@import './tokens.css';")).toBe(true);
    expect(tokensSource).toContain('.windowed-os-shell');
    expect(tokensSource).toContain('--wos-surface-0: oklch(95% 0.022 75);');
    expect(tokensSource).toContain('--wos-extensions: oklch(70% 0.15 60);');
    expect(tokensSource).toContain('--wos-titlebar-h: 42px;');
    expect(stylesSource).not.toContain('--wos-surface-0: oklch(95% 0.022 75);');
  });

  it('contains iframe paint inside window bodies and hides iframes during shell interaction', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window__body {\n  position: relative;');
    expect(stylesSource).toContain('contain: paint;');
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] .wos-window__body iframe");
    expect(stylesSource).toContain('visibility: hidden;');
    expect(stylesSource).toContain('pointer-events: none;');
  });

  it('keeps isolated Storybook examples on scoped windowed classes instead of app utility CSS', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const classNames = Array.from(source.matchAll(/className="([^"]+)"/g)).flatMap((match) => (match[1] ?? '').split(/\s+/));
    const utilityClassNames = classNames.filter(
      (className) =>
        className &&
        !className.startsWith('wos-') &&
        (['flex', 'grid'].includes(className) ||
          /^(min-w-|items-|justify-|gap-|space-y-|md:|text-\[|text-secondary|text-accent|text-danger)/.test(className)),
    );

    expect(utilityClassNames).toEqual([]);
  });

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
    expect(source).not.toContain('eyebrow="Dynamic workflows"');
    expect(source).toContain('title="Inventory"');
    expect(source).toContain('title="Runs"');
    expect(source).toContain('title="Library"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="Repo audit"');
  });

  it('documents shared neutral empty states and error state blocks for windowed pages', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const StatePrimitives');
    expect(source).toContain('<WindowedEmptyState action=');
    expect(source).not.toContain('<WindowedEmptyState tone="danger"');
    expect(source).toContain('<WindowedStateBlock tone="danger"');
    expect(source).toContain('No workflow runs yet.');
    expect(source).toContain('Trace data could not be loaded');
    expect(source).toContain('Try again');
  });

  it('documents shared toolbar primitives for windowed filter rows', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('<WindowedToolbar>');
    expect(source).toContain('aria-label="Search available extensions"');
  });

  it('keeps WindowedPageMain title-only without an eyebrow API', () => {
    const sourcePath = fileURLToPath(new URL('./windowedOs.tsx', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('export interface WindowedPageMainProps');
    expect(source).not.toContain('eyebrow?:');
    expect(source).not.toContain('function WindowedPageMain({ eyebrow');
  });

  it('documents the canonical Automations desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const AutomationsPage');
    expect(source).toContain('title="Automations"');
    expect(source).not.toContain('eyebrow="Scheduled work"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Task queue"');
    expect(source).toContain('<WindowedDialog title="Automation details"');
    expect(source).toContain('title="Automation context"');
    expect(source).not.toContain('title="Selected automation"');
    expect(source).not.toContain('ariaLabel="Automation filter"');
  });

  it('documents the canonical Gateways desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const GatewaysPage');
    expect(source).toContain('title="Gateways"');
    expect(source).not.toContain('eyebrow="Ingress"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Gateway tools"');
    expect(source).toContain('<WindowedDialog title="Telegram configuration"');
    expect(source).not.toContain('title="Selected gateway"');
    expect(source).not.toContain('ariaLabel="Gateway filter"');
  });

  it('documents the canonical Routines desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const RoutinesPage');
    expect(source).toContain('title="Routines"');
    expect(source).not.toContain('eyebrow="Agent hooks"');
    expect(source).toContain('title="Events"');
    expect(source).toContain('title="Before"');
    expect(source).toContain('title="After"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="Routine runs"');
    expect(source).not.toContain('title="Selected routine"');
    expect(source).not.toContain('ariaLabel="Routine scope"');
  });

  it('documents the canonical Model Arena desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const ModelArenaPage');
    expect(source).toContain('title="Model Arena"');
    expect(source).not.toContain('eyebrow="Model duels"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Challengers"');
    expect(source).toContain('title="Sampling"');
    expect(source).toContain('title="Leader"');
    expect(source).toContain('title="Rankings"');
    expect(source).toContain('aria-label="Task type"');
    expect(source).toContain('Disable Model Arena');
    expect(source).not.toContain('title="Active duel"');
  });

  it('documents the canonical Diagnostics desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const DiagnosticsPage');
    expect(source).toContain('title="Diagnostics"');
    expect(source).not.toContain('eyebrow="Telemetry"');
    expect(source).toContain('ariaLabel="Diagnostics range"');
    expect(source).toContain('title="Data"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Health"');
    expect(source).toContain('title="Usage"');
    expect(source).toContain('title="Tools"');
    expect(source).toContain('title="App activity"');
    expect(source).not.toContain('title="Traces"');
    expect(source).not.toContain('Export trace');
  });

  it('documents the canonical Skills desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const skillsSource = source.slice(source.indexOf('export const SkillsPage'), source.indexOf('export const CoreDataPrimitives'));

    expect(source).toContain('export const SkillsPage');
    expect(skillsSource).toContain('title="Browse skills"');
    expect(skillsSource).not.toContain('eyebrow="Skill library"');
    expect(skillsSource).toContain('title="Sources"');
    expect(skillsSource).toContain('Search marketplace skills');
    expect(skillsSource).toContain('title="Marketplace"');
    expect(skillsSource).toContain('title="Installed"');
    expect(skillsSource).toContain('ariaLabel="Skills view"');
    expect(skillsSource).toContain('<WindowedDialog title="local-qa"');
    expect(skillsSource).not.toContain('title="Inventory"');
    expect(skillsSource).not.toContain('title="Installed skills"');
  });

  it('documents the canonical Extensions desktop page and detail subwindow pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const extensionsSource = source.slice(
      source.indexOf('export const ExtensionsPage'),
      source.indexOf('export const ExtensionsInstallDialog'),
    );

    expect(source).toContain('export const ExtensionsPage');
    expect(extensionsSource).toContain('title="Extensions"');
    expect(extensionsSource).not.toContain('eyebrow="Extension manager"');
    expect(extensionsSource).toContain('title="Sources"');
    expect(extensionsSource).toContain('Search extensions');
    expect(extensionsSource).toContain('title="Installed"');
    expect(extensionsSource).toContain('ariaLabel="Extension view"');
    expect(extensionsSource).toContain('WindowedToggle checked accent="extensions" label="Disable system-browser"');
    expect(extensionsSource).toContain('<WindowedDialog');
    expect(extensionsSource).toContain('title="system-browser"');
    expect(extensionsSource).not.toContain('title="Inventory"');
    expect(extensionsSource).not.toContain('title="Installed extensions"');
    expect(extensionsSource).not.toContain('title="Review queue"');
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
