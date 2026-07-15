import { useEffect, useMemo, useRef } from 'react';

import type { ApplicationWorkspaceState } from '../applications/applicationWorkspace';
import type { ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { ApplicationIcon } from './ApplicationIcon';
import { IconButton, ToolbarButton } from './ui';

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
  const orderedIds = [...new Set(workspace.openViews.map((view) => view.applicationId))];
  return orderedIds.map((id) => byId.get(id)).filter((application): application is ApplicationRegistration => Boolean(application));
}

export function ApplicationTaskbar({
  applications,
  workspace,
  activeApplicationId,
  onActivate,
  onCloseApplication,
}: {
  applications: readonly ApplicationRegistration[];
  workspace: ApplicationWorkspaceState;
  activeApplicationId: string | null;
  onActivate: (application: ApplicationRegistration) => void;
  onCloseApplication: (applicationId: string) => void;
}) {
  const orderedApplications = useMemo(() => applicationTaskbarOrder(applications, workspace), [applications, workspace]);
  const taskbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const taskbar = taskbarRef.current;
    if (!taskbar || !activeApplicationId) return;
    const revealActiveApplication = () => {
      const activeEntry = taskbar.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEntry) taskbar.scrollLeft = activeEntry.offsetLeft;
    };
    revealActiveApplication();
    const handleResize = () => window.requestAnimationFrame(revealActiveApplication);
    window.addEventListener('resize', handleResize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    observer?.observe(taskbar);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [activeApplicationId, orderedApplications.length]);

  return (
    <div ref={taskbarRef} className="ui-application-taskbar" aria-label="Open applications">
      {orderedApplications.map((application) => {
        const views = workspace.openViews.filter((view) => view.applicationId === application.id);
        const active = activeApplicationId === application.id;
        return (
          <div className="ui-application-taskbar__entry group" data-active={active} key={application.id}>
            <ToolbarButton
              type="button"
              className="ui-application-taskbar__item"
              data-application-id={application.id}
              aria-pressed={active}
              aria-label={views.length > 1 ? `${application.title}, ${views.length} open` : application.title}
              onClick={() => onActivate(application)}
            >
              <ApplicationIcon icon={application.icon} title={application.title} />
              <span className="ui-application-taskbar__label">{application.title}</span>
              {views.length > 1 ? (
                <span className="ui-application-taskbar__count" aria-hidden="true">
                  {views.length}
                </span>
              ) : null}
            </ToolbarButton>
            <IconButton
              compact
              size="sm"
              className="ui-application-taskbar__close"
              aria-label={`Close ${application.title}`}
              title={`Close ${application.title}`}
              onClick={() => onCloseApplication(application.id)}
            >
              ×
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
