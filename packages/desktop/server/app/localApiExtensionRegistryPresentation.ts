import type {
  ExtensionContributions,
  ExtensionManifest,
  ExtensionSurface,
  ExtensionViewContribution,
} from '../extensions/extensionManifest.js';

type ExtensionPackageType = 'system' | 'user';
type CriticalExtensionManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  packageType: ExtensionPackageType;
  version?: string;
  description?: string;
  frontend?: ExtensionManifest['frontend'];
  contributes?: ExtensionContributions;
  surfaces?: ExtensionManifest['surfaces'];
};
type CriticalExtensionRegistrySnapshot = {
  extensions: CriticalExtensionManifest[];
  routes: Array<{ route: string; extensionId: string; surfaceId: string; packageType: ExtensionPackageType }>;
  surfaces: Array<ExtensionSurface & { extensionId: string; packageType: ExtensionPackageType }>;
  views: Array<ExtensionViewContribution & { extensionId: string; packageType: ExtensionPackageType; frontend?: ExtensionManifest['frontend'] }>;
};
type CriticalExtensionInstallSummary = {
  id: string;
  name: string;
  packageType: ExtensionPackageType;
  enabled: boolean;
  status: 'enabled';
  manifest: CriticalExtensionManifest;
  permissions: [];
  surfaces: ExtensionManifest['surfaces'];
  routes: Array<{ route: string; surfaceId: string }>;
};

type CriticalExtensionContributionKey = keyof Pick<
  ExtensionContributions,
  | 'views'
  | 'nav'
  | 'topBarElements'
  | 'messageActions'
  | 'composerShelves'
  | 'draftConversationCreate'
  | 'newConversationPanels'
  | 'composerControls'
  | 'composerButtons'
  | 'composerInputTools'
  | 'toolbarActions'
  | 'contextMenus'
  | 'selectionActions'
  | 'threadHeaderActions'
  | 'statusBarItems'
  | 'conversationHeaderElements'
  | 'conversationDecorators'
  | 'activityTreeItemElements'
  | 'activityTreeItemStyles'
  | 'conversationLifecycle'
  | 'composerAttachmentProviders'
  | 'composerAttachmentRenderers'
  | 'composerAttachmentResolvers'
  | 'activityTreeItemActions'
  | 'settingsComponent'
>;

const CRITICAL_EXTENSION_CONTRIBUTION_KEYS: CriticalExtensionContributionKey[] = [
  'views',
  'nav',
  'topBarElements',
  'messageActions',
  'composerShelves',
  'draftConversationCreate',
  'newConversationPanels',
  'composerControls',
  'composerButtons',
  'composerInputTools',
  'toolbarActions',
  'contextMenus',
  'selectionActions',
  'threadHeaderActions',
  'statusBarItems',
  'conversationHeaderElements',
  'conversationDecorators',
  'activityTreeItemElements',
  'activityTreeItemStyles',
  'conversationLifecycle',
  'composerAttachmentProviders',
  'composerAttachmentRenderers',
  'composerAttachmentResolvers',
  'activityTreeItemActions',
  'settingsComponent',
];

function buildCriticalExtensionContributions(contributes: ExtensionContributions | undefined): ExtensionContributions | undefined {
  if (!contributes) return undefined;
  const criticalContributes: ExtensionContributions = {};
  for (const key of CRITICAL_EXTENSION_CONTRIBUTION_KEYS) {
    if (contributes[key] !== undefined) {
      criticalContributes[key] = contributes[key] as never;
    }
  }
  return Object.keys(criticalContributes).length > 0 ? criticalContributes : undefined;
}

function extensionHasCriticalRegistrySurface(snapshot: CriticalExtensionRegistrySnapshot, extensionId: string): boolean {
  return (
    snapshot.routes.some((route) => route.extensionId === extensionId) ||
    snapshot.surfaces.some((surface) => surface.extensionId === extensionId) ||
    snapshot.views.some((view) => view.extensionId === extensionId)
  );
}

export function buildCriticalExtensionInstallSummaries(
  snapshot: CriticalExtensionRegistrySnapshot,
): CriticalExtensionInstallSummary[] {
  return snapshot.extensions.flatMap((manifest) => {
    const criticalContributes = buildCriticalExtensionContributions(manifest.contributes);
    if (!criticalContributes && !manifest.surfaces?.length && !extensionHasCriticalRegistrySurface(snapshot, manifest.id)) {
      return [];
    }

    return {
      id: manifest.id,
      name: manifest.name,
      packageType: manifest.packageType,
      enabled: true,
      status: 'enabled' as const,
      manifest: {
        schemaVersion: manifest.schemaVersion,
        id: manifest.id,
        name: manifest.name,
        packageType: manifest.packageType,
        ...(manifest.version ? { version: manifest.version } : {}),
        ...(manifest.description ? { description: manifest.description } : {}),
        ...(manifest.frontend ? { frontend: manifest.frontend } : {}),
        ...(criticalContributes ? { contributes: criticalContributes } : {}),
        ...(manifest.surfaces ? { surfaces: manifest.surfaces } : {}),
      },
      permissions: [],
      surfaces: manifest.surfaces ?? [],
      routes: snapshot.routes
        .filter((route) => route.extensionId === manifest.id)
        .map((route) => ({ route: route.route, surfaceId: route.surfaceId })),
    };
  });
}

export function buildCriticalExtensionRegistryResponse(snapshot: CriticalExtensionRegistrySnapshot) {
  return {
    extensions: buildCriticalExtensionInstallSummaries(snapshot),
    routes: snapshot.routes,
    surfaces: [...snapshot.surfaces, ...snapshot.views],
    settings: {},
  };
}
