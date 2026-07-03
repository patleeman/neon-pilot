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
                <WindowedSegmentedControl
                  ariaLabel="Automation filter"
                  accent="automations"
                  value="active"
                  options={[
                    { id: 'active', label: 'Active' },
                    { id: 'paused', label: 'Paused' },
                    { id: 'all', label: 'All' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Run selected</WindowedPageButton>
                <WindowedPageButton tone="accent">New automation</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Queue" meta="live">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Enabled', value: <WindowedBadge tone="positive">5</WindowedBadge> },
                  { label: 'Due today', value: 3 },
                  { label: 'Running', value: <WindowedBadge tone="warning">1</WindowedBadge> },
                  { label: 'Paused', value: 2 },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Automations" meta="selected: Release watch">
              <WindowedDataTable columns={[{ label: 'Automation' }, { label: 'Next run' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow
                  name="Release watch"
                  meta="Summarize merged changes"
                  enabled
                  status={<WindowedBadge tone="positive">09:00</WindowedBadge>}
                />
                <WindowedDataRow
                  name="Dependency audit"
                  meta="Check package drift"
                  enabled
                  status={<WindowedBadge tone="warning">running</WindowedBadge>}
                />
                <WindowedDataRow
                  name="Inbox sweep"
                  meta="Group follow-up threads"
                  enabled={false}
                  status={<WindowedBadge tone="neutral">paused</WindowedBadge>}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Selected automation" meta="Release watch">
              <div className="wos-form-grid" data-columns="3">
                <WindowedField label="Schedule">
                  <WindowedTextInput defaultValue="0 9 * * 1-5" aria-label="Automation schedule" />
                </WindowedField>
                <WindowedField label="Timezone">
                  <WindowedTextInput defaultValue="America/New_York" aria-label="Automation timezone" />
                </WindowedField>
                <WindowedField label="Model">
                  <WindowedSelect defaultValue="gpt-5" aria-label="Automation model">
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 mini</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="Instruction" span="full">
                  <WindowedTextarea
                    aria-label="Automation instruction"
                    defaultValue="Draft release notes from merged work and append them to the Release notes chat."
                  />
                </WindowedField>
              </div>
              <div className="wos-form-actions">
                <WindowedPageButton>Reset</WindowedPageButton>
                <WindowedPageButton tone="accent">Apply changes</WindowedPageButton>
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
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
                <WindowedSegmentedControl
                  ariaLabel="Gateway filter"
                  accent="gateways"
                  value="enabled"
                  options={[
                    { id: 'enabled', label: 'Enabled' },
                    { id: 'paused', label: 'Paused' },
                    { id: 'all', label: 'All' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">New gateway</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Status" meta="runtime">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Enabled', value: <WindowedBadge tone="positive">2</WindowedBadge> },
                  { label: 'Inbound today', value: 48 },
                  { label: 'Pending approvals', value: <WindowedBadge tone="warning">3</WindowedBadge> },
                  { label: 'Failed', value: 0 },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Gateways" meta="selected: Telegram">
              <WindowedDataTable columns={[{ label: 'Gateway' }, { label: 'State' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow
                  name="Telegram"
                  meta="Bot token saved · allowlist"
                  enabled
                  status={<WindowedBadge tone="positive">polling</WindowedBadge>}
                />
                <WindowedDataRow
                  name="Local webhook"
                  meta="http://127.0.0.1:8787"
                  enabled
                  status={<WindowedBadge tone="neutral">idle</WindowedBadge>}
                />
                <WindowedDataRow
                  name="Email digest"
                  meta="Needs credential"
                  enabled={false}
                  status={<WindowedBadge tone="warning">setup</WindowedBadge>}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Selected gateway" meta="Telegram">
              <div className="wos-form-grid" data-columns="3">
                <WindowedField label="Mode">
                  <WindowedSelect defaultValue="allowlist" aria-label="Gateway mode">
                    <option value="allowlist">Allowlist</option>
                    <option value="private">Private</option>
                    <option value="open">Open</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="Default model">
                  <WindowedSelect defaultValue="gpt-5" aria-label="Default gateway model">
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 mini</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="State">
                  <WindowedSegmentedControl
                    ariaLabel="Gateway state"
                    accent="gateways"
                    value="on"
                    options={[
                      { id: 'on', label: 'On' },
                      { id: 'paused', label: 'Paused' },
                    ]}
                    onChange={() => undefined}
                  />
                </WindowedField>
                <WindowedField label="Instruction" span="full">
                  <WindowedTextarea
                    aria-label="Gateway instruction"
                    defaultValue="Create or resume a chat for approved Telegram messages and attach inbound media to the workbench."
                  />
                </WindowedField>
              </div>
              <div className="wos-form-actions">
                <WindowedPageButton>Rotate token</WindowedPageButton>
                <WindowedPageButton tone="accent">Apply changes</WindowedPageButton>
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
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
            title="Routines"
            actions={
              <>
                <WindowedSegmentedControl
                  accent="routines"
                  ariaLabel="Routine scope"
                  value="repo"
                  options={[
                    { id: 'repo', label: 'Repo' },
                    { id: 'global', label: 'Global' },
                    { id: 'all', label: 'All' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton tone="accent">New routine</WindowedPageButton>
              </>
            }
          >
            <div className="wos-page-grid" data-columns="2">
              <div className="wos-page-stack">
                <WindowedPageSection title="Overview" meta="workspace">
                  <WindowedKeyValueGrid
                    columns={4}
                    items={[
                      { label: 'Hooks', value: 4 },
                      { label: 'Enabled', value: <WindowedBadge tone="positive">6</WindowedBadge> },
                      { label: 'Paused', value: <WindowedBadge>1</WindowedBadge> },
                      { label: 'Failures', value: <WindowedBadge tone="warning">1</WindowedBadge> },
                    ]}
                  />
                </WindowedPageSection>

                <WindowedPageSection title="Hooks" meta="4">
                  <WindowedList>
                    <WindowedListItem title="before_agent_start" meta="3 routines" detail="Instruction context" active accent="routines" />
                    <WindowedListItem title="after_agent_turn" meta="2 routines" detail="Status bookkeeping" accent="routines" />
                    <WindowedListItem title="before_tool_call" meta="1 routine" detail="Safety checks" accent="routines" />
                  </WindowedList>
                </WindowedPageSection>
              </div>

              <div className="wos-page-stack">
                <WindowedPageSection title="Selected routine" meta="Repo context loader">
                  <div className="wos-form-grid" data-columns="3">
                    <WindowedField label="Mode">
                      <WindowedSegmentedControl
                        accent="routines"
                        ariaLabel="Routine position"
                        value="before"
                        options={[
                          { id: 'before', label: 'Before' },
                          { id: 'after', label: 'After' },
                        ]}
                      />
                    </WindowedField>
                    <WindowedField label="Routine">
                      <WindowedSelect defaultValue="repo-context" aria-label="Selected routine">
                        <option value="repo-context">Repo context</option>
                        <option value="taste">Taste checklist</option>
                        <option value="handoff">Session handoff</option>
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
                  <div className="wos-form-actions">
                    <WindowedPageButton>Test routine</WindowedPageButton>
                    <WindowedPageButton tone="accent">Apply changes</WindowedPageButton>
                  </div>
                </WindowedPageSection>

                <WindowedPageSection title="Recent runs" meta="Last 24h">
                  <WindowedDataTable columns={[{ label: 'Run' }, { label: 'Hook' }, { label: 'State', align: 'right' }]}>
                    <WindowedDataRow
                      name="Loaded repo context"
                      meta="09:58"
                      enabled
                      status={<WindowedBadge tone="positive">ok</WindowedBadge>}
                    />
                    <WindowedDataRow name="Taste checklist skipped" meta="09:22" enabled status={<WindowedBadge>skipped</WindowedBadge>} />
                    <WindowedDataRow
                      name="Recovered stale handoff"
                      meta="Yesterday"
                      enabled
                      status={<WindowedBadge tone="warning">review</WindowedBadge>}
                    />
                  </WindowedDataTable>
                </WindowedPageSection>
              </div>
            </div>
          </WindowedPageMain>
        </WindowedPageShell>
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
            title="Skills"
            actions={
              <>
                <WindowedSegmentedControl
                  ariaLabel="Skills view"
                  value="installed"
                  options={[
                    { value: 'installed', label: 'Installed' },
                    { value: 'marketplace', label: 'Marketplace' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Inventory" meta="ready">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Installed', value: 12 },
                  { label: 'Enabled', value: <WindowedBadge tone="positive">9</WindowedBadge> },
                  { label: 'Sources', value: '3 indexes' },
                  { label: 'Updates', value: <WindowedBadge tone="warning">2 pending</WindowedBadge> },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Installed skills" meta="12 total">
              <WindowedDataTable columns={[{ label: 'Skill' }, { label: 'State' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow
                  name="code-review"
                  meta="OpenAI Skills · repository review"
                  enabled
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                />
                <WindowedDataRow
                  name="local-qa"
                  meta="Agent plugin · browser and app checks"
                  enabled
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                />
                <WindowedDataRow
                  name="zotero"
                  meta="Connector · citation workflow"
                  enabled={false}
                  status={<WindowedBadge tone="neutral">disabled</WindowedBadge>}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Marketplace" meta="recommended">
              <WindowedList>
                <WindowedListItem
                  title="cloudflare-workers"
                  meta="OpenAI Skills"
                  detail="Workers, Durable Objects, and deploy workflow guidance."
                  accent="extensions"
                  status={<WindowedBadge tone="neutral">available</WindowedBadge>}
                />
                <WindowedListItem
                  title="ios-debugger-agent"
                  meta="Curated"
                  detail="Simulator build, run, screenshots, and log capture."
                  accent="extensions"
                  status={<WindowedBadge tone="warning">review</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
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
