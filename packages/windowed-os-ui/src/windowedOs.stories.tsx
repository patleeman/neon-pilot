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

export const DesktopComposition: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 720 }}>
      <main className="wos-desktop" style={{ height: 678 }}>
        <StartMenu
          open
          items={[
            { id: 'chat', title: 'Chat', accent: 'chat', onSelect: () => undefined },
            { id: 'automations', title: 'Automations', accent: 'automations', onSelect: () => undefined },
            { id: 'gateways', title: 'Gateways', accent: 'gateways', onSelect: () => undefined },
            { id: 'settings', title: 'Settings', accent: 'settings', onSelect: () => undefined },
          ]}
        />
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
        <WindowedPageShell layout="two-column">
          <WindowedPageRail title="Gateways" accent="gateways">
            <WindowedPageSection title="Providers" meta="2 enabled">
              <WindowedDataTable columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow name="Telegram" meta="Gateway" enabled status={<WindowedBadge tone="positive">Enabled</WindowedBadge>} />
                <WindowedDataRow name="Local tools" meta="Runtime" enabled={false} />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageRail>
          <WindowedPageMain
            eyebrow="Gateway"
            title="Telegram"
            description="Only approved users and chats can send work into Neon Pilot."
            actions={<WindowedPageButton tone="accent">Refresh</WindowedPageButton>}
          >
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
        <WindowedPageShell layout="two-column">
          <WindowedPageRail title="Applications" accent="extensions">
            <WindowedPageSection title="Pages" meta="Dense">
              <WindowedList>
                <WindowedListItem title="Chat" meta="Threads" detail="Workbench attached" accent="chat" />
                <WindowedListItem title="Automations" meta="Scheduled runs" detail="3 enabled" accent="automations" />
                <WindowedListItem title="Gateways" meta="Ingress" detail="Telegram ready" active accent="gateways" />
                <WindowedListItem title="Routines" meta="Hooks" detail="Before and after" accent="routines" />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageRail>

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

            <WindowedPageSection title="Hosted stable primitives" meta="Scoped">
              <div className="wos-window-route-body" style={{ height: 'auto', minHeight: 0 }}>
                <div className="ui-app-page-shell">
                  <main className="ui-app-page-main">
                    <section className="ui-app-page-intro">
                      <div style={{ minWidth: 0 }}>
                        <div className="ui-app-page-eyebrow">Extension page</div>
                        <h1 className="ui-app-page-title">Embedded route</h1>
                        <p className="ui-app-page-summary">Stable components inherit the windowed OS text and spacing scale.</p>
                      </div>
                      <button type="button" className="ui-action-button">
                        Refresh
                      </button>
                    </section>
                    <section style={{ display: 'grid', gap: 8 }}>
                      <div className="ui-key-value-table ui-key-value-table-3">
                        <div className="ui-key-value-table-item">
                          <p className="ui-key-value-table-label">Token</p>
                          <p className="ui-key-value-table-value">Configured</p>
                        </div>
                        <div className="ui-key-value-table-item">
                          <p className="ui-key-value-table-label">Connection</p>
                          <p className="ui-key-value-table-value">Ready</p>
                        </div>
                        <div className="ui-key-value-table-item">
                          <p className="ui-key-value-table-label">Runtime</p>
                          <p className="ui-key-value-table-value">Healthy</p>
                        </div>
                      </div>
                    </section>
                  </main>
                </div>
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
        <WindowedPageShell>
          <WindowedPageRail title="Automations" accent="automations">
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
          </WindowedPageRail>
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
        <WindowedPageShell>
          <WindowedPageRail title="Routines" accent="routines">
            <WindowedPageSection title="Hooks" meta="4">
              <WindowedList>
                <WindowedListItem title="before_agent_start" meta="3 routines" detail="Instruction context" active accent="routines" />
                <WindowedListItem title="after_agent_turn" meta="2 routines" detail="Status bookkeeping" accent="routines" />
                <WindowedListItem title="before_tool_call" meta="1 routine" detail="Safety checks" accent="routines" />
                <WindowedListItem title="after_tool_call" meta="No routines" detail="Available" accent="routines" />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageRail>
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
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1120px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body">
          <div style={{ display: 'flex', height: '100%', minHeight: 0, background: 'rgb(var(--color-base))' }}>
            <main style={{ minWidth: 0, flex: '1 1 auto', overflow: 'auto' }}>
              <div className="ui-app-page-shell">
                <div className="ui-app-page-main">
                  <section className="ui-app-page-intro">
                    <div style={{ minWidth: 0 }}>
                      <div className="ui-app-page-eyebrow">Gateway</div>
                      <h1 className="ui-app-page-title">Telegram</h1>
                      <div className="ui-app-page-summary">Only approved users and chats can send work into Neon Pilot.</div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="ui-icon-button ui-icon-button-compact" aria-label="Test Telegram bot">
                        OK
                      </button>
                      <button type="button" className="ui-icon-button ui-icon-button-compact" aria-label="Refresh gateways">
                        R
                      </button>
                    </div>
                  </section>

                  <section style={{ display: 'grid', gap: 18 }}>
                    <div className="border-b border-border-subtle" style={{ paddingBottom: 18 }}>
                      <div
                        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
                      >
                        <div style={{ minWidth: 0, flex: '1 1 320px', display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
                            <span className="ui-status-dot ui-status-dot-sm ui-status-dot-warning" />
                            <h2 style={{ margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Telegram
                            </h2>
                          </div>
                          <div className="ui-key-value-table ui-key-value-table-3">
                            {['Token', 'Connection', 'Runtime'].map((label) => (
                              <div key={label} className="ui-key-value-table-item">
                                <p className="ui-key-value-table-label">{label}</p>
                                <p className="ui-key-value-table-value">{label === 'Runtime' ? 'Needs attention' : 'Configured'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <label
                          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(var(--color-secondary))', fontSize: 13 }}
                        >
                          <span>Enabled</span>
                          <button type="button" role="switch" aria-checked={true} className="ui-switch ui-switch-checked">
                            <span className="ui-switch-track" aria-hidden="true">
                              <span className="ui-switch-thumb" />
                            </span>
                          </button>
                        </label>
                      </div>
                    </div>

                    <div className="border-b border-border-subtle" style={{ paddingBottom: 18 }}>
                      <h2 style={{ margin: 0 }}>Bot token</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                        <input className="ui-text-input" aria-label="Telegram bot token" placeholder="Token is already saved" />
                        <button type="button" className="ui-action-button text-danger">
                          Remove token
                        </button>
                      </div>
                    </div>

                    <div style={{ paddingBottom: 18 }}>
                      <h2 style={{ margin: 0 }}>Telegram access</h2>
                      <p style={{ color: 'rgb(var(--color-secondary))', fontSize: 13 }}>
                        Only approved users and chats can send work to Neon Pilot.
                      </p>
                      <div className="ui-key-value-list" style={{ marginTop: 14 }}>
                        <div className="ui-key-value-item">
                          <p className="ui-key-value-label">Approved users</p>
                          <p className="ui-key-value-value">1191448898</p>
                        </div>
                        <div className="ui-key-value-item">
                          <p className="ui-key-value-label">Approved chats</p>
                          <p className="ui-key-value-value">No approved chats yet.</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </main>
            <aside style={{ width: 280, minHeight: 0, flex: '0 0 280px', overflow: 'hidden' }}>
              <div className="ui-context-rail">
                <div className="ui-context-rail-header">
                  <div className="ui-context-rail-header-copy">
                    <span className="ui-section-label ui-section-label-accent">Gateway status</span>
                    <h2 className="ui-context-rail-title">Telegram</h2>
                    <div className="ui-context-rail-subtitle">Needs attention</div>
                  </div>
                </div>
                <div className="ui-context-rail-body">
                  <section className="ui-context-rail-section">
                    <div className="ui-context-rail-section-header">
                      <span className="ui-section-label ui-section-label-accent">Status</span>
                      <span className="ui-status-dot ui-status-dot-xs ui-status-dot-warning" />
                    </div>
                    <div className="ui-context-rail-section-body">
                      <div className="ui-key-value-list">
                        <div className="ui-key-value-item">
                          <p className="ui-key-value-label">Setup</p>
                          <p className="ui-key-value-value">/gateways</p>
                        </div>
                        <div className="ui-key-value-item">
                          <p className="ui-key-value-label">Configuration</p>
                          <p className="ui-key-value-value">Gateways page</p>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="ui-context-rail-section">
                    <div className="ui-context-rail-section-header">
                      <span className="ui-section-label ui-section-label-accent">Recent activity</span>
                    </div>
                    <div className="ui-context-rail-section-body">No Telegram gateway events yet.</div>
                  </section>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </WindowFrame>
    </div>
  ),
};
