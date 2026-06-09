import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import {
  ActionTile,
  CodeBlock,
  FolderIcon,
  InlineMeta,
  MetaLabel,
  Pill,
  RailSection,
  RailSubsection,
  ResourceList,
  ResourceListItem,
  ResourcePickerDialog,
  ResourcePickerList,
  ResourcePickerToolbar,
  SearchInput,
  TextButton,
  ToolbarButton,
  WorkbenchHeader,
  WorkbenchShell,
} from '../primitives';
import { StorySection, StoryStack } from './storyUtils';

const meta = {
  title: 'Patterns/Workbench',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkbenchShellPattern: Story = {
  render: () => (
    <StoryStack width={820}>
      <WorkbenchShell
        style={{ height: 280, border: '1px solid rgb(var(--color-border-subtle))' }}
        header={
          <WorkbenchHeader
            title="Artifact preview"
            meta="html · rev 3"
            leading={<MetaLabel>artifact</MetaLabel>}
            actions={<ToolbarButton>copy source</ToolbarButton>}
          />
        }
        footer={<InlineMeta>Use WorkbenchShell for editor, preview, and file-diff panes.</InlineMeta>}
      >
        <div style={{ display: 'grid', height: '100%', gridTemplateColumns: '14rem minmax(0, 1fr)', minHeight: 0 }}>
          <RailSection title="Files">
            <ResourceList bordered={false}>
              <ResourceListItem label="index.html" meta="current" selected />
              <ResourceListItem label="styles.css" meta="asset" />
            </ResourceList>
            <RailSubsection title="Needs review" className="mt-3">
              <ResourceListItem label="contract.md" meta="failed validation" />
            </RailSubsection>
          </RailSection>
          <div style={{ minHeight: 0, overflow: 'auto', borderLeft: '1px solid rgb(var(--color-border-subtle))', padding: 16 }}>
            <CodeBlock compact>{'<main>\\n  <h1>Preview</h1>\\n</main>'}</CodeBlock>
          </div>
        </div>
      </WorkbenchShell>
    </StoryStack>
  ),
};

export const ResourcePicker: Story = {
  render: () => (
    <StoryStack width={760}>
      <StorySection title="Resource Picker Dialog">
        <div style={{ position: 'relative', minHeight: 340, overflow: 'hidden', border: '1px dashed rgb(var(--color-border-subtle))' }}>
          <ResourcePickerDialog
            title="Open workspace"
            description="Use ResourcePickerDialog for bounded modal pickers with searchable resource rows."
            footer="up/down move · enter select · esc close"
            backdropStyle={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.18)' }}
            style={{ maxHeight: 310 }}
          >
            <ResourcePickerToolbar
              search={<SearchInput placeholder="Filter workspaces..." />}
              actions={
                <Pill tone="muted" mono>
                  3
                </Pill>
              }
            />
            <ResourcePickerList>
              <ResourceListItem label="neon-pilot" detail="/Users/patrick/workingdir/neon-pilot" selected />
              <ResourceListItem label="neon-pilot-extensions" detail="/Users/patrick/workingdir/neon-pilot-extensions" />
              <ResourceListItem
                label="Choose a new folder"
                detail="Use the system picker to add another workspace."
                leading={<FolderIcon />}
              />
            </ResourcePickerList>
          </ResourcePickerDialog>
        </div>
      </StorySection>
      <TextButton tone="accent">Open selected workspace</TextButton>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <ActionTile icon="□" label="File Explorer" description="Browse workspace files." />
        <ActionTile icon="▸" label="Terminal" description="Open a terminal tab." meta="local" />
      </div>
    </StoryStack>
  ),
};
