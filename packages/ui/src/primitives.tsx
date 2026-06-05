import {
  type ButtonHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const PILL_TONE_CLASSES = {
  muted: 'ui-pill-muted',
  accent: 'ui-pill-accent',
  success: 'ui-pill-success',
  warning: 'ui-pill-warning',
  danger: 'ui-pill-danger',
  steel: 'ui-pill-steel',
  teal: 'ui-pill-teal',
  solidAccent: 'ui-pill-solid-accent',
} as const;

export type PillTone = keyof typeof PILL_TONE_CLASSES;

function pillToneClass(tone: PillTone) {
  return PILL_TONE_CLASSES[tone];
}

export type ButtonVariant = 'toolbar' | 'action' | 'ghost';
export type ButtonTone = 'default' | 'accent' | 'danger' | 'warning';

function buttonToneClass(tone: ButtonTone) {
  if (tone === 'accent') return 'text-accent';
  if (tone === 'danger') return 'text-danger';
  if (tone === 'warning') return 'text-warning';
  return null;
}

export function Button({
  className,
  children,
  type = 'button',
  variant = 'toolbar',
  tone = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; tone?: ButtonTone }) {
  const baseClass = variant === 'action' ? 'ui-action-button' : variant === 'ghost' ? 'ui-ghost-button' : 'ui-toolbar-button';
  return (
    <button type={type} className={cx(baseClass, buttonToneClass(tone), className)} {...props}>
      {children}
    </button>
  );
}

export function PageHeader({
  children,
  actions,
  leading,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('ui-page-header', className)}>
      {leading && <div className="flex items-center shrink-0 pr-3">{leading}</div>}
      <div className="flex-1 min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function ToolbarButton({ className, children, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx('ui-toolbar-button', className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  compact = false,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) {
  return (
    <button type={type} className={cx('ui-icon-button', compact && 'ui-icon-button-compact', className)} {...props}>
      {children}
    </button>
  );
}

export function Pill({
  tone = 'muted',
  mono = false,
  children,
  className,
  ...props
}: {
  tone?: PillTone;
  mono?: boolean;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-pill', pillToneClass(tone), mono && 'font-mono', className)} {...props}>
      {children}
    </span>
  );
}

export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx('ui-kbd', className)}>{children}</kbd>;
}

export function SurfacePanel({ className, muted = false, children, ...props }: HTMLAttributes<HTMLDivElement> & { muted?: boolean }) {
  return (
    <div className={cx(muted ? 'ui-panel-muted' : 'ui-panel', className)} {...props}>
      {children}
    </div>
  );
}

export function StatGrid({ children, className, compact = false, ...props }: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div className={cx('ui-stat-grid', compact && 'ui-stat-grid-compact', className)} {...props}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  className,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-stat', className)} {...props}>
      <div className="ui-stat-label">{label}</div>
      <div className="ui-stat-value">{value}</div>
      {detail ? <div className="ui-stat-detail">{detail}</div> : null}
    </div>
  );
}

export function KeyValueList({ children, className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return (
    <dl className={cx('ui-key-value-list', className)} {...props}>
      {children}
    </dl>
  );
}

export function KeyValueItem({
  label,
  value,
  action,
  className,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  action?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-key-value-item', action ? 'ui-key-value-item-action' : null, className)} {...props}>
      <dt className="ui-key-value-label">{label}</dt>
      <dd className="ui-key-value-value">{value}</dd>
      {action ? <div className="ui-key-value-action">{action}</div> : null}
    </div>
  );
}

export function DataTable({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-data-table-shell', className)} {...props}>
      <table className="ui-data-table">{children}</table>
    </div>
  );
}

export function DataTableHead({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cx('ui-data-table-head', className)} {...props}>
      {children}
    </thead>
  );
}

export function DataTableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cx('ui-data-table-body', className)} {...props}>
      {children}
    </tbody>
  );
}

export function DataTableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cx('ui-data-table-row', className)} {...props}>
      {children}
    </tr>
  );
}

export function DataTableHeaderCell({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx('ui-data-table-header-cell', className)} {...props}>
      {children}
    </th>
  );
}

export function DataTableCell({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx('ui-data-table-cell', className)} {...props}>
      {children}
    </td>
  );
}

