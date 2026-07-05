import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import {
  CANONICAL_WINDOWED_DESKTOP_APPS,
  StartMenu,
  Taskbar,
  WindowedAppTile,
  WindowedBadge,
  WindowedBrowserToolbar,
  type WindowedBrowserToolbarAction,
  WindowedChartPanel,
  WindowedChatComposer,
  WindowedChatMain,
  WindowedChatSurface,
  WindowedChatToolLauncher,
  type WindowedChatToolLauncherItem,
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
  WindowedWorkspaceLocationBar,
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

function WindowedShellBodyAttribute({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.setAttribute('data-neon-pilot-windowed-shell-active', 'true');
    return () => {
      document.body.removeAttribute('data-neon-pilot-windowed-shell-active');
    };
  }, []);

  return <>{children}</>;
}

const storyImagePreviewSrc =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDcyMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjcyMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmNGVkZTIiLz48cmVjdCB4PSI0MCIgeT0iNDQiIHdpZHRoPSI2NDAiIGhlaWdodD0iMzEyIiByeD0iMjQiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzE3MTMwZiIgc3Ryb2tlLXdpZHRoPSI4Ii8+PHBhdGggZD0iTTkyIDMwMGwxMTItMTA4IDkyIDY4IDEyOC0xMzIgMjA0IDE3MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNDk5ZGRmIiBzdHJva2Utd2lkdGg9IjE4IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48Y2lyY2xlIGN4PSIyMDIiIGN5PSIxMjQiIHI9IjM4IiBmaWxsPSIjZmM4YjI3IiBzdHJva2U9IiMxNzEzMGYiIHN0cm9rZS13aWR0aD0iNiIvPjx0ZXh0IHg9IjgwIiB5PSI4NiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMTcxMzBmIj5XaW5kb3dlZCBPUyBwcmV2aWV3PC90ZXh0Pjwvc3ZnPg==';

const timeOfDayPhases = [
  { phase: 'deep-night', resolved: 'dark', title: 'Deep night', time: '02:00', badge: 'Low glare' },
  { phase: 'night', resolved: 'dark', title: 'Night', time: '04:30', badge: 'Quiet' },
  { phase: 'dawn', resolved: 'light', title: 'Dawn', time: '06:30', badge: 'Warm start' },
  { phase: 'morning', resolved: 'light', title: 'Morning', time: '09:00', badge: 'Clear' },
  { phase: 'bright-noon', resolved: 'light', title: 'Bright noon', time: '12:30', badge: 'High contrast' },
  { phase: 'afternoon', resolved: 'light', title: 'Afternoon', time: '15:30', badge: 'Soft' },
  { phase: 'dusk', resolved: 'dark', title: 'Dusk', time: '19:30', badge: 'Dimmed' },
] as const;

function StoryTokenActivityChart() {
  return (
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
  );
}

function StoryTimeSeriesChart() {
  return (
    <WindowedChartPanel title="Time Series" meta="4 metrics overlaid · 7 days" className="wos-braid-chart">
      <svg className="wos-braid-chart-svg" viewBox="0 0 700 110" preserveAspectRatio="none" role="img" aria-label="Sample time series">
        <path d="M0,72 L116,50 L232,65 L348,30 L464,44 L580,24 L700,38" className="wos-braid-line wos-braid-line--input" fill="none" />
        <path d="M0,82 L116,76 L232,70 L348,58 L464,62 L580,40 L700,46" className="wos-braid-line wos-braid-line--output" fill="none" />
        <path d="M0,88 L116,80 L232,85 L348,74 L464,70 L580,64 L700,60" className="wos-braid-line wos-braid-line--cost" fill="none" />
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
  );
}

function StoryToolbarIcon({ name }: { name: 'browser' | 'files' | 'terminal' }) {
  const paths = {
    browser: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14" />
        <path d="M12 5a10 10 0 0 1 0 14" />
        <path d="M12 5a10 10 0 0 0 0 14" />
      </>
    ),
    files: (
      <>
        <path d="M4 7h6l2 2h8v9H4z" />
        <path d="M4 7v11" />
        <path d="M8 13h8" />
        <path d="M8 16h5" />
      </>
    ),
    terminal: (
      <>
        <path d="m6 8 4 4-4 4" />
        <path d="M12 16h6" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function StoryChatWindowToolbar({ activeTool }: { activeTool?: 'browser' | 'files' | 'terminal' }) {
  const items: WindowedChatToolLauncherItem[] = [
    {
      id: 'browser',
      label: 'Open Browser window',
      icon: <StoryToolbarIcon name="browser" />,
      active: activeTool === 'browser',
      onSelect: () => undefined,
    },
    {
      id: 'files',
      label: 'Open Files window',
      icon: <StoryToolbarIcon name="files" />,
      active: activeTool === 'files',
      onSelect: () => undefined,
    },
    {
      id: 'terminal',
      label: 'Open Terminal window',
      icon: <StoryToolbarIcon name="terminal" />,
      active: activeTool === 'terminal',
      onSelect: () => undefined,
    },
  ];

  return <WindowedChatToolLauncher items={items} statusLabel="Chat" statusDetail="/Users/patrick/workingdir/neon-pilot" />;
}

function DesktopCompositionStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 720 }}>
      <main className="wos-desktop" style={{ height: 678 }}>
        <StartMenu
          open
          items={canonicalDesktopApps.map((app) => ({
            ...app,
            open: app.id === 'chat' || app.id === 'browser',
            focused: app.id === 'chat',
            onSelect: () => undefined,
          }))}
        />
        <WindowFrame
          title="Chat"
          accent="chat"
          focused
          style={{ left: 'clamp(16px, 6vw, 48px)', top: 36, width: 'min(820px, calc(100vw - 64px))', height: 520 }}
          onMinimize={() => undefined}
          onMaximize={() => undefined}
          onClose={() => undefined}
        >
          <WindowedChatSurface>
            <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
              <WindowedMessageBubble from="user">Draft the changelog for v0.9</WindowedMessageBubble>
              <WindowedMessageBubble>On it. Pulling merged PRs since the last tag.</WindowedMessageBubble>
              <WindowedMessageBubble from="user">Group by app, please.</WindowedMessageBubble>
              <WindowedMessageBubble>Done. Six groups, linked to their app pages.</WindowedMessageBubble>
            </WindowedChatMain>
          </WindowedChatSurface>
        </WindowFrame>
        <WindowFrame
          title="Browser"
          accent="gateways"
          style={{ left: 'clamp(128px, 58vw, 640px)', top: 164, width: 'min(520px, calc(100vw - 64px))', height: 360 }}
          onMinimize={() => undefined}
          onMaximize={() => undefined}
          onClose={() => undefined}
        >
          <div style={{ padding: 14, fontFamily: 'system-ui', fontSize: 13 }}>Shared browser sessions live inside the frame.</div>
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
          { id: 'browser', title: 'Browser', accent: 'gateways', onSelect: () => undefined },
        ]}
      />
    </div>
  );
}

export const DesktopComposition: Story = {
  render: () => <DesktopCompositionStory />,
};

export const DarkDesktopComposition: Story = {
  render: () => <DesktopCompositionStory theme="dark" />,
};

export const TaskbarMenuPlacement: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 360 }}>
      <main className="wos-desktop" style={{ height: 318 }}>
        <WindowFrame
          title="Chat"
          accent="chat"
          focused
          style={{ left: 52, top: 32, width: 'min(640px, calc(100% - 104px))', height: 230 }}
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
        items={[{ id: 'browser', title: 'Browser', accent: 'gateways', onSelect: () => undefined }]}
      />
    </div>
  ),
};

function ChatWithToolWindowsStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div
      className="windowed-os-shell"
      data-wos-theme={theme}
      data-wos-theme-mode={theme}
      style={{ boxSizing: 'border-box', minHeight: 720, height: '100vh', overflow: 'hidden', padding: 24 }}
    >
      <WindowFrame
        windowId="chat:release-notes"
        title="Release notes"
        accent="chat"
        focused
        style={{ position: 'absolute', left: 32, top: 34, width: 'min(820px, calc(100% - 96px))', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body wos-window-route-body--chat" data-workbench-collapsed="true">
          <StoryChatWindowToolbar activeTool="files" />
          <WindowedChatSurface>
            <WindowedChatMain title="Release notes" composer={<WindowedChatComposer actionLabel="Send" />}>
              <WindowedMessageBubble from="user">Draft the changelog for v0.11.39.</WindowedMessageBubble>
              <WindowedMessageBubble>Reading the current branch and grouping changes by app.</WindowedMessageBubble>
              <WindowedMessageBubble from="user">Keep it compact and include blockers only when action is required.</WindowedMessageBubble>
              <WindowedMessageBubble>
                Ready. I found three UI changes, one app package rebuild, and no release blockers.
              </WindowedMessageBubble>
            </WindowedChatMain>
          </WindowedChatSurface>
        </div>
      </WindowFrame>
      <WindowFrame
        windowId="workspace:release-notes"
        title="Files"
        accent="chat"
        parentWindowId="chat:release-notes"
        parentWindowTitle="Release notes"
        style={{
          position: 'absolute',
          left: 'min(860px, calc(100% - 400px))',
          top: 112,
          width: 'min(360px, calc(100% - 80px))',
          height: 410,
        }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body wos-window-route-body--files" data-windowed-subwindow="files">
          <div className="wos-chat-files-dialog__body">
            <div className="wos-workspace-child-preview" aria-label="Files preview">
              <WindowedWorkspaceLocationBar location="/Users/patrick/workingdir/neon-pilot">
                <WindowedBadge tone="neutral">3 open</WindowedBadge>
              </WindowedWorkspaceLocationBar>
              <WindowedPageSection title="Files" meta="Open">
                <WindowedList>
                  <WindowedListItem title="CHANGELOG.md" meta="Modified" detail="Release notes" active accent="chat" />
                  <WindowedListItem title="apps/system-browser" meta="Built" detail="Frontend bundle" accent="gateways" />
                  <WindowedListItem title="packages/windowed-os-ui" meta="Storybook" detail="Design target" accent="apps" />
                </WindowedList>
              </WindowedPageSection>
              <WindowedStateBlock tone="positive" title="Validation passed">
                pnpm --dir packages/windowed-os-ui run build
              </WindowedStateBlock>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

function AttachedBrowserWorkbenchStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div
      className="windowed-os-shell"
      data-wos-theme={theme}
      data-wos-theme-mode={theme}
      data-native-browser-blocked="true"
      style={{ minHeight: 700, padding: 24 }}
    >
      <WindowFrame
        title="Browser tools"
        accent="chat"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(980px, 100%)', height: 640 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body wos-window-route-body--chat">
          <StoryChatWindowToolbar activeTool="browser" />
          <div className="wos-chat-workbench">
            <WindowedChatSurface>
              <WindowedChatMain title="Browser QA" composer={<WindowedChatComposer actionLabel="Send" />}>
                <WindowedMessageBubble from="user">Open the browser tools and inspect the release notes preview.</WindowedMessageBubble>
                <WindowedMessageBubble>
                  The attached browser is visible, but the native BrowserView is paused while another window or overlay owns focus.
                </WindowedMessageBubble>
              </WindowedChatMain>
            </WindowedChatSurface>
            <aside
              className="wos-chat-workbench__panel ui-workbench-panel"
              aria-label="Attached browser tools"
              data-windowed-attached-workbench="true"
            >
              <div className="wos-chat-workbench__tabs ui-workbench-tab-strip" role="tablist" aria-label="Tool tabs">
                <button type="button" className="ui-workbench-tab" role="tab" aria-selected="false">
                  Files
                </button>
                <button type="button" className="ui-workbench-tab ui-workbench-tab-active" role="tab" aria-selected="true">
                  Browser
                </button>
                <button type="button" className="ui-workbench-tab" role="tab" aria-selected="false">
                  Terminal
                </button>
              </div>
              <div className="wos-chat-workbench__body ui-workbench-panel__body">
                <div className="ui-workbench-file-bar" aria-label="Browser controls">
                  <div className="ui-workbench-file-bar__path">
                    <span className="ui-workbench-file-bar__path-label">
                      https://docs.neonpilot.local/releases/v0.11.39/windowed-desktop/browser-preview?panel=attached&amp;state=blocked
                    </span>
                  </div>
                  <button type="button" className="ui-workbench-file-bar__button" aria-label="Reload browser preview">
                    ↻
                  </button>
                </div>
                <div className="ui-windowed-browser-host" data-windowed-browser-host="true" aria-label="Browser preview">
                  <div className="ui-windowed-browser-host__blocker">
                    <div className="ui-windowed-browser-host__state">
                      <WindowedStateBlock title="Browser paused" tone="warning">
                        <span>Native browser content is hidden while desktop chrome is above the active chat window.</span>
                        <span className="ui-windowed-browser-host__url">
                          https://docs.neonpilot.local/releases/v0.11.39/windowed-desktop/browser-preview?panel=attached&amp;state=blocked
                        </span>
                      </WindowedStateBlock>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

export const ChatWithToolWindows: Story = {
  render: () => <ChatWithToolWindowsStory />,
};

export const DarkChatWithToolWindows: Story = {
  render: () => <ChatWithToolWindowsStory theme="dark" />,
};

export const ChatWithAttachedBrowserWorkbench: Story = {
  render: () => <AttachedBrowserWorkbenchStory />,
};

export const DarkChatWithAttachedBrowserWorkbench: Story = {
  render: () => <AttachedBrowserWorkbenchStory theme="dark" />,
};

function InheritedChatChromeStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
      <WindowFrame
        title="Inherited chat chrome"
        accent="chat"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(980px, 100%)', height: 2020 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div className="wos-window-route-body wos-window-route-body--chat">
          <StoryChatWindowToolbar />
          <div className="wos-inherited-chat-preview">
            <section data-chat-transcript-panel="1" aria-label="Transcript preview">
              <article className="ui-message-card-user">
                <div className="ui-message-meta">Patrick</div>
                <p>Audit the windowed chat surface and keep the composer compact.</p>
                <div className="ui-message-actions-preview" aria-label="Message actions">
                  <span className="ui-tooltip-host relative inline-flex">
                    <button type="button" className="ui-message-action-button ui-message-action-button-icon" aria-label="Copy this prompt">
                      ⎘
                    </button>
                    <span className="ui-tooltip ui-tooltip-top-right">Copy this prompt</span>
                  </span>
                  <span className="ui-tooltip-host relative inline-flex">
                    <button type="button" className="ui-message-action-button ui-message-action-button-icon" aria-label="Edit and rerun">
                      ✎
                    </button>
                    <span className="ui-tooltip ui-tooltip-top-right">Edit and rerun</span>
                  </span>
                  <span className="ui-tooltip-host relative inline-flex">
                    <button
                      type="button"
                      className="ui-message-action-button ui-message-action-button-icon"
                      aria-label="Fork from here"
                      disabled
                    >
                      …
                    </button>
                    <span className="ui-tooltip ui-tooltip-top-right">Forking from here</span>
                  </span>
                </div>
              </article>
              <article className="ui-message-card-assistant">
                <div className="ui-message-meta">Neon Pilot</div>
                <div className="ui-markdown">
                  <h3>Windowed audit</h3>
                  <p>
                    The inherited transcript chrome now uses the windowed border, type, and action treatment. Review{' '}
                    <a href="https://example.com">the visual notes</a> and keep <code>composer</code> controls compact.
                  </p>
                  <blockquote>Markdown blocks should feel like part of the desktop, not imported web content.</blockquote>
                  <div className="ui-markdown-code-block">
                    <pre>
                      <code>pnpm --dir packages/windowed-os-ui run test</code>
                    </pre>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Surface</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Composer</td>
                        <td>Compact</td>
                      </tr>
                    </tbody>
                  </table>
                  <details className="ui-skill-invocation" open>
                    <summary className="ui-skill-invocation-summary">
                      <span className="ui-skill-invocation-label">skill</span>
                      <span className="ui-skill-invocation-name">agent-plugin:local-qa</span>
                    </summary>
                    <div className="ui-skill-invocation-body">
                      <p className="ui-skill-invocation-meta">References resolve relative to the active workspace.</p>
                      <p>Use local browser QA before calling the chat surface ready.</p>
                    </div>
                  </details>
                </div>
                <div className="ui-context-lifecycle-marker" data-context-shelf="1" data-lifecycle-marker="auto-resume">
                  <span aria-hidden="true">↻</span>
                  <span>Goal resumed automatically</span>
                  <span className="ui-message-meta">2m ago</span>
                </div>
                <div className="ui-context-shelf" data-context-shelf="1">
                  <details className="ui-context-shelf__item" data-context-type="referenced_context" open>
                    <summary className="ui-context-shelf__summary">
                      <span className="ui-context-shelf__summary-main">
                        <span className="ui-context-shelf__chevron" aria-hidden="true">
                          ›
                        </span>
                        <span className="ui-context-shelf__label">Context added</span>
                        <span className="ui-context-shelf__preview">Workspace notes and open window state were attached.</span>
                        <span className="ui-message-meta">now</span>
                      </span>
                      <span className="ui-context-shelf__rule" aria-hidden="true" />
                    </summary>
                    <div className="ui-context-shelf__body">Workspace notes and open window state were attached for this turn.</div>
                  </details>
                </div>
                <span className="ui-pill ui-pill-accent">Windowed</span>
                <div className="ui-trace-cluster" data-open="true">
                  <div className="ui-trace-cluster__summary">
                    <button type="button" className="ui-row-button ui-trace-cluster__summary-button" aria-expanded="true">
                      <span className="ui-trace-cluster__step-count">4 steps</span>
                      <span className="ui-trace-cluster__categories">
                        <span className="ui-pill">thinking</span>
                        <span className="ui-pill ui-pill-accent">subagent</span>
                        <span className="ui-pill">shell</span>
                      </span>
                      <span className="ui-trace-cluster__toggle">hide</span>
                    </button>
                    <span className="ui-trace-cluster__rule" aria-hidden="true" />
                  </div>
                  <div className="ui-trace-cluster__body">
                    <div className="ui-trace-cluster__overflow">
                      <span>2 earlier steps summarized above.</span>
                      <button type="button" className="ui-action-button">
                        Show all
                      </button>
                    </div>
                    <div className="ui-thinking-block">
                      <button type="button" className="ui-row-button ui-thinking-block__header" aria-expanded="true">
                        <span className="ui-pill">Thinking</span>
                        <span className="ui-thinking-block__preview">Checking inherited transcript surfaces.</span>
                        <span className="ui-thinking-block__toggle">hide</span>
                      </button>
                      <div className="ui-thinking-block__body">
                        <p>Style only the windowed shell, keep normal chat untouched.</p>
                        <p>Verify light and dark before checkpointing.</p>
                      </div>
                    </div>
                    <div className="ui-subagent-block" data-status="complete">
                      <button type="button" className="ui-row-button ui-subagent-block__header" aria-expanded="true">
                        <span className="ui-pill ui-pill-accent">subagent</span>
                        <span className="ui-subagent-block__name">visual-qa</span>
                        <span className="ui-pill ui-pill-success">complete</span>
                        <span className="ui-subagent-block__toggle">hide</span>
                      </button>
                      <div className="ui-subagent-block__body">
                        <div className="ui-subagent-block__section">
                          <span className="ui-section-label">Prompt</span>
                          <p className="ui-subagent-block__text">Inspect the windowed trace chrome for imported web styling.</p>
                        </div>
                        <div className="ui-subagent-block__section">
                          <span className="ui-section-label">Result</span>
                          <p className="ui-subagent-block__text">
                            Trace panels now follow the desktop border, type, and disclosure rhythm.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ui-tool-block">
                  <div className="ui-tool-block__body">
                    Ran package checks for packages/windowed-os-ui/src/windowedOs.stories.tsx with compact transcript wrapping
                  </div>
                  <div className="ui-tool-block__linked-runs">
                    <div className="ui-tool-block__linked-runs-summary">
                      linked run: windowed-os-storybook-qa-compact-dark-transcript-long-output
                    </div>
                    <button type="button" className="ui-tool-block__linked-run">
                      windowed-os-ui tests / compact-chat-transcript / dark / terminal-and-tool-output-wrapping
                    </button>
                  </div>
                  <div className="ui-tool-block__output">
                    <pre className="ui-tool-block__pre">
                      114 tests passed{'\n'}
                      packages/windowed-os-ui/src/windowedOs.stories.tsx:checked-long-output-without-horizontal-window-growth
                    </pre>
                  </div>
                </div>
                <div className="ui-notice ui-notice-danger ui-error-block">
                  <div className="ui-error-block__body">
                    <div className="ui-error-block__message">
                      <span className="ui-error-block__tool">browser_snapshot ·</span>
                      <span className="ui-error-block__text">
                        Could not capture the browser surface because the native view was covered by another desktop window.
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ui-image-preview" data-loaded="true">
                  <button
                    type="button"
                    className="ui-media-preview-button ui-image-preview__button"
                    aria-label="Inspect image: Windowed OS sketch"
                  >
                    <img src={storyImagePreviewSrc} alt="Windowed OS sketch" className="ui-image-preview__media" />
                  </button>
                  <div className="ui-image-preview__caption">
                    <p className="ui-image-preview__caption-text">Windowed OS sketch</p>
                  </div>
                </div>
                <div className="ui-image-preview">
                  <div className="ui-image-preview__placeholder">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ui-image-preview__placeholder-icon"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <span className="ui-image-preview__placeholder-label">deferred-preview.png</span>
                    <span className="ui-image-preview__placeholder-meta">1280×720</span>
                    <button type="button" className="ui-action-button">
                      Load image
                    </button>
                  </div>
                  <div className="ui-image-preview__caption">
                    <p className="ui-image-preview__caption-text">Deferred preview</p>
                  </div>
                </div>
                <div data-transcript-event="ask-user-question">
                  <div className="ui-ask-user-question__header">
                    <span className="ui-ask-user-question__glyph" aria-hidden="true">
                      ?
                    </span>
                    <span className="ui-ask-user-question__title">Question for you</span>
                    <span className="ui-pill ui-pill-warning">pending</span>
                    <span className="ui-ask-user-question__progress">1/2 answered</span>
                  </div>
                  <p className="ui-ask-user-question__details">
                    Choose how aggressively the next windowed pass should modify inherited chat chrome.
                  </p>
                  <div className="ui-ask-user-question__tabs" role="tablist" aria-label="Question navigation">
                    <button type="button" className="ui-action-button" role="tab" aria-selected="true">
                      <span aria-hidden="true">•</span>
                      Styling scope
                    </button>
                    <button type="button" className="ui-action-button" role="tab" aria-selected="false">
                      <span aria-hidden="true">○</span>
                      QA depth
                    </button>
                  </div>
                  <div className="ui-ask-user-question__panel" role="tabpanel">
                    <span className="ui-section-label">Question 1 of 2</span>
                    <p className="ui-ask-user-question__prompt">Which surface should be styled next?</p>
                    <div className="ui-ask-user-question__choices" role="radiogroup" aria-label="Which surface should be styled next?">
                      <button type="button" className="ui-choice-row ui-choice-row-checked" role="radio" aria-checked="true">
                        <span className="ui-choice-row-prefix" aria-hidden="true">
                          1.
                        </span>
                        <span className="ui-choice-row-indicator ui-choice-row-indicator-checked" aria-hidden="true">
                          ◉
                        </span>
                        <span className="ui-choice-row-main">
                          <span className="ui-choice-row-label">Composer attachments</span>
                          <span className="ui-choice-row-details">Keep tightening the conversation window controls.</span>
                        </span>
                      </button>
                      <button type="button" className="ui-choice-row" role="radio" aria-checked="false">
                        <span className="ui-choice-row-prefix" aria-hidden="true">
                          2.
                        </span>
                        <span className="ui-choice-row-indicator" aria-hidden="true">
                          ◯
                        </span>
                        <span className="ui-choice-row-main">
                          <span className="ui-choice-row-label">Tool tabs</span>
                          <span className="ui-choice-row-details">Audit the attached browser and file surface again.</span>
                        </span>
                      </button>
                    </div>
                  </div>
                  <p className="ui-ask-user-question__hint">1-9 selects - n/p switches questions - Esc exits</p>
                </div>
                <div className="ui-terminal-block">
                  <div className="ui-terminal-block__chrome">
                    <span className="ui-terminal-block__command">
                      pnpm --dir packages/windowed-os-ui run qa:storybook -- --story windowed-os-desktop-shell--dark-inherited-chat-chrome
                    </span>
                    <span className="ui-pill ui-pill-accent">shell</span>
                  </div>
                  <div className="ui-terminal-block__body">
                    <pre className="ui-terminal-block__output">
                      PASS src/windowedOs.test.tsx{'\n'}116 tests passed{'\n'}
                      /Users/patrick/workingdir/neon-pilot/packages/windowed-os-ui/storybook-static/iframe.html?id=windowed-os-desktop-shell--dark-inherited-chat-chrome
                    </pre>
                    <p className="ui-terminal-block__muted">Waiting for output from compact dark transcript QA...</p>
                    <pre aria-label="No terminal output" className="ui-terminal-block__empty-output">
                      no-output-yet-but-this-placeholder-still-wraps-inside-the-terminal-block
                    </pre>
                  </div>
                  <div className="ui-terminal-block__chrome ui-terminal-block__muted">
                    <span>exit 0</span>
                    <span>2.4s</span>
                  </div>
                </div>
                <div className="ui-panel-muted ui-inline-run-card">
                  <div className="ui-inline-run-card__summary">
                    <button type="button" className="ui-row-button">
                      <span className="ui-pill ui-pill-accent">shell</span>
                      <span className="ui-pill ui-pill-success">complete</span>
                      <span className="ui-inline-run-card__title">Background task: desktop-mode QA</span>
                    </button>
                    <a href="https://example.com" className="ui-action-button">
                      Open conversation
                    </a>
                  </div>
                  <div className="ui-inline-run-card__details">
                    <div className="ui-panel-muted ui-inline-run-card__output">
                      <div className="ui-inline-run-card__output-header">
                        <span className="ui-status-dot ui-status-dot-sm ui-status-dot-muted" />
                        <span className="ui-section-label">Output</span>
                        <span className="ui-inline-run-card__path">output.log</span>
                      </div>
                      <pre>Windowed Storybook visual check passed.</pre>
                    </div>
                    <details className="ui-disclosure" open>
                      <summary className="ui-disclosure-summary">
                        <span>Details</span>
                        <span className="ui-disclosure-meta">Command details</span>
                      </summary>
                      <div className="ui-disclosure-body">
                        <div className="ui-inline-run-card__metadata-row">
                          <span className="ui-section-label">Command</span>
                          <span>pnpm --dir packages/windowed-os-ui run build:storybook</span>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            </section>
            <section className="conversation-composer-region" aria-label="Composer preview">
              <div className="conversation-composer-inner">
                <div className="ui-composer-notice" data-tone="warning">
                  <span className="ui-pill ui-pill-warning ui-composer-notice__pill">No workspace attached</span>
                </div>
                <div className="ui-input-shell">
                  <div className="ui-composer-attachment-shelf">
                    <div className="ui-composer-attachment-shelf__row">
                      <div className="ui-attachment-chip">
                        <button type="button" className="ui-attachment-chip-button" aria-label="Preview windowed-os-notes.png">
                          <span aria-hidden="true">img</span>
                          <span className="ui-attachment-chip__name">windowed-os-notes.png</span>
                          <span className="ui-attachment-chip__meta">412 KB</span>
                        </button>
                        <button type="button" className="ui-icon-button" aria-label="Remove windowed-os-notes.png">
                          x
                        </button>
                      </div>
                      <div className="ui-attachment-chip">
                        <button type="button" className="ui-attachment-chip-button" aria-label="Preview desktop sketch">
                          <span className="ui-attachment-chip__preview" aria-hidden="true" />
                          <span className="ui-attachment-chip__name">Desktop sketch</span>
                          <span className="ui-attachment-chip__meta">new drawing</span>
                        </button>
                        <button type="button" className="ui-text-button">
                          edit
                        </button>
                        <button type="button" className="ui-icon-button" aria-label="Remove desktop sketch">
                          x
                        </button>
                      </div>
                    </div>
                    <div className="ui-composer-attachment-shelf__status">Syncing drawings...</div>
                  </div>
                  <div className="ui-composer-input-controls">
                    <div className="ui-composer-input-controls__editor">
                      <textarea aria-label="Message" placeholder="Message Neon Pilot" />
                    </div>
                    <div className="ui-composer-input-controls__control-row">
                      <div className="ui-composer-input-controls__leading">
                        <button type="button" className="ui-composer-tool-button" aria-label="Attach file">
                          +
                        </button>
                        <button type="button" className="ui-composer-model-fallback">
                          GPT-5.3
                        </button>
                        <div className="ui-composer-preferences-row">
                          <button type="button" className="ui-composer-preferences-row__menu-button" aria-label="Thinking">
                            T
                          </button>
                          <span className="ui-menu-trigger-inline">Default</span>
                        </div>
                      </div>
                      <div className="ui-composer-input-controls__actions">
                        <div className="ui-composer-actions">
                          <button
                            type="button"
                            className="ui-composer-action-button ui-composer-action-button-accent ui-composer-action-button-icon"
                            aria-label="Send"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="ui-composer-action-button ui-composer-action-button-warning ui-composer-action-button-label"
                          >
                            Steer
                          </button>
                          <button
                            type="button"
                            className="ui-composer-action-button ui-composer-action-button-danger ui-composer-action-button-icon"
                            aria-label="Stop"
                          >
                            ■
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ui-composer-meta">
                  <span className="ui-composer-meta__primary">GPT-5.3 Codex Spark</span>
                  <span className="ui-composer-meta__workspace">Chat - no workspace</span>
                </div>
                <div className="ui-positioned-menu-static" role="menu" aria-label="Model menu preview">
                  <button type="button" className="ui-context-menu-item" role="menuitem">
                    Model GPT-5.3 Codex Spark
                  </button>
                  <button type="button" className="ui-context-menu-item bg-elevated" role="menuitem">
                    Thinking Default
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

export const InheritedChatChrome: Story = {
  render: () => <InheritedChatChromeStory />,
};

export const DarkInheritedChatChrome: Story = {
  render: () => <InheritedChatChromeStory theme="dark" />,
};

function ImageInspectDialogStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh' }}>
      <div
        className="ui-image-inspect-backdrop"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div className="ui-image-inspect-dialog" role="dialog" aria-modal="true" aria-label="Inspect image: Windowed OS sketch">
          <button type="button" className="ui-icon-button" aria-label="Close image inspector">
            x
          </button>
          <div className="ui-image-inspect-stage">
            <img src={storyImagePreviewSrc} alt="Windowed OS sketch preview" className="ui-image-inspect-media" />
          </div>
          <div className="ui-image-inspect-caption">
            <p className="ui-image-inspect-caption__label">Windowed OS sketch preview</p>
            <p className="ui-image-inspect-caption__meta">PNG · 1280x720 · Generated from chat attachment</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ImageInspectDialog: Story = {
  render: () => <ImageInspectDialogStory />,
};

export const DarkImageInspectDialog: Story = {
  render: () => <ImageInspectDialogStory theme="dark" />,
};

export const NavigationPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 760, padding: 24 }}>
      <WindowFrame
        title="Navigation"
        accent="apps"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(560px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageMain title="Navigation">
          <WindowedPageSection title="Menu apps">
            <div style={{ display: 'grid', gap: 6, padding: 10 }}>
              <WindowedAppTile label="Chat" accent="chat" />
              <WindowedAppTile label="Automations" accent="automations" />
              <WindowedAppTile label="Browser" accent="gateways" />
            </div>
          </WindowedPageSection>
          <WindowedPageSection title="Taskbar apps">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
              <span className="wos-taskbar__button">
                <WindowedAppTile label="Chat" accent="chat" count={3} variant="taskbar" />
              </span>
              <span className="wos-taskbar__button">
                <WindowedAppTile label="Browser" accent="gateways" variant="taskbar" />
              </span>
              <span className="wos-taskbar__button">
                <WindowedAppTile label="Terminal" meta="New conversation" accent="chat" variant="taskbar" />
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
          <WindowedPageSection title="Inherited selection">
            <style>
              {`
                .windowed-os-shell .ui-list-row-selected {
                  position: relative;
                  min-height: 36px;
                  border: var(--wos-border-strong) solid var(--wos-ink-900);
                  border-radius: 7px;
                  background: color-mix(in srgb, var(--wos-chat) 12%, var(--wos-surface-1));
                  padding: 8px 10px;
                  font: var(--wos-text-row);
                }

                .windowed-os-shell .ui-list-row-selected::before {
                  content: '';
                  position: absolute;
                  left: 0.45rem;
                  top: 0.38rem;
                  bottom: 0.38rem;
                  width: 2px;
                  border-radius: 999px;
                  background: red;
                }
              `}
            </style>
            <div style={{ display: 'grid', gap: 8, padding: 10 }}>
              <div className="ui-list-row-selected">Selected inherited row</div>
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
    <div className="wos-theme-variant-grid">
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
          style={{ minHeight: 520 }}
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

export const TimeOfDayThemePhases: Story = {
  render: () => (
    <div className="wos-theme-phase-grid" aria-label="Time of day theme phases">
      {timeOfDayPhases.map((theme) => (
        <div
          key={theme.phase}
          className="windowed-os-shell wos-theme-phase-card"
          data-wos-theme={theme.resolved}
          data-wos-theme-mode="auto"
          data-wos-theme-phase={theme.phase}
        >
          <WindowFrame
            title={theme.title}
            accent={theme.resolved === 'dark' ? 'chat' : 'settings'}
            focused={theme.phase === 'bright-noon'}
            style={{ position: 'relative', left: 0, top: 0, width: '100%', height: 260 }}
            onMinimize={() => undefined}
            onMaximize={() => undefined}
            onClose={() => undefined}
          >
            <WindowedPageMain
              title={theme.time}
              actions={<WindowedBadge tone={theme.resolved === 'dark' ? 'warning' : 'positive'}>{theme.badge}</WindowedBadge>}
            >
              <WindowedPageSection title={theme.phase} meta={theme.resolved}>
                <WindowedToolbar
                  end={
                    <WindowedToggle
                      checked
                      accent={theme.resolved === 'dark' ? 'chat' : 'settings'}
                      label={`${theme.title} automatic theme`}
                    />
                  }
                >
                  <WindowedSegmentedControl
                    ariaLabel={`${theme.title} resolved theme`}
                    value={theme.resolved}
                    options={[
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                    ]}
                  />
                </WindowedToolbar>
              </WindowedPageSection>
            </WindowedPageMain>
          </WindowFrame>
        </div>
      ))}
    </div>
  ),
};

function DenseAppPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 620, padding: 24 }}>
      <WindowFrame
        title="Browser"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 560 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="Browser" actions={<WindowedPageButton tone="accent">Refresh</WindowedPageButton>}>
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
                  { label: 'Setup', value: '/browser' },
                  { label: 'Configuration', value: 'Browser page' },
                  {
                    label: 'Enabled',
                    value: <WindowedToggle checked accent="gateways" label="Toggle Browser preview" />,
                  },
                ]}
              />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  );
}

