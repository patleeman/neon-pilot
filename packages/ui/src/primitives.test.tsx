import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActionTile,
  Button,
  ButtonLink,
  BrowsePathButton,
  CardBody,
  CardMeta,
  CardTitle,
  Checkbox,
  CheckButton,
  ChatBubbleIcon,
  ChoiceRow,
  CodeBlock,
  CompactCard,
  cx,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Disclosure,
  Dialog,
  FilterToolbar,
  FolderIcon,
  IconButton,
  IconLink,
  KeyValueItem,
  KeyValueList,
  KeyValueTable,
  MenuItem,
  PositionedMenu,
  MenuSeparator,
  MenuShell,
  MetaLabel,
  Notice,
  PanelHeader,
  Pill,
  ProgressBar,
  ResourcePickerDialog,
  ResourcePickerList,
  ResourcePickerToolbar,
  ResourceList,
  ResourceListItem,
  ResourceListRow,
  RuntimeFooter,
  RuntimeSection,
  RuntimeStatusDot,
  RuntimeStrip,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  SettingToggleRow,
  Stat,
  StatGrid,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TabPanel,
  TaskListItem,
  TextInput,
  TerminalBlock,
  Tooltip,
} from './primitives';

describe('design-system primitives', () => {
  it('joins class names with falsey values removed', () => {
    expect(cx('one', false, null, undefined, 'two')).toBe('one two');
  });

  it('maps pill tones to stable design-system classes', () => {
    expect(renderToStaticMarkup(createElement(Pill, { tone: 'accent' }, 'Active'))).toContain('ui-pill-accent');
    expect(renderToStaticMarkup(createElement(Pill, { tone: 'danger' }, 'Failed'))).toContain('ui-pill-danger');
  });

  it('maps button variants and tones to stable classes', () => {
    const html = renderToStaticMarkup(createElement(Button, { variant: 'action', tone: 'danger' }, 'Delete'));
    expect(html).toContain('ui-action-button');
    expect(html).toContain('text-danger');
    expect(html).toContain('type="button"');
  });

  it('maps button links to stable button classes', () => {
    const html = renderToStaticMarkup(createElement(ButtonLink, { href: '#new', variant: 'action', tone: 'accent' }, 'New'));

    expect(html).toContain('href="#new"');
    expect(html).toContain('ui-action-button');
    expect(html).toContain('text-accent');
  });

  it('renders shared path picker chrome and workspace icons', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(FolderIcon, { key: 'folder', className: 'folder' }),
        createElement(ChatBubbleIcon, { key: 'chat', className: 'chat' }),
        createElement(BrowsePathButton, {
          key: 'browse',
          busy: true,
          title: 'Choose workspace folder',
          ariaLabel: 'Choose workspace folder',
          onClick: () => undefined,
        }),
      ]),
    );

    expect(html).toContain('folder');
    expect(html).toContain('chat');
    expect(html).toContain('Choose workspace folder');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('ui-icon-button-sm');
  });

  it('renders check button pressed state', () => {
    const html = renderToStaticMarkup(createElement(CheckButton, { checked: true, 'aria-label': 'Mark complete' }));
    expect(html).toContain('ui-check-button');
    expect(html).toContain('ui-check-button-checked');
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders task list items with control, detail, actions, and done state', () => {
    const html = renderToStaticMarkup(
      createElement(TaskListItem, {
        checked: true,
        label: 'Review component docs',
        detail: 'Agent-facing README pass',
        control: createElement(CheckButton, { checked: true, 'aria-label': 'Reopen task' }),
        actions: createElement(IconButton, { compact: true, 'aria-label': 'Delete task' }, '×'),
      }),
    );

    expect(html).toContain('ui-task-list-item');
    expect(html).toContain('ui-task-list-item-checked');
    expect(html).toContain('ui-task-list-item-control');
    expect(html).toContain('Review component docs');
    expect(html).toContain('Agent-facing README pass');
    expect(html).toContain('Delete task');
  });

  it('renders choice rows with checked state and descriptive slots', () => {
    const html = renderToStaticMarkup(
      createElement(ChoiceRow, {
        checked: true,
        role: 'radio',
        'aria-checked': true,
        indicator: '◉',
        label: 'Approve plan',
        details: 'Continue with the selected implementation path.',
      }),
    );

    expect(html).toContain('ui-choice-row');
    expect(html).toContain('ui-choice-row-checked');
    expect(html).toContain('role="radio"');
    expect(html).toContain('Approve plan');
    expect(html).toContain('Continue with the selected implementation path.');
  });

  it('renders icon links with shared icon button classes', () => {
    const html = renderToStaticMarkup(createElement(IconLink, { href: '#target', compact: true, 'aria-label': 'Open target' }, '↗'));

    expect(html).toContain('href="#target"');
    expect(html).toContain('ui-icon-button');
    expect(html).toContain('ui-icon-button-compact');
  });

  it('renders notice semantics from tone', () => {
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'danger', title: 'Failed' }, 'Try again.'))).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'info' }, 'Ready.'))).toContain('role="status"');
  });

  it('renders switch semantics', () => {
    const html = renderToStaticMarkup(createElement(Switch, { checked: true, label: 'Enabled' }));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });

  it('renders progress bar semantics', () => {
    const html = renderToStaticMarkup(createElement(ProgressBar, { value: 7, max: 10, minPercent: 2, tone: 'success', label: 'Coverage' }));

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemax="10"');
    expect(html).toContain('aria-valuenow="7"');
    expect(html).toContain('ui-progress-bar-success');
  });

  it('renders runtime workspace primitives', () => {
    const stripHtml = renderToStaticMarkup(
      createElement(
        RuntimeStrip,
        {
          status: 'Server ready',
          tone: 'ready',
          metadata: ['mlx-vlm', 'Local'],
          message: 'Model loaded.',
          progress: 42,
        },
        createElement('button', null, 'Restart'),
      ),
    );
    const sectionHtml = renderToStaticMarkup(
      createElement(RuntimeSection, { title: 'Runtime logs', action: createElement('button', null, 'Refresh') }, createElement(TerminalBlock, null, 'ok')),
    );
    const footerHtml = renderToStaticMarkup(
      createElement(RuntimeFooter, { summary: 'Advanced details', open: true, onToggle: () => undefined }, 'Details'),
    );

    expect(renderToStaticMarkup(createElement(RuntimeStatusDot, { tone: 'ready' }))).toContain('ui-status-dot-accent');
    expect(stripHtml).toContain('Server ready');
    expect(stripHtml).toContain('aria-live="polite"');
    expect(stripHtml).toContain('Setup progress 42%');
    expect(sectionHtml).toContain('Runtime logs');
    expect(sectionHtml).toContain('min-h-44');
    expect(footerHtml).toContain('aria-expanded="true"');
  });

  it('renders setting toggle rows with switch semantics', () => {
    const html = renderToStaticMarkup(
      createElement(SettingToggleRow, {
        title: 'External access',
        description: 'Allow this entrypoint to launch agents.',
        checked: true,
        onCheckedChange: () => undefined,
      }),
    );

    expect(html).toContain('ui-setting-toggle-row');
    expect(html).toContain('External access');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });

  it('renders dialog backdrop customizations on the overlay', () => {
    const html = renderToStaticMarkup(
      createElement(Dialog, { backdropClassName: 'custom-backdrop', backdropStyle: { background: 'red' } }, 'Dialog body'),
    );

    expect(html).toContain('ui-overlay-backdrop');
    expect(html).toContain('custom-backdrop');
    expect(html).toContain('background:red');
  });

  it('renders text input with design-system class', () => {
    expect(renderToStaticMarkup(createElement(TextInput, { value: 'hello', readOnly: true }))).toContain('ui-text-input');
  });

  it('renders checkbox with design-system class', () => {
    expect(renderToStaticMarkup(createElement(Checkbox, { checked: true, readOnly: true }))).toContain('ui-checkbox');
  });

  it('renders filter toolbars with filters and search slots', () => {
    const html = renderToStaticMarkup(
      createElement(FilterToolbar, {
        filters: createElement('span', null, 'All'),
        search: createElement(SearchInput, { placeholder: 'Search' }),
      }),
    );

    expect(html).toContain('ui-filter-toolbar');
    expect(html).toContain('ui-filter-toolbar-filters');
    expect(html).toContain('ui-filter-toolbar-search');
  });

  it('renders resource picker dialog anatomy', () => {
    const html = renderToStaticMarkup(
      createElement(
        ResourcePickerDialog,
        { title: 'Open workspace', description: 'Choose a saved workspace.', footer: '↑↓ move · ↵ select · esc close' },
        createElement(ResourcePickerToolbar, { search: createElement(SearchInput, { placeholder: 'Filter...' }), actions: '12' }),
        createElement(ResourcePickerList, null, createElement(ResourceListItem, { label: 'neon-pilot', detail: '/repo/neon-pilot' })),
      ),
    );

    expect(html).toContain('ui-resource-picker-body');
    expect(html).toContain('ui-resource-picker-toolbar');
    expect(html).toContain('ui-resource-picker-list');
    expect(html).toContain('ui-resource-picker-footer');
    expect(html).toContain('Open workspace');
  });

  it('renders panel headers with title and meta slots', () => {
    const html = renderToStaticMarkup(createElement(PanelHeader, { title: 'Telemetry', meta: '24h' }));

    expect(html).toContain('ui-panel-header');
    expect(html).toContain('ui-panel-header-title');
    expect(html).toContain('ui-panel-header-meta');
  });

  it('renders section labels and resource list rows', () => {
    expect(renderToStaticMarkup(createElement(SectionLabel, null, 'Artifacts'))).toContain('ui-section-label');
    expect(renderToStaticMarkup(createElement(SupportingText, null, 'Secondary copy'))).toContain('ui-supporting-text');
    expect(renderToStaticMarkup(createElement(Tooltip, { position: 'bottom-right', mono: true }, 'Copied'))).toContain(
      'ui-tooltip-bottom-right',
    );

    const html = renderToStaticMarkup(
      createElement(ResourceListItem, {
        label: 'Architecture diagram',
        meta: 'mermaid',
        detail: 'artifact_123',
        leading: '#',
        selected: true,
      }),
    );

    expect(html).toContain('ui-resource-list-item');
    expect(html).toContain('ui-resource-list-item-selected');
    expect(html).toContain('ui-resource-list-item-leading');
    expect(html).toContain('Architecture diagram');
    expect(html).toContain('mermaid');

    const rowHtml = renderToStaticMarkup(
      createElement(
        ResourceList,
        null,
        createElement(ResourceListRow, {
          title: 'Skill name',
          meta: createElement(MetaLabel, { tone: 'muted' }, 'Extension'),
          detail: 'extensions/system-example/skills/example/SKILL.md',
          actions: createElement(Button, { variant: 'ghost' }, 'Enabled'),
        }),
      ),
    );

    expect(rowHtml).toContain('ui-resource-list-bordered');
    expect(rowHtml).toContain('ui-resource-list-row');
    expect(rowHtml).toContain('ui-resource-list-row-actions');
  });

  it('renders card typography primitives with stable classes', () => {
    expect(renderToStaticMarkup(createElement(CardTitle, null, 'Overview'))).toContain('ui-card-title');
    expect(renderToStaticMarkup(createElement(CardBody, null, 'Supporting copy'))).toContain('ui-card-body');
    expect(renderToStaticMarkup(createElement(CardMeta, { as: 'span' }, 'Auto-saved'))).toContain('<span');
    expect(renderToStaticMarkup(createElement(CardMeta, { as: 'span' }, 'Auto-saved'))).toContain('ui-card-meta');
  });

  it('renders compact cards with tone, padding, and polymorphic element classes', () => {
    const html = renderToStaticMarkup(
      createElement(CompactCard, { as: 'article', tone: 'surface', padding: 'sm', interactive: true }, 'Parameter'),
    );

    expect(html).toContain('<article');
    expect(html).toContain('ui-compact-card');
    expect(html).toContain('ui-compact-card-sm');
    expect(html).toContain('ui-compact-card-surface');
    expect(html).toContain('ui-compact-card-interactive');
  });

  it('renders action tiles with icon and description slots', () => {
    const html = renderToStaticMarkup(
      createElement(ActionTile, { icon: '▸', label: 'Terminal', description: 'Open a terminal tab.', meta: 'local' }),
    );

    expect(html).toContain('ui-action-tile');
    expect(html).toContain('ui-action-tile-icon');
    expect(html).toContain('Terminal');
    expect(html).toContain('Open a terminal tab.');
  });

  it('renders code blocks with wrapping controls', () => {
    const html = renderToStaticMarkup(createElement(CodeBlock, { compact: true, wrap: false }, 'const value = 1;'));

    expect(html).toContain('ui-code-block');
    expect(html).toContain('ui-code-block-compact');
    expect(html).not.toContain('ui-code-block-wrap');
  });

  it('renders disclosure anatomy', () => {
    const html = renderToStaticMarkup(createElement(Disclosure, { summary: 'Details', open: true }, 'Expanded content'));

    expect(html).toContain('<details');
    expect(html).toContain('open=""');
    expect(html).toContain('ui-disclosure');
    expect(html).toContain('ui-disclosure-summary');
    expect(html).toContain('ui-disclosure-body');
  });

  it('renders dialog semantics', () => {
    const html = renderToStaticMarkup(createElement(Dialog, { labelledBy: 'dialog-title' }, 'Body'));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="dialog-title"');
  });

  it('renders menu anatomy with expected roles', () => {
    const html = renderToStaticMarkup(
      createElement(
        MenuShell,
        { 'aria-label': 'Actions' },
        createElement(MenuItem, { checked: true }, 'Enabled'),
        createElement(MenuSeparator),
        createElement(MenuItem, { tone: 'danger' }, 'Delete'),
      ),
    );

    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitemradio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('role="separator"');
    expect(html).toContain('ui-context-menu-item-danger');
  });

  it('renders positioned menus with placement and style', () => {
    const html = renderToStaticMarkup(
      createElement(PositionedMenu, { 'aria-label': 'Actions', position: { top: 12, right: 24 } }, createElement(MenuItem, null, 'Open')),
    );

    expect(html).toContain('ui-positioned-menu');
    expect(html).toContain('ui-positioned-menu-fixed');
    expect(html).toContain('style="top:12px;right:24px"');
  });

  it('renders segmented controls as tabs', () => {
    const html = renderToStaticMarkup(
      createElement(SegmentedControl, {
        value: 'split',
        ariaLabel: 'Diff view',
        options: [
          { value: 'split', label: 'Split' },
          { value: 'unified', label: 'Unified' },
        ],
        onChange: () => undefined,
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
  });

  it('renders tab lists with tab semantics', () => {
    const html = renderToStaticMarkup(
      createElement(
        TabList,
        { ariaLabel: 'Skill filters' },
        createElement(TabButton, { active: true }, 'All'),
        createElement(TabButton, null, 'Enabled'),
      ),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Skill filters"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('ui-tab-button-active');
  });

  it('renders tab panels with hidden inactive state', () => {
    const html = renderToStaticMarkup(createElement(TabPanel, { active: false }, 'Inactive content'));

    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('hidden');
    expect(html).toContain('ui-tab-panel');
  });

  it('renders search inputs with search semantics', () => {
    const html = renderToStaticMarkup(createElement(SearchInput, { placeholder: 'Search extensions' }));
    expect(html).toContain('type="search"');
    expect(html).toContain('ui-search-input');
  });

  it('renders stat grids and stats with stable classes', () => {
    const html = renderToStaticMarkup(createElement(StatGrid, null, createElement(Stat, { label: 'Enabled', value: '12' })));
    expect(html).toContain('ui-stat-grid');
    expect(html).toContain('ui-stat-label');
    expect(html).toContain('ui-stat-value');
  });

  it('renders key value lists with definition-list semantics', () => {
    const html = renderToStaticMarkup(
      createElement(KeyValueList, null, createElement(KeyValueItem, { label: 'Package', value: '/tmp/ext' })),
    );
    expect(html).toContain('<dl');
    expect(html).toContain('<dt');
    expect(html).toContain('<dd');
    expect(html).toContain('ui-key-value-list');
  });

  it('renders key value tables with column classes and definition semantics', () => {
    const html = renderToStaticMarkup(
      createElement(KeyValueTable, {
        columns: 3,
        items: [
          { label: 'Files', value: '12' },
          { label: 'Size', value: '18 KB', valueClassName: 'font-mono' },
        ],
      }),
    );

    expect(html).toContain('<dl');
    expect(html).toContain('<dt');
    expect(html).toContain('<dd');
    expect(html).toContain('ui-key-value-table-3');
    expect(html).toContain('font-mono');
  });

  it('renders data table anatomy', () => {
    const html = renderToStaticMarkup(
      createElement(
        DataTable,
        {
          columns: createElement('colgroup', null, createElement('col', { className: 'w-1/2' })),
          tableClassName: 'table-fixed',
        },
        createElement(DataTableHead, null, createElement(DataTableRow, null, createElement(DataTableHeaderCell, null, 'Name'))),
        createElement(DataTableBody, null, createElement(DataTableRow, null, createElement(DataTableCell, null, 'Extension'))),
      ),
    );

    expect(html).toContain('<table');
    expect(html).toContain('<colgroup');
    expect(html).toContain('table-fixed');
    expect(html).toContain('ui-data-table-head');
    expect(html).toContain('ui-data-table-cell');
  });
});
