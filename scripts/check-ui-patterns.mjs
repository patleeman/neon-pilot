#!/usr/bin/env node
/* eslint-env node */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const defaultRoots = ['packages/desktop/ui/src', 'extensions', 'docs/design', 'docs/extension-templates'];
const includeExt = new Set(['.css', '.json', '.md', '.ts', '.tsx']);
const ignoreSegments = new Set(['node_modules', 'dist', 'coverage', '.git']);
const ignoredFileRegexes = [/\.(test|spec)\.[cm]?[tj]sx?$/, /\.stories\.[cm]?[tj]sx?$/];
const inlineExceptionId = 'invalid-ui-pattern-exception';

const designSystemSourceRegexes = [/^packages\/ui\/src\//, /^packages\/desktop\/ui\/src\/components\/ui\.[tj]sx?$/];

const defaultAllowlist = [];
const extensionManifestCache = new Map();
const approvedPageTypes = new Set(['conversation', 'table', 'editor', 'settings', 'dashboard', 'setup']);

const rules = [
  {
    id: 'forbidden-extension-import',
    message: 'extension code must import UI and host APIs through @neon-pilot/extensions public contracts',
    extensions: new Set(['.ts', '.tsx']),
    appliesTo: ({ file }) => file.startsWith('extensions/'),
    match: ({ line }) =>
      /(?:from\s*|import\s*\(\s*)['"](?:@neon-pilot\/(?:ui|desktop)(?:\/[^'"]*)?|(?:@?[^'"]*\/)?packages\/(?:ui|desktop)\/[^'"]*)['"]/.test(
        line,
      ),
  },
  {
    id: 'raw-control',
    message:
      'raw JSX control/action markup; use Button, ToolbarButton, IconButton, TextButton, Select, TextInput, Textarea, or Switch, or document a narrow exception with ui-pattern-ok <rule-id> reason="specific reason"',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, snippet }) =>
      /<\s*(?:button|input|select|textarea)(?=[\s>/]|$)/.test(line) || /<\s*(?:button|input|select|textarea)(?=[\s>/])/.test(snippet),
  },
  {
    id: 'raw-details-summary',
    message:
      'raw details/summary disclosure markup; use Disclosure or another design-system disclosure primitive, or document a narrow exception with ui-pattern-ok <rule-id> reason="specific reason"',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, snippet }) => /<\s*(?:details|summary)(?=[\s>/]|$)/.test(line) || /<\s*(?:details|summary)(?=[\s>/])/.test(snippet),
  },
  {
    id: 'invalid-button-variant',
    message: 'invalid Button/ButtonLink variant; use toolbar, action, or ghost from the shared action button standard',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ snippet }) => /<\s*Button(?:Link)?\b/.test(snippet) && /\bvariant=(["'])(?!(?:toolbar|action|ghost)\1)[^"']+\1/.test(snippet),
  },
  {
    id: 'local-action-button-sizing',
    message: 'shared action button has local size/typography overrides; use the primitive geometry and keep className for layout only',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ snippet }) =>
      /<\s*(?:Button|ButtonLink|ToolbarButton|IconButton|IconLink)\b/.test(snippet) &&
      /\bclassName=(["'])[^"']*\b(?:min-h-|h-\d|w-\d|px-|py-|text-\[)[^"']*\1/.test(snippet),
  },
  {
    id: 'common-text-action-button',
    message: 'text-only common action button; use IconButton with aria-label/title, or icon plus text when the label disambiguates',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, index, lines, snippet }) => {
      if (!/<\s*(?:Button|ToolbarButton)\b/.test(line) && !/<\s*(?:Button|ToolbarButton)\b/.test(snippet)) return false;
      const block = collectElementBlock(lines, index);
      if (!/(?:^|>|\{)\s*(?:Refresh|Add|Search|Copy|Close|Remove|Retry)\s*(?:<|\}|$)/.test(block)) return false;
      return !/<(?:Ico|svg)\b|aria-hidden=/.test(block);
    },
  },
  {
    id: 'icon-action-missing-title',
    message: 'icon-only action missing hover help; pass title alongside aria-label',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, snippet }) =>
      /<\s*Icon(?:Button|Link)\b/.test(line) &&
      /\baria-label=/.test(snippet) &&
      !/\btitle=/.test(snippet) &&
      !/\baria-hidden=["']true["']/.test(snippet),
  },
  {
    id: 'custom-pill',
    message: 'custom pill/status badge styling; use Pill, StatusDot, InlineMeta, or compact text status',
    appliesTo: ({ file, extension }) => extension !== '.css' || isExtensionFrontendFile(file) || file.startsWith('extensions/'),
    match: ({ snippet }) => /\brounded-full\b(?=[^`'"]*(?:px-|border-|bg-|text-))/.test(snippet),
  },
  {
    id: 'custom-button-chrome',
    message: 'custom button chrome; use Button, ToolbarButton, IconButton, TextButton, RowButton, or MessageActionButton',
    match: ({ snippet }) =>
      /<\s*(?:button|a)(?=[\s>/])/.test(snippet) &&
      /\b(?:focus-visible:ring|hover:bg-|active:bg-|rounded-md border|rounded-lg border|rounded bg-(?:accent|success|warning|danger))\b/.test(
        snippet,
      ),
  },
  {
    id: 'raw-semantic-surface',
    message: 'raw semantic color surface; prefer Notice, Pill, ToolResultCard, StatusDot, or tone props',
    appliesTo: ({ file }) => isExtensionFrontendFile(file),
    match: ({ snippet }) => /\b(?:bg|border|ring|outline)-(?:success|warning|danger|accent)(?:\/\d+)?\b/.test(snippet),
  },
  {
    id: 'web-shadow-blur',
    message: 'shadow/backdrop treatment; prefer flat desktop workbench surfaces or a design-system primitive',
    appliesTo: ({ file, extension }) => isExtensionFrontendFile(file) || (extension === '.css' && file.startsWith('extensions/')),
    match: ({ snippet }) =>
      /(?:^|[^\w-])(?:(?<!drop-)shadow-\[(?!none\])|(?<!drop-)shadow-(?!none\b)(?:sm|md|lg|xl|2xl)|shadow(?!-)\b|backdrop-blur(?:-\w+)?|backdropFilter\s*:|boxShadow\s*:|box-shadow\s*:|backdrop-filter\s*:)/.test(
        snippet,
      ),
  },
  {
    id: 'css-surface-bypass',
    message: 'raw CSS surface token; prefer design-system CSS classes/primitives instead of local surface recipes',
    extensions: new Set(['.css']),
    appliesTo: ({ file }) => file.startsWith('extensions/'),
    match: ({ line }) => /\bbackground(?:-color)?\s*:\s*var\(--(?:surface|panel|elevated|base)\)/.test(line),
  },
  {
    id: 'desktop-css-component-recipe',
    message:
      'desktop app CSS component recipe; move UI chrome to @neon-pilot/ui primitives or add a structured exception for host-level primitive CSS',
    extensions: new Set(['.css']),
    appliesTo: ({ file }) => file === 'packages/desktop/ui/src/app/index.css',
    match: ({ line }) =>
      /^\s*\.(?:ui-desktop-layout-switcher__button|ui-segmented-button|ui-node-title-input|ui-rich-editor-button|ui-skill-invocation(?:\s+summary)?|ui-disclosure\s+summary)\b/.test(
        line,
      ),
  },
  {
    id: 'arbitrary-text-size',
    message: 'arbitrary text size; prefer shared primitive typography or documented utility classes',
    match: ({ snippet }) => /\btext-\[(?:10|10\.5|11|12|13|14|15|22|30|32|36)px\]\b/.test(snippet),
  },
  {
    id: 'route-page-centered-loading',
    message:
      'main-route extension page uses centered/page-level loading chrome; reserve the page shape and put loading state inside the working surface',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file, root }) => isMainRouteExtensionSource(file, root),
    match: ({ snippet }) => /<\s*CenteredLoadingState\b/.test(snippet),
  },
  {
    id: 'app-route-centered-loading',
    message:
      'desktop route fallback uses visible page-level loading chrome; use QuietLoadingState for shell-level route and hydration fallbacks',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => file === 'packages/desktop/ui/src/app/App.tsx',
    match: ({ snippet }) => /<\s*CenteredLoadingState\b/.test(snippet),
  },
  {
    id: 'route-page-centered-loading-wrapper',
    message:
      'main-route extension page centers loading at page level; keep route chrome stable and put LoadingState inside AppPageLayout or the waiting table/list/editor surface',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file, root }) => isMainRouteExtensionSource(file, root),
    match: ({ snippet }) => /\bh-full\b(?=[^"']*\bitems-center\b)(?=[^"']*\bjustify-center\b)/.test(snippet),
  },
  {
    id: 'route-page-local-title-scale',
    message: 'main-route extension page uses local oversized title typography; use AppPageIntro for route titles',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file, root }) => isMainRouteExtensionSource(file, root),
    match: ({ snippet }) => /<\s*h[1-3]\b[^>]*\btext-\[(?:30|32|36)px\](?=$|[^\w-])/.test(snippet),
  },
  {
    id: 'route-page-local-shell-sidebar',
    message:
      'main-route extension page renders an in-page sidebar; declare sidebarView or rightSidebarView so the app shell owns contextual side regions',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file, root }) => isMainRouteExtensionSource(file, root),
    match: ({ file, root, snippet, index, lines }) =>
      /<\s*aside\b/.test(snippet) && isInsideMainRouteComponent({ file, root, lines, index }),
  },
  {
    id: 'route-sidebar-template-missing',
    message: 'route-owned sidebar component should use SidebarSection/SidebarList/SidebarMessage instead of local sidebar chrome',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isExtensionFrontendFile(file),
    match: ({ file, root, line, index, lines }) => {
      const declaration = componentDeclarationName(line);
      if (!declaration) return false;
      const sidebarComponents = routeSideRegionComponentsForFile(file, root, 'sidebar');
      if (!sidebarComponents.has(declaration)) return false;
      const templateRegex = /<\s*SidebarSection\b/;
      return (
        !templateRegex.test(collectComponentBlock(lines, index)) &&
        !componentTemplateExistsInExtensionSource({ file, root, componentName: declaration, templateRegex })
      );
    },
  },
  {
    id: 'route-right-sidebar-template-missing',
    message: 'route-owned right sidebar component should use ContextRail as its outer visual template',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isExtensionFrontendFile(file),
    match: ({ file, root, line, index, lines }) => {
      const declaration = componentDeclarationName(line);
      if (!declaration) return false;
      const rightSidebarComponents = routeSideRegionComponentsForFile(file, root, 'right-sidebar');
      if (!rightSidebarComponents.has(declaration)) return false;
      const templateRegex = /<\s*ContextRail\b/;
      return (
        !templateRegex.test(collectComponentBlock(lines, index)) &&
        !componentTemplateExistsInExtensionSource({ file, root, componentName: declaration, templateRegex })
      );
    },
  },
  {
    id: 'extension-doc-old-right-rail-language',
    message: 'extension authoring docs should say right sidebar or context rail; reserve rightRail for literal manifest/API examples',
    extensions: new Set(['.md']),
    appliesTo: ({ file }) =>
      file === 'docs/build-an-extension.md' ||
      file === 'docs/extensions.md' ||
      file === 'packages/extensions/README.md' ||
      file === 'extensions/system-extension-manager/README.md' ||
      file === 'extensions/system-extension-manager/skills/local-extension-development/SKILL.md' ||
      file.startsWith('docs/design/') ||
      file.startsWith('docs/extension-templates/'),
    match: ({ line }) => {
      const prose = line.replace(/`[^`]*`/g, '');
      return /\bright-rail\b/i.test(prose) || /\broute,\s*rail\b/i.test(prose) || /\bright rail\b/i.test(prose);
    },
  },
  {
    id: 'manifest-main-view-shell-fields',
    message: 'main route view declares placement/scope; omit side-region fields on main views',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) =>
      /"location"\s*:\s*"main"/.test(line) && /"(?:placement|scope)"\s*:/.test(collectJsonObjectAround(lines, index)),
  },
  {
    id: 'manifest-main-route-missing-page-type',
    message: 'first-party route nav item is missing nav[].pageType; choose conversation, table, editor, settings, dashboard, or setup',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"route"\s*:/.test(line)) return false;
      const navItem = parseJsonObjectAround(lines, index);
      if (!navItem || typeof navItem.route !== 'string' || typeof navItem.pageType === 'string') return false;
      const manifest = parseJsonDocument(lines);
      if (!isMainRouteNavItem(manifest, navItem)) return false;
      return true;
    },
  },
  {
    id: 'manifest-main-route-invalid-page-type',
    message: 'first-party route nav item has an unknown nav[].pageType; use conversation, table, editor, settings, dashboard, or setup',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"pageType"\s*:/.test(line)) return false;
      const navItem = parseJsonObjectAround(lines, index);
      if (!navItem || typeof navItem.route !== 'string' || typeof navItem.pageType !== 'string') return false;
      const manifest = parseJsonDocument(lines);
      if (!isMainRouteNavItem(manifest, navItem)) return false;
      return !approvedPageTypes.has(navItem.pageType);
    },
  },
  {
    id: 'manifest-unbound-primary-right-sidebar',
    message:
      'primary rightRail view is not bound from nav[].rightSidebarView; bind route context rails from nav or use placement "workbench-tool" for Workbench tools',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"location"\s*:\s*"rightRail"/.test(line)) return false;
      const view = parseJsonObjectAround(lines, index);
      if (view?.placement !== 'primary' || typeof view.id !== 'string') return false;
      const manifest = parseJsonDocument(lines);
      const nav = Array.isArray(manifest?.contributes?.nav) ? manifest.contributes.nav : [];
      return !nav.some((item) => item?.rightSidebarView === view.id);
    },
  },
  {
    id: 'manifest-unbound-sidebar-view',
    message: 'sidebar view is not bound from nav[].sidebarView; route contextual-left regions must be declared from nav or removed',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"location"\s*:\s*"sidebar"/.test(line)) return false;
      const view = parseJsonObjectAround(lines, index);
      if (typeof view?.id !== 'string') return false;
      const manifest = parseJsonDocument(lines);
      const nav = Array.isArray(manifest?.contributes?.nav) ? manifest.contributes.nav : [];
      return !nav.some((item) => item?.sidebarView === view.id);
    },
  },
  {
    id: 'manifest-invalid-sidebar-nav-reference',
    message: 'nav[].sidebarView must reference a known sidebar view',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"sidebarView"\s*:/.test(line)) return false;
      const navItem = parseJsonObjectAround(lines, index);
      const sidebarView = navItem?.sidebarView;
      if (typeof sidebarView !== 'string') return false;
      const manifest = parseJsonDocument(lines);
      const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
      const view = views.find((item) => item?.id === sidebarView);
      return view?.location !== 'sidebar';
    },
  },
  {
    id: 'manifest-invalid-right-sidebar-nav-reference',
    message: 'nav[].rightSidebarView must reference a known primary rightRail view',
    extensions: new Set(['.json']),
    appliesTo: ({ file }) =>
      /^extensions\/[^/]+\/extension\.json$/.test(file) || /^docs\/extension-templates\/templates\/[^/]+\/extension\.json$/.test(file),
    match: ({ line, lines, index }) => {
      if (!/"rightSidebarView"\s*:/.test(line)) return false;
      const navItem = parseJsonObjectAround(lines, index);
      const rightSidebarView = navItem?.rightSidebarView;
      if (typeof rightSidebarView !== 'string') return false;
      const manifest = parseJsonDocument(lines);
      const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
      const view = views.find((item) => item?.id === rightSidebarView);
      return view?.location !== 'rightRail' || view?.placement !== 'primary';
    },
  },
];

