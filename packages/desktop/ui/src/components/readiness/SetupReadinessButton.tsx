import { ToolbarButton } from '../ui';

export function SetupReadinessButton({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  const label = count === 1 ? 'Setup needs attention (1 item)' : `Setup needs attention (${count} items)`;
  return (
    <ToolbarButton className="ui-desktop-top-bar__icon-button relative" onClick={onClick} aria-label={label} title={label}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 11l2 2 4-4" />
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
      <span className="ui-notification-badge absolute -right-0.5 -top-0.5">{count > 99 ? '99+' : count}</span>
    </ToolbarButton>
  );
}