export const DenseAppPage: Story = {
  render: () => <DenseAppPageStory />,
};

export const DarkDenseAppPage: Story = {
  render: () => <DenseAppPageStory theme="dark" />,
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
              <StoryTokenActivityChart />
              <StoryTimeSeriesChart />
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  ),
};

type SettingsStorySectionId = 'appearance' | 'providers' | 'desktop' | 'shortcuts';

const settingsStorySections: Array<{
  id: SettingsStorySectionId;
  title: string;
  status?: ReactNode;
}> = [
  { id: 'appearance', title: 'Appearance' },
  { id: 'providers', title: 'Providers', status: <WindowedBadge tone="positive">2</WindowedBadge> },
  { id: 'desktop', title: 'Desktop', status: <WindowedBadge tone="neutral">Beta</WindowedBadge> },
  { id: 'shortcuts', title: 'Shortcuts' },
];

function SettingsPageContent({ activeSection }: { activeSection: SettingsStorySectionId }) {
  if (activeSection === 'providers') {
    return (
      <WindowedPageMain title="Providers" actions={<WindowedPageButton tone="accent">Connect</WindowedPageButton>}>
        <WindowedSettingsGroup title="Configured providers">
          <WindowedSettingsRow title="OpenAI" description="Connected">
            <WindowedToggle checked accent="settings" label="Enable OpenAI provider" />
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Anthropic" description="Connected">
            <WindowedToggle checked accent="settings" label="Enable Anthropic provider" />
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Local bridge" description="Not configured">
            <WindowedPageButton>Configure</WindowedPageButton>
          </WindowedSettingsRow>
        </WindowedSettingsGroup>
        <WindowedSettingsGroup title="Routing">
          <WindowedSettingsRow title="Default model" description="Auto">
            <WindowedSelect aria-label="Default model">
              <option>Auto</option>
              <option>GPT-5.4</option>
              <option>Claude Sonnet</option>
            </WindowedSelect>
          </WindowedSettingsRow>
        </WindowedSettingsGroup>
      </WindowedPageMain>
    );
  }

  if (activeSection === 'desktop') {
    return (
      <WindowedPageMain title="Desktop">
        <WindowedSettingsGroup title="Window behavior">
          <WindowedSettingsRow title="Windowed mode" description="Enabled">
            <WindowedToggle checked accent="settings" label="Enable windowed desktop mode" />
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Snap preview" description="Enabled">
            <WindowedToggle checked accent="settings" label="Show snap preview" />
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Default chat width" description="1120 px">
            <WindowedNumberStepper aria-label="Default chat width" value={1120} min={720} max={1440} unit="px" onChange={() => undefined} />
          </WindowedSettingsRow>
        </WindowedSettingsGroup>
      </WindowedPageMain>
    );
  }

  if (activeSection === 'shortcuts') {
    return (
      <WindowedPageMain title="Shortcuts" actions={<WindowedPageButton>Record shortcut</WindowedPageButton>}>
        <WindowedSettingsGroup title="Desktop shortcuts">
          <WindowedSettingsRow title="New conversation">
            <WindowedBadge tone="neutral">⌘ N</WindowedBadge>
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Open workspace">
            <WindowedBadge tone="neutral">⌘ ⇧ B</WindowedBadge>
          </WindowedSettingsRow>
          <WindowedSettingsRow title="Command palette">
            <WindowedBadge tone="neutral">⌘ K</WindowedBadge>
          </WindowedSettingsRow>
        </WindowedSettingsGroup>
      </WindowedPageMain>
    );
  }

  return (
    <WindowedPageMain title="Appearance" actions={<WindowedPageButton>Reset</WindowedPageButton>}>
      <WindowedSettingsGroup title="Interface">
        <WindowedSettingsRow title="Theme" description="System" actionsClassName="settings-page-control-actions">
          <WindowedSelect aria-label="Theme">
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </WindowedSelect>
        </WindowedSettingsRow>
        <WindowedSettingsRow title="Accent" description="Orange">
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
        <WindowedSettingsRow title="Interface scale" description="Comfortable">
          <WindowedSegmentedControl
            ariaLabel="Interface scale"
            value="comfortable"
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </WindowedSettingsRow>
        <WindowedSettingsRow title="Monospace size" description="12 px">
          <WindowedNumberStepper aria-label="Monospace size" value={12} min={10} max={16} unit="px" onChange={() => undefined} />
        </WindowedSettingsRow>
      </WindowedSettingsGroup>
    </WindowedPageMain>
  );
}

