import type { Meta, StoryObj } from '@storybook/react';

import {
  CenteredLoadingState,
  CenteredMessage,
  EmptyState,
  ErrorState,
  Keycap,
  LoadingState,
  Notice,
  Pill,
  RingStatusDot,
  Spinner,
  StatusDot,
  SurfacePanel,
  ToolbarButton,
  Tooltip,
} from '../primitives';
import '../styles.css';
import { StorySection, StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Components/Feedback',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusIndicators: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Pills and Dots">
        <Wrap>
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
        </Wrap>
      </StorySection>
      <StorySection title="Activity">
        <Wrap>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgb(var(--color-accent))', fontSize: 11 }}>
            <Spinner size="xs" />
            Running
          </span>
          <Spinner />
          <Keycap>Cmd</Keycap>
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
        </Wrap>
      </StorySection>
    </StoryStack>
  ),
};

export const EmptyLoadingAndErrors: Story = {
  render: () => (
    <StoryStack>
      <Notice title="Extension installed">Reload the extension registry to use the new surface.</Notice>
      <Notice tone="danger" title="Install failed">
        Check the package path and try again.
      </Notice>
      <SurfacePanel muted style={{ display: 'grid', gap: 14, padding: 16 }}>
        <LoadingState label="Loading extension state..." />
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
    </StoryStack>
  ),
};