export function Dialog({
  children,
  className,
  onClose,
  closeOnBackdrop = true,
  labelledBy,
  ...props
}: {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  labelledBy?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="ui-overlay-backdrop"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cx('ui-dialog-shell', className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  description,
  actions,
  titleId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <div className={cx('ui-dialog-header', className)}>
      <div className="ui-dialog-header-copy">
        <h2 id={titleId} className="ui-dialog-title">
          {title}
        </h2>
        {description ? <p className="ui-dialog-description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-dialog-actions">{actions}</div> : null}
    </div>
  );
}

export function DialogBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-dialog-body', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-dialog-footer', className)} {...props}>
      {children}
    </div>
  );
}

export const MenuShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { role?: 'menu' | 'listbox' | 'group' }>(
  function MenuShell({ children, className, role = 'menu', ...props }, ref) {
    return (
      <div ref={ref} className={cx('ui-menu-shell ui-context-menu-shell', className)} role={role} {...props}>
        {children}
      </div>
    );
  },
);

export function MenuGroupLabel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-menu-group-label', className)} {...props}>
      {children}
    </div>
  );
}

export function MenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ui-menu-separator', className)} role="separator" {...props} />;
}

export function MenuItem({
  children,
  className,
  tone = 'default',
  checked,
  closeOnPointerDown = true,
  type = 'button',
  role,
  onPointerDown,
  onMouseDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'danger';
  checked?: boolean;
  closeOnPointerDown?: boolean;
}) {
  function stopPointerEvent(event: { preventDefault: () => void; stopPropagation: () => void }) {
    if (!closeOnPointerDown) return;
    event.preventDefault();
    event.stopPropagation();
  }

  const itemRole = role ?? (typeof checked === 'boolean' ? 'menuitemradio' : 'menuitem');

  return (
    <button
      type={type}
      role={itemRole}
      aria-checked={typeof checked === 'boolean' ? checked : undefined}
      className={cx('ui-context-menu-item', tone === 'danger' && 'ui-context-menu-item-danger', className)}
      onPointerDown={(event) => {
        stopPointerEvent(event);
        onPointerDown?.(event);
      }}
      onMouseDown={(event) => {
        stopPointerEvent(event);
        onMouseDown?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabList({
  children,
  className,
  ariaLabel,
  variant = 'surface',
  ...props
}: HTMLAttributes<HTMLDivElement> & { ariaLabel: string; variant?: 'surface' | 'underline' }) {
  return (
    <div
      className={cx('ui-tab-list', variant === 'underline' && 'ui-tab-list-underline', className)}
      role="tablist"
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabButton({
  active = false,
  children,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      className={cx('ui-tab-button', active && 'ui-tab-button-active', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SegmentedControlOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

export function SegmentedControl<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: TValue;
  options: readonly SegmentedControlOption<TValue>[];
  onChange: (nextValue: TValue) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cx('ui-segmented-control', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cx('ui-segmented-button', value === option.value && 'ui-segmented-button-active')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx('ui-loading-state', className)} role="status" aria-live="polite">
      <span className="animate-pulse" aria-hidden="true">
        ●
      </span>
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cx('ui-error-state', className)} role="alert">
      {message}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('ui-empty-state', className)}>
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <p className="ui-empty-title">{title}</p>
      {body && <div className="ui-empty-body">{body}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

function noticeToneClass(tone: NoticeTone) {
  if (tone === 'danger') return 'ui-notice-danger';
  if (tone === 'success') return 'ui-notice-success';
  if (tone === 'warning') return 'ui-notice-warning';
  return 'ui-notice-info';
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
  ...props
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-notice', noticeToneClass(tone), className)} role={tone === 'danger' ? 'alert' : 'status'} {...props}>
      {title ? <div className="ui-notice-title">{title}</div> : null}
      {children ? <div className="ui-notice-body">{children}</div> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx('ui-text-input', className)} {...props} />;
});

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchInput(
  { className, type = 'search', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cx('ui-search-input', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cx('ui-textarea', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cx('ui-select', className)} {...props}>
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
} & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cx('ui-field', className)} {...props}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  );
}

export function FieldLabel({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-field-label', className)} {...props}>
      {children}
    </span>
  );
}

export function FieldHint({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-field-hint', className)} {...props}>
      {children}
    </span>
  );
}

export function FieldError({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-field-error', className)} {...props}>
      {children}
    </span>
  );
}

export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section id={id} className={cx('ui-settings-section', className)}>
      <div className="ui-settings-section-copy">
        <h3 className="ui-settings-section-title">{title}</h3>
        {description ? <p className="ui-settings-section-description">{description}</p> : null}
      </div>
      <div className={cx('ui-settings-section-content', contentClassName)}>{children}</div>
    </section>
  );
}

export function Switch({
  checked,
  disabled = false,
  label,
  className,
  ...props
}: {
  checked: boolean;
  label?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('ui-switch', checked && 'ui-switch-checked', className)}
      {...props}
    >
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
      {label ? <span className="ui-switch-label">{label}</span> : null}
    </button>
  );
}

export interface AppPageTocItem<TId extends string = string> {
  id: TId;
  label: ReactNode;
  summary?: ReactNode;
}

export function AppPageLayout({
  children,
  aside,
  asideLayout = 'split',
  shellClassName,
  gridClassName,
  contentClassName,
  asideClassName,
}: {
  children: ReactNode;
  aside?: ReactNode;
  asideLayout?: 'split' | 'centered';
  shellClassName?: string;
  gridClassName?: string;
  contentClassName?: string;
  asideClassName?: string;
}) {
  if (!aside) {
    return (
      <div className={cx('ui-app-page-shell', shellClassName)}>
        <div className={cx('ui-app-page-main', contentClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cx('ui-app-page-shell', shellClassName)}>
      <div className={cx(asideLayout === 'centered' ? 'ui-app-page-grid-centered' : 'ui-app-page-grid', gridClassName)}>
        <div className={cx('ui-app-page-main', asideLayout === 'centered' && 'ui-app-page-main-centered', contentClassName)}>
          {children}
        </div>
        <div className={cx(asideLayout === 'centered' ? 'ui-app-page-aside-centered' : 'ui-app-page-aside', asideClassName)}>{aside}</div>
      </div>
    </div>
  );
}

export function AppPageIntro({
  eyebrow,
  title,
  summary,
  actions,
  className,
  titleClassName,
  summaryClassName,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  summaryClassName?: string;
}) {
  return (
    <section className={cx('ui-app-page-intro', className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow ? <div className="ui-app-page-eyebrow">{eyebrow}</div> : null}
        <div className="space-y-1.5">
          <h1 className={cx('ui-app-page-title', titleClassName)}>{title}</h1>
          {summary ? <div className={cx('ui-app-page-summary', summaryClassName)}>{summary}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </section>
  );
}

export function AppPageSection({
  id,
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section id={id} className={cx('ui-app-page-section', className)}>
      {title || description ? (
        <div className="space-y-2">
          {title ? (
            <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-primary sm:text-[32px]">{title}</h2>
          ) : null}
          {description ? <div className="max-w-3xl text-[13px] leading-6 text-secondary">{description}</div> : null}
        </div>
      ) : null}
      <div className={cx('ui-app-page-section-body', bodyClassName)}>{children}</div>
    </section>
  );
}

export function AppPageToc<TId extends string>({
  items,
  activeId,
  onNavigate,
  ariaLabel = 'Page sections',
  title = 'On this page',
}: {
  items: readonly AppPageTocItem<TId>[];
  activeId: TId;
  onNavigate: (sectionId: TId) => void;
  ariaLabel?: string;
  title?: ReactNode;
}) {
  return (
    <aside>
      <nav aria-label={ariaLabel} className="space-y-3">
        <div className="ui-app-page-toc-title">{title}</div>
        <div className="space-y-2">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.id);
                }}
                className={cx('ui-app-page-toc-link', active && 'ui-app-page-toc-link-active')}
                aria-current={active ? 'location' : undefined}
              >
                <span className="block text-[13px] font-medium">{item.label}</span>
                {item.summary ? (
                  <span className={cx('mt-0.5 block text-[11px] leading-5', active ? 'text-primary/75' : 'text-dim')}>{item.summary}</span>
                ) : null}
              </a>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

export function AppPageEmptyState({
  icon,
  title,
  body,
  action,
  align = 'center',
  className,
  contentClassName,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cx(
        'ui-app-page-empty-shell',
        align === 'start' ? 'ui-app-page-empty-shell-start' : 'ui-app-page-empty-shell-center',
        className,
      )}
    >
      <EmptyState icon={icon} title={title} body={body} action={action} className={cx('w-full max-w-[34rem]', contentClassName)} />
    </div>
  );
}