function SettingsTwoColumnPageStory({
  theme = 'light',
  activeSection = 'appearance',
}: {
  theme?: 'light' | 'dark';
  activeSection?: SettingsStorySectionId;
}) {
  return (
    <div
      className="windowed-os-shell"
      data-wos-theme={theme}
      data-wos-theme-mode={theme}
      style={{ boxSizing: 'border-box', minHeight: '100vh', height: '100vh', overflow: 'hidden', padding: 24 }}
    >
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
              {settingsStorySections.map((section) => (
                <WindowedListItem
                  key={section.id}
                  title={section.title}
                  active={activeSection === section.id}
                  accent="settings"
                  status={section.status}
                  onSelect={() => undefined}
                />
              ))}
            </WindowedList>
          </WindowedPageRail>
          <SettingsPageContent activeSection={activeSection} />
        </WindowedPageShell>
      </WindowFrame>
    </div>
  );
}

export const SettingsTwoColumnPage: Story = {
  render: () => <SettingsTwoColumnPageStory />,
};

export const DarkSettingsTwoColumnPage: Story = {
  render: () => <SettingsTwoColumnPageStory theme="dark" />,
};

export const SettingsPage: Story = {
  render: () => <SettingsTwoColumnPageStory />,
};

export const DarkSettingsPage: Story = {
  render: () => <SettingsTwoColumnPageStory theme="dark" />,
};

