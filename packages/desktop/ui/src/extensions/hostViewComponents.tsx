import { HOST_VIEW_COMPONENT_DEFINITIONS, type HostViewComponentDefinition } from '@neon-pilot/extensions/host-view-components';
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { Sidebar } from '../components/Sidebar';
import { ActionTile, AppPageIntro, AppPageLayout } from '../components/ui';
import { readConversationIdFromPathname, resolveConversationIndexRedirect } from '../conversation/conversationRoutes';
import {
  hasDraftConversationAttachments,
  hasDraftConversationContextDocs,
  readDraftConversationComposer,
  readDraftConversationCwd,
} from '../conversation/draftConversation';
import { useConversations } from '../hooks/useConversations';
import { lazyWithRecovery } from '../navigation/lazyRouteRecovery';
import { ConversationPage } from '../pages/ConversationPage';
import type { NativeExtensionClient } from './nativePaClient';
import type { NativeExtensionViewSummary } from './types';
import { useExtensionRegistry } from './useExtensionRegistry';

export type { HostViewComponentDefinition };

export type ExtensionHostViewComponent = React.ComponentType<ExtensionHostViewComponentProps>;

export interface ExtensionHostViewComponentProps {
  pa: NativeExtensionClient;
  context: {
    extensionId: string;
    surfaceId: string;
    route?: string | null;
    pathname: string;
    search: string;
    hash: string;
    conversationId?: string | null;
    cwd?: string | null;
    instanceId?: string | null;
  };
  surface: NativeExtensionViewSummary;
  params: Record<string, string>;
  hostProps?: Record<string, unknown>;
  slotOverrides?: Record<string, React.ComponentType<ExtensionHostViewComponentProps>>;
}

export type ExtensionHostViewWrapperComponent = React.ComponentType<
  ExtensionHostViewComponentProps & { HostComponent: ExtensionHostViewComponent }
>;

const hostViewComponentDefinitions: HostViewComponentDefinition[] = [...HOST_VIEW_COMPONENT_DEFINITIONS];

const hostViewComponentRegistry = new Map(hostViewComponentDefinitions.map((definition) => [definition.id, { ...definition }]));

function readStringProp(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBooleanProp(record: Record<string, unknown> | undefined, key: string): boolean {
  return record?.[key] === true;
}

function ConversationIndexHost() {
  const { openIds, pinnedIds, layoutHydrating } = useConversations();
  if (layoutHydrating) return <div className="h-full bg-base" aria-label="Loading conversations" />;
  const hasDraft =
    readDraftConversationComposer().trim().length > 0 ||
    readDraftConversationCwd().trim().length > 0 ||
    hasDraftConversationAttachments() ||
    hasDraftConversationContextDocs();
  return <Navigate to={resolveConversationIndexRedirect({ openIds, pinnedIds, hasDraft })} replace />;
}

function ConversationPageHost({ context, hostProps }: ExtensionHostViewComponentProps) {
  if (context.pathname === '/conversations') return <ConversationIndexHost />;
  if (context.pathname === '/conversations/new') return <ConversationPage key="draft" draft />;
  const conversationId = readStringProp(hostProps, 'conversationId') ?? readConversationIdFromPathname(context.pathname);
  return conversationId ? <ConversationPage key={conversationId} conversationId={conversationId} /> : <ConversationIndexHost />;
}

function ApplicationHomeHost() {
  const navigate = useNavigate();
  const { applications } = useExtensionRegistry();
  const availableApplications = applications.filter((application) => application.available && application.id !== 'system-home:home');
  return (
    <AppPageLayout>
      <div className="max-w-3xl space-y-8">
        <AppPageIntro
          eyebrow="Neon Pilot"
          title="Home"
          summary="Open an application below, or press Command K from anywhere to find applications, pages, conversations, and actions."
        />
        <section className="space-y-3" aria-labelledby="home-applications-title">
          <h2 id="home-applications-title" className="text-[12px] font-semibold text-primary">
            Applications
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {availableApplications.map((application) => (
              <ActionTile
                key={application.id}
                label={application.title}
                description={application.description}
                meta="Open"
                onClick={() => navigate(application.startRoute)}
                icon={
                  <span className="ui-application-taskbar__glyph" aria-hidden="true">
                    {application.title.slice(0, 1).toUpperCase()}
                  </span>
                }
              />
            ))}
          </div>
        </section>
      </div>
    </AppPageLayout>
  );
}

function ApplicationSidebarHost({ hostProps }: ExtensionHostViewComponentProps) {
  return (
    <Sidebar
      applicationId={readStringProp(hostProps, 'applicationId')}
      showConversations={readBooleanProp(hostProps, 'showConversations')}
    />
  );
}

export function isHostViewComponentReference(
  value: unknown,
): value is { host: string; props?: Record<string, unknown>; override?: string; overrides?: Record<string, string> } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { host?: unknown }).host === 'string');
}

function getHostViewComponentDefinition(
  id: string,
): (HostViewComponentDefinition & { load?: () => Promise<{ default: ExtensionHostViewComponent }> }) | undefined {
  return hostViewComponentRegistry.get(id);
}

export function lazyHostViewComponent(id: string) {
  if (id === 'application.home') {
    return React.lazy(async () => ({ default: ApplicationHomeHost }));
  }
  if (id === 'application.sidebar') {
    return React.lazy(async () => ({ default: ApplicationSidebarHost }));
  }
  if (id === 'conversation.page') {
    return React.lazy(async () => ({ default: ConversationPageHost }));
  }
  const definition = getHostViewComponentDefinition(id);
  if (!definition?.load) throw new Error(`Unknown host view component: ${id}`);
  return lazyWithRecovery(`host-view:${id}`, definition.load);
}
