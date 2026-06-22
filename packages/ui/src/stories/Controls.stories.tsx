import '../styles.css';

import type { Meta, StoryObj } from '@storybook/react';

import { Field, InlineSelect, Select, SurfacePanel, Textarea, TextInput } from '../primitives';

const meta = {
  title: 'Primitives/Controls',
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'light' },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectsInLightMode: Story = {
  render: () => (
    <div data-theme="light" style={{ width: 520 }}>
      <SurfacePanel style={{ padding: 16 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Shared select">
            <Select defaultValue="warn">
              <optgroup label="Outcomes">
                <option value="continue">Continue</option>
                <option value="warn">Warn and continue</option>
                <option value="block">Stop this event</option>
              </optgroup>
            </Select>
          </Field>
          <Field label="Inline select">
            <InlineSelect defaultValue="after">
              <option value="before">Before</option>
              <option value="after">After</option>
            </InlineSelect>
          </Field>
          <Field label="Text input">
            <TextInput defaultValue="Routine name" />
          </Field>
          <Field label="Textarea">
            <Textarea defaultValue="Run this instruction before the event." />
          </Field>
        </div>
      </SurfacePanel>
    </div>
  ),
};

export const SelectsInDarkMode: Story = {
  render: () => (
    <div data-theme="dark" style={{ width: 520 }}>
      <SurfacePanel style={{ padding: 16 }}>
        <Field label="Shared select">
          <Select defaultValue="continue">
            <option value="continue">Continue</option>
            <option value="warn">Warn and continue</option>
            <option value="block">Stop this event</option>
          </Select>
        </Field>
      </SurfacePanel>
    </div>
  ),
};
