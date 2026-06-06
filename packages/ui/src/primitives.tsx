import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type DetailsHTMLAttributes,
  type FormEvent,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TdHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
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
export type MetricTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger';

function metricToneClass(tone: MetricTone) {
  if (tone === 'muted') return 'ui-metric-tile-value-muted';
  if (tone === 'accent') return 'ui-metric-tile-value-accent';
  if (tone === 'success') return 'ui-metric-tile-value-success';
  if (tone === 'warning') return 'ui-metric-tile-value-warning';
  if (tone === 'danger') return 'ui-metric-tile-value-danger';
  return null;
}

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

export const MessageActionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }>(
  function MessageActionButton({ className, children, type = 'button', tone = 'default', ...props }, ref) {
    return (
      <button ref={ref} type={type} className={cx('ui-message-action-button', buttonToneClass(tone), className)} {...props}>
        {children}
      </button>
    );
  },
);

export type IconButtonShape = 'square' | 'circle';
export type IconButtonSize = 'sm' | 'md';

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean; shape?: IconButtonShape; size?: IconButtonSize }
>(function IconButton({ className, children, compact = false, shape = 'square', size = 'md', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'ui-icon-button',
        compact && 'ui-icon-button-compact',
        size === 'sm' && 'ui-icon-button-sm',
        shape === 'circle' && 'ui-icon-button-circle',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

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

export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z" />
      <path d="M3.75 9.75h16.5" />
    </svg>
  );
}

export function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v6.75a2.25 2.25 0 0 1-2.25 2.25H12l-4.5 3v-3H6.75A2.25 2.25 0 0 1 4.5 13.5V6.75Z" />
    </svg>
  );
}

export function FolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z" />
      <path d="M3.75 9.75h16.5" />
      <path d="M16.5 12.5v6" />
      <path d="M13.5 15.5h6" />
    </svg>
  );
}

export function BrowsePathButton({
  busy,
  title,
  ariaLabel,
  onClick,
  className,
}: {
  busy: boolean;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <IconButton
      size="sm"
      onClick={onClick}
      disabled={busy}
      className={cx(
        'border border-transparent hover:bg-surface/45 hover:text-primary focus-visible:ring-1 focus-visible:ring-accent/25 focus-visible:ring-offset-1 focus-visible:ring-offset-base disabled:opacity-50',
        className,
      )}
      title={title}
      aria-label={ariaLabel}
    >
      <FolderPlusIcon className={cx(busy && 'animate-pulse')} />
    </IconButton>
  );
}

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

