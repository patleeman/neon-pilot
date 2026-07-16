import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
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
      `export function DoctorPage() { return <main style={{ height: 'calc(100vh - 200px)' }}><AppPageSection><DataTableToolbar searchValue=""><ToolbarButton>Refresh</ToolbarButton></DataTableToolbar><ResourceListItem title="Blank row" description="Hidden" active trailing={<Pill>Draft</Pill>} /><IconButton title="Delete item">✕</IconButton><div onClick={() => {}}>Clickable row</div><span aria-label="Loading\\u2026">{'Loading\\u2026'}</span></AppPageSection></main>; }\n`,
    );
    writeFileSync(join(root, 'dist', 'frontend.js'), `export function DoctorPage() { return null; }\n`);
    writeFileSync(join(root, 'dist', 'build-manifest.json'), '{}\n');

    const report = await validateExtensionPackage({ packageRoot: root });

    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'invalid-data-table-toolbar-props',
        'hidden-data-table-toolbar-actions',
        'invalid-resource-list-item-props',
        'ambiguous-delete-glyph',
        'host-relative-viewport-height',
        'collapsed-app-page-section',
        'escaped-unicode-ui-copy',
        'non-semantic-interactive-container',
      ]),
    );
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
    expect(codes).toContain('backend-import-failed');
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
