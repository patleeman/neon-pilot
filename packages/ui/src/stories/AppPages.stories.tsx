import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import {
  AppPageIntro,
  AppPageLayout,
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTablePagination,
  DataTableRow,
  DataTableToolbar,
  EmptyState,
  KeyValueItem,
  KeyValueList,
  SearchInput,
  SidebarList,
  SidebarMessage,
  SidebarSection,
  TabButton,
  TabList,
  ToolbarButton,
} from '../primitives';

const meta = {
  title: 'Patterns/App Pages',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExtensionDashboard: Story = {
  render: () => (
    <div style={{ width: 900, minHeight: 540, border: '1px solid rgb(var(--color-border-subtle))' }}>
      <AppPageLayout contentClassName="space-y-8">
        <AppPageIntro title="Extension Dashboard" />
        <DataTableToolbar
          tabs={
            <TabList ariaLabel="Extension filters" variant="underline">
              <TabButton active>All</TabButton>
              <TabButton>Attention</TabButton>
            </TabList>
          }
          summary="12 entries"
          search={<SearchInput placeholder="Search context..." style={{ width: 220 }} />}
          actions={<ToolbarButton>Refresh</ToolbarButton>}
        />
        <div className="space-y-3">
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Entry</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>Instructions</DataTableCell>
                <DataTableCell>Enabled</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
          <DataTablePagination page={1} pageCount={3} totalLabel="24 entries" />
        </div>
      </AppPageLayout>
    </div>
  ),
};

export const RouteShellRegions: Story = {
  render: () => {
    const items = [
      { id: 'session-a', title: 'Session A', meta: 'Ready' },
      { id: 'session-b', title: 'Session B', meta: 'Running' },
    ];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr) 300px',
          width: 1100,
          minHeight: 560,
          border: '1px solid rgb(var(--color-border-subtle))',
          background: 'rgb(var(--color-app))',
        }}
      >
        <div style={{ borderRight: '1px solid rgb(var(--color-border-subtle))' }}>
          <SidebarSection title="Sessions">
            <SidebarList items={items} selectedId="session-a" onSelect={() => undefined} />
          </SidebarSection>
          <SidebarSection title="Empty">
            <SidebarMessage>No saved sessions yet.</SidebarMessage>
          </SidebarSection>
        </div>
        <AppPageLayout contentClassName="space-y-6">
          <AppPageIntro title="Route Shell" actions={<ToolbarButton>Refresh</ToolbarButton>} />
          <DataTableToolbar
            summary="2 sessions"
            search={<SearchInput placeholder="Search sessions..." style={{ width: 220 }} />}
            actions={<ToolbarButton>New session</ToolbarButton>}
          />
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Session</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>Session A</DataTableCell>
                <DataTableCell>Ready</DataTableCell>
              </DataTableRow>
              <DataTableRow>
                <DataTableCell>Session B</DataTableCell>
                <DataTableCell>Running</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
        </AppPageLayout>
        <div style={{ borderLeft: '1px solid rgb(var(--color-border-subtle))' }}>
          <ContextRail>
            <ContextRailHeader eyebrow="Session details" title="Session A" subtitle="Ready" />
            <ContextRailBody>
              <ContextRailSection title="Status">
                <KeyValueList>
                  <KeyValueItem label="State" value="Ready" />
                  <KeyValueItem label="Owner" value="Hermes" />
                </KeyValueList>
              </ContextRailSection>
              <ContextRailSection title="Empty state">
                <EmptyState
                  align="start"
                  title="Pick a row to inspect"
                  body="Select an item in the main page to inspect its state here."
                  steps={['Pick a row.', 'Review context here.', 'Use row actions for short-lived work.']}
                />
              </ContextRailSection>
            </ContextRailBody>
          </ContextRail>
        </div>
      </div>
    );
  },
};