function normalizePath(path) {
  return path.split(sep).join('/');
}

function isIgnoredFile(file) {
  return ignoredFileRegexes.some((regex) => regex.test(file));
}

function isDesignSystemSource(file) {
  return designSystemSourceRegexes.some((regex) => regex.test(file));
}

function isExtensionFrontendFile(file) {
  return (
    /^extensions\/[^/]+\/src\/.*\.tsx$/.test(file) ||
    /^extensions\/[^/]+\/webapp\/.*\.tsx$/.test(file) ||
    /^docs\/extension-templates\/templates\/[^/]+\/src\/.*\.tsx$/.test(file) ||
    /^packages\/desktop\/ui\/src\/extensions\/.*\.tsx$/.test(file)
  );
}

function isInternalFrontendFile(file) {
  return /^packages\/desktop\/ui\/src\/.*\.tsx$/.test(file) || isExtensionFrontendFile(file);
}

function readExtensionManifest(root, extensionId) {
  const cacheKey = `${root}:${extensionId}`;
  if (extensionManifestCache.has(cacheKey)) return extensionManifestCache.get(cacheKey);

  const manifestPath = join(root, 'extensions', extensionId, 'extension.json');
  let manifest = null;
  try {
    if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = null;
  }
  extensionManifestCache.set(cacheKey, manifest);
  return manifest;
}

