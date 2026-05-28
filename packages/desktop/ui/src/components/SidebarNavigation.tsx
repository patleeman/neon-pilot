import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { routeMatchesPrefix } from '../navigation/routeRegistry';

export const SIDEBAR_ICON_PATHS = {
  automations: 'M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chatBubble:
    'M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v6.75a2.25 2.25 0 0 1-2.25 2.25H12l-4.5 3v-3H6.75A2.25 2.25 0 0 1 4.5 13.5V6.75Z',
  clock: 'M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  grid: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z',
  list: 'M8.25 6.75h9m-9 5.25h9m-9 5.25h9M5.25 6.75h.01M5.25 12h.01M5.25 17.25h.01',
  nodes: 'M6 6.75h4.5v4.5H6v-4.5Zm7.5 0H18v4.5h-4.5v-4.5Zm-3.75 7.5h4.5v4.5h-4.5v-4.5Z',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  settings:
    'M10.5 6h3m-1.5-3v6m4.348-2.826 2.121 2.121m-12.728 0 2.121-2.121m8.486 8.486 2.121 2.121m-12.728 0 2.121-2.121M6 10.5H3m18 0h-3m-5.25 7.5v3m0-18v3',
  sparkles:
    'M12 3.75l1.07 3.43a1.5 1.5 0 0 0 .93.94l3.43 1.07-3.43 1.07a1.5 1.5 0 0 0-.93.93L12 15.62l-1.07-3.43a1.5 1.5 0 0 0-.93-.93L6.57 10.19 10 9.12a1.5 1.5 0 0 0 .93-.94L12 3.75Zm6 10.5.54 1.71a.75.75 0 0 0 .47.47l1.71.54-1.71.54a.75.75 0 0 0-.47.47L18 20.69l-.54-1.71a.75.75 0 0 0-.47-.47l-1.71-.54 1.71-.54a.75.75 0 0 0 .47-.47L18 14.25Z',
  workspace:
    'M3.75 6A2.25 2.25 0 0 1 6 3.75h4.19a2.25 2.25 0 0 1 1.59.66l.91.9a2.25 2.25 0 0 0 1.59.66H18A2.25 2.25 0 0 1 20.25 8.25v9A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6Z',
  workspaceAdd:
    'M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z M3.75 9.75h16.5 M15.75 11.25v4.5 M13.5 13.5h4.5',
} as const;

type SidebarIconPath = (typeof SIDEBAR_ICON_PATHS)[keyof typeof SIDEBAR_ICON_PATHS];

export type SidebarNavItem = {
  extensionId: string;
  id: string;
  route: string;
  label: string;
  icon?: string;
  section?: 'primary' | 'settings';
};

export function SidebarIcon({ d, size = 16 }: { d: SidebarIconPath | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function getExtensionNavIcon(icon: string | undefined): SidebarIconPath {
  switch (icon) {
    case 'automation':
      return SIDEBAR_ICON_PATHS.automations;
    case 'browser':
      return SIDEBAR_ICON_PATHS.chatBubble;
    case 'diff':
      return SIDEBAR_ICON_PATHS.list;
    case 'file':
      return SIDEBAR_ICON_PATHS.workspace;
    case 'gear':
      return SIDEBAR_ICON_PATHS.settings;
    case 'graph':
      return SIDEBAR_ICON_PATHS.nodes;
    case 'kanban':
      return SIDEBAR_ICON_PATHS.grid;
    case 'play':
      return SIDEBAR_ICON_PATHS.clock;
    case 'sparkle':
      return SIDEBAR_ICON_PATHS.sparkles;
    case 'terminal':
      return SIDEBAR_ICON_PATHS.workspace;
    case 'app':
    case 'database':
    default:
      return SIDEBAR_ICON_PATHS.grid;
  }
}

function TopNavItem({
  to,
  icon,
  label,
  badge,
  forceActive = false,
}: {
  to: string;
  icon: SidebarIconPath;
  label: string;
  badge?: number | null;
  forceActive?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = forceActive || routeMatchesPrefix(location.pathname, to);
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      navigate(to);
    },
    [navigate, to],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      data-route={to}
      className={['ui-sidebar-nav-item w-full text-left', active && 'ui-sidebar-nav-item-active'].filter(Boolean).join(' ')}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 opacity-70"
      >
        <path d={icon} />
      </svg>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && <span className="ui-sidebar-nav-badge">{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
}

export function SidebarPrimaryNav({
  chatActive,
  newConversationBusy,
  newConversationHotkeyLabel,
  items,
  onNewConversation,
}: {
  chatActive: boolean;
  newConversationBusy: boolean;
  newConversationHotkeyLabel: string;
  items: SidebarNavItem[];
  onNewConversation: () => void;
}) {
  return (
    <div className="space-y-px pt-3 pb-1">
      <div className="px-1">
        <button
          type="button"
          onClick={onNewConversation}
          disabled={newConversationBusy}
          className={['ui-sidebar-nav-item mx-0 flex w-full text-secondary', chatActive && 'ui-sidebar-nav-item-active']
            .filter(Boolean)
            .join(' ')}
          title={newConversationBusy ? 'Creating conversation...' : `Chat (${newConversationHotkeyLabel})`}
        >
          <SidebarIcon d={SIDEBAR_ICON_PATHS.plus} size={15} />
          <span className="flex-1 text-left">Chat</span>
        </button>
      </div>
      {items.map((item) => (
        <TopNavItem key={`${item.extensionId}:${item.id}`} to={item.route} icon={getExtensionNavIcon(item.icon)} label={item.label} />
      ))}
    </div>
  );
}

export function SidebarSettingsNav({ items, notice }: { items: SidebarNavItem[]; notice: string | null }) {
  return (
    <div className="shrink-0">
      {notice ? (
        <div aria-live="polite" className="px-4 pb-2 text-[11px] text-accent/80">
          {notice}
        </div>
      ) : null}
      <div className="border-t border-border-subtle px-0 py-2 space-y-0.5">
        {items.map((item) => (
          <TopNavItem key={`${item.extensionId}:${item.id}`} to={item.route} icon={getExtensionNavIcon(item.icon)} label={item.label} />
        ))}
      </div>
    </div>
  );
}
