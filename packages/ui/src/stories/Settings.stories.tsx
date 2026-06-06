import type { Meta, StoryObj } from '@storybook/react';

import { Field, Select, SettingsPanel, SettingsRow, SettingToggleRow, SettingsSection, SurfacePanel, Switch, TextInput } from '../primitives';
import '../styles.css';

const meta = {
  title: 'Patterns/Settings',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SettingsSectionPattern: Story = {
  render: () => (
    <div style={{ width: 760 }}>
      <SurfacePanel style={{ padding: 16 }}>
        <SettingsSection title="Runtime" description="Use this pattern for extension settings and editor forms.">
          <SettingsPanel title="Provider" description="Use SettingsPanel for repeated subpanels inside larger settings sections.">
            <Field label="Base URL">
              <TextInput defaultValue="https://api.example.local/v1" />
            </Field>
            <SettingsRow title="Use provider defaults" description="Let the extension infer missing values when possible.">
              <Switch checked label="Enabled" />
            </SettingsRow>
          </SettingsPanel>
          <SettingsRow title="Update path" description="Use settings rows when a setting needs copy plus a trailing control, button, or select.">
            <Select defaultValue="stable" style={{ minWidth: 180 }}>
              <option value="stable">Stable</option>
              <option value="test">Test</option>
            </Select>
          </SettingsRow>
          <SettingToggleRow
            title="Enable workflow"
            description="Use toggle rows for settings that need a title, supporting copy, and switch control."
            checked
            onCheckedChange={() => undefined}
          />
          <Field label="Working Directory">
            <TextInput placeholder="~/workingdir/repo..." />
          </Field>
        </SettingsSection>
      </SurfacePanel>
    </div>
  ),
};