export const SettingsProvidersPage: Story = {
  render: () => <SettingsTwoColumnPageStory activeSection="providers" />,
};

export const DarkSettingsProvidersPage: Story = {
  render: () => <SettingsTwoColumnPageStory theme="dark" activeSection="providers" />,
};

export const SettingsDesktopPage: Story = {
  render: () => <SettingsTwoColumnPageStory activeSection="desktop" />,
};

export const DarkSettingsDesktopPage: Story = {
  render: () => <SettingsTwoColumnPageStory theme="dark" activeSection="desktop" />,
};

export const SettingsShortcutsPage: Story = {
  render: () => <SettingsTwoColumnPageStory activeSection="shortcuts" />,
};

export const DarkSettingsShortcutsPage: Story = {
  render: () => <SettingsTwoColumnPageStory theme="dark" activeSection="shortcuts" />,
};

function StandardSinglePanePageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 520, padding: 24 }}>
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
  );
}

export const StandardSinglePanePage: Story = {
  render: () => <StandardSinglePanePageStory />,
};

export const DarkStandardSinglePanePage: Story = {
  render: () => <StandardSinglePanePageStory theme="dark" />,
};

export const CanonicalDensity: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 740, padding: 24 }}>
      <WindowFrame
        title="Canonical density"
        accent="apps"
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
                  <WindowedTextInput defaultValue="Browser preview" aria-label="Name" />
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
                    defaultValue="Summarize merged changes since the last release checkpoint. Group updates by app and include blockers only when action is required."
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

function AutomationsPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
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
      <WindowedDialog
        title="Automation details"
        accent="automations"
        className="wos-automation-dialog wos-automation-dialog--details"
        parentWindowTitle="Automations"
        subwindowId="automation-details"
        onClose={() => undefined}
      >
        <WindowedPageSection title="Details">
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
  );
}

export const AutomationsPage: Story = {
  render: () => <AutomationsPageStory />,
};

export const DarkAutomationsPage: Story = {
  render: () => <AutomationsPageStory theme="dark" />,
};
function DiagnosticsPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
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
            <WindowedPageSection title="Overview" meta="24H · Loaded" className="wos-diagnostics-overview">
              <WindowedKeyValueGrid
                columns={4}
                items={[
                  { label: 'Sessions', value: '8' },
                  { label: 'Runs', value: '42' },
                  { label: 'Tools', value: '216' },
                  { label: 'Errors', value: <WindowedBadge tone="warning">2</WindowedBadge> },
                ]}
              />
              <div className="wos-diagnostics-overview__charts">
                <StoryTokenActivityChart />
                <StoryTimeSeriesChart />
              </div>
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
                  cells={[{ value: <WindowedBadge tone="positive">1.1M</WindowedBadge> }, { value: '71%', align: 'right' }]}
                />
                <WindowedDataRow
                  name="gpt-5.4-mini"
                  meta="subagents and checks"
                  cells={[{ value: <WindowedBadge tone="neutral">412K</WindowedBadge> }, { value: '63%', align: 'right' }]}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Tools" meta="216 calls">
              <WindowedDataTable columns={[{ label: 'Tool' }, { label: 'Calls' }, { label: 'Errors', align: 'right' }]}>
                <WindowedDataRow
                  name="exec_command"
                  meta="local validation"
                  cells={[{ value: <WindowedBadge tone="positive">128</WindowedBadge> }, { value: '0', align: 'right' }]}
                />
                <WindowedDataRow
                  name="browser_snapshot"
                  meta="Browser app"
                  cells={[{ value: <WindowedBadge tone="warning">18</WindowedBadge> }, { value: '2', align: 'right' }]}
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
  );
}

export const DiagnosticsPage: Story = {
  render: () => <DiagnosticsPageStory />,
};

export const DarkDiagnosticsPage: Story = {
  render: () => <DiagnosticsPageStory theme="dark" />,
};

function AppManagerPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
      <WindowFrame
        title="App Manager"
        accent="apps"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 660 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="App Manager"
            actions={
              <>
                <WindowedPageButton>Reload</WindowedPageButton>
                <WindowedPageButton>Update all (3)</WindowedPageButton>
                <WindowedPageButton tone="accent">Build</WindowedPageButton>
                <WindowedPageButton>Install</WindowedPageButton>
              </>
            }
          >
            <WindowedPageSection variant="toolbar">
              <WindowedToolbar
                end={
                  <WindowedSegmentedControl
                    ariaLabel="App view"
                    accent="apps"
                    value="all"
                    options={[
                      { id: 'all', label: 'Installed 16' },
                      { id: 'platform', label: 'Platform 8' },
                      { id: 'attention', label: 'Attention 2' },
                    ]}
                    onChange={() => undefined}
                  />
                }
              >
                <WindowedTextInput aria-label="Search apps" placeholder="Search apps" />
              </WindowedToolbar>
            </WindowedPageSection>

            <WindowedPageSection title="Catalog" meta="2 sources">
              <WindowedKeyValueGrid
                columns={3}
                items={[
                  { label: 'Catalog', value: 'Loaded' },
                  { label: 'Available', value: '7' },
                  { label: 'Visible', value: '16 installed · 14 enabled' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Installed" meta="16 installed · 14 enabled">
              <WindowedDataTable columns={[{ label: 'App' }, { label: 'Status' }, { label: 'Controls', align: 'right' }]}>
                <WindowedDataRow
                  name="system-browser"
                  meta="Built-in · Chat tools"
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
                      <WindowedToggle checked accent="apps" label="Disable system-browser" />
                      <WindowedPageButton>Details</WindowedPageButton>
                      <WindowedPageButton>Open</WindowedPageButton>
                    </span>
                  }
                />
                <WindowedDataRow
                  name="system-terminal"
                  meta="Built-in · Chat tools"
                  status={<WindowedBadge tone="positive">Enabled</WindowedBadge>}
                  action={
                    <span className="wos-inline-actions">
                      <WindowedToggle checked accent="apps" label="Disable system-terminal" />
                      <WindowedPageButton>Details</WindowedPageButton>
                      <WindowedPageButton>Open</WindowedPageButton>
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
                      <WindowedToggle disabled accent="apps" label="Enable workflow-reports" />
                      <WindowedPageButton>Details</WindowedPageButton>
                    </span>
                  }
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
      <WindowedDialog
        title="system-browser"
        meta="update available"
        accent="apps"
        parentWindowTitle="App Manager"
        onClose={() => undefined}
        actions={
          <>
            <WindowedPageButton>Open</WindowedPageButton>
            <WindowedPageButton>Settings</WindowedPageButton>
            <WindowedPageButton>Folder</WindowedPageButton>
          </>
        }
      >
        <div className="wos-app-detail-grid">
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
              { label: 'Appears in', value: 'Chat tools' },
              { label: 'Skills', value: 'None' },
              { label: 'Tools', value: 'browser_snapshot, browser_cdp' },
            ]}
          />
          <p className="wos-app-detail-description">Browser app surfaces and automation tools.</p>
        </div>
      </WindowedDialog>
    </div>
  );
}