function readExtensionTemplateManifest(root, templateId) {
  const cacheKey = `${root}:template:${templateId}`;
  if (extensionManifestCache.has(cacheKey)) return extensionManifestCache.get(cacheKey);

  const manifestPath = join(root, 'docs', 'extension-templates', 'templates', templateId, 'extension.json');
  let manifest = null;
  try {
    if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = null;
  }
  extensionManifestCache.set(cacheKey, manifest);
  return manifest;
}

function manifestHasMainRoute(manifest) {
  const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
  return views.some((view) => view?.location === 'main' && typeof view?.route === 'string' && view.route.length > 0);
}

function isMainRouteNavItem(manifest, navItem) {
  const nav = Array.isArray(manifest?.contributes?.nav) ? manifest.contributes.nav : [];
  const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
  const matchingNavItem = nav.some((item) => item?.id === navItem.id && item?.route === navItem.route && item?.label === navItem.label);
  if (!matchingNavItem) return false;
  return views.some((view) => view?.location === 'main' && view?.route === navItem.route);
}

function mainRouteComponentNames(manifest) {
  const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
  return new Set(
    views
      .filter((view) => view?.location === 'main' && typeof view?.route === 'string' && view.route.length > 0)
      .map((view) => view?.component)
      .filter((component) => typeof component === 'string' && component.length > 0),
  );
}

