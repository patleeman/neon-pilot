import type { Meta, StoryObj } from '@storybook/react';

import {
  StartMenu,
  Taskbar,
  WindowedAppTile,
  WindowedBadge,
  WindowedChatComposer,
  WindowedChatMain,
  WindowedChatRail,
  WindowedChatSurface,
  WindowedDataRow,
  WindowedDataTable,
  WindowedKeyValueGrid,
  WindowedKeyValueList,
  WindowedMessageBubble,
  WindowedPageButton,
  WindowedPageInspector,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageSection,
  WindowedPageShell,
  WindowedThreadItem,
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
          onSelectStableShell={() => undefined}
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
            <WindowedChatRail>
              <WindowedThreadItem title="Release notes" active />
              <WindowedThreadItem title="Bug triage" meta="2h" />
              <WindowedThreadItem title="Onboarding copy" meta="1d" />
              <WindowedThreadItem title="Deploy check" meta="2d" />
            </WindowedChatRail>
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
        groups={[{ id: 'chat', title: 'Chat', accent: 'chat', focused: true, count: 3, onSelect: () => undefined }]}
        items={[{ id: 'gateways', title: 'Gateways', accent: 'gateways', onSelect: () => undefined }]}
      />
    </div>
  ),
};

export const NavigationPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Navigation"
        accent="extensions"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(560px, 100%)', height: 410 }}
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
        <WindowedPageShell>
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
          </WindowedPageMain>
          <WindowedPageInspector eyebrow="Gateway context" title="Telegram">
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
          </WindowedPageInspector>
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
                    <span className="ui-section-label ui-section-label-accent">Gateway context</span>
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
