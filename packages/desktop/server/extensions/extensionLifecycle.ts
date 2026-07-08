import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type DesktopRootLayout, getStateRoot } from '@neon-pilot/core';

import { invalidateAppTopics } from '../shared/appEvents.js';
import type { ExtensionAppearanceAccent, ExtensionAppearanceContribution, ExtensionManifest } from './extensionManifest.js';
import { validateExtensionId } from './extensionManifestCoreValidation.js';
import {
  clearPersistedBuildError,
  findExtensionEntry,
  getRuntimeExtensionsRoot,
  invalidateExtensionRegistryReadCaches,
  listExtensionInstallSummaries,
  parseExtensionManifest,
  setPersistedBuildError,
} from './extensionRegistry.js';

export interface ReadRuntimeExtensionSourceResult {
  extensionId: string;
  manifest: ExtensionManifest;
  source: {
    frontend?: string;
    backend?: string;
  };
}

export interface UpdateRuntimeExtensionInput {
  name?: unknown;
  description?: unknown;
  appearance?: unknown;
  source?: {
    frontend?: unknown;
    backend?: unknown;
  };
  /** When true (default if source files changed), build and reload the extension backend after writing source files. */
  autoBuild?: boolean;
}

export interface CreateRuntimeExtensionInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  template?: unknown;
  appearance?: {
    accent?: unknown;
    aliases?: unknown;
    window?: {
      defaultWidth?: unknown;
      defaultHeight?: unknown;
    };
    singleton?: unknown;
  };
}

type RuntimeExtensionTemplate =
  | 'main-page'
  | 'windowed-app'
  | 'route-sidebar'
  | 'route-right-sidebar'
  | 'route-shell'
  | 'right-rail'
  | 'workbench-detail';
type RuntimeExtensionDeleteWarning = { operation: string; message: string };

function normalizeExtensionId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Extension id is required.');
  }

  const id = value.trim();
  validateExtensionId(id);

  return id;
}

function normalizeExtensionName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Extension name is required.');
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeExtensionTemplate(value: unknown): RuntimeExtensionTemplate {
  if (value === undefined || value === null || value === '') return 'main-page';
  if (
    value === 'main-page' ||
    value === 'windowed-app' ||
    value === 'route-sidebar' ||
    value === 'route-right-sidebar' ||
    value === 'route-shell' ||
    value === 'right-rail' ||
    value === 'workbench-detail'
  )
    return value;
  throw new Error(
    'Extension template must be main-page, windowed-app, route-sidebar, route-right-sidebar, route-shell, right-rail, or workbench-detail.',
  );
}

const EXTENSION_APPEARANCE_ACCENTS = new Set<ExtensionAppearanceAccent>([
  'chat',
  'automations',
  'drawing',
  'apps',
  'telemetry',
  'settings',
]);

