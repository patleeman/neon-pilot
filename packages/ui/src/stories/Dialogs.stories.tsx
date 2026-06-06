import type { Meta, StoryObj } from '@storybook/react';

import { Button, ConfirmDialog, DialogBody, DialogFooter, DialogHeader, Field, SupportingText, TextInput, TextPromptDialog } from '../primitives';
import '../styles.css';
import { StorySection, StoryStack } from './storyUtils';

const meta = {
  title: 'Patterns/Dialogs',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DialogAnatomy: Story = {
  render: () => (
    <StoryStack>
      <SupportingText>
        Use Dialog for the live overlay. These anatomy examples show the shared header, body, and footer structure.
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
    </StoryStack>
  ),
};

export const PromptsAndConfirms: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Confirm">
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
      </StorySection>
      <StorySection title="Text Prompt">
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
      </StorySection>
    </StoryStack>
  ),
};
