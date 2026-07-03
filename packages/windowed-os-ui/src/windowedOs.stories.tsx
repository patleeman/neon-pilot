import type { Meta, StoryObj } from '@storybook/react';

import {
  StartMenu,
  Taskbar,
  WindowedAppTile,
  WindowedBadge,
  WindowedChatComposer,
  WindowedChatMain,
  WindowedChatSurface,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedEmptyState,
  WindowedField,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedList,
  WindowedListItem,
  WindowedMenuPanel,
  WindowedMessageBubble,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSegmentedControl,
  WindowedSelect,
  WindowedStateBlock,
  WindowedTextarea,
  WindowedTextInput,
  WindowedTimeline,
  WindowedTimelineItem,
  WindowedTitleBarControls,
  WindowedToggle,
  WindowedToolbar,
  WindowFrame,
} from './windowedOs';

const meta = {
  title: 'Windowed OS/Desktop Shell',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const canonicalDesktopApps = [
  { id: 'chat', title: 'Chat', accent: 'chat', meta: 'Threads', detail: 'Workbench attached' },
  { id: 'automations', title: 'Automations', accent: 'automations', meta: 'Scheduled work', detail: 'Runs and reminders' },
  { id: 'workflows', title: 'Workflows', accent: 'routines', meta: 'Dynamic flows', detail: 'Saved multi-agent work' },
  { id: 'gateways', title: 'Gateways', accent: 'gateways', meta: 'Ingress', detail: 'Telegram ready' },
  { id: 'model-arena', title: 'Model Arena', accent: 'gateways', meta: 'Duels', detail: 'Model comparisons' },
  { id: 'routines', title: 'Routines', accent: 'routines', meta: 'Hooks', detail: 'Before and after' },
  { id: 'extensions', title: 'Extensions', accent: 'extensions', meta: 'Installed', detail: 'Extension manager' },
  { id: 'skills', title: 'Skills', accent: 'extensions', meta: 'Library', detail: 'Installed and marketplace' },
  { id: 'diagnostics', title: 'Diagnostics', accent: 'telemetry', meta: 'Telemetry', detail: 'Traces and health' },
  { id: 'settings', title: 'Settings', accent: 'settings', meta: 'Preferences', detail: 'Providers and desktop' },
] as const;

export const DesktopComposition: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 720 }}>
      <main className="wos-desktop" style={{ height: 678 }}>
        <StartMenu open items={canonicalDesktopApps.map((app) => ({ ...app, onSelect: () => undefined }))} />
        <WindowFrame
          title="Chat"
          accent="chat"
          focused
          style={{ left: 48, top: 36, width: 820, height: 520 }}
          onMinimize={() => undefined}
          onMaximize={() => undefined}
          onClose={() => undefined}
        >
          <WindowedChatSurface>
            <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
              <WindowedMessageBubble from="user">Draft the changelog for v0.9</WindowedMessageBubble>
              <WindowedMessageBubble>On it. Pulling merged PRs since the last tag.</WindowedMessageBubble>
              <WindowedMessageBubble from="user">Group by extension, please.</WindowedMessageBubble>
              <WindowedMessageBubble>Done. Six groups, linked to their extension pages.</WindowedMessageBubble>
            </WindowedChatMain>
          </WindowedChatSurface>
        </WindowFrame>
        <WindowFrame
          title="Gateways"
          accent="gateways"
          style={{ left: 640, top: 164, width: 520, height: 360 }}
          onMinimize={() => undefined}
          onMaximize={() => undefined}
          onClose={() => undefined}
        >
          <div style={{ padding: 14, fontFamily: 'system-ui', fontSize: 13 }}>Dense product content lives inside the frame.</div>
        </WindowFrame>
      </main>
      <Taskbar
        startOpen
        onToggleStart={() => undefined}
        items={[
          { id: 'chat-release-notes', title: 'Release notes', accent: 'chat', focused: true, onSelect: () => undefined },
          { id: 'chat-bug-triage', title: 'Bug triage', accent: 'chat', onSelect: () => undefined },
          { id: 'gateways', title: 'Gateways', accent: 'gateways', onSelect: () => undefined },
        ]}
      />
    </div>
  ),
};

export const TaskbarMenuPlacement: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 360 }}>
      <main className="wos-desktop" style={{ height: 318 }}>
        <WindowFrame
          title="Chat"
          accent="chat"
          focused
          style={{ left: 52, top: 32, width: 640, height: 230 }}
          onMinimize={() => undefined}
          onMaximize={() => undefined}
          onClose={() => undefined}
        >
          <WindowedChatSurface>
            <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
              <WindowedMessageBubble>Taskbar menu placement preview.</WindowedMessageBubble>
            </WindowedChatMain>
          </WindowedChatSurface>
        </WindowFrame>
      </main>
      <Taskbar
        startOpen={false}
        onToggleStart={() => undefined}
        defaultOpenGroupId="chat"
        groups={[
          {
            id: 'chat',
            title: 'Chat',
            accent: 'chat',
            focused: true,
            count: 3,
            onSelect: () => undefined,
            menu: (
              <WindowedMenuPanel
                ariaLabel="Open chat windows"
                items={[
                  { id: 'new', label: 'New conversation', onSelect: () => undefined },
                  { id: 'release', label: 'Release notes', onSelect: () => undefined },
                  { id: 'bug', label: 'Bug triage', onSelect: () => undefined },
                ]}
              />
            ),
          },
        ]}
        items={[{ id: 'gateways', title: 'Gateways', accent: 'gateways', onSelect: () => undefined }]}
      />
    </div>
  ),
};