function normalizeExtensionAppearance(value: unknown): ExtensionAppearanceContribution | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Extension appearance must be an object.');
  }

  const obj = value as Record<string, unknown>;
  const result: ExtensionAppearanceContribution = {};

  if (obj.accent !== undefined) {
    if (typeof obj.accent !== 'string' || !EXTENSION_APPEARANCE_ACCENTS.has(obj.accent as ExtensionAppearanceAccent)) {
      throw new Error('Extension appearance accent is invalid.');
    }
    result.accent = obj.accent as ExtensionAppearanceAccent;
  }

  if (obj.aliases !== undefined) {
    if (
      !Array.isArray(obj.aliases) ||
      !obj.aliases.every((alias): alias is string => typeof alias === 'string' && alias.trim().length > 0)
    ) {
      throw new Error('Extension appearance aliases must be non-empty strings.');
    }
    result.aliases = obj.aliases;
  }

  if (obj.singleton !== undefined) {
    if (typeof obj.singleton !== 'boolean') {
      throw new Error('Extension appearance singleton must be a boolean.');
    }
    result.singleton = obj.singleton;
  }

  if (obj.window !== undefined) {
    if (!obj.window || typeof obj.window !== 'object' || Array.isArray(obj.window)) {
      throw new Error('Extension appearance window must be an object.');
    }
    const win = obj.window as Record<string, unknown>;
    const normalizedWindow: NonNullable<ExtensionAppearanceContribution['window']> = {};
    if (win.defaultWidth !== undefined) {
      if (typeof win.defaultWidth !== 'number' || !Number.isFinite(win.defaultWidth) || win.defaultWidth <= 0) {
        throw new Error('Extension appearance window.defaultWidth must be a positive number.');
      }
      normalizedWindow.defaultWidth = win.defaultWidth;
    }
    if (win.defaultHeight !== undefined) {
      if (typeof win.defaultHeight !== 'number' || !Number.isFinite(win.defaultHeight) || win.defaultHeight <= 0) {
        throw new Error('Extension appearance window.defaultHeight must be a positive number.');
      }
      normalizedWindow.defaultHeight = win.defaultHeight;
    }
    if (Object.keys(normalizedWindow).length > 0) {
      result.window = normalizedWindow;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getExtensionSnapshotsRoot(stateRoot: string = getStateRoot(), layout?: DesktopRootLayout): string {
  if (layout) return join(layout.apps, 'extensions', 'snapshots');
  return join(stateRoot, 'extension-snapshots');
}

function getExtensionExportsRoot(stateRoot: string = getStateRoot(), layout?: DesktopRootLayout): string {
  if (layout) return join(layout.apps, 'extensions', 'exports');
  return join(stateRoot, 'extension-exports');
}

function isInsidePath(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`);
}

function assertInside(root: string, candidate: string): void {
  if (!isInsidePath(root, candidate)) {
    throw new Error('Path escapes extension root.');
  }
}

function createSafeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function starterHelpText(): string {
  return 'Edit <code>src/frontend.tsx</code>, run <code>pnpm run extension:build -- &lt;extension-dir&gt;</code> from the neon-pilot repo, then reload extensions.';
}

function createWindowedAppAliases(name: string): string[] {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return [];
  const aliases = new Set<string>([normalized]);
  for (const part of normalized.split(/\s+/)) {
    if (part.length >= 3) aliases.add(part);
  }
  return Array.from(aliases);
}

function createWindowedAppAppearance(
  name: string,
  appearance: ExtensionAppearanceContribution | undefined,
): ExtensionAppearanceContribution {
  const defaultWindow = { defaultWidth: 920, defaultHeight: 680 };
  const result: ExtensionAppearanceContribution = {
    accent: 'apps',
    aliases: createWindowedAppAliases(name),
    singleton: true,
    ...appearance,
  };
  result.window = { ...defaultWindow, ...(appearance?.window ?? {}) };
  return result;
}

function createWindowedAppContributes(
  id: string,
  name: string,
  appearance: ExtensionAppearanceContribution | undefined,
): NonNullable<ExtensionManifest['contributes']> {
  return {
    views: [{ id: 'page', title: name, location: 'main', route: `/ext/${id}`, component: 'ExtensionPage' }],
    nav: [{ id: 'nav', label: name, route: `/ext/${id}`, icon: 'app' }],
    widgets: [{ id: 'overview', title: name, component: 'ExtensionWidget', order: 100 }],
    appearance: createWindowedAppAppearance(name, appearance),
  };
}

function createStarterFrontend(name: string, template: RuntimeExtensionTemplate): string {
  const nameLiteral = JSON.stringify(name);

  if (template === 'windowed-app') {
    return `import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { WindowedPageButton, WindowedPageMain, WindowedPageSection, WindowedPageShell, WindowedStateBlock } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  return (
    <WindowedPageShell layout="standard">
      <WindowedPageMain
        title={EXTENSION_NAME}
        actions={
          <WindowedPageButton type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
            Test toast
          </WindowedPageButton>
        }
      >
        <WindowedPageSection title="Getting started" meta="Runtime app">
          <p className="text-[13px] leading-6 text-secondary">${starterHelpText()}</p>
        </WindowedPageSection>
        <WindowedPageSection title="Backend action" meta="Ready">
          <WindowedStateBlock title="Ping action available">
            The starter backend exports a ping action that agents can use for smoke checks.
          </WindowedStateBlock>
        </WindowedPageSection>
      </WindowedPageMain>
    </WindowedPageShell>
  );
}

export function ExtensionWidget() {
  return <WindowedStateBlock title={EXTENSION_NAME}>Open the app from the desktop to finish shaping this widget.</WindowedStateBlock>;
}
`;
  }

  if (template === 'right-rail') {
    return `import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};

export function ExtensionPanel({ pa }: ExtensionSurfaceProps) {
  // Right-sidebar templates always use ContextRail primitives; the host shell owns the outer region.
  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Right sidebar" title={EXTENSION_NAME} />
      <ContextRailBody>
        <ContextRailSection title="Getting started">
          <p className="text-[12px] leading-5 text-secondary">${starterHelpText()}</p>
          <ToolbarButton type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
            Test toast
          </ToolbarButton>
        </ContextRailSection>
      </ContextRailBody>
    </ContextRail>
  );
}
`;
  }

  if (template === 'route-right-sidebar') {
    return `import { useEffect, useState } from 'react';
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  useEffect(() => {
    pa.selection.set({
      kind: 'resource',
      resource: {
        type: 'starter',
        id: 'welcome',
        label: EXTENSION_NAME,
        source: EXTENSION_NAME,
        data: { status: 'Ready' },
      },
    });
  }, [pa.selection]);

  return (
    <AppPageLayout>
      <AppPageIntro title={EXTENSION_NAME} />
      <div className="max-w-2xl text-[13px] leading-6 text-secondary">
        <p>${starterHelpText()}</p>
        <ToolbarButton className="mt-4" type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
          Test toast
        </ToolbarButton>
      </div>
    </AppPageLayout>
  );
}

