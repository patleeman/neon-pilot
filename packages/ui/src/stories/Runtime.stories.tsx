import type { Meta, StoryObj } from '@storybook/react';

import {
  ChoiceRow,
  KeyValueItem,
  KeyValueList,
  RuntimeFooter,
  RuntimeHeader,
  RuntimeHeaderControls,
  RuntimePage,
  RuntimeSection,
  RuntimeStrip,
  TerminalBlock,
  ToolbarButton,
} from '../primitives';
import '../styles.css';

const meta = {
  title: 'Patterns/Runtime Workspaces',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalRuntime: Story = {
  render: () => (
    <div style={{ width: 900, height: 660, border: '1px solid rgb(var(--color-border-subtle))' }}>
      <RuntimePage>
        <RuntimeHeader
          title="Local Model Runtime"
          summary="Use this workspace shape for extension pages that install, start, monitor, and inspect a local backend."
          actions={
            <RuntimeHeaderControls
              switchLabel="Server"
              switchChecked
              onSwitchChange={() => undefined}
              status="Running"
              tone="running"
              onRefresh={() => undefined}
            />
          }
        />
        <RuntimeStrip
          status="Server ready"
          tone="ready"
          metadata={['mlx-vlm', 'Apple Silicon', 'Port 3928']}
          message="Model loaded and accepting requests."
          progress={100}
        >
          <div className="flex flex-wrap gap-2">
            <ToolbarButton>Restart</ToolbarButton>
            <ToolbarButton>Open Logs</ToolbarButton>
          </div>
        </RuntimeStrip>
        <RuntimeSection title="Backend" description="Choose where analysis runs." action={<ToolbarButton>Save</ToolbarButton>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceRow label="OpenRouter" detail="Use configured provider credentials." selected />
            <ChoiceRow label="Local runtime" detail="Private on-device inference with setup logs." />
          </div>
        </RuntimeSection>
        <RuntimeSection title="Runtime Logs" description="Setup and server output. Refreshes automatically.">
          <TerminalBlock compact>{'server listening on 127.0.0.1:3928\nmodel loaded: Nemotron Nano Omni'}</TerminalBlock>
        </RuntimeSection>
        <RuntimeFooter summary="Advanced details" open onToggle={() => undefined}>
          <KeyValueList>
            <KeyValueItem label="Install path" value="~/Library/Application Support/Neon Pilot/local-models" />
            <KeyValueItem label="Backend" value="mlx-vlm" />
          </KeyValueList>
        </RuntimeFooter>
      </RuntimePage>
    </div>
  ),
};
