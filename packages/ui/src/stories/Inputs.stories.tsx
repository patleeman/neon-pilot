import type { Meta, StoryObj } from '@storybook/react';

import {
  Checkbox,
  ChoiceRow,
  Field,
  InlineSelect,
  InlineTextInput,
  KeyboardShortcutCaptureInput,
  SearchInput,
  Select,
  SurfacePanel,
  SwatchOption,
  Switch,
  Textarea,
  TextInput,
} from '../primitives';
import '../styles.css';
import { StorySection, StoryStack, Wrap } from './storyUtils';

const meta = {
  title: 'Components/Inputs',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Forms: Story = {
  render: () => (
    <StoryStack>
      <SurfacePanel style={{ display: 'grid', gap: 14, padding: 16 }}>
        <Field label="Search">
          <SearchInput placeholder="Search extensions..." />
        </Field>
        <Field label="Name" hint="Use a concise label users can scan quickly.">
          <TextInput placeholder="Daily repository summary..." />
        </Field>
        <Field label="Mode">
          <Select defaultValue="review">
            <option value="review">Review</option>
            <option value="build">Build</option>
            <option value="research">Research</option>
          </Select>
        </Field>
        <Field label="Instructions" error="Keep instructions under the extension limit.">
          <Textarea defaultValue="Summarize recent changes and flag anything that needs attention." />
        </Field>
        <Field label="Auto-run">
          <Checkbox defaultChecked aria-label="Auto-run" />
        </Field>
        <Field label="Shortcut" hint="Use for settings and command keybinding editors.">
          <KeyboardShortcutCaptureInput value="CommandOrControl+Shift+P" onChange={() => undefined} />
        </Field>
        <Wrap>
          <InlineSelect defaultValue="daily" aria-label="Cadence">
            <option value="daily">Every day</option>
            <option value="weekly">Weekly</option>
          </InlineSelect>
          <InlineTextInput defaultValue="09:00" aria-label="Time" style={{ width: 84 }} />
          <Switch checked label="Enabled" />
        </Wrap>
      </SurfacePanel>
    </StoryStack>
  ),
};

export const ChoiceControls: Story = {
  render: () => (
    <StoryStack>
      <StorySection title="Choice Rows">
        <div style={{ display: 'grid', gap: 6, width: 420, maxWidth: '100%' }}>
          <ChoiceRow
            role="radio"
            aria-checked="true"
            checked
            indicator="◉"
            label="Use the current branch"
            details="Keep this work scoped to the branch already open in the workspace."
          />
          <ChoiceRow
            role="radio"
            aria-checked="false"
            indicator="◯"
            label="Create a new branch"
            details="Start a separate branch before applying the change."
          />
        </div>
      </StorySection>
      <StorySection title="Swatches">
        <Wrap>
          <SwatchOption checked label="Teal" swatch={<span style={{ width: '100%', height: '100%', background: 'rgb(20 184 166)' }} />} />
          <SwatchOption label="Amber" swatch={<span style={{ width: '100%', height: '100%', background: 'rgb(245 158 11)' }} />} />
          <SwatchOption label="Rose" swatch={<span style={{ width: '100%', height: '100%', background: 'rgb(244 63 94)' }} />} />
        </Wrap>
      </StorySection>
    </StoryStack>
  ),
};