export function ExtensionContextRail({ pa }: ExtensionSurfaceProps) {
  const [resource, setResource] = useState(() => {
    const selection = pa.selection.get();
    return selection.kind === 'resource' ? selection.resource : null;
  });

  useEffect(() => {
    return pa.selection.subscribe((selection) => {
      setResource(selection.kind === 'resource' ? selection.resource : null);
    });
  }, [pa.selection]);

  // Route-owned right sidebars use ContextRail as the only rail shell.
  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Context" title={resource?.label ?? EXTENSION_NAME} subtitle={resource?.source} />
      <ContextRailBody>
        <ContextRailSection title="Details">
          <p className="text-[12px] leading-5 text-secondary">Use this right sidebar for selected-object details, metadata, logs, previews, or secondary actions.</p>
        </ContextRailSection>
      </ContextRailBody>
    </ContextRail>
  );
}
`;
  }

  if (template === 'route-sidebar') {
    return `import { useEffect, useState } from 'react';
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, SidebarList, SidebarSection, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};
const ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
];

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  const [activeId, setActiveId] = useState(() => {
    const selection = pa.selection.get();
    return selection.kind === 'resource' && selection.resource?.type === 'starter-nav' ? selection.resource.id : 'overview';
  });

  useEffect(() => {
    return pa.selection.subscribe((selection) => {
      if (selection.kind === 'resource' && selection.resource?.type === 'starter-nav') {
        setActiveId(selection.resource.id);
      }
    });
  }, [pa.selection]);

  const activeItem = ITEMS.find((item) => item.id === activeId) ?? ITEMS[0];

  return (
    <AppPageLayout>
      <AppPageIntro title={EXTENSION_NAME} />
      <div className="max-w-2xl text-[13px] leading-6 text-secondary">
        <p>{activeItem.label} is selected in the route-owned left sidebar. ${starterHelpText()}</p>
        <ToolbarButton className="mt-4" type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
          Test toast
        </ToolbarButton>
      </div>
    </AppPageLayout>
  );
}

export function ExtensionSidebar({ pa }: ExtensionSurfaceProps) {
  const [activeId, setActiveId] = useState('overview');

  function selectItem(item: (typeof ITEMS)[number]) {
    setActiveId(item.id);
    pa.selection.set({
      kind: 'resource',
      resource: {
        type: 'starter-nav',
        id: item.id,
        label: item.label,
        source: EXTENSION_NAME,
      },
    });
  }

  return (
    <SidebarSection title="Navigate">
      <SidebarList
        items={ITEMS.map((item) => ({ id: item.id, title: item.label }))}
        selectedId={activeId}
        onSelect={(item) => selectItem({ id: item.id, label: String(item.title) })}
      />
    </SidebarSection>
  );
}
`;
  }

  if (template === 'route-shell') {
    return `import { useEffect, useState } from 'react';
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, SidebarList, SidebarSection, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};
const ITEMS = [
  { id: 'overview', label: 'Overview', status: 'Ready' },
  { id: 'activity', label: 'Activity', status: 'Watching' },
];

function readActiveResource(pa: ExtensionSurfaceProps['pa']) {
  const selection = pa.selection.get();
  return selection.kind === 'resource' && selection.resource?.type === 'starter-nav' ? selection.resource : null;
}

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  const [resource, setResource] = useState(() => readActiveResource(pa));

  useEffect(() => {
    return pa.selection.subscribe((selection) => {
      setResource(selection.kind === 'resource' && selection.resource?.type === 'starter-nav' ? selection.resource : null);
    });
  }, [pa.selection]);

  const label = resource?.label ?? ITEMS[0].label;

  return (
    <AppPageLayout>
      <AppPageIntro title={EXTENSION_NAME} />
      <div className="max-w-2xl text-[13px] leading-6 text-secondary">
        <p>{label} is selected in the route-owned left sidebar. The right sidebar shows contextual detail for the same selection.</p>
        <p className="mt-3">${starterHelpText()}</p>
        <ToolbarButton className="mt-4" type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
          Test toast
        </ToolbarButton>
      </div>
    </AppPageLayout>
  );
}

export function ExtensionSidebar({ pa }: ExtensionSurfaceProps) {
  const [activeId, setActiveId] = useState('overview');

  function selectItem(item: (typeof ITEMS)[number]) {
    setActiveId(item.id);
    pa.selection.set({
      kind: 'resource',
      resource: {
        type: 'starter-nav',
        id: item.id,
        label: item.label,
        source: EXTENSION_NAME,
        data: { status: item.status },
      },
    });
  }

  return (
    <SidebarSection title="Navigate">
      <SidebarList
        items={ITEMS.map((item) => ({ id: item.id, title: item.label, meta: item.status }))}
        selectedId={activeId}
        onSelect={(item) => {
          const next = ITEMS.find((candidate) => candidate.id === item.id) ?? ITEMS[0];
          selectItem(next);
        }}
      />
    </SidebarSection>
  );
}

export function ExtensionContextRail({ pa }: ExtensionSurfaceProps) {
  const [resource, setResource] = useState(() => readActiveResource(pa));

  useEffect(() => {
    return pa.selection.subscribe((selection) => {
      setResource(selection.kind === 'resource' && selection.resource?.type === 'starter-nav' ? selection.resource : null);
    });
  }, [pa.selection]);

  // Route-owned right sidebars use ContextRail as the only rail shell.
  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Context" title={resource?.label ?? 'Select an item'} subtitle={resource?.source} />
      <ContextRailBody>
        <ContextRailSection title="Details">
          <p className="text-[12px] leading-5 text-secondary">Use this right sidebar for metadata, logs, previews, validation, or secondary actions for the selected item.</p>
        </ContextRailSection>
      </ContextRailBody>
    </ContextRail>
  );
}
`;
  }

  if (template === 'workbench-detail') {
    return `import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};

