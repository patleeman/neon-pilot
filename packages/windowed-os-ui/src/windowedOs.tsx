import type { CSSProperties, ReactNode } from 'react';

export type AppAccent = 'chat' | 'routines' | 'automations' | 'gateways' | 'extensions' | 'telemetry' | 'settings';

export interface AppMonogramProps {
  label: string;
  accent?: AppAccent;
  className?: string;
}

export function AppMonogram({ label, accent = 'settings', className }: AppMonogramProps) {
  const letter = label.trim().charAt(0).toUpperCase() || 'N';
  return (
    <span className={['wos-app-monogram', className].filter(Boolean).join(' ')} data-accent={accent} aria-hidden="true">
      {letter}
    </span>
  );
}

export interface StartMenuItem {
  id: string;
  title: string;
  accent?: AppAccent;
  meta?: string;
  onSelect: () => void;
}

export interface StartMenuProps {
  open: boolean;
  items: StartMenuItem[];
  onSelectStableShell: () => void;
}

export function StartMenu({ open, items, onSelectStableShell }: StartMenuProps) {
  if (!open) return null;
  return (
    <div className="wos-start-menu" role="menu">
      <div className="wos-start-menu__header">
        <AppMonogram label="Neon Pilot" accent="extensions" />
        <div>
          <div className="wos-start-menu__title">Neon Pilot OS</div>
          <div className="wos-start-menu__meta">Applications</div>
        </div>
      </div>
      <div className="wos-start-menu__grid">
        {items.map((item) => (
          <button key={item.id} type="button" className="wos-start-menu__item" role="menuitem" onClick={item.onSelect}>
            <AppMonogram label={item.title} accent={item.accent} />
            <span className="wos-start-menu__item-copy">
              <span className="wos-start-menu__item-title">{item.title}</span>
              {item.meta ? <span className="wos-start-menu__item-meta">{item.meta}</span> : null}
            </span>
          </button>
        ))}
      </div>
      <div className="wos-start-menu__footer">
        <button type="button" className="wos-start-menu__stable" onClick={onSelectStableShell}>
          Stable shell
        </button>
      </div>
    </div>
  );
}

export interface TaskbarItem {
  id: string;
  title: string;
  focused?: boolean;
  minimized?: boolean;
  accent?: AppAccent;
  count?: number;
  onSelect: () => void;
}

export interface TaskbarGroup {
  id: string;
  title: string;
  focused?: boolean;
  count?: number;
  accent?: AppAccent;
  onSelect: () => void;
  menu?: ReactNode;
}

export interface TaskbarProps {
  startOpen: boolean;
  onToggleStart: () => void;
  groups?: TaskbarGroup[];
  items: TaskbarItem[];
}

export function Taskbar({ startOpen, onToggleStart, groups = [], items }: TaskbarProps) {
  return (
    <footer className="wos-taskbar">
      <button type="button" className="wos-taskbar__start" aria-haspopup="menu" aria-expanded={startOpen} onClick={onToggleStart}>
        <AppMonogram label="Neon Pilot" accent="extensions" />
        <span>Start</span>
      </button>
      <nav className="wos-taskbar__items" aria-label="Open windows">
        {groups.map((group) => (
          <div key={group.id} className="wos-taskbar__group">
            <button type="button" className="wos-taskbar__button" data-focused={group.focused} onClick={group.onSelect}>
              <AppMonogram label={group.title} accent={group.accent} />
              <span className="wos-taskbar__label">
                {group.title}
                {group.count ? <span className="wos-taskbar__count">{group.count}</span> : null}
              </span>
            </button>
            {group.menu}
          </div>
        ))}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="wos-taskbar__button"
            data-focused={item.focused}
            data-minimized={item.minimized}
            onClick={item.onSelect}
          >
            <AppMonogram label={item.title} accent={item.accent} />
            <span className="wos-taskbar__label">
              {item.title}
              {item.count ? <span className="wos-taskbar__count">{item.count}</span> : null}
            </span>
          </button>
        ))}
      </nav>
    </footer>
  );
}

export interface WindowFrameProps {
  windowId?: string;
  title: string;
  accent?: AppAccent;
  focused?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
  resizeHandles?: ReactNode;
  onPointerDown?: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  restoreLabel?: string;
}

export function WindowFrame({
  windowId,
  title,
  accent = 'settings',
  focused = false,
  style,
  className,
  children,
  resizeHandles,
  onPointerDown,
  onMinimize,
  onMaximize,
  onClose,
  restoreLabel,
}: WindowFrameProps) {
  return (
    <section
      className={['wos-window', className].filter(Boolean).join(' ')}
      data-window-id={windowId}
      data-focused={focused}
      style={style}
      onPointerDown={onPointerDown}
    >
      <header className="wos-window__titlebar" data-accent={accent}>
        <div className="wos-window__identity">
          <AppMonogram label={title} accent={accent} />
          <div className="wos-window__title" title={title}>
            {title}
          </div>
        </div>
        <div className="wos-window__controls">
          <button type="button" aria-label={`Minimize ${title}`} onClick={onMinimize}>
            -
          </button>
          <button type="button" aria-label={restoreLabel ?? `Maximize ${title}`} onClick={onMaximize}>
            □
          </button>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      <div className="wos-window__body">{children}</div>
      {resizeHandles}
    </section>
  );
}
