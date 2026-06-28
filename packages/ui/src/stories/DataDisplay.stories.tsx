import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import {
  Button,
  CardBody,
  CardMeta,
  CardTitle,
  CodeBlock,
  CompactCard,
  DashboardGrid,
  DashboardGridCell,
  DataTable,
  DataTableActionGroup,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Disclosure,
  InlineCode,
  InlineCodeButton,
  InlineMeta,
  KeyValueItem,
  KeyValueList,
  KeyValueTable,
  MetaLabel,
  MetricTile,
  PanelHeader,
  PanelMessage,
  Pill,
  ProgressBar,
  ProgressRow,
  ResourceList,
  ResourceListItem,
  ResourceListLink,
  ResourceListRow,
  RowButton,
  SectionLabel,
  ShelfHeader,
  ShelfSection,
  ShelfStatusRow,
  Spinner,
  Stat,
  StatGrid,
  SupportingText,
  SurfacePanel,
  TextButton,
  ToolResultCard,
} from '../primitives';
import { StorySection, StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Components/Data Display',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardsAndLists: Story = {
  render: () => (
    <StoryStack>
      <SurfacePanel style={{ display: 'grid', gap: 16, padding: 16 }}>
        <PanelHeader title="Panel header" meta="12 items" className="-m-4 mb-0" />
        <PanelMessage>No artifacts in this conversation.</PanelMessage>
        <PanelMessage tone="danger">Artifact not found.</PanelMessage>
        <StorySection title="Text and Cards">
          <SectionLabel>Artifacts</SectionLabel>
          <SectionLabel tone="muted">Muted Label</SectionLabel>
          <Wrap>
            <MetaLabel>artifact</MetaLabel>
            <MetaLabel tone="accent">current</MetaLabel>
            <MetaLabel tone="success">added</MetaLabel>
          </Wrap>
          <SupportingText>Use supporting text for secondary settings copy, empty hints, paths, and status details.</SupportingText>
          <CompactCard style={{ display: 'grid', gap: 4 }}>
            <CardTitle>Compact card</CardTitle>
            <CardBody>Card body text describes a compact setting, row, or rail item.</CardBody>
            <CardMeta>compact metadata</CardMeta>
          </CompactCard>
          <p style={{ margin: 0, fontSize: 13 }}>
            Long paths wrap safely in <InlineCode>packages/desktop/ui/src/pages/ConversationPage.tsx</InlineCode>.
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Clickable tokens use <InlineCodeButton aria-label="Open checkpoint">7410c8c</InlineCodeButton>.
          </p>
        </StorySection>
        <StorySection title="Tool Result Cards">
          <ToolResultCard
            title="Artifact saved"
            badges={
              <>
                <Pill tone="accent" mono>
                  html
                </Pill>
                <InlineMeta>rev 3</InlineMeta>
              </>
            }
            meta={<span className="font-mono text-secondary">artifact_01HN7R2X2V3Y</span>}
            body="The generated report is available in the artifact workbench."
            actions={
              <>
                <TextButton tone="accent">open</TextButton>
                <InlineMeta>updated 2m ago</InlineMeta>
              </>
            }
          />
          <ToolResultCard
            tone="danger"
            title="Artifact failed"
            badges={
              <Pill tone="accent" mono>
                markdown
              </Pill>
            }
            meta={<span className="font-mono text-secondary">artifact_error_01HN7R2</span>}
            body="The renderer could not load the generated artifact."
          />
        </StorySection>
        <StorySection title="Resource Lists">
          <ResourceListItem label="Architecture diagram" meta="mermaid" detail="artifact_123" leading="#" selected />
          <ResourceListItem label="Release notes" meta="html" detail="artifact_456" />
          <ResourceList>
            <ResourceListRow
              title="Review changed files"
              meta={<MetaLabel tone="muted">Extension</MetaLabel>}
              detail="extensions/system-example/skills/review/SKILL.md"
              actions={<Button variant="ghost">Enabled</Button>}
            />
            <ResourceListLink
              href="#resource-link"
              label="Default workflow"
              meta="4 items"
              detail="Navigates to the workflow detail route."
            />
          </ResourceList>
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
        </StorySection>
        <StorySection title="Shelves">
          <ShelfSection
            header={
              <ShelfHeader
                leading={<Spinner size="xs" />}
                title="Background Work"
                detail="2 running"
                actions={<TextButton>details</TextButton>}
              />
            }
          >
            <ShelfStatusRow label="Agent" actions={<TextButton tone="accent">open</TextButton>}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Building extension UI primitives
              </span>
            </ShelfStatusRow>
          </ShelfSection>
          <ShelfSection>
            <ShelfStatusRow
              label="Goal"
              leading={<Spinner size="xs" />}
              status={<span style={{ color: 'rgb(var(--color-success))' }}>Active 1m 6s</span>}
              actions={
                <Button variant="action" tone="danger">
                  Cancel
                </Button>
              }
            >
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'rgb(var(--color-primary))',
                }}
              >
                Replace local shelf recipes with reusable shared treatments
              </span>
            </ShelfStatusRow>
            <ShelfStatusRow label="Queued" actions={<TextButton>restore</TextButton>}>
              <span style={{ color: 'rgb(var(--color-secondary))' }}>Queued prompt styled like the goal label</span>
            </ShelfStatusRow>
            <ShelfStatusRow label="Follow up" actions={<TextButton>restore</TextButton>}>
              <span style={{ color: 'rgb(var(--color-secondary))' }}>Run QA and add tests thoroughly</span>
            </ShelfStatusRow>
          </ShelfSection>
        </StorySection>
      </SurfacePanel>
    </StoryStack>
  ),
};

export const MetricsProgressAndTables: Story = {
  render: () => (
    <StoryStack>
      <StatGrid>
        <Stat label="Installed" value="31" />
        <Stat label="Enabled" value="26" />
        <Stat label="Warnings" value="2" detail="Needs attention" valueClassName="text-warning" detailClassName="text-warning" />
        <Stat label="Updated" value="Today" />
      </StatGrid>
      <Wrap>
        <MetricTile label="Throughput" value="42 tok/s" tone="accent" />
        <MetricTile label="Cache" value="68%" tone="success" />
      </Wrap>
      <DashboardGrid columns={2}>
        <DashboardGridCell>
          <MetricTile label="Queue" value="7" tone="accent" />
        </DashboardGridCell>
        <DashboardGridCell>
          <MetricTile label="Success" value="98%" tone="success" />
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
      <StorySection title="Progress">
        <ProgressBar value={64} label="Trace coverage" />
        <ProgressBar value={42} tone="success" label="Successful calls" />
        <ProgressRow label="Cache read" value="68%" progressValue={68} tone="success" progressLabel="Cache read" />
      </StorySection>
      <Disclosure summary="Invocation payload" open>
        <CodeBlock compact>{'{\n  "cwd": "/Users/patrick/workingdir/neon-pilot",\n  "mode": "review"\n}'}</CodeBlock>
      </Disclosure>
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
            <DataTableCell>
              <DataTableActionGroup className="justify-start">
                <Pill tone="muted">System</Pill>
                <TextButton>Details</TextButton>
              </DataTableActionGroup>
            </DataTableCell>
          </DataTableRow>
          <DataTableEmptyRow colSpan={3}>No user extensions match the current filters.</DataTableEmptyRow>
        </DataTableBody>
      </DataTable>
    </StoryStack>
  ),
};