export function ExtensionRail({ pa }: ExtensionSurfaceProps) {
  // Tab-local workbench rails use the same ContextRail anatomy as route-owned right sidebars.
  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Right sidebar" title={EXTENSION_NAME} />
      <ContextRailBody>
        <ContextRailSection title="Detail driver">
          <p className="text-[12px] leading-5 text-secondary">Select something here; render the large view in the paired workbench detail surface.</p>
          <ToolbarButton type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' sidebar action')}>
            Test toast
          </ToolbarButton>
        </ContextRailSection>
      </ContextRailBody>
    </ContextRail>
  );
}

export function ExtensionWorkbench({ pa }: ExtensionSurfaceProps) {
  return (
    <main className="flex h-full items-center justify-center px-8 text-center">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Workbench detail</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-primary">{EXTENSION_NAME}</h1>
        <p className="mt-2 text-[13px] leading-6 text-secondary">${starterHelpText()}</p>
        <ToolbarButton className="mt-6" type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' detail action')}>
          Test toast
        </ToolbarButton>
      </div>
    </main>
  );
}
`;
  }

  return `import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, ToolbarButton } from '@neon-pilot/extensions/ui';

const EXTENSION_NAME = ${nameLiteral};

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  return (
    <AppPageLayout>
      <AppPageIntro title={EXTENSION_NAME} />
      <div className="max-w-2xl text-[13px] leading-6 text-secondary">
        <p>${starterHelpText()}</p>
        <ToolbarButton className="mt-4" type="button" onClick={() => pa.ui.toast(EXTENSION_NAME + ' is wired up.')}>
          Test toast
        </ToolbarButton>
      </div>
    </AppPageLayout>
  );
}
`;
}

function createStarterBackend(): string {
  return `import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function ping(_input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('ping');
  return { ok: true, at: new Date().toISOString() };
}

// Service example: add backend.services[{ id: 'sync', handler: 'startSync' }] to extension.json.
export async function startSync(_input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('sync service started');
  return async () => ctx.log.info('sync service stopped');
}

// Subscription example: add contributes.subscriptions[{ id: 'settings', source: 'settings', handler: 'onSettingsChanged' }].
export async function onSettingsChanged(input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('host event received', { input });
}
`;
}

function createStarterReadme(name: string): string {
  return `# ${name}

Native Neon Pilot extension.

## Useful manifest examples

Service:

\`\`\`json
{ "backend": { "services": [{ "id": "sync", "handler": "startSync", "healthCheck": "checkSync", "restart": "on-failure" }] } }
\`\`\`

Selection action:

\`\`\`json
{ "contributes": { "selectionActions": [{ "id": "use-selection", "title": "Use Selection", "action": "useSelection", "kinds": ["text", "messages"] }] } }
\`\`\`

Transcript block:

\`\`\`json
{ "contributes": { "transcriptBlocks": [{ "id": "status", "component": "StatusBlock", "schemaVersion": 1 }] } }
\`\`\`

Subscription:

\`\`\`json
{ "contributes": { "subscriptions": [{ "id": "settings", "source": "settings", "handler": "onSettingsChanged" }] } }
\`\`\`

Dependency:

\`\`\`json
{ "dependsOn": ["system-knowledge", { "id": "optional-helper", "optional": true }] }
\`\`\`
`;
}

