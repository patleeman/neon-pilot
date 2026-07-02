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
            eyebrow="Gateway"
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
          <WindowedPageMain
            eyebrow="Scheduled work"
            title="Automations"
            actions={<WindowedPageButton tone="accent">New automation</WindowedPageButton>}
          >
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
            eyebrow="Desktop OS"
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
            eyebrow="Automation"
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

export const RoutinesListDetailPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 700, padding: 24 }}>
      <WindowFrame
        title="Routines"
        accent="routines"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1080px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            eyebrow="Hook"
            title="before_agent_start"
            actions={
              <>
                <WindowedPageButton>Disable hook</WindowedPageButton>
                <WindowedPageButton tone="accent">New routine</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Hooks" meta="4">
              <WindowedList>
                <WindowedListItem title="before_agent_start" meta="3 routines" detail="Instruction context" active accent="routines" />
                <WindowedListItem title="after_agent_turn" meta="2 routines" detail="Status bookkeeping" accent="routines" />
                <WindowedListItem title="before_tool_call" meta="1 routine" detail="Safety checks" accent="routines" />
                <WindowedListItem title="after_tool_call" meta="No routines" detail="Available" accent="routines" />
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Position" meta="3 routines">
              <div className="wos-form-grid" data-columns="2">
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
                <WindowedField label="Selected routine">
                  <WindowedSelect defaultValue="repo-context" aria-label="Selected routine">
                    <option value="repo-context">Repo context loader</option>
                    <option value="taste">Taste checklist</option>
                    <option value="handoff">Session handoff</option>
                  </WindowedSelect>
                </WindowedField>
              </div>
            </WindowedPageSection>
            <WindowedPageSection title="Routine stack" meta="Before agent">
              <WindowedList>
                <WindowedListItem
                  title="Repo context loader"
                  meta="Runs first"
                  detail="Loads glossary, repo rules, and active workspace notes"
                  active
                  accent="routines"
                  status={<WindowedBadge tone="positive">On</WindowedBadge>}
                />
                <WindowedListItem
                  title="Taste checklist"
                  meta="Runs second"
                  detail="Adds UI evaluation reminders when editing app surfaces"
                  accent="routines"
                  status={<WindowedBadge tone="positive">On</WindowedBadge>}
                />
                <WindowedListItem
                  title="Session handoff"
                  meta="Runs third"
                  detail="Summarizes state when context is compacted"
                  accent="routines"
                  status={<WindowedBadge>Paused</WindowedBadge>}
                />
              </WindowedList>
            </WindowedPageSection>
            <WindowedPageSection title="Recent runs" meta="Last 24h">
              <WindowedTimeline>
                <WindowedTimelineItem title="Loaded repo context" meta="09:58" tone="positive">
                  Applied Neon Pilot route and extension boundary rules.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Skipped taste checklist" meta="09:22">
                  No user-visible UI files were edited in that turn.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Recovered stale handoff" meta="Yesterday" tone="warning">
                  Reconciled compacted notes with the current git status.
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>
            <WindowedPageSection title="Status">
              <WindowedKeyValueList
                items={[
                  { label: 'Hook', value: 'before_agent_start' },
                  { label: 'Order', value: '1' },
                  { label: 'State', value: <WindowedBadge tone="positive">Enabled</WindowedBadge> },
                  {
                    label: 'Auto-run',
                    value: <WindowedToggle checked accent="routines" label="Toggle Repo context loader" />,
                  },
                ]}
              />
            </WindowedPageSection>
            <WindowedPageSection title="Scope">
              <WindowedKeyValueList
                items={[
                  { label: 'Applies to', value: 'Neon Pilot repo' },
                  { label: 'Source', value: 'Workspace rules' },
                ]}
              />
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
            eyebrow="Gateway"
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