export const ChatWithAttachedWorkbench: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 700, padding: 24 }}>
      <WindowFrame
        title="Release notes"
        accent="chat"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1180px, 100%)', height: 640 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-chat-workbench">
          <WindowedChatSurface>
            <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
              <WindowedMessageBubble from="user">Draft the changelog for v0.11.39.</WindowedMessageBubble>
              <WindowedMessageBubble>Reading the current branch and grouping changes by extension.</WindowedMessageBubble>
              <WindowedMessageBubble from="user">Keep it compact and include blockers only when action is required.</WindowedMessageBubble>
              <WindowedMessageBubble>
                Ready. I found three UI changes, one extension rebuild, and no release blockers.
              </WindowedMessageBubble>
            </WindowedChatMain>
          </WindowedChatSurface>
          <aside className="wos-chat-workbench__panel" aria-label="Attached workbench">
            <div className="wos-chat-workbench__tabs" role="tablist" aria-label="Workbench tabs">
              <button type="button" role="tab" aria-selected="true">
                Files
              </button>
              <button type="button" role="tab" aria-selected="false">
                Browser
              </button>
              <button type="button" role="tab" aria-selected="false">
                Terminal
              </button>
            </div>
            <WindowedPageSection title="Workspace" meta="3 open">
              <WindowedList>
                <WindowedListItem title="CHANGELOG.md" meta="Modified" detail="Release notes" active accent="chat" />
                <WindowedListItem title="extensions/system-gateways" meta="Built" detail="Frontend bundle" accent="gateways" />
                <WindowedListItem title="packages/windowed-os-ui" meta="Storybook" detail="Design target" accent="extensions" />
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Terminal" meta="Last command">
              <WindowedStateBlock tone="positive" title="Validation passed">
                pnpm --dir packages/windowed-os-ui run build
              </WindowedStateBlock>
            </WindowedPageSection>
          </aside>
        </div>
      </WindowFrame>
    </div>
  ),
};

export const NavigationPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 680, padding: 24 }}>
      <WindowFrame
        title="Navigation"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(560px, 100%)', height: 540 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageMain title="Navigation">
          <WindowedPageSection title="Menu apps">
            <div style={{ display: 'grid', gap: 6, padding: 10 }}>
              <WindowedAppTile label="Chat" accent="chat" />
              <WindowedAppTile label="Automations" accent="automations" />
              <WindowedAppTile label="Gateways" accent="gateways" />
            </div>
          </WindowedPageSection>
          <WindowedPageSection title="Taskbar apps">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
              <span className="wos-taskbar__button">
                <WindowedAppTile label="Chat" accent="chat" count={3} variant="taskbar" />
              </span>
              <span className="wos-taskbar__button">
                <WindowedAppTile label="Gateways" accent="gateways" variant="taskbar" />
              </span>
            </div>
          </WindowedPageSection>
          <WindowedPageSection title="Taskbar menu">
            <div style={{ padding: 10 }}>
              <WindowedMenuPanel
                ariaLabel="Story chat windows"
                placement="inline"
                items={[
                  { id: 'new', label: 'New conversation', onSelect: () => undefined },
                  { id: 'release', label: 'Release notes', onSelect: () => undefined },
                  { id: 'deploy', label: 'Deploy check', onSelect: () => undefined },
                ]}
              />
            </div>
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowFrame>
    </div>
  ),
};

export const WindowChromePrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 420, padding: 24 }}>
      <WindowFrame
        title="Window chrome"
        accent="chat"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(620px, 100%)', height: 300 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageMain title="Window chrome">
          <WindowedPageSection title="Titlebar controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10 }}>
              <WindowedTitleBarControls
                title="Preview"
                onMinimize={() => undefined}
                onMaximize={() => undefined}
                onClose={() => undefined}
              />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Minimize, maximize, close</span>
            </div>
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowFrame>
    </div>
  ),
};