function mainRouteComponentsForFile(file, root) {
  const match = /^extensions\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  if (match) return mainRouteComponentNames(readExtensionManifest(root, match[1]));

  const templateMatch = /^docs\/extension-templates\/templates\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  if (templateMatch) return mainRouteComponentNames(readExtensionTemplateManifest(root, templateMatch[1]));

  return new Set();
}

function routeSideRegionComponentNames(manifest, kind) {
  const views = Array.isArray(manifest?.contributes?.views) ? manifest.contributes.views : [];
  const nav = Array.isArray(manifest?.contributes?.nav) ? manifest.contributes.nav : [];
  const mainRouteNav = nav.filter((item) => isMainRouteNavItem(manifest, item));
  const viewIds = new Set(
    mainRouteNav
      .map((item) => (kind === 'sidebar' ? item?.sidebarView : item?.rightSidebarView))
      .filter((id) => typeof id === 'string' && id.length > 0),
  );

  return new Set(
    views
      .filter((view) => {
        if (!viewIds.has(view?.id)) return false;
        if (kind === 'sidebar') return view?.location === 'sidebar';
        return view?.location === 'rightRail' && view?.placement === 'primary';
      })
      .map((view) => view?.component)
      .filter((component) => typeof component === 'string' && component.length > 0),
  );
}