export function createRuntimeExtension(input: CreateRuntimeExtensionInput, stateRoot: string = getStateRoot(), layout?: DesktopRootLayout) {
  const id = normalizeExtensionId(input.id);
  const name = normalizeExtensionName(input.name);
  const description = normalizeOptionalString(input.description);
  const template = normalizeExtensionTemplate(input.template);
  if (findExtensionEntry(id, stateRoot, layout)) {
    throw new Error('Extension id already exists.');
  }

  const extensionRoot = join(getRuntimeExtensionsRoot(stateRoot, layout), id);
  if (existsSync(extensionRoot)) {
    throw new Error('Extension directory already exists.');
  }

  mkdirSync(join(extensionRoot, 'src'), { recursive: true });
  mkdirSync(join(extensionRoot, 'dist'), { recursive: true });

  const appearance = normalizeExtensionAppearance(input.appearance);

  const contributesBase =
    template === 'right-rail'
      ? {
          views: [{ id: 'panel', title: name, location: 'rightRail', scope: 'conversation', component: 'ExtensionPanel', icon: 'app' }],
        }
      : template === 'route-sidebar'
        ? {
            views: [
              { id: 'page', title: name, location: 'main', route: `/ext/${id}`, component: 'ExtensionPage' },
              { id: 'sidebar', title: `${name} navigation`, location: 'sidebar', component: 'ExtensionSidebar', icon: 'app' },
            ],
            nav: [{ id: 'nav', label: name, route: `/ext/${id}`, icon: 'app', sidebarView: 'sidebar' }],
          }
        : template === 'route-right-sidebar'
          ? {
              views: [
                { id: 'page', title: name, location: 'main', route: `/ext/${id}`, component: 'ExtensionPage' },
                {
                  id: 'context',
                  title: `${name} context`,
                  location: 'rightRail',
                  placement: 'primary',
                  component: 'ExtensionContextRail',
                  icon: 'app',
                },
              ],
              nav: [{ id: 'nav', label: name, route: `/ext/${id}`, icon: 'app', rightSidebarView: 'context' }],
            }
          : template === 'route-shell'
            ? {
                views: [
                  { id: 'page', title: name, location: 'main', route: `/ext/${id}`, component: 'ExtensionPage' },
                  { id: 'sidebar', title: `${name} navigation`, location: 'sidebar', component: 'ExtensionSidebar', icon: 'app' },
                  {
                    id: 'context',
                    title: `${name} context`,
                    location: 'rightRail',
                    placement: 'primary',
                    component: 'ExtensionContextRail',
                    icon: 'app',
                  },
                ],
                nav: [
                  {
                    id: 'nav',
                    label: name,
                    route: `/ext/${id}`,
                    icon: 'app',
                    sidebarView: 'sidebar',
                    rightSidebarView: 'context',
                  },
                ],
              }
            : template === 'windowed-app'
              ? createWindowedAppContributes(id, name, appearance)
              : template === 'workbench-detail'
                ? {
                    views: [
                      {
                        id: 'rail',
                        title: name,
                        location: 'rightRail',
                        scope: 'conversation',
                        component: 'ExtensionRail',
                        icon: 'app',
                        detailView: 'detail',
                      },
                      { id: 'detail', title: `${name} detail`, location: 'workbench', component: 'ExtensionWorkbench' },
                    ],
                  }
                : {
                    views: [{ id: 'page', title: name, location: 'main', route: `/ext/${id}`, component: 'ExtensionPage' }],
                    nav: [{ id: 'nav', label: name, route: `/ext/${id}`, icon: 'app' }],
                  };

  const contributes = appearance && template !== 'windowed-app' ? { ...contributesBase, appearance } : contributesBase;

  const manifest = parseExtensionManifest({
    schemaVersion: 2,
    id,
    name,
    packageType: 'user',
    ...(description ? { description } : {}),
    frontend: { entry: 'dist/frontend.js', styles: [] },
    backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping', title: 'Ping', worker: { enabled: true } }] },
    contributes,
    permissions: [],
  });
  writeFileSync(join(extensionRoot, 'extension.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(extensionRoot, 'src', 'frontend.tsx'), createStarterFrontend(name, template));
  writeFileSync(join(extensionRoot, 'src', 'backend.ts'), createStarterBackend());
  writeFileSync(join(extensionRoot, 'README.md'), createStarterReadme(name));
  writeFileSync(
    join(extensionRoot, 'package.json'),
    `${JSON.stringify({ type: 'module', dependencies: { '@neon-pilot/extensions': '*' } }, null, 2)}\n`,
  );

  invalidateExtensionRegistryState(stateRoot, layout);
  const summary = listExtensionInstallSummaries(stateRoot, layout).find((extension) => extension.id === id);

  try {
    runRuntimeExtensionBuild(extensionRoot);
    clearPersistedBuildError(id, stateRoot, layout);
  } catch (err) {
    setPersistedBuildError(id, err instanceof Error ? err.message : String(err), stateRoot, layout);
    throw err;
  }

  return { ok: true as const, extension: summary, packageRoot: extensionRoot, built: true as const };
}

export async function updateRuntimeExtension(
  extensionId: string,
  input: UpdateRuntimeExtensionInput,
  stateRoot: string = getStateRoot(),
  layout?: DesktopRootLayout,
) {
  const id = normalizeExtensionId(extensionId);
  const entry = findExtensionEntry(id, stateRoot, layout);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  if (!entry.packageRoot) {
    throw new Error('Extension package root is unavailable.');
  }
  if (entry.source === 'system') {
    throw new Error('System extensions cannot be updated through the runtime lifecycle.');
  }

  const packageRoot = entry.packageRoot;
  const runtimeRoot = getRuntimeExtensionsRoot(stateRoot, layout);
  assertInside(runtimeRoot, packageRoot);

  const manifestPath = join(packageRoot, 'extension.json');
  let manifest: Record<string, unknown> = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    manifest = { ...entry.manifest } as unknown as Record<string, unknown>;
  }

  if (input.name !== undefined) {
    manifest.name = normalizeExtensionName(input.name);
  }
  if (input.description !== undefined) {
    manifest.description = normalizeOptionalString(input.description);
  }
  if (input.appearance !== undefined) {
    const normalizedAppearance = normalizeExtensionAppearance(input.appearance);
    if (normalizedAppearance) {
      manifest.contributes = { ...((manifest.contributes as Record<string, unknown>) || {}), appearance: normalizedAppearance };
    } else {
      const contributes = { ...((manifest.contributes as Record<string, unknown>) || {}) } as Record<string, unknown>;
      delete contributes.appearance;
      manifest.contributes = contributes;
    }
  }

  const validatedManifest = parseExtensionManifest(manifest);
  let frontendSource: string | undefined;
  let backendSource: string | undefined;
  if (input.source?.frontend !== undefined) {
    if (typeof input.source.frontend !== 'string') {
      throw new Error('Extension frontend source must be a string.');
    }
    frontendSource = input.source.frontend;
  }
  if (input.source?.backend !== undefined) {
    if (typeof input.source.backend !== 'string') {
      throw new Error('Extension backend source must be a string.');
    }
    backendSource = input.source.backend;
  }

  writeFileSync(manifestPath, `${JSON.stringify(validatedManifest, null, 2)}\n`);

  if (frontendSource !== undefined) {
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(join(packageRoot, 'src', 'frontend.tsx'), frontendSource);
  }
  if (backendSource !== undefined) {
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(join(packageRoot, 'src', 'backend.ts'), backendSource);
  }

  invalidateExtensionRegistryState(stateRoot, layout);
  const summary = listExtensionInstallSummaries(stateRoot, layout).find((ext) => ext.id === id);

  const sourceChanged = frontendSource !== undefined || backendSource !== undefined;
  const shouldBuild = sourceChanged && input.autoBuild !== false;

  if (shouldBuild) {
    await buildRuntimeExtension(id, stateRoot, layout);
    const { reloadExtensionBackend } = await import('./extensionBackend.js');
    await reloadExtensionBackend(id);
  }

  return { ok: true as const, extension: summary, packageRoot, ...(shouldBuild ? { built: true as const } : {}) };
}

export function snapshotRuntimeExtension(extensionId: string, stateRoot: string = getStateRoot(), layout?: DesktopRootLayout) {
  const entry = findExtensionEntry(extensionId, stateRoot, layout);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  if (!entry.packageRoot) {
    throw new Error('Extension package root is unavailable.');
  }

  const timestamp = createSafeTimestamp();
  const snapshotRoot = join(getExtensionSnapshotsRoot(stateRoot, layout), extensionId);
  const snapshotPath = join(snapshotRoot, timestamp);
  mkdirSync(snapshotRoot, { recursive: true });
  cpSync(entry.packageRoot, snapshotPath, { recursive: true, errorOnExist: true });

  return { ok: true as const, extensionId, snapshotPath };
}

function findExtensionBuildRepoRoot(): string | null {
  const candidates = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const candidate of candidates) {
    let current = resolve(candidate);
    let parent = dirname(current);
    while (parent !== current) {
      if (existsSync(join(current, 'scripts', 'extension-build.mjs'))) {
        return current;
      }
      current = parent;
      parent = dirname(current);
    }
    if (existsSync(join(current, 'scripts', 'extension-build.mjs'))) {
      return current;
    }
  }
  return null;
}

