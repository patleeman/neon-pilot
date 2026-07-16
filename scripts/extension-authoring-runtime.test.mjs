import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import electronBuilderConfig from '../electron-builder.config.mjs';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const roots = [];
const makeRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-authoring-runtime-'));
  roots.push(root);
  mkdirSync(join(root, 'src'), { recursive: true });
  return root;
};
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const runBuilder = (root) =>
  spawnSync(process.execPath, [join(repoRoot, 'dist/extension-authoring/scripts/extension-build.mjs'), root], {
    cwd: root,
    encoding: 'utf8',
  });

beforeAll(() => execFileSync(process.execPath, ['scripts/build-extension-authoring-runtime.mjs'], { cwd: repoRoot }));
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('packaged extension authoring runtime', () => {
  it('packages declarations only for APIs accepted by the bundled builder', () => {
    const sdkResource = electronBuilderConfig.extraResources.find(
      (entry) => entry?.to === 'extensions/system-extension-manager/skills/local-extension-development/references/sdk',
    );
    expect(sdkResource).toBeTruthy();
    expect(sdkResource.filter).toContain('index.d.ts');
    expect(sdkResource.filter).toContain('ui.d.ts');
    expect(sdkResource.filter).toContain('backend/extensions.d.ts');
    expect(sdkResource.filter).not.toContain('backend/desktop.d.ts');
    expect(sdkResource.filter).not.toContain('backend/network.d.ts');
    expect(sdkResource.filter).not.toContain('backend/personaName.d.ts');
    expect(sdkResource.filter).not.toContain('backend/documents-store.d.ts');
  });
  it('rejects manifest entries outside dist without touching the escaped path', () => {
    const root = makeRoot();
    const escaped = join(root, '..', 'escaped-frontend.js');
    writeFileSync(escaped, 'sentinel');
    writeFileSync(join(root, 'src/frontend.tsx'), 'export function ExtensionPage() { return null; }\n');
    writeJson(join(root, 'extension.json'), {
      schemaVersion: 2,
      id: 'unsafe-output',
      packageType: 'user',
      frontend: { entry: '../escaped-frontend.js' },
    });

    const result = runBuilder(root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('relative path under dist');
    expect(readFileSync(escaped, 'utf8')).toBe('sentinel');
    rmSync(escaped, { force: true });
  });

  it('builds the public UI facade but rejects private backend shims', () => {
    const uiRoot = makeRoot();
    writeFileSync(
      join(uiRoot, 'src/frontend.tsx'),
      "import { ContextRail, DataTableToolbar } from '@neon-pilot/extensions/ui'; export function ExtensionPage() { return <ContextRail><DataTableToolbar /></ContextRail>; }\n",
    );
    writeJson(join(uiRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'public-ui',
      packageType: 'user',
      frontend: { entry: 'dist/frontend.js' },
    });
    expect(runBuilder(uiRoot).status).toBe(0);
    expect(existsSync(join(uiRoot, 'dist/frontend.js'))).toBe(true);

    const backendRoot = makeRoot();
    writeFileSync(
      join(backendRoot, 'src/backend.ts'),
      "import { callServerModuleExport } from '@neon-pilot/extensions/backend/serverModuleResolver'; export async function ping() { return callServerModuleExport('x', 'y', []); }\n",
    );
    writeJson(join(backendRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'private-backend',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    const result = runBuilder(backendRoot);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('is not a public extension backend API');
  });

  it('does not execute Cargo build scripts from installed-app authoring', () => {
    const root = makeRoot();
    const fakeBin = join(root, 'fake-bin');
    const marker = join(root, 'cargo-executed');
    mkdirSync(join(root, 'sidecar'), { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(join(root, 'sidecar/Cargo.toml'), '[package]\nname = "unsafe-sidecar"\nversion = "0.1.0"\n');
    writeFileSync(join(fakeBin, 'cargo'), `#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`);
    execFileSync('chmod', ['+x', join(fakeBin, 'cargo')]);
    writeJson(join(root, 'extension.json'), { schemaVersion: 2, id: 'unsafe-sidecar', packageType: 'user' });

    const result = spawnSync(process.execPath, [join(repoRoot, 'dist/extension-authoring/scripts/extension-build.mjs'), root], {
      cwd: root,
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Native sidecars cannot be built from the installed app');
    expect(existsSync(marker)).toBe(false);
  });
});
