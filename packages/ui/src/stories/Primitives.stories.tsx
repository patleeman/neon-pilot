import type { Meta, StoryObj } from '@storybook/react';

import {
  AppPageIntro,
  AppPageLayout,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  Field,
  IconButton,
  Keycap,
  KeyValueItem,
  KeyValueList,
  LoadingState,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShell,
  Notice,
  Pill,
  ResourceListItem,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  Select,
  SettingToggleRow,
  SettingsSection,
  Stat,
  StatGrid,
  SurfacePanel,
  Switch,
  TabButton,
  TabList,
  Textarea,
  TextInput,
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
          <Button tone="accent">Save</Button>
          <Button tone="danger">Delete</Button>
          <IconButton aria-label="More actions">•••</IconButton>
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
          <Keycap>⌘</Keycap>
          <Keycap>K</Keycap>
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
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Data Display</h2>
        <SurfacePanel style={{ display: 'grid', gap: 16, padding: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <SectionLabel>Artifacts</SectionLabel>
            <ResourceListItem label="Architecture diagram" meta="mermaid" detail="artifact_123" selected />
            <ResourceListItem label="Release notes" meta="html" detail="artifact_456" />
          </div>
          <StatGrid>
            <Stat label="Installed" value="31" />
            <Stat label="Enabled" value="26" />
            <Stat label="Warnings" value="2" detail="Needs attention" />
            <Stat label="Updated" value="Today" />
          </StatGrid>
          <KeyValueList>
            <KeyValueItem label="Package" value="installable-extensions/system-example" action={<Button variant="ghost">Open</Button>} />
            <KeyValueItem label="Permissions" value="Filesystem, shell, notifications" />
          </KeyValueList>
          <DataTable>
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
          <EmptyState title="No Results" body="Clear the filter to show all registered extensions." />
        </SurfacePanel>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Dialog Anatomy</h2>
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