function runRuntimeExtensionBuild(packageRoot: string): void {
  const repoRoot = findExtensionBuildRepoRoot();
  if (!repoRoot) {
    throw new Error('Extension build script not found. Run this action from a Neon Pilot source checkout.');
  }
  const buildScript = join(repoRoot, 'scripts', 'extension-build.mjs');
  execFileSync(process.execPath, [buildScript, packageRoot], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function invalidateExtensionRegistryState(stateRoot: string, layout?: DesktopRootLayout): void {
  invalidateExtensionRegistryReadCaches(stateRoot, layout);
  invalidateAppTopics('extensions');
}

export async function buildRuntimeExtension(extensionId: string, stateRoot?: string, layout?: DesktopRootLayout) {
  const entry = findExtensionEntry(extensionId, stateRoot, layout);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  if (!entry.packageRoot) {
    throw new Error('Extension package root is unavailable.');
  }
  if (entry.manifest.schemaVersion !== 2) {
    throw new Error('Only native extension manifest schemaVersion 2 can be built.');
  }

  try {
    runRuntimeExtensionBuild(entry.packageRoot);
    clearPersistedBuildError(extensionId, stateRoot, layout);
  } catch (err) {
    setPersistedBuildError(extensionId, err instanceof Error ? err.message : String(err), stateRoot, layout);
    throw err;
  }

  return { ok: true as const, extensionId, built: true };
}

export function exportRuntimeExtension(extensionId: string, stateRoot: string = getStateRoot(), layout?: DesktopRootLayout) {
  const entry = findExtensionEntry(extensionId, stateRoot, layout);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  if (!entry.packageRoot) {
    throw new Error('Extension package root is unavailable.');
  }

  const exportsRoot = getExtensionExportsRoot(stateRoot, layout);
  mkdirSync(exportsRoot, { recursive: true });
  const exportPath = join(exportsRoot, `${extensionId}-${createSafeTimestamp()}.zip`);
  const packageRoot = resolve(entry.packageRoot);
  const parent = resolve(packageRoot, '..');
  execFileSync('zip', ['-qry', exportPath, basename(packageRoot)], { cwd: parent });

  return { ok: true as const, extensionId, exportPath };
}

interface ZipEntry {
  path: string;
  mode: string;
}

function readZipEntries(zipPath: string): ZipEntry[] {
  const output = execFileSync('zipinfo', ['-l', zipPath], { encoding: 'utf-8' });
  return output
    .split('\n')
    .map((line) => {
      const match = /^([bcdlps-][rwxStTs-]{9})\s+\S+\s+\S+\s+\d+\s+\S+\s+\d+\s+\S+\s+\S+\s+(.+)$/.exec(line.trim());
      return match ? { mode: match[1] as string, path: match[2] as string } : null;
    })
    .filter((entry): entry is ZipEntry => entry !== null);
}

function assertSafeZipEntries(entries: ZipEntry[]): void {
  if (entries.length === 0) {
    throw new Error('Extension bundle is empty.');
  }

  for (const entry of entries) {
    if (entry.path.startsWith('/') || entry.path.includes('..') || entry.path.includes('\\')) {
      throw new Error('Extension bundle contains unsafe paths.');
    }
    if (entry.mode.startsWith('l')) {
      throw new Error('Extension bundle contains symlink entries.');
    }
  }
}

function findExtractedManifestRoot(extractRoot: string): string {
  const directManifest = join(extractRoot, 'extension.json');
  if (existsSync(directManifest)) {
    return extractRoot;
  }

  const candidates = readdirSync(extractRoot)
    .map((entry) => join(extractRoot, entry))
    .filter((entry) => statSync(entry).isDirectory() && existsSync(join(entry, 'extension.json')));
  if (candidates.length !== 1) {
    throw new Error('Extension bundle must contain exactly one extension.json.');
  }

  return candidates[0] as string;
}

function isSourceBackendEntry(entryPath: string): boolean {
  return /\.[cm]?tsx?$/.test(entryPath);
}

function requirePackagedArtifact(packageRoot: string, relativePath: string, label: string): void {
  const artifactPath = join(packageRoot, relativePath);
  if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) {
    throw new Error(`Extension bundle is missing ${label}: ${relativePath}. Build the extension before installing it.`);
  }
}

function assertImportableRuntimeArtifacts(packageRoot: string, manifest: ExtensionManifest): void {
  const hasRuntimeCode = Boolean(manifest.frontend?.entry || manifest.backend?.entry);
  if (hasRuntimeCode) {
    requirePackagedArtifact(packageRoot, join('dist', 'build-manifest.json'), 'build manifest');
  }
  if (manifest.frontend?.entry) {
    requirePackagedArtifact(packageRoot, manifest.frontend.entry, 'frontend artifact');
  }
  if (manifest.backend?.entry) {
    const backendEntry = isSourceBackendEntry(manifest.backend.entry) ? join('dist', 'backend.mjs') : manifest.backend.entry;
    requirePackagedArtifact(packageRoot, backendEntry, 'backend artifact');
  }
}

function inspectExtractedExtensionBundle(zipPath: string): { id: string; manifest: ExtensionManifest } {
  assertSafeZipEntries(readZipEntries(zipPath));
  const extractRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-inspect-'));
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', extractRoot]);
    const packageRoot = findExtractedManifestRoot(extractRoot);
    assertInside(extractRoot, packageRoot);
    const manifest = parseExtensionManifest(JSON.parse(readFileSync(join(packageRoot, 'extension.json'), 'utf-8')));
    assertImportableRuntimeArtifacts(packageRoot, manifest);
    return { id: normalizeExtensionId(manifest.id), manifest };
  } finally {
    rmSync(extractRoot, { recursive: true, force: true });
  }
}

