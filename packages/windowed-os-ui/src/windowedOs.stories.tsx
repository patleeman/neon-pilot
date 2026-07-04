import type { Meta, StoryObj } from '@storybook/react';

import {
  CANONICAL_WINDOWED_DESKTOP_APPS,
  StartMenu,
  Taskbar,
  WindowedAppTile,
  WindowedBadge,
  WindowedChartPanel,
  WindowedChatComposer,
  WindowedChatMain,
  WindowedChatSurface,
  WindowedDataRow,
  WindowedDataTable,
  WindowedDialog,
  WindowedDialogCopy,
  WindowedDialogStack,
  WindowedEmptyState,
  WindowedField,
  WindowedFormActions,
  WindowedFormGrid,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedList,
  WindowedListItem,
  WindowedMenuPanel,
  WindowedMessageBubble,
  WindowedNumberStepper,
  WindowedPageButton,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageSection,
  WindowedPageShell,
  WindowedSegmentedControl,
  WindowedSelect,
  WindowedSettingsGroup,
  WindowedSettingsRow,
  WindowedStateBlock,
  WindowedTerminalFrame,
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

const canonicalDesktopApps = CANONICAL_WINDOWED_DESKTOP_APPS;

function StoryToolbarIcon({ name }: { name: 'browser' | 'terminal' | 'workbench-visible' }) {
  const paths = {
    browser: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14" />
        <path d="M12 5a10 10 0 0 1 0 14" />
        <path d="M12 5a10 10 0 0 0 0 14" />
      </>
    ),
    terminal: (
      <>
        <path d="m6 8 4 4-4 4" />
        <path d="M12 16h6" />
      </>
    ),
    'workbench-visible': (
      <>
        <rect x="4" y="5" width="16" height="14" rx="1.5" />
        <path d="M13 5v14" />
        <path d="m10 9-4 3 4 3" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

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
        trailing={
          <>
            <button type="button" className="wos-page-button" data-tone="neutral">
              Caffeinate
            </button>
            <button type="button" className="wos-page-button" data-tone="neutral">
              Readiness
            </button>
          </>
        }
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

function AttachedWorkbenchStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 700, padding: 24 }}>
      <WindowFrame
        title={theme === 'dark' ? 'Release notes — dark' : 'Release notes'}
        accent="chat"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1180px, 100%)', height: 640 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body wos-window-route-body--chat">
          <div className="wos-chat-window-toolbar" aria-label="Chat window controls">
            <div className="wos-chat-window-toolbar__label">Workbench</div>
            <div className="wos-chat-window-toolbar__actions">
              <button
                type="button"
                className="wos-chat-window-toolbar__button"
                data-density="icon"
                aria-label="Hide workbench"
                title="Hide workbench"
                aria-pressed="false"
              >
                <StoryToolbarIcon name="workbench-visible" />
              </button>
              <button
                type="button"
                className="wos-chat-window-toolbar__button"
                data-density="icon"
                aria-label="Open Browser window"
                title="Open Browser window"
              >
                <StoryToolbarIcon name="browser" />
              </button>
              <button
                type="button"
                className="wos-chat-window-toolbar__button"
                data-density="icon"
                aria-label="Open Terminal window"
                title="Open Terminal window"
              >
                <StoryToolbarIcon name="terminal" />
              </button>
            </div>
          </div>
          <div className="wos-chat-workbench">
            <WindowedChatSurface>
              <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
                <WindowedMessageBubble from="user">Draft the changelog for v0.11.39.</WindowedMessageBubble>
                <WindowedMessageBubble>Reading the current branch and grouping changes by extension.</WindowedMessageBubble>
                <WindowedMessageBubble from="user">
                  Keep it compact and include blockers only when action is required.
                </WindowedMessageBubble>
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
        </div>
      </WindowFrame>
    </div>
  );
}

export const ChatWithAttachedWorkbench: Story = {
  render: () => <AttachedWorkbenchStory />,
};