export const DenseAppPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 620, padding: 24 }}>
      <WindowFrame
        title="Gateways"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 560 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Telegram"
            description="Only approved users and chats can send work into Neon Pilot."
            actions={<WindowedPageButton tone="accent">Refresh</WindowedPageButton>}
          >
            <WindowedPageSection title="Providers" meta="2 enabled">
              <WindowedDataTable columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow name="Telegram" meta="Gateway" enabled status={<WindowedBadge tone="positive">Enabled</WindowedBadge>} />
                <WindowedDataRow name="Local tools" meta="Runtime" enabled={false} />
              </WindowedDataTable>
            </WindowedPageSection>
            <WindowedPageSection title="Runtime" meta="Needs attention">
              <WindowedKeyValueGrid
                items={[
                  { label: 'Token', value: 'Configured' },
                  { label: 'Connection', value: 'Configured' },
                  { label: 'Runtime', value: <WindowedBadge tone="warning">Needs attention</WindowedBadge> },
                ]}
              />
            </WindowedPageSection>
            <WindowedPageSection title="Approved users" meta="1 approved">
              <WindowedKeyValueList items={[{ label: 'User ID', value: '1191448898' }]} />
            </WindowedPageSection>
            <WindowedPageSection title="Status">
              <WindowedKeyValueList
                items={[
                  { label: 'Setup', value: '/gateways' },
                  { label: 'Configuration', value: 'Gateways page' },
                  {
                    label: 'Enabled',
                    value: <WindowedToggle checked accent="gateways" label="Toggle Telegram gateway" />,
                  },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const StatePrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 560, padding: 24 }}>
      <WindowFrame
        title="States"
        accent="telemetry"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(760px, 100%)', height: 500 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="Windowed States">
            <WindowedPageSection title="Empty states" meta="Compact">
              <div style={{ display: 'grid', gap: 8 }}>
                <WindowedEmptyState action={<WindowedPageButton tone="accent">Create workflow</WindowedPageButton>}>
                  No workflow runs yet.
                </WindowedEmptyState>
                <WindowedEmptyState>
                  <strong>No diagnostics yet.</strong> Diagnostics fill in after conversations produce retained usage, tool, and context
                  data.
                </WindowedEmptyState>
                <WindowedEmptyState tone="danger" action={<WindowedPageButton>Try again</WindowedPageButton>}>
                  Trace data could not be loaded.
                </WindowedEmptyState>
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Status blocks" meta="Inline">
              <div style={{ display: 'grid', gap: 8 }}>
                <WindowedStateBlock tone="positive" title="Ready">
                  Gateway runtime is accepting work from approved chats.
                </WindowedStateBlock>
                <WindowedStateBlock tone="warning" title="Needs attention" action={<WindowedPageButton>Retry</WindowedPageButton>}>
                  Telegram polling failed. Check whether another bot process is active.
                </WindowedStateBlock>
                <WindowedStateBlock tone="danger" title="Unavailable">
                  Gateway settings could not be loaded.
                </WindowedStateBlock>
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const SettingsTwoColumnPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 620, padding: 24 }}>
      <WindowFrame
        title="Settings"
        accent="settings"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(980px, 100%)', height: 560 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="two-column">
          <WindowedPageRail title="Settings sections" accent="settings" showHeader={false}>
            <WindowedList>
              <WindowedListItem title="Appearance" active accent="settings" />
              <WindowedListItem title="Providers" accent="settings" status={<WindowedBadge tone="positive">2</WindowedBadge>} />
              <WindowedListItem title="Extensions" accent="settings" />
              <WindowedListItem title="Desktop" accent="settings" status={<WindowedBadge tone="neutral">Beta</WindowedBadge>} />
              <WindowedListItem title="Shortcuts" accent="settings" />
            </WindowedList>
          </WindowedPageRail>
          <WindowedPageMain
            title="Providers"
            actions={
              <>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">Add provider</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Model providers" meta="2 configured">
              <WindowedDataTable columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow name="OpenAI" meta="Default" enabled status={<WindowedBadge tone="positive">Connected</WindowedBadge>} />
                <WindowedDataRow name="Local" meta="Ollama" status={<WindowedBadge tone="warning">Setup</WindowedBadge>} />
              </WindowedDataTable>
            </WindowedPageSection>
            <WindowedPageSection title="Desktop mode">
              <WindowedKeyValueList
                items={[
                  { label: 'Shell', value: 'Windowed OS' },
                  { label: 'Launch mode', value: 'Menu item' },
                  { label: 'Workbench', value: 'Attached to Chat' },
                  {
                    label: 'Enabled',
                    value: <WindowedToggle checked accent="settings" label="Toggle windowed desktop mode" />,
                  },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const StandardSinglePanePage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Automations"
        accent="automations"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(940px, 100%)', height: 460 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="Automations" actions={<WindowedPageButton tone="accent">New automation</WindowedPageButton>}>
            <WindowedPageSection title="Overview" meta="3 total">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Running', value: '1' },
                  { label: 'Failed', value: '0' },
                  { label: 'Paused', value: '1' },
                  { label: 'Enabled', value: '2' },
                ]}
              />
            </WindowedPageSection>
            <WindowedPageSection title="Task queue">
              <WindowedDataTable columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Action', align: 'right' }]}>
                <WindowedDataRow
                  name="Release watch"
                  meta="*/15 * * * *"
                  enabled
                  status={<WindowedBadge tone="positive">Cron</WindowedBadge>}
                  action={<WindowedPageButton>Run</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="Paused check"
                  meta="2026-07-03 09:00"
                  status={<WindowedBadge tone="neutral">Once</WindowedBadge>}
                  action={<WindowedPageButton>Resume</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const CanonicalDensity: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 740, padding: 24 }}>
      <WindowFrame
        title="Canonical density"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1080px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Windowed surface rhythm"
            description="Compact chrome, small metadata, and dense product controls should feel native to the OS without reverting to stable app spacing."
            actions={
              <>
                <WindowedPageButton>Secondary</WindowedPageButton>
                <WindowedPageButton tone="accent">Primary</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Open applications" meta="Taskbar-owned">
              <WindowedList>
                {canonicalDesktopApps.map((app) => (
                  <WindowedListItem
                    key={app.id}
                    title={app.title}
                    meta={app.meta}
                    detail={app.detail}
                    active={app.id === 'gateways'}
                    accent={app.accent}
                  />
                ))}
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Canonical controls" meta="8px grid">
              <div className="wos-form-grid" data-columns="3">
                <WindowedField label="Name">
                  <WindowedTextInput defaultValue="Telegram gateway" aria-label="Name" />
                </WindowedField>
                <WindowedField label="Mode">
                  <WindowedSelect defaultValue="allowlist" aria-label="Mode">
                    <option value="allowlist">Allowlist</option>
                    <option value="private">Private</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="Status">
                  <WindowedSegmentedControl
                    ariaLabel="Status"
                    accent="gateways"
                    value="ready"
                    options={[
                      { id: 'ready', label: 'Ready' },
                      { id: 'paused', label: 'Paused' },
                    ]}
                  />
                </WindowedField>
                <WindowedField label="Instruction" span="full">
                  <WindowedTextarea
                    aria-label="Instruction"
                    defaultValue="Keep labels crisp, controls compact, and metadata legible without adding stable-shell page padding."
                  />
                </WindowedField>
              </div>
              <div className="wos-form-actions">
                <WindowedPageButton>Cancel</WindowedPageButton>
                <WindowedPageButton tone="accent">Save</WindowedPageButton>
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Scale">
              <WindowedKeyValueList
                items={[
                  { label: 'Title', value: '17 / 1.25' },
                  { label: 'Rows', value: '12.5 / 1.35' },
                  { label: 'Metadata', value: '10 mono' },
                  { label: 'Padding', value: '8 / 10' },
                ]}
              />
            </WindowedPageSection>
            <WindowedPageSection title="States">
              <div style={{ display: 'grid', gap: 8 }}>
                <WindowedStateBlock tone="positive" title="Ready">
                  Gateway runtime is accepting work from approved chats.
                </WindowedStateBlock>
                <WindowedStateBlock tone="warning" title="Needs attention" action={<WindowedPageButton>Retry</WindowedPageButton>}>
                  Telegram polling failed. Check whether another bot process is active.
                </WindowedStateBlock>
                <WindowedStateBlock tone="danger" title="Unavailable">
                  Gateway settings could not be loaded.
                </WindowedStateBlock>
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const AutomationFormPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 700, padding: 24 }}>
      <WindowFrame
        title="Automations"
        accent="automations"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1080px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Daily release notes"
            actions={
              <>
                <WindowedPageButton>Run now</WindowedPageButton>
                <WindowedPageButton tone="accent">Save</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Runs" meta="2 active">
              <WindowedDataTable columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow
                  name="Daily release notes"
                  meta="Weekdays at 09:00"
                  enabled
                  status={<WindowedBadge tone="positive">Ready</WindowedBadge>}
                />
                <WindowedDataRow name="Dependency audit" meta="Mondays at 08:30" enabled={false} />
                <WindowedDataRow name="Inbox sweep" meta="Every 2 hours" enabled />
              </WindowedDataTable>
            </WindowedPageSection>
            <WindowedPageSection title="Schedule" meta="Enabled">
              <div className="wos-form-grid" data-columns="2">
                <WindowedField label="Mode">
                  <WindowedSegmentedControl
                    accent="automations"
                    ariaLabel="Schedule mode"
                    value="cron"
                    options={[
                      { id: 'cron', label: 'Cron' },
                      { id: 'once', label: 'Once' },
                      { id: 'manual', label: 'Manual' },
                    ]}
                  />
                </WindowedField>
                <WindowedField label="Model">
                  <WindowedSelect defaultValue="gpt-5" aria-label="Automation model">
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 mini</option>
                    <option value="local">Local default</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="Cron">
                  <WindowedTextInput defaultValue="0 9 * * 1-5" aria-label="Cron schedule" />
                </WindowedField>
                <WindowedField label="Timezone">
                  <WindowedTextInput defaultValue="America/New_York" aria-label="Schedule timezone" />
                </WindowedField>
                <WindowedField label="Instruction" span="full">
                  <WindowedTextarea
                    defaultValue="Summarize merged changes since the last release checkpoint. Group updates by extension and include blockers only when action is required."
                    aria-label="Automation instruction"
                  />
                </WindowedField>
              </div>
              <div className="wos-form-actions">
                <WindowedPageButton>Reset</WindowedPageButton>
                <WindowedPageButton tone="accent">Apply changes</WindowedPageButton>
              </div>
            </WindowedPageSection>
            <WindowedPageSection title="State">
              <WindowedKeyValueList
                items={[
                  { label: 'Next run', value: 'Today 09:00' },
                  { label: 'Last run', value: 'Yesterday 09:01' },
                  { label: 'Owner', value: 'Release workflow' },
                  {
                    label: 'Enabled',
                    value: <WindowedToggle checked accent="automations" label="Toggle Daily release notes automation" />,
                  },
                ]}
              />
            </WindowedPageSection>
            <WindowedPageSection title="Output">
              <WindowedKeyValueList
                items={[
                  { label: 'Thread', value: 'Release notes' },
                  { label: 'Delivery', value: 'Append to chat' },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const AutomationsPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Automations"
        accent="automations"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Automations"
            actions={
              <>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">New automation</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Overview" meta="7 total">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Running', value: <WindowedBadge tone="warning">1</WindowedBadge> },
                  { label: 'Failed', value: <WindowedBadge tone="danger">1</WindowedBadge> },
                  { label: 'Paused', value: 2 },
                  { label: 'Enabled', value: <WindowedBadge tone="positive">5</WindowedBadge> },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Task queue">
              <div className="wos-automation-table">
                <div className="wos-automation-table__header">
                  <span>Automation</span>
                  <span>Schedule</span>
                  <span>Next</span>
                  <span>Owner</span>
                  <span>Actions</span>
                </div>
                {[
                  ['Release watch', '0 9 * * 1-5', 'Today 09:00', 'Release notes', 'running'],
                  ['Dependency audit', 'Mondays 08:30', 'Mon 08:30', 'Package drift', 'paused'],
                  ['Inbox sweep', 'Every 2 hours', '12:00', 'Triage', 'ready'],
                ].map(([name, schedule, next, owner, status]) => (
                  <div key={name} className="wos-automation-row" data-active={name === 'Release watch'}>
                    <button type="button" className="wos-automation-row__identity">
                      <span>{name}</span>
                      <small>
                        {status === 'running'
                          ? 'Summarize merged changes'
                          : status === 'paused'
                            ? 'Check package drift'
                            : 'Group follow-up threads'}
                      </small>
                    </button>
                    <span className="wos-automation-row__schedule">{schedule}</span>
                    <span>{next}</span>
                    <button type="button" className="wos-automation-row__owner">
                      {owner}
                    </button>
                    <span className="wos-automation-row__actions">
                      <WindowedPageButton>Run</WindowedPageButton>
                      <WindowedPageButton>{status === 'paused' ? 'Resume' : 'Pause'}</WindowedPageButton>
                      <WindowedPageButton>Edit</WindowedPageButton>
                    </span>
                  </div>
                ))}
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
      <WindowedDialog title="Automation details" meta="Running · 0 9 * * 1-5" accent="automations" onClose={() => undefined}>
        <WindowedPageSection title="Automation context">
          <WindowedKeyValueList
            items={[
              { label: 'Owner', value: 'Release notes' },
              { label: 'Next run', value: 'Today 09:00' },
              { label: 'Model', value: 'GPT-5' },
            ]}
          />
        </WindowedPageSection>
        <WindowedPageSection title="Instruction">
          <WindowedTextarea
            aria-label="Automation instruction"
            defaultValue="Draft release notes from merged work and append them to the Release notes chat."
          />
        </WindowedPageSection>
      </WindowedDialog>
    </div>
  ),
};

export const GatewaysPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Gateways"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Gateways"
            actions={
              <>
                <WindowedPageButton>Test bot</WindowedPageButton>
                <WindowedPageButton>Configure</WindowedPageButton>
                <WindowedPageButton>Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Status" meta="runtime">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Providers', value: 1 },
                  { label: 'Token', value: <WindowedBadge tone="positive">configured</WindowedBadge> },
                  { label: 'Runtime', value: <WindowedBadge tone="positive">polling</WindowedBadge> },
                  { label: 'Approved', value: 7 },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Providers" meta="1 available">
              <WindowedDataTable columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Configuration', align: 'right' }]}>
                <WindowedDataRow
                  name="Telegram"
                  meta="Bot token saved"
                  status={<WindowedBadge tone="positive">polling</WindowedBadge>}
                  action="Settings"
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Readiness" meta="Enabled">
              <WindowedKeyValueGrid
                columns={3}
                items={[
                  { label: 'Token', value: 'Configured' },
                  { label: 'Connection', value: 'Created' },
                  { label: 'Runtime', value: 'Polling' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Gateway tools" meta="Subwindows">
              <WindowedDataTable columns={[{ label: 'Tool' }, { label: 'State' }, { label: 'Open', align: 'right' }]}>
                <WindowedDataRow
                  name="Configuration"
                  meta="Setup route, docs, and bot token"
                  status={<WindowedBadge tone="positive">configured</WindowedBadge>}
                  action={<WindowedPageButton>Open</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="Access"
                  meta="Approved Telegram users and chats"
                  status={<WindowedBadge tone="neutral">7 approved</WindowedBadge>}
                  action={<WindowedPageButton>Open</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="Activity"
                  meta="Recent gateway events"
                  status={<WindowedBadge tone="positive">8 events</WindowedBadge>}
                  action={<WindowedPageButton>Open</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
      <WindowedDialog title="Telegram configuration" meta="Token configured" accent="gateways" onClose={() => undefined}>
        <WindowedKeyValueList
          items={[
            { label: 'Setup', value: '/settings/gateways/telegram' },
            { label: 'Configuration', value: 'Settings' },
            { label: 'Docs', value: 'Telegram Bot API' },
          ]}
        />
        <WindowedPageSection title="Token">
          <WindowedTextarea aria-label="Telegram token" defaultValue="••••••••••••••••••••••••••••••••" />
        </WindowedPageSection>
      </WindowedDialog>
    </div>
  ),
};

export const RoutinesPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Routines"
        accent="routines"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Before agent start"
            actions={
              <>
                <WindowedPageButton tone="accent">Run prompt</WindowedPageButton>
                <WindowedPageButton>Choose path</WindowedPageButton>
                <WindowedPageButton>Stop event</WindowedPageButton>
                <WindowedPageButton>Runs</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Events" meta="4 available">
              <WindowedList>
                <div className="wos-page-eyebrow">Agent lifecycle</div>
                <WindowedListItem
                  title="Before agent start"
                  meta="system"
                  detail="Prepare instructions and context"
                  active
                  accent="routines"
                />
                <WindowedListItem title="After agent turn" meta="system" detail="Record status and follow-ups" accent="routines" />
                <div className="wos-page-eyebrow">Tool calls</div>
                <WindowedListItem title="Before tool call" meta="system" detail="Validate risky commands" accent="routines" />
              </WindowedList>
            </WindowedPageSection>

            <WindowedPageSection title="Before" meta="2 routines">
              <WindowedTimeline>
                <WindowedTimelineItem title="Repo context loader" meta="1 · Run prompt" tone="positive">
                  <div className="wos-routine-row">
                    <div className="wos-routine-row__body">
                      <div>Load workspace glossary, repo instructions, and active desktop-mode notes before the agent starts.</div>
                      <div>enabled · gpt-5</div>
                    </div>
                    <div className="wos-routine-row__actions">
                      <WindowedPageButton>Open</WindowedPageButton>
                      <WindowedPageButton>Delete</WindowedPageButton>
                    </div>
                  </div>
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Taste gate" meta="2 · Choose path" tone="warning">
                  <div className="wos-routine-row">
                    <div className="wos-routine-row__body">
                      <div>Route frontend-heavy changes through the design taste checklist before editing.</div>
                      <div>enabled</div>
                    </div>
                    <div className="wos-routine-row__actions">
                      <WindowedPageButton>Open</WindowedPageButton>
                      <WindowedPageButton>Delete</WindowedPageButton>
                    </div>
                  </div>
                  <WindowedList className="wos-routine-path-list">
                    <WindowedListItem
                      title="frontend"
                      meta="Continue"
                      detail="Use design references"
                      accent="routines"
                      status={<WindowedBadge tone="neutral">continue</WindowedBadge>}
                    />
                    <WindowedListItem
                      title="unsafe"
                      meta="Block"
                      detail="Ask for review"
                      accent="routines"
                      status={<WindowedBadge tone="danger">block</WindowedBadge>}
                    />
                  </WindowedList>
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>

            <WindowedPageSection title="After" meta="1 routine">
              <WindowedTimeline>
                <WindowedTimelineItem title="Session handoff" meta="1 · Run prompt" tone="neutral">
                  <div className="wos-routine-row">
                    <div className="wos-routine-row__body">
                      <div>Write a compact handoff when a long-running desktop-mode task changes state.</div>
                      <div>enabled</div>
                    </div>
                    <div className="wos-routine-row__actions">
                      <WindowedPageButton>Open</WindowedPageButton>
                      <WindowedPageButton>Delete</WindowedPageButton>
                    </div>
                  </div>
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>

            <WindowedPageSection title="Status" meta="Repo context loader">
              <WindowedKeyValueList
                items={[
                  { label: 'Owner', value: 'system' },
                  { label: 'Before', value: 2 },
                  { label: 'After', value: 1 },
                  { label: 'Runs', value: 12 },
                  { label: 'Active', value: <WindowedBadge tone="positive">enabled</WindowedBadge> },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
        <WindowedDialog
          title="Repo context loader"
          meta="enabled"
          accent="routines"
          onClose={() => undefined}
          actions={
            <>
              <WindowedPageButton tone="accent">Save</WindowedPageButton>
              <WindowedPageButton>Delete</WindowedPageButton>
            </>
          }
        >
          <div className="wos-routine-editor-bridge">
            <div className="wos-form-grid" data-columns="2">
              <WindowedField label="Type">
                <WindowedSelect defaultValue="instruction" aria-label="Routine type">
                  <option value="instruction">Run prompt</option>
                  <option value="decision">Choose path</option>
                  <option value="stop">Stop event</option>
                </WindowedSelect>
              </WindowedField>
              <WindowedField label="State">
                <WindowedToggle checked accent="routines" label="Toggle Repo context loader" />
              </WindowedField>
              <WindowedField label="Instruction" span="full">
                <WindowedTextarea
                  aria-label="Routine instruction"
                  defaultValue="Load workspace glossary, repo instructions, and active desktop-mode notes before the agent starts."
                />
              </WindowedField>
            </div>
          </div>
        </WindowedDialog>
        <WindowedDialog title="Routine runs" meta="12 total" accent="routines" onClose={() => undefined}>
          <WindowedTimeline>
            <WindowedTimelineItem title="completed" meta="Today, 09:58" tone="positive">
              Loaded repo context and appended active windowed-mode notes.
            </WindowedTimelineItem>
            <WindowedTimelineItem title="skipped" meta="Today, 09:22" tone="neutral">
              No frontend files changed.
            </WindowedTimelineItem>
          </WindowedTimeline>
        </WindowedDialog>
      </WindowFrame>
    </div>
  ),
};

export const WorkflowsPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Workflows"
        accent="routines"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 612 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Workflows"
            actions={
              <>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">New saved workflow</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Inventory" meta="running">
              <WindowedKeyValueList
                items={[
                  { label: 'Runs', value: 4 },
                  { label: 'Saved', value: 3 },
                  { label: 'Templates', value: 5 },
                  { label: 'Active', value: 'repo-audit' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Runs" meta="4 total">
              <WindowedList>
                <WindowedListItem
                  title="Repo audit"
                  meta="review"
                  detail="Updated 2m ago"
                  active
                  accent="routines"
                  status={<WindowedBadge tone="warning">running</WindowedBadge>}
                />
                <WindowedListItem
                  title="Visual regression sweep"
                  meta="/Users/patrick/workingdir/neon-pilot"
                  detail="Completed today"
                  accent="routines"
                  status={<WindowedBadge tone="positive">completed</WindowedBadge>}
                />
                <WindowedListItem
                  title="Extension hardening"
                  meta="verification"
                  detail="Failed yesterday"
                  accent="routines"
                  status={<WindowedBadge tone="danger">failed</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>

            <WindowedPageSection title="Library" meta="8 workflows">
              <WindowedList>
                <WindowedListItem
                  title="Code review fanout"
                  meta="Saved workflow"
                  detail="Review changed files in parallel"
                  accent="routines"
                />
                <WindowedListItem title="Finding validation" meta="Template" detail="Validate each reported issue" accent="routines" />
                <WindowedListItem title="Research synthesis" meta="Template" detail="Explore angles, then summarize" accent="routines" />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
        <WindowedDialog
          title="Repo audit"
          meta="running"
          accent="routines"
          onClose={() => undefined}
          actions={<WindowedPageButton>Cancel</WindowedPageButton>}
        >
          <WindowedKeyValueGrid
            columns={3}
            items={[
              { label: 'Created', value: 'Today, 10:12 AM' },
              { label: 'Updated', value: 'Today, 10:17 AM' },
              { label: 'Active phase', value: 'review' },
              { label: 'Models', value: 'gpt-5.4-mini' },
              { label: 'Agents', value: '3/8 complete, 2 running' },
              { label: 'Completed', value: 'not completed' },
            ]}
          />
          <WindowedList>
            <WindowedListItem
              title="reviewer"
              meta="review · gpt-5.4-mini"
              detail="Inspect changed desktop shell files."
              accent="routines"
              status={<WindowedBadge tone="warning">running</WindowedBadge>}
            />
            <WindowedListItem
              title="visual-check"
              meta="verification · gpt-5.4-mini"
              detail="No horizontal overflow found in the Storybook target."
              accent="routines"
              status={<WindowedBadge tone="positive">completed</WindowedBadge>}
            />
          </WindowedList>
        </WindowedDialog>
      </WindowFrame>
    </div>
  ),
};

export const ModelArenaPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Model Arena"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Model Arena"
            actions={
              <>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">Start duel</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Overview" meta="automatic">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Status', value: <WindowedBadge tone="positive">enabled</WindowedBadge> },
                  { label: 'Active duel', value: 'release-notes-41' },
                  { label: 'Votes', value: 128 },
                  { label: 'Challengers', value: '3 selected' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Active duel" meta="awaiting vote">
              <WindowedList>
                <WindowedListItem
                  title="Primary response"
                  meta="hidden until vote"
                  accent="gateways"
                  status={<WindowedBadge tone="warning">A</WindowedBadge>}
                />
                <WindowedListItem
                  title="Challenger response"
                  meta="hidden until vote"
                  accent="gateways"
                  status={<WindowedBadge tone="warning">B</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>

            <WindowedPageSection title="Rankings" meta="4 models">
              <WindowedDataTable columns={[{ label: 'Model' }, { label: 'Win rate' }, { label: 'Votes', align: 'right' }]}>
                <WindowedDataRow
                  name="gpt-5.4"
                  meta="42 wins / 61 votes"
                  status={<WindowedBadge tone="positive">68.9%</WindowedBadge>}
                  action="61"
                />
                <WindowedDataRow
                  name="claude-sonnet-4.5"
                  meta="31 wins / 52 votes"
                  status={<WindowedBadge tone="neutral">59.6%</WindowedBadge>}
                  action="52"
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Challengers" meta="sampling">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  {
                    label: 'Automatic duels',
                    value: <WindowedToggle checked accent="gateways" label="Toggle automatic duels" />,
                  },
                  { label: 'Sample rate', value: '20%' },
                  { label: 'Prompt windows', value: 'parallel only' },
                  { label: 'Excluded', value: 'image prompts' },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const DiagnosticsPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Diagnostics"
        accent="telemetry"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Diagnostics"
            actions={
              <>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">Export trace</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Health" meta="live">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Store', value: <WindowedBadge tone="positive">ready</WindowedBadge> },
                  { label: 'Retention', value: '14 days' },
                  { label: 'Runs', value: 42 },
                  { label: 'Errors', value: 2 },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Usage" meta="today">
              <WindowedDataTable columns={[{ label: 'Surface' }, { label: 'Events' }, { label: 'Last seen', align: 'right' }]}>
                <WindowedDataRow
                  name="Chat"
                  meta="conversation loop"
                  status={<WindowedBadge tone="positive">1,284</WindowedBadge>}
                  action="2m"
                />
                <WindowedDataRow
                  name="Workbench Browser"
                  meta="native browser view"
                  status={<WindowedBadge tone="neutral">216</WindowedBadge>}
                  action="8m"
                />
                <WindowedDataRow
                  name="Extensions"
                  meta="surface actions"
                  status={<WindowedBadge tone="neutral">89</WindowedBadge>}
                  action="12m"
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Traces" meta="recent">
              <WindowedTimeline>
                <WindowedTimelineItem title="Model Arena duel completed" meta="gpt-5.4 · 1.8s" tone="positive">
                  Captured challenger result and updated the transcript block.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Browser view suspended" meta="windowed shell · 0.1s" tone="neutral">
                  Detached hidden native view while a desktop overlay was active.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Extension action failed" meta="system-browser · retryable" tone="warning">
                  Backend action returned a transient navigation error.
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const ExtensionsPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Extensions"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Extensions"
            actions={
              <>
                <WindowedSegmentedControl
                  ariaLabel="Extensions view"
                  value="installed"
                  options={[
                    { id: 'installed', label: 'Installed' },
                    { id: 'sources', label: 'Sources' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">Install extension</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Inventory" meta="local">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Installed', value: 18 },
                  { label: 'Enabled', value: <WindowedBadge tone="positive">14</WindowedBadge> },
                  { label: 'Updates', value: <WindowedBadge tone="warning">3 pending</WindowedBadge> },
                  { label: 'Sources', value: '2 indexes' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Installed extensions" meta="selected: system-browser">
              <WindowedDataTable columns={[{ label: 'Extension' }, { label: 'State' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow
                  name="system-browser"
                  meta="Workbench browser and browser automation"
                  enabled
                  status={<WindowedBadge tone="warning">update</WindowedBadge>}
                />
                <WindowedDataRow
                  name="system-terminal"
                  meta="Terminal tabs and shell actions"
                  enabled
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                />
                <WindowedDataRow
                  name="system-model-arena"
                  meta="Transcript duels and model comparisons"
                  enabled={false}
                  status={<WindowedBadge tone="neutral">disabled</WindowedBadge>}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Sources" meta="trusted">
              <WindowedList>
                <WindowedListItem
                  title="Built-in system extensions"
                  meta="18 extensions"
                  accent="extensions"
                  status={<WindowedBadge tone="positive">trusted</WindowedBadge>}
                />
                <WindowedListItem
                  title="Personal marketplace"
                  meta="7 extensions"
                  accent="extensions"
                  status={<WindowedBadge tone="neutral">enabled</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>

            <WindowedPageSection title="Review queue" meta="1 item">
              <WindowedList>
                <WindowedListItem
                  title="automation-dashboard"
                  meta="Permission change"
                  accent="extensions"
                  status={<WindowedBadge tone="warning">review</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        <WindowedDialog
          title="system-browser"
          meta="update available"
          accent="extensions"
          onClose={() => undefined}
          actions={
            <>
              <WindowedPageButton>Disable</WindowedPageButton>
              <WindowedPageButton tone="accent">Update</WindowedPageButton>
            </>
          }
        >
          <WindowedKeyValueGrid
            columns={3}
            items={[
              { label: 'Version', value: '0.11.39' },
              { label: 'Surfaces', value: 'Workbench tab' },
              { label: 'State', value: <WindowedBadge tone="warning">update</WindowedBadge> },
              { label: 'Source', value: 'Built-in' },
              { label: 'Permissions', value: 'Browser, network' },
              { label: 'Updated', value: 'Today' },
            ]}
          />
          <WindowedList>
            <WindowedListItem title="Browser page" meta="Main tool panel" accent="extensions" status="active" />
            <WindowedListItem title="Backend action" meta="Snapshot and navigation" accent="extensions" status="enabled" />
          </WindowedList>
        </WindowedDialog>
      </WindowFrame>
    </div>
  ),
};

export const ExtensionsInstallDialog: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 560, padding: 24 }}>
      <WindowFrame
        title="Extensions"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(920px, 100%)', height: 540 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="Extensions" actions={<WindowedPageButton tone="accent">Install</WindowedPageButton>}>
            <WindowedPageSection title="Installed" meta="18">
              <WindowedDataTable columns={[{ label: 'Extension' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
                <WindowedDataRow
                  name="system-browser"
                  meta="Workbench browser and browser automation"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<WindowedPageButton>Details</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        <WindowedDialog
          title="Install extension"
          meta="3 available · 2 sources"
          accent="extensions"
          className="wos-extension-install-dialog"
          onClose={() => undefined}
        >
          <div className="wos-extension-install">
            <WindowedPageSection title="Repositories" meta="2">
              <WindowedToolbar>
                <WindowedTextInput aria-label="Extension repository" placeholder="GitHub URL or owner/name" />
                <WindowedPageButton>Add</WindowedPageButton>
              </WindowedToolbar>
              <WindowedDataTable columns={[{ label: 'Source' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
                <WindowedDataRow
                  name="Personal marketplace"
                  meta="patrick/extensions"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<WindowedPageButton>Remove</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="Neon Pilot"
                  meta="neon-pilot/extensions"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<span aria-hidden="true" />}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Available" meta="3">
              <WindowedToolbar>
                <WindowedTextInput aria-label="Search available extensions" placeholder="Search extensions" />
              </WindowedToolbar>
              <WindowedDataTable columns={[{ label: 'Extension' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
                <WindowedDataRow
                  name="agent-browser"
                  meta="Browser automation surface"
                  status={<WindowedBadge tone="neutral">available</WindowedBadge>}
                  action={<WindowedPageButton>Install</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="workflow-reports"
                  meta="Run summaries and reporting"
                  status={<WindowedBadge tone="warning">planned</WindowedBadge>}
                  action={<WindowedPageButton disabled>Install</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </div>
        </WindowedDialog>
      </WindowFrame>
    </div>
  ),
};

export const SkillsPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="Skills"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Browse skills"
            actions={
              <>
                <WindowedSegmentedControl
                  ariaLabel="Skills view"
                  accent="extensions"
                  value="marketplace"
                  options={[
                    { id: 'marketplace', label: 'Browse 27' },
                    { id: 'installed', label: 'Installed 12' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Sources" meta="3 sources">
              <WindowedKeyValueList
                items={[
                  { label: 'Trusted', value: '2' },
                  { label: 'Community', value: '1' },
                  { label: 'Refresh', value: 'Ready' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection>
              <WindowedToolbar as="form" formProps={{ onSubmit: (event) => event.preventDefault() }}>
                <WindowedTextInput
                  aria-label="Search marketplace skills"
                  placeholder="Search marketplace skills"
                  className="min-w-48 flex-1"
                />
                <WindowedPageButton>Clear</WindowedPageButton>
                <WindowedPageButton tone="accent" type="submit">
                  Search
                </WindowedPageButton>
              </WindowedToolbar>
            </WindowedPageSection>

            <WindowedPageSection>
              <div className="grid min-w-0 gap-2 md:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-secondary">
                  Capability
                  <WindowedSelect aria-label="Filter by capability" defaultValue="all">
                    <option value="all">All</option>
                    <option value="coding">Coding</option>
                    <option value="qa">QA</option>
                    <option value="research">Research</option>
                  </WindowedSelect>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-secondary">
                  Source
                  <WindowedSelect aria-label="Filter by source" defaultValue="openai">
                    <option value="all">All</option>
                    <option value="openai">OpenAI Skills</option>
                    <option value="curated">Curated</option>
                    <option value="community">Community</option>
                  </WindowedSelect>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-secondary">
                  State
                  <WindowedSelect aria-label="Filter by state" defaultValue="all">
                    <option value="all">All</option>
                    <option value="available">Available</option>
                    <option value="approval-required">Approval required</option>
                    <option value="installed">Installed</option>
                  </WindowedSelect>
                </label>
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Marketplace" meta="27 skills">
              <WindowedDataTable columns={[{ label: 'Skill' }, { label: 'State' }, { label: 'Action', align: 'right' }]}>
                <WindowedDataRow
                  name="code-review"
                  meta="Review · OpenAI Skills · Trusted"
                  status={<WindowedBadge tone="positive">Installed</WindowedBadge>}
                  action={
                    <span className="flex items-center justify-end gap-2">
                      <WindowedPageButton disabled>Installed</WindowedPageButton>
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="local-qa"
                  meta="QA · Agent plugin · Trusted"
                  status={<WindowedBadge tone="neutral">Available</WindowedBadge>}
                  action={
                    <span className="flex items-center justify-end gap-2">
                      <WindowedPageButton tone="accent">Install</WindowedPageButton>
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="ios-debugger-agent"
                  meta="iOS · Curated · Trusted"
                  status={<WindowedBadge tone="warning">Approval required</WindowedBadge>}
                  action={
                    <span className="flex items-center justify-end gap-2">
                      <WindowedPageButton tone="accent">Install</WindowedPageButton>
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Installed" meta="9 enabled · 3 disabled">
              <WindowedDataTable columns={[{ label: 'Skill' }, { label: 'State' }, { label: 'Controls', align: 'right' }]}>
                <WindowedDataRow
                  name="design"
                  meta="Frontend polish and product UI review"
                  enabled
                  status={<WindowedBadge tone="positive">Enabled</WindowedBadge>}
                  action={
                    <span className="flex items-center justify-end gap-2">
                      <WindowedToggle checked accent="extensions" label="Disable design" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="zotero"
                  meta="Connector · citation workflow"
                  enabled={false}
                  status={<WindowedBadge tone="neutral">Disabled</WindowedBadge>}
                  action={
                    <span className="flex items-center justify-end gap-2">
                      <WindowedToggle accent="extensions" label="Enable zotero" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
        <WindowedDialog title="local-qa" meta="Marketplace skill" accent="extensions" onClose={() => undefined}>
          <div className="grid gap-3">
            <p className="text-[12px] leading-5 text-secondary">Browser and app checks for local product QA.</p>
            <WindowedKeyValueList
              items={[
                { label: 'Capability', value: 'QA' },
                { label: 'Source', value: 'Agent plugin' },
                { label: 'Trust', value: 'Trusted' },
                { label: 'State', value: 'Available' },
                { label: 'Identifier', value: 'agent-plugin:local-qa' },
              ]}
            />
          </div>
        </WindowedDialog>
      </WindowFrame>
    </div>
  ),
};

export const CoreDataPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Extensions"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(760px, 100%)', height: 430 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageMain title="Extensions" actions={<WindowedPageButton tone="accent">New</WindowedPageButton>}>
          <WindowedPageSection title="Installed" meta="3 enabled">
            <WindowedDataTable columns={[{ label: 'Extension' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
              <WindowedDataRow name="GitHub Sync" meta="Chat tool · Skill" enabled />
              <WindowedDataRow name="Voice Mode" meta="Chat tool" enabled />
              <WindowedDataRow name="Web Search" meta="Chat tool · Skill" enabled={false} />
            </WindowedDataTable>
          </WindowedPageSection>
        </WindowedPageMain>
      </WindowFrame>
    </div>
  ),
};

export const EmbeddedExtensionPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 680, padding: 24 }}>
      <WindowFrame
        title="Gateways"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Telegram"
            actions={
              <>
                <WindowedPageButton>Test</WindowedPageButton>
                <WindowedPageButton tone="accent">Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Status" meta="Needs attention">
              <WindowedKeyValueGrid
                items={[
                  { label: 'Token', value: 'Configured' },
                  { label: 'Connection', value: 'Configured' },
                  { label: 'Runtime', value: <WindowedBadge tone="warning">Needs attention</WindowedBadge> },
                  { label: 'Setup', value: '/gateways' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Bot token">
              <div className="wos-form-grid" data-columns="2">
                <WindowedField label="Token">
                  <WindowedTextInput aria-label="Telegram bot token" placeholder="Token is already saved" />
                </WindowedField>
                <WindowedField label="Gateway">
                  <WindowedToggle checked accent="gateways" label="Toggle Telegram gateway" />
                </WindowedField>
              </div>
              <div className="wos-form-actions">
                <WindowedPageButton>Remove token</WindowedPageButton>
                <WindowedPageButton tone="accent">Save token</WindowedPageButton>
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Telegram access" meta="Allowlist">
              <WindowedKeyValueList
                items={[
                  { label: 'Approved users', value: '1191448898' },
                  { label: 'Approved chats', value: 'No approved chats yet.' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Recent activity">
              <WindowedTimeline>
                <WindowedTimelineItem title="Runtime check failed" meta="2m ago" tone="warning">
                  Telegram polling appears to be handled by another process.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Token verified" meta="Today" tone="positive">
                  Bot token was accepted by Telegram.
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};