export function inspectRuntimeExtensionBundle(input: { zipPath?: unknown }) {
  const zipPath = normalizeOptionalString(input.zipPath);
  if (!zipPath) {
    throw new Error('zipPath is required.');
  }
  if (!existsSync(zipPath) || !statSync(zipPath).isFile()) {
    throw new Error('Extension bundle not found.');
  }

  const { id, manifest } = inspectExtractedExtensionBundle(zipPath);
  return {
    id,
    name: manifest.name,
    version: manifest.version,
  };
}

export function readRuntimeExtensionSource(
  extensionId: string,
  stateRoot: string = getStateRoot(),
  layout?: DesktopRootLayout,
): ReadRuntimeExtensionSourceResult {
  const id = normalizeExtensionId(extensionId);
  const entry = findExtensionEntry(id, stateRoot, layout);
  if (!entry) {
    throw new Error('Extension not found.');
  }
  if (!entry.packageRoot) {
    throw new Error('Extension package root is unavailable.');
  }

  const packageRoot = entry.packageRoot;
  const runtimeRoot = getRuntimeExtensionsRoot(stateRoot, layout);
  assertInside(runtimeRoot, packageRoot);

  const manifestPath = join(packageRoot, 'extension.json');
  let manifest: ExtensionManifest;
  try {
    manifest = parseExtensionManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')));
  } catch {
    throw new Error('Extension manifest is invalid or unreadable.');
  }

  const source: { frontend?: string; backend?: string } = {};

  const frontendPath = join(packageRoot, 'src', 'frontend.tsx');
  if (existsSync(frontendPath)) {
    source.frontend = readFileSync(frontendPath, 'utf-8');
  }

  const backendPath = join(packageRoot, 'src', 'backend.ts');
  if (existsSync(backendPath)) {
    source.backend = readFileSync(backendPath, 'utf-8');
  }

  return { extensionId: id, manifest, source };
}

export function importRuntimeExtensionBundle(input: { zipPath?: unknown }, stateRoot: string = getStateRoot(), layout?: DesktopRootLayout) {
  const zipPath = normalizeOptionalString(input.zipPath);
  if (!zipPath) {
    throw new Error('zipPath is required.');
  }
  if (!existsSync(zipPath) || !statSync(zipPath).isFile()) {
    throw new Error('Extension bundle not found.');
  }

  assertSafeZipEntries(readZipEntries(zipPath));
  const extractRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-import-'));
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', extractRoot]);
    const packageRoot = findExtractedManifestRoot(extractRoot);
    assertInside(extractRoot, packageRoot);
    const manifest = parseExtensionManifest(JSON.parse(readFileSync(join(packageRoot, 'extension.json'), 'utf-8')));
    assertImportableRuntimeArtifacts(packageRoot, manifest);
    const id = normalizeExtensionId(manifest.id);
    const destination = join(getRuntimeExtensionsRoot(stateRoot, layout), id);
    if (existsSync(destination) || findExtensionEntry(id, stateRoot, layout)) {
      throw new Error('Extension id already exists.');
    }

    mkdirSync(getRuntimeExtensionsRoot(stateRoot, layout), { recursive: true });
    cpSync(packageRoot, destination, { recursive: true, errorOnExist: true });
    invalidateExtensionRegistryState(stateRoot, layout);
    const summary = listExtensionInstallSummaries(stateRoot, layout).find((extension) => extension.id === id);
    return { ok: true as const, extension: summary, packageRoot: destination };
  } finally {
    rmSync(extractRoot, { recursive: true, force: true });
  }
}

