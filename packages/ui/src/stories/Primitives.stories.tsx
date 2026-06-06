import type { Meta, StoryObj } from '@storybook/react';

import {
  ActionTile,
  AttachmentChip,
  AttachmentChipButton,
  AppPageIntro,
  AppPageLayout,
  Button,
  ButtonLink,
  CardBody,
  CardMeta,
  CardTitle,
  CenteredLoadingState,
  CenteredMessage,
  CheckButton,
  CodeBlock,
  CompactCard,
  ConfirmDialog,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DashboardGrid,
  DashboardGridCell,
  Disclosure,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  ErrorState,
  Field,
  FilterToolbar,
  IconButton,
  IconLink,
  InlineCode,
  InlineMeta,
  Keycap,
  KeyValueItem,
  KeyValueList,
  KeyValueTable,
  LoadingState,
  MetaLabel,
  MetricTile,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShell,
  Notice,
  PanelHeader,
  PanelMessage,
  Pill,
  PositionedMenu,
  ProgressBar,
  ProgressRow,
  ResourceListItem,
  RingStatusDot,
  RowButton,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  Select,
  SettingsRow,
  SettingToggleRow,
  SettingsSection,
  Spinner,
  Stat,
  StatGrid,
  StatusDot,
  SurfacePanel,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TabPanel,
  TextButton,
  Textarea,
  TextInput,
  TextPromptDialog,
  Tooltip,
  ToolbarButton,
} from '../primitives';
import '../styles.css';