function routeSideRegionComponentsForFile(file, root, kind) {
  const match = /^extensions\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  if (match) return routeSideRegionComponentNames(readExtensionManifest(root, match[1]), kind);

  const templateMatch = /^docs\/extension-templates\/templates\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  if (templateMatch) return routeSideRegionComponentNames(readExtensionTemplateManifest(root, templateMatch[1]), kind);

  return new Set();
}

function extensionHasMainRoute(root, extensionId) {
  return manifestHasMainRoute(readExtensionManifest(root, extensionId));
}

function extensionTemplateHasMainRoute(root, templateId) {
  return manifestHasMainRoute(readExtensionTemplateManifest(root, templateId));
}

function isMainRouteExtensionSource(file, root) {
  const match = /^extensions\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  if (match) return extensionHasMainRoute(root, match[1]);

  const templateMatch = /^docs\/extension-templates\/templates\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  return Boolean(templateMatch && extensionTemplateHasMainRoute(root, templateMatch[1]));
}

function isInsideMainRouteComponent({ file, root, lines, index }) {
  const mainComponents = mainRouteComponentsForFile(file, root);
  if (mainComponents.size === 0) return false;

  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const line = lines[cursor] ?? '';
    const declaration =
      /\b(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/.exec(line) ??
      /\b(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/.exec(line);
    if (!declaration) continue;
    return mainComponents.has(declaration[1]);
  }

  return false;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (ignoreSegments.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (includeExt.has(extname(path)) && !isIgnoredFile(path)) files.push(path);
  }
  return files;
}

function collectOpeningSnippet(lines, index) {
  const parts = [];
  for (let offset = 0; offset < 6 && index + offset < lines.length; offset += 1) {
    parts.push(lines[index + offset].trim());
    if (lines[index + offset].includes('>')) break;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function collectElementBlock(lines, index) {
  const parts = [];
  for (let offset = 0; offset < 14 && index + offset < lines.length; offset += 1) {
    const line = lines[index + offset].trim();
    parts.push(line);
    if (/<\/(?:Button|ToolbarButton)>/.test(line)) break;
    if (offset === 0 && /\/>\s*$/.test(line)) break;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function componentDeclarationName(line) {
  const declaration =
    /\b(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/.exec(line) ??
    /\b(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/.exec(line);
  return declaration?.[1] ?? null;
}

function collectComponentBlock(lines, index) {
  const parts = [];
  for (let cursor = index; cursor < lines.length && cursor < index + 240; cursor += 1) {
    if (cursor > index && componentDeclarationName(lines[cursor] ?? '')) break;
    parts.push(lines[cursor]);
  }
  return parts.join('\n');
}

function componentTemplateExistsInExtensionSource({ file, root, componentName, templateRegex }) {
  const extensionMatch = /^extensions\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  const templateMatch = /^docs\/extension-templates\/templates\/([^/]+)\/src\/.*\.tsx$/.exec(file);
  const sourceRoot = extensionMatch
    ? join(root, 'extensions', extensionMatch[1], 'src')
    : templateMatch
      ? join(root, 'docs', 'extension-templates', 'templates', templateMatch[1], 'src')
      : null;
  if (!sourceRoot || !existsSync(sourceRoot)) return false;

  for (const sourceFile of walk(sourceRoot, [])) {
    if (extname(sourceFile) !== '.tsx') continue;
    const relativeFile = normalizePath(relative(root, sourceFile));
    if (isIgnoredFile(relativeFile)) continue;
    const lines = readFileSync(sourceFile, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (componentDeclarationName(lines[index] ?? '') !== componentName) continue;
      if (relativeFile === file) continue;
      if (templateRegex.test(collectComponentBlock(lines, index))) return true;
    }
  }

  return false;
}

function collectJsonObjectAround(lines, index) {
  let start = index;
  for (; start >= 0; start -= 1) {
    if (/^\s*\{\s*$/.test(lines[start] ?? '')) break;
  }

  let end = index;
  for (; end < lines.length; end += 1) {
    if (/^\s*\},?\s*$/.test(lines[end] ?? '')) break;
  }

  return lines.slice(Math.max(0, start), Math.min(lines.length, end + 1)).join('\n');
}

function parseJsonDocument(lines) {
  try {
    return JSON.parse(lines.join('\n'));
  } catch {
    return null;
  }
}

function parseJsonObjectAround(lines, index) {
  try {
    return JSON.parse(collectJsonObjectAround(lines, index).replace(/,\s*$/, ''));
  } catch {
    return null;
  }
}

function sampleForLine(lines, index) {
  const line = lines[index] ?? '';
  if (/<\s*[A-Za-z][\w.:/-]*(?=[\s>/])/.test(line)) return collectOpeningSnippet(lines, index).slice(0, 260);
  return line.trim().replace(/\s+/g, ' ').slice(0, 260);
}

function hasSpecificReason(reason) {
  const trimmedReason = reason?.trim() ?? '';
  return trimmedReason.length >= 12 && !/^(?:ok|todo|fix later|temporary|n\/a|na)$/i.test(trimmedReason);
}

function isInsideInlineCode(line, index) {
  const before = line.slice(0, index);
  const ticksBefore = before.match(/`/g)?.length ?? 0;
  return ticksBefore % 2 === 1;
}

function parseInlineException(line) {
  const markerIndex = line.indexOf('ui-pattern-ok');
  if (markerIndex === -1) return null;
  if (isInsideInlineCode(line, markerIndex)) return null;

  const tail = line.slice(markerIndex);
  const match = /^ui-pattern-ok\s+([a-z0-9-]+)\s+reason="([^"]+)"/.exec(tail);
  if (!match) {
    return {
      valid: false,
      reason: 'use ui-pattern-ok <rule-id> reason="specific reason"',
    };
  }

  const [, ruleId, reason] = match;
  const trimmedReason = reason.trim();
  if (!ruleIds.has(ruleId)) {
    return {
      valid: false,
      reason: `unknown rule id "${ruleId}"`,
      ruleId,
    };
  }

  if (!hasSpecificReason(trimmedReason)) {
    return {
      valid: false,
      reason: 'reason must be a specific justification',
      ruleId,
    };
  }

  return {
    valid: true,
    reason: trimmedReason,
    ruleId,
  };
}

function inlineExceptionFor(lines, index, id) {
  const previous = index > 0 ? parseInlineException(lines[index - 1]) : null;
  if (previous?.valid && previous.ruleId === id) return previous;

  const current = parseInlineException(lines[index] ?? '');
  if (current?.valid && current.ruleId === id) return current;

  if (/^\s*\.[^{]+\{\s*$/.test(lines[index] ?? '')) {
    const next = parseInlineException(lines[index + 1] ?? '');
    if (next?.valid && next.ruleId === id) return next;
  }

  return null;
}

function isInlineAllowed(lines, index, id) {
  return inlineExceptionFor(lines, index, id) !== null;
}

function allowlistMatches(allowlistEntry, finding) {
  if (!hasSpecificReason(allowlistEntry.reason)) return false;
  if (allowlistEntry.id && allowlistEntry.id !== finding.id) return false;
  if (allowlistEntry.file && allowlistEntry.file !== finding.file) return false;
  if (allowlistEntry.fileRegex && !allowlistEntry.fileRegex.test(finding.file)) return false;
  if (allowlistEntry.sample && allowlistEntry.sample !== finding.sample) return false;
  if (allowlistEntry.sampleIncludes && !finding.sample.includes(allowlistEntry.sampleIncludes)) return false;
  if (allowlistEntry.sampleRegex && !allowlistEntry.sampleRegex.test(finding.sample)) return false;
  return true;
}

function isAllowlisted(finding, allowlist) {
  return allowlist.some((entry) => allowlistMatches(entry, finding));
}

const ruleIds = new Set(rules.map((rule) => rule.id));

function collectInvalidInlineExceptionFinding(relativeFile, lines, index) {
  const parsed = parseInlineException(lines[index] ?? '');
  if (parsed === null || parsed.valid) return null;

  return {
    file: relativeFile,
    line: index + 1,
    id: inlineExceptionId,
    message: `invalid UI pattern exception; ${parsed.reason}`,
    sample: sampleForLine(lines, index),
  };
}

export function auditUiPatterns(options = {}) {
  const root = options.repoRoot ?? repoRoot;
  const roots = options.roots ?? defaultRoots;
  const allowlist = options.allowlist ?? defaultAllowlist;
  const findings = [];

  for (const scanRoot of roots) {
    const absRoot = join(root, scanRoot);
    for (const file of walk(absRoot)) {
      const relativeFile = normalizePath(relative(root, file));
      if (isDesignSystemSource(relativeFile)) continue;

      const extension = extname(file);
      const text = readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        const invalidInlineException = collectInvalidInlineExceptionFinding(relativeFile, lines, index);
        if (invalidInlineException) findings.push(invalidInlineException);

        const snippet = sampleForLine(lines, index);
        for (const rule of rules) {
          if (rule.extensions && !rule.extensions.has(extension)) continue;
          if (rule.appliesTo && !rule.appliesTo({ file: relativeFile, extension, root })) continue;
          if (!rule.match({ file: relativeFile, extension, root, line, snippet, index, lines })) continue;
          if (isInlineAllowed(lines, index, rule.id)) continue;

          const finding = {
            file: relativeFile,
            line: index + 1,
            id: rule.id,
            message: rule.message,
            sample: snippet,
          };
          if (!isAllowlisted(finding, allowlist)) findings.push(finding);
        }
      });
    }
  }

  return findings;
}

export function parseMaxFindings(rawLimit) {
  if (rawLimit === undefined || rawLimit.trim() === '') return 0;
  if (rawLimit.trim().toLowerCase() === 'unbounded') return null;
  const limit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(limit) ? limit : 0;
}

export function exceedsMaxFindings(findings, limit) {
  return limit !== null && findings.length > limit;
}

export function formatUiPatternReport(findings, roots = defaultRoots) {
  const byId = new Map();
  for (const finding of findings) byId.set(finding.id, (byId.get(finding.id) ?? 0) + 1);

  const lines = ['UI pattern audit', `Scanned: ${roots.join(', ')}`, `Findings: ${findings.length}`];
  for (const [id, count] of [...byId.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`- ${id}: ${count}`);
  }

  if (findings.length > 0) {
    lines.push('', 'Top findings:');
    for (const finding of findings.slice(0, 80)) {
      lines.push(`${finding.file}:${finding.line} [${finding.id}] ${finding.message}`);
      lines.push(`  ${finding.sample}`);
    }
    if (findings.length > 80) lines.push(`... ${findings.length - 80} more`);
  }

  return lines.join('\n');
}

function runCli() {
  const reportOnly = process.argv.includes('--report-only');
  const findings = auditUiPatterns();
  console.log(formatUiPatternReport(findings));

  const limit = parseMaxFindings(process.env.UI_PATTERN_MAX_FINDINGS);
  if (!reportOnly && exceedsMaxFindings(findings, limit)) {
    console.error(
      `\nUI pattern audit failed: ${findings.length} findings exceed UI_PATTERN_MAX_FINDINGS=${limit}. Use --report-only or UI_PATTERN_MAX_FINDINGS=unbounded for exploratory audits.`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