export async function deleteRuntimeExtension(extensionId: string, stateRoot: string = getStateRoot(), layout?: DesktopRootLayout) {
  const id = normalizeExtensionId(extensionId);
  const warnings: RuntimeExtensionDeleteWarning[] = [];
  const entry = findExtensionEntry(id, stateRoot, layout);
  if (!entry) {
    const { clearExtensionFailureRecords, readInvalidRuntimeExtensionEntries, removeExtensionFromRegistry } =
      await import('./extensionRegistry.js');
    const invalidEntry = readInvalidRuntimeExtensionEntries(stateRoot, layout).find((candidate) => candidate.id === id);
    await runBestEffortDeleteStep(warnings, 'remove extension registry state', () => removeExtensionFromRegistry(id, stateRoot, layout));
    await runBestEffortDeleteStep(warnings, 'clear extension failure records', () => clearExtensionFailureRecords(id, stateRoot, layout));
    if (!invalidEntry?.packageRoot) {
      invalidateExtensionRegistryState(stateRoot, layout);
      return buildDeleteRuntimeExtensionResult(id, false, warnings);
    }
    const runtimeRoot = getRuntimeExtensionsRoot(stateRoot, layout);
    assertInside(runtimeRoot, invalidEntry.packageRoot);
    const deleted = deleteExtensionPackageRootBestEffort(invalidEntry.packageRoot, warnings);
    invalidateExtensionRegistryState(stateRoot, layout);
    return buildDeleteRuntimeExtensionResult(id, deleted, warnings);
  }
  if (!entry.packageRoot) {
    const { clearExtensionFailureRecords, removeExtensionFromRegistry } = await import('./extensionRegistry.js');
    await runBestEffortDeleteStep(warnings, 'remove extension registry state', () => removeExtensionFromRegistry(id, stateRoot, layout));
    await runBestEffortDeleteStep(warnings, 'clear extension failure records', () => clearExtensionFailureRecords(id, stateRoot, layout));
    warnings.push({ operation: 'delete extension package', message: 'Extension package root is unavailable.' });
    invalidateExtensionRegistryState(stateRoot, layout);
    return buildDeleteRuntimeExtensionResult(id, false, warnings);
  }

  const runtimeRoot = getRuntimeExtensionsRoot(stateRoot, layout);
  const runtimeInstalled = isInsidePath(runtimeRoot, entry.packageRoot);
  if (entry.manifest.packageType === 'system' && !runtimeInstalled) {
    throw new Error('Packaged system extensions cannot be deleted.');
  }
  assertInside(runtimeRoot, entry.packageRoot);

  await runBestEffortDeleteStep(warnings, 'stop extension services', async () => {
    const { stopExtensionServices } = await import('./extensionServices.js');
    await stopExtensionServices(id);
  });
  await runBestEffortDeleteStep(warnings, 'unregister process wrappers', async () => {
    const { unregisterBashProcessWrapper } = await import('../conversations/processWrappers.js');
    unregisterBashProcessWrapper(id);
  });
  await runBestEffortDeleteStep(warnings, 'delete extension subscriptions', async () => {
    const { uninstallExtensionSubscriptions } = await import('./extensionSubscriptions.js');
    uninstallExtensionSubscriptions(id);
  });

  const { removeExtensionFromRegistry, clearExtensionFailureRecords } = await import('./extensionRegistry.js');
  await runBestEffortDeleteStep(warnings, 'remove extension registry state', () => removeExtensionFromRegistry(id, stateRoot, layout));
  await runBestEffortDeleteStep(warnings, 'clear extension failure records', () => clearExtensionFailureRecords(id, stateRoot, layout));

  const deleted = deleteExtensionPackageRootBestEffort(entry.packageRoot, warnings);
  invalidateExtensionRegistryState(stateRoot, layout);
  return buildDeleteRuntimeExtensionResult(id, deleted, warnings);
}

async function runBestEffortDeleteStep(
  warnings: RuntimeExtensionDeleteWarning[],
  operation: string,
  step: () => void | Promise<void>,
): Promise<void> {
  try {
    await step();
  } catch (error) {
    warnings.push({ operation, message: error instanceof Error ? error.message : String(error) });
  }
}

function deleteExtensionPackageRootBestEffort(packageRoot: string, warnings: RuntimeExtensionDeleteWarning[]): boolean {
  try {
    rmSync(packageRoot, { recursive: true, force: true });
    return !existsSync(packageRoot);
  } catch (error) {
    warnings.push({ operation: 'delete extension package', message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function buildDeleteRuntimeExtensionResult(extensionId: string, deleted: boolean, warnings: RuntimeExtensionDeleteWarning[]) {
  return {
    ok: true as const,
    extensionId,
    deleted,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
