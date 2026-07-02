import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';

export type AppAccent = 'chat' | 'routines' | 'automations' | 'gateways' | 'extensions' | 'telemetry' | 'settings';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export interface AppMonogramProps {
  label: string;
  accent?: AppAccent;
  className?: string;
}

export function AppMonogram({ label, accent = 'settings', className }: AppMonogramProps) {
  const letter = label.trim().charAt(0).toUpperCase() || 'N';
  return (
    <span className={cx('wos-app-monogram', className)} data-accent={accent} aria-hidden="true">
      {letter}
    </span>
  );
}

export interface WindowedPageShellProps {
  children: ReactNode;
  className?: string;
}

export function WindowedPageShell({ children, className }: WindowedPageShellProps) {
  return <div className={cx('wos-page-shell', className)}>{children}</div>;
}

export interface WindowedPageRailProps {
  title: string;
  accent?: AppAccent;
  children: ReactNode;
  className?: string;
}

export function WindowedPageRail({ title, accent = 'settings', children, className }: WindowedPageRailProps) {
  return (
    <aside className={cx('wos-page-rail', className)}>
      <div className="wos-page-rail__header">
        <AppMonogram label={title} accent={accent} />
        <span>{title}</span>
      </div>
      {children}
    </aside>
  );
}

export interface WindowedPageMainProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WindowedPageMain({ eyebrow, title, description, actions, children, className }: WindowedPageMainProps) {
  return (
    <main className={cx('wos-page-main', className)}>
      <header className="wos-page-main__header">
        <div className="wos-page-main__heading">
          {eyebrow ? <div className="wos-page-eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="wos-page-main__actions">{actions}</div> : null}
      </header>
      <div className="wos-page-main__body">{children}</div>
    </main>
  );
}

export interface WindowedPageInspectorProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}