export const AppManagerPage: Story = {
  render: () => <AppManagerPageStory />,
};

export const DarkAppManagerPage: Story = {
  render: () => <AppManagerPageStory theme="dark" />,
};

function AppInstallDialogStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 560, padding: 24 }}>
      <WindowFrame
        title="App Manager"
        accent="apps"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(920px, 100%)', height: 540 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain title="App Manager" actions={<WindowedPageButton tone="accent">Install</WindowedPageButton>}>
            <WindowedPageSection title="Installed" meta="18">
              <WindowedDataTable columns={[{ label: 'App' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
                <WindowedDataRow
                  name="system-browser"
                  meta="Browser app and automation tools"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<WindowedPageButton>Details</WindowedPageButton>}
                />
              </WindowedDataTable>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>

        <WindowedDialog
          title="Install app"
          meta="3 available · 2 sources"
          accent="apps"
          parentWindowTitle="App Manager"
          className="wos-app-install-dialog"
          onClose={() => undefined}
        >
          <div className="wos-app-install">
            <WindowedPageSection title="Repositories" meta="2">
              <WindowedToolbar>
                <WindowedTextInput aria-label="App repository" placeholder="GitHub URL or owner/name" />
                <WindowedPageButton>Add</WindowedPageButton>
              </WindowedToolbar>
              <WindowedDataTable columns={[{ label: 'Source' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
                <WindowedDataRow
                  name="Personal marketplace"
                  meta="patrick/apps"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<WindowedPageButton>Remove</WindowedPageButton>}
                />
                <WindowedDataRow
                  name="Neon Pilot"
                  meta="neon-pilot/apps"
                  status={<WindowedBadge tone="positive">enabled</WindowedBadge>}
                  action={<span aria-hidden="true" />}
                />
              </WindowedDataTable>
            </WindowedPageSection>

            <WindowedPageSection title="Available" meta="3">
              <WindowedToolbar>
                <WindowedTextInput aria-label="Search available apps" placeholder="Search apps" />
              </WindowedToolbar>
              <WindowedDataTable columns={[{ label: 'App' }, { label: 'State' }, { label: 'Actions', align: 'right' }]}>
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
  );
}

export const AppInstallDialog: Story = {
  render: () => <AppInstallDialogStory />,
};

export const DarkAppInstallDialog: Story = {
  render: () => <AppInstallDialogStory theme="dark" />,
};

function SkillsPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
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

            <WindowedPageSection variant="toolbar">
              <WindowedToolbar as="form" formProps={{ onSubmit: (event) => event.preventDefault() }}>
                <WindowedTextInput aria-label="Search marketplace skills" placeholder="Search marketplace skills" />
                <WindowedPageButton>Clear</WindowedPageButton>
                <WindowedPageButton tone="accent" type="submit">
                  Search
                </WindowedPageButton>
              </WindowedToolbar>
            </WindowedPageSection>

            <WindowedPageSection variant="toolbar">
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
      </WindowFrame>
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
    </div>
  );
}

export const SkillsPage: Story = {
  render: () => <SkillsPageStory />,
};

export const DarkSkillsPage: Story = {
  render: () => <SkillsPageStory theme="dark" />,
};

export const CoreDataPrimitives: Story = {
  render: () => (
    <div className="windowed-os-shell" style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="App Manager"
        accent="apps"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(760px, 100%)', height: 430 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageMain title="App Manager" actions={<WindowedPageButton tone="accent">New</WindowedPageButton>}>
          <WindowedPageSection title="Installed" meta="3 enabled">
            <WindowedDataTable columns={[{ label: 'App' }, { label: 'Status' }, { label: 'Enabled', align: 'right' }]}>
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

function TerminalWindowStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 520, padding: 24 }}>
      <WindowFrame
        title="Terminal"
        accent="apps"
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
  );
}

export const TerminalWindow: Story = {
  render: () => <TerminalWindowStory />,
};

export const DarkTerminalWindow: Story = {
  render: () => <TerminalWindowStory theme="dark" />,
};

function WorkspaceWindowStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 620, padding: 24 }}>
      <WindowFrame
        title="Files"
        accent="chat"
        focused
        parentWindowTitle="New conversation"
        style={{ position: 'relative', left: 0, top: 0, width: 'min(780px, 100%)', height: 540 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div
          className="wos-window-route-body wos-window-route-body--files"
          data-windowed-subwindow="files"
          data-parent-window-title="New conversation"
        >
          <div className="wos-chat-files-dialog__body" data-windowed-subwindow="files">
            <div className="wos-workspace-child-preview" aria-label="Files preview">
              <WindowedWorkspaceLocationBar location="/Users/patrick/workingdir/neon-pilot">
                <WindowedBadge tone="positive">Synced</WindowedBadge>
                <WindowedBadge>5 items</WindowedBadge>
                <WindowedBadge>Directory</WindowedBadge>
              </WindowedWorkspaceLocationBar>
              <WindowedPageSection title="Files" meta="Open">
                <WindowedList>
                  <WindowedListItem title="packages/desktop/ui/src/components" meta="Directory" detail="source" active accent="chat" />
                  <WindowedListItem title="packages/windowed-os-ui/src" meta="Directory" detail="design system" accent="apps" />
                  <WindowedListItem title="to-do/windowed-os.md" meta="Markdown" detail="backlog" accent="skills" />
                  <WindowedListItem title="apps/system-browser" meta="App package" detail="child tool" accent="gateways" />
                  <WindowedListItem title="apps/system-terminal" meta="App package" detail="child tool" accent="automations" />
                </WindowedList>
              </WindowedPageSection>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

export const WorkspaceWindow: Story = {
  render: () => <WorkspaceWindowStory />,
};

export const DarkWorkspaceWindow: Story = {
  render: () => <WorkspaceWindowStory theme="dark" />,
};

function BrowserWindowStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const browserActions: WindowedBrowserToolbarAction[] = [
    { id: 'back', label: 'Go back', icon: '←', disabled: true },
    { id: 'forward', label: 'Go forward', icon: '→', disabled: true },
    { id: 'reload', label: 'Reload browser preview', icon: '↻' },
    { id: 'close', label: 'Close browser tab', icon: '×', placement: 'trailing' },
  ];

  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
      <WindowFrame
        title="Browser"
        accent="chat"
        focused
        parentWindowTitle="New conversation"
        style={{ position: 'relative', left: 0, top: 0, width: 'min(860px, 100%)', height: 500 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <div
          className="wos-window-route-body wos-window-route-body--browser"
          data-windowed-subwindow="browser"
          data-parent-window-title="New conversation"
        >
          <div className="wos-chat-browser-dialog__body">
            <WindowedBrowserToolbar
              address="https://docs.neonpilot.local/releases/windowed-desktop/browser-preview"
              actions={browserActions}
              readOnly
            />
            <div className="ui-windowed-browser-host" data-windowed-browser-host="true" aria-label="Browser child window preview">
              <div className="ui-windowed-browser-host__blocker">
                <div className="ui-windowed-browser-host__state">
                  <WindowedStateBlock title="Browser paused" tone="warning">
                    <span>Native browser content is hidden while another desktop window or overlay is above it.</span>
                    <span className="ui-windowed-browser-host__url">
                      https://docs.neonpilot.local/releases/windowed-desktop/browser-preview
                    </span>
                  </WindowedStateBlock>
                </div>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

export const BrowserWindow: Story = {
  render: () => <BrowserWindowStory />,
};

export const DarkBrowserWindow: Story = {
  render: () => <BrowserWindowStory theme="dark" />,
};

function DrawingsPickerSubwindowStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <WindowedShellBodyAttribute>
      <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 640, padding: 24 }}>
        <div className="ui-overlay-backdrop" role="presentation">
          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby="drawings-picker-title"
            className="ui-dialog-shell ui-windowed-drawings-picker"
            data-windowed-subwindow="drawing-picker"
            data-parent-window-attached="chat"
            data-parent-window-id="chat:release-plan"
            data-parent-window-title="Release planning"
          >
            <header className="ui-dialog-header" data-parent-window-title="Release planning">
              <div className="ui-dialog-header-copy">
                <h2 id="drawings-picker-title" className="ui-dialog-title">
                  Conversation drawings
                </h2>
              </div>
              <div className="ui-dialog-actions">
                <button type="button" className="ui-icon-button" aria-label="Close drawings picker" title="Close drawings picker">
                  x
                </button>
              </div>
            </header>
            <div className="ui-windowed-drawings-picker-body">
              <div className="ui-resource-picker-toolbar">
                <input className="ui-windowed-drawings-picker-filter" aria-label="Filter drawings" value="windowed" readOnly />
                <span className="ui-windowed-drawings-picker-count tabular-nums">2</span>
              </div>
              <div className="ui-resource-picker-list">
                <article className="ui-panel">
                  <div className="ui-windowed-drawing-card__row">
                    <div className="ui-windowed-drawing-card__main">
                      <h3 className="ui-card-title">Windowed OS sketch</h3>
                      <p className="ui-card-meta">drawing-1842 · rev 6 · updated 3m ago</p>
                    </div>
                    <div className="ui-windowed-drawing-card__actions">
                      <button type="button" className="ui-toolbar-button">
                        Attach latest
                      </button>
                      <button type="button" className="ui-toolbar-button" data-active="true">
                        Hide history
                      </button>
                    </div>
                  </div>
                  <div className="ui-panel-muted">
                    <div className="ui-windowed-drawing-revision">
                      <span>rev 6</span>
                      <span>Desktop browser overlay notes</span>
                      <button type="button" className="ui-toolbar-button">
                        Attach
                      </button>
                    </div>
                    <div className="ui-windowed-drawing-revision">
                      <span>rev 5</span>
                      <span>Taskbar grouping pass</span>
                      <button type="button" className="ui-toolbar-button">
                        Attach
                      </button>
                    </div>
                  </div>
                </article>
                <article className="ui-panel">
                  <div className="ui-windowed-drawing-card__row">
                    <div className="ui-windowed-drawing-card__main">
                      <h3 className="ui-card-title">Gateway flow</h3>
                      <p className="ui-card-meta">drawing-1120 · rev 2 · updated yesterday</p>
                    </div>
                    <div className="ui-windowed-drawing-card__actions">
                      <button type="button" className="ui-toolbar-button">
                        Attach latest
                      </button>
                      <button type="button" className="ui-toolbar-button">
                        History
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    </WindowedShellBodyAttribute>
  );
}