export const DarkChatWithAttachedWorkbench: Story = {
  render: () => <AttachedWorkbenchStory theme="dark" />,
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

export const ThemeVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', minHeight: 520 }}>
      {[
        { mode: 'light', resolved: 'light', phase: 'bright-noon', title: 'Light desktop' },
        { mode: 'auto', resolved: 'dark', phase: 'dusk', title: 'Time of day dusk desktop' },
        { mode: 'dark', resolved: 'dark', phase: 'night', title: 'Dark desktop' },
      ].map((theme) => (
        <div
          key={theme.mode}
          className="windowed-os-shell"
          data-wos-theme={theme.resolved}
          data-wos-theme-mode={theme.mode}
          data-wos-theme-phase={theme.phase}
          style={{ minHeight: 520, padding: 18 }}
        >
          <WindowFrame
            title={theme.title}
            accent="chat"
            focused={theme.mode === 'light'}
            style={{ position: 'relative', left: 0, top: 0, width: '100%', height: 420 }}
            onMinimize={() => undefined}
            onMaximize={() => undefined}
            onClose={() => undefined}
          >
            <WindowedPageShell layout="standard">
              <WindowedPageMain title="Theme tokens" actions={<WindowedPageButton tone="accent">Apply</WindowedPageButton>}>
                <WindowedPageSection title="Apps" meta="Shared accents">
                  <WindowedDataTable columns={[{ label: 'App' }, { label: 'State' }, { label: 'Enabled', align: 'right' }]}>
                    <WindowedDataRow
                      name="Chat"
                      meta="Conversation window"
                      enabled
                      status={<WindowedBadge tone="positive">Open</WindowedBadge>}
                    />
                    <WindowedDataRow
                      name="Automations"
                      meta="Schedule runner"
                      enabled={false}
                      status={<WindowedBadge tone="warning">Paused</WindowedBadge>}
                    />
                  </WindowedDataTable>
                </WindowedPageSection>
                <WindowedPageSection title="Controls">
                  <WindowedToolbar
                    end={
                      <>
                        <WindowedToggle checked accent="chat" label={`${theme.mode} theme toggle`} />
                        <WindowedPageButton>Reset</WindowedPageButton>
                      </>
                    }
                  >
                    <WindowedSegmentedControl
                      ariaLabel={`${theme.mode} theme mode`}
                      value={theme.mode}
                      options={[
                        { id: 'light', label: 'Light' },
                        { id: 'auto', label: 'Time' },
                        { id: 'dark', label: 'Dark' },
                      ]}
                    />
                  </WindowedToolbar>
                </WindowedPageSection>
              </WindowedPageMain>
            </WindowedPageShell>
          </WindowFrame>
          <Taskbar
            startOpen={false}
            onToggleStart={() => undefined}
            items={[
              { id: `${theme.mode}-chat`, title: 'Chat', accent: 'chat', focused: true, onSelect: () => undefined },
              { id: `${theme.mode}-settings`, title: 'Settings', accent: 'settings', onSelect: () => undefined },
            ]}
          />
        </div>
      ))}
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
          <WindowedPageMain title="Telegram" actions={<WindowedPageButton tone="accent">Refresh</WindowedPageButton>}>
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
                <WindowedEmptyState>Marketplace results appear after the first source sync.</WindowedEmptyState>
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
                <WindowedStateBlock
                  tone="danger"
                  title="Trace data could not be loaded"
                  action={<WindowedPageButton>Try again</WindowedPageButton>}
                >
                  Check diagnostics storage, then retry the load.
                </WindowedStateBlock>
              </div>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

export const ChartPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Diagnostics"
        accent="diagnostics"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(960px, 100%)', height: 460 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="Diagnostics">
            <WindowedPageSection title="Usage" meta="Shared chart chrome">
              <WindowedChartPanel title="Token Activity" meta="24H · 1.4M total · 58K avg" className="wos-heatmap">
                <div className="wos-heatmap-grid" aria-hidden="true">
                  {Array.from({ length: 12 }).map((_, week) => (
                    <div key={week} className="wos-heatmap-week">
                      {Array.from({ length: 7 }).map((__, day) => (
                        <span key={day} className={`wos-heatmap-cell wos-heatmap-cell-${(week + day) % 5}`} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="wos-heatmap-legend">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <span key={level} className={`wos-heatmap-legend-cell wos-heatmap-cell-${level}`} />
                  ))}
                  <span>More</span>
                  <span className="wos-heatmap-peak">Peak: 312K tokens</span>
                </div>
              </WindowedChartPanel>

              <WindowedChartPanel title="Time Series" meta="4 metrics overlaid · 7 days" className="wos-braid-chart">
                <svg
                  className="wos-braid-chart-svg"
                  viewBox="0 0 700 110"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Sample time series"
                >
                  <path
                    d="M0,72 L116,50 L232,65 L348,30 L464,44 L580,24 L700,38"
                    className="wos-braid-line wos-braid-line--input"
                    fill="none"
                  />
                  <path
                    d="M0,82 L116,76 L232,70 L348,58 L464,62 L580,40 L700,46"
                    className="wos-braid-line wos-braid-line--output"
                    fill="none"
                  />
                  <path
                    d="M0,88 L116,80 L232,85 L348,74 L464,70 L580,64 L700,60"
                    className="wos-braid-line wos-braid-line--cost"
                    fill="none"
                  />
                </svg>
                <div className="wos-braid-legend">
                  <span className="wos-braid-legend-item">
                    <span className="wos-braid-legend-line wos-braid-line--input" />
                    Input
                  </span>
                  <span className="wos-braid-legend-item">
                    <span className="wos-braid-legend-line wos-braid-line--output" />
                    Output
                  </span>
                  <span className="wos-braid-peak">Peak: 312K tokens</span>
                </div>
              </WindowedChartPanel>
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
          <WindowedPageRail title="Sections" accent="settings" showHeader={false}>
            <WindowedList>
              <WindowedListItem title="Appearance" active accent="settings" />
              <WindowedListItem title="Providers" accent="settings" status={<WindowedBadge tone="positive">2</WindowedBadge>} />
              <WindowedListItem title="Extensions" accent="settings" />
              <WindowedListItem title="Desktop" accent="settings" status={<WindowedBadge tone="neutral">Beta</WindowedBadge>} />
              <WindowedListItem title="Shortcuts" accent="settings" />
            </WindowedList>
          </WindowedPageRail>
          <WindowedPageMain
            title="Appearance"
            actions={
              <>
                <WindowedPageButton>Reset</WindowedPageButton>
                <WindowedPageButton tone="accent">Apply</WindowedPageButton>
              </>
            }
          >
            <WindowedSettingsGroup title="Appearance">
              <WindowedSettingsRow
                title="Theme"
                description="Follows the current system appearance"
                actionsClassName="settings-page-control-actions"
              >
                <WindowedSelect aria-label="Theme">
                  <option>System</option>
                  <option>Light</option>
                  <option>Dark</option>
                </WindowedSelect>
              </WindowedSettingsRow>
              <WindowedSettingsRow title="Accent" description="Used for selection and focused controls">
                <WindowedSegmentedControl
                  ariaLabel="Accent"
                  value="orange"
                  options={[
                    { value: 'orange', label: 'Orange' },
                    { value: 'cobalt', label: 'Cobalt' },
                    { value: 'green', label: 'Green' },
                  ]}
                />
              </WindowedSettingsRow>
              <WindowedSettingsRow title="Desktop mode" description="Open apps as movable windows">
                <WindowedToggle checked accent="settings" label="Toggle windowed desktop mode" />
              </WindowedSettingsRow>
            </WindowedSettingsGroup>
            <WindowedSettingsGroup title="Providers" actions={<WindowedPageButton>Add provider</WindowedPageButton>}>
              <WindowedDataTable columns={[{ label: 'Provider' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
                <WindowedDataRow name="OpenAI" meta="Default" enabled status={<WindowedBadge tone="positive">Connected</WindowedBadge>} />
                <WindowedDataRow name="Local" meta="Ollama" status={<WindowedBadge tone="warning">Setup</WindowedBadge>} />
              </WindowedDataTable>
            </WindowedSettingsGroup>
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
              <WindowedFormGrid columns={3}>
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
              </WindowedFormGrid>
              <WindowedFormActions>
                <WindowedPageButton>Cancel</WindowedPageButton>
                <WindowedPageButton tone="accent">Save</WindowedPageButton>
              </WindowedFormActions>
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
              <WindowedFormGrid columns={2}>
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
              </WindowedFormGrid>
              <WindowedFormActions>
                <WindowedPageButton>Reset</WindowedPageButton>
                <WindowedPageButton tone="accent">Apply changes</WindowedPageButton>
              </WindowedFormActions>
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
              <WindowedDataTable columns={[{ label: 'Automation' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}>
                {[
                  {
                    name: 'Release watch',
                    schedule: '0 9 * * 1-5',
                    next: 'Today 09:00',
                    owner: 'Release notes',
                    prompt: 'Summarize merged changes',
                    status: <WindowedBadge tone="warning">Running</WindowedBadge>,
                  },
                  {
                    name: 'Dependency audit',
                    schedule: 'Mondays 08:30',
                    next: 'Mon 08:30',
                    owner: 'Package drift',
                    prompt: 'Check package drift',
                    status: <WindowedBadge tone="neutral">Paused</WindowedBadge>,
                  },
                  {
                    name: 'Inbox sweep',
                    schedule: 'Every 2 hours',
                    next: '12:00',
                    owner: 'Triage',
                    prompt: 'Group follow-up threads',
                    status: <WindowedBadge tone="positive">Ready</WindowedBadge>,
                  },
                ].map((automation) => (
                  <WindowedDataRow
                    key={automation.name}
                    name={automation.name}
                    meta={`${automation.schedule} · next ${automation.next} · ${automation.owner} · ${automation.prompt}`}
                    status={automation.status}
                    action={
                      <span className="wos-automation-actions">
                        <WindowedPageButton>Run</WindowedPageButton>
                        <WindowedPageButton>{automation.name === 'Dependency audit' ? 'Resume' : 'Pause'}</WindowedPageButton>
                        <WindowedPageButton>Details</WindowedPageButton>
                      </span>
                    }
                  />
                ))}
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
      <WindowedDialog title="Automation details" accent="automations" parentWindowTitle="Automations" onClose={() => undefined}>
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
      <WindowedDialog
        title="Telegram configuration"
        meta="Token configured"
        accent="gateways"
        parentWindowTitle="Gateways"
        onClose={() => undefined}
      >
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

export const AIGatewayPage: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 672, padding: 24 }}>
      <WindowFrame
        title="AI Gateway"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="AI Gateway"
            actions={
              <>
                <WindowedBadge tone="positive">Running</WindowedBadge>
                <WindowedPageButton>Refresh</WindowedPageButton>
                <WindowedPageButton tone="accent">Save port</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Loopback endpoint" meta="Running">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Status', value: <WindowedBadge tone="positive">Running</WindowedBadge> },
                  { label: 'Endpoint', value: 'http://127.0.0.1:8766/v1' },
                  { label: 'Models', value: 42 },
                  { label: 'Default', value: 'auto' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Listener" meta="Local port">
              <WindowedFormGrid>
                <WindowedField label="Port">
                  <WindowedNumberStepper aria-label="Gateway port" value={8766} onChange={() => undefined} min={1024} max={65535} />
                </WindowedField>
                <WindowedField label="Host">
                  <WindowedTextInput aria-label="Gateway host" defaultValue="127.0.0.1" />
                </WindowedField>
                <WindowedField label="Default model">
                  <WindowedSelect aria-label="Default gateway model" defaultValue="auto">
                    <option value="auto">auto</option>
                    <option value="gpt-5">gpt-5</option>
                    <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                  </WindowedSelect>
                </WindowedField>
              </WindowedFormGrid>
            </WindowedPageSection>

            <WindowedPageSection title="Codex client setup" meta="Responses compatible">
              <WindowedKeyValueList
                items={[
                  { label: 'Base URL', value: 'http://127.0.0.1:8766/v1' },
                  { label: 'Auth token', value: '••••••••••••••••' },
                  { label: 'Model catalog', value: '/Users/patrick/.local/share/neon-pilot/models.json' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Recent activity" meta="4 retained">
              <WindowedDataTable columns={[{ label: 'Event' }, { label: 'Status' }, { label: 'Time', align: 'right' }]}>
                <WindowedDataRow
                  name="GET /v1/models"
                  meta="Codex client"
                  status={<WindowedBadge tone="positive">200</WindowedBadge>}
                  cells={[{ value: '12:04:19', align: 'right' }]}
                />
                <WindowedDataRow
                  name="POST /v1/responses"
                  meta="deepseek-v4-flash"
                  status={<WindowedBadge tone="positive">streaming</WindowedBadge>}
                  cells={[{ value: '12:03:42', align: 'right' }]}
                />
                <WindowedDataRow
                  name="Model catalog refresh"
                  meta="42 models indexed"
                  status={<WindowedBadge tone="neutral">ready</WindowedBadge>}
                  cells={[{ value: '12:01:07', align: 'right' }]}
                />
              </WindowedDataTable>
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
                  <WindowedDataRow
                    name="Load workspace glossary, repo instructions, and active desktop-mode notes before the agent starts."
                    meta="enabled · gpt-5"
                    status={<WindowedBadge tone="positive">Continues</WindowedBadge>}
                    action={
                      <>
                        <WindowedPageButton>Open</WindowedPageButton>
                        <WindowedPageButton tone="danger">Delete</WindowedPageButton>
                      </>
                    }
                  />
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Taste gate" meta="2 · Choose path" tone="warning">
                  <WindowedDataRow
                    name="Route frontend-heavy changes through the design taste checklist before editing."
                    meta="enabled"
                    status={<WindowedBadge tone="warning">2 paths</WindowedBadge>}
                    action={
                      <>
                        <WindowedPageButton>Open</WindowedPageButton>
                        <WindowedPageButton tone="danger">Delete</WindowedPageButton>
                      </>
                    }
                  />
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
                  <WindowedDataRow
                    name="Write a compact handoff when a long-running desktop-mode task changes state."
                    meta="enabled"
                    status={<WindowedBadge tone="positive">Warns on fail</WindowedBadge>}
                    action={
                      <>
                        <WindowedPageButton>Open</WindowedPageButton>
                        <WindowedPageButton tone="danger">Delete</WindowedPageButton>
                      </>
                    }
                  />
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
          parentWindowTitle="Routines"
          onClose={() => undefined}
          actions={
            <>
              <WindowedPageButton tone="accent">Save</WindowedPageButton>
              <WindowedPageButton>Delete</WindowedPageButton>
            </>
          }
        >
          <div className="wos-routine-editor-bridge">
            <WindowedFormGrid columns={2}>
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
            </WindowedFormGrid>
          </div>
        </WindowedDialog>
        <WindowedDialog title="Routine runs" meta="12 total" accent="routines" parentWindowTitle="Routines" onClose={() => undefined}>
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
        accent="workflows"
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
                  accent="workflows"
                  status={<WindowedBadge tone="warning">running</WindowedBadge>}
                />
                <WindowedListItem
                  title="Visual regression sweep"
                  meta="/Users/patrick/workingdir/neon-pilot"
                  detail="Completed today"
                  accent="workflows"
                  status={<WindowedBadge tone="positive">completed</WindowedBadge>}
                />
                <WindowedListItem
                  title="Extension hardening"
                  meta="verification"
                  detail="Failed yesterday"
                  accent="workflows"
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
                  accent="workflows"
                />
                <WindowedListItem title="Finding validation" meta="Template" detail="Validate each reported issue" accent="workflows" />
                <WindowedListItem title="Research synthesis" meta="Template" detail="Explore angles, then summarize" accent="workflows" />
              </WindowedList>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
        <WindowedDialog
          title="Repo audit"
          meta="running"
          accent="workflows"
          parentWindowTitle="Workflows"
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
              accent="workflows"
              status={<WindowedBadge tone="warning">running</WindowedBadge>}
            />
            <WindowedListItem
              title="visual-check"
              meta="verification · gpt-5.4-mini"
              detail="No horizontal overflow found in the Storybook target."
              accent="workflows"
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
        accent="model-arena"
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
                <WindowedSelect aria-label="Task type" defaultValue="all">
                  <option value="all">All task types</option>
                  <option value="coding">coding</option>
                  <option value="review">review</option>
                </WindowedSelect>
                <WindowedBadge tone="positive">Running</WindowedBadge>
                <WindowedPageButton>Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Overview" meta="All task types">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Recent duels', value: 42 },
                  { label: 'Votes', value: 128 },
                  { label: 'Sample rate', value: '20%' },
                  { label: 'Challengers', value: 3 },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Status" meta="Automatic duels on">
              <div className="wos-arena-status-row">
                <span>Comparing challenger runs against conversation models.</span>
                <WindowedToggle checked accent="model-arena" label="Disable Model Arena" />
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Challengers" meta="3 selected">
              <div className="wos-arena-add-row">
                <WindowedField label="Model" span="full">
                  <WindowedSelect aria-label="Challenger model" defaultValue="openai:gpt-5.4-mini">
                    <optgroup label="OpenAI">
                      <option value="openai:gpt-5.4-mini">gpt-5.4-mini</option>
                      <option value="openai:gpt-5.4">gpt-5.4</option>
                    </optgroup>
                    <optgroup label="Anthropic">
                      <option value="anthropic:claude-sonnet-4.5">claude-sonnet-4.5</option>
                    </optgroup>
                  </WindowedSelect>
                </WindowedField>
                <WindowedPageButton tone="accent">Add</WindowedPageButton>
              </div>
              <WindowedDataTable
                className="wos-arena-challenger-table"
                columns={[{ label: 'Model' }, { label: 'Reference' }, { label: 'Action', align: 'right' }]}
              >
                <WindowedDataRow
                  name="gpt-5.4-mini"
                  cells={['openai:gpt-5.4-mini']}
                  action={<WindowedPageButton>Remove</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="claude-sonnet-4.5"
                  cells={['anthropic:claude-sonnet-4.5']}
                  action={<WindowedPageButton>Remove</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Sampling">
              <div className="wos-arena-settings-grid">
                <WindowedField label="Initial rate">
                  <WindowedNumberStepper aria-label="Initial rate" value={20} onChange={() => undefined} min={0} max={100} unit="%" />
                </WindowedField>
                <WindowedField label="Later rate">
                  <WindowedNumberStepper aria-label="Later rate" value={5} onChange={() => undefined} min={0} max={100} unit="%" />
                </WindowedField>
                <WindowedField label="Ramp after">
                  <WindowedNumberStepper aria-label="Ramp after" value={120} onChange={() => undefined} min={0} max={5000} unit="votes" />
                </WindowedField>
                <WindowedField label="Minimum prompt">
                  <WindowedNumberStepper
                    aria-label="Minimum prompt"
                    value={280}
                    onChange={() => undefined}
                    min={0}
                    max={2000}
                    step={10}
                    unit="chars"
                  />
                </WindowedField>
              </div>
            </WindowedPageSection>

            <WindowedPageSection title="Leader">
              <WindowedKeyValueList
                items={[
                  { label: 'Model', value: 'openai:gpt-5.4' },
                  { label: 'Rating', value: 1684 },
                  { label: 'Record', value: '42W/19L/0T' },
                  { label: 'Confidence', value: 'High' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Rankings" meta="4 models">
              <WindowedDataTable
                className="wos-arena-ranking-table"
                columns={[
                  { label: 'Model' },
                  { label: 'Rating', align: 'right' },
                  { label: 'Votes', align: 'right' },
                  { label: 'Confidence', align: 'right' },
                ]}
              >
                <WindowedDataRow
                  name="openai:gpt-5.4"
                  meta="42 wins / 61 votes"
                  cells={[
                    { value: 1684, align: 'right' },
                    { value: 61, align: 'right' },
                    { value: 'High', align: 'right' },
                  ]}
                />
                <WindowedDataRow
                  name="anthropic:claude-sonnet-4.5"
                  meta="31 wins / 52 votes"
                  cells={[
                    { value: 1612, align: 'right' },
                    { value: 52, align: 'right' },
                    { value: 'Medium', align: 'right' },
                  ]}
                />
              </WindowedDataTable>
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
                <WindowedSegmentedControl
                  ariaLabel="Diagnostics range"
                  accent="telemetry"
                  value="24h"
                  options={[
                    { id: '1h', label: '1H' },
                    { id: '24h', label: '24H' },
                    { id: '7d', label: '7D' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Refresh</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Data" meta="Loaded">
              <WindowedKeyValueList
                items={[
                  { label: 'Sessions', value: '8' },
                  { label: 'Runs', value: '42' },
                  { label: 'Tools', value: '216' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Overview" meta="24H">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Input', value: '1.4M' },
                  { label: 'Output', value: '312K' },
                  { label: 'Cached', value: '68%' },
                  { label: 'Errors', value: <WindowedBadge tone="warning">2</WindowedBadge> },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Status" meta="Current range">
              <WindowedKeyValueList
                items={[
                  { label: 'Range', value: '24H' },
                  { label: 'Activity', value: 'Present' },
                  { label: 'Loading', value: 'No' },
                  { label: 'Errors', value: '2' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Health">
              <WindowedBadge tone="positive">Active</WindowedBadge>
            </WindowedPageSection>

            <WindowedPageSection title="Usage" meta="Tokens and models">
              <WindowedDataTable columns={[{ label: 'Model' }, { label: 'Tokens' }, { label: 'Cache', align: 'right' }]}>
                <WindowedDataRow
                  name="gpt-5.4"
                  meta="primary chat"
                  status={<WindowedBadge tone="positive">1.1M</WindowedBadge>}
                  action="71%"
                />
                <WindowedDataRow
                  name="gpt-5.4-mini"
                  meta="subagents and checks"
                  status={<WindowedBadge tone="neutral">412K</WindowedBadge>}
                  action="63%"
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Tools" meta="216 calls">
              <WindowedDataTable columns={[{ label: 'Tool' }, { label: 'Calls' }, { label: 'Errors', align: 'right' }]}>
                <WindowedDataRow
                  name="exec_command"
                  meta="local validation"
                  status={<WindowedBadge tone="positive">128</WindowedBadge>}
                  action="0"
                />
                <WindowedDataRow
                  name="browser_snapshot"
                  meta="workbench browser"
                  status={<WindowedBadge tone="warning">18</WindowedBadge>}
                  action="2"
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="App activity" meta="Context and runtime">
              <WindowedTimeline>
                <WindowedTimelineItem title="Context pressure rose" meta="chat · 82%" tone="warning">
                  Compaction is likely if the active task continues without handoff.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Browser view suspended" meta="windowed shell · 0.1s" tone="positive">
                  Detached hidden native view while a desktop overlay was active.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Automation resumed" meta="background run" tone="neutral">
                  Run state stayed visible in the owning thread.
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
                  ariaLabel="Extension view"
                  accent="extensions"
                  value="all"
                  options={[
                    { id: 'all', label: 'Installed 16' },
                    { id: 'platform', label: 'Platform 8' },
                    { id: 'attention', label: 'Attention 2' },
                  ]}
                  onChange={() => undefined}
                />
                <WindowedPageButton>Reload</WindowedPageButton>
                <WindowedPageButton>Update all (3)</WindowedPageButton>
                <WindowedPageButton tone="accent">Build</WindowedPageButton>
                <WindowedPageButton>Install</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection title="Sources" meta="2 sources">
              <WindowedKeyValueList
                items={[
                  { label: 'Catalog', value: 'Loaded' },
                  { label: 'Available', value: '7' },
                  { label: 'Visible', value: '16 installed · 14 enabled' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection>
              <WindowedToolbar>
                <WindowedTextInput aria-label="Search extensions" placeholder="Search extensions" />
              </WindowedToolbar>
            </WindowedPageSection>

            <WindowedPageSection title="Installed" meta="16 installed · 14 enabled">
              <WindowedDataTable columns={[{ label: 'Extension' }, { label: 'Status' }, { label: 'Controls', align: 'right' }]}>
                <WindowedDataRow
                  name="system-browser"
                  meta="Built-in · Workbench, tools"
                  status={
                    <span className="wos-status-stack">
                      <WindowedBadge tone="warning">Update available</WindowedBadge>
                      <span className="wos-status-note" data-tone="accent">
                        0.11.40
                      </span>
                    </span>
                  }
                  action={
                    <span className="wos-inline-actions">
                      <WindowedToggle checked accent="extensions" label="Disable system-browser" />
                      <WindowedPageButton>Details</WindowedPageButton>
                      <WindowedPageButton>Open</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="system-terminal"
                  meta="Built-in · Workbench"
                  status={<WindowedBadge tone="positive">Enabled</WindowedBadge>}
                  action={
                    <span className="wos-inline-actions">
                      <WindowedToggle checked accent="extensions" label="Disable system-terminal" />
                      <WindowedPageButton>Details</WindowedPageButton>
                      <WindowedPageButton>Open</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="system-model-arena"
                  meta="Built-in · Main route"
                  status={<WindowedBadge tone="neutral">Disabled</WindowedBadge>}
                  action={
                    <span className="wos-inline-actions">
                      <WindowedToggle accent="extensions" label="Enable system-model-arena" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="workflow-reports"
                  meta="Personal marketplace · Main route, skills"
                  status={
                    <span className="wos-status-stack">
                      <WindowedBadge tone="danger">Invalid</WindowedBadge>
                      <span className="wos-status-note" data-tone="danger">
                        Manifest missing contribution id
                      </span>
                    </span>
                  }
                  action={
                    <span className="wos-inline-actions">
                      <WindowedToggle disabled accent="extensions" label="Enable workflow-reports" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        <WindowedDialog
          title="system-browser"
          meta="update available"
          accent="extensions"
          parentWindowTitle="Extensions"
          onClose={() => undefined}
          actions={
            <>
              <WindowedPageButton>Open</WindowedPageButton>
              <WindowedPageButton>Settings</WindowedPageButton>
              <WindowedPageButton>Folder</WindowedPageButton>
            </>
          }
        >
          <div className="wos-extension-detail-grid">
            <WindowedKeyValueList
              items={[
                { label: 'State', value: 'Update available' },
                { label: 'Source', value: 'Built-in' },
                { label: 'Version', value: 'v0.11.39' },
                { label: 'Settings', value: 'Configurable' },
              ]}
            />
            <WindowedKeyValueList
              items={[
                { label: 'Appears in', value: 'Workbench, tools' },
                { label: 'Skills', value: 'None' },
                { label: 'Tools', value: 'browser_snapshot, browser_cdp' },
              ]}
            />
            <p className="wos-extension-detail-description">Workbench browser and browser automation surfaces.</p>
          </div>
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
          parentWindowTitle="Extensions"
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
        accent="skills"
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
                  accent="skills"
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
                <WindowedTextInput aria-label="Search marketplace skills" placeholder="Search marketplace skills" />
                <WindowedPageButton>Clear</WindowedPageButton>
                <WindowedPageButton tone="accent" type="submit">
                  Search
                </WindowedPageButton>
              </WindowedToolbar>
            </WindowedPageSection>

            <WindowedPageSection>
              <WindowedFormGrid columns={3}>
                <WindowedField label="Capability">
                  <WindowedSelect aria-label="Filter by capability" defaultValue="all">
                    <option value="all">All</option>
                    <option value="coding">Coding</option>
                    <option value="qa">QA</option>
                    <option value="research">Research</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="Source">
                  <WindowedSelect aria-label="Filter by source" defaultValue="openai">
                    <option value="all">All</option>
                    <option value="openai">OpenAI Skills</option>
                    <option value="curated">Curated</option>
                    <option value="community">Community</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedField label="State">
                  <WindowedSelect aria-label="Filter by state" defaultValue="all">
                    <option value="all">All</option>
                    <option value="available">Available</option>
                    <option value="approval-required">Approval required</option>
                    <option value="installed">Installed</option>
                  </WindowedSelect>
                </WindowedField>
              </WindowedFormGrid>
            </WindowedPageSection>

            <WindowedPageSection title="Marketplace" meta="27 skills">
              <WindowedDataTable columns={[{ label: 'Skill' }, { label: 'State' }, { label: 'Action', align: 'right' }]}>
                <WindowedDataRow
                  name="code-review"
                  meta="Review · OpenAI Skills · Trusted"
                  status={<WindowedBadge tone="positive">Installed</WindowedBadge>}
                  action={
                    <span className="wos-inline-actions">
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
                    <span className="wos-inline-actions">
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
                    <span className="wos-inline-actions">
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
                    <span className="wos-inline-actions">
                      <WindowedToggle checked accent="skills" label="Disable design" />
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
                    <span className="wos-inline-actions">
                      <WindowedToggle accent="skills" label="Enable zotero" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
        <WindowedDialog title="local-qa" meta="Marketplace skill" accent="skills" parentWindowTitle="Skills" onClose={() => undefined}>
          <WindowedDialogStack>
            <WindowedDialogCopy>Browser and app checks for local product QA.</WindowedDialogCopy>
            <WindowedKeyValueList
              items={[
                { label: 'Capability', value: 'QA' },
                { label: 'Source', value: 'Agent plugin' },
                { label: 'Trust', value: 'Trusted' },
                { label: 'State', value: 'Available' },
                { label: 'Identifier', value: 'agent-plugin:local-qa' },
              ]}
            />
          </WindowedDialogStack>
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

export const TerminalWindow: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Terminal"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(760px, 100%)', height: 430 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedTerminalFrame cwd="/Users/patrick/workingdir/neon-pilot" status="PTY shell">
          <div className="wos-terminal-panel" aria-label="Terminal preview">
            <pre>
              $ pnpm --dir packages/windowed-os-ui run test{'\n'}
              PASS windowed desktop shell{'\n'}
              PASS terminal frame tokens{'\n'}
              {'\n'}$
            </pre>
          </div>
        </WindowedTerminalFrame>
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
              <WindowedFormGrid columns={2}>
                <WindowedField label="Token">
                  <WindowedTextInput aria-label="Telegram bot token" placeholder="Token is already saved" />
                </WindowedField>
                <WindowedField label="Gateway">
                  <WindowedToggle checked accent="gateways" label="Toggle Telegram gateway" />
                </WindowedField>
              </WindowedFormGrid>
              <WindowedFormActions>
                <WindowedPageButton>Remove token</WindowedPageButton>
                <WindowedPageButton tone="accent">Save token</WindowedPageButton>
              </WindowedFormActions>
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
