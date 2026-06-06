import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type DetailsHTMLAttributes,
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

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; tone?: ButtonTone }
>(function Button({ className, children, type = 'button', variant = 'toolbar', tone = 'default', ...props }, ref) {
  const baseClass = variant === 'action' ? 'ui-action-button' : variant === 'ghost' ? 'ui-ghost-button' : 'ui-toolbar-button';
  return (
    <button ref={ref} type={type} className={cx(baseClass, buttonToneClass(tone), className)} {...props}>
      {children}
    </button>
  );
});

export const ButtonLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; tone?: ButtonTone }
>(function ButtonLink({ className, children, variant = 'toolbar', tone = 'default', ...props }, ref) {
  const baseClass = variant === 'action' ? 'ui-action-button' : variant === 'ghost' ? 'ui-ghost-button' : 'ui-toolbar-button';
  return (
    <a ref={ref} className={cx(baseClass, buttonToneClass(tone), className)} {...props}>
      {children}
    </a>
  );
});

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

export const ToolbarButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function ToolbarButton(
  { className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx('ui-toolbar-button', className)} {...props}>
      {children}
    </button>
  );
});

export const TextButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }>(
  function TextButton({ className, children, type = 'button', tone = 'default', ...props }, ref) {
    return (
      <button ref={ref} type={type} className={cx('ui-text-button', buttonToneClass(tone), className)} {...props}>
        {children}
      </button>
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }>(
  function IconButton({ className, children, compact = false, type = 'button', ...props }, ref) {
    return (
      <button ref={ref} type={type} className={cx('ui-icon-button', compact && 'ui-icon-button-compact', className)} {...props}>
        {children}
      </button>
    );
  },
);

export const IconLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { compact?: boolean }>(function IconLink(
  { className, children, compact = false, ...props },
  ref,
) {
  return (
    <a ref={ref} className={cx('ui-icon-button', compact && 'ui-icon-button-compact', className)} {...props}>
      {children}
    </a>
  );
});

export const CheckButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }>(
  function CheckButton({ checked, className, children = '✓', type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={checked}
        className={cx('ui-check-button', checked && 'ui-check-button-checked', className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

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

export type TooltipPosition = 'top-right' | 'bottom-right';

export function Tooltip({
  children,
  className,
  position = 'top-right',
  mono = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  position?: TooltipPosition;
  mono?: boolean;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-tooltip', `ui-tooltip-${position}`, mono && 'font-mono', className)} {...props}>
      {children}
    </span>
  );
}

const PROGRESS_BAR_TONE_CLASSES = {
  accent: 'ui-progress-bar-accent',
  success: 'ui-progress-bar-success',
  warning: 'ui-progress-bar-warning',
  danger: 'ui-progress-bar-danger',
} as const;

export type ProgressBarTone = keyof typeof PROGRESS_BAR_TONE_CLASSES;

export function ProgressBar({
  value,
  max = 100,
  minPercent = 0,
  tone = 'accent',
  className,
  barClassName,
  label,
  ...props
}: {
  value: number;
  max?: number;
  minPercent?: number;
  tone?: ProgressBarTone;
  className?: string;
  barClassName?: string;
  label?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const rawPercent = Number.isFinite(value) ? (value / safeMax) * 100 : 0;
  const boundedPercent = Math.max(0, Math.min(100, rawPercent));
  const visiblePercent = boundedPercent > 0 ? Math.max(minPercent, boundedPercent) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.max(0, Math.min(safeMax, value))}
      className={cx('ui-progress-bar', className)}
      {...props}
    >
      <div className={cx('ui-progress-bar-fill', PROGRESS_BAR_TONE_CLASSES[tone], barClassName)} style={{ width: `${visiblePercent}%` }} />
    </div>
  );
}

export function SectionLabel({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-section-label', className)} {...props}>
      {children}
    </span>
  );
}

export function SupportingText({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx('ui-supporting-text', className)} {...props}>
      {children}
    </p>
  );
}

export function FilterToolbar({
  filters,
  search,
  actions,
  className,
  ...props
}: {
  filters?: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-filter-toolbar', className)} {...props}>
      {filters ? <div className="ui-filter-toolbar-filters">{filters}</div> : null}
      {search ? <div className="ui-filter-toolbar-search">{search}</div> : null}
      {actions ? <div className="ui-filter-toolbar-actions">{actions}</div> : null}
    </div>
  );
}

export function ResourceListItem({
  label,
  meta,
  detail,
  selected = false,
  className,
  children,
  type = 'button',
  ...props
}: {
  label: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx('ui-resource-list-item', selected && 'ui-resource-list-item-selected', className)} {...props}>
      <span className="ui-resource-list-item-main">
        <span className="ui-resource-list-item-title">{label}</span>
        {meta ? <span className="ui-resource-list-item-meta">{meta}</span> : null}
      </span>
      {detail ? <span className="ui-resource-list-item-detail">{detail}</span> : null}
      {children}
    </button>
  );
}

export function CodeBlock({
  children,
  className,
  compact = false,
  wrap = true,
  ...props
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  wrap?: boolean;
} & HTMLAttributes<HTMLPreElement>) {
  return (
    <pre className={cx('ui-code-block', compact && 'ui-code-block-compact', wrap && 'ui-code-block-wrap', className)} {...props}>
      {children}
    </pre>
  );
}

export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  bodyClassName,
  ...props
}: {
  summary: ReactNode;
  summaryClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
} & DetailsHTMLAttributes<HTMLDetailsElement>) {
  return (
    <details className={cx('ui-disclosure', className)} {...props}>
      <summary className={cx('ui-disclosure-summary', summaryClassName)}>{summary}</summary>
      <div className={cx('ui-disclosure-body', bodyClassName)}>{children}</div>
    </details>
  );
}

export function SurfacePanel({ className, muted = false, children, ...props }: HTMLAttributes<HTMLDivElement> & { muted?: boolean }) {
  return (
    <div className={cx(muted ? 'ui-panel-muted' : 'ui-panel', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  meta,
  actions,
  className,
  titleClassName,
  metaClassName,
  ...props
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  metaClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-panel-header', className)} {...props}>
      <span className={cx('ui-panel-header-title', titleClassName)}>{title}</span>
      {meta ? <span className={cx('ui-panel-header-meta', metaClassName)}>{meta}</span> : null}
      {actions ? <div className="ui-panel-header-actions">{actions}</div> : null}
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
  children,
  className,
  valueClassName,
  detailClassName,
  labelPosition = 'before',
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
  valueClassName?: string;
  detailClassName?: string;
  labelPosition?: 'before' | 'after';
} & HTMLAttributes<HTMLDivElement>) {
  const labelNode = <div className="ui-stat-label">{label}</div>;
  return (
    <div className={cx('ui-stat', className)} {...props}>
      {labelPosition === 'before' ? labelNode : null}
      <div className={cx('ui-stat-value', valueClassName)}>{value}</div>
      {labelPosition === 'after' ? labelNode : null}
      {detail ? <div className={cx('ui-stat-detail', detailClassName)}>{detail}</div> : null}
      {children}
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
  backdropClassName,
  backdropStyle,
  onClose,
  closeOnBackdrop = true,
  labelledBy,
  ...props
}: {
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  backdropStyle?: CSSProperties;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  labelledBy?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('ui-overlay-backdrop', backdropClassName)}
      style={backdropStyle}
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

export type PositionedMenuPlacement = 'fixed' | 'absolute' | 'static';

export const PositionedMenu = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    role?: 'menu' | 'listbox' | 'group';
    placement?: PositionedMenuPlacement;
    position?: Pick<CSSProperties, 'top' | 'right' | 'bottom' | 'left'>;
  }
>(function PositionedMenu({ children, className, placement = 'fixed', position, style, role = 'menu', ...props }, ref) {
  return (
    <MenuShell
      ref={ref}
      role={role}
      className={cx('ui-positioned-menu', `ui-positioned-menu-${placement}`, className)}
      style={{ ...position, ...style }}
      {...props}
    >
      {children}
    </MenuShell>
  );
});

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

export function SettingToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
  className,
  switchLabel,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  switchLabel?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-setting-toggle-row', disabled && 'ui-setting-toggle-row-disabled', className)} {...props}>
      <div className="ui-setting-toggle-row-copy">
        <div className="ui-setting-toggle-row-title">{title}</div>
        {description ? <div className="ui-setting-toggle-row-description">{description}</div> : null}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        label={switchLabel}
        aria-label={switchLabel ? undefined : typeof title === 'string' ? title : 'Toggle setting'}
        onClick={() => onCheckedChange(!checked)}
      />
    </div>
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