const meta = {
  title: 'Components/Primitives',
  tags: ['autodocs'],
  render: () => (
    <div style={{ display: 'grid', gap: 28, width: 760 }}>
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Actions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ToolbarButton>Refresh</ToolbarButton>
          <Button variant="action">Open</Button>
          <ButtonLink href="#open" variant="action">
            Open Link
          </ButtonLink>
          <Button tone="accent">Save</Button>
          <Button tone="danger">Delete</Button>
          <TextButton>Inline action</TextButton>
          <TextButton tone="danger">Remove</TextButton>
          <IconButton aria-label="More actions">•••</IconButton>
          <IconButton aria-label="Add item" shape="circle">
            +
          </IconButton>
          <IconButton aria-label="Compact more actions" size="sm">
            •••
          </IconButton>
          <IconButton aria-label="Compact add item" shape="circle" size="sm">
            +
          </IconButton>
          <IconLink href="#thread" aria-label="Open thread">
            ↗
          </IconLink>
          <CheckButton checked aria-label="Completed" />
          <CheckButton checked={false} aria-label="Incomplete" />
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Attachments</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <AttachmentChip style={{ maxWidth: 220 }}>
            <AttachmentChipButton title="Preview repository-notes.md">
              <span style={{ flexShrink: 0 }}>#</span>
              <span className="truncate">repository-notes.md</span>
              <span className="shrink-0 text-dim">12KB</span>
            </AttachmentChipButton>
            <IconButton compact title="Remove repository-notes.md" aria-label="Remove repository-notes.md">
              x
            </IconButton>
          </AttachmentChip>
          <AttachmentChip size="md" style={{ maxWidth: 270 }}>
            <AttachmentChipButton title="Preview product sketch">
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 4,
                  background: 'rgb(var(--color-accent) / 0.16)',
                }}
              />
              <span className="min-w-0">
                <span className="block truncate">product sketch</span>
                <span className="block text-[10px] text-dim">#draw_42 · unsaved</span>
              </span>
            </AttachmentChipButton>
            <TextButton tone="accent" className="text-[11px]">
              edit
            </TextButton>
            <IconButton compact title="Remove product sketch" aria-label="Remove product sketch">
              x
            </IconButton>
          </AttachmentChip>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Status</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill>Muted</Pill>
          <Pill tone="accent">Active</Pill>
          <Pill tone="success">Done</Pill>
          <Pill tone="warning">Waiting</Pill>
          <Pill tone="danger">Failed</Pill>
          <StatusDot tone="success" />
          <StatusDot tone="warning" />
          <StatusDot tone="danger" />
          <RingStatusDot value={42} tone="accent" />
          <RingStatusDot value={76} tone="warning" />
          <RingStatusDot value={94} tone="danger" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgb(var(--color-accent))', fontSize: 11 }}>
            <Spinner size="xs" />
            Running
          </span>
          <Spinner />
          <Keycap>⌘</Keycap>
          <Keycap>K</Keycap>
          <span
            className="group"
            tabIndex={0}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid rgb(var(--color-border-subtle))',
              borderRadius: 6,
              padding: '0.25rem 0.5rem',
              color: 'rgb(var(--color-secondary))',
              fontSize: 11,
            }}
          >
            Tooltip
            <Tooltip>Shared hover copy</Tooltip>
          </span>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Forms</h2>
        <SurfacePanel style={{ display: 'grid', gap: 14, padding: 16 }}>
          <Field label="Search">
            <SearchInput placeholder="Search extensions..." />
          </Field>
          <Field label="Name" hint="Use a concise label users can scan quickly.">
            <TextInput placeholder="Daily repository summary…" />
          </Field>
          <Field label="Mode">
            <Select defaultValue="review">
              <option value="review">Review</option>
              <option value="build">Build</option>
              <option value="research">Research</option>
            </Select>
          </Field>
          <Field label="Instructions" error="Keep instructions under the extension limit.">
            <Textarea defaultValue="Summarize recent changes and flag anything that needs attention." />
          </Field>
          <Switch checked label="Enabled" />
        </SurfacePanel>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Menus and Segments</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18 }}>
          <MenuShell className="relative bottom-auto left-auto right-auto mb-0 w-56" aria-label="Story actions">
            <MenuGroupLabel>Show</MenuGroupLabel>
            <MenuItem checked>Enabled items</MenuItem>
            <MenuItem>All items</MenuItem>
            <MenuSeparator />
            <MenuItem tone="danger">Delete</MenuItem>
          </MenuShell>
          <PositionedMenu placement="static" className="w-56" aria-label="Positioned story actions">
            <MenuGroupLabel>Positioned</MenuGroupLabel>
            <MenuItem>Show log</MenuItem>
            <MenuItem tone="danger">Delete</MenuItem>
          </PositionedMenu>
          <SegmentedControl
            ariaLabel="Diff view"
            value="split"
            options={[
              { value: 'split', label: 'Split' },
              { value: 'unified', label: 'Unified' },
            ]}
            onChange={() => undefined}
          />
        </div>
        <TabList ariaLabel="Extension filters">
          <TabButton active>All</TabButton>
          <TabButton>Enabled</TabButton>
          <TabButton>Attention</TabButton>
        </TabList>
        <TabList ariaLabel="Extension filters underline" variant="underline">
          <TabButton active>All</TabButton>
          <TabButton>Attention</TabButton>
        </TabList>
        <TabPanel style={{ borderTop: '1px solid rgb(var(--color-border-subtle))', paddingTop: 12 }}>
          <PanelMessage className="px-0 py-0">The active tab content renders inside a shared tab panel.</PanelMessage>
        </TabPanel>
        <FilterToolbar
          filters={
            <SegmentedControl
              ariaLabel="Status filter"
              value="all"
              options={[
                { value: 'all', label: 'All' },
                { value: 'enabled', label: 'Enabled' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              onChange={() => undefined}
            />
          }
          search={<SearchInput placeholder="Search items..." />}
        />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Data Display</h2>
        <SurfacePanel style={{ display: 'grid', gap: 16, padding: 16 }}>
          <PanelHeader title="Panel header" meta="12 items" className="-m-4 mb-0" />
          <PanelMessage>No artifacts in this conversation.</PanelMessage>
          <PanelMessage tone="danger">Artifact not found.</PanelMessage>
          <div style={{ display: 'grid', gap: 6 }}>
            <SectionLabel>Artifacts</SectionLabel>
            <SectionLabel tone="muted">Muted Label</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <MetaLabel>artifact</MetaLabel>
              <MetaLabel tone="accent">current</MetaLabel>
              <MetaLabel tone="success">added</MetaLabel>
            </div>
            <SupportingText>Use supporting text for secondary settings copy, empty hints, paths, and status details.</SupportingText>
            <div style={{ display: 'grid', gap: 4 }}>
              <CardTitle>Card title</CardTitle>
              <CardBody>Card body text describes a compact setting, row, or rail item.</CardBody>
              <CardMeta as="span">compact metadata</CardMeta>
            </div>
            <CompactCard style={{ display: 'grid', gap: 4 }}>
              <CardTitle>Compact card</CardTitle>
              <CardMeta>Use for small rail, settings, and metadata blocks.</CardMeta>
            </CompactCard>
            <SurfacePanel muted style={{ display: 'grid', gap: 8, padding: 12 }}>
              <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <CardTitle as="span">Artifact saved</CardTitle>
                <Pill tone="accent" mono>
                  html
                </Pill>
                <CardMeta as="span">rev 3</CardMeta>
              </div>
              <CardMeta className="font-mono text-secondary">artifact_01HN7R2X2V3Y</CardMeta>
              <CardBody>The generated report is available in the artifact workbench.</CardBody>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <TextButton tone="accent">open</TextButton>
                <InlineMeta>updated 2m ago</InlineMeta>
              </div>
            </SurfacePanel>
            <p style={{ margin: 0, fontSize: 13 }}>
              Long paths wrap safely in <InlineCode>packages/desktop/ui/src/pages/ConversationPage.tsx</InlineCode>.
            </p>
            <ResourceListItem label="Architecture diagram" meta="mermaid" detail="artifact_123" selected />
            <ResourceListItem label="Release notes" meta="html" detail="artifact_456" />
            <div style={{ display: 'grid', gap: 4 }}>
              <RowButton compact selected>
                <span style={{ color: 'rgb(var(--color-dim))' }}>▸</span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  packages/ui/src/primitives.tsx
                </span>
                <MetaLabel tone="muted">modified</MetaLabel>
              </RowButton>
              <RowButton compact>
                <span style={{ color: 'rgb(var(--color-dim))' }}>▸</span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  extensions/system-example/src/frontend.tsx
                </span>
                <MetaLabel tone="success">added</MetaLabel>
              </RowButton>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <ActionTile icon="□" label="File Explorer" description="Browse workspace files." />
              <ActionTile icon="▸" label="Terminal" description="Open a terminal tab." meta="local" />
            </div>
          </div>
          <StatGrid>
            <Stat label="Installed" value="31" />
            <Stat label="Enabled" value="26" />
            <Stat label="Warnings" value="2" detail="Needs attention" valueClassName="text-warning" detailClassName="text-warning" />
            <Stat label="Updated" value="Today" />
            <Stat label="Avg Turns / Run" value="12.4" labelPosition="after" valueClassName="text-accent" />
          </StatGrid>
          <DashboardGrid columns={2}>
            <DashboardGridCell>
              <MetricTile label="Throughput" value="42 tok/s" tone="accent" />
            </DashboardGridCell>
            <DashboardGridCell>
              <MetricTile label="Cache" value="68%" tone="success" />
            </DashboardGridCell>
          </DashboardGrid>
          <KeyValueList>
            <KeyValueItem label="Package" value="installable-extensions/system-example" action={<Button variant="ghost">Open</Button>} />
            <KeyValueItem label="Permissions" value="Filesystem, shell, notifications" />
          </KeyValueList>
          <KeyValueTable
            columns={3}
            items={[
              { label: 'Files', value: '12' },
              { label: 'Size', value: '18 KB' },
              { label: 'Location', value: '/Users/patrick/.neon-pilot/logs', valueClassName: 'font-mono' },
            ]}
          />
          <div style={{ display: 'grid', gap: 8 }}>
            <SectionLabel>Progress</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <InlineMeta>updated 2m ago</InlineMeta>
              <InlineMeta>
                <Spinner />
                saving checkpoint...
              </InlineMeta>
            </div>
            <ProgressBar value={64} label="Trace coverage" />
            <ProgressBar value={42} tone="success" label="Successful calls" />
            <ProgressBar value={18} tone="warning" minPercent={2} label="Warnings" />
            <ProgressRow label="Cache read" value="68%" progressValue={68} tone="success" progressLabel="Cache read" />
            <ProgressRow label="Tool errors" value="4.2%" progressValue={4.2} tone="warning" minPercent={2} progressLabel="Tool errors" />
          </div>
          <Disclosure summary="Invocation payload" open>
            <CodeBlock compact>{'{\n  "cwd": "/Users/patrick/workingdir/neon-pilot",\n  "mode": "review"\n}'}</CodeBlock>
          </Disclosure>
          <CodeBlock>{'pa.extension.invoke("readState", { id: "system-example" })'}</CodeBlock>
          <DataTable
            tableClassName="table-fixed"
            columns={
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
            }
          >
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Name</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell>Source</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>System Knowledge</DataTableCell>
                <DataTableCell>Enabled</DataTableCell>
                <DataTableCell>System</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
        </SurfacePanel>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Settings Section</h2>
        <SurfacePanel style={{ padding: 16 }}>
          <SettingsSection title="Runtime" description="Use this pattern for extension settings and editor forms.">
            <SettingsRow
              title="Update path"
              description="Use settings rows when a setting needs copy plus a trailing control, button, or select."
            >
              <Select defaultValue="stable" style={{ minWidth: 180 }}>
                <option value="stable">Stable</option>
                <option value="test">Test</option>
              </Select>
            </SettingsRow>
            <SettingToggleRow
              title="Enable workflow"
              description="Use toggle rows for settings that need a title, supporting copy, and switch control."
              checked
              onCheckedChange={() => undefined}
            />
            <Field label="Working Directory">
              <TextInput placeholder="~/workingdir/repo…" />
            </Field>
          </SettingsSection>
        </SurfacePanel>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Feedback</h2>
        <Notice title="Extension installed">Reload the extension registry to use the new surface.</Notice>
        <Notice tone="danger" title="Install failed">
          Check the package path and try again.
        </Notice>
        <SurfacePanel muted style={{ display: 'grid', gap: 14, padding: 16 }}>
          <LoadingState label="Loading extension state…" />
          <div style={{ minHeight: 120, border: '1px dashed rgb(var(--color-border-subtle))' }}>
            <CenteredLoadingState label="Loading extension route..." />
          </div>
          <div style={{ minHeight: 160, border: '1px dashed rgb(var(--color-border-subtle))' }}>
            <CenteredMessage
              eyebrow="Workbench"
              title="Open a file"
              body="Pick a file from the tree to keep it beside the transcript."
              actions={<ToolbarButton>Browse Files</ToolbarButton>}
            />
          </div>
          <ErrorState title="Failed to load" body="The extension backend returned an unexpected response." />
          <EmptyState title="No Results" body="Clear the filter to show all registered extensions." />
        </SurfacePanel>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Dialog Anatomy</h2>
        <SupportingText>
          Use `Dialog` for the live overlay. `backdropClassName` and `backdropStyle` keep host-specific alignment or blur on the shared
          shell.
        </SupportingText>
        <div className="ui-dialog-shell" style={{ width: 'min(28rem, 100%)' }}>
          <DialogHeader title="Create File" titleId="story-dialog-title" description="Use dialog structure for short focused tasks." />
          <DialogBody>
            <Field label="File Name">
              <TextInput defaultValue="notes.md" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="action">Cancel</Button>
            <Button variant="action" tone="accent">
              Create
            </Button>
          </DialogFooter>
        </div>
        <div style={{ position: 'relative', minHeight: 260, overflow: 'hidden', border: '1px dashed rgb(var(--color-border-subtle))' }}>
          <ConfirmDialog
            title="Delete Extension"
            message="Delete System Knowledge? This removes the extension package from disk."
            confirmLabel="Delete"
            backdropStyle={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.18)' }}
            onCancel={() => undefined}
            onConfirm={() => undefined}
          />
        </div>
        <div style={{ position: 'relative', minHeight: 260, overflow: 'hidden', border: '1px dashed rgb(var(--color-border-subtle))' }}>
          <TextPromptDialog
            title="Rename Workspace"
            label="Workspace name"
            initialValue="Neon Pilot"
            confirmLabel="Rename"
            backdropStyle={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.18)' }}
            onCancel={() => undefined}
            onSubmit={() => undefined}
          />
        </div>
      </section>
    </div>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {};

export const AppPage: Story = {
  render: () => (
    <div style={{ width: 900, minHeight: 540, border: '1px solid rgb(var(--color-border-subtle))' }}>
      <AppPageLayout contentClassName="space-y-8">
        <AppPageIntro
          title="Extension Dashboard"
          summary="Use this page shape for extension-owned routes that need a focused tool surface instead of a marketing layout."
          actions={<ToolbarButton>Refresh</ToolbarButton>}
        />
        <SurfacePanel style={{ padding: 18 }}>
          <EmptyState title="Ready" body="Build the workflow-specific UI here using shared primitives first." />
        </SurfacePanel>
      </AppPageLayout>
    </div>
  ),
};
