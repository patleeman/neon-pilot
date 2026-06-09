import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import {
  BrowsePathButton,
  Button,
  ButtonLink,
  ChatBubbleIcon,
  CheckButton,
  ComposerActionButton,
  FolderIcon,
  IconButton,
  IconLink,
  MediaPreviewButton,
  MessageActionButton,
  TaskListItem,
  TextButton,
  TextLink,
  TitleButton,
  ToolbarButton,
} from '../primitives';
import { StorySection, StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Components/Actions',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ButtonsAndLinks: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Command Buttons">
        <Wrap>
          <ToolbarButton>Refresh</ToolbarButton>
          <Button variant="action">Open</Button>
          <Button tone="accent">Save</Button>
          <Button tone="danger">Delete</Button>
          <ButtonLink href="#open" variant="action">
            Open Link
          </ButtonLink>
          <BrowsePathButton busy={false} title="Choose workspace folder" ariaLabel="Choose workspace folder" onClick={() => undefined} />
        </Wrap>
      </StorySection>
      <StorySection title="Inline Actions">
        <Wrap>
          <TextButton>Inline action</TextButton>
          <TextButton tone="accent">Open</TextButton>
          <TextButton tone="danger">Remove</TextButton>
          <TextLink href="#settings">Settings link</TextLink>
        </Wrap>
      </StorySection>
      <StorySection title="Icon Actions">
        <Wrap>
          <IconButton aria-label="More actions">...</IconButton>
          <IconButton aria-label="Add item" shape="circle">
            +
          </IconButton>
          <IconButton aria-label="Compact more actions" size="sm">
            ...
          </IconButton>
          <IconLink href="#thread" aria-label="Open thread">
            ↗
          </IconLink>
          <CheckButton checked aria-label="Completed" />
          <CheckButton checked={false} aria-label="Incomplete" />
          <FolderIcon className="text-secondary" />
          <ChatBubbleIcon className="text-secondary" />
        </Wrap>
      </StorySection>
    </StoryStack>
  ),
};

export const ConversationActions: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Title Button">
        <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.05 }}>
          <TitleButton aria-label="Rename conversation">Clickable page title</TitleButton>
        </h1>
      </StorySection>
      <StorySection title="Message Actions">
        <Wrap>
          <MessageActionButton>copy</MessageActionButton>
          <MessageActionButton tone="accent">copied</MessageActionButton>
          <MessageActionButton tone="danger">copy failed</MessageActionButton>
          <MessageActionButton disabled>disabled</MessageActionButton>
        </Wrap>
      </StorySection>
      <StorySection title="Composer Actions">
        <Wrap>
          <ComposerActionButton tone="accent" aria-label="Send">
            ↑
          </ComposerActionButton>
          <ComposerActionButton tone="warning" size="label">
            Steer
          </ComposerActionButton>
          <ComposerActionButton tone="neutral" size="label">
            Follow up
          </ComposerActionButton>
          <ComposerActionButton tone="danger" aria-label="Stop">
            ■
          </ComposerActionButton>
          <ComposerActionButton tone="disabled" disabled aria-label="Send unavailable">
            ↑
          </ComposerActionButton>
        </Wrap>
      </StorySection>
      <StorySection title="Media Preview">
        <MediaPreviewButton style={{ width: 220, borderRadius: 6, overflow: 'hidden' }} aria-label="Inspect image preview">
          <div style={{ aspectRatio: '16 / 9', background: 'rgb(var(--color-surface-2))', display: 'grid', placeItems: 'center' }}>
            Image preview
          </div>
        </MediaPreviewButton>
      </StorySection>
      <StorySection title="Task List Items">
        <div style={{ display: 'grid', gap: 2, width: 460, maxWidth: '100%' }}>
          <TaskListItem
            label="Review extension docs"
            detail="Document the UI component import path."
            control={<CheckButton checked={false} aria-label="Mark review complete" />}
            actions={
              <IconButton compact aria-label="Delete review task">
                x
              </IconButton>
            }
          />
          <TaskListItem
            checked
            label="Replace bespoke rows"
            detail="Todo shelf now uses TaskListItem."
            control={<CheckButton checked aria-label="Reopen row replacement task" />}
            actions={
              <IconButton compact aria-label="Delete row replacement task">
                x
              </IconButton>
            }
          />
        </div>
      </StorySection>
    </StoryStack>
  ),
};
