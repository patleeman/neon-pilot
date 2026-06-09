import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import { EditorToolbar, EditorToolbarButton, EditorToolbarGroup } from '../primitives';

const meta = {
  title: 'Patterns/Editor',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Toolbar: Story = {
  render: () => (
    <EditorToolbar sticky={false} style={{ maxWidth: 520 }} aria-label="Writing toolbar">
      <EditorToolbarGroup>
        <EditorToolbarButton icon statusTone="saved" title="Save" aria-label="Save">
          S
        </EditorToolbarButton>
      </EditorToolbarGroup>
      <EditorToolbarGroup>
        <EditorToolbarButton active title="Bold">
          B
        </EditorToolbarButton>
        <EditorToolbarButton title="Italic">I</EditorToolbarButton>
        <EditorToolbarButton title="Link">[]</EditorToolbarButton>
        <EditorToolbarButton icon title="Insert image" aria-label="Insert image">
          #
        </EditorToolbarButton>
      </EditorToolbarGroup>
      <EditorToolbarGroup>
        <EditorToolbarButton title="Bulleted list">-</EditorToolbarButton>
        <EditorToolbarButton title="Numbered list">1.</EditorToolbarButton>
        <EditorToolbarButton title="Code block">{'{ }'}</EditorToolbarButton>
      </EditorToolbarGroup>
      <EditorToolbarGroup>
        <EditorToolbarButton icon statusTone="running" title="Reviewing" aria-label="Reviewing">
          R
        </EditorToolbarButton>
      </EditorToolbarGroup>
    </EditorToolbar>
  ),
};
