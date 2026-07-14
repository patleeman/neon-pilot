import { useEffect, useMemo, useRef, useState } from 'react';

import type { ApplicationViewState, ApplicationWorkspaceState } from '../applications/applicationWorkspace';
import type { ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { MenuItem, MenuShell, ToolbarButton } from './ui';

function applicationGlyph(application: ApplicationRegistration): string {
  return application.title.trim().slice(0, 1).toUpperCase() || 'A';
}

export function applicationTaskbarOrder(
  applications: readonly ApplicationRegistration[],
  workspace: ApplicationWorkspaceState,
): ApplicationRegistration[] {
  const byId = new Map(applications.map((application) => [application.id, application]));
  for (const view of workspace.openViews) {
    if (byId.has(view.applicationId)) continue;
    byId.set(view.applicationId, {
      id: view.applicationId,
      extensionId: view.applicationId.split(':')[0] ?? view.applicationId,
      localId: view.applicationId.split(':')[1] ?? 'missing',
      title: view.title.split(' · ')[0] ?? 'Unavailable application',
      startRoute: view.route,
      instancePolicy:
        workspace.openViews.filter((candidate) => candidate.applicationId === view.applicationId).length > 1 ? 'multiple' : 'singleton',
      defaultPinned: false,
      order: Number.MAX_SAFE_INTEGER,
      available: false,
      implicit: false,
      navigationSlots: [],
    });
  }
  const openApplicationIds = workspace.openViews
    .slice()
    .sort((left, right) => Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt))
    .map((view) => view.applicationId);
  const orderedIds = [...new Set([...workspace.pinnedApplicationIds.filter((id) => byId.has(id)), ...openApplicationIds])];
  return orderedIds.map((id) => byId.get(id)).filter((application): application is ApplicationRegistration => Boolean(application));
}

export function ApplicationTaskbar({
  applications,
  workspace,
  activeApplicationId,
  onActivate,
  onActivateView,
  onTogglePinned,
  onCloseView,
}: {
  applications: readonly ApplicationRegistration[];
  workspace: ApplicationWorkspaceState;
  activeApplicationId: string | null;
  onActivate: (application: ApplicationRegistration) => void;
  onActivateView: (view: ApplicationViewState) => void;
  onTogglePinned: (applicationId: string) => void;
  onCloseView: (viewId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const [menuApplicationId, setMenuApplicationId] = useState<string | null>(null);
  const [hoverApplicationId, setHoverApplicationId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const orderedApplications = useMemo(() => applicationTaskbarOrder(applications, workspace), [applications, workspace]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? node.clientWidth;
      setVisibleCount(Math.max(1, Math.min(8, Math.floor((width - 36) / 112))));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setMenuApplicationId(null);
      setOverflowOpen(false);
    }
    window.addEventListener('mousedown', closeMenus);
    return () => {
      window.removeEventListener('mousedown', closeMenus);
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const visible = orderedApplications.slice(0, visibleCount);
  const overflow = orderedApplications.slice(visibleCount);

  function closeMenus() {
    setMenuApplicationId(null);
    setHoverApplicationId(null);
    setOverflowOpen(false);
  }

  function renderApplicationManagement(application: ApplicationRegistration, views: ApplicationViewState[], pinned: boolean) {
    return (
      <>
        {views.map((view) => (
          <div className="ui-application-taskbar__view-row" key={view.id}>
            <MenuItem
              className="min-w-0 flex-1"
              onClick={() => {
                closeMenus();
                onActivateView(view);
              }}
            >
              <span className="min-w-0 flex-1 truncate">{view.title}</span>
            </MenuItem>
            <ToolbarButton
              type="button"
              className="ui-application-taskbar__close"
              aria-label={`Close ${view.title}`}
              onClick={() => {
                closeMenus();
                onCloseView(view.id);
              }}
            >
              ×
            </ToolbarButton>
          </div>
        ))}
        <MenuItem
          onClick={() => {
            closeMenus();
            onTogglePinned(application.id);
          }}
        >
          {pinned ? 'Unpin application' : 'Pin application'}
        </MenuItem>
        {!application.available ? (
          <MenuItem
            onClick={() => {
              closeMenus();
              onCloseView(views[0]?.id ?? application.id);
            }}
          >
            Dismiss unavailable view
          </MenuItem>
        ) : null}
      </>
    );
  }

  function renderApplication(application: ApplicationRegistration) {
    const views = workspace.openViews.filter((view) => view.applicationId === application.id);
    const active = activeApplicationId === application.id;
    const pinned = workspace.pinnedApplicationIds.includes(application.id);
    const supportsViewPreview = application.instancePolicy === 'multiple' || views.length > 1 || !application.available;
    const menuOpen = menuApplicationId === application.id || hoverApplicationId === application.id;
    return (
      <div
        className="relative min-w-0"
        key={application.id}
        onMouseEnter={() => {
          if (!supportsViewPreview) return;
          if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = window.setTimeout(() => setHoverApplicationId(application.id), 300);
        }}
        onMouseLeave={() => {
          if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
          setHoverApplicationId((current) => (current === application.id ? null : current));
        }}
      >
        <ToolbarButton
          type="button"
          className="ui-application-taskbar__item"
          data-application-id={application.id}
          aria-pressed={active}
          aria-expanded={menuOpen}
          aria-label={`${application.title}${views.length > 0 ? `, ${views.length} open` : ''}`}
          onClick={() => {
            if (active && supportsViewPreview) {
              setMenuApplicationId((current) => (current === application.id ? null : application.id));
              return;
            }
            onActivate(application);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuApplicationId(application.id);
          }}
        >
          <span className="ui-application-taskbar__glyph" aria-hidden="true">
            {applicationGlyph(application)}
          </span>
          <span className="ui-application-taskbar__label">{application.title}</span>
          {views.length > 1 ? <span className="ui-application-taskbar__count">{views.length}</span> : null}
        </ToolbarButton>
        {menuOpen ? (
          <MenuShell className="ui-application-taskbar__menu" aria-label={`${application.title} application menu`}>
            {renderApplicationManagement(application, views, pinned)}
          </MenuShell>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="ui-application-taskbar" aria-label="Applications">
      {visible.map(renderApplication)}
      {overflow.length > 0 ? (
        <div className="relative">
          <ToolbarButton
            type="button"
            className="ui-application-taskbar__overflow"
            aria-label={`${overflow.length} more applications`}
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((open) => !open)}
          >
            •••
          </ToolbarButton>
          {overflowOpen ? (
            <MenuShell className="ui-application-taskbar__overflow-menu" aria-label="More applications">
              {overflow.map((application) => (
                <div key={application.id}>
                  <MenuItem
                    onClick={() => {
                      closeMenus();
                      onActivate(application);
                    }}
                  >
                    <span className="ui-application-taskbar__glyph" aria-hidden="true">
                      {applicationGlyph(application)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{application.title}</span>
                    {workspace.openViews.some((view) => view.applicationId === application.id) ? (
                      <span className="text-dim">Open</span>
                    ) : null}
                  </MenuItem>
                  <MenuItem onClick={() => setMenuApplicationId((current) => (current === application.id ? null : application.id))}>
                    Manage {application.title}
                  </MenuItem>
                  {menuApplicationId === application.id
                    ? renderApplicationManagement(
                        application,
                        workspace.openViews.filter((view) => view.applicationId === application.id),
                        workspace.pinnedApplicationIds.includes(application.id),
                      )
                    : null}
                </div>
              ))}
            </MenuShell>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