export const DrawingsPickerSubwindow: Story = {
  render: () => <DrawingsPickerSubwindowStory />,
};

export const DarkDrawingsPickerSubwindow: Story = {
  render: () => <DrawingsPickerSubwindowStory theme="dark" />,
};

function ExcalidrawEditorSubwindowStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <WindowedShellBodyAttribute>
      <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: 620, padding: 24 }}>
        <div className="ui-overlay-backdrop ui-windowed-excalidraw-backdrop" role="presentation">
          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby="excalidraw-editor-title"
            className="ui-dialog-shell ui-windowed-excalidraw-modal"
            data-windowed-subwindow="drawing-editor"
            data-windowed-child-window="true"
            data-parent-window-attached="chat"
            data-parent-window-id="chat:release-plan"
            data-parent-window-title="Release planning"
          >
            <header className="ui-dialog-header" data-parent-window-title="Release planning">
              <div className="ui-dialog-header-copy">
                <h2 id="excalidraw-editor-title" className="ui-dialog-title">
                  Drawing editor
                </h2>
              </div>
              <div className="ui-dialog-actions">
                <button type="button" className="ui-icon-button" aria-label="Close drawing editor" title="Close drawing editor">
                  x
                </button>
              </div>
            </header>
            <div className="ui-windowed-excalidraw-modal-body">
              <div className="excalidraw-editor-modal">
                <div className="excalidraw-editor-modal__toolbar" aria-label="Drawing controls">
                  <button type="button" className="ui-toolbar-button" data-active="true" aria-pressed="true">
                    Select
                  </button>
                  <button type="button" className="ui-toolbar-button">
                    Shape
                  </button>
                  <button type="button" className="ui-action-button">
                    Save
                  </button>
                  <span className="ui-windowed-excalidraw-status">Saved 3m ago</span>
                </div>
                <div className="excalidraw-editor-modal__canvas">
                  <div className="excalidraw-embed-lite" aria-label="Drawing canvas preview">
                    <div className="excalidraw">
                      <img src={storyImagePreviewSrc} alt="Windowed OS sketch preview" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </WindowedShellBodyAttribute>
  );
}

export const ExcalidrawEditorSubwindow: Story = {
  render: () => <ExcalidrawEditorSubwindowStory />,
};

export const DarkExcalidrawEditorSubwindow: Story = {
  render: () => <ExcalidrawEditorSubwindowStory theme="dark" />,
};

function EmbeddedExtensionPageStory({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <div className="windowed-os-shell" data-wos-theme={theme} data-wos-theme-mode={theme} style={{ minHeight: '100vh', padding: 24 }}>
      <WindowFrame
        title="Browser"
        accent="gateways"
        focused
        style={{ position: 'relative', left: 0, top: 0, width: 'min(1040px, 100%)', height: 620 }}
        onMinimize={() => undefined}
        onMaximize={() => undefined}
        onClose={() => undefined}
      >
        <WindowedPageShell layout="standard">
          <WindowedPageMain
            title="Browser"
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
                  { label: 'Session', value: 'Ready' },
                  { label: 'Address', value: 'Configured' },
                  { label: 'Preview', value: <WindowedBadge tone="warning">Paused</WindowedBadge> },
                  { label: 'Setup', value: '/browser' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Preview controls">
              <WindowedFormGrid columns={2}>
                <WindowedField label="Address">
                  <WindowedTextInput aria-label="Browser address" placeholder="https://docs.neonpilot.local" />
                </WindowedField>
                <WindowedField label="Preview">
                  <WindowedToggle checked accent="gateways" label="Toggle Browser preview" />
                </WindowedField>
              </WindowedFormGrid>
              <WindowedFormActions>
                <WindowedPageButton>Reset</WindowedPageButton>
                <WindowedPageButton tone="accent">Open</WindowedPageButton>
              </WindowedFormActions>
            </WindowedPageSection>

            <WindowedPageSection title="Permissions" meta="Allowed">
              <WindowedKeyValueList
                items={[
                  { label: 'Local preview', value: 'Allowed' },
                  { label: 'External links', value: 'Ask first' },
                ]}
              />
            </WindowedPageSection>

            <WindowedPageSection title="Recent activity">
              <WindowedTimeline>
                <WindowedTimelineItem title="Preview paused" meta="2m ago" tone="warning">
                  Native browser content is hidden while another desktop window is above it.
                </WindowedTimelineItem>
                <WindowedTimelineItem title="Page loaded" meta="Today" tone="positive">
                  Browser preview loaded the requested documentation page.
                </WindowedTimelineItem>
              </WindowedTimeline>
            </WindowedPageSection>
          </WindowedPageMain>
        </WindowedPageShell>
      </WindowFrame>
    </div>
  );
}

export const EmbeddedExtensionPage: Story = {
  render: () => <EmbeddedExtensionPageStory />,
};

export const DarkEmbeddedExtensionPage: Story = {
  render: () => <EmbeddedExtensionPageStory theme="dark" />,
};