export function TaskListItem({
  label,
  detail,
  checked = false,
  control,
  actions,
  className,
  children,
  ...props
}: {
  label: ReactNode;
  detail?: ReactNode;
  checked?: boolean;
  control?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-task-list-item', checked && 'ui-task-list-item-checked', className)} {...props}>
      {control ? <div className="ui-task-list-item-control">{control}</div> : null}
      <div className="ui-task-list-item-main">
        <div className="ui-task-list-item-label">{label}</div>
        {detail ? <div className="ui-task-list-item-detail">{detail}</div> : null}
        {children ? <div className="ui-task-list-item-extra">{children}</div> : null}
      </div>
      {actions ? <div className="ui-task-list-item-actions">{actions}</div> : null}
    </div>
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

const STATUS_DOT_TONE_CLASSES = {
  muted: 'ui-status-dot-muted',
  accent: 'ui-status-dot-accent',
  success: 'ui-status-dot-success',
  warning: 'ui-status-dot-warning',
  danger: 'ui-status-dot-danger',
  steel: 'ui-status-dot-steel',
  current: 'ui-status-dot-current',
} as const;

export type StatusDotTone = keyof typeof STATUS_DOT_TONE_CLASSES;
export type StatusDotSize = 'xs' | 'sm' | 'md';

export function StatusDot({
  tone = 'muted',
  size = 'sm',
  className,
  ...props
}: { tone?: StatusDotTone; size?: StatusDotSize; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cx('ui-status-dot', `ui-status-dot-${size}`, STATUS_DOT_TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}

export function RingStatusDot({
  value,
  tone = 'accent',
  className,
  ...props
}: {
  value: number;
  tone?: StatusDotTone;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const boundedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <span
      aria-hidden="true"
      className={cx('ui-ring-status-dot', `ui-ring-status-dot-${tone}`, className)}
      style={{ '--ui-ring-status-dot-value': `${boundedValue}%` } as CSSProperties}
      {...props}
    >
      <span className="ui-ring-status-dot-core">
        <StatusDot tone={tone} size="xs" />
      </span>
    </span>
  );
}

export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx('ui-kbd', className)}>{children}</kbd>;
}

export type SpinnerSize = 'xs' | 'sm';

export function Spinner({
  size = 'sm',
  className,
  ...props
}: { size?: SpinnerSize; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={cx('ui-spinner', `ui-spinner-${size}`, className)} {...props} />;
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
  steel: 'ui-progress-bar-steel',
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

export type RuntimeStatusTone = 'ready' | 'running' | 'warning' | 'muted';

function runtimeStatusToneToDotTone(tone: RuntimeStatusTone): StatusDotTone {
  if (tone === 'ready') return 'accent';
  if (tone === 'running') return 'success';
  if (tone === 'warning') return 'warning';
  return 'muted';
}

export function RuntimeStatusDot({ tone, className }: { tone: RuntimeStatusTone; className?: string }) {
  return <StatusDot tone={runtimeStatusToneToDotTone(tone)} size="sm" className={className} />;
}

export function RuntimePage({
  children,
  className,
  shellClassName,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  shellClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cx('h-full overflow-y-auto', className)}>
      <AppPageLayout shellClassName={cx('max-w-[72rem]', shellClassName)} contentClassName={cx('space-y-10', contentClassName)}>
        {children}
      </AppPageLayout>
    </div>
  );
}

export function RuntimeHeader({
  title,
  summary,
  actions,
  className,
}: {
  title: ReactNode;
  summary: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <AppPageIntro title={title} summary={summary} actions={actions} className={className} />;
}

export function RuntimeStrip({
  status,
  tone,
  metadata,
  message,
  children,
  progress,
  className,
  bodyClassName,
}: {
  status: ReactNode;
  tone: RuntimeStatusTone;
  metadata?: ReactNode[];
  message?: ReactNode;
  children?: ReactNode;
  progress?: number | null;
  className?: string;
  bodyClassName?: string;
}) {
  const clampedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section className={cx('space-y-5 border-y border-border-subtle/65 py-6', className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary">
        <span className="inline-flex items-center gap-2 font-medium text-primary">
          <RuntimeStatusDot tone={tone} />
          {status}
        </span>
        {metadata?.map((item, index) => (
          <span key={index} className="min-w-0 truncate">
            {item}
          </span>
        ))}
      </div>
      {message ? (
        <div className="text-sm text-secondary" aria-live="polite">
          {message}
        </div>
      ) : null}
      {children ? <div className={bodyClassName}>{children}</div> : null}
      {clampedProgress != null ? <ProgressBar value={clampedProgress} minPercent={2} label={`Setup progress ${clampedProgress}%`} /> : null}
    </section>
  );
}

export function RuntimeSection({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <section className={cx('space-y-5 border-t border-border-subtle/65 pt-6', className)}>
      <div className={cx('flex items-start justify-between gap-4', headerClassName)}>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {description ? <p className="text-sm text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export const TerminalBlock = forwardRef<
  HTMLPreElement,
  {
    children: ReactNode;
    compact?: boolean;
    className?: string;
  }
>(function TerminalBlock({ children, compact = false, className }, ref) {
  return (
    <pre
      ref={ref}
      className={cx(
        'overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle/80 bg-surface/55 p-4 text-xs leading-relaxed text-secondary',
        compact ? 'min-h-28' : 'min-h-44',
        className,
      )}
    >
      {children}
    </pre>
  );
});

export function RuntimeFooter({
  summary,
  open,
  onToggle,
  children,
  className,
}: {
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer className={cx('border-t border-border-subtle/65 pt-4 text-sm text-secondary', className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{summary}</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </footer>
  );
}

export function ProgressRow({
  label,
  value,
  progressValue,
  badge,
  className,
  labelClassName,
  valueClassName,
  badgeClassName,
  progressClassName,
  barClassName,
  labelWidth = '6rem',
  progressWidth = 'minmax(0, 1fr)',
  valueWidth = '4.5rem',
  badgeWidth = '5rem',
  tone = 'accent',
  max = 100,
  minPercent = 0,
  progressLabel,
  style,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  progressValue: number;
  badge?: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  badgeClassName?: string;
  progressClassName?: string;
  barClassName?: string;
  labelWidth?: string;
  progressWidth?: string;
  valueWidth?: string;
  badgeWidth?: string;
  tone?: ProgressBarTone;
  max?: number;
  minPercent?: number;
  progressLabel?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'value'>) {
  const rowStyle = {
    '--ui-progress-row-label-width': labelWidth,
    '--ui-progress-row-progress-width': progressWidth,
    '--ui-progress-row-value-width': valueWidth,
    '--ui-progress-row-badge-width': badgeWidth,
    ...style,
  } as CSSProperties;

  return (
    <div className={cx('ui-progress-row', badge != null && 'ui-progress-row-with-badge', className)} style={rowStyle} {...props}>
      <div className={cx('ui-progress-row-label', labelClassName)}>{label}</div>
      <ProgressBar
        value={progressValue}
        max={max}
        minPercent={minPercent}
        tone={tone}
        label={progressLabel}
        className={cx('ui-progress-row-bar', progressClassName)}
        barClassName={barClassName}
      />
      <div className={cx('ui-progress-row-value', valueClassName)}>{value}</div>
      {badge != null ? <div className={cx('ui-progress-row-badge', badgeClassName)}>{badge}</div> : null}
    </div>
  );
}

export type SectionLabelTone = 'default' | 'muted' | 'secondary' | 'accent';

export function SectionLabel({
  children,
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: SectionLabelTone }) {
  return (
    <span className={cx('ui-section-label', `ui-section-label-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export type MetaLabelTone = 'muted' | 'secondary' | 'accent' | 'success' | 'danger';

export function MetaLabel({ children, className, tone = 'muted', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: MetaLabelTone }) {
  return (
    <span className={cx('ui-meta-label', `ui-meta-label-${tone}`, className)} {...props}>
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

export function InlineMeta({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ui-inline-meta', className)} {...props}>
      {children}
    </span>
  );
}

type CardTextElement = 'p' | 'span' | 'div' | 'label' | 'summary';
type CardTextProps = HTMLAttributes<HTMLElement> & LabelHTMLAttributes<HTMLLabelElement> & { as?: CardTextElement };
type CompactCardElement = 'div' | 'section' | 'article' | 'li';
export type CompactCardPadding = 'sm' | 'md';
export type CompactCardTone = 'base' | 'surface' | 'elevated';

export function CardTitle({ as: Component = 'p', children, className, ...props }: CardTextProps) {
  return (
    <Component className={cx('ui-card-title', className)} {...props}>
      {children}
    </Component>
  );
}

export function CardBody({ as: Component = 'p', children, className, ...props }: CardTextProps) {
  return (
    <Component className={cx('ui-card-body', className)} {...props}>
      {children}
    </Component>
  );
}

export function CardMeta({ as: Component = 'p', children, className, ...props }: CardTextProps) {
  return (
    <Component className={cx('ui-card-meta', className)} {...props}>
      {children}
    </Component>
  );
}

export function CompactCard({
  as: Component = 'div',
  children,
  className,
  padding = 'md',
  tone = 'base',
  interactive = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: CompactCardElement;
  padding?: CompactCardPadding;
  tone?: CompactCardTone;
  interactive?: boolean;
}) {
  return (
    <Component
      className={cx(
        'ui-compact-card',
        `ui-compact-card-${padding}`,
        `ui-compact-card-${tone}`,
        interactive && 'ui-compact-card-interactive',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export type ToolResultCardTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function ToolResultCard({
  leading,
  title,
  badges,
  meta,
  body,
  actions,
  children,
  tone = 'neutral',
  className,
  headerClassName,
  bodyClassName,
  actionsClassName,
}: {
  leading?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: ToolResultCardTone;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  actionsClassName?: string;
}) {
  return (
    <SurfacePanel muted className={cx('ui-tool-result-card', `ui-tool-result-card-${tone}`, className)}>
      <div className="ui-tool-result-card-layout">
        {leading ? <div className="ui-tool-result-card-leading">{leading}</div> : null}
        <div className="ui-tool-result-card-main">
          <div className={cx('ui-tool-result-card-header', headerClassName)}>
            <CardTitle as="span" className="min-w-0 truncate">
              {title}
            </CardTitle>
            {badges}
          </div>
          {meta ? <CardMeta className="ui-tool-result-card-meta">{meta}</CardMeta> : null}
          {body ? <CardBody className={cx('ui-tool-result-card-body', bodyClassName)}>{body}</CardBody> : null}
          {children}
          {actions ? <div className={cx('ui-tool-result-card-actions', actionsClassName)}>{actions}</div> : null}
        </div>
      </div>
    </SurfacePanel>
  );
}

export const ActionTile = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode;
    label: ReactNode;
    description?: ReactNode;
    meta?: ReactNode;
  }
>(function ActionTile({ className, icon, label, description, meta, children, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cx('ui-action-tile', className)} {...props}>
      {icon ? (
        <span className="ui-action-tile-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-action-tile-main">
        <span className="ui-action-tile-label">{label}</span>
        {description ? <span className="ui-action-tile-description">{description}</span> : null}
        {children}
      </span>
      {meta ? <span className="ui-action-tile-meta">{meta}</span> : null}
    </button>
  );
});

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

export function ResourcePickerDialog({
  title,
  description,
  actions,
  children,
  footer,
  onClose,
  className,
  bodyClassName,
  backdropStyle,
  style,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  className?: string;
  bodyClassName?: string;
  backdropStyle?: CSSProperties;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <Dialog
      aria-label={typeof title === 'string' ? title : undefined}
      onClose={onClose}
      className={className}
      backdropStyle={backdropStyle}
      style={{
        width: 'min(840px, calc(100vw - 2rem))',
        maxHeight: 'calc(100vh - 5rem)',
        ...style,
      }}
      {...props}
    >
      <DialogHeader title={title} description={description} actions={actions} />
      <DialogBody className={cx('ui-resource-picker-body', bodyClassName)}>{children}</DialogBody>
      {footer ? <div className="ui-resource-picker-footer">{footer}</div> : null}
    </Dialog>
  );
}

export function ResourcePickerToolbar({
  filters,
  search,
  actions,
  className,
}: {
  filters?: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('ui-resource-picker-toolbar', className)}>
      <FilterToolbar filters={filters} search={search} actions={actions} />
    </div>
  );
}

export function ResourcePickerList({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-resource-picker-list', className)} {...props}>
      {children}
    </div>
  );
}

export function ResourceList({
  children,
  className,
  bordered = true,
  ...props
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-resource-list', bordered && 'ui-resource-list-bordered', className)} {...props}>
      {children}
    </div>
  );
}

export function ResourceListRow({
  title,
  meta,
  detail,
  actions,
  leading,
  children,
  className,
  titleClassName,
  detailClassName,
  actionsClassName,
  ...props
}: {
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  detailClassName?: string;
  actionsClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-resource-list-row', leading != null && 'ui-resource-list-row-with-leading', className)} {...props}>
      {leading ? <div className="ui-resource-list-row-leading">{leading}</div> : null}
      <div className="ui-resource-list-row-main">
        <div className="ui-resource-list-row-title-line">
          <div className={cx('ui-resource-list-row-title', titleClassName)}>{title}</div>
          {meta ? <div className="ui-resource-list-row-meta">{meta}</div> : null}
        </div>
        {detail ? <div className={cx('ui-resource-list-row-detail', detailClassName)}>{detail}</div> : null}
        {children ? <div className="ui-resource-list-row-extra">{children}</div> : null}
      </div>
      {actions ? <div className={cx('ui-resource-list-row-actions', actionsClassName)}>{actions}</div> : null}
    </div>
  );
}

export function ResourceListItem({
  label,
  meta,
  detail,
  leading,
  selected = false,
  className,
  children,
  type = 'button',
  ...props
}: {
  label: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  leading?: ReactNode;
  selected?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'ui-resource-list-item',
        leading != null && 'ui-resource-list-item-with-leading',
        selected && 'ui-resource-list-item-selected',
        className,
      )}
      {...props}
    >
      {leading ? (
        <span className="ui-resource-list-item-leading" aria-hidden="true">
          {leading}
        </span>
      ) : null}
      <span className="ui-resource-list-item-main">
        <span className="ui-resource-list-item-title">{label}</span>
        {meta ? <span className="ui-resource-list-item-meta">{meta}</span> : null}
        {detail ? <span className="ui-resource-list-item-detail">{detail}</span> : null}
        {children ? <div className="ui-resource-list-item-extra">{children}</div> : null}
      </span>
    </button>
  );
}

export const RowButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    selected?: boolean;
    compact?: boolean;
  }
>(function RowButton({ className, children, selected = false, compact = false, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ui-row-button', compact && 'ui-row-button-compact', selected && 'ui-row-button-selected', className)}
      {...props}
    >
      {children}
    </button>
  );
});

export const ChoiceRow = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean;
    indicator?: ReactNode;
    label: ReactNode;
    details?: ReactNode;
  }
>(function ChoiceRow({ checked = false, indicator, label, details, className, children, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cx('ui-choice-row', checked && 'ui-choice-row-checked', className)} {...props}>
      {indicator != null ? (
        <span className={cx('ui-choice-row-indicator', checked && 'ui-choice-row-indicator-checked')} aria-hidden="true">
          {indicator}
        </span>
      ) : null}
      <span className="ui-choice-row-main">
        <span className="ui-choice-row-label">{label}</span>
        {details ? <span className="ui-choice-row-details">{details}</span> : null}
        {children}
      </span>
    </button>
  );
});

export type AttachmentChipSize = 'sm' | 'md';

export function AttachmentChip({
  children,
  className,
  size = 'sm',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  size?: AttachmentChipSize;
}) {
  return (
    <div className={cx('ui-attachment-chip', `ui-attachment-chip-${size}`, className)} {...props}>
      {children}
    </div>
  );
}

export const AttachmentChipButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function AttachmentChipButton(
  { className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx('ui-attachment-chip-button', className)} {...props}>
      {children}
    </button>
  );
});

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

export function InlineCode({ children, className, wrap = true, ...props }: HTMLAttributes<HTMLElement> & { wrap?: boolean }) {
  return (
    <code className={cx('ui-inline-code', wrap && 'ui-inline-code-wrap', className)} {...props}>
      {children}
    </code>
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

export type DashboardGridColumns = 2 | 3 | 4;
export type DashboardGridDivide = 'none' | 'x' | 'both';

export function DashboardGrid({
  children,
  className,
  columns = 2,
  divide = 'both',
  ...props
}: HTMLAttributes<HTMLDivElement> & { columns?: DashboardGridColumns; divide?: DashboardGridDivide }) {
  return (
    <div
      className={cx('ui-dashboard-grid', `ui-dashboard-grid-cols-${columns}`, `ui-dashboard-grid-divide-${divide}`, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DashboardGridCell({
  children,
  className,
  span,
  ...props
}: HTMLAttributes<HTMLDivElement> & { span?: DashboardGridColumns }) {
  return (
    <div className={cx('ui-dashboard-grid-cell', span && `ui-dashboard-grid-cell-span-${span}`, className)} {...props}>
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

export function MetricTile({
  label,
  value,
  detail,
  children,
  className,
  valueClassName,
  detailClassName,
  tone = 'default',
  size = 'md',
  align = 'center',
  appearance = 'tile',
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
  valueClassName?: string;
  detailClassName?: string;
  tone?: MetricTone;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
  appearance?: 'tile' | 'plain';
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <Stat
      label={label}
      value={value}
      detail={detail}
      labelPosition="after"
      className={cx(
        'ui-metric-tile',
        `ui-metric-tile-${size}`,
        `ui-metric-tile-${appearance}`,
        align === 'left' && 'ui-metric-tile-left',
        className,
      )}
      valueClassName={cx('ui-metric-tile-value', metricToneClass(tone), valueClassName)}
      detailClassName={cx('ui-metric-tile-detail', detailClassName)}
      {...props}
    >
      {children}
    </Stat>
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

export type KeyValueTableColumns = 1 | 2 | 3 | 4;

export function KeyValueTable({
  items,
  columns = 2,
  className,
  ...props
}: {
  items: Array<{
    label: ReactNode;
    value: ReactNode;
    title?: string;
    valueClassName?: string;
  }>;
  columns?: KeyValueTableColumns;
  className?: string;
} & HTMLAttributes<HTMLDListElement>) {
  return (
    <dl className={cx('ui-key-value-table', `ui-key-value-table-${columns}`, className)} {...props}>
      {items.map((item, index) => (
        <div key={typeof item.label === 'string' ? item.label : index} className="ui-key-value-table-item" title={item.title}>
          <dt className="ui-key-value-table-label">{item.label}</dt>
          <dd className={cx('ui-key-value-table-value', item.valueClassName)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataTable({
  children,
  className,
  columns,
  tableClassName,
  ...props
}: {
  children: ReactNode;
  columns?: ReactNode;
  tableClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-data-table-shell', className)} {...props}>
      <table className={cx('ui-data-table', tableClassName)}>
        {columns}
        {children}
      </table>
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

export function DataTableCell({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx('ui-data-table-cell', className)} {...props}>
      {children}
    </td>
  );
}

export function DataTableEmptyRow({
  colSpan,
  children,
  className,
  cellClassName,
  ...props
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
  cellClassName?: string;
} & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <DataTableRow className={cx('hover:bg-transparent', className)} {...props}>
      <DataTableCell colSpan={colSpan} className={cx('px-3 py-12 text-center text-secondary', cellClassName)}>
        {children}
      </DataTableCell>
    </DataTableRow>
  );
}

export function DataTableActionGroup({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('flex items-center justify-end gap-1.5', className)} {...props}>
      {children}
    </div>
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

export interface ConfirmDialogProps {
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  className?: string;
  backdropClassName?: string;
  backdropStyle?: CSSProperties;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  className,
  backdropClassName,
  backdropStyle,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Dialog
      onClose={onCancel}
      labelledBy={titleId}
      className={cx('max-w-md', className)}
      backdropClassName={backdropClassName}
      backdropStyle={backdropStyle}
    >
      <DialogHeader title={title} titleId={titleId} />
      <DialogBody>
        <div className="text-[13px] leading-6 text-secondary">{message}</div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="action" tone={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export interface TextPromptDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  allowEmpty?: boolean;
  className?: string;
  backdropClassName?: string;
  backdropStyle?: CSSProperties;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function TextPromptDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  allowEmpty = false,
  className,
  backdropClassName,
  backdropStyle,
  onCancel,
  onSubmit,
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const canSubmit = allowEmpty || value.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(value);
  };

  return (
    <Dialog
      onClose={onCancel}
      labelledBy={titleId}
      className={cx('max-w-md', className)}
      backdropClassName={backdropClassName}
      backdropStyle={backdropStyle}
    >
      <form onSubmit={submit}>
        <DialogHeader title={title} titleId={titleId} />
        <DialogBody>
          <Field label={label}>
            <TextInput ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant="action" tone="accent" disabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
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

export function TabPanel({ active = true, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { active?: boolean }) {
  return (
    <div role="tabpanel" hidden={!active} className={cx('ui-tab-panel', className)} {...props}>
      {children}
    </div>
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

export type PanelMessageTone = 'muted' | 'danger';

export function PanelMessage({
  children,
  tone = 'muted',
  align = 'left',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: PanelMessageTone; align?: 'left' | 'center' }) {
  return (
    <div
      className={cx('ui-panel-message', `ui-panel-message-${tone}`, align === 'center' && 'ui-panel-message-center', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CenteredState({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-centered-state', className)} {...props}>
      {children}
    </div>
  );
}

export function CenteredLoadingState({ label = 'Loading...', className }: { label?: string; className?: string }) {
  return (
    <CenteredState className={className}>
      <LoadingState label={label} />
    </CenteredState>
  );
}

export function CenteredMessage({
  eyebrow,
  title,
  body,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CenteredState className={className}>
      <div className="ui-centered-message">
        {eyebrow ? <SectionLabel tone="secondary">{eyebrow}</SectionLabel> : null}
        <h2 className="ui-centered-message-title">{title}</h2>
        {body ? <p className="ui-centered-message-body">{body}</p> : null}
        {actions ? <div className="ui-centered-message-actions">{actions}</div> : null}
      </div>
    </CenteredState>
  );
}

export function ErrorState({
  title,
  message,
  body,
  className,
}: {
  title?: ReactNode;
  message?: ReactNode;
  body?: ReactNode;
  className?: string;
}) {
  const resolvedBody = body ?? message;
  return (
    <div className={cx('ui-error-state', className)} role="alert">
      {title ? <div className="ui-error-title">{title}</div> : null}
      {resolvedBody ? <div className="ui-error-body">{resolvedBody}</div> : null}
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

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className, type = 'checkbox', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cx('ui-checkbox', className)} {...props} />;
});

const SHORTCUT_KEY_LABELS: Record<string, string> = {
  Plus: '+',
  Space: 'Space',
  Minus: '-',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\\\',
  Slash: '/',
  Backquote: '`',
  IntlBackslash: '\\',
};

export function formatKeyboardShortcutLabel(shortcut: string) {
  const labels = shortcut.split('+').map((part) => {
    const trimmed = part.trim();
    if (trimmed === 'CommandOrControl') return '⌘/Ctrl';
    if (trimmed === 'Command') return '⌘';
    if (trimmed === 'Control') return 'Ctrl';
    if (trimmed === 'Shift') return 'Shift';
    if (trimmed === 'Alt') return 'Alt';
    if (trimmed === 'Meta') return 'Meta';
    return SHORTCUT_KEY_LABELS[trimmed] ?? trimmed;
  });
  return labels.join(' + ');
}

function normalizeKeyboardShortcutKey(event: ReactKeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;

  switch (event.code) {
    case 'Space':
      return 'Space';
    case 'Tab':
      return 'Tab';
    case 'Enter':
    case 'NumpadEnter':
      return 'Enter';
    case 'Escape':
      return 'Escape';
    case 'Backspace':
      return 'Backspace';
    case 'Delete':
      return 'Delete';
    case 'Insert':
      return 'Insert';
    case 'Home':
      return 'Home';
    case 'End':
      return 'End';
    case 'PageUp':
      return 'PageUp';
    case 'PageDown':
      return 'PageDown';
    case 'ArrowUp':
      return 'Up';
    case 'ArrowDown':
      return 'Down';
    case 'ArrowLeft':
      return 'Left';
    case 'ArrowRight':
      return 'Right';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Backquote':
      return '`';
    case 'NumpadAdd':
      return 'Plus';
    case 'NumpadSubtract':
      return '-';
    case 'NumpadMultiply':
      return '*';
    case 'NumpadDivide':
      return '/';
    case 'NumpadDecimal':
      return '.';
    default:
      if (/^Numpad[0-9]$/.test(event.code)) return event.code.slice(6);
      return null;
  }
}

function resolveKeyboardShortcutFromEvent(event: ReactKeyboardEvent): string | null {
  const key = normalizeKeyboardShortcutKey(event);
  if (!key) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  if (parts.length === 0 && !/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return null;
  }

  parts.push(key);
  return parts.join('+');
}

export function KeyboardShortcutCaptureInput({
  id,
  value,
  placeholder,
  disabled,
  reservedHint = 'Some shortcuts are reserved by the app and cannot be captured here.',
  onChange,
  className,
}: {
  id?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  reservedHint?: ReactNode;
  onChange: (shortcut: string) => void;
  className?: string;
}) {
  const [capturing, setCapturing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => {
        setCapturing(true);
        setInvalid(false);
      }}
      onBlur={() => {
        setCapturing(false);
        setInvalid(false);
      }}
      onKeyDown={(event) => {
        if (!capturing) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCapturing(true);
            setInvalid(false);
          }
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'Escape') {
          setCapturing(false);
          setInvalid(false);
          return;
        }

        const shortcut = resolveKeyboardShortcutFromEvent(event);
        if (!shortcut) {
          setInvalid(true);
          return;
        }

        setInvalid(false);
        setCapturing(false);
        onChange(shortcut);
      }}
      className={cx('ui-shortcut-capture', capturing && 'ui-shortcut-capture-capturing', invalid && 'ui-shortcut-capture-invalid', className)}
      aria-label={
        capturing
          ? 'Press a keyboard shortcut'
          : value
            ? `Keyboard shortcut ${formatKeyboardShortcutLabel(value)}`
            : (placeholder ?? 'No shortcut assigned')
      }
    >
      <span className={cx('ui-shortcut-capture-value', !value && !capturing && 'ui-shortcut-capture-placeholder')}>
        {capturing
          ? invalid
            ? 'Use a modifier, or press an F-key...'
            : 'Press shortcut...'
          : value
            ? formatKeyboardShortcutLabel(value)
            : (placeholder ?? 'No shortcut assigned')}
      </span>
      {capturing && reservedHint ? <span className="ui-shortcut-capture-hint">{reservedHint}</span> : null}
    </button>
  );
}

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

export function SettingsPanel({
  id,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section id={id} className={cx('ui-settings-panel', className)}>
      <div className="ui-settings-panel-header">
        <div className="ui-settings-panel-copy">
          <h3 className="ui-settings-panel-title">{title}</h3>
          {description ? <p className="ui-settings-panel-description">{description}</p> : null}
        </div>
        {actions ? <div className="ui-settings-panel-actions">{actions}</div> : null}
      </div>
      <div className={cx('ui-settings-panel-content', contentClassName)}>{children}</div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  disabled = false,
  className,
  copyClassName,
  actionsClassName,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  copyClassName?: string;
  actionsClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('ui-settings-row', disabled && 'ui-settings-row-disabled', className)} {...props}>
      <div className={cx('ui-settings-row-copy', copyClassName)}>
        <div className="ui-settings-row-title">{title}</div>
        {description ? <div className="ui-settings-row-description">{description}</div> : null}
      </div>
      {children ? <div className={cx('ui-settings-row-actions', actionsClassName)}>{children}</div> : null}
    </div>
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
    <SettingsRow title={title} description={description} disabled={disabled} className={cx('ui-setting-toggle-row', className)} {...props}>
      <Switch
        checked={checked}
        disabled={disabled}
        label={switchLabel}
        aria-label={switchLabel ? undefined : typeof title === 'string' ? title : 'Toggle setting'}
        onClick={() => onCheckedChange(!checked)}
      />
    </SettingsRow>
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
  meta,
  actions,
  children,
  className,
  headerClassName,
  titleClassName,
  descriptionClassName,
  bodyClassName,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <section id={id} className={cx('ui-app-page-section', className)}>
      {title || description || meta || actions ? (
        <div className={cx('ui-app-page-section-header', headerClassName)}>
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              {title ? <h2 className={cx('ui-app-page-section-title', titleClassName)}>{title}</h2> : null}
              {meta ? <div className="ui-app-page-section-meta">{meta}</div> : null}
            </div>
            {description ? <div className={cx('ui-app-page-section-description', descriptionClassName)}>{description}</div> : null}
          </div>
          {actions ? <div className="ui-app-page-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className={cx('ui-app-page-section-body', bodyClassName)}>{children}</div> : null}
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
