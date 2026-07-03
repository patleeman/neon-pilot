import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

export interface WindowedAppTileProps {
  label: string;
  accent?: AppAccent;
  variant?: 'menu' | 'taskbar';
  count?: number;
  showMonogram?: boolean;
  className?: string;
}

export function WindowedAppTile({
  label,
  accent = 'settings',
  variant = 'menu',
  count,
  showMonogram = false,
  className,
}: WindowedAppTileProps) {
  return (
    <span className={cx('wos-app-tile', className)} data-variant={variant}>
      {showMonogram ? <AppMonogram label={label} accent={accent} /> : null}
      <span className="wos-app-tile__copy">
        <span className="wos-app-tile__label">
          {label}
          {count ? <span className="wos-app-tile__count">{count}</span> : null}
        </span>
      </span>
    </span>
  );
}

export interface WindowedTitleBarControlsProps {
  title: string;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  maximizeLabel?: string;
  className?: string;
}

export function WindowedTitleBarControls({
  title,
  onMinimize,
  onMaximize,
  onClose,
  maximizeLabel,
  className,
}: WindowedTitleBarControlsProps) {
  return (
    <div className={cx('wos-window__controls', className)}>
      <button type="button" aria-label={`Minimize ${title}`} data-control="minimize" onClick={onMinimize}>
        <span className="wos-window__control-glyph" aria-hidden="true" />
      </button>
      <button type="button" aria-label={maximizeLabel ?? `Maximize ${title}`} data-control="maximize" onClick={onMaximize}>
        <span className="wos-window__control-glyph" aria-hidden="true" />
      </button>
      <button type="button" aria-label={`Close ${title}`} data-control="close" onClick={onClose}>
        <span className="wos-window__control-glyph" aria-hidden="true" />
      </button>
    </div>
  );
}

export interface WindowedPageShellProps {
  children: ReactNode;
  className?: string;
  layout?: 'standard' | 'wide' | 'two-column';
}

export function WindowedPageShell({ children, className, layout = 'standard' }: WindowedPageShellProps) {
  return (
    <div className={cx('wos-page-shell', className)} data-layout={layout}>
      {children}
    </div>
  );
}

export interface WindowedPageRailProps {
  title: string;
  accent?: AppAccent;
  children: ReactNode;
  showHeader?: boolean;
  showMonogram?: boolean;
  className?: string;
}

export function WindowedPageRail({
  title,
  accent = 'settings',
  children,
  showHeader = true,
  showMonogram = false,
  className,
}: WindowedPageRailProps) {
  return (
    <aside className={cx('wos-page-rail', className)} aria-label={title}>
      {showHeader ? (
        <div className="wos-page-rail__header">
          {showMonogram ? <AppMonogram label={title} accent={accent} /> : null}
          <span>{title}</span>
        </div>
      ) : null}
      {children}
    </aside>
  );
}

export interface WindowedPageMainProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WindowedPageMain({ title, description, actions, children, className }: WindowedPageMainProps) {
  return (
    <main className={cx('wos-page-main', className)}>
      <header className="wos-page-main__header">
        <div className="wos-page-main__heading">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="wos-page-main__actions">{actions}</div> : null}
      </header>
      <div className="wos-page-main__body">{children}</div>
    </main>
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
          {title ? <h3>{title}</h3> : null}
          {meta ? <span>{meta}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export interface WindowedToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  end?: ReactNode;
  as?: 'div' | 'form';
  formProps?: Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;
}

export function WindowedToolbar({ children, end, as = 'div', className, formProps, ...props }: WindowedToolbarProps) {
  const content = (
    <>
      <div className="wos-toolbar__primary">{children}</div>
      {end ? <div className="wos-toolbar__end">{end}</div> : null}
    </>
  );

  if (as === 'form') {
    return (
      <form className={cx('wos-toolbar', className)} {...formProps}>
        {content}
      </form>
    );
  }

  return (
    <div className={cx('wos-toolbar', className)} {...props}>
      {content}
    </div>
  );
}

export interface WindowedPageButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
  type?: 'button' | 'submit';
}

export function WindowedPageButton({ children, tone = 'neutral', type = 'button', className, ...props }: WindowedPageButtonProps) {
  return (
    <button type={type} className={cx('wos-page-button', className)} data-tone={tone} {...props}>
      {children}
    </button>
  );
}

