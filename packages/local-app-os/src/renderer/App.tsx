import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { AppId, AppManifest, PlatformSnapshot, PlatformWindow } from '../shared/platformTypes';

type DragState = {
  windowId: string;
  pointerId: number;
  startX: number;
  startY: number;
  initial: PlatformWindow['bounds'];
};

const emptySnapshot: PlatformSnapshot = {
  apps: [],
  windows: [],
  jobs: [],
  logs: [],
  packages: [],
  events: [],
};

const iconGlyphs: Record<string, string> = {
  spark: '✦',
  chat: '◦',
  grid: '▦',
  sliders: '≡',
  pulse: '⌁',
  log: '☰',
  compass: '⌖',
};

const appTone: Record<AppId, string> = {
  builder: 'var(--accent-warm)',
  chat: 'var(--accent-blue)',
  apps: 'var(--accent-green)',
  'control-panel': 'var(--accent-purple)',
  activity: 'var(--accent-yellow)',
  logs: 'var(--accent-muted)',
  navigation: 'var(--accent-red)',
};

function App() {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(emptySnapshot);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.localOS.invoke({ type: 'snapshot' }).then((next) => {
      if (mounted) {
        setSnapshot(next as PlatformSnapshot);
      }
    });
    const unsubscribe = window.localOS.onUpdate(setSnapshot);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const appMap = useMemo(() => new Map(snapshot.apps.map((manifest) => [manifest.id, manifest])), [snapshot.apps]);

  const focusedWindow = [...snapshot.windows].reverse().find((window) => window.focused);
  const runningAppIds = new Set(snapshot.windows.map((window) => window.appId));

  const launch = useCallback((appId: AppId) => {
    void window.localOS.invoke({ type: 'apps.launch', appId });
  }, []);

  const startDrag = useCallback((event: React.PointerEvent, platformWindow: PlatformWindow) => {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      windowId: platformWindow.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initial: platformWindow.bounds,
    });
    void window.localOS.invoke({ type: 'windows.focus', windowId: platformWindow.id });
  }, []);

  const moveDrag = useCallback(
    (event: React.PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const bounds = {
        ...drag.initial,
        x: Math.max(0, drag.initial.x + event.clientX - drag.startX),
        y: Math.max(44, drag.initial.y + event.clientY - drag.startY),
      };
      void window.localOS.invoke({ type: 'windows.setBounds', windowId: drag.windowId, bounds });
    },
    [drag],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      if (drag && event.pointerId === drag.pointerId) {
        setDrag(null);
      }
    },
    [drag],
  );

  return (
    <div className="shell">
      <TopBar focusedWindow={focusedWindow} />
      <main className="desktop" aria-label="Local app desktop">
        <div className="desktop-glow" />
        <div className="desktop-note">
          <div className="desktop-note-title">Local App OS</div>
          <div>Apps launch into this desktop. Builder is the bootstrap app powered by Pi.</div>
        </div>
        {snapshot.windows.map((platformWindow, index) => {
          const manifest = appMap.get(platformWindow.appId);
          if (!manifest) {
            return null;
          }
          return (
            <DesktopWindow
              key={platformWindow.id}
              app={manifest}
              platformWindow={platformWindow}
              zIndex={20 + index}
              snapshot={snapshot}
              onStartDrag={startDrag}
              onMoveDrag={moveDrag}
              onEndDrag={endDrag}
            />
          );
        })}
      </main>
      <Dock apps={snapshot.apps} runningAppIds={runningAppIds} onLaunch={launch} />
    </div>
  );
}

function TopBar({ focusedWindow }: { focusedWindow?: PlatformWindow }) {
  return (
    <header className="top-bar">
      <div className="traffic-spacer" />
      <button className="workspace-button" type="button">
        Patrick's Workspace
      </button>
      <div className="top-bar-search">Search apps, commands, files...</div>
      <div className="top-bar-context">
        <span>{focusedWindow ? focusedWindow.title : 'Desktop'}</span>
        <button type="button">Command K</button>
      </div>
    </header>
  );
}

