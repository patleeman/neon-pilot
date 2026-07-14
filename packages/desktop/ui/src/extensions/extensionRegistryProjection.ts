import type { ExtensionInstallSummary, ExtensionManifest, ExtensionRouteSummary, ExtensionSurfaceSummary } from './types';

export interface ExtensionTopBarElementRegistration {
  extensionId: string;
  id: string;
  component: string;
  label?: string;
  frontendEntry?: string;
}

export interface ExtensionToolbarActionRegistration {
  extensionId: string;
  id: string;
  title: string;
  icon: string;
  action: string;
  when?: string;
  priority?: number;
}

export interface ExtensionComposerControlRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  slot: 'leading' | 'preferences' | 'actions';
  when?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionComposerInputToolRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  when?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionConversationHeaderElementRegistration {
  extensionId: string;
  id: string;
  component: string;
  label?: string;
  frontendEntry?: string;
}

export interface ExtensionStatusBarItemRegistration {
  extensionId: string;
  id: string;
  label: string;
  action?: string;
  component?: string;
  alignment: 'left' | 'right';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionContextMenuRegistration {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  surface: 'message' | 'conversationList' | 'selection' | 'fileSelection' | 'transcriptSelection';
  separator?: boolean;
  when?: string;
}

export interface ExtensionSelectionActionRegistration {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  kinds: Array<'text' | 'messages' | 'files' | 'transcriptRange'>;
  icon?: string;
  args?: unknown;
  when?: string;
  priority?: number;
}

export interface ExtensionThreadHeaderActionRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionConversationDecoratorRegistration {
  extensionId: string;
  id: string;
  component: string;
  position: 'before-title' | 'after-title' | 'subtitle';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionActivityTreeItemElementRegistration {
  extensionId: string;
  id: string;
  component: string;
  slot: 'leading' | 'before-title' | 'after-title' | 'subtitle' | 'trailing';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionActivityTreeItemStyleRegistration {
  extensionId: string;
  id: string;
  provider: string;
  priority?: number;
}

export interface ExtensionConversationLifecycleRegistration {
  extensionId: string;
  id: string;
  component: string;
  events: Array<
    | 'before-run'
    | 'after-run-start'
    | 'blocked'
    | 'waiting-for-user'
    | 'model-error'
    | 'tool-error'
    | 'goal-active'
    | 'compaction-available'
  >;
  slot: 'banner' | 'inline';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionTranscriptBlockRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  schemaVersion?: number;
  frontendEntry?: string;
}

export interface ExtensionComposerAttachmentProviderRegistration {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  icon?: string;
  priority?: number;
}

export interface ExtensionComposerAttachmentRendererRegistration {
  extensionId: string;
  id: string;
  type: string;
  component: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionComposerAttachmentResolverRegistration {
  extensionId: string;
  id: string;
  type: string;
  action: string;
}

export interface ExtensionActivityTreeItemActionRegistration {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  icon?: string;
  when?: string;
  priority?: number;
}

export interface ExtensionComposerShelfRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  placement: 'top' | 'bottom';
  frontendEntry?: string;
}

export interface ExtensionNewConversationPanelRegistration {
  extensionId: string;
  id: string;
  component: string;
  title?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionSettingsComponentRegistration {
  extensionId: string;
  id: string;
  component: string;
  sectionId: string;
  label: string;
  description?: string;
  order?: number;
  frontendEntry?: string;
}

export interface ExtensionMessageActionRegistration {
  extensionId: string;
  id: string;
  title: string;
  action: string;
  when?: string;
  priority?: number;
}

export type ExtensionRegistryEntry = ExtensionInstallSummary & ExtensionManifest;

export interface ApplicationRegistration {
  id: string;
  extensionId: string;
  localId: string;
  title: string;
  description?: string;
  icon?: string;
  startRoute: string;
  sidebarView?: string;
  instancePolicy: 'singleton' | 'multiple';
  defaultPinned: boolean;
  order: number;
  available: boolean;
  implicit: boolean;
  navigationSlots: Array<{ id: string; label?: string; order: number }>;
  routes?: string[];
}

export interface ApplicationNavigationRegistration {
  id: string;
  extensionId: string;
  applicationId: string;
  label: string;
  route: string;
  icon?: string;
  slot: string;
  slotLabel?: string;
  slotOrder: number;
  order: number;
  sidebarView?: string;
  rightSidebarView?: string;
  pageType?: string;
}

function normalizeRegistryExtensions(extensions: ExtensionInstallSummary[]): ExtensionRegistryEntry[] {
  return extensions.map((extension) => ({
    ...extension.manifest,
    ...extension,
  }));
}

export const EMPTY_EXTENSION_REGISTRY_STATE: ExtensionRegistryState = {
  extensions: [],
  applications: [],
  applicationNavigation: [],
  routes: [],
  surfaces: [],
  topBarElements: [],
  messageActions: [],
  composerShelves: [],
  newConversationPanels: [],
  settingsComponent: null,
  settingsComponents: [],
  composerControls: [],
  composerInputTools: [],
  toolbarActions: [],
  contextMenus: [],
  selectionActions: [],
  threadHeaderActions: [],
  statusBarItems: [],
  conversationHeaderElements: [],
  conversationDecorators: [],
  activityTreeItemElements: [],
  activityTreeItemStyles: [],
  conversationLifecycle: [],
  transcriptBlocks: [],
  composerAttachmentProviders: [],
  composerAttachmentRenderers: [],
  composerAttachmentResolvers: [],
  activityTreeItemActions: [],
  loading: false,
  error: null,
};

export const INITIAL_EXTENSION_REGISTRY_STATE: ExtensionRegistryState = {
  ...EMPTY_EXTENSION_REGISTRY_STATE,
  loading: true,
};

export interface ExtensionRegistryState {
  extensions: ExtensionRegistryEntry[];
  applications: ApplicationRegistration[];
  applicationNavigation: ApplicationNavigationRegistration[];
  routes: ExtensionRouteSummary[];
  surfaces: ExtensionSurfaceSummary[];
  topBarElements: ExtensionTopBarElementRegistration[];
  messageActions: ExtensionMessageActionRegistration[];
  composerShelves: ExtensionComposerShelfRegistration[];
  newConversationPanels: ExtensionNewConversationPanelRegistration[];
  settingsComponent: ExtensionSettingsComponentRegistration | null;
  settingsComponents: ExtensionSettingsComponentRegistration[];
  composerControls: ExtensionComposerControlRegistration[];
  composerInputTools: ExtensionComposerInputToolRegistration[];
  toolbarActions: ExtensionToolbarActionRegistration[];
  contextMenus: ExtensionContextMenuRegistration[];
  selectionActions: ExtensionSelectionActionRegistration[];
  threadHeaderActions: ExtensionThreadHeaderActionRegistration[];
  statusBarItems: ExtensionStatusBarItemRegistration[];
  conversationHeaderElements: ExtensionConversationHeaderElementRegistration[];
  conversationDecorators: ExtensionConversationDecoratorRegistration[];
  activityTreeItemElements: ExtensionActivityTreeItemElementRegistration[];
  activityTreeItemStyles: ExtensionActivityTreeItemStyleRegistration[];
  conversationLifecycle: ExtensionConversationLifecycleRegistration[];
  transcriptBlocks: ExtensionTranscriptBlockRegistration[];
  composerAttachmentProviders: ExtensionComposerAttachmentProviderRegistration[];
  composerAttachmentRenderers: ExtensionComposerAttachmentRendererRegistration[];
  composerAttachmentResolvers: ExtensionComposerAttachmentResolverRegistration[];
  activityTreeItemActions: ExtensionActivityTreeItemActionRegistration[];
  loading: boolean;
  error: string | null;
}

function normalizeApplications(extensions: ExtensionRegistryEntry[]): ApplicationRegistration[] {
  const result: ApplicationRegistration[] = [];
  for (const extension of extensions) {
    const declared = extension.contributes?.applications ?? [];
    if (declared.length > 0) {
      for (const application of declared) {
        result.push({
          id: `${extension.id}:${application.id}`,
          extensionId: extension.id,
          localId: application.id,
          title: application.title,
          ...(application.description ? { description: application.description } : {}),
          ...(application.icon ? { icon: application.icon } : {}),
          startRoute: application.startRoute,
          ...(application.sidebarView ? { sidebarView: application.sidebarView } : {}),
          instancePolicy: application.instancePolicy ?? 'singleton',
          defaultPinned: application.defaultPinned ?? false,
          order: application.order ?? 0,
          available: extension.enabled && extension.status !== 'invalid',
          implicit: false,
          navigationSlots: (application.navigationSlots ?? []).map((slot) => ({
            id: slot.id,
            ...(slot.label ? { label: slot.label } : {}),
            order: slot.order ?? 0,
          })),
        });
      }
      continue;
    }

    const firstNav = extension.contributes?.nav?.find((item) => !item.applicationId);
    const firstMainView = extension.contributes?.views?.find((view) => view.location === 'main' && view.route && !view.applicationId);
    const startRoute = firstNav?.route ?? firstMainView?.route;
    if (!startRoute) continue;
    result.push({
      id: `${extension.id}:default`,
      extensionId: extension.id,
      localId: 'default',
      title: extension.name,
      ...(extension.description ? { description: extension.description } : {}),
      ...(firstNav?.icon ? { icon: firstNav.icon } : {}),
      startRoute,
      instancePolicy: 'singleton',
      defaultPinned: false,
      order: 0,
      available: extension.enabled && extension.status !== 'invalid',
      implicit: true,
      navigationSlots: [{ id: 'primary', order: 0 }],
    });
  }
  const routesByApplication = new Map(result.map((application) => [application.id, new Set([application.startRoute])]));
  for (const extension of extensions) {
    for (const view of extension.contributes?.views ?? []) {
      if (view.location !== 'main' || !view.route) continue;
      const applicationId = view.applicationId ?? `${extension.id}:default`;
      routesByApplication.get(applicationId)?.add(view.route);
    }
  }
  for (const application of result) {
    application.routes = [...(routesByApplication.get(application.id) ?? [])];
  }
  return result.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
}

function normalizeApplicationNavigation(
  extensions: ExtensionRegistryEntry[],
  applications: readonly ApplicationRegistration[],
): ApplicationNavigationRegistration[] {
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  const result: ApplicationNavigationRegistration[] = [];
  for (const extension of extensions) {
    if (!extension.enabled || extension.status === 'invalid') continue;
    for (const item of extension.contributes?.nav ?? []) {
      const applicationId = item.applicationId ?? `${extension.id}:default`;
      const application = applicationsById.get(applicationId);
      if (!application) continue;
      const slotId = item.slot ?? (item.section === 'settings' ? 'settings' : 'primary');
      const declaredSlot = application.navigationSlots.find((slot) => slot.id === slotId);
      if (application.navigationSlots.length > 0 && !declaredSlot) continue;
      result.push({
        id: `${extension.id}:${item.id}`,
        extensionId: extension.id,
        applicationId,
        label: item.label,
        route: item.route,
        ...(item.icon ? { icon: item.icon } : {}),
        slot: slotId,
        ...(declaredSlot?.label ? { slotLabel: declaredSlot.label } : {}),
        slotOrder: declaredSlot?.order ?? 0,
        order: item.order ?? 0,
        ...(item.sidebarView ? { sidebarView: item.sidebarView } : {}),
        ...(item.rightSidebarView ? { rightSidebarView: item.rightSidebarView } : {}),
        ...(item.pageType ? { pageType: item.pageType } : {}),
      });
    }
  }
  return result.sort(
    (left, right) =>
      left.applicationId.localeCompare(right.applicationId) ||
      left.slotOrder - right.slotOrder ||
      left.order - right.order ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id),
  );
}

function addApplicationContributionDiagnostics(
  extensions: ExtensionRegistryEntry[],
  applications: readonly ApplicationRegistration[],
): ExtensionRegistryEntry[] {
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  return extensions.map((extension) => {
    const diagnostics = [...(extension.diagnostics ?? [])];
    const inspectTarget = (kind: 'navigation' | 'view', id: string, applicationId: string, slot?: string) => {
      const application = applicationsById.get(applicationId);
      if (!application) {
        diagnostics.push(`${kind} "${id}" targets unknown application "${applicationId}".`);
        return;
      }
      if (slot && application.navigationSlots.length > 0 && !application.navigationSlots.some((candidate) => candidate.id === slot)) {
        diagnostics.push(`${kind} "${id}" targets undeclared navigation slot "${slot}" in "${applicationId}".`);
      }
    };
    for (const item of extension.contributes?.nav ?? []) {
      if (item.applicationId) inspectTarget('navigation', item.id, item.applicationId, item.slot);
    }
    for (const view of extension.contributes?.views ?? []) {
      if (view.applicationId) inspectTarget('view', view.id, view.applicationId);
    }
    return diagnostics.length === (extension.diagnostics?.length ?? 0) ? extension : { ...extension, diagnostics };
  });
}

function normalizeTopBarElements(extensions: ExtensionManifest[]): ExtensionTopBarElementRegistration[] {
  const result: ExtensionTopBarElementRegistration[] = [];
  for (const extension of extensions) {
    const elements = extension.contributes?.topBarElements;
    if (!elements?.length) continue;
    for (const element of elements) {
      result.push({
        extensionId: extension.id,
        id: element.id,
        component: element.component,
        label: element.label,
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  return result;
}

function normalizeMessageActions(extensions: ExtensionManifest[]): ExtensionMessageActionRegistration[] {
  const result: ExtensionMessageActionRegistration[] = [];
  for (const extension of extensions) {
    const actions = extension.contributes?.messageActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension.id,
        id: action.id,
        title: action.title,
        action: action.action,
        ...(action.when ? { when: action.when } : {}),
        ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeComposerShelves(extensions: ExtensionManifest[]): ExtensionComposerShelfRegistration[] {
  const result: ExtensionComposerShelfRegistration[] = [];
  for (const extension of extensions) {
    const shelves = extension.contributes?.composerShelves;
    if (!shelves?.length) continue;
    for (const shelf of shelves) {
      result.push({
        extensionId: extension.id,
        id: shelf.id,
        component: shelf.component,
        title: shelf.title,
        placement: shelf.placement ?? 'bottom',
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  return result;
}

function normalizeNewConversationPanels(extensions: ExtensionManifest[]): ExtensionNewConversationPanelRegistration[] {
  const result: ExtensionNewConversationPanelRegistration[] = [];
  for (const extension of extensions) {
    const panels = extension.contributes?.newConversationPanels;
    if (!panels?.length) continue;
    for (const panel of panels) {
      result.push({
        extensionId: extension.id,
        id: panel.id,
        component: panel.component,
        ...(panel.title ? { title: panel.title } : {}),
        ...(typeof panel.priority === 'number' ? { priority: panel.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeSettingsComponents(extensions: ExtensionManifest[]): ExtensionSettingsComponentRegistration[] {
  const result: ExtensionSettingsComponentRegistration[] = [];
  for (const extension of extensions) {
    const panel = extension.contributes?.settingsComponent;
    if (!panel) continue;
    result.push({
      extensionId: extension.id,
      id: panel.id,
      component: panel.component,
      sectionId: panel.sectionId,
      label: panel.label,
      ...(panel.description ? { description: panel.description } : {}),
      ...(typeof panel.order === 'number' ? { order: panel.order } : {}),
      frontendEntry: extension.frontend?.entry,
    });
  }
  result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return result;
}

function compareComposerControls(a: ExtensionComposerControlRegistration, b: ExtensionComposerControlRegistration): number {
  return (a.priority ?? 0) - (b.priority ?? 0) || a.extensionId.localeCompare(b.extensionId) || a.id.localeCompare(b.id);
}

function normalizeComposerControls(extensions: ExtensionManifest[]): ExtensionComposerControlRegistration[] {
  const result: ExtensionComposerControlRegistration[] = [];
  for (const extension of extensions) {
    for (const control of extension.contributes?.composerControls ?? []) {
      result.push({
        extensionId: extension.id,
        id: control.id,
        component: control.component,
        slot: control.slot ?? 'preferences',
        ...(control.title ? { title: control.title } : {}),
        ...(control.when ? { when: control.when } : {}),
        ...(typeof control.priority === 'number' ? { priority: control.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort(compareComposerControls);
  return result;
}

function normalizeComposerInputTools(extensions: ExtensionManifest[]): ExtensionComposerInputToolRegistration[] {
  const result: ExtensionComposerInputToolRegistration[] = [];
  for (const extension of extensions) {
    const tools = extension.contributes?.composerInputTools;
    if (!tools?.length) continue;
    for (const tool of tools) {
      result.push({
        extensionId: extension.id,
        id: tool.id,
        component: tool.component,
        ...(tool.title ? { title: tool.title } : {}),
        ...(tool.when ? { when: tool.when } : {}),
        ...(typeof tool.priority === 'number' ? { priority: tool.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeToolbarActions(extensions: ExtensionManifest[]): ExtensionToolbarActionRegistration[] {
  const result: ExtensionToolbarActionRegistration[] = [];
  for (const extension of extensions) {
    const actions = extension.contributes?.toolbarActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension.id,
        id: action.id,
        title: action.title,
        icon: action.icon,
        action: action.action,
        ...(action.when ? { when: action.when } : {}),
        ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeConversationHeaderElements(extensions: ExtensionManifest[]): ExtensionConversationHeaderElementRegistration[] {
  const result: ExtensionConversationHeaderElementRegistration[] = [];
  for (const extension of extensions) {
    const elements = extension.contributes?.conversationHeaderElements;
    if (!elements?.length) continue;
    for (const element of elements) {
      result.push({
        extensionId: extension.id,
        id: element.id,
        component: element.component,
        label: element.label,
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  return result;
}

function normalizeConversationDecorators(extensions: ExtensionManifest[]): ExtensionConversationDecoratorRegistration[] {
  const result: ExtensionConversationDecoratorRegistration[] = [];
  for (const extension of extensions) {
    const decorators = extension.contributes?.conversationDecorators;
    if (!decorators?.length) continue;
    for (const decorator of decorators) {
      result.push({
        extensionId: extension.id,
        id: decorator.id,
        component: decorator.component,
        position: decorator.position,
        ...(typeof decorator.priority === 'number' ? { priority: decorator.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeActivityTreeItemElements(extensions: ExtensionManifest[]): ExtensionActivityTreeItemElementRegistration[] {
  const result: ExtensionActivityTreeItemElementRegistration[] = [];
  for (const extension of extensions) {
    const elements = extension.contributes?.activityTreeItemElements;
    if (!elements?.length) continue;
    for (const element of elements) {
      result.push({
        extensionId: extension.id,
        id: element.id,
        component: element.component,
        slot: element.slot,
        ...(typeof element.priority === 'number' ? { priority: element.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeActivityTreeItemStyles(extensions: ExtensionManifest[]): ExtensionActivityTreeItemStyleRegistration[] {
  const result: ExtensionActivityTreeItemStyleRegistration[] = [];
  for (const extension of extensions) {
    const styles = extension.contributes?.activityTreeItemStyles;
    if (!styles?.length) continue;
    for (const style of styles) {
      result.push({
        extensionId: extension.id,
        id: style.id,
        provider: style.provider,
        ...(typeof style.priority === 'number' ? { priority: style.priority } : {}),
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeConversationLifecycle(extensions: ExtensionManifest[]): ExtensionConversationLifecycleRegistration[] {
  const result: ExtensionConversationLifecycleRegistration[] = [];
  for (const extension of extensions) {
    const items = extension.contributes?.conversationLifecycle;
    if (!items?.length) continue;
    for (const item of items) {
      result.push({
        extensionId: extension.id,
        id: item.id,
        component: item.component,
        events: item.events,
        slot: item.slot ?? 'banner',
        ...(typeof item.priority === 'number' ? { priority: item.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeTranscriptBlocks(extensions: ExtensionManifest[]): ExtensionTranscriptBlockRegistration[] {
  const result: ExtensionTranscriptBlockRegistration[] = [];
  for (const extension of extensions) {
    const blocks = extension.contributes?.transcriptBlocks;
    if (!blocks?.length) continue;
    for (const block of blocks) {
      result.push({
        extensionId: extension.id,
        id: block.id,
        component: block.component,
        ...(block.title ? { title: block.title } : {}),
        ...(typeof block.schemaVersion === 'number' ? { schemaVersion: block.schemaVersion } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  return result.sort((a, b) => a.extensionId.localeCompare(b.extensionId) || a.id.localeCompare(b.id));
}

function normalizeComposerAttachmentProviders(extensions: ExtensionManifest[]): ExtensionComposerAttachmentProviderRegistration[] {
  const result: ExtensionComposerAttachmentProviderRegistration[] = [];
  for (const extension of extensions)
    for (const provider of extension.contributes?.composerAttachmentProviders ?? [])
      result.push({
        extensionId: extension.id,
        id: provider.id,
        title: provider.title,
        action: provider.action,
        ...(provider.icon ? { icon: provider.icon } : {}),
        ...(typeof provider.priority === 'number' ? { priority: provider.priority } : {}),
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeComposerAttachmentRenderers(extensions: ExtensionManifest[]): ExtensionComposerAttachmentRendererRegistration[] {
  const result: ExtensionComposerAttachmentRendererRegistration[] = [];
  for (const extension of extensions)
    for (const renderer of extension.contributes?.composerAttachmentRenderers ?? [])
      result.push({
        extensionId: extension.id,
        id: renderer.id,
        type: renderer.type,
        component: renderer.component,
        ...(typeof renderer.priority === 'number' ? { priority: renderer.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeComposerAttachmentResolvers(extensions: ExtensionManifest[]): ExtensionComposerAttachmentResolverRegistration[] {
  const result: ExtensionComposerAttachmentResolverRegistration[] = [];
  for (const extension of extensions)
    for (const resolver of extension.contributes?.composerAttachmentResolvers ?? [])
      result.push({ extensionId: extension.id, id: resolver.id, type: resolver.type, action: resolver.action });
  return result;
}

function normalizeActivityTreeItemActions(extensions: ExtensionManifest[]): ExtensionActivityTreeItemActionRegistration[] {
  const result: ExtensionActivityTreeItemActionRegistration[] = [];
  for (const extension of extensions)
    for (const action of extension.contributes?.activityTreeItemActions ?? [])
      result.push({
        extensionId: extension.id,
        id: action.id,
        title: action.title,
        action: action.action,
        ...(action.icon ? { icon: action.icon } : {}),
        ...(action.when ? { when: action.when } : {}),
        ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
      });
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeContextMenus(extensions: ExtensionManifest[]): ExtensionContextMenuRegistration[] {
  const result: ExtensionContextMenuRegistration[] = [];
  for (const extension of extensions) {
    const menus = extension.contributes?.contextMenus;
    if (!menus?.length) continue;
    for (const menu of menus) {
      result.push({
        extensionId: extension.id,
        id: menu.id,
        title: menu.title,
        action: menu.action,
        surface: menu.surface,
        ...(menu.separator ? { separator: true } : {}),
        ...(menu.when ? { when: menu.when } : {}),
      });
    }
  }
  return result;
}

function toSelectionActionRegistration(
  extensionId: string,
  action: ExtensionSelectionActionContribution,
): ExtensionSelectionActionRegistration {
  return {
    extensionId,
    id: action.id,
    title: action.title,
    action: action.action,
    kinds: action.kinds,
    ...(action.icon ? { icon: action.icon } : {}),
    ...(action.args !== undefined ? { args: action.args } : {}),
    ...(action.when ? { when: action.when } : {}),
    ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
  };
}

function normalizeSettingItems(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandSelectionActionFromSetting(
  extensionId: string,
  action: ExtensionSelectionActionContribution,
  settings: Record<string, unknown>,
): ExtensionSelectionActionRegistration[] {
  const settingItems = action.settingItems;
  if (!settingItems) {
    return [toSelectionActionRegistration(extensionId, action)];
  }

  if (typeof settings[settingItems.key] !== 'string') {
    return [toSelectionActionRegistration(extensionId, action)];
  }

  const items = normalizeSettingItems(settings[settingItems.key]);
  if (items.length === 0) {
    return [];
  }

  const baseArgs =
    action.args && typeof action.args === 'object' && !Array.isArray(action.args) ? (action.args as Record<string, unknown>) : {};
  const idPrefix = settingItems.idPrefix?.trim() || action.id;
  return items.map((item, index): ExtensionSelectionActionRegistration => {
    const [firstToken = item] = item.split(/\s+/, 1);
    const args = settingItems.argsKey ? { ...baseArgs, [settingItems.argsKey]: item } : action.args;
    return {
      extensionId,
      id: `${idPrefix}-${index + 1}`,
      title: item,
      action: action.action,
      kinds: action.kinds,
      ...(settingItems.icon === 'firstToken' ? { icon: firstToken } : action.icon ? { icon: action.icon } : {}),
      ...(args !== undefined ? { args } : {}),
      ...(action.when ? { when: action.when } : {}),
      priority: action.priority !== undefined ? action.priority - index : -index,
    };
  });
}

function normalizeSelectionActions(
  extensions: ExtensionManifest[],
  settings: Record<string, unknown>,
): ExtensionSelectionActionRegistration[] {
  const result: ExtensionSelectionActionRegistration[] = [];
  for (const extension of extensions) {
    const actions = extension.contributes?.selectionActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push(...expandSelectionActionFromSetting(extension.id, action, settings));
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeThreadHeaderActions(extensions: ExtensionManifest[]): ExtensionThreadHeaderActionRegistration[] {
  const result: ExtensionThreadHeaderActionRegistration[] = [];
  for (const extension of extensions) {
    const actions = extension.contributes?.threadHeaderActions;
    if (!actions?.length) continue;
    for (const action of actions) {
      result.push({
        extensionId: extension.id,
        id: action.id,
        component: action.component,
        ...(action.title ? { title: action.title } : {}),
        ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

function normalizeStatusBarItems(extensions: ExtensionManifest[]): ExtensionStatusBarItemRegistration[] {
  const result: ExtensionStatusBarItemRegistration[] = [];
  for (const extension of extensions) {
    const items = extension.contributes?.statusBarItems;
    if (!items?.length) continue;
    for (const item of items) {
      result.push({
        extensionId: extension.id,
        id: item.id,
        label: item.label,
        ...(item.action ? { action: item.action } : {}),
        ...(item.component ? { component: item.component } : {}),
        alignment: item.alignment ?? 'right',
        ...(typeof item.priority === 'number' ? { priority: item.priority } : {}),
        frontendEntry: extension.frontend?.entry,
      });
    }
  }
  result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return result;
}

export function normalizeExtensionRegistryState(
  extensions: ExtensionInstallSummary[],
  routes: ExtensionRouteSummary[],
  surfaces: ExtensionSurfaceSummary[],
  settings: Record<string, unknown>,
): ExtensionRegistryState {
  const rawRegistryExtensions = normalizeRegistryExtensions(extensions);
  const applications = normalizeApplications(rawRegistryExtensions);
  const registryExtensions = addApplicationContributionDiagnostics(rawRegistryExtensions, applications);
  const enabledRegistryExtensions = registryExtensions.filter((extension) => extension.enabled);
  const enabledExtensionIds = new Set(enabledRegistryExtensions.map((extension) => extension.id));
  const knownApplicationIds = new Set(applications.map((application) => application.id));
  const settingsComponents = normalizeSettingsComponents(enabledRegistryExtensions);
  const composerControls = normalizeComposerControls(enabledRegistryExtensions);

  return {
    extensions: registryExtensions,
    applications,
    applicationNavigation: normalizeApplicationNavigation(registryExtensions, applications),
    routes: routes.filter((route) => enabledExtensionIds.has(route.extensionId)),
    surfaces: surfaces.filter(
      (surface) =>
        enabledExtensionIds.has(surface.extensionId) && (!surface.applicationId || knownApplicationIds.has(surface.applicationId)),
    ),
    topBarElements: normalizeTopBarElements(enabledRegistryExtensions),
    messageActions: normalizeMessageActions(enabledRegistryExtensions),
    composerShelves: normalizeComposerShelves(enabledRegistryExtensions),
    newConversationPanels: normalizeNewConversationPanels(enabledRegistryExtensions),
    settingsComponents,
    settingsComponent: settingsComponents[0] ?? null,
    composerControls,
    composerInputTools: normalizeComposerInputTools(enabledRegistryExtensions),
    toolbarActions: normalizeToolbarActions(enabledRegistryExtensions),
    contextMenus: normalizeContextMenus(enabledRegistryExtensions),
    selectionActions: normalizeSelectionActions(enabledRegistryExtensions, settings),
    threadHeaderActions: normalizeThreadHeaderActions(enabledRegistryExtensions),
    statusBarItems: normalizeStatusBarItems(enabledRegistryExtensions),
    conversationHeaderElements: normalizeConversationHeaderElements(enabledRegistryExtensions),
    conversationDecorators: normalizeConversationDecorators(enabledRegistryExtensions),
    activityTreeItemElements: normalizeActivityTreeItemElements(enabledRegistryExtensions),
    activityTreeItemStyles: normalizeActivityTreeItemStyles(enabledRegistryExtensions),
    conversationLifecycle: normalizeConversationLifecycle(enabledRegistryExtensions),
    transcriptBlocks: normalizeTranscriptBlocks(enabledRegistryExtensions),
    composerAttachmentProviders: normalizeComposerAttachmentProviders(enabledRegistryExtensions),
    composerAttachmentRenderers: normalizeComposerAttachmentRenderers(enabledRegistryExtensions),
    composerAttachmentResolvers: normalizeComposerAttachmentResolvers(enabledRegistryExtensions),
    activityTreeItemActions: normalizeActivityTreeItemActions(enabledRegistryExtensions),
    loading: false,
    error: null,
  };
}