export interface WindowedDialogProps {
  title: string;
  meta?: string;
  accent?: AppAccent;
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

export function WindowedDialog({ title, meta, accent = 'settings', actions, children, onClose, className }: WindowedDialogProps) {
  return (
    <div className="wos-dialog-layer" role="presentation">
      <section className={cx('wos-dialog', className)} role="dialog" aria-modal="true" aria-label={title}>
        <header className="wos-dialog__titlebar" data-accent={accent}>
          <div className="wos-dialog__identity">
            <div className="wos-dialog__title">{title}</div>
            {meta ? <div className="wos-dialog__meta">{meta}</div> : null}
          </div>
          <button type="button" className="wos-dialog__close" aria-label={`Close ${title}`} onClick={onClose}>
            <span aria-hidden="true" />
          </button>
        </header>
        {actions ? <div className="wos-dialog__actions">{actions}</div> : null}
        <div className="wos-dialog__body">{children}</div>
      </section>
    </div>
  );
}

export interface WindowedDialogStackProps {
  children: ReactNode;
  className?: string;
}

export function WindowedDialogStack({ children, className }: WindowedDialogStackProps) {
  return <div className={cx('wos-dialog-stack', className)}>{children}</div>;
}

export interface WindowedDialogCopyProps {
  children: ReactNode;
  className?: string;
}

export function WindowedDialogCopy({ children, className }: WindowedDialogCopyProps) {
  return <p className={cx('wos-dialog-copy', className)}>{children}</p>;
}

export type WindowedTextButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function WindowedTextButton({ children, className, type = 'button', ...props }: WindowedTextButtonProps) {
  return (
    <button type={type} className={cx('wos-text-button', className)} {...props}>
      {children}
    </button>
  );
}

export interface WindowedFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  span?: 'full';
  className?: string;
}

export function WindowedField({ label, children, hint, error, span, className }: WindowedFieldProps) {
  return (
    <div className={cx('wos-field', className)} data-invalid={Boolean(error)} data-span={span}>
      <span className="wos-field__label">{label}</span>
      {children}
      {error ? <span className="wos-field__error">{error}</span> : null}
      {hint && !error ? <span className="wos-field__hint">{hint}</span> : null}
    </div>
  );
}

export type WindowedTextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function WindowedTextInput({ className, ...props }: WindowedTextInputProps) {
  return <input className={cx('wos-input', className)} {...props} />;
}

export type WindowedTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function WindowedTextarea({ className, ...props }: WindowedTextareaProps) {
  return <textarea className={cx('wos-textarea', className)} {...props} />;
}

export type WindowedSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function WindowedSelect({ className, children, ...props }: WindowedSelectProps) {
  return (
    <select className={cx('wos-select', className)} {...props}>
      {children}
    </select>
  );
}

export interface WindowedSegmentedOption {
  id: string;
  label: string;
}

export interface WindowedSegmentedControlProps {
  options: WindowedSegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
  accent?: AppAccent;
  className?: string;
}