function Dock({ apps, runningAppIds, onLaunch }: { apps: AppManifest[]; runningAppIds: Set<AppId>; onLaunch: (appId: AppId) => void }) {
  return (
    <nav className="dock" aria-label="Installed apps">
      {apps.map((app) => (
        <button
          key={app.id}
          className="dock-item"
          data-running={runningAppIds.has(app.id)}
          onClick={() => onLaunch(app.id)}
          style={{ '--app-color': appTone[app.id] } as React.CSSProperties}
          title={app.name}
          type="button"
        >
          <span>{iconGlyphs[app.icon] ?? '□'}</span>
        </button>
      ))}
    </nav>
  );
}

function DesktopWindow({
  app,
  platformWindow,
  zIndex,
  snapshot,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
}: {
  app: AppManifest;
  platformWindow: PlatformWindow;
  zIndex: number;
  snapshot: PlatformSnapshot;
  onStartDrag: (event: React.PointerEvent, platformWindow: PlatformWindow) => void;
  onMoveDrag: (event: React.PointerEvent) => void;
  onEndDrag: (event: React.PointerEvent) => void;
}) {
  const bounds = platformWindow.bounds;
  return (
    <section
      className="window"
      data-focused={platformWindow.focused}
      style={
        {
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          zIndex,
          '--app-color': appTone[app.id],
        } as React.CSSProperties
      }
      onPointerDown={() => window.localOS.invoke({ type: 'windows.focus', windowId: platformWindow.id })}
    >
      <header
        className="window-titlebar"
        onPointerDown={(event) => onStartDrag(event, platformWindow)}
        onPointerMove={onMoveDrag}
        onPointerUp={onEndDrag}
        onPointerCancel={onEndDrag}
      >
        <div className="window-title">
          <span className="window-icon">{iconGlyphs[app.icon] ?? '□'}</span>
          <span>{platformWindow.title}</span>
        </div>
        <div className="window-controls">
          <button
            aria-label={`Package ${app.name}`}
            type="button"
            onClick={() => window.localOS.invoke({ type: 'packages.create', appId: app.id })}
          >
            pkg
          </button>
          <button
            aria-label={`Close ${app.name}`}
            type="button"
            onClick={() => window.localOS.invoke({ type: 'windows.close', windowId: platformWindow.id })}
          >
            ×
          </button>
        </div>
      </header>
      <div className="window-body">
        <AppContent app={app} snapshot={snapshot} />
      </div>
    </section>
  );
}

function AppContent({ app, snapshot }: { app: AppManifest; snapshot: PlatformSnapshot }) {
  switch (app.id) {
    case 'builder':
      return <BuilderApp snapshot={snapshot} />;
    case 'apps':
      return <AppsApp snapshot={snapshot} />;
    case 'control-panel':
      return <ControlPanelApp snapshot={snapshot} />;
    case 'activity':
      return <ActivityApp snapshot={snapshot} />;
    case 'logs':
      return <LogsApp snapshot={snapshot} />;
    case 'navigation':
      return <NavigationApp snapshot={snapshot} />;
    case 'chat':
      return <ChatApp />;
    default:
      return <GenericApp app={app} />;
  }
}

function BuilderApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  const appCount = snapshot.apps.length;
  return (
    <div className="builder-layout">
      <section className="conversation">
        <p className="message user">Build me a small Navigation app and install it into the dock.</p>
        <p className="message assistant">
          I created an app manifest, wrote a virtual routes file, registered a dock contribution, and launched the app.
        </p>
        <div className="build-summary">
          <div>
            <strong>{appCount}</strong>
            <span>installed apps</span>
          </div>
          <div>
            <strong>{snapshot.packages.length}</strong>
            <span>packages</span>
          </div>
          <div>
            <strong>{snapshot.jobs.length}</strong>
            <span>job runs</span>
          </div>
        </div>
      </section>
      <footer className="composer">
        <span>Ask Pi to build or change an app...</span>
        <button type="button">Send</button>
      </footer>
    </div>
  );
}

function AppsApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  return (
    <div className="app-pane">
      <div className="pane-toolbar">
        <strong>Installed apps</strong>
        <button type="button" onClick={() => window.localOS.invoke({ type: 'packages.create', appId: 'navigation' })}>
          Package Navigation
        </button>
      </div>
      <div className="list-table">
        {snapshot.apps.map((app) => (
          <div className="list-row" key={app.id}>
            <span className="row-icon">{iconGlyphs[app.icon] ?? '□'}</span>
            <div>
              <strong>{app.name}</strong>
              <span>{app.description}</span>
            </div>
            <button type="button" onClick={() => window.localOS.invoke({ type: 'apps.launch', appId: app.id })}>
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlPanelApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  const permissions = snapshot.apps.flatMap((app) => app.permissions.map((permission) => `${app.name}: ${permission}`));
  return (
    <div className="settings-list">
      <SettingRow title="Provider setup" value="Pi connected" />
      <SettingRow title="Secrets" value="OS keychain planned" />
      <SettingRow title="Network policy" value="App-scoped fetch planned" />
      <SettingRow title="Permissions declared" value={`${permissions.length}`} />
    </div>
  );
}

function ActivityApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  return (
    <div className="app-pane">
      <div className="pane-toolbar">
        <strong>Activity Monitor</strong>
        <span>{snapshot.windows.length} windows</span>
      </div>
      <div className="list-table">
        {snapshot.windows.map((windowRecord) => (
          <div className="list-row compact" key={windowRecord.id}>
            <div>
              <strong>{windowRecord.title}</strong>
              <span>
                {windowRecord.appId} · {windowRecord.focused ? 'focused' : 'running'}
              </span>
            </div>
            <button type="button" onClick={() => window.localOS.invoke({ type: 'windows.close', windowId: windowRecord.id })}>
              Kill
            </button>
          </div>
        ))}
        {snapshot.jobs.map((job) => (
          <div className="list-row compact" key={job.id}>
            <div>
              <strong>{job.jobKey}</strong>
              <span>
                {job.appId} · {job.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  return (
    <div className="logs">
      {snapshot.logs.map((entry) => (
        <div className="log-row" key={entry.id} data-level={entry.level}>
          <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
          <strong>{entry.appId}</strong>
          <span>{entry.message}</span>
        </div>
      ))}
    </div>
  );
}

function NavigationApp({ snapshot }: { snapshot: PlatformSnapshot }) {
  const places = snapshotToPlaces(snapshot);
  return (
    <div className="navigation-app">
      <div>
        <h2>Navigation</h2>
        <p>Example generated app using platform storage, files, packaging, and launch APIs.</p>
      </div>
      <div className="route-card">
        <span>Current route</span>
        <strong>Home → Studio</strong>
      </div>
      <div className="places">
        {places.map((place) => (
          <button key={place.key} type="button">
            {place.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatApp() {
  return (
    <div className="chat-app">
      <aside>
        <button type="button">New Conversation ⌘N</button>
        <span>Threads</span>
        <strong>App platform planning</strong>
        <strong>Navigation app</strong>
      </aside>
      <section>
        <p className="message assistant">Chat is a first-party app inside the desktop, not the whole product.</p>
      </section>
    </div>
  );
}

function GenericApp({ app }: { app: AppManifest }) {
  return (
    <div className="generic-app">
      <h2>{app.name}</h2>
      <p>{app.description}</p>
    </div>
  );
}

function SettingRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="setting-row">
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

function snapshotToPlaces(snapshot: PlatformSnapshot) {
  return snapshot.events
    .filter((event) => event.type === 'navigation.place')
    .map((event) => ({ key: event.id, label: String(event.payload) }))
    .concat([
      { key: 'home', label: 'Home' },
      { key: 'studio', label: 'Studio' },
    ])
    .slice(-4);
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
