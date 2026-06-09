import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import { AttachmentChip, AttachmentChipButton, IconButton, TextButton } from '../primitives';
import { StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Patterns/Attachments',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComposerAttachments: Story = {
  render: () => (
    <StoryStack>
      <Wrap>
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
              style={{ width: 36, height: 28, flexShrink: 0, borderRadius: 4, background: 'rgb(var(--color-accent) / 0.16)' }}
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
      </Wrap>
    </StoryStack>
  ),
};
