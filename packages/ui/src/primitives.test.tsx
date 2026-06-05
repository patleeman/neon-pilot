import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  Button,
  CheckButton,
  CodeBlock,
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
  KeyValueItem,
  KeyValueList,
  MenuItem,
  PositionedMenu,
  MenuSeparator,
  MenuShell,
  Notice,
  Pill,
  ProgressBar,
  ResourceListItem,
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
  TextInput,
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

  it('renders check button pressed state', () => {
    const html = renderToStaticMarkup(createElement(CheckButton, { checked: true, 'aria-label': 'Mark complete' }));
    expect(html).toContain('ui-check-button');
    expect(html).toContain('ui-check-button-checked');
    expect(html).toContain('aria-pressed="true"');
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

  it('renders text input with design-system class', () => {
    expect(renderToStaticMarkup(createElement(TextInput, { value: 'hello', readOnly: true }))).toContain('ui-text-input');
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
        selected: true,
      }),
    );

    expect(html).toContain('ui-resource-list-item');
    expect(html).toContain('ui-resource-list-item-selected');
    expect(html).toContain('Architecture diagram');
    expect(html).toContain('mermaid');
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

  it('renders data table anatomy', () => {
    const html = renderToStaticMarkup(
      createElement(
        DataTable,
        null,
        createElement(DataTableHead, null, createElement(DataTableRow, null, createElement(DataTableHeaderCell, null, 'Name'))),
        createElement(DataTableBody, null, createElement(DataTableRow, null, createElement(DataTableCell, null, 'Extension'))),
      ),
    );

    expect(html).toContain('<table');
    expect(html).toContain('ui-data-table-head');
    expect(html).toContain('ui-data-table-cell');
  });
});
