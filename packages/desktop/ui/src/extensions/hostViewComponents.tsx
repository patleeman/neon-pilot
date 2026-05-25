import { HOST_VIEW_COMPONENT_DEFINITIONS, type HostViewComponentDefinition } from '@neon-pilot/extensions/host-view-components';
import React from 'react';

import { lazyWithRecovery } from '../navigation/lazyRouteRecovery';
import type { NativeExtensionClient } from './nativePaClient';
import type { NativeExtensionViewSummary } from './types';

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
  const definition = getHostViewComponentDefinition(id);
  if (!definition?.load) throw new Error(`Unknown host view component: ${id}`);
  return lazyWithRecovery(`host-view:${id}`, definition.load);
}
