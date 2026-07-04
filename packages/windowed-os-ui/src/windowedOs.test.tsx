import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_WINDOWED_DESKTOP_APPS,
  StartMenu,
  WindowedActionRow,
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
  WindowedLoadingState,
  WindowedNumberStepper,
  WindowedPageButton,
  WindowedPageGrid,
  WindowedPageMain,
  WindowedPageSection,
  WindowedPageShell,
  WindowedPageStack,
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

  it('stacks shared data rows in narrow window containers without clipping actions', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('@container (max-width: 720px)');
    expect(stylesSource).toContain('.wos-data-table:not(.wos-automation-queue) .wos-data-table__header');
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(stylesSource).toContain('.wos-data-table:not(.wos-automation-queue) .wos-data-row__action :where(.wos-inline-actions, .flex)');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('overflow-wrap: anywhere;');
    expect(stylesSource).toContain('.wos-settings-row__copy');
    expect(stylesSource).toContain('.wos-settings-row {\n    display: grid;');
    expect(stylesSource).toContain('.wos-settings-row__actions {\n    min-width: 0;');
    expect(stylesSource).toContain('.wos-key-value__label');
    expect(stylesSource).toContain('.wos-key-value__value');
    expect(stylesSource).toContain('container: wos-page-shell / inline-size;');
    expect(stylesSource).toContain('@container wos-page-shell (max-width: 680px)');
    expect(stylesSource).toContain('@container wos-page-shell (max-width: 680px) {\n  .wos-settings-row {');
    expect(stylesSource).toContain(
      '.wos-settings-row__actions {\n    min-width: 0;\n    max-width: none;\n    justify-content: flex-start;',
    );
    expect(stylesSource).toContain('@container wos-page-shell (max-width: 420px)');
    expect(stylesSource).toContain('.wos-settings-row__actions .wos-segmented-control {\n    display: grid;\n    width: 100%;');
    expect(stylesSource).toContain('.wos-settings-row__actions .wos-segmented-control__item {\n    width: 100%;\n    border-right: 0;');
    expect(stylesSource).toContain('.wos-theme-variant-grid {\n  grid-template-columns: repeat(auto-fit, minmax(min(396px, 100%), 1fr));');
    expect(stylesSource).toContain('.wos-theme-variant-grid > .windowed-os-shell {\n  box-sizing: border-box;\n  width: 100%;');
    expect(stylesSource).toContain('.wos-theme-phase-grid {\n  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));');
    expect(stylesSource).toContain('.wos-theme-phase-card {\n  min-height: 320px;');
    expect(stylesSource).toContain('.wos-theme-phase-card .wos-window {\n  min-width: 0;');
    expect(stylesSource).toContain(".wos-key-value-grid[data-columns='4']");
    expect(stylesSource).toContain('.wos-key-value-grid__item:nth-child(even)');
    expect(stylesSource).toContain('.wos-key-value-grid__item:nth-child(n + 3)');
    expect(stylesSource).toContain('.wos-automation-queue .wos-data-row');
  });

  it('keeps selected row badge and status text legible on active accent colors', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".wos-data-row[data-selected='true'] .wos-data-row__cell,");
    expect(stylesSource).toContain(".wos-data-row[data-selected='true'] .wos-badge,");
    expect(stylesSource).toContain(".wos-data-row[data-selected='true'] .wos-status-note");
    expect(stylesSource).toContain('color: var(--wos-data-row-active-ink, var(--wos-ink-900));');
  });

  it('keeps chat composer controls usable in compact window containers', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('container-name: wos-window-route;');
    expect(stylesSource).toContain('@container wos-window-route (max-width: 680px)');
    expect(stylesSource).toContain('.wos-window-route-body--chat .conversation-composer-region');
    expect(stylesSource).toContain('.wos-window-route-body--chat .ui-composer-input-controls__control-row');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('button.ui-composer-model-fallback {\n    max-width: min(100%, 168px);');
    expect(stylesSource).toContain(".wos-window-route-body--chat [data-chat-transcript-panel='1']");
    expect(stylesSource).toContain('padding: var(--wos-space-4) var(--wos-space-4) 88px !important;');
  });

  it('stacks Model Arena status controls in compact window containers', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-arena-status-row__copy');
    expect(stylesSource).toContain('.wos-arena-status-row__copy {\n  min-width: 0;');
    expect(stylesSource).toContain('overflow-wrap: anywhere;');
    expect(stylesSource).toContain('.wos-arena-settings-dialog {');
    expect(stylesSource).toContain('width: min(540px, calc(100% - 8px));');
    expect(stylesSource).toContain('@container (max-width: 640px)');
    expect(stylesSource).toContain('.wos-arena-status-row,\n  .wos-arena-settings-dialog .wos-arena-settings-grid {');
    expect(stylesSource).toContain('justify-items: start;');
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

  it('uses fluid rail tracks so compact desktop windows keep usable content width', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('grid-template-columns: minmax(118px, min(35%, 190px)) minmax(0, 1fr);');
    expect(stylesSource).toContain('grid-template-columns: minmax(118px, min(32%, 168px)) minmax(0, 1fr);');
    expect(stylesSource).not.toContain('grid-template-columns: 190px minmax(0, 1fr);');
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

  it('keeps short settings labels from wrapping letter-by-letter', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');
    const copyRule = stylesSource.match(/\.wos-settings-row__copy \{[^}]+}/)?.[0] ?? '';

    expect(copyRule).toContain('overflow-wrap: break-word;');
    expect(copyRule).toContain('word-break: normal;');
    expect(copyRule).not.toContain('overflow-wrap: anywhere;');
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

describe('WindowedPageStack', () => {
  it('exposes canonical page stack and grid layout primitives', () => {
    const html = renderToStaticMarkup(
      <WindowedPageStack>
        <WindowedPageGrid columns={2}>
          <div>First pane</div>
          <div>Second pane</div>
        </WindowedPageGrid>
      </WindowedPageStack>,
    );

    expect(html).toContain('class="wos-page-stack"');
    expect(html).toContain('class="wos-page-grid" data-columns="2"');
    expect(html).toContain('First pane');
    expect(html).toContain('Second pane');
  });
});

describe('WindowedActionRow', () => {
  it('renders inline action rows without form footer chrome', () => {
    const html = renderToStaticMarkup(
      <WindowedActionRow align="start">
        <button type="button">Refresh</button>
      </WindowedActionRow>,
    );

    expect(html).toContain('class="wos-action-row" data-align="start"');
    expect(html).toContain('Refresh');
    expect(html).not.toContain('wos-form-actions');
  });
});

describe('WindowedEmptyState', () => {
  it('renders loading states as native windowed state blocks', () => {
    const html = renderToStaticMarkup(<WindowedLoadingState label="Loading extensions page" />);

    expect(html).toContain('class="wos-state-block wos-loading-state"');
    expect(html).toContain('Loading extensions page');
    expect(html).toContain('Preparing the window contents.');
    expect(html).not.toContain('ui-loading');
  });

  it('renders compact empty content with an optional action', () => {
    const html = renderToStaticMarkup(
      <WindowedEmptyState title="No workflow runs" action={<button type="button">Create</button>}>
        Run history appears after workflows execute.
      </WindowedEmptyState>,
    );

    expect(html).toContain('class="wos-empty-state"');
    expect(html).toContain('wos-empty-state__title');
    expect(html).toContain('No workflow runs');
    expect(html).toContain('wos-empty-state__copy');
    expect(html).toContain('Run history appears after workflows execute.');
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
    expect(html).toContain('aria-current="page"');
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

describe('Taskbar', () => {
  it('uses accent-specific focused taskbar styling', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".wos-taskbar__button[data-focused='true'][data-accent='chat']");
    expect(stylesSource).toContain('background: var(--wos-chat);');
    expect(stylesSource).toContain(".wos-taskbar__button[data-focused='true'][data-accent='gateways']");
    expect(stylesSource).toContain('background: var(--wos-gateways);');
    expect(stylesSource).toContain('inset 0 -4px 0 var(--wos-ink-900)');
    expect(stylesSource).toContain('transform: translateY(-1px);');
  });

  it('keeps overflowing desktop windows reachable in the taskbar', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-taskbar__items {\n  display: flex;');
    expect(stylesSource).toContain('overflow-x: auto;');
    expect(stylesSource).toContain('overscroll-behavior-x: contain;');
    expect(stylesSource).toContain('.wos-taskbar__items::-webkit-scrollbar');
    expect(stylesSource).toContain('scrollbar-width: thin;');
    expect(stylesSource).toContain('@media (max-width: 640px)');
    expect(stylesSource).toContain('flex: 1 1 max(140px, 42vw);');
  });
});

describe('StartMenu', () => {
  it('renders open-window state without changing the app button accessible name', () => {
    const html = renderToStaticMarkup(
      <StartMenu
        open
        items={[
          { id: 'chat', title: 'Chat', accent: 'chat', count: 2, open: true, focused: true, onSelect: () => undefined },
          { id: 'settings', title: 'Settings', accent: 'settings', open: false, onSelect: () => undefined },
        ]}
      />,
    );

    expect(html).toContain('aria-label="Chat"');
    expect(html).toContain('data-open="true"');
    expect(html).toContain('data-focused="true"');
    expect(html).toContain('class="wos-app-tile__count">2</span>');
    expect(html).not.toContain('aria-label="Chat 2');
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
    expect(html).toContain('data-has-unit="true"');
    expect(html).toContain('aria-label="Decrease Sample rate"');
    expect(html).toContain('aria-label="Increase Sample rate"');
    expect(html).toContain('type="number"');
    expect(html).toContain('aria-hidden="true">%</span>');
  });

  it('keeps unitless steppers on stable button tracks', () => {
    const html = renderToStaticMarkup(
      <WindowedNumberStepper aria-label="Gateway port" value={8766} onChange={() => undefined} min={1024} max={65535} />,
    );
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(html).toContain('class="wos-number-stepper"');
    expect(html).not.toContain('data-has-unit="true"');
    expect(stylesSource).toContain('grid-template-columns: 26px minmax(0, 1fr) 26px;');
    expect(stylesSource).toContain(".wos-number-stepper[data-has-unit='true']");
    expect(stylesSource).toContain('grid-template-columns: 26px minmax(0, 1fr) auto 26px;');
  });
});

describe('WindowedPageSection', () => {
  it('uses scoped inner-border tokens for repeated page panels', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(
      '.wos-page-section {\n  overflow: hidden;\n  border: var(--wos-border-hairline) solid var(--wos-line-strong);',
    );
    expect(stylesSource).toContain('border-bottom: var(--wos-border-hairline) solid var(--wos-line-subtle);');
  });

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

describe('Windowed workbench styling', () => {
  it('uses strong windowed borders for embedded workbench controls', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(
      '.wos-window-route-body .ui-workbench-tab {\n  min-width: 0;\n  max-width: 220px;\n  overflow: hidden;\n  border: var(--wos-border-strong) solid var(--wos-ink-900) !important;',
    );
    expect(stylesSource).toContain('border: var(--wos-border-strong) solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain(
      '.wos-window-route-body .ui-action-tile {\n  border: var(--wos-border-strong) solid var(--wos-ink-900) !important;',
    );
    expect(stylesSource).toContain(
      '.wos-window-route-body .ui-action-tile-icon {\n  border: var(--wos-border-strong) solid var(--wos-ink-900) !important;',
    );
  });
});

describe('Windowed chat styling', () => {
  it('uses strong tokenized borders for chat transcript and composer surfaces', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(
      '.wos-message-bubble {\n  max-width: min(72ch, 76%);\n  border: var(--wos-border-strong) solid var(--wos-ink-900);',
    );
    expect(stylesSource).toContain(
      '.wos-chat-composer__input {\n  min-height: 32px;\n  border: var(--wos-border-strong) solid var(--wos-ink-900);',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-meta {\n  display: flex;\n  min-height: 24px;',
    );
    expect(stylesSource).toContain('flex-wrap: wrap;\n  align-items: center;\n  gap: 3px 8px;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-meta__primary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-meta__workspace');
    expect(stylesSource).toContain(
      ".windowed-os-shell .wos-window-route-body--chat .ui-composer-meta__workspace::before {\n  content: '|';",
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-message-card-user,\n.windowed-os-shell .wos-window-route-body--chat .ui-message-card-assistant {\n  border: var(--wos-border-strong) solid var(--wos-ink-900);',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-message-action-button {\n  min-height: 24px;\n  border: var(--wos-border-strong) solid var(--wos-ink-900);',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-preferences-row {\n  display: inline-flex;\n  min-width: 0;\n  align-items: center;\n  gap: 6px;',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-preferences-row .ui-menu-trigger-inline {\n  display: inline-flex;\n  min-width: 0;\n  max-width: 128px;',
    );
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

  it('supports icon-density actions without replacing accessible names', () => {
    const html = renderToStaticMarkup(
      <WindowedPageButton aria-label="Open Browser" title="Open Browser" density="icon">
        <svg aria-hidden="true" viewBox="0 0 16 16" />
      </WindowedPageButton>,
    );
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(html).toContain('data-density="icon"');
    expect(html).toContain('aria-label="Open Browser"');
    expect(stylesSource).toContain(".wos-page-button[data-density='icon']");
    expect(stylesSource).toContain('place-items: center;');
  });
});

describe('WindowFrame', () => {
  it('keeps the desktop minimum responsive to narrow preview viewports', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('min-width: min(360px, calc(100vw - 32px));');
    expect(stylesSource).toContain('min-height: min(260px, calc(100vh - 32px));');
    expect(stylesSource).toContain(
      '.wos-window {\n  position: absolute;\n  isolation: isolate;\n  display: grid;\n  box-sizing: border-box;',
    );
    expect(stylesSource).not.toContain('min-width: 360px;\n  min-height: 260px;');
  });

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

  it('marks minimized windows while preserving their body subtree for attached subwindows', () => {
    const html = renderToStaticMarkup(
      <WindowFrame title="Chat" minimized onMinimize={() => undefined} onMaximize={() => undefined} onClose={() => undefined}>
        <div data-testid="attached-subwindow-state">Drawing editor</div>
      </WindowFrame>,
    );

    expect(html).toContain('data-minimized="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('attached-subwindow-state');
  });

  it('exposes parent metadata for attached child desktop windows', () => {
    const html = renderToStaticMarkup(
      <WindowFrame
        title="Terminal"
        parentWindowId="chat:draft"
        parentWindowTitle="New conversation"
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div>Terminal surface</div>
      </WindowFrame>,
    );

    expect(html).toContain('data-parent-window-attached="true"');
    expect(html).toContain('data-parent-window-id="chat:draft"');
    expect(html).toContain('data-parent-window-title="New conversation"');
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

  it('marks modeless subwindows as attached to their parent app window', () => {
    const html = renderToStaticMarkup(
      <WindowedDialog
        title="Automation details"
        accent="automations"
        parentWindowId="route:system-automations:nav"
        parentWindowTitle="Automations"
        onClose={() => undefined}
      >
        Details
      </WindowedDialog>,
    );

    expect(html).toContain('data-parent-window-attached="true"');
    expect(html).toContain('data-parent-window-id="route:system-automations:nav"');
    expect(html).toContain('data-parent-window-title="Automations"');
    expect(html).toContain('Attached to Automations');
  });

  it('keeps explicit subwindow metadata ahead of the parent fallback label', () => {
    const html = renderToStaticMarkup(
      <WindowedDialog title="Telegram access" meta="2 approved" accent="gateways" parentWindowTitle="Gateways" onClose={() => undefined}>
        Access
      </WindowedDialog>,
    );

    expect(html).toContain('2 approved');
    expect(html).not.toContain('Attached to Gateways');
  });

  it('supports initial modeless subwindow offsets for multiple desktop detail windows', () => {
    const html = renderToStaticMarkup(
      <WindowedDialog
        title="Routine runs"
        accent="routines"
        parentWindowTitle="Routines"
        initialOffset={{ x: 0, y: 390 }}
        onClose={() => undefined}
      >
        Runs
      </WindowedDialog>,
    );

    expect(html).toContain('style="transform:translate(0px, 390px)"');
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

  it('uses scoped windowed focus treatment for focused subwindow frames', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-dialog:focus {\n  outline: none;\n}');
    expect(stylesSource).toContain('.wos-dialog:focus-visible {');
    expect(stylesSource).toContain('0 0 0 4px var(--wos-ink-900)');
  });

  it('keeps compact subwindow actions and body chrome inside narrow desktop windows', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-dialog__actions {\n  display: flex;\n  min-width: 0;');
    expect(stylesSource).toContain('.wos-dialog__actions .wos-page-button {\n  min-width: 0;');
    expect(stylesSource).toContain('@media (max-width: 560px) {\n  .wos-dialog-layer {');
    expect(stylesSource).toContain('.wos-dialog__actions {\n    justify-content: flex-start;');
    expect(stylesSource).toContain('.wos-dialog__body {\n    padding: 8px;');
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
      '--wos-accent-ink',
      '--wos-success',
      '--wos-danger-hover',
      '--wos-border-hairline',
      '--wos-border-strong',
      '--wos-line-strong',
      '--wos-line-subtle',
      '--wos-line-muted',
      '--wos-grid-line',
      '--wos-shadow-desktop',
      '--wos-shadow-offset',
      '--wos-radius-2xl',
      '--wos-radius-pill',
      '--wos-window-control-size',
      '--wos-duration-fast',
      '--wos-easing-standard',
    ]) {
      expect(tokensSource).toContain(token);
    }

    expect(tokensSource).toContain(".windowed-os-shell[data-wos-theme='light']");
    expect(tokensSource).toContain(".windowed-os-shell[data-wos-theme='dark']");
    expect(tokensSource).toContain(".windowed-os-shell[data-wos-theme-mode='auto']");
    expect(tokensSource).toContain("[data-wos-theme-phase='dusk']");
    expect(tokensSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(tokensSource).toContain('.wos-window__titlebar');
    expect(tokensSource).toContain('.wos-chat-window-toolbar');
    expect(tokensSource).toContain('.wos-terminal-frame__status');
    expect(tokensSource).toContain('.wos-window-route-body .ui-workbench-panel');
    expect(tokensSource).toContain('color-scheme: dark;');
    expect(tokensSource).toContain('--wos-surface-0: oklch(18% 0.025 260);');
    expect(tokensSource).toContain('--wos-accent-ink: oklch(18% 0.025 260);');
    expect(tokensSource).toContain('--wos-grid-line: oklch(93% 0.012 75 / 0.075);');
    expect(tokensSource).toContain('--wos-shadow-window: 0 26px 56px rgba(0, 0, 0, 0.42);');
    expect(tokensSource).toContain('--wos-shadow-offset: 6px 6px 0 oklch(93% 0.012 75 / 0.14);');
    expect(stylesSource).toContain('border-radius: var(--wos-radius-2xl);');
    expect(stylesSource).toContain('width: var(--wos-window-control-size);');
    expect(stylesSource).toContain('background: var(--wos-danger-hover);');
    expect(stylesSource).toContain('color: var(--wos-success);');
    expect(stylesSource).toContain('background: var(--wos-surface-disabled);');
    expect(stylesSource).toContain('color: var(--wos-accent-ink);');
    expect(stylesSource).toContain('border-radius: var(--wos-radius-pill);');
    expect(stylesSource).toContain('.wos-extension-dialog-busy');
    expect(stylesSource).toContain('.wos-extension-detail-grid .wos-key-value-list');
    expect(stylesSource).toContain('.wos-extension-detail-description {\n  grid-column: 1 / -1;\n  margin: 0;\n  border: 1.5px solid');
    expect(stylesSource).toContain(".wos-dialog-layer[data-modal='true']");
    expect(stylesSource).toContain('pointer-events: none;');
    expect(stylesSource).toContain('pointer-events: auto;');
  });

  it('sets pointer cursors for interactive windowed shell affordances only', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.windowed-os-shell\n  :where(');
    expect(stylesSource).toContain('a[href],');
    expect(stylesSource).toContain('summary,');
    expect(stylesSource).toContain('select,');
    expect(stylesSource).toContain("input[type='checkbox']");
    expect(stylesSource).toContain("[role='tab']");
    expect(stylesSource).toContain("[role='menuitem']");
    expect(stylesSource).toContain("[role='radio']");
    expect(stylesSource).toContain("[aria-disabled='true']");
    expect(stylesSource).toContain("[data-disabled='true']");
    expect(stylesSource).toContain('cursor: default;');
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
    expect(tokensSource).toContain('--wos-surface-0: oklch(18% 0.025 260);');
    expect(tokensSource).toContain('--wos-extensions: oklch(70% 0.15 60);');
    expect(tokensSource).toContain('--wos-workflows:');
    expect(tokensSource).toContain('--wos-model-arena:');
    expect(tokensSource).toContain('--wos-skills:');
    expect(tokensSource).toContain('--wos-diagnostics:');
    expect(tokensSource).toContain('--wos-titlebar-h: 36px;');
    expect(tokensSource).toContain('--wos-window-control-size: 22px;');
    expect(stylesSource).toContain('--wos-window-control-clearance: calc((var(--wos-window-control-size) * 3) + 38px);');
    expect(stylesSource).toContain('grid-template-rows: var(--wos-titlebar-h) minmax(0, 1fr);');
    expect(stylesSource).toContain('.wos-window__title {\n  min-width: 0;');
    expect(stylesSource).toContain('font: var(--wos-text-row);');
    expect(stylesSource).toContain('padding: 0 7px 0 8px;');
    expect(stylesSource).toContain('padding: 5px 7px 5px 10px;');
    expect(stylesSource).toContain('.wos-dialog__identity {\n  display: flex;');
    expect(stylesSource).toContain('align-items: center;\n  gap: 8px;');
    expect(stylesSource).toContain('.wos-dialog__meta::before');
    expect(stylesSource).toContain("content: '/ ';");
    expect(stylesSource).not.toContain('--wos-surface-0: oklch(95% 0.022 75);');
  });

  it('transitions automatic time-of-day theme changes across core desktop chrome', () => {
    const tokensPath = fileURLToPath(new URL('./tokens.css', import.meta.url));
    const tokensSource = readFileSync(tokensPath, 'utf8');

    expect(tokensSource).toContain('background-color 900ms var(--wos-easing-standard)');
    expect(tokensSource).toContain(".windowed-os-shell[data-wos-theme-mode='auto']\n  :where(");
    for (const selector of [
      '.wos-taskbar__button',
      '.wos-start-menu__item',
      '.wos-window__titlebar',
      '.wos-window__controls button',
      '.wos-page-section',
      '.wos-page-button',
      '.wos-segmented-control__item',
      '.wos-settings-row',
      '.wos-data-row',
      '.wos-key-value-grid__item',
      '.wos-chat-window-toolbar__button',
      '.wos-terminal-panel',
      '.wos-window-route-body .ui-workbench-tab',
    ]) {
      expect(tokensSource).toContain(selector);
    }
    expect(tokensSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(tokensSource).toContain('transition: none;');
  });

  it('documents light, dark, and automatic token variants in isolated Storybook examples', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const ThemeVariants');
    expect(source).toContain('export const TimeOfDayThemePhases');
    expect(source).toContain('export const DrawingsPickerSubwindow');
    expect(source).toContain('data-windowed-subwindow="drawing-picker"');
    expect(source).toContain('data-parent-window-title="Release planning"');
    expect(source).toContain('className="wos-theme-variant-grid"');
    expect(source).toContain('className="windowed-os-shell wos-theme-phase-card"');
    expect(source).toContain('export const DarkDesktopComposition');
    expect(source).toContain('<DesktopCompositionStory theme="dark" />');
    expect(source).toContain('data-wos-theme={theme.resolved}');
    expect(source).toContain('data-wos-theme-mode={theme.mode}');
    expect(source).toContain('data-wos-theme-phase={theme.phase}');
    expect(source).toContain("mode: 'auto'");
    expect(source).toContain("width: 'min(640px, calc(100% - 104px))'");
    for (const phase of ['deep-night', 'night', 'dawn', 'morning', 'bright-noon', 'afternoon', 'dusk']) {
      expect(source).toContain(`phase: '${phase}'`);
    }
    expect(source).toContain('Theme tokens');
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
    expect(stylesSource).toContain('.wos-toggle {\n  position: relative;');
    expect(stylesSource).toContain('width: 44px;\n  min-width: 44px;\n  height: 24px;\n  min-height: 24px;');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900);');
    expect(stylesSource).toContain('.wos-toggle__thumb {');
    expect(stylesSource).toContain('transition: transform 120ms ease;');
    expect(stylesSource).toContain(".wos-toggle[data-checked='true'] .wos-toggle__thumb {\n  transform: translateX(20px);");
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce) {\n  .wos-toggle__thumb {\n    transition: none;');
    expect(stylesSource).toContain('.wos-toggle:focus-visible {');
    expect(stylesSource).toContain(".windowed-os-shell[data-wos-theme='dark'] .wos-toggle[data-checked='true'][data-accent='settings']");
    expect(stylesSource).toContain(".wos-taskbar__button[data-focused='true'][data-accent='chat'],");
    expect(stylesSource).toContain(".wos-window__titlebar[data-accent='chat'],");
    expect(stylesSource).toContain(".wos-dialog__titlebar[data-accent='chat'],");
    expect(stylesSource).toContain('color: var(--wos-accent-ink);');
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
    expect(stylesSource).toContain('.wos-start-menu__item {\n  position: relative;\n  display: flex;\n  width: 100%;');
    expect(stylesSource).toContain('justify-content: flex-start;');
    expect(stylesSource).toContain('.wos-start-menu__item > .wos-app-tile {\n  width: 100%;\n  flex: 1 1 auto;');
    expect(stylesSource).toContain('pointer-events: none;');
  });

  it('keeps the taskbar theme segmented control compact inside desktop controls', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-taskbar__trailing .wos-taskbar-theme-toggle');
    expect(stylesSource).toContain('.wos-taskbar__trailing .wos-taskbar-theme-toggle .wos-segmented-control__item');
    expect(stylesSource).toContain('border-radius: 0 !important;');
    expect(stylesSource).toContain('background: var(--wos-segmented-active) !important;');
  });

  it('restyles injected stable top-bar actions as compact windowed taskbar controls', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-taskbar__system-controls,\n.wos-taskbar__extension-actions {');
    expect(stylesSource).toContain('.wos-taskbar__extension-actions {\n  flex: 1 1 auto;');
    expect(stylesSource).toContain('max-width: min(30vw, 260px);');
    expect(stylesSource).toContain('.wos-taskbar__trailing {\n    max-width: min(34vw, 180px);');
    expect(stylesSource).toContain('.wos-taskbar__extension-actions {\n    max-width: min(18vw, 96px);');
    expect(stylesSource).toContain('.wos-taskbar__trailing :where(button, a) {\n    max-width: 120px;');
    expect(stylesSource).toContain('@media (max-width: 420px) {\n  .wos-taskbar {');
    expect(stylesSource).toContain('.wos-taskbar__trailing {\n    max-width: min(31vw, 116px);');
    expect(stylesSource).toContain('.wos-taskbar__trailing :where(button, a) {\n    width: 54px;');
    expect(stylesSource).toContain('justify-content: flex-start;');
    expect(stylesSource).toContain('overflow-x: auto;');
    expect(stylesSource).toContain('.wos-taskbar__extension-actions::-webkit-scrollbar');
    expect(stylesSource).toContain(
      '.wos-taskbar__trailing :where(.ui-toolbar-button.ui-desktop-top-bar__icon-button, .ui-icon-button.ui-desktop-top-bar__icon-button)',
    );
    expect(stylesSource).toContain('width: 30px !important;');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('filter: none !important;');
    expect(stylesSource).toContain('.wos-taskbar__trailing :where(button, a) > :where(span:not(.ui-tooltip), div) {\n  min-width: 0;');
    expect(stylesSource).toContain('text-overflow: ellipsis;');
    expect(stylesSource).toContain('.wos-taskbar__trailing .ui-notification-badge');
    expect(stylesSource).toContain('.wos-taskbar__trailing .ui-tooltip');
    expect(stylesSource).toContain('z-index: 1100;');
  });

  it('styles the windowed chat workbench toggle as compact window chrome', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window-route-body--chat {\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);');
    expect(stylesSource).toContain('.wos-chat-window-toolbar {\n  display: flex;');
    expect(stylesSource).toContain('min-height: 42px;');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('justify-content: space-between;');
    expect(stylesSource).toContain('gap: 6px 8px;');
    expect(stylesSource).toContain('border-bottom: 2px solid var(--wos-ink-900);');
    expect(stylesSource).toContain('box-shadow: inset 0 -2px 0 var(--wos-surface-3);');
    expect(stylesSource).toContain('.wos-chat-window-toolbar__label');
    expect(stylesSource).toContain('border: var(--wos-border-strong) solid color-mix(in srgb, var(--wos-ink-900) 72%, transparent);');
    expect(stylesSource).toContain('.wos-chat-window-toolbar__actions');
    expect(stylesSource).toContain('flex: 0 1 auto;');
    expect(stylesSource).toContain(".wos-chat-window-toolbar__button[data-density='icon']");
    expect(stylesSource).toContain('flex: 0 0 30px;');
    expect(stylesSource).toContain('.wos-chat-window-toolbar__button svg');
    expect(stylesSource).toContain(".wos-chat-window-toolbar__button[aria-pressed='true']");
    expect(stylesSource).toContain('color: var(--wos-accent-ink);');
  });

  it('restyles stable conversation controls with scoped windowed chrome', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .conversation-composer-region');
    expect(stylesSource).toContain('border-top: 2px solid var(--wos-ink-900);');
    expect(stylesSource).toContain('.wos-window-route-body--chat .conversation-composer-region');
    expect(stylesSource).toContain('z-index: 30;');
    expect(stylesSource).toContain('.wos-window-route-body--chat > * {\n  min-width: 0;\n  min-height: 0;');
    expect(stylesSource).toContain('.wos-inherited-chat-preview');
    expect(stylesSource).toContain('.wos-inherited-chat-preview {\n  display: grid;\n  min-width: 0;');
    expect(stylesSource).toContain('grid-template-rows: minmax(0, 1fr) auto;');
    expect(stylesSource).toContain(".wos-inherited-chat-preview > [data-chat-transcript-panel='1']");
    expect(stylesSource).toContain(
      ".wos-inherited-chat-preview > [data-chat-transcript-panel='1'] {\n  min-width: 0;\n  min-height: 0;\n  width: 100%;",
    );
    expect(stylesSource).toContain('.wos-inherited-chat-preview > .conversation-composer-region');
    expect(stylesSource).toContain('.wos-window-route-body--chat .ui-input-shell');
    expect(stylesSource).toContain('overflow: visible;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-input-shell {');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.windowed-os-shell\n  .wos-window-route-body--chat\n  .conversation-composer-inner');
    expect(stylesSource).toContain(":where(input, textarea, button, select, [contenteditable='true'])");
    expect(stylesSource).toContain(
      ".windowed-os-shell .wos-window-route-body--chat .ui-input-shell textarea,\n.windowed-os-shell .wos-window-route-body--chat .ui-input-shell [contenteditable='true']",
    );
    expect(stylesSource).toContain('font-family: var(--wos-font-body) !important;');
    expect(stylesSource).toContain('width: 100%;');
    expect(stylesSource).toContain('min-height: 44px;');
    expect(stylesSource).toContain('font-weight: 500 !important;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-input-shell textarea::placeholder');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-input-shell:focus-within');
    expect(stylesSource).toContain('outline: 2px solid var(--wos-chat);');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-notice');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-notice__pill');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-pill.ui-composer-notice__pill');
    expect(stylesSource).toContain(".windowed-os-shell .wos-window-route-body--chat .ui-composer-notice[data-tone='warning']");
    expect(stylesSource).toContain('background: color-mix(in srgb, var(--wos-warning) 14%, var(--wos-surface-2));');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-notice,\n.windowed-os-shell .wos-window-route-body--chat .ui-composer-notice__pill,\n.windowed-os-shell .wos-window-route-body--chat .ui-input-shell',
    );
    expect(stylesSource).toContain('border-left-width: 2px !important;');
    expect(stylesSource).toContain('border-left: 0 !important;');
    expect(stylesSource).not.toContain('box-shadow: inset 5px 0 0 var(--wos-warning);');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf');
    expect(stylesSource).toContain('border-top: 0 !important;');
    expect(stylesSource).toContain('border-right: 0 !important;');
    expect(stylesSource).toContain('border-bottom: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf__row');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('flex: 1 1 260px;');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-attachment-chip)',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-attachment-chip-button)',
    );
    expect(stylesSource).toContain(':where(.ui-attachment-chip-button > span:first-child:not([class]))');
    expect(stylesSource).toContain('text-transform: uppercase;');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-attachment-chip__name)',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-attachment-chip__preview)',
    );
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-icon-button)');
    expect(stylesSource).toContain('width: 26px;\n  min-width: 26px;\n  height: 26px;\n  min-height: 26px;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf :where(.ui-text-button)');
    expect(stylesSource).toContain('min-height: 26px;\n  flex-shrink: 0;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-attachment-shelf__status');
    expect(stylesSource).toContain('.wos-window-route-body .bg-base');
    expect(stylesSource).toContain('background: var(--wos-surface-1) !important;');
    expect(stylesSource).toContain('.wos-window-route-body .text-primary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-input-controls');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-input-controls__control-row');
    expect(stylesSource).toContain('flex-wrap: nowrap;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-input-controls__leading');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-input-controls__actions');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-meta');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-tool-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-model-fallback');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-preferences-row__menu-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-preferences-row > button');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-composer-preferences-row > div > button:not(.ui-context-menu-item)',
    );
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-actions > button.ui-icon-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-preferences-row .ui-menu-trigger-inline');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-positioned-menu-static');
    expect(stylesSource).toContain('width: fit-content;');
    expect(stylesSource).toContain('max-width: min(100%, 380px);');
    expect(stylesSource).toContain('margin: 6px 0 0 auto;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-positioned-menu-static .ui-context-menu-item');
    expect(stylesSource).toContain('justify-content: flex-start;');
    expect(stylesSource).toContain('min-height: 32px;');
    expect(stylesSource).toContain('border: var(--wos-border-strong) solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('background: var(--wos-surface-1) !important;');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-positioned-menu-static .ui-context-menu-item + .ui-context-menu-item',
    );
    expect(stylesSource).toContain(
      '@container wos-window-route (max-width: 680px) {\n  .windowed-os-shell .wos-window-route-body--chat .ui-positioned-menu-static',
    );
    expect(stylesSource).toContain('width: 100%;\n    max-width: 100%;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-composer-actions');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-icon');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-label');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-compact-label');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-accent');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-warning');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-danger');
    expect(stylesSource).toContain('font: var(--wos-text-row);');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-warning {\n  background: color-mix(in srgb, var(--wos-warning) 18%, var(--wos-surface-1)) !important;\n  box-shadow: none;',
    );
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat button.ui-composer-action-button-danger {\n  background: var(--wos-surface-1) !important;\n  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--wos-danger) 72%, transparent);',
    );
    expect(stylesSource).toContain("body[data-neon-pilot-windowed-shell-active='true'] .ui-menu-shell");
    expect(stylesSource).toContain("body[data-neon-pilot-windowed-shell-active='true'] .ui-context-menu-item");
    expect(stylesSource).toContain("body[data-neon-pilot-windowed-shell-active='true'] .ui-context-menu-item.bg-elevated");
    expect(stylesSource).toContain('background: var(--wos-chat, oklch(66% 0.14 250)) !important;');
    expect(stylesSource).toContain('color: var(--wos-accent-ink) !important;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body .ui-row-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-conversation-setup-empty');
    expect(stylesSource).not.toContain('.windowed-os-shell .wos-window-route-body .conversation-composer-region');
    expect(stylesSource).not.toContain('.windowed-os-shell .wos-window-route-body .ui-input-shell {');
  });

  it('restyles transcript cards, metadata, pills, and tool blocks with scoped windowed chrome', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain(".windowed-os-shell .wos-window-route-body--chat [data-chat-transcript-panel='1']");
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .border-l {\n  border-left-width: 0 !important;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-card-user');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-card-assistant');
    expect(stylesSource).toContain('background: color-mix(in srgb, var(--wos-chat) 18%, var(--wos-surface-1));');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-meta');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown {');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown blockquote');
    expect(stylesSource).toContain('border: var(--wos-border-strong) solid color-mix(in srgb, var(--wos-chat) 64%, var(--wos-ink-900));');
    expect(stylesSource).not.toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown blockquote {\n  border-left');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown :not(pre) > code');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown pre');
    expect(stylesSource).toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-markdown pre code {\n  display: block;\n  min-width: 0;',
    );
    expect(stylesSource).toContain('white-space: pre-wrap;\n  overflow-wrap: anywhere;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-markdown table');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-skill-invocation {');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-skill-invocation summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-skill-invocation-summary::before');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-skill-invocation-label');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-skill-invocation-body');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-lifecycle-marker');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat button.ui-context-lifecycle-marker');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__item');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__summary-main');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__label');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__preview');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__rule');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-context-shelf__body');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-action-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-action-button-icon');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-actions-preview');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tooltip-host');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tooltip');
    expect(stylesSource).toContain('position: absolute;');
    expect(stylesSource).toContain('width: max-content;');
    expect(stylesSource).toContain('visibility: hidden;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tooltip-top-right');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-message-card-user .ui-tooltip-top-right');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tooltip-bottom-right');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tooltip-host:hover > .ui-tooltip');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__summary-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__rule');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__body');
    expect(stylesSource).toContain('border-top: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('border-left: 0 !important;');
    expect(stylesSource).not.toContain(
      '.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__body {\n  display: grid;\n  gap: 6px;\n  margin-top: 7px;\n  margin-left: 10px !important;\n  border-left',
    );
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-trace-cluster__overflow');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-thinking-block');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-thinking-block__header');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-thinking-block__body');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-subagent-block');
    expect(stylesSource).toContain(".windowed-os-shell .wos-window-route-body--chat .ui-subagent-block[data-status='complete']");
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-subagent-block__header');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-subagent-block__body');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-pill');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-pill-accent');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-pill-danger');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__body');
    expect(stylesSource).toContain('overflow: hidden;\n  border: 1.5px solid var(--wos-ink-900);');
    expect(stylesSource).toContain('padding: 7px 9px;');
    expect(stylesSource).toContain('font-weight: 700;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__routine');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__linked-runs');
    expect(stylesSource).toContain('border-top: 1.5px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__linked-runs-summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__linked-run');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__mentioned-runs');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__output');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-tool-block__pre');
    expect(stylesSource).toContain(".windowed-os-shell .wos-window-route-body--chat [data-transcript-event='ask-user-question']");
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-ask-user-question__header');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-ask-user-question__tabs');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-ask-user-question__panel');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-choice-row');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-choice-row-checked');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-choice-row-indicator-checked');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-choice-row-details');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block__chrome');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block__command');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block__output');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block__empty-output');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-terminal-block__muted');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-panel-muted');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-inline-run-card');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-inline-run-card__summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-inline-run-card .ui-action-button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-inline-run-card__output');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-disclosure-summary');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-disclosure[open] .ui-disclosure-summary::after');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-error-block');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-error-block__body');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-error-block__message');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-error-block__tool');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-error-block__text');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-image-preview');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-image-preview__button');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-image-preview__media');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-image-preview__placeholder');
    expect(stylesSource).toContain('.windowed-os-shell .wos-window-route-body--chat .ui-image-preview__caption');
    expect(stylesSource).toContain('.windowed-os-shell .ui-image-inspect-backdrop');
    expect(stylesSource).toContain('.windowed-os-shell .ui-image-inspect-dialog');
    expect(stylesSource).toContain('.windowed-os-shell .ui-image-inspect-caption');
    expect(stylesSource).toContain('.windowed-os-shell .ui-image-inspect-dialog .ui-icon-button');
    expect(stylesSource).toContain('font-family: var(--wos-font-mono);');
    expect(stylesSource).not.toContain(".windowed-os-shell .wos-window-route-body [data-chat-transcript-panel='1']");
    expect(stylesSource).not.toContain('.windowed-os-shell .wos-window-route-body .ui-message-card-user');
  });

  it('restyles the attached workbench tab strip with scoped windowed chrome', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-panel');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-panel {\n  border-right: 0;\n  border-left: 0;');
    expect(stylesSource).toContain(
      ".wos-window-route-body--chat :where(.ui-workbench-panel, .wos-chat-workbench__panel)[data-windowed-attached-workbench='true']",
    );
    expect(stylesSource).toContain(
      ".wos-window-route-body--chat :where(.ui-workbench-panel, .wos-chat-workbench__panel)[data-windowed-attached-workbench='true'] {\n  min-width: 0;\n  border-left: 0;",
    );
    expect(stylesSource).toContain('container: wos-attached-workbench / inline-size;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-panel__body');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-panel__body {\n  min-height: 0;\n  overflow: auto;');
    expect(stylesSource).toContain('.wos-chat-workbench__body > * {\n  box-sizing: border-box;\n  width: 100%;\n  min-width: 0;');
    expect(stylesSource).toContain(".wos-window-route-body .ui-workbench-panel[data-has-open-file='true'] .ui-workbench-panel__body");
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-strip');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab {');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-active');
    expect(stylesSource).toContain('box-shadow: inset 0 -3px 0 var(--wos-ink-900);');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab:hover .ui-workbench-tab-icon');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-close-button');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-action-button');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-strip__new');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-file-bar');
    expect(stylesSource).toContain(
      '.wos-window-route-body .ui-workbench-file-bar {\n  display: flex;\n  min-height: 38px;\n  min-width: 0;',
    );
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-file-bar__path-label');
    expect(stylesSource).toContain(
      '.wos-window-route-body .ui-workbench-file-bar__path {\n  display: flex;\n  min-height: 26px;\n  min-width: 0;\n  flex: 1 1 auto;',
    );
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-file-bar__path-label {\n  min-width: 0;\n  overflow: hidden;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-file-bar__button');
    expect(stylesSource).toContain('.wos-window-route-body .ui-resize-handle__line');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-rail');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-page');
    expect(stylesSource).toContain('linear-gradient(var(--wos-grid-line) 1px, transparent 1px)');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-page__inner');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-page__title');
    expect(stylesSource).toContain('box-shadow: var(--wos-shadow-offset);');
    expect(stylesSource).toContain('background: color-mix(in srgb, var(--wos-surface-1) 88%, var(--wos-surface-2));');
    expect(stylesSource).not.toContain('color-mix(in srgb, var(--wos-surface-1) 92%, white)');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-grid');
    expect(stylesSource).toContain('@container wos-attached-workbench (max-width: 360px)');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab-strip__scroller');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-tab {\n    flex: 1 1 132px;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-action-tile');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-grid .ui-action-tile:hover');
    expect(stylesSource).toContain('.wos-window-route-body .ui-workbench-new-tab-grid .ui-action-tile-icon');
    expect(stylesSource).toContain('.wos-window-route-body .ui-action-tile-main');
    expect(stylesSource).toContain('.wos-window-route-body .ui-action-tile-label');
    expect(stylesSource).toContain('color: var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.wos-window-route-body .ui-action-tile-icon');
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

  it('keeps window route bodies and quiet loading fallbacks visibly filled', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window-route-body {\n  --color-base: 252 247 236;');
    expect(stylesSource).toContain('display: flex;\n  flex-direction: column;');
    expect(stylesSource).toContain(
      '.wos-window-route-body > :not(.wos-chat-window-toolbar) {\n  flex: 1 1 auto;\n  min-width: 0;\n  min-height: 0;\n  height: 100%;',
    );
    expect(stylesSource).not.toContain('.wos-window-route-body > * {\n  flex: 1 1 auto;');
    expect(stylesSource).toContain(".wos-window-route-body > [role='status'][aria-live='polite']");
    expect(stylesSource).toContain(".wos-window-route-body > [role='status'][aria-live='polite']:empty::before");
    expect(stylesSource).toContain('content: attr(aria-label);');
    expect(stylesSource).toContain('.wos-window-route-loading {\n  display: grid;');
    expect(stylesSource).toContain('place-items: center;');
    expect(stylesSource).toContain('.wos-window-route-loading .wos-state-block');
  });

  it('scopes drawing modal chrome to the windowed shell', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain("body[data-neon-pilot-windowed-shell-active='true'] .ui-windowed-drawings-picker");
    expect(stylesSource).toContain("body[data-neon-pilot-windowed-shell-active='true'] .ui-windowed-excalidraw-modal");
    expect(stylesSource).toContain('.ui-overlay-backdrop:has(.ui-windowed-drawings-picker)');
    expect(stylesSource).toContain('background: oklch(96% 0.02 80 / 0.14) !important;');
    expect(stylesSource).toContain('.ui-windowed-drawings-picker[data-parent-window-attached]');
    expect(stylesSource).toContain('.ui-windowed-excalidraw-modal[data-parent-window-attached]');
    expect(stylesSource).toContain('display: flex !important;');
    expect(stylesSource).toContain('width: min(640px, calc(100vw - 72px)) !important;');
    expect(stylesSource).toContain('@media (max-width: 560px) {\n  body[data-neon-pilot-windowed-shell-active=');
    expect(stylesSource).toContain('width: min(640px, calc(100vw - 20px)) !important;');
    expect(stylesSource).toContain('width: min(860px, calc(100vw - 96px)) !important;');
    expect(stylesSource).toContain('height: min(560px, calc(100vh - 156px)) !important;');
    expect(stylesSource).toContain('.ui-windowed-excalidraw-backdrop {\n  pointer-events: none;');
    expect(stylesSource).toContain(".ui-windowed-excalidraw-modal[data-parent-window-minimized='true']");
    expect(stylesSource).toContain(".ui-windowed-drawings-picker[data-parent-window-minimized='true']");
    expect(stylesSource).toContain('display: none !important;');
    expect(stylesSource).toContain('pointer-events: auto;');
    expect(stylesSource).toContain('max-width: none !important;');
    expect(stylesSource).toContain("content: 'Attached';");
    expect(stylesSource).toContain('.ui-windowed-excalidraw-modal .ui-dialog-header-copy');
    expect(stylesSource).toContain('flex: 0 1 auto;');
    expect(stylesSource).toContain('order: 2;');
    expect(stylesSource).toContain('margin-right: var(--wos-space-3);');
    expect(stylesSource).toContain('text-overflow: ellipsis;');
    expect(stylesSource).toContain('.ui-windowed-drawings-picker .ui-toolbar-button');
    expect(stylesSource).toContain('.ui-windowed-drawings-picker .ui-card-title');
    expect(stylesSource).toContain('.ui-windowed-drawings-picker .ui-windowed-drawing-card__row');
    expect(stylesSource).toContain(
      '.ui-windowed-drawings-picker .ui-windowed-drawing-card__row {\n    align-items: stretch;\n    flex-direction: column;',
    );
    expect(stylesSource).toContain('.ui-windowed-excalidraw-modal .ui-dialog-actions');
    expect(stylesSource).toContain('order: 3;');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900) !important;');
    expect(stylesSource).toContain('.ui-windowed-excalidraw-modal .excalidraw-editor-modal__toolbar');
    expect(stylesSource).toContain('.ui-windowed-excalidraw-modal .excalidraw-editor-modal__canvas');
  });

  it('contains iframe paint inside window bodies without blanketing window content with the shield', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-window__body {\n  position: relative;');
    expect(stylesSource).toContain('display: grid;');
    expect(stylesSource).toContain('clip-path: inset(0);');
    expect(stylesSource).toContain('isolation: isolate;');
    expect(stylesSource).toContain('contain: paint;');
    expect(stylesSource).toContain('container-type: inline-size;');
    expect(stylesSource).toContain('.wos-window__body > * {\n  position: relative;\n  z-index: 0;');
    expect(stylesSource).toContain('min-width: 0;\n  min-height: 0;');
    expect(stylesSource).toContain('.wos-window__titlebar,\n.wos-window__controls,\n.wos-resize-handle {\n  transform: translateZ(0);');
    expect(stylesSource).toContain('.wos-composited-frame {\n  position: relative;');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host {');
    expect(stylesSource).toContain(
      '.windowed-os-shell .ui-windowed-browser-host {\n  position: relative;\n  z-index: 0 !important;\n  min-height: 0;',
    );
    expect(stylesSource).toContain('.wos-window-route-body--chat .wos-chat-workbench__body .ui-windowed-browser-host');
    expect(stylesSource).toContain('min-height: 172px;');
    expect(stylesSource).toContain('border: 2px solid var(--wos-ink-900);');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host__blocker {');
    expect(stylesSource).toContain(
      ".windowed-os-shell .ui-windowed-browser-host__blocker :where(h1, h2, h3, p, button, input, textarea, select, [role='status'])",
    );
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host__state {');
    expect(stylesSource).toContain('width: min(420px, 100%);\n  min-width: 0;');
    expect(stylesSource).toContain('max-height: 100%;\n  overflow: auto;\n  scrollbar-gutter: stable both-edges;');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host__url {');
    expect(stylesSource).toContain('font-family: var(--wos-font-mono);');
    expect(stylesSource).toContain('font-size: 10px;');
    expect(stylesSource).toContain(".windowed-os-shell[data-wos-theme='dark'] .wos-state-block[data-tone='warning']");
    expect(stylesSource).toContain('color: var(--wos-warning);');
    expect(stylesSource).toContain('.wos-chat-window-toolbar__button:disabled');
    expect(stylesSource).toContain('.wos-chat-browser-dialog__body');
    expect(stylesSource).toContain(".wos-chat-browser-dialog__body > [data-extension-id='system-browser']");
    expect(stylesSource).toContain('.wos-window-route-body--browser .wos-chat-browser-dialog__body');
    expect(stylesSource).toContain('.wos-window-route-body--browser .wos-chat-browser-dialog__body .ui-windowed-browser-host');
    expect(stylesSource).toContain('.wos-chat-child-window-empty');
    expect(stylesSource).toContain('.wos-chat-child-window-empty .wos-state-block');
    expect(stylesSource).toContain(
      ".windowed-os-shell[data-native-browser-blocked='true'] .ui-windowed-browser-host[data-windowed-browser-host='true']",
    );
    expect(stylesSource).toContain('display: none !important;');
    expect(stylesSource).toContain('.wos-window__iframe-shield');
    expect(stylesSource).toContain('.wos-window__iframe-shield {\n  position: absolute;');
    expect(stylesSource).toContain('display: none !important;\n  visibility: hidden;\n  opacity: 0;');
    expect(stylesSource).toContain('background: transparent;');
    expect(stylesSource).toContain('.windowed-os-shell .ui-windowed-browser-host {\n  position: relative;\n  z-index: 0 !important;');
    expect(stylesSource).toContain('z-index: 95;');
    expect(stylesSource).toContain('.wos-window__titlebar {\n  position: relative;\n  z-index: 70;');
    expect(stylesSource).toContain('.wos-resize-handle {\n  position: absolute;\n  z-index: 55;');
    expect(stylesSource).toContain('--wos-window-control-clearance: calc((var(--wos-window-control-size) * 3) + 38px);');
    expect(stylesSource).toContain('.wos-resize-n {\n  right: var(--wos-window-control-clearance);');
    expect(stylesSource).toContain('.wos-resize-e,\n.wos-resize-w {\n  top: var(--wos-titlebar-h);');
    expect(stylesSource.indexOf('z-index: 70;')).toBeLessThan(stylesSource.indexOf('z-index: 55;'));
    expect(stylesSource).not.toContain(
      ".wos-window[data-focused='false']:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(
      ".wos-window[data-iframe-blocked='true']:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview) > .wos-window__iframe-shield",
    );
    expect(stylesSource).not.toContain(
      ".windowed-os-shell[data-window-interaction='true'] .wos-window:has(.ui-windowed-browser-host, .wos-composited-frame, iframe, webview)",
    );
    expect(stylesSource).not.toContain(
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
    expect(stylesSource).toContain(".wos-window[data-iframe-blocked='true'] .wos-composited-frame");
    expect(stylesSource).toContain(".windowed-os-shell[data-window-interaction='true'] .wos-composited-frame");
    expect(stylesSource).toContain(".windowed-os-shell[data-frame-paint-blocked='true'] .wos-composited-frame");
    expect(stylesSource).not.toContain(".wos-window[data-focused='false'] .wos-window__body iframe");
    expect(stylesSource).not.toContain(".wos-window[data-iframe-blocked='true'] .wos-window__body iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-window-interaction='true'] iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-window-interaction='true'] webview");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-window-interaction='true'] .wos-window__body iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-frame-paint-blocked='true'] iframe");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-frame-paint-blocked='true'] webview");
    expect(stylesSource).not.toContain(".windowed-os-shell[data-frame-paint-blocked='true'] .wos-window__body iframe");
    expect(stylesSource).not.toContain('.windowed-os-shell .wos-window__body iframe');
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
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-menu-shell:not(.ui-positioned-menu-static)) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-context-menu-shell:not(.ui-positioned-menu-static)) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-positioned-menu:not(.ui-positioned-menu-static)) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-command-palette-shell) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-setup-readiness-popover) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-notification-toaster) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.ui-page-search-popover) .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-overlay-backdrop) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-dialog-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-menu-shell:not(.ui-positioned-menu-static)) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain(
      'body:has(.ui-context-menu-shell:not(.ui-positioned-menu-static)) .windowed-os-shell .wos-composited-frame',
    );
    expect(stylesSource).toContain(
      'body:has(.ui-positioned-menu:not(.ui-positioned-menu-static)) .windowed-os-shell .wos-composited-frame',
    );
    expect(stylesSource).toContain('body:has(.ui-command-palette-shell) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-setup-readiness-popover) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-notification-toaster) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).toContain('body:has(.ui-page-search-popover) .windowed-os-shell .wos-composited-frame');
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] .wos-composited-frame");
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] iframe");
    expect(stylesSource).not.toContain("body[data-neon-pilot-windowed-shell-active='true'] webview");
    expect(stylesSource).not.toContain('.windowed-os-shell:has(.wos-taskbar) .wos-composited-frame');
    expect(stylesSource).not.toContain('.windowed-os-shell:has(.wos-start-menu) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.wos-taskbar__menu-layer) .wos-composited-frame');
    expect(stylesSource).toContain('.windowed-os-shell:has(.wos-snap-preview) .wos-composited-frame');
    expect(stylesSource).toContain('opacity: 0;');
    expect(stylesSource).toContain('visibility: hidden;');
    expect(stylesSource).toContain('pointer-events: none;');
  });

  it('keeps Start menu rows full-width and pointer-owned by the row button', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-start-menu__grid {\n  display: grid;');
    expect(stylesSource).toContain('justify-items: stretch;');
    expect(stylesSource).toContain('.wos-start-menu__item {\n  position: relative;\n  display: flex;\n  width: 100%;');
    expect(stylesSource).toContain('justify-content: flex-start;');
    expect(stylesSource).toContain('.wos-start-menu__item > .wos-app-tile {\n  width: 100%;\n  flex: 1 1 auto;');
    expect(stylesSource).toContain('pointer-events: none;');
    expect(stylesSource).toContain(".wos-start-menu__item[data-open='true']::before");
    expect(stylesSource).toContain(".wos-start-menu__item[data-focused='true']::before");
    expect(stylesSource).toContain('flex: 0 0 auto;');
    expect(stylesSource).not.toContain('.wos-start-menu__item::after');
  });

  it('keeps the north-east resize handle in the titlebar clearance area', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');
    const northEastRule = stylesSource.match(/\.wos-resize-ne \{[^}]+}/)?.[0] ?? '';

    expect(northEastRule).toContain('top: 0;');
    expect(northEastRule).toContain('right: var(--wos-window-control-clearance);');
    expect(northEastRule).not.toContain('top: var(--wos-titlebar-h);');
    expect(northEastRule).not.toContain('right: 0;');
  });

  it('styles parent-attached subwindows distinctly from blocking modals', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-dialog-layer[data-parent-window-title],\n.wos-dialog-layer[data-parent-window-id]');
    expect(stylesSource).toContain('padding-block-start: 68px;');
    expect(stylesSource).toContain('.wos-dialog-layer[data-parent-window-title],\n  .wos-dialog-layer[data-parent-window-id]');
    expect(stylesSource).toContain('padding-block-start: 16px;');
    expect(stylesSource).toContain(".wos-dialog[data-parent-window-attached='true']");
    expect(stylesSource).toContain('width: min(560px, calc(100% - 72px));');
    expect(stylesSource).toContain('max-height: min(560px, calc(100% - 48px));');
    expect(stylesSource).toContain('8px 8px 0 color-mix(in srgb, var(--wos-ink-900) 13%, transparent)');
    expect(stylesSource).toContain(".wos-dialog[data-parent-window-attached='true'] {\n    width: 100%;");
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
    expect(stylesSource).toContain('.wos-diagnostics-overview__charts {');
    expect(stylesSource).toContain('.wos-heatmap .wos-chart-panel__body {');
    expect(stylesSource).toContain('.wos-heatmap-grid {');
    expect(stylesSource).toContain('width: max-content;');
    expect(stylesSource).toContain('max-width: 100%;');
    expect(stylesSource).toContain('.wos-heatmap-legend {\n  display: flex;\n  width: 100%;\n  min-width: 0;');
    expect(stylesSource).not.toContain('min-width: 500px;');
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

  it('collapses dense diagnostics tables at compact window widths', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('@container (max-width: 760px)');
    expect(stylesSource).toContain('@container (max-width: 720px)');
    expect(stylesSource).toContain('.wos-model-usage__grid,\n  .wos-cache-system__grid');
    expect(stylesSource).toContain('.wos-data-table:not(.wos-automation-queue) .wos-data-table__header');
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

  it('documents the canonical terminal and browser child windows in isolated Storybook examples', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('export const TerminalWindow');
    expect(source).toContain('<WindowedTerminalFrame cwd="/Users/patrick/workingdir/neon-pilot" status="PTY shell">');
    expect(source).toContain('PASS terminal frame tokens');
    expect(source).toContain('export const BrowserWindow');
    expect(source).toContain('data-windowed-subwindow="browser"');
    expect(source).toContain('aria-label="Browser child window preview"');
  });

  it('documents the chat workbench toggle in the attached-workbench Storybook example', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('function AttachedWorkbenchStory');
    expect(source).toContain('export const ChatWithAttachedWorkbench');
    expect(source).toContain('export const DarkChatWithAttachedWorkbench');
    expect(source).toContain('export const ChatWithCollapsedWorkbench');
    expect(source).toContain('export const DarkChatWithCollapsedWorkbench');
    expect(source).toContain('<AttachedWorkbenchStory theme="dark" />');
    expect(source).toContain('<AttachedWorkbenchStory workbenchCollapsed />');
    expect(source).toContain('<AttachedWorkbenchStory theme="dark" workbenchCollapsed />');
    expect(source).toContain('function AttachedBrowserWorkbenchStory');
    expect(source).toContain('export const ChatWithAttachedBrowserWorkbench');
    expect(source).toContain('export const DarkChatWithAttachedBrowserWorkbench');
    expect(source).toContain('<AttachedBrowserWorkbenchStory theme="dark" />');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).toContain("data-workbench-collapsed={workbenchCollapsed ? 'true' : undefined}");
    expect(source).toContain('className="wos-chat-window-toolbar"');
    expect(source).toContain("const workbenchToggleLabel = workbenchCollapsed ? 'Show workbench' : 'Hide workbench';");
    expect(source).toContain('aria-label={workbenchToggleLabel}');
    expect(source).toContain('aria-pressed={!workbenchCollapsed}');
    expect(source).toContain("name={workbenchCollapsed ? 'workbench-hidden' : 'workbench-visible'}");
    expect(source).toContain('aria-label="Open Browser window"');
    expect(source).toContain('aria-label="Open Terminal window"');
    expect(source).toContain('data-density="icon"');
    expect(source).toContain('data-windowed-attached-workbench="true"');
    expect(source).toContain('className="wos-chat-workbench__panel ui-workbench-panel"');
    expect(source).toContain('className="wos-chat-workbench__tabs ui-workbench-tab-strip"');
    expect(source).toContain('className="wos-chat-workbench__body ui-workbench-panel__body"');
    expect(source).toContain('className="ui-workbench-tab ui-workbench-tab-active"');
    expect(source).toContain('className="ui-windowed-browser-host"');
    expect(source).toContain('data-windowed-browser-host="true"');
    expect(source).toContain('className="ui-windowed-browser-host__blocker"');
    expect(source).toContain('className="ui-windowed-browser-host__url"');
  });

  it('defines a one-column chat layout when the attached workbench is collapsed', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('@container wos-window-route (max-width: 860px)');
    expect(stylesSource).not.toContain('@media (max-width: 860px) {\n  .wos-chat-workbench');
    expect(stylesSource).toContain('grid-template-rows: minmax(320px, 1fr) minmax(220px, 42%);');
    expect(stylesSource).toContain('.wos-chat-workbench__panel {\n    border-top: 2px solid var(--wos-ink-900);');
    expect(stylesSource).toContain(".wos-window-route-body--chat[data-workbench-collapsed='true'] .wos-chat-workbench");
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(stylesSource).toContain('grid-template-rows: minmax(0, 1fr);');
  });

  it('documents inherited chat chrome in an isolated Storybook example', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const inheritedChatSource = source.slice(
      source.indexOf('function InheritedChatChromeStory'),
      source.indexOf('export const InheritedChatChrome'),
    );

    expect(source).toContain('function InheritedChatChromeStory');
    expect(source).toContain('export const InheritedChatChrome');
    expect(source).toContain('export const DarkInheritedChatChrome');
    expect(source).toContain('data-wos-theme={theme}');
    expect(inheritedChatSource).toContain("style={{ minHeight: '100vh', padding: 24 }}");
    expect(source).toContain('<InheritedChatChromeStory theme="dark" />');
    expect(source).toContain('className="ui-message-card-user"');
    expect(source).toContain('className="ui-message-card-assistant"');
    expect(source).toContain('className="ui-markdown"');
    expect(source).toContain('<blockquote>Markdown blocks should feel like part of the desktop, not imported web content.</blockquote>');
    expect(source).toContain('className="ui-markdown-code-block"');
    expect(source).toContain('<table>');
    expect(source).toContain('className="ui-skill-invocation"');
    expect(source).toContain('className="ui-skill-invocation-summary"');
    expect(source).toContain('agent-plugin:local-qa');
    expect(source).toContain('className="ui-context-lifecycle-marker"');
    expect(source).toContain('data-lifecycle-marker="auto-resume"');
    expect(source).toContain('className="ui-context-shelf" data-context-shelf="1"');
    expect(source).toContain('className="ui-context-shelf__item"');
    expect(source).toContain('className="ui-context-shelf__summary-main"');
    expect(source).toContain('className="ui-context-shelf__body"');
    expect(source).toContain('className="ui-message-actions-preview"');
    expect(source).toContain('className="ui-tooltip-host relative inline-flex"');
    expect(source).toContain('className="ui-tooltip ui-tooltip-top-right"');
    expect(source).toContain('Copy this prompt');
    expect(source).toContain('Edit and rerun');
    expect(source).toContain('className="ui-trace-cluster"');
    expect(source).toContain('className="ui-trace-cluster__summary"');
    expect(source).toContain('className="ui-trace-cluster__overflow"');
    expect(source).toContain('className="ui-thinking-block"');
    expect(source).toContain('className="ui-thinking-block__body"');
    expect(source).toContain('className="ui-subagent-block"');
    expect(source).toContain('className="ui-subagent-block__body"');
    expect(source).toContain('className="ui-tool-block"');
    expect(source).toContain('data-transcript-event="ask-user-question"');
    expect(source).toContain('className="ui-ask-user-question__header"');
    expect(source).toContain('className="ui-ask-user-question__tabs"');
    expect(source).toContain('className="ui-choice-row ui-choice-row-checked"');
    expect(source).toContain('className="ui-choice-row-indicator ui-choice-row-indicator-checked"');
    expect(source).toContain('className="ui-choice-row-details"');
    expect(source).toContain('className="ui-terminal-block"');
    expect(source).toContain('className="ui-terminal-block__chrome"');
    expect(source).toContain('className="ui-terminal-block__command"');
    expect(source).toContain('className="ui-terminal-block__output"');
    expect(source).toContain('className="ui-terminal-block__empty-output"');
    expect(source).toContain('className="ui-panel-muted ui-inline-run-card"');
    expect(source).toContain('className="ui-inline-run-card__summary"');
    expect(source).toContain('className="ui-action-button"');
    expect(source).toContain('className="ui-disclosure"');
    expect(source).toContain('className="ui-disclosure-summary"');
    expect(source).toContain('className="ui-inline-run-card__metadata-row"');
    expect(source).toContain('className="ui-notice ui-notice-danger ui-error-block"');
    expect(source).toContain('className="ui-error-block__message"');
    expect(source).toContain('className="ui-error-block__tool"');
    expect(source).toContain('className="ui-error-block__text"');
    expect(source).toContain('storyImagePreviewSrc');
    expect(source).toContain('className="ui-image-preview" data-loaded="true"');
    expect(source).toContain('className="ui-media-preview-button ui-image-preview__button"');
    expect(source).toContain('className="ui-image-preview__media"');
    expect(source).toContain('className="ui-image-preview__placeholder');
    expect(source).toContain('className="ui-image-preview__caption-text');
    expect(source).toContain('className="conversation-composer-region"');
    expect(source).toContain('className="wos-inherited-chat-preview"');
    expect(source).toContain('className="ui-input-shell"');
    expect(source).toContain('className="ui-composer-attachment-shelf"');
    expect(source).toContain('className="ui-attachment-chip"');
    expect(source).toContain('className="ui-attachment-chip-button"');
    expect(source).toContain('className="ui-attachment-chip__name"');
    expect(source).toContain('className="ui-attachment-chip__preview"');
    expect(source).toContain('className="ui-composer-input-controls"');
    expect(source).toContain('className="ui-composer-tool-button"');
    expect(source).toContain('className="ui-composer-model-fallback"');
    expect(source).toContain('className="ui-composer-action-button ui-composer-action-button-accent ui-composer-action-button-icon"');
    expect(source).toContain('className="ui-composer-action-button ui-composer-action-button-warning ui-composer-action-button-label"');
    expect(source).toContain('className="ui-composer-action-button ui-composer-action-button-danger ui-composer-action-button-icon"');
    expect(source).toContain('className="ui-positioned-menu-static"');
    expect(source).toContain('className="ui-context-menu-item bg-elevated"');
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
    const settingsSource = source.slice(
      source.indexOf('function SettingsTwoColumnPageStory'),
      source.indexOf('export const StandardSinglePanePage'),
    );

    expect(source).toContain('function SettingsTwoColumnPageStory');
    expect(source).toContain('export const SettingsPage');
    expect(source).toContain('export const DarkSettingsPage');
    expect(source).toContain('export const SettingsTwoColumnPage');
    expect(source).toContain('export const DarkSettingsTwoColumnPage');
    expect(source).toContain('<SettingsTwoColumnPageStory theme="dark" />');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).toContain('layout="two-column"');
    expect(source).toContain('<WindowedPageRail');
    expect(source).toContain('showHeader={false}');
    expect(source).toContain('title="Sections"');
    expect(settingsSource).toContain("minHeight: '100vh'");
    expect(source).toContain('onSelect={() => undefined}');
    expect(source).toContain('<WindowedSettingsGroup title="Appearance"');
    expect(source).toContain('<WindowedSettingsGroup title="Typography"');
    expect(source).toContain('title="Theme"');
    expect(source).toContain('title="Interface scale"');
    expect(source).toContain('ariaLabel="Interface scale"');
    expect(source).toContain('title="Monospace size"');
    expect(source).toContain('aria-label="Monospace size"');
    expect(settingsSource).toContain('<WindowedPageButton>Reset</WindowedPageButton>');
    expect(settingsSource).not.toContain('<WindowedPageButton tone="accent">Apply</WindowedPageButton>');
    expect(settingsSource).not.toContain('<WindowedSettingsGroup title="Providers"');
    expect(settingsSource).not.toContain('Add provider');
    expect(settingsSource).not.toContain('WindowedDataRow name="OpenAI"');
    expect(source).not.toContain('title="Settings sections"');
  });

  it('styles shared windowed settings row-list primitives', () => {
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const stylesSource = readFileSync(stylesPath, 'utf8');

    expect(stylesSource).toContain('.wos-settings-group {');
    expect(stylesSource).toContain('.wos-settings-group__header {');
    expect(stylesSource).toContain('.wos-settings-row {');
    expect(stylesSource).toContain('.wos-settings-row__actions {');
    expect(stylesSource).toContain('flex-wrap: wrap;');
    expect(stylesSource).toContain('.wos-settings-row__actions > *');
    expect(stylesSource).toContain('.wos-page-rail .wos-list {');
    expect(stylesSource).toContain('border: 1.5px solid var(--wos-line-strong);');
  });

  it('documents the canonical Workflows desktop page and subwindow pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const workflowsSource = source.slice(source.indexOf('function WorkflowsPageStory'), source.indexOf('export const WorkflowsPage'));

    expect(source).toContain('function WorkflowsPageStory');
    expect(source).toContain('export const WorkflowsPage');
    expect(source).toContain('export const DarkWorkflowsPage');
    expect(source).toContain('<WorkflowsPageStory theme="dark" />');
    expect(source).toContain('title="Workflows"');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).not.toContain('eyebrow="Dynamic workflows"');
    expect(source).toContain('title="Inventory"');
    expect(source).toContain('title="Runs"');
    expect(source).toContain('title="Library"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="Repo audit"');
    expect(source).toContain('parentWindowTitle="Workflows"');
    expect(workflowsSource.indexOf('</WindowFrame>')).toBeLessThan(workflowsSource.indexOf('<WindowedDialog'));
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

    expect(source).toContain('function AutomationsPageStory');
    expect(source).toContain('export const AutomationsPage');
    expect(source).toContain('export const DarkAutomationsPage');
    expect(source).toContain('<AutomationsPageStory theme="dark" />');
    expect(source).toContain('data-wos-theme={theme}');
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
    expect(source).toContain('title="Automation details"');
    expect(source).toContain('parentWindowTitle="Automations"');
    expect(source).not.toContain('meta="Running · 0 9 * * 1-5"');
    expect(source).toContain('title="Automation context"');
    expect(source).not.toContain('title="Selected automation"');
    expect(source).not.toContain('ariaLabel="Automation filter"');
  });

  it('documents the canonical Gateways desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('function GatewaysPageStory');
    expect(source).toContain('export const GatewaysPage');
    expect(source).toContain('export const DarkGatewaysPage');
    expect(source).toContain('<GatewaysPageStory theme="dark" />');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).toContain('title="Gateways"');
    expect(source).not.toContain('eyebrow="Ingress"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Gateway tools"');
    expect(source).toContain('title="Telegram configuration"');
    expect(source).toContain('<WindowedTextInput aria-label="Telegram token" type="password"');
    expect(source).not.toContain('<WindowedTextarea aria-label="Telegram token"');
    expect(source).not.toContain('title="Selected gateway"');
    expect(source).not.toContain('ariaLabel="Gateway filter"');
  });

  it('documents the canonical AI Gateway desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const aiGatewaySource = source.slice(source.indexOf('function AIGatewayPageStory'), source.indexOf('export const RoutinesPage'));

    expect(source).toContain('function AIGatewayPageStory');
    expect(source).toContain('export const AIGatewayPage');
    expect(source).toContain('export const DarkAIGatewayPage');
    expect(source).toContain('<AIGatewayPageStory theme="dark" />');
    expect(aiGatewaySource).toContain('title="AI Gateway"');
    expect(aiGatewaySource).toContain('data-wos-theme={theme}');
    expect(aiGatewaySource).toContain('title="Loopback endpoint"');
    expect(aiGatewaySource).toContain('title="Listener"');
    expect(aiGatewaySource).toContain('title="Codex client setup"');
    expect(aiGatewaySource).toContain('title="Recent activity"');
    expect(aiGatewaySource).toContain('aria-label="Gateway port"');
    expect(aiGatewaySource).toContain('aria-label="Default gateway model"');
    expect(aiGatewaySource).toContain(
      "<WindowedDataTable columns={[{ label: 'Event' }, { label: 'Status' }, { label: 'Time', align: 'right' }]}",
    );
    expect(aiGatewaySource).not.toContain('eyebrow="Loopback"');
    expect(aiGatewaySource).not.toContain('title="Selected gateway"');
  });

  it('documents the canonical Routines desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const stylesSource = readFileSync(stylesPath, 'utf8');
    const routinesSource = source.slice(source.indexOf('function RoutinesPageStory'), source.indexOf('export const RoutinesPage'));

    expect(source).toContain('function RoutinesPageStory');
    expect(source).toContain('export const RoutinesPage');
    expect(source).toContain('export const DarkRoutinesPage');
    expect(source).toContain('<RoutinesPageStory theme="dark" />');
    expect(source).toContain('title="Routines"');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).not.toContain('eyebrow="Agent hooks"');
    expect(source).toContain('title="Events"');
    expect(source).toContain('title="Before"');
    expect(source).toContain('title="After"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('<WindowedDialog');
    expect(source).toContain('title="Routine runs"');
    expect(routinesSource.indexOf('</WindowFrame>')).toBeLessThan(routinesSource.indexOf('<WindowedDialog'));
    expect(routinesSource).toContain('initialOffset={{ x: 0, y: 390 }}');
    expect(source).not.toContain('title="Selected routine"');
    expect(source).not.toContain('ariaLabel="Routine scope"');
    expect(stylesSource).toContain('.wos-routine-summary-row .wos-data-row__meta');
    expect(stylesSource).toContain('overflow-wrap: anywhere;');
  });

  it('documents the canonical Model Arena desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const arenaSource = source.slice(source.indexOf('function ModelArenaPageStory'), source.indexOf('export const ModelArenaPage'));
    const arenaMainSource = arenaSource.slice(arenaSource.indexOf('<WindowFrame'), arenaSource.indexOf('</WindowFrame>'));

    expect(source).toContain('function ModelArenaPageStory');
    expect(source).toContain('export const ModelArenaPage');
    expect(source).toContain('export const DarkModelArenaPage');
    expect(source).toContain('<ModelArenaPageStory theme="dark" />');
    expect(source).toContain('title="Model Arena"');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).not.toContain('eyebrow="Model duels"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('title="Status"');
    expect(source).toContain('title="Challengers"');
    expect(source).toContain('title="Sampling"');
    expect(source).toContain('title="Arena settings"');
    expect(source).toContain('parentWindowTitle="Model Arena"');
    expect(source).toContain('className="wos-arena-settings-dialog"');
    expect(source).toContain('<WindowedNumberStepper');
    expect(source).toContain('unit="%"');
    expect(source).toContain('unit="votes"');
    expect(source).toContain('unit="chars"');
    expect(source).toContain('title="Active duel"');
    expect(source).toContain('title="Rankings"');
    expect(source).toContain('title="Recent duels"');
    expect(source).toContain('aria-label="Task type"');
    expect(source).toContain('<WindowedPageButton>Settings</WindowedPageButton>');
    expect(source).toContain('Vote primary');
    expect(source).toContain('Vote challenger');
    expect(source).toContain('Disable Model Arena');
    expect(source).toContain('<WindowedDataRow');
    expect(source).toContain('cells={[');
    expect(arenaMainSource).not.toContain('title="Challengers"');
    expect(arenaMainSource).not.toContain('title="Sampling"');
    expect(arenaMainSource.indexOf('title="Active duel"')).toBeLessThan(arenaMainSource.indexOf('title="Rankings"'));
    expect(source).not.toContain('wos-arena-ranking-row');
    expect(source).not.toContain('title="Leader"');
  });

  it('documents the canonical Diagnostics desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');

    expect(source).toContain('function DiagnosticsPageStory');
    expect(source).toContain('export const DiagnosticsPage');
    expect(source).toContain('export const DarkDiagnosticsPage');
    expect(source).toContain('<DiagnosticsPageStory theme="dark" />');
    expect(source).toContain('title="Diagnostics"');
    expect(source).toContain('data-wos-theme={theme}');
    expect(source).not.toContain('eyebrow="Telemetry"');
    expect(source).toContain('ariaLabel="Diagnostics range"');
    expect(source).toContain('title="Overview"');
    expect(source).toContain('meta="24H · Loaded"');
    expect(source).toContain('className="wos-diagnostics-overview"');
    expect(source).toContain('className="wos-diagnostics-overview__charts"');
    expect(source).toContain('<StoryTokenActivityChart />');
    expect(source).toContain('<StoryTimeSeriesChart />');
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
    const skillsSource = source.slice(source.indexOf('function SkillsPageStory'), source.indexOf('export const CoreDataPrimitives'));

    expect(source).toContain('function SkillsPageStory');
    expect(source).toContain('export const SkillsPage');
    expect(source).toContain('export const DarkSkillsPage');
    expect(source).toContain('<SkillsPageStory theme="dark" />');
    expect(skillsSource).toContain('title="Skills"');
    expect(skillsSource).toContain('data-wos-theme={theme}');
    expect(skillsSource).toContain('title="Browse skills"');
    expect(skillsSource).not.toContain('eyebrow="Skill library"');
    expect(skillsSource).toContain('title="Sources"');
    expect(skillsSource).toContain('Search marketplace skills');
    expect(skillsSource).toContain('title="Marketplace"');
    expect(skillsSource).toContain('title="Installed"');
    expect(skillsSource).toContain('ariaLabel="Skills view"');
    expect(skillsSource).toContain('<WindowedDialog title="local-qa"');
    expect(skillsSource.indexOf('</WindowFrame>')).toBeLessThan(skillsSource.indexOf('<WindowedDialog title="local-qa"'));
    expect(skillsSource).not.toContain('title="Inventory"');
    expect(skillsSource).not.toContain('title="Installed skills"');
  });

  it('documents the canonical Extensions desktop page and detail subwindow pattern', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const extensionsSource = source.slice(
      source.indexOf('function ExtensionsPageStory'),
      source.indexOf('export const ExtensionsInstallDialog'),
    );

    expect(source).toContain('function ExtensionsPageStory');
    expect(source).toContain('export const ExtensionsPage');
    expect(source).toContain('export const DarkExtensionsPage');
    expect(source).toContain('<ExtensionsPageStory theme="dark" />');
    expect(extensionsSource).toContain('title="Extensions"');
    expect(extensionsSource).toContain('data-wos-theme={theme}');
    expect(extensionsSource).toContain('<WindowedPageShell layout="wide">');
    expect(extensionsSource).toContain('<WindowedPageRail title="Extensions" accent="extensions" showHeader={false}>');
    expect(extensionsSource.indexOf('<WindowedPageRail title="Extensions"')).toBeLessThan(extensionsSource.indexOf('<WindowedPageMain'));
    expect(extensionsSource).not.toContain('eyebrow="Extension manager"');
    expect(extensionsSource).toContain('title="Sources"');
    expect(extensionsSource).toContain('Search extensions');
    expect(extensionsSource).toContain('title="Installed"');
    expect(extensionsSource).toContain('ariaLabel="Extension view"');
    expect(extensionsSource).toContain('WindowedToggle checked accent="extensions" label="Disable system-browser"');
    expect(extensionsSource).toContain('<WindowedDialog');
    expect(extensionsSource).toContain('title="system-browser"');
    expect(extensionsSource).toContain('parentWindowTitle="Extensions"');
    expect(extensionsSource).toContain('className="wos-extension-detail-grid"');
    expect(extensionsSource).toContain('className="wos-extension-detail-description"');
    expect(extensionsSource.indexOf('</WindowFrame>')).toBeLessThan(extensionsSource.indexOf('<WindowedDialog'));
    expect(extensionsSource).not.toContain('title="Inventory"');
    expect(extensionsSource).not.toContain('title="Installed extensions"');
    expect(extensionsSource).not.toContain('title="Review queue"');
    expect(source).toContain('export const ExtensionsInstallDialog');
    expect(source).toContain('title="Install extension"');
    expect(source).toContain('wos-extension-install-dialog');
    expect(source).toContain('title="Repositories"');
  });

  it('documents the canonical embedded extension desktop page', () => {
    const storiesPath = fileURLToPath(new URL('./windowedOs.stories.tsx', import.meta.url));
    const source = readFileSync(storiesPath, 'utf8');
    const embeddedSource = source.slice(source.indexOf('function EmbeddedExtensionPageStory'));

    expect(source).toContain('function EmbeddedExtensionPageStory');
    expect(source).toContain('export const EmbeddedExtensionPage');
    expect(source).toContain('export const DarkEmbeddedExtensionPage');
    expect(source).toContain('<EmbeddedExtensionPageStory theme="dark" />');
    expect(embeddedSource).toContain('title="Gateways"');
    expect(embeddedSource).toContain('data-wos-theme={theme}');
    expect(embeddedSource).toContain('title="Telegram"');
    expect(embeddedSource).toContain('title="Status"');
    expect(embeddedSource).toContain('title="Bot token"');
    expect(embeddedSource).toContain('title="Telegram access"');
    expect(embeddedSource).toContain('title="Recent activity"');
    expect(embeddedSource).toContain('aria-label="Telegram bot token"');
    expect(embeddedSource).toContain('label="Toggle Telegram gateway"');
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
      'AI Gateway',
      'Model Arena',
      'Routines',
      'Extensions',
      'Skills',
      'Diagnostics',
      'Settings',
    ]);

    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Workflows')?.accent).toBe('workflows');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Chat')?.meta).toBe('Conversation');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'AI Gateway')?.accent).toBe('gateways');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'AI Gateway')?.meta).toBe('Loopback');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Model Arena')?.accent).toBe('model-arena');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Skills')?.accent).toBe('skills');
    expect(CANONICAL_WINDOWED_DESKTOP_APPS.find((app) => app.title === 'Diagnostics')?.accent).toBe('diagnostics');
    expect(source).toContain('CANONICAL_WINDOWED_DESKTOP_APPS');
    expect(source).toContain('const canonicalDesktopApps = CANONICAL_WINDOWED_DESKTOP_APPS');
    expect(source.slice(source.indexOf('function WorkflowsPageStory'), source.indexOf('export const ModelArenaPage'))).toContain(
      'accent="workflows"',
    );
    expect(source.slice(source.indexOf('export const GatewaysPage'), source.indexOf('export const ModelArenaPage'))).toContain(
      'export const AIGatewayPage',
    );
    expect(source.slice(source.indexOf('function ModelArenaPageStory'), source.indexOf('export const DiagnosticsPage'))).toContain(
      'accent="model-arena"',
    );
    expect(source.slice(source.indexOf('function SkillsPageStory'), source.indexOf('export const CoreDataPrimitives'))).toContain(
      'title="Skills"\n        accent="skills"',
    );
    expect(source).not.toContain("title: 'Prompt Assembly'");
  });

  it('runs Storybook QA against every canonical windowed OS story', () => {
    const qaScriptPath = fileURLToPath(new URL('../scripts/qa-storybook.mjs', import.meta.url));
    const source = readFileSync(qaScriptPath, 'utf8');

    expect(source).toContain("id.startsWith('windowed-os-desktop-shell--')");
    expect(source).toContain('storyIds.length === 0');
    expect(source).not.toContain('const storyNames = [');
    expect(source).toContain("storiesAllowingOffscreenWindows = new Set([\n  'windowed-os-desktop-shell--desktop-composition'");
    expect(source).toContain('result.scrollWidth > result.clientWidth + 1');
    expect(source).toContain('Windowed OS Storybook QA passed:');
  });
});