export function WindowedSegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  accent = 'automations',
  className,
}: WindowedSegmentedControlProps) {
  return (
    <div className={cx('wos-segmented-control', className)} data-accent={accent} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          data-active={option.id === value}
          className="wos-segmented-control__item"
          onClick={() => onChange?.(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
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

export interface WindowedStateBlockProps {
  title?: string;
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  action?: ReactNode;
  className?: string;
}

export function WindowedStateBlock({ title, children, tone = 'neutral', action, className }: WindowedStateBlockProps) {
  return (
    <div className={cx('wos-state-block', className)} data-tone={tone}>
      <div className="wos-state-block__copy">
        {title ? <div className="wos-state-block__title">{title}</div> : null}
        <div className="wos-state-block__body">{children}</div>
      </div>
      {action ? <div className="wos-state-block__action">{action}</div> : null}
    </div>
  );
}

export interface WindowedEmptyStateProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function WindowedEmptyState({ children, action, className }: WindowedEmptyStateProps) {
  return (
    <div className={cx('wos-empty-state', className)} data-tone="neutral">
      <div className="wos-empty-state__body">{children}</div>
      {action ? <div className="wos-empty-state__action">{action}</div> : null}
    </div>
  );
}

export interface WindowedToggleProps {
  checked?: boolean;
  accent?: AppAccent;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function WindowedToggle({
  checked = false,
  accent = 'routines',
  onChange,
  label = 'Toggle',
  disabled = false,
  className,
}: WindowedToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('wos-toggle', className)}
      data-checked={checked}
      data-accent={accent}
      disabled={disabled}
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

export interface WindowedKeyValueItem {
  label: string;
  value: ReactNode;
}

export interface WindowedKeyValueGridProps {
  items: WindowedKeyValueItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function WindowedKeyValueGrid({ items, columns = 3, className }: WindowedKeyValueGridProps) {
  return (
    <div className={cx('wos-key-value-grid', className)} data-columns={columns}>
      {items.map((item) => (
        <div key={item.label} className="wos-key-value-grid__item">
          <div className="wos-key-value__label">{item.label}</div>
          <div className="wos-key-value__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export interface WindowedKeyValueListProps {
  items: WindowedKeyValueItem[];
  className?: string;
}

export function WindowedKeyValueList({ items, className }: WindowedKeyValueListProps) {
  return (
    <div className={cx('wos-key-value-list', className)}>
      {items.map((item) => (
        <div key={item.label} className="wos-key-value-list__item">
          <div className="wos-key-value__label">{item.label}</div>
          <div className="wos-key-value__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export interface WindowedListProps {
  children: ReactNode;
  className?: string;
}

export function WindowedList({ children, className }: WindowedListProps) {
  return <div className={cx('wos-list', className)}>{children}</div>;
}

export interface WindowedListItemProps {
  title: string;
  meta?: string;
  detail?: string;
  active?: boolean;
  accent?: AppAccent;
  depth?: 0 | 1;
  status?: ReactNode;
  onSelect?: () => void;
}

export function WindowedListItem({
  title,
  meta,
  detail,
  active = false,
  accent = 'settings',
  depth = 0,
  status,
  onSelect,
}: WindowedListItemProps) {
  return (
    <button type="button" className="wos-list-item" data-active={active} data-accent={accent} data-depth={depth} onClick={onSelect}>
      <span className="wos-list-item__copy">
        <span className="wos-list-item__title">{title}</span>
        {meta ? <span className="wos-list-item__meta">{meta}</span> : null}
        {detail ? <span className="wos-list-item__detail">{detail}</span> : null}
      </span>
      {status ? <span className="wos-list-item__status">{status}</span> : null}
    </button>
  );
}

export interface WindowedTimelineProps {
  children: ReactNode;
  className?: string;
}

export function WindowedTimeline({ children, className }: WindowedTimelineProps) {
  return <div className={cx('wos-timeline', className)}>{children}</div>;
}

export interface WindowedTimelineItemProps {
  title: string;
  meta?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  children?: ReactNode;
}

export function WindowedTimelineItem({ title, meta, tone = 'neutral', children }: WindowedTimelineItemProps) {
  return (
    <div className="wos-timeline-item" data-tone={tone}>
      <div className="wos-timeline-item__marker" aria-hidden="true" />
      <div className="wos-timeline-item__body">
        <div className="wos-timeline-item__header">
          <span className="wos-timeline-item__title">{title}</span>
          {meta ? <span className="wos-timeline-item__meta">{meta}</span> : null}
        </div>
        {children ? <div className="wos-timeline-item__content">{children}</div> : null}
      </div>
    </div>
  );
}

export interface WindowedMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface WindowedMenuPanelProps {
  items: WindowedMenuItem[];
  ariaLabel?: string;
  placement?: 'taskbar' | 'inline';
  className?: string;
}

export function WindowedMenuPanel({ items, ariaLabel = 'Window menu', placement = 'taskbar', className }: WindowedMenuPanelProps) {
  return (
    <div className={cx('wos-menu-panel', className)} data-placement={placement} role="menu" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="wos-menu-panel__item"
          disabled={item.disabled}
          onClick={item.onSelect}
        >
          <span className="wos-menu-panel__label">{item.label}</span>
        </button>
      ))}
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
}

export function StartMenu({ open, items }: StartMenuProps) {
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
        <div className="wos-start-menu__title">Neon Pilot</div>
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
      <div className="wos-start-menu__grid">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button key={item.id} type="button" className="wos-start-menu__item" onClick={item.onSelect}>
              <WindowedAppTile label={item.title} accent={item.accent} />
            </button>
          ))
        ) : (
          <div className="wos-start-menu__empty">No apps match.</div>
        )}
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
  defaultOpenGroupId?: string | null;
  onOpenGroupMenu?: () => void;
}

const EMPTY_TASKBAR_GROUPS: TaskbarGroup[] = [];

export function Taskbar({
  startOpen,
  onToggleStart,
  groups = EMPTY_TASKBAR_GROUPS,
  items,
  defaultOpenGroupId = null,
  onOpenGroupMenu,
}: TaskbarProps) {
  const groupRefs = useRef(new Map<string, HTMLDivElement>());
  const [openGroupId, setOpenGroupId] = useState<string | null>(defaultOpenGroupId);
  const [menuAnchors, setMenuAnchors] = useState<Record<string, { left: number; bottom: number }>>({});

  useLayoutEffect(() => {
    const updateMenuAnchors = () => {
      if (typeof window === 'undefined') return;
      const next: Record<string, { left: number; bottom: number }> = {};
      groups.forEach((group) => {
        if (!group.menu) return;
        const rect = groupRefs.current.get(group.id)?.getBoundingClientRect();
        if (!rect) return;
        const menuWidth = 280;
        next[group.id] = {
          left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - menuWidth - 8)),
          bottom: Math.max(8, window.innerHeight - rect.top + 8),
        };
      });
      setMenuAnchors(next);
    };

    updateMenuAnchors();
    window.addEventListener('resize', updateMenuAnchors);
    window.addEventListener('scroll', updateMenuAnchors, true);
    return () => {
      window.removeEventListener('resize', updateMenuAnchors);
      window.removeEventListener('scroll', updateMenuAnchors, true);
    };
  }, [groups]);

  useEffect(() => {
    if (!openGroupId) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (target.closest('.wos-taskbar__group, .wos-taskbar__menu-layer')) return;
      setOpenGroupId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroupId(null);
    };
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [openGroupId]);

  useEffect(() => {
    if (!openGroupId) return;
    if (!groups.some((group) => group.id === openGroupId && group.menu)) {
      setOpenGroupId(null);
    }
  }, [groups, openGroupId]);

  return (
    <>
      <footer className="wos-taskbar">
        <button type="button" className="wos-taskbar__start" aria-haspopup="dialog" aria-expanded={startOpen} onClick={onToggleStart}>
          <WindowedAppTile label="Neon Pilot" accent="extensions" variant="taskbar" />
        </button>
        <nav className="wos-taskbar__items" aria-label="Open windows">
          {groups.map((group) => (
            <div
              key={group.id}
              ref={(node) => {
                if (node) {
                  groupRefs.current.set(group.id, node);
                } else {
                  groupRefs.current.delete(group.id);
                }
              }}
              className="wos-taskbar__group"
            >
              <button
                type="button"
                className="wos-taskbar__button"
                data-focused={group.focused}
                aria-haspopup={group.menu ? 'menu' : undefined}
                aria-expanded={group.menu ? openGroupId === group.id : undefined}
                onClick={() => {
                  if (!group.menu) {
                    group.onSelect();
                    return;
                  }
                  setOpenGroupId((current) => {
                    const next = current === group.id ? null : group.id;
                    if (next) {
                      onOpenGroupMenu?.();
                    }
                    return next;
                  });
                }}
              >
                <WindowedAppTile label={group.title} accent={group.accent} count={group.count} variant="taskbar" />
              </button>
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
              <WindowedAppTile label={item.title} accent={item.accent} count={item.count} variant="taskbar" />
            </button>
          ))}
        </nav>
      </footer>
      {groups.map((group) =>
        group.menu && openGroupId === group.id && menuAnchors[group.id] ? (
          <div
            key={`${group.id}-menu`}
            className="wos-taskbar__menu-layer"
            style={menuAnchors[group.id]}
            onClickCapture={(event) => {
              if ((event.target as HTMLElement | null)?.closest('.wos-menu-panel__item')) {
                setOpenGroupId(null);
              }
            }}
          >
            {group.menu}
          </div>
        ) : null,
      )}
    </>
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
      aria-label={title}
      className={cx('wos-window', className)}
      data-window-id={windowId}
      data-focused={focused}
      style={style}
      onPointerDown={onPointerDown}
    >
      <header className="wos-window__titlebar" data-accent={accent}>
        <div className="wos-window__identity">
          <div className="wos-window__title" title={title}>
            {title}
          </div>
        </div>
        <WindowedTitleBarControls
          title={title}
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onClose={onClose}
          maximizeLabel={restoreLabel}
        />
      </header>
      <div className="wos-window__body">{children}</div>
      {resizeHandles}
    </section>
  );
}
