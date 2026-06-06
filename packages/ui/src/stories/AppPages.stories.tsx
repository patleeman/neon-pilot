import type { Meta, StoryObj } from '@storybook/react';

import {
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableRow,
  EmptyState,
  SearchInput,
  SurfacePanel,
  ToolbarButton,
} from '../primitives';
import '../styles.css';

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
        <AppPageIntro
          title="Extension Dashboard"
          summary="Use this page shape for extension-owned routes that need a focused tool surface instead of a marketing layout."
          actions={<ToolbarButton>Refresh</ToolbarButton>}
        />
        <AppPageSection
          title="Runtime Context"
          description="Use AppPageSection for route subsections with title copy, optional counts, actions, and a consistent body gap."
          meta="12 entries"
          actions={<SearchInput placeholder="Search context..." style={{ width: 220 }} />}
        >
          <DataTable>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>Instructions</DataTableCell>
                <DataTableCell>Enabled</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
        </AppPageSection>
        <SurfacePanel style={{ padding: 18 }}>
          <EmptyState title="Ready" body="Build the workflow-specific UI here using shared primitives first." />
        </SurfacePanel>
      </AppPageLayout>
    </div>
  ),
};
