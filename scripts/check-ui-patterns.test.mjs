import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { auditUiPatterns, exceedsMaxFindings, parseMaxFindings } from './check-ui-patterns.mjs';

const tempRoots = [];

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'neon-ui-patterns-'));
  tempRoots.push(root);
  return root;
}

function writeFixture(root, file, contents) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function findingIds(findings) {
  return findings.map((finding) => finding.id);
}

describe('check-ui-patterns', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop(), { force: true, recursive: true });
    }
  });

  it('flags raw accent action buttons', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <button className="rounded bg-accent px-3 py-1 text-white hover:bg-accent/90">Run</button>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('raw-control');
    expect(ids).toContain('custom-button-chrome');
    expect(ids).toContain('raw-semantic-surface');
  });

  it('allows inline-code mentions of ui-pattern-ok syntax in docs', () => {
    const root = createRepo();
    writeFixture(
      root,
      'docs/design/ui-migration-plan.md',
      `
        Mention \`ui-pattern-ok raw-control reason="specific reason"\` when documenting exception syntax.
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['docs/design'] }).filter(
      (finding) => finding.id === 'invalid-ui-pattern-exception',
    );

    expect(findings).toHaveLength(0);
  });

  it('flags custom pill styling', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <span className="rounded-full border border-warning bg-warning/10 px-2 text-warning">Blocked</span>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('custom-pill');
    expect(ids).toContain('raw-semantic-surface');
  });

  it('flags CSS shadow, blur, and local surface recipes outside design-system source', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.css',
      `
        .panel {
          background: var(--surface);
          box-shadow: 0 12px 32px rgb(0 0 0 / 0.22);
          backdrop-filter: blur(12px);
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('css-surface-bypass');
    expect(ids.filter((id) => id === 'web-shadow-blur')).toHaveLength(2);
  });

  it('flags raw controls in extension frontend code', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return (
            <form>
              <input className="rounded-md border border-border-subtle px-2" />
              <select><option>Automatic</option></select>
              <textarea />
            </form>
          );
        }
      `,
    );

    const rawControls = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'raw-control',
    );

    expect(rawControls).toHaveLength(3);
  });

  it('flags raw controls in desktop app frontend code', () => {
    const root = createRepo();
    writeFixture(
      root,
      'packages/desktop/ui/src/components/SettingsSurface.tsx',
      `
        export function SettingsSurface() {
          return <button className="rounded-md border border-border-subtle px-2">Save</button>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['packages/desktop/ui/src'] }));

    expect(ids).toContain('raw-control');
  });

  it('flags invalid shared button variants', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { Button } from '@neon-pilot/extensions/ui';

        export function Demo() {
          return <Button variant="secondary">Refresh</Button>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('invalid-button-variant');
  });

  it('flags local size overrides on shared action buttons', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { Button, IconButton } from '@neon-pilot/extensions/ui';

        export function Demo() {
          return (
            <>
              <Button className="min-h-9 px-3 py-2 text-[13px]">Install</Button>
              <IconButton aria-label="Refresh" title="Refresh" className="h-7 w-7">↻</IconButton>
              <Button className="absolute right-3">Pinned action</Button>
            </>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'local-action-button-sizing',
    );

    expect(findings).toHaveLength(2);
  });

  it('flags text-only common action buttons while allowing icon plus text', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { Button, ToolbarButton } from '@neon-pilot/extensions/ui';

        export function Demo() {
          return (
            <>
              <ToolbarButton>Refresh</ToolbarButton>
              <Button variant="toolbar">
                <span aria-hidden="true">⌕</span>
                Search
              </Button>
            </>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'common-text-action-button',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ sample: '<ToolbarButton>Refresh</ToolbarButton>' });
  });

  it('requires hover help on icon actions', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { IconButton } from '@neon-pilot/extensions/ui';

        export function Demo() {
          return (
            <>
              <IconButton aria-label="Refresh">↻</IconButton>
              <IconButton aria-label="Add" title="Add">+</IconButton>
            </>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'icon-action-missing-title',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ sample: '<IconButton aria-label="Refresh">↻</IconButton>' });
  });

  it('flags centered loading chrome in main-route extension pages', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify({
        schemaVersion: 2,
        id: 'demo-route',
        name: 'Demo Route',
        version: '0.1.0',
        contributes: {
          views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
        },
      }),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        import { CenteredLoadingState } from '@neon-pilot/extensions/ui';

        export function DemoPage() {
          return <CenteredLoadingState label="Loading demo..." />;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-page-centered-loading',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/src/frontend.tsx' });
  });

  it('flags centered loading chrome in desktop route fallbacks', () => {
    const root = createRepo();
    writeFixture(
      root,
      'packages/desktop/ui/src/app/App.tsx',
      `
        import { CenteredLoadingState } from '../components/ui';

        export function App() {
          return <CenteredLoadingState label="Loading..." />;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['packages/desktop/ui/src'] }).filter(
      (finding) => finding.id === 'app-route-centered-loading',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'packages/desktop/ui/src/app/App.tsx' });
  });

  it('flags full-page centered loading wrappers in main-route extension templates', () => {
    const root = createRepo();
    writeFixture(
      root,
      'docs/extension-templates/templates/template-route/extension.json',
      JSON.stringify({
        schemaVersion: 2,
        id: 'template-route',
        name: 'Template Route',
        version: '0.1.0',
        contributes: {
          views: [{ id: 'page', title: 'Template', location: 'main', route: '/template-route', component: 'TemplatePage' }],
        },
      }),
    );
    writeFixture(
      root,
      'docs/extension-templates/templates/template-route/src/frontend.tsx',
      `
        import { LoadingState } from '@neon-pilot/extensions/ui';

        export function TemplatePage() {
          return (
            <div className="flex h-full items-center justify-center px-6">
              <LoadingState label="Loading items..." />
            </div>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['docs/extension-templates'] }).filter(
      (finding) => finding.id === 'route-page-centered-loading-wrapper',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'docs/extension-templates/templates/template-route/src/frontend.tsx' });
  });

  it('flags oversized local route titles in main-route extension pages', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify({
        schemaVersion: 2,
        id: 'demo-route',
        name: 'Demo Route',
        version: '0.1.0',
        contributes: {
          views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
        },
      }),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        export function DemoPage() {
          return <h1 className="text-[32px] font-semibold">Demo</h1>;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-page-local-title-scale',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/src/frontend.tsx' });
  });

  it('flags in-page sidebars in manifest main-route components', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify({
        schemaVersion: 2,
        id: 'demo-route',
        name: 'Demo Route',
        version: '0.1.0',
        contributes: {
          views: [
            { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
            { id: 'details', title: 'Details', location: 'rightRail', placement: 'primary', component: 'DemoDetails' },
          ],
        },
      }),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        export function DemoDetails() {
          return <aside className="flex h-full min-h-0 flex-col">Details</aside>;
        }

        export function DemoPage() {
          return (
            <main>
              <aside className="w-72 border-r border-border-subtle">Filters</aside>
            </main>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-page-local-shell-sidebar',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: 'extensions/demo-route/src/frontend.tsx',
      sample: '<aside className="w-72 border-r border-border-subtle">Filters</aside>',
    });
  });

  it('flags old right-rail wording in extension authoring docs', () => {
    const root = createRepo();
    writeFixture(
      root,
      'docs/extension-templates/README.md',
      `
        Build a route, rail extension with a route-owned right-rail panel.
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['docs/extension-templates'] }).filter(
      (finding) => finding.id === 'extension-doc-old-right-rail-language',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'docs/extension-templates/README.md' });
  });

  it('allows literal rightRail and right-rail identifiers in extension authoring docs', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/system-extension-manager/README.md',
      `
        Use \`rightRail\` in manifest JSON and the \`right-rail\` starter template id for compatibility.
        Describe the visible surface as the right sidebar in prose.
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'extension-doc-old-right-rail-language',
    );

    expect(findings).toHaveLength(0);
  });

  it('flags side-region fields on main extension manifest views', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              {
                id: 'page',
                title: 'Demo',
                location: 'main',
                route: '/ext/demo-route',
                component: 'DemoPage',
                placement: 'primary',
                scope: 'global',
              },
              {
                id: 'context',
                title: 'Demo context',
                location: 'rightRail',
                placement: 'primary',
                scope: 'global',
                component: 'DemoContext',
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-main-view-shell-fields',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags primary right sidebar views that are not bound from route nav', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context', title: 'Demo context', location: 'rightRail', placement: 'primary', component: 'DemoContext' },
            ],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-unbound-primary-right-sidebar',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags sidebar views that are not bound from route nav', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context-nav', title: 'Demo navigation', location: 'sidebar', component: 'DemoSidebar' },
            ],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-unbound-sidebar-view',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags nav sidebar references that do not point to sidebar views', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route', sidebarView: 'page' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-invalid-sidebar-nav-reference',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags nav right-sidebar references that do not point to primary right sidebar views', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context', title: 'Demo context', location: 'rightRail', component: 'DemoContext' },
            ],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route', rightSidebarView: 'context' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-invalid-right-sidebar-nav-reference',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags main-route nav items without approved page types', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-main-route-missing-page-type',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('flags unknown main-route page types', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
            nav: [{ id: 'demo-route', label: 'Demo', route: '/ext/demo-route', pageType: 'wizard' }],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-main-route-invalid-page-type',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/extension.json' });
  });

  it('allows approved page types and ignores non-page nav items', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [{ id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' }],
            nav: [
              { id: 'demo-route', label: 'Demo', route: '/ext/demo-route', pageType: 'dashboard' },
              { id: 'external-help', label: 'Help', route: '/external/help' },
            ],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'manifest-main-route-missing-page-type' || finding.id === 'manifest-main-route-invalid-page-type',
    );

    expect(findings).toHaveLength(0);
  });

  it('allows route-bound sidebar views, primary right sidebar views, and workbench tool rails', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context-nav', title: 'Demo navigation', location: 'sidebar', component: 'DemoSidebar' },
              { id: 'context', title: 'Demo context', location: 'rightRail', placement: 'primary', component: 'DemoContext' },
              { id: 'tool', title: 'Demo tool', location: 'rightRail', placement: 'workbench-tool', component: 'DemoTool' },
            ],
            nav: [
              {
                id: 'demo-route',
                label: 'Demo',
                route: '/ext/demo-route',
                sidebarView: 'context-nav',
                rightSidebarView: 'context',
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) =>
        finding.id === 'manifest-unbound-primary-right-sidebar' ||
        finding.id === 'manifest-unbound-sidebar-view' ||
        finding.id === 'manifest-invalid-sidebar-nav-reference' ||
        finding.id === 'manifest-invalid-right-sidebar-nav-reference',
    );

    expect(findings).toHaveLength(0);
  });

  it('flags route-owned sidebar components that bypass the sidebar template', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context-nav', title: 'Demo navigation', location: 'sidebar', component: 'DemoSidebar' },
            ],
            nav: [
              {
                id: 'demo-route',
                label: 'Demo',
                route: '/ext/demo-route',
                pageType: 'table',
                sidebarView: 'context-nav',
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        export function DemoPage() {
          return <div>Demo</div>;
        }

        export function DemoSidebar() {
          return <div className="flex h-full flex-col gap-2 p-3">Local sidebar</div>;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-sidebar-template-missing',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/src/frontend.tsx' });
  });

  it('allows route-owned sidebar components that use the sidebar template', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context-nav', title: 'Demo navigation', location: 'sidebar', component: 'DemoSidebar' },
            ],
            nav: [
              {
                id: 'demo-route',
                label: 'Demo',
                route: '/ext/demo-route',
                pageType: 'table',
                sidebarView: 'context-nav',
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        import { SidebarSection } from '@neon-pilot/extensions/ui';

        export function DemoPage() {
          return <div>Demo</div>;
        }

        export function DemoSidebar() {
          return <SidebarSection title="Demo">Content</SidebarSection>;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-sidebar-template-missing',
    );

    expect(findings).toHaveLength(0);
  });

  it('flags route-owned right sidebar components that bypass ContextRail', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context', title: 'Demo context', location: 'rightRail', placement: 'primary', component: 'DemoContext' },
            ],
            nav: [
              {
                id: 'demo-route',
                label: 'Demo',
                route: '/ext/demo-route',
                pageType: 'table',
                rightSidebarView: 'context',
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        export function DemoPage() {
          return <div>Demo</div>;
        }

        export function DemoContext() {
          return <div className="flex h-full flex-col border-l border-border-subtle">Context</div>;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-right-sidebar-template-missing',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'extensions/demo-route/src/frontend.tsx' });
  });

  it('allows route-owned right sidebar components that use ContextRail', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-route/extension.json',
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'demo-route',
          name: 'Demo Route',
          version: '0.1.0',
          contributes: {
            views: [
              { id: 'page', title: 'Demo', location: 'main', route: '/ext/demo-route', component: 'DemoPage' },
              { id: 'context', title: 'Demo context', location: 'rightRail', placement: 'primary', component: 'DemoContext' },
            ],
            nav: [
              {
                id: 'demo-route',
                label: 'Demo',
                route: '/ext/demo-route',
                pageType: 'table',
                rightSidebarView: 'context',
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    writeFixture(
      root,
      'extensions/demo-route/src/frontend.tsx',
      `
        import { ContextRail } from '@neon-pilot/extensions/ui';

        export function DemoPage() {
          return <div>Demo</div>;
        }

        export function DemoContext() {
          return <ContextRail title="Demo">Context</ContextRail>;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-right-sidebar-template-missing',
    );

    expect(findings).toHaveLength(0);
  });

  it('allows centered loading in workbench-only extension panels', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo-workbench/extension.json',
      JSON.stringify({
        schemaVersion: 2,
        id: 'demo-workbench',
        name: 'Demo Workbench',
        version: '0.1.0',
        contributes: {
          views: [{ id: 'panel', title: 'Demo', location: 'rightRail', scope: 'conversation', component: 'DemoPanel' }],
        },
      }),
    );
    writeFixture(
      root,
      'extensions/demo-workbench/src/frontend.tsx',
      `
        import { CenteredLoadingState } from '@neon-pilot/extensions/ui';

        export function DemoPanel() {
          return <CenteredLoadingState label="Loading panel..." />;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'route-page-centered-loading',
    );

    expect(findings).toHaveLength(0);
  });

  it('scans extension templates by default', () => {
    const root = createRepo();
    writeFixture(
      root,
      'docs/extension-templates/templates/template-demo/src/frontend.tsx',
      `
        export function DemoTemplate() {
          return <input className="rounded-md border border-border-subtle px-2" />;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root }));

    expect(ids).toContain('raw-control');
  });

  it('flags raw details and summary disclosures in internal TSX', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return (
            <details>
              <summary>Advanced</summary>
            </details>
          );
        }
      `,
    );

    const detailsFindings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'raw-details-summary',
    );

    expect(detailsFindings).toHaveLength(2);
  });

  it('flags extension imports from UI or desktop internals', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { Button } from '@neon-pilot/ui';
        import { Layout } from 'packages/desktop/ui/src/components/Layout';

        export function Demo() {
          return <Button>{Layout.name}</Button>;
        }
      `,
    );

    const forbiddenImports = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'forbidden-extension-import',
    );

    expect(forbiddenImports).toHaveLength(2);
  });

  it('honors allowlists and max-finding thresholds', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <input className="rounded-md border border-border-subtle px-2" />;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] });
    expect(findings).toHaveLength(1);
    expect(parseMaxFindings(undefined)).toBe(0);
    expect(parseMaxFindings('0')).toBe(0);
    expect(parseMaxFindings('unbounded')).toBeNull();
    expect(exceedsMaxFindings(findings, 0)).toBe(true);
    expect(exceedsMaxFindings(findings, null)).toBe(false);

    const allowedFindings = auditUiPatterns({
      allowlist: [
        {
          id: 'raw-control',
          file: 'extensions/demo/src/frontend.tsx',
          reason: 'embedded third-party widget requires native input semantics',
          sampleIncludes: '<input',
        },
      ],
      repoRoot: root,
      roots: ['extensions'],
    });
    expect(allowedFindings).toHaveLength(0);
    expect(exceedsMaxFindings(allowedFindings, 0)).toBe(false);

    const undocumentedAllowlistFindings = auditUiPatterns({
      allowlist: [{ id: 'raw-control', file: 'extensions/demo/src/frontend.tsx', sampleIncludes: '<input' }],
      repoRoot: root,
      roots: ['extensions'],
    });
    expect(undocumentedAllowlistFindings).toHaveLength(1);
  });

  it('requires structured inline exceptions with a matching rule id and reason', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return (
            <>
              {/* ui-pattern-ok */}
              <input className="rounded-md border border-border-subtle px-2" />
              {/* ui-pattern-ok raw-control reason="embedded third-party color picker keeps native input semantics" */}
              <input type="color" />
              {/* ui-pattern-ok raw-control reason="ok" */}
              <input type="range" />
            </>
          );
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] });
    const invalidExceptions = findings.filter((finding) => finding.id === 'invalid-ui-pattern-exception');
    const rawControls = findings.filter((finding) => finding.id === 'raw-control');

    expect(invalidExceptions).toHaveLength(2);
    expect(rawControls).toHaveLength(2);
  });

  it('does not give extension webapp surfaces a blanket pass', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/webapp/src/App.tsx',
      `
        export function App() {
          return <button className="rounded-md border border-border-subtle px-2 hover:bg-muted">Run</button>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('raw-control');
    expect(ids).toContain('custom-button-chrome');
  });

  it('allows design-system source files to define the primitives being enforced', () => {
    const root = createRepo();
    writeFixture(
      root,
      'packages/ui/src/primitives.tsx',
      `
        export function Primitive() {
          return <button className="rounded bg-accent px-3 py-1 shadow-lg">Run</button>;
        }
      `,
    );

    expect(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['packages/ui/src'] })).toEqual([]);
  });

  it('does not hide debt behind the default allowlist', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <span className="rounded bg-danger px-2 py-1 text-white">Failed</span>;
        }
      `,
    );

    expect(auditUiPatterns({ repoRoot: root, roots: ['extensions'] })).toEqual(
      auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }),
    );
  });

  it('requires explicit exceptions for desktop app CSS component recipes', () => {
    const root = createRepo();
    writeFixture(
      root,
      'packages/desktop/ui/src/app/index.css',
      `
        @layer components {
          .ui-segmented-button {
            @apply rounded-md px-2;
          }

          .ui-disclosure summary {
            /* ui-pattern-ok desktop-css-component-recipe reason="Host stylesheet resets native summary chrome for the shared Disclosure primitive." */
            list-style: none;
          }
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['packages/desktop/ui/src'] }).filter(
      (finding) => finding.id === 'desktop-css-component-recipe',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'packages/desktop/ui/src/app/index.css', sample: '.ui-segmented-button {' });
  });
});
