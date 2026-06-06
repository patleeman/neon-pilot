import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActionTile,
  AppPageSection,
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
  ComposerActionButton,
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
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarGroup,
  FilterToolbar,
  FolderIcon,
  IconButton,
  IconLink,
  InlineCodeButton,
  InlineSelect,
  InlineTextInput,
  KeyboardShortcutCaptureInput,
  KeyValueItem,
  KeyValueList,
  KeyValueTable,
  MediaPreviewButton,
  MenuItem,
  PositionedMenu,
  MenuSeparator,
  MenuShell,
  MessageCard,
  MessageMeta,
  MetaLabel,
  Notice,
  PanelHeader,
  Pill,
  ProgressBar,
  RailSection,
  RailSubsection,
  ResourcePickerDialog,
  ResourcePickerList,
  ResourcePickerToolbar,
  ResourceList,
  ResourceListItem,
  ResourceListLink,
  ResourceListRow,
  RuntimeFooter,
  RuntimeHeaderControls,
  RuntimeSection,
  RuntimeStatusDot,
  RuntimeStrip,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  SettingToggleRow,
  ShelfHeader,
  ShelfSection,
  SidebarNavButton,
  Stat,
  StatGrid,
  SwatchOption,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TabPanel,
  TaskListItem,
  TextInput,
  TextLink,
  TitleButton,
  TerminalBlock,
  Tooltip,
  TreeItemButton,
  WorkbenchHeader,
  WorkbenchShell,
  WorkbenchTab,
  WorkbenchTabButton,
  WorkbenchTabCloseButton,
  formatKeyboardShortcutLabel,
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

  it('maps text links to stable inline link classes', () => {
    const html = renderToStaticMarkup(createElement(TextLink, { href: '#settings' }, 'Settings'));

    expect(html).toContain('href="#settings"');
    expect(html).toContain('ui-text-link');
    expect(html).toContain('text-accent');
  });

  it('renders title buttons for clickable page headings', () => {
    const html = renderToStaticMarkup(createElement(TitleButton, { 'aria-label': 'Rename conversation' }, 'Fix top bar'));

    expect(html).toContain('ui-title-button');
    expect(html).toContain('type="button"');
    expect(html).toContain('Fix top bar');
  });

  it('renders sidebar nav buttons with active state and current page semantics', () => {
    const html = renderToStaticMarkup(createElement(SidebarNavButton, { active: true }, 'Settings'));

    expect(html).toContain('ui-sidebar-nav-item');
    expect(html).toContain('ui-sidebar-nav-item-active');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Settings');
  });

  it('renders semantic tree item buttons without imposing visual row styling', () => {
    const html = renderToStaticMarkup(createElement(TreeItemButton, { selected: true, expanded: false }, 'Project row'));

    expect(html).toContain('ui-tree-item-button');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('renders choice row prefixes for numbered answer options', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRow, { prefix: '1.', indicator: '○', label: 'Clean it up' }));

    expect(html).toContain('ui-choice-row-prefix');
    expect(html).toContain('1.');
    expect(html).toContain('ui-choice-row-indicator');
    expect(html).toContain('Clean it up');
  });

  it('renders stacked app page sections for dashboard pages', () => {
    const html = renderToStaticMarkup(createElement(AppPageSection, { title: 'Usage', layout: 'stacked' }, 'Charts'));

    expect(html).toContain('ui-app-page-section');
    expect(html).toContain('ui-app-page-section-stacked');
    expect(html).toContain('Usage');
    expect(html).toContain('Charts');
  });

  it('renders transcript message card primitives', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(MessageCard, { key: 'user', role: 'user' }, 'User prompt'),
        createElement(MessageCard, { key: 'assistant' }, 'Assistant reply'),
        createElement(MessageMeta, { key: 'meta' }, '2m ago'),
      ]),
    );

    expect(html).toContain('ui-message-card-user');
    expect(html).toContain('ui-message-card-assistant');
    expect(html).toContain('ui-message-meta');
  });

  it('renders media preview buttons for inspectable transcript media', () => {
    const html = renderToStaticMarkup(createElement(MediaPreviewButton, { 'aria-label': 'Inspect image' }, 'Preview'));

    expect(html).toContain('ui-media-preview-button');
    expect(html).toContain('type="button"');
    expect(html).toContain('Inspect image');
  });

  it('renders composer action buttons with stable tone and size classes', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, [
        createElement(ComposerActionButton, { key: 'send', tone: 'accent', size: 'icon', 'aria-label': 'Send' }, '↑'),
        createElement(ComposerActionButton, { key: 'steer', tone: 'warning', size: 'label' }, 'Steer'),
        createElement(ComposerActionButton, { key: 'stop', tone: 'danger', size: 'icon' }, '■'),
        createElement(ComposerActionButton, { key: 'empty', tone: 'disabled', disabled: true }, '↑'),
      ]),
    );

    expect(html).toContain('ui-composer-action-button');
    expect(html).toContain('ui-composer-action-button-accent');
    expect(html).toContain('ui-composer-action-button-warning');
    expect(html).toContain('ui-composer-action-button-danger');
    expect(html).toContain('ui-composer-action-button-disabled');
    expect(html).toContain('ui-composer-action-button-label');
  });

  it('renders editor toolbar primitives with active and status classes', () => {
    const html = renderToStaticMarkup(
      createElement(
        EditorToolbar,
        { sticky: true },
        createElement(EditorToolbarGroup, null, [
          createElement(EditorToolbarButton, { key: 'save', icon: true, statusTone: 'saved', 'aria-label': 'Save' }, 'S'),
          createElement(EditorToolbarButton, { key: 'bold', active: true }, 'B'),
        ]),
      ),
    );

    expect(html).toContain('ui-editor-toolbar-sticky');
    expect(html).toContain('ui-editor-toolbar-group');
    expect(html).toContain('ui-editor-toolbar-button-icon');
    expect(html).toContain('ui-editor-toolbar-button-saved');
    expect(html).toContain('ui-editor-toolbar-button-active');
    expect(html).toContain('aria-pressed="true"');
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

  it('renders workbench tab primitives with active, label, icon, and close affordances', () => {
    const html = renderToStaticMarkup(
      createElement(
        WorkbenchTab,
        { active: true, title: 'Browser' },
        [
          createElement(WorkbenchTabButton, { key: 'select', icon: '[]', label: 'Browser', 'aria-label': 'Select Browser' }),
          createElement(WorkbenchTabCloseButton, { key: 'close', 'aria-label': 'Close Browser' }),
        ],
      ),
    );

    expect(html).toContain('ui-workbench-tab');
    expect(html).toContain('ui-workbench-tab-active');
    expect(html).toContain('ui-workbench-tab-button');
    expect(html).toContain('ui-workbench-tab-icon');
    expect(html).toContain('ui-workbench-tab-label');
    expect(html).toContain('ui-workbench-tab-close-button');
    expect(html).toContain('Close Browser');
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

  it('renders swatch options as accessible radio controls', () => {
    const html = renderToStaticMarkup(
      createElement(SwatchOption, {
        checked: true,
        label: 'Teal',
        swatch: createElement('span', { style: { backgroundColor: 'rgb(20 184 166)' } }),
      }),
    );

    expect(html).toContain('ui-swatch-option');
    expect(html).toContain('ui-swatch-option-checked');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Teal');
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
      createElement(
        RuntimeSection,
        { title: 'Runtime logs', action: createElement('button', null, 'Refresh') },
        createElement(TerminalBlock, null, 'ok'),
      ),
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

  it('renders runtime header controls with server switch, status, and refresh action', () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeHeaderControls, {
        switchLabel: 'Server',
        switchChecked: true,
        onSwitchChange: () => undefined,
        status: 'Running',
        tone: 'running',
        onRefresh: () => undefined,
        refreshLabel: 'Refresh runtime',
      }),
    );

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Server"');
    expect(html).toContain('Server');
    expect(html).toContain('Running');
    expect(html).toContain('ui-status-dot-success');
    expect(html).toContain('Refresh runtime');
  });

  it('renders workbench and rail layout primitives', () => {
    const html = renderToStaticMarkup(
      createElement(
        WorkbenchShell,
        {
          header: createElement(WorkbenchHeader, {
            title: 'Artifact preview',
            meta: 'rev 3',
            actions: createElement(Button, { variant: 'action' }, 'Copy'),
          }),
          footer: createElement('span', null, 'Ready'),
        },
        createElement(RailSection, { title: 'Files' }, createElement(ResourceListItem, { label: 'index.tsx', meta: 'modified' })),
      ),
    );

    expect(html).toContain('ui-workbench-shell');
    expect(html).toContain('ui-workbench-header');
    expect(html).toContain('Artifact preview');
    expect(html).toContain('ui-rail-section');
    expect(html).toContain('Files');
    expect(html).toContain('Ready');
  });

  it('renders compact rail subsections for bordered rail groups', () => {
    const html = renderToStaticMarkup(
      createElement(RailSubsection, { title: 'Needs review' }, createElement(ResourceListItem, { label: 'task.md', meta: 'failed' })),
    );

    expect(html).toContain('border-t border-border-subtle');
    expect(html).toContain('Needs review');
    expect(html).toContain('task.md');
  });

  it('renders compact shelf section primitives', () => {
    const html = renderToStaticMarkup(
      createElement(
        ShelfSection,
        {
          header: createElement(ShelfHeader, {
            leading: '↻',
            title: 'Background Work',
            detail: '2 running',
            actions: createElement(Button, { variant: 'ghost' }, 'details'),
          }),
        },
        createElement('div', null, 'Run summary'),
      ),
    );

    expect(html).toContain('ui-shelf-section');
    expect(html).toContain('ui-shelf-header');
    expect(html).toContain('Background Work');
    expect(html).toContain('2 running');
    expect(html).toContain('Run summary');
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

  it('renders inline form controls with dense design-system classes', () => {
    expect(renderToStaticMarkup(createElement(InlineTextInput, { value: '10', readOnly: true }))).toContain('ui-inline-input');
    expect(
      renderToStaticMarkup(
        createElement(InlineSelect, { value: 'daily', disabled: true }, createElement('option', { value: 'daily' }, 'Daily')),
      ),
    ).toContain('ui-inline-select');
  });

  it('renders checkbox with design-system class', () => {
    expect(renderToStaticMarkup(createElement(Checkbox, { checked: true, readOnly: true }))).toContain('ui-checkbox');
  });

  it('renders shortcut capture with formatted shortcut labels', () => {
    expect(formatKeyboardShortcutLabel('CommandOrControl+Shift+P')).toBe('⌘/Ctrl + Shift + P');
    expect(
      renderToStaticMarkup(createElement(KeyboardShortcutCaptureInput, { value: 'CommandOrControl+Shift+P', onChange: () => undefined })),
    ).toContain('ui-shortcut-capture');
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
        createElement(ResourceListLink, {
          href: '/capabilities',
          label: 'Default preset',
          meta: '4 items',
          detail: 'Navigates to the workflow detail route.',
        }),
      ),
    );

    expect(rowHtml).toContain('ui-resource-list-bordered');
    expect(rowHtml).toContain('ui-resource-list-row');
    expect(rowHtml).toContain('href="/capabilities"');
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

  it('renders inline code buttons with button semantics', () => {
    const html = renderToStaticMarkup(createElement(InlineCodeButton, { 'aria-label': 'Open checkpoint' }, '7410c8c'));

    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('ui-inline-code-button');
    expect(html).toContain('ui-inline-code-wrap');
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