export function WindowedPageInspector({ eyebrow, title, children, className }: WindowedPageInspectorProps) {
  return (
    <aside className={cx('wos-page-inspector', className)}>
      {eyebrow ? <div className="wos-page-eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {children}
    </aside>
  );
}

export interface WindowedPageSectionProps {
  title?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}

export function WindowedPageSection({ title, meta, children, className }: WindowedPageSectionProps) {
  return (
    <section className={cx('wos-page-section', className)}>
      {title || meta ? (
        <header className="wos-page-section__header">
          {title ? <h3>{title}</h3> : <span />}
          {meta ? <span>{meta}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export interface WindowedPageButtonProps {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'accent';
  type?: 'button' | 'submit';
  className?: string;
}

export function WindowedPageButton({ children, onClick, tone = 'neutral', type = 'button', className }: WindowedPageButtonProps) {
  return (
    <button type={type} className={cx('wos-page-button', className)} data-tone={tone} onClick={onClick}>
      {children}
    </button>
  );
}

export interface WindowedBadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  className?: string;
}

export function WindowedBadge({ children, tone = 'neutral', className }: WindowedBadgeProps) {
  return (
    <span className={cx('wos-badge', className)} data-tone={tone}>
      {children}
    </span>
  );
}

export interface WindowedToggleProps {
  checked?: boolean;
  accent?: AppAccent;
  onChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function WindowedToggle({ checked = false, accent = 'routines', onChange, label = 'Toggle', className }: WindowedToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('wos-toggle', className)}
      data-checked={checked}
      data-accent={accent}
      onClick={() => onChange?.(!checked)}
    >
      <span className="wos-toggle__thumb" aria-hidden="true" />
    </button>
  );
}

export interface WindowedDataRowProps {
  name: string;
  meta?: string;
  enabled?: boolean;
  status?: ReactNode;
  action?: ReactNode;
  onToggle?: (checked: boolean) => void;
  className?: string;
}

export function WindowedDataRow({ name, meta, enabled = false, status, action, onToggle, className }: WindowedDataRowProps) {
  return (
    <div className={cx('wos-data-row', className)}>
      <div className="wos-data-row__identity">
        <div className="wos-data-row__name">{name}</div>
        {meta ? <div className="wos-data-row__meta">{meta}</div> : null}
      </div>
      <div className="wos-data-row__status">
        {status ?? <WindowedBadge tone={enabled ? 'positive' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</WindowedBadge>}
      </div>
      <div className="wos-data-row__action">
        {action ?? (
          <WindowedToggle checked={enabled} accent="chat" label={`${enabled ? 'Disable' : 'Enable'} ${name}`} onChange={onToggle} />
        )}
      </div>
    </div>
  );
}

export interface WindowedDataColumn {
  label: string;
  align?: 'left' | 'right';
}

export interface WindowedDataTableProps {
  columns: WindowedDataColumn[];
  children: ReactNode;
  className?: string;
}

export function WindowedDataTable({ columns, children, className }: WindowedDataTableProps) {
  return (
    <div className={cx('wos-data-table', className)}>
      <div className="wos-data-table__header">
        {columns.map((column) => (
          <div key={column.label} className="wos-data-table__heading" data-align={column.align ?? 'left'}>
            {column.label}
          </div>
        ))}
      </div>
      <div className="wos-data-table__body">{children}</div>
    </div>
  );
}

export interface WindowedChatSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function WindowedChatSurface({ children, className }: WindowedChatSurfaceProps) {
  return <div className={cx('wos-chat-surface', className)}>{children}</div>;
}

export interface WindowedChatRailProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function WindowedChatRail({ title = 'Threads', children, className }: WindowedChatRailProps) {
  return (
    <aside className={cx('wos-chat-rail', className)}>
      <div className="wos-chat-rail__label">{title}</div>
      <div className="wos-chat-rail__list">{children}</div>
    </aside>
  );
}

export interface WindowedThreadItemProps {
  title: string;
  meta?: string;
  active?: boolean;
  onSelect?: () => void;
}

export function WindowedThreadItem({ title, meta, active = false, onSelect }: WindowedThreadItemProps) {
  return (
    <button type="button" className="wos-thread-item" data-active={active} onClick={onSelect}>
      <span className="wos-thread-item__title">{title}</span>
      {meta && !active ? <span className="wos-thread-item__meta">{meta}</span> : null}
    </button>
  );
}

export interface WindowedChatMainProps {
  title: string;
  children: ReactNode;
  composer?: ReactNode;
  className?: string;
}

export function WindowedChatMain({ title, children, composer, className }: WindowedChatMainProps) {
  return (
    <section className={cx('wos-chat-main', className)}>
      <header className="wos-chat-main__header">{title}</header>
      <div className="wos-chat-main__messages">{children}</div>
      {composer ? <div className="wos-chat-main__composer">{composer}</div> : null}
    </section>
  );
}

export interface WindowedMessageBubbleProps {
  children: ReactNode;
  from?: 'user' | 'assistant';
}

export function WindowedMessageBubble({ children, from = 'assistant' }: WindowedMessageBubbleProps) {
  return (
    <div className="wos-message-bubble" data-from={from}>
      {children}
    </div>
  );
}

export interface WindowedChatComposerProps {
  placeholder?: string;
  actionLabel?: string;
}

export function WindowedChatComposer({ placeholder = 'Message Neon Pilot...', actionLabel = 'Send' }: WindowedChatComposerProps) {
  return (
    <div className="wos-chat-composer">
      <div className="wos-chat-composer__input" aria-hidden="true">
        {placeholder}
      </div>
      <button type="button" className="wos-chat-composer__send">
        {actionLabel}
      </button>
    </div>
  );
}

export interface StartMenuItem {
  id: string;
  title: string;
  accent?: AppAccent;
  onSelect: () => void;
}

export interface StartMenuProps {
  open: boolean;
  items: StartMenuItem[];
  onSelectStableShell: () => void;
}

export function StartMenu({ open, items, onSelectStableShell }: StartMenuProps) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  if (!open) return null;
  return (
    <div className="wos-start-menu" role="dialog" aria-label="Start menu">
      <div className="wos-start-menu__header">
        <div className="wos-start-menu__title">Neon Pilot OS</div>
      </div>
      <div className="wos-start-menu__search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search apps..."
          aria-label="Search apps"
        />
      </div>
      <div className="wos-start-menu__section-label">APPS</div>
      <div className="wos-start-menu__grid">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button key={item.id} type="button" className="wos-start-menu__item" onClick={item.onSelect}>
              <AppMonogram label={item.title} accent={item.accent} />
              <span className="wos-start-menu__item-copy">
                <span className="wos-start-menu__item-title">{item.title}</span>
              </span>
            </button>
          ))
        ) : (
          <div className="wos-start-menu__empty">No apps match.</div>
        )}
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
      <button type="button" className="wos-taskbar__start" aria-haspopup="dialog" aria-expanded={startOpen} onClick={onToggleStart}>
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
      className={cx('wos-window', className)}
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
