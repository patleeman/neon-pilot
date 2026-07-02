import type { Meta, StoryObj } from '@storybook/react';

import {
  StartMenu,
  Taskbar,
  WindowedPageButton,
  WindowedPageInspector,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageSection,
  WindowedPageShell,
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
            { id: 'chat', title: 'Chat', accent: 'chat', meta: '3 windows', onSelect: () => undefined },
            { id: 'automations', title: 'Automations', accent: 'automations', meta: 'Schedules', onSelect: () => undefined },
            { id: 'gateways', title: 'Gateways', accent: 'gateways', meta: 'Models', onSelect: () => undefined },
            { id: 'settings', title: 'Settings', accent: 'settings', meta: 'System', onSelect: () => undefined },
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
          <div style={{ display: 'grid', height: '100%', gridTemplateColumns: '170px 1fr', color: 'var(--wos-ink-900)' }}>
            <aside style={{ borderRight: '2px solid var(--wos-ink-900)', background: 'var(--wos-surface-2)', padding: 12 }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, textTransform: 'uppercase' }}>Threads</div>
            </aside>
            <section style={{ padding: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Windowed chat surface</h2>
              <p style={{ maxWidth: 520, fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.5 }}>
                Chat keeps its workbench attached while the shell chrome stays in the windowed OS design language.
              </p>
            </section>
          </div>
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
              <div style={{ display: 'grid', gap: 6, padding: 8, fontSize: 12 }}>
                <strong>Telegram</strong>
                <span>Model gateway</span>
                <span>Local tools</span>
              </div>
            </WindowedPageSection>
          </WindowedPageRail>
          <WindowedPageMain
            eyebrow="Gateway"
            title="Telegram"
            description="Only approved users and chats can send work into Neon Pilot."
            actions={<WindowedPageButton tone="accent">Refresh</WindowedPageButton>}
          >
            <WindowedPageSection title="Runtime" meta="Needs attention">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, fontSize: 12 }}>
                {['Token', 'Connection', 'Runtime'].map((label) => (
                  <div key={label} style={{ borderRight: '1.5px solid var(--wos-ink-900)', padding: 10 }}>
                    <div className="wos-page-eyebrow">{label}</div>
                    <strong>{label === 'Runtime' ? 'Needs attention' : 'Configured'}</strong>
                  </div>
                ))}
              </div>
            </WindowedPageSection>
            <WindowedPageSection title="Approved users" meta="1 approved">
              <div style={{ padding: 10, fontSize: 12 }}>1191448898</div>
            </WindowedPageSection>
          </WindowedPageMain>
          <WindowedPageInspector eyebrow="Gateway context" title="Telegram">
            <WindowedPageSection title="Status">
              <div style={{ display: 'grid', gap: 8, padding: 10, fontSize: 12 }}>
                <span>Setup /gateways</span>
                <span>Configuration Gateways page</span>
                <span>Docs Telegram Bot API</span>
              </div>
            </WindowedPageSection>
          </WindowedPageInspector>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};
