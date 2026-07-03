import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_WINDOWED_DESKTOP_APPS,
  WindowedChartPanel,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedDialogCopy,
  WindowedDialogStack,
  WindowedEmptyState,
  WindowedFormActions,
  WindowedFormGrid,
  WindowedListItem,
  WindowedNumberStepper,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSettingsGroup,
  WindowedSettingsRow,
  WindowedTerminalFrame,
  WindowedToolbar,
  WindowFrame,
} from './windowedOs';

describe('WindowedDataTable', () => {
  it('supports shared metric cells for dense windowed tables', () => {
    const html = renderToStaticMarkup(
      <WindowedDataTable
        columns={[
          { label: 'Model' },
          { label: 'Rating', align: 'right' },
          { label: 'Votes', align: 'right' },
          { label: 'Confidence', align: 'right' },
        ]}
      >
        <WindowedDataRow
          name="openai/gpt-5"
          meta="frontend 6W/2L/1T"
          cells={[
            { value: 1532, align: 'right' },
            { value: 9, align: 'right' },
            { value: 'Low', align: 'right' },
          ]}
        />
      </WindowedDataTable>,
    );

    expect(html).toContain('data-columns="4"');
    expect(html).toContain('--wos-data-column-template');
    expect(html).toContain('class="wos-data-row" data-cells="3"');
    expect(html).toContain('class="wos-data-row__cell" data-align="right">1532</div>');
    expect(html).toContain('frontend 6W/2L/1T');
  });

  it('lets dense product tables provide stable column templates', () => {
    const html = renderToStaticMarkup(
      <WindowedDataTable
        columnTemplate="minmax(14rem, 1fr) minmax(7rem, 0.4fr) minmax(20rem, 0.9fr)"
        columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}
      >
        <WindowedDataRow name="Release watch" meta="Every Monday" action={<button type="button">Details</button>} />
      </WindowedDataTable>,
    );

    expect(html).toContain('--wos-data-column-template:minmax(14rem, 1fr) minmax(7rem, 0.4fr) minmax(20rem, 0.9fr)');
  });
});

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

describe('WindowedChartPanel', () => {
  it('provides shared chart frame chrome for dense diagnostics panels', () => {
    const html = renderToStaticMarkup(
      <WindowedChartPanel title="Token Activity" meta="24H · 1.4M total" className="wos-heatmap">
        <div className="chart-content">chart</div>
      </WindowedChartPanel>,
    );

    expect(html).toContain('class="wos-chart-panel wos-heatmap"');
    expect(html).toContain('class="wos-chart-panel__header"');
    expect(html).toContain('<h4>Token Activity</h4>');
    expect(html).toContain('24H · 1.4M total');
    expect(html).toContain('class="wos-chart-panel__body"');
  });
});

describe('WindowedSettingsGroup', () => {
  it('provides shared compact settings row-list chrome for windowed apps', () => {
    const html = renderToStaticMarkup(
      <WindowedSettingsGroup title="Appearance" actions={<button type="button">Reset</button>} className="settings-page-row-group">
        <WindowedSettingsRow title="Theme" description="System" actionsClassName="settings-page-control-actions">
          <select aria-label="Theme">
            <option>System</option>
          </select>
        </WindowedSettingsRow>
      </WindowedSettingsGroup>,
    );

    expect(html).toContain('class="wos-settings-group settings-page-row-group"');
    expect(html).toContain('class="wos-settings-group__header"');
    expect(html).toContain('class="wos-settings-row');
    expect(html).toContain('class="wos-settings-row__actions settings-page-control-actions"');
    expect(html).toContain('Theme');
    expect(html).toContain('System');
  });
});

