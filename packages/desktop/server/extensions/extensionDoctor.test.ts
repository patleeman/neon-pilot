import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateExtensionPackage } from './extensionDoctor.js';

function createExtensionPackage() {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-doctor-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(
    join(root, 'extension.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        version: '0.1.0',
        frontend: { entry: 'dist/frontend.js' },
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping', title: 'Ping', worker: { enabled: true } }] },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
          tools: [
            {
              id: 'ping',
              name: 'doctor_ping',
              description: 'Ping the doctor test extension.',
              action: 'ping',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
        permissions: [],
      },
      null,
      2,
    ),
  );
  return root;
}

describe('extension doctor', () => {
  it('accepts a healthy built extension package', async () => {
    const root = createExtensionPackage();
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'src', 'backend.ts'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(true);
    expect(report.summary.errors).toBe(0);
  });

  it('rejects user-extension Tailwind utilities and raw controls that the packaged builder cannot style', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        packageType: 'user',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
        },
      }),
    );
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `export function DoctorPage() { return <div className="flex"><button>Save</button></div>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['uncompiled-extension-utilities', 'raw-extension-control']),
    );
  });

  it('rejects JSX components that esbuild would leave as unbound runtime identifiers', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        packageType: 'user',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
        },
      }),
    );
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `import { Button as SharedButton } from '@neon-pilot/extensions/ui';\nimport type * as UI from '@neon-pilot/extensions/ui';\ninterface InterfacePanel {}\ntype AliasPanel = {};\nconst ui = {} as Record<string, unknown>;\nconst { TextInput: Input } = ui;\nfunction Typed(props: { MissingPanel: boolean }) { return <MissingPanel />; }\nexport function DoctorPage() { return <><SharedButton>Save</SharedButton><TextInput /><DataTableToolbar actions={<SharedButton>Refresh</SharedButton>} /><Input /><Typed props={{ MissingPanel: true }} /><UI.Button /><InterfacePanel /><AliasPanel /></>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unbound-jsx-component',
          message: expect.stringMatching(/AliasPanel.*DataTableToolbar.*InterfacePanel.*MissingPanel.*TextInput.*UI/u),
        }),
      ]),
    );
  });

  it('ignores JSX-looking comments and strings and recognizes combined imports', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        packageType: 'user',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
        },
      }),
    );
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `import React, { Suspense, useState } from 'react';\nimport type { ChangeEvent } from 'react';\ntype RuntimeState = { running: boolean };\nconst docs = '<TextInput />';\nconst matcher = /<RegexPanel \\/>/;\n// <GhostPanel />\nfunction Slot({ Component }: { Component: React.ComponentType }) { return <Component />; }\nconst { Fragment: LocalFragment } = React;\nexport function DoctorPage() { const [runtime] = useState<RuntimeState>({ running: false }); const onChange = (_event: ChangeEvent<HTMLInputElement>) => runtime.running; void onChange; return <Suspense fallback={null}><React.Fragment /><LocalFragment /><Slot Component={LocalFragment} /></Suspense>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.findings.map((finding) => finding.code)).not.toContain('unbound-jsx-component');
  });

  it('applies user UI guards to imported source files and packageType spoofing', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        packageType: 'system',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
        },
      }),
    );
    mkdirSync(join(root, 'src', 'components'), { recursive: true });
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export { DoctorPage } from './components/DoctorPage';\n`);
    writeFileSync(
      join(root, 'src', 'components', 'DoctorPage.tsx'),
      `export function DoctorPage() { return <div className="flex"><button>Save</button></div>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['uncompiled-extension-utilities', 'raw-extension-control']),
    );
    expect(report.findings.some((finding) => finding.path?.endsWith('src/components/DoctorPage.tsx'))).toBe(true);
  });

  it('rejects shared-toolbar misuse, ambiguous destructive glyphs, and host-relative viewport sizing', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'doctor-test',
        name: 'Doctor Test',
        packageType: 'user',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
        },
      }),
    );
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `export function DoctorPage() { return <main style={{ height: 'calc(100vh - 200px)' }}><AppPageSection><DataTableToolbar searchValue=""><ToolbarButton>Refresh</ToolbarButton></DataTableToolbar><KeyValueTable columns={2}><KeyValueItem label="Engine" value="MLX" /></KeyValueTable><ResourceListItem title="Blank row" description="Hidden" active trailing={<Pill>Draft</Pill>} /><IconButton title="Delete item">✕</IconButton><div onClick={() => {}}>Clickable row</div><span aria-label="Loading\\u2026">{'Loading\\u2026'}</span></AppPageSection></main>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'invalid-data-table-toolbar-props',
        'hidden-data-table-toolbar-actions',
        'invalid-key-value-table-content',
        'invalid-resource-list-item-props',
        'ambiguous-delete-glyph',
        'host-relative-viewport-height',
        'collapsed-app-page-section',
        'escaped-unicode-ui-copy',
        'non-semantic-interactive-container',
      ]),
    );
  });

  it('rejects synchronous frontend storage reads and backend-style handling of frontend confirmations', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `export function DoctorPage({ pa }: any) {
        const stored = pa.storage.get('selected-id');
        async function remove() {
          const decision = await pa.ui.confirm({ message: 'Delete?' });
          if (!decision.confirmed) return;
        }
        void stored; void remove;
        return null;
      }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });
    const codes = report.findings.map((finding) => finding.code);

    expect(codes).toContain('unawaited-frontend-storage-read');
    expect(codes).toContain('invalid-frontend-confirm-result');
  });

  it('reports missing exports and non-portable imports with fixable findings', async () => {
    const root = createExtensionPackage();
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function WrongPage() { return null; }\n`);
    writeFileSync(join(root, 'src', 'backend.ts'), `import 'node:child_process';\nexport async function wrong() { return {}; }\n`);
    writeFileSync(join(root, 'dist', 'frontend.js'), `import '/tmp/release-only.js';\nexport function WrongPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'backend.mjs'), `import '/tmp/release-only.js';\nexport async function wrong() { return {}; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });
    const codes = report.findings.map((finding) => finding.code);

    expect(report.ok).toBe(false);
    expect(codes).toContain('missing-frontend-export');
    expect(codes).toContain('missing-backend-export');
    expect(codes).toContain('forbidden-process-import');
    expect(codes).toContain('non-portable-import');
    expect(codes).not.toContain('backend-import-failed');
  });

  it('does not execute user backend top-level code during validation', async () => {
    const root = createExtensionPackage();
    const sentinel = join(root, 'validation-side-effect.txt');
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'src', 'backend.ts'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(root, 'dist', 'backend.mjs'),
      `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'executed'); export async function ping() { return { ok: true }; }\n`,
    );
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(existsSync(sentinel)).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('forbidden-backend-runtime-import');
  });

  it('ignores forbidden API names in comments and strings but rejects dynamic host access', async () => {
    const harmlessRoot = createExtensionPackage();
    writeFileSync(join(harmlessRoot, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(harmlessRoot, 'src', 'backend.ts'),
      `// import 'node:fs'; process.env is documentation\nexport async function ping() { return { ok: true, note: "node:fs and process.env" }; }\n`,
    );
    writeFileSync(join(harmlessRoot, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(harmlessRoot, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(harmlessRoot, 'dist', 'build-manifest.json'), '{}\n');
    const harmless = await validateExtensionPackage({ packageRoot: harmlessRoot });
    expect(harmless.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining(['forbidden-process-import', 'forbidden-process-access', 'forbidden-dynamic-code']),
    );

    const dynamicRoot = createExtensionPackage();
    writeFileSync(join(dynamicRoot, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(dynamicRoot, 'src', 'backend.ts'),
      `const spec = 'node:' + 'fs'; export async function ping() { return import(spec); }\n`,
    );
    writeFileSync(join(dynamicRoot, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(dynamicRoot, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(dynamicRoot, 'dist', 'build-manifest.json'), '{}\n');
    const dynamic = await validateExtensionPackage({ packageRoot: dynamicRoot });
    expect(dynamic.findings.map((finding) => finding.code)).toContain('forbidden-dynamic-code');

    const templateRoot = createExtensionPackage();
    writeFileSync(join(templateRoot, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(templateRoot, 'src', 'backend.ts'), 'export async function ping() { return `${process.env.HOME}`; }\n');
    writeFileSync(join(templateRoot, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(templateRoot, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(templateRoot, 'dist', 'build-manifest.json'), '{}\n');
    const template = await validateExtensionPackage({ packageRoot: templateRoot });
    expect(template.findings.map((finding) => finding.code)).toContain('forbidden-process-access');

    for (const moduleName of ['electron', 'fsevents', 'esbuild', 'better-sqlite3', '@xenova/transformers']) {
      const externalRoot = createExtensionPackage();
      writeFileSync(join(externalRoot, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
      writeFileSync(
        join(externalRoot, 'src', 'backend.ts'),
        `import value from ${JSON.stringify(moduleName)}; export async function ping() { return value; }\n`,
      );
      writeFileSync(join(externalRoot, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
      writeFileSync(join(externalRoot, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
      writeFileSync(join(externalRoot, 'dist', 'build-manifest.json'), '{}\n');
      const external = await validateExtensionPackage({ packageRoot: externalRoot });
      expect(external.findings.map((finding) => finding.code)).toContain('forbidden-process-import');
    }
  });

  it('rejects missing capability permissions and dangling command actions', async () => {
    const root = createExtensionPackage();
    const manifest = JSON.parse(readFileSync(join(root, 'extension.json'), 'utf8'));
    manifest.packageType = 'user';
    manifest.contributes.commands = [{ id: 'broken', title: 'Broken', action: 'refeshItems' }];
    writeFileSync(join(root, 'extension.json'), JSON.stringify(manifest));
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(root, 'src', 'backend.ts'),
      `export async function ping(_input: unknown, ctx: any) { const value = await ctx.storage.get('value'); await ctx.storage.put('value', value); ctx.ui.invalidate(['value']); return { ok: true }; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });
    const codes = report.findings.map((finding) => finding.code);

    expect(codes.filter((code) => code === 'missing-capability-permission')).toHaveLength(3);
    expect(codes).toContain('dangling-contributed-action');
  });

  it('validates service lifecycle exports and host-view override exports', async () => {
    const root = createExtensionPackage();
    const manifest = JSON.parse(readFileSync(join(root, 'extension.json'), 'utf8'));
    manifest.packageType = 'user';
    manifest.backend.services = [{ id: 'sync', handler: 'startSync', stopHandler: 'stopSync', worker: { enabled: true } }];
    manifest.contributes.views = [
      {
        id: 'page',
        title: 'Doctor Test',
        location: 'main',
        route: '/ext/doctor-test',
        component: { host: 'conversation.page', overrides: { wrapper: 'MissingOverride' } },
      },
    ];
    writeFileSync(join(root, 'extension.json'), JSON.stringify(manifest));
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function PresentOverride() { return null; }\n`);
    writeFileSync(
      join(root, 'src', 'backend.ts'),
      `export async function ping() { return { ok: true }; } export async function startSync() { return { started: true }; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function PresentOverride() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });
    const messages = report.findings.map((finding) => finding.message).join('\n');

    expect(messages).toContain('stopHandler "stopSync"');
    expect(messages).toContain('requires permission "network:listen"');
    expect(messages).toContain('Frontend component "MissingOverride"');
  });

  it('requires source-backed backend entries to have a built runtime bundle', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'doctor-test',
          name: 'Doctor Test',
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          backend: { entry: 'src/backend.ts', actions: [{ id: 'ping', handler: 'ping', title: 'Ping', worker: { enabled: true } }] },
          contributes: {
            views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'src', 'backend.ts'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('missing-backend-dist');
  });

  it('treats stale system extension dist as an error', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'doctor-test',
          name: 'Doctor Test',
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping', title: 'Ping', worker: { enabled: true } }] },
          contributes: {
            views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'src', 'backend.ts'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    utimesSync(join(root, 'dist', 'frontend.js'), oldDate, oldDate);
    utimesSync(join(root, 'dist', 'backend.mjs'), oldDate, oldDate);

    const report = await validateExtensionPackage({ packageRoot: root });
    const codes = report.findings.map((finding) => finding.code);

    expect(report.ok).toBe(false);
    expect(codes).toContain('stale-frontend-dist');
    expect(codes).toContain('stale-backend-dist');
  });

  it('reports frontend use of the removed pa.actions client', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'src', 'frontend.tsx'),
      `export function DoctorPage({ pa }) { void pa.actions.call('ping', {}); return null; }\n`,
    );
    writeFileSync(join(root, 'src', 'backend.ts'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(
      join(root, 'dist', 'frontend.js'),
      `export function DoctorPage({ pa }) { void pa.actions.call('ping', {}); return null; }\n`,
    );
    writeFileSync(join(root, 'dist', 'backend.mjs'), `export async function ping() { return { ok: true }; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('deprecated-frontend-action-client');
  });

  it('reports backend entries that are missing worker enablement', async () => {
    const root = createExtensionPackage();
    writeFileSync(
      join(root, 'extension.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          id: 'doctor-test',
          name: 'Doctor Test',
          version: '0.1.0',
          frontend: { entry: 'dist/frontend.js' },
          backend: {
            entry: 'dist/backend.mjs',
            actions: [{ id: 'ping', handler: 'ping', title: 'Ping' }],
            routes: [{ method: 'GET', path: '/ping', handler: 'pingRoute' }],
            services: [{ id: 'sync', handler: 'startSync' }],
          },
          contributes: {
            views: [{ id: 'page', title: 'Doctor Test', location: 'main', route: '/ext/doctor-test', component: 'DoctorPage' }],
          },
          permissions: [],
        },
        null,
        2,
      ),
    );
    writeFileSync(join(root, 'src', 'frontend.tsx'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(root, 'src', 'backend.ts'),
      `export async function ping() { return { ok: true }; }\nexport async function pingRoute() { return { ok: true }; }\nexport async function startSync() { return { ok: true }; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(
      join(root, 'dist', 'backend.mjs'),
      `export async function ping() { return { ok: true }; }\nexport async function pingRoute() { return { ok: true }; }\nexport async function startSync() { return { ok: true }; }\n`,
    );
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.ok).toBe(false);
    expect(report.findings.filter((finding) => finding.code === 'missing-worker-enabled')).toHaveLength(3);
  });
});
