import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import { MessageActionButton, MessageCard, MessageMeta } from '../primitives';
import { StorySection, StoryStack } from './storyUtils';

const meta = {
  title: 'Patterns/Transcript',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageCards: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Conversation Messages">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
            <MessageCard role="user" style={{ maxWidth: '86%' }}>
              Summarize the changed files and call out anything risky.
            </MessageCard>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <MessageMeta>2m ago</MessageMeta>
              <MessageActionButton>copy</MessageActionButton>
              <MessageActionButton tone="accent">fork</MessageActionButton>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <MessageCard>
              The diff mostly touches UI chrome. The risky part is preserving transcript scroll behavior, so validate the conversation path.
            </MessageCard>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <MessageMeta>now</MessageMeta>
              <MessageActionButton>copy</MessageActionButton>
              <MessageActionButton tone="danger">copy failed</MessageActionButton>
            </div>
          </div>
        </div>
      </StorySection>
    </StoryStack>
  ),
};