describe('WindowedPageMain', () => {
  it('keeps canonical windowed page headers title-only even when legacy callers pass descriptions', () => {
    const html = renderToStaticMarkup(
      <WindowedPageMain title="Gateways" description="Only approved users and chats can send work into Neon Pilot.">
        Gateway settings
      </WindowedPageMain>,
    );

    expect(html).toContain('<h1>Gateways</h1>');
    expect(html).toContain('Gateway settings');
    expect(html).not.toContain('Only approved users and chats can send work into Neon Pilot.');
    expect(html).not.toContain('wos-page-main__heading"><h1>Gateways</h1><p>');
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

describe('WindowedListItem', () => {
  it('renders informational list rows without button semantics', () => {
    const html = renderToStaticMarkup(<WindowedListItem title="CHANGELOG.md" meta="Modified" detail="Release notes" accent="chat" />);

    expect(html).toContain('<div class="wos-list-item"');
    expect(html).toContain('CHANGELOG.md');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-selectable="true"');
  });

  it('renders selectable list rows as buttons', () => {
    const html = renderToStaticMarkup(<WindowedListItem title="Appearance" active accent="settings" onSelect={() => undefined} />);

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-selectable="true"');
    expect(html).toContain('data-active="true"');
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

describe('WindowedFormGrid', () => {
  it('renders canonical windowed form grid and action regions', () => {
    const html = renderToStaticMarkup(
      <form>
        <WindowedFormGrid columns={3}>
          <label>Name</label>
          <label>Source</label>
          <label>Status</label>
        </WindowedFormGrid>
        <WindowedFormActions>
          <WindowedPageButton>Cancel</WindowedPageButton>
          <WindowedPageButton tone="accent" type="submit">
            Save
          </WindowedPageButton>
        </WindowedFormActions>
      </form>,
    );

    expect(html).toContain('class="wos-form-grid" data-columns="3"');
    expect(html).toContain('class="wos-form-actions"');
    expect(html).toContain('Save');
  });
});

describe('WindowedNumberStepper', () => {
  it('renders compact bounded numeric controls with unit labels', () => {
    const html = renderToStaticMarkup(
      <WindowedNumberStepper aria-label="Sample rate" value={20} onChange={() => undefined} min={0} max={100} unit="%" />,
    );

    expect(html).toContain('class="wos-number-stepper"');
    expect(html).toContain('aria-label="Decrease Sample rate"');
    expect(html).toContain('aria-label="Increase Sample rate"');
    expect(html).toContain('type="number"');
    expect(html).toContain('aria-hidden="true">%</span>');
  });
});

describe('WindowedPageSection', () => {
  it('omits header chrome for structural wrapper sections', () => {
    const html = renderToStaticMarkup(<WindowedPageSection>Filters</WindowedPageSection>);

    expect(html).toContain('class="wos-page-section"');
    expect(html).toContain('Filters');
    expect(html).not.toContain('wos-page-section__header');
  });

  it('does not render an empty title placeholder for meta-only sections', () => {
    const html = renderToStaticMarkup(<WindowedPageSection meta="Loading">Status</WindowedPageSection>);

    expect(html).toContain('wos-page-section__header');
    expect(html).toContain('<span>Loading</span>');
    expect(html).not.toContain('<span></span>');
  });
});

describe('WindowedPageButton', () => {
  it('passes native button attributes through for accessible compact actions', () => {
    const html = renderToStaticMarkup(
      <WindowedPageButton aria-label="Details for Browser" title="Details for Browser" disabled>
        Details
      </WindowedPageButton>,
    );

    expect(html).toContain('aria-label="Details for Browser"');
    expect(html).toContain('title="Details for Browser"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Details');
  });
});

describe('WindowFrame', () => {
  it('renders an iframe shield above window body content for blocked composited surfaces', () => {
    const html = renderToStaticMarkup(
      <WindowFrame title="Chat" focused iframeBlocked onMinimize={() => undefined} onMaximize={() => undefined} onClose={() => undefined}>
        <iframe className="wos-composited-frame" title="Browser" src="about:blank" />
      </WindowFrame>,
    );

    expect(html).toContain('data-iframe-blocked="true"');
    expect(html).toContain('class="wos-window__body"');
    expect(html).toContain('class="wos-window__iframe-shield"');
    expect(html.indexOf('class="wos-window__body"')).toBeLessThan(html.indexOf('class="wos-window__iframe-shield"'));
  });
});

describe('WindowedListItem', () => {
  it('marks nested rows with a scoped depth attribute', () => {
    const html = renderToStaticMarkup(<WindowedListItem title="Provider settings" depth={1} />);

    expect(html).toContain('class="wos-list-item"');
    expect(html).toContain('data-depth="1"');
    expect(html).toContain('Provider settings');
  });
});

describe('WindowedDialog content primitives', () => {
  it('renders modeless subwindows by default for windowed desktop detail panels', () => {
    const html = renderToStaticMarkup(
      <WindowedDialog title="Telegram configuration" accent="gateways" onClose={() => undefined}>
        Details
      </WindowedDialog>,
    );

    expect(html).toContain('class="wos-dialog-layer"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Telegram configuration"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('data-modal="true"');
  });

  it('supports explicit modal subwindows for blocking flows', () => {
    const html = renderToStaticMarkup(
      <WindowedDialog title="Confirm install" accent="extensions" modal onClose={() => undefined}>
        Install extension
      </WindowedDialog>,
    );

    expect(html).toContain('data-modal="true"');
    expect(html).toContain('aria-modal="true"');
  });

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

describe('WindowedTerminalFrame', () => {
  it('renders a canonical terminal status strip and body for windowed terminal surfaces', () => {
    const html = renderToStaticMarkup(
      <WindowedTerminalFrame cwd="/repo" status="PTY shell">
        <div className="wos-terminal-panel" />
      </WindowedTerminalFrame>,
    );

    expect(html).toContain('class="wos-terminal-frame"');
    expect(html).toContain('aria-label="Terminal status"');
    expect(html).toContain('class="wos-terminal-frame__cwd"');
    expect(html).toContain('/repo');
    expect(html).toContain('PTY shell');
    expect(html).toContain('class="wos-terminal-frame__body"');
    expect(html).toContain('class="wos-terminal-panel"');
  });
});

describe('Windowed OS tokens', () => {
  it('carries canonical scoped tokens from the design package and consumes them in chrome styles', () => {
    const tokensPath = fileURLToPath(new URL('./tokens.css', import.meta.url));
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const tokensSource = readFileSync(tokensPath, 'utf8');
    const stylesSource = readFileSync(stylesPath, 'utf8');

    for (const token of [
      '--wos-surface-disabled',
      '--wos-success',
      '--wos-danger-hover',
      '--wos-border-hairline',
      '--wos-border-strong',
      '--wos-shadow-desktop',
      '--wos-radius-2xl',
      '--wos-radius-pill',
      '--wos-window-control-size',
      '--wos-duration-fast',
      '--wos-easing-standard',
    ]) {
      expect(tokensSource).toContain(token);
    }

    expect(stylesSource).toContain('border-radius: var(--wos-radius-2xl);');
    expect(stylesSource).toContain('width: var(--wos-window-control-size);');
    expect(stylesSource).toContain('background: var(--wos-danger-hover);');
    expect(stylesSource).toContain('color: var(--wos-success);');
    expect(stylesSource).toContain('background: var(--wos-surface-disabled);');
    expect(stylesSource).toContain('border-radius: var(--wos-radius-pill);');
    expect(stylesSource).toContain('.wos-extension-dialog-busy');
    expect(stylesSource).toContain(".wos-dialog-layer[data-modal='true']");
    expect(stylesSource).toContain('pointer-events: none;');
    expect(stylesSource).toContain('pointer-events: auto;');
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
    expect(tokensSource).toContain('--wos-workflows:');
    expect(tokensSource).toContain('--wos-model-arena:');
    expect(tokensSource).toContain('--wos-skills:');
    expect(tokensSource).toContain('--wos-diagnostics:');
    expect(tokensSource).toContain('--wos-titlebar-h: 42px;');
    expect(stylesSource).not.toContain('--wos-surface-0: oklch(95% 0.022 75);');
  });

  it('styles canonical app-specific accents across shared windowed primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    for (const accent of ['workflows', 'model-arena', 'skills', 'diagnostics']) {
      expect(stylesSource).toContain(`.wos-window__titlebar[data-accent='${accent}']`);
      expect(stylesSource).toContain(`.wos-dialog__titlebar[data-accent='${accent}']`);
      expect(stylesSource).toContain(`.wos-segmented-control[data-accent='${accent}']`);
      expect(stylesSource).toContain(`.wos-toggle[data-checked='true'][data-accent='${accent}']`);
      expect(stylesSource).toContain(`.wos-list-item[data-accent='${accent}']`);
    }
  });

  it('styles keyboard-highlighted Start menu results inside the scoped desktop chrome', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".wos-start-menu__item[data-active='true']");
    expect(stylesSource).toContain('background: var(--wos-surface-3);');
  });

  it('stretches Start menu app buttons across the full clickable row', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-start-menu__grid {\n  display: grid;\n  gap: 1px;\n  justify-items: stretch;');
    expect(stylesSource).toContain('.wos-start-menu__item {\n  display: flex;\n  width: 100%;');
    expect(stylesSource).toContain('justify-content: flex-start;');
  });

  it('styles nested list rows through scoped depth selectors', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".wos-list-item[data-depth='1']");
    expect(stylesSource).toContain(".wos-list-item[data-depth='1'] .wos-list-item__title");
  });

  it('keeps timeline content visible for log and activity rows with long copy', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-timeline-item {\n  --wos-timeline-marker: var(--wos-ink-500);');
    expect(stylesSource).toContain('align-items: start;');
    expect(stylesSource).toContain('.wos-timeline-item__body {\n  min-width: 0;\n  overflow: visible;');
    expect(stylesSource).toContain('.wos-timeline-item__content {\n  margin-top: 4px;');
    expect(stylesSource).toContain('overflow-wrap: anywhere;');
  });

  it('defines a separate host hook for native extension pages in windowed windows', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window-route-body .wos-native-extension-surface--windowed');
    expect(stylesSource).toContain('background: transparent;');
    expect(stylesSource).toContain('font-family: var(--wos-font-body);');
  });

  it('contains iframe paint inside window bodies and scopes native browser blocking to the browser host', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window__body {\n  position: relative;');
    expect(stylesSource).toContain('clip-path: inset(0);');
    expect(stylesSource).toContain('isolation: isolate;');
    expect(stylesSource).toContain('contain: paint;');
    expect(stylesSource).toContain('.wos-window__body > * {\n  position: relative;\n  z-index: 0;');
    expect(stylesSource).toContain('.wos-window__titlebar,\n.wos-window__controls,\n.wos-resize-handle {\n  transform: translateZ(0);');
    expect(stylesSource).toContain('.wos-composited-frame {\n  position: relative;');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host {');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host__blocker {');
    expect(stylesSource).toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .ui-windowed-browser-host[data-windowed-browser-host='true']",
    );
    expect(stylesSource).toContain('display: none !important;');
    expect(stylesSource).toContain('.wos-window__iframe-shield');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host {\n  position: relative;\n  z-index: 0 !important;');
    expect(stylesSource).toContain('z-index: 95;');
    expect(stylesSource).toContain('pointer-events: auto;');
    expect(stylesSource).toContain('.wos-window__titlebar {\n  position: relative;\n  z-index: 70;');
    expect(stylesSource).toContain('.wos-resize-handle {\n  position: absolute;\n  z-index: 55;');
    expect(stylesSource).toContain(
      ".wos-window[data-focused='false']:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview) > .wos-window__iframe-shield",
    );
    expect(stylesSource).toContain(
      ".wos-window[data-iframe-blocked='true']:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview) > .wos-window__iframe-shield",
    );
    expect(stylesSource).toContain(
      ".windowed-os-shell[data-window-interaction='true'] .wos-window:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview)",
    );
    expect(stylesSource).toContain(
      ".windowed-os-shell[data-frame-paint-blocked='true'] .wos-window:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview)",
    );
    expect(stylesSource).not.toContain(".wos-window[data-focused='false'] > .wos-window__iframe-shield");
    expect(stylesSource).not.toContain(".wos-window[data-iframe-blocked='true'] > .wos-window__iframe-shield");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-window-interaction='true'] .wos-window > .wos-window__iframe-shield");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-frame-paint-blocked='true'] .wos-window > .wos-window__iframe-shield");
    expect(stylesSource).not.toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .wos-window:has(.ui-windowed-browser-host) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .wos-window:has(.wos-composited-frame) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .wos-window:has(iframe) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .wos-window:has(.wos-window__body iframe) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] .wos-window > .wos-window__iframe-shield");
    expect(stylesSource).toContain(
      ".windowed-os-shell:has(.wos-window[data-focused='true']) .wos-window:not([data-focused='true']) .wos-composited-frame",
    );
    expect(stylesSource).toContain(
      ".windowed-os-shell:has(.wos-window[data-focused='true']) .wos-window:not([data-focused='true']) .wos-window__body iframe",
    );
    expect(stylesSource).toContain(".wos-window[data-iframe-blocked='true'] .wos-composited-frame");
    expect(stylesSource).toContain(".wos-window[data-iframe-blocked='true'] .wos-window__body iframe");
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] .wos-composited-frame");
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] iframe");
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] webview");
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] .wos-window__body iframe");
    expect(stylesSource).toContain(".windowed-os-shell[data-frame-paint-blocked='true'] .wos-composited-frame");
    expect(stylesSource).toContain(".windowed-os-shell[data-frame-paint-blocked='true'] iframe");
    expect(stylesSource).toContain(".windowed-os-shell[data-frame-paint-blocked='true'] webview");
    expect(stylesSource).toContain(".windowed-os-shell[data-frame-paint-blocked='true'] .wos-window__body iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] .wos-composited-frame");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] webview");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] .wos-window iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-native-browser-blocked='true'] .wos-window__body iframe");
    expect(stylesSource).toContain('.wos-window__body:has(.wos-dialog-layer) .wos-composited-frame');
    expect(stylesSource).toContain('.wos-window__body:has(.ui-workbench-drop-badge) .wos-composited-frame');
    expect(stylesSource).toContain('.wos-window__body:has(.ui-workbench-drop-popover) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-overlay-backdrop) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-dialog-shell) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-menu-shell) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-context-menu-shell) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-positioned-menu) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-command-palette-shell) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-setup-readiness-popover) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-notification-toaster) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-page-search-popover) .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-overlay-backdrop) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-dialog-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-menu-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-context-menu-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-positioned-menu) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-command-palette-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-setup-readiness-popover) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-notification-toaster) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-page-search-popover) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] .wos-composited-frame");
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] iframe");
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] webview");
    expect(stylesSource).not.toContain('.windowed-os-shell:has(.wos-taskbar) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.wos-start-menu) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.wos-taskbar__menu-layer) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.wos-snap-preview) .wos-composited-frame');
    expect(stylesSource).toContain('opacity: 0;');
    expect(stylesSource).toContain('visibility: hidden;');
    expect(stylesSource).toContain('pointer-events: none;');
  });

  it('styles attached terminal panels with scoped windowed tokens', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-terminal-frame');
    expect(stylesSource).toContain('.wos-terminal-frame__status');
    expect(stylesSource).toContain('.wos-terminal-frame__body');
    expect(stylesSource).toContain('.wos-terminal-panel');
    expect(stylesSource).toContain('background: var(--wos-surface-1);');
    expect(stylesSource).toContain('color: var(--wos-ink-900);');
    expect(stylesSource).toContain('font-family: var(--wos-font-mono);');
    expect(stylesSource).toContain('.wos-terminal-panel :where(.xterm, .xterm-screen, .xterm-viewport)');
  });

  it('defines compact windowed telemetry heatmap primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-chart-panel {');
    expect(stylesSource).toContain('.wos-chart-panel__header {');
    expect(stylesSource).toContain('.wos-chart-panel__body {');
    expect(stylesSource).toContain('.wos-heatmap .wos-chart-panel__body {');
    expect(stylesSource).toContain('.wos-heatmap-grid {');
    expect(stylesSource).toContain('.wos-heatmap-cell-4 {');
    expect(stylesSource).toContain('.wos-heatmap-share {');
  });

  it('defines compact windowed telemetry braid chart primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-chart-panel {');
    expect(stylesSource).toContain('.wos-chart-panel {');
    expect(stylesSource).toContain('.wos-braid-chart-svg {');
    expect(stylesSource).toContain('.wos-braid-line--input {');
    expect(stylesSource).toContain('.wos-braid-legend-item {');
  });

  it('defines compact windowed telemetry tool flow primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-tool-flow {');
    expect(stylesSource).toContain('.wos-tool-flow__grid {');
    expect(stylesSource).toContain('.wos-tool-flow__path,');
    expect(stylesSource).toContain('.wos-tool-flow__error {');
  });

  it('defines compact windowed telemetry tool health primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-tool-health {');
    expect(stylesSource).toContain('.wos-tool-health__summary {');
    expect(stylesSource).toContain('.wos-tool-health__table .wos-data-row__name,');
    expect(stylesSource).toContain('.wos-tool-health__bash {');
    expect(stylesSource).toContain('.wos-tool-health__complexity {');
  });

  it('defines compact windowed telemetry agent loop primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-agent-loop {');
    expect(stylesSource).toContain('.wos-agent-loop__metrics {');
    expect(stylesSource).toContain('.wos-agent-loop__durations {');
    expect(stylesSource).toContain('.wos-agent-loop-duration {');
    expect(stylesSource).toContain('.wos-agent-loop-duration__bar {');
  });

  it('defines compact windowed telemetry auto mode primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-auto-mode {');
    expect(stylesSource).toContain('.wos-auto-mode__summary {');
    expect(stylesSource).toContain('.wos-auto-mode__grid {');
    expect(stylesSource).toContain('.wos-auto-mode__events .wos-data-row__name,');
    expect(stylesSource).toContain('.wos-auto-mode__reason {');
  });

  it('defines compact windowed telemetry context pressure primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-context-pressure {');
    expect(stylesSource).toContain('.wos-context-pressure__summary {');
    expect(stylesSource).toContain('.wos-context-pressure__grid {');
    expect(stylesSource).toContain('.wos-context-pressure__sessions .wos-data-row__name,');
    expect(stylesSource).toContain('.wos-context-pressure-segments {');
    expect(stylesSource).toContain(".wos-context-pressure-segments span[data-segment='tool']");
  });

  it('defines compact windowed telemetry context pointer primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-context-pointers {');
    expect(stylesSource).toContain('.wos-context-pointers__summary {');
    expect(stylesSource).toContain('.wos-context-pointers-bar {');
    expect(stylesSource).toContain('.wos-context-pointers-bar span {');
  });

  it('documents the canonical terminal frame in isolated Storybook examples', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const TerminalWindow');
    expect(source).toContain('<WindowedTerminalFrame cwd="/Users/patrick/workingdir/neon-pilot" status="PTY shell">');
    expect(source).toContain('PASS terminal frame tokens');
  });

  it('defines a reusable danger tone for windowed page buttons', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".wos-page-button[data-tone='danger']");
    expect(stylesSource).toContain('background: var(--wos-danger);');
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
    expect(source).toContain('title="Sections"');
    expect(source).toContain('<WindowedSettingsGroup title="Appearance"');
    expect(source).toContain('title="Theme"');
    expect(source).not.toContain('title="Settings sections"');
  });

  it('styles shared windowed settings row-list primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-settings-group {');
    expect(stylesSource).toContain('.wos-settings-group__header {');
    expect(stylesSource).toContain('.wos-settings-row {');
    expect(stylesSource).toContain('.wos-settings-row__actions {');
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

  it('documents shared chart panel primitives for windowed diagnostics', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const ChartPrimitives');
    expect(source).toContain('<WindowedChartPanel title="Token Activity"');
    expect(source).toContain('<WindowedChartPanel title="Time Series"');
    expect(source).not.toContain('wos-heatmap-header');
    expect(source).not.toContain('wos-braid-chart-header');
  });

  it('documents shared toolbar primitives for windowed filter rows', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('<WindowedToolbar>');
    expect(source).toContain('aria-label="Search available extensions"');
  });

  it('documents shared form grid primitives for windowed forms', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('<WindowedFormGrid');
    expect(source).toContain('<WindowedFormActions>');
    expect(source).not.toContain('className="wos-form-grid"');
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
    expect(source).toContain(
      "<WindowedDataTable columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}",
    );
    expect(source).toContain('className="wos-automation-actions"');
    expect(source).not.toContain('wos-automation-table');
    expect(source).not.toContain('wos-automation-row');
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
    expect(source).toContain('<WindowedNumberStepper');
    expect(source).toContain('unit="%"');
    expect(source).toContain('unit="votes"');
    expect(source).toContain('unit="chars"');
    expect(source).toContain('title="Leader"');
    expect(source).toContain('title="Rankings"');
    expect(source).toContain('aria-label="Task type"');
    expect(source).toContain('Disable Model Arena');
    expect(source).toContain('<WindowedDataRow');
    expect(source).toContain('cells={[');
    expect(source).not.toContain('wos-arena-ranking-row');
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
    const canonicalTitles = CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => app.title);

    expect(canonicalTitles).toEqual([
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
    ]);

    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Workflows')?.accent).toBe('workflows');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Chat')?.meta).toBe('Conversation');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Model Arena')?.accent).toBe('model-arena');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Skills')?.accent).toBe('skills');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Diagnostics')?.accent).toBe('diagnostics');
    expect(source).toContain('CANONICAL_WINDOWED_DESKTOP_APPS');
    expect(source).toContain('const canonicalDesktopApps = CANONICAL_WINDOWED_DESKTOP_APPS');
    expect(source.slice(source.indexOf('export const WorkflowsPage'), source.indexOf('export const ModelArenaPage'))).toContain(
      'title="Workflows"\n        accent="workflows"',
    );
    expect(source.slice(source.indexOf('export const ModelArenaPage'), source.indexOf('export const DiagnosticsPage'))).toContain(
      'title="Model Arena"\n        accent="model-arena"',
    );
    expect(source.slice(source.indexOf('export const SkillsPage'), source.indexOf('export const CoreDataPrimitives'))).toContain(
      'title="Skills"\n        accent="skills"',
    );
    expect(source).not.toContain("title: 'Prompt Assembly'");
  });
});
