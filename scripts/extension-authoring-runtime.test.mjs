import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
    const desktopUiFacade = readFileSync(join(repoRoot, 'packages/desktop/ui/src/extensions/ui.ts'), 'utf8');
    const sharedPrimitiveStart = desktopUiFacade.indexOf('export {\n  AppPageEmptyState');
    const sharedPrimitiveEnd = desktopUiFacade.indexOf("} from '../components/ui';", sharedPrimitiveStart);
    const sharedRuntimeExports = desktopUiFacade
      .slice(sharedPrimitiveStart + 'export {'.length, sharedPrimitiveEnd)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry && !entry.startsWith('type '));
    const publicUiDeclarations = readFileSync(join(repoRoot, 'packages/extensions/dist/ui.d.ts'), 'utf8');
    for (const component of sharedRuntimeExports) {
      expect(publicUiDeclarations).toMatch(new RegExp(`export declare (?:const|function) ${component}\\b`, 'u'));
    }
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

  it('blocks user backends from host process modules and package-escape imports', () => {
    const safeRoot = makeRoot();
    writeFileSync(join(safeRoot, 'src/backend.ts'), 'export async function ping() { return { ok: true }; }\n');
    writeJson(join(safeRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'safe-backend',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    expect(runBuilder(safeRoot).status).toBe(0);
    expect(readFileSync(join(safeRoot, 'dist/backend.mjs'), 'utf8')).not.toContain('node:module');

    const fsRoot = makeRoot();
    writeFileSync(
      join(fsRoot, 'src/backend.ts'),
      "import { readFileSync } from 'node:fs'; export async function ping() { return readFileSync('/tmp/secret', 'utf8'); }\n",
    );
    writeJson(join(fsRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'unsafe-fs',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    const fsResult = runBuilder(fsRoot);
    expect(fsResult.status).not.toBe(0);
    expect(`${fsResult.stdout}${fsResult.stderr}`).toContain('cannot import node:fs');

    const escapeRoot = makeRoot();
    const secret = join(escapeRoot, '..', `extension-builder-secret-${Date.now()}.json`);
    writeFileSync(secret, '{"secret":"must-not-bundle"}\n');
    writeFileSync(
      join(escapeRoot, 'src/backend.ts'),
      `import secret from ${JSON.stringify(`../../${secret.split('/').pop()}`)}; export async function ping() { return secret; }\n`,
    );
    writeJson(join(escapeRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'unsafe-escape',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    const escapeResult = runBuilder(escapeRoot);
    expect(escapeResult.status).not.toBe(0);
    expect(`${escapeResult.stdout}${escapeResult.stderr}`).toContain('escapes its package');
    expect(existsSync(join(escapeRoot, 'dist/backend.mjs'))).toBe(false);
    rmSync(secret, { force: true });

    const cssRoot = makeRoot();
    const cssSecret = join(cssRoot, '..', `extension-builder-secret-${Date.now()}.css`);
    writeFileSync(cssSecret, '.leaked-secret { color: red; }\n');
    writeFileSync(
      join(cssRoot, 'src/frontend.tsx'),
      `import secretCss from ${JSON.stringify(`${cssSecret}?raw`)}; export function ExtensionPage() { return <style>{secretCss}</style>; }\n`,
    );
    writeJson(join(cssRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'unsafe-css-escape',
      packageType: 'user',
      frontend: { entry: 'dist/frontend.js' },
    });
    const cssResult = runBuilder(cssRoot);
    expect(cssResult.status).not.toBe(0);
    expect(`${cssResult.stdout}${cssResult.stderr}`).toContain('raw CSS import escapes');
    expect(existsSync(join(cssRoot, 'dist/frontend.js'))).toBe(false);
    rmSync(cssSecret, { force: true });
  });

  it('rejects webapp escapes, package symlinks, and untrusted sibling node_modules', () => {
    const webappRoot = makeRoot();
    const webappSecret = join(webappRoot, '..', `webapp-secret-${Date.now()}.json`);
    mkdirSync(join(webappRoot, 'webapp'), { recursive: true });
    writeFileSync(webappSecret, '{"secret":"must-not-bundle"}\n');
    writeFileSync(join(webappRoot, 'webapp/app.ts'), `import secret from ${JSON.stringify(webappSecret)}; console.log(secret);\n`);
    writeJson(join(webappRoot, 'extension.json'), { schemaVersion: 2, id: 'unsafe-webapp', packageType: 'user' });
    const webappResult = runBuilder(webappRoot);
    expect(webappResult.status).not.toBe(0);
    expect(`${webappResult.stdout}${webappResult.stderr}`).toContain('webapp import escapes');
    rmSync(webappSecret, { force: true });

    const symlinkRoot = makeRoot();
    const linkedSecret = join(symlinkRoot, '..', `linked-secret-${Date.now()}.txt`);
    mkdirSync(join(symlinkRoot, 'templates'), { recursive: true });
    writeFileSync(linkedSecret, 'must-not-copy');
    symlinkSync(linkedSecret, join(symlinkRoot, 'templates/secret.txt'));
    writeJson(join(symlinkRoot, 'extension.json'), { schemaVersion: 2, id: 'unsafe-link', packageType: 'user' });
    const symlinkResult = runBuilder(symlinkRoot);
    expect(symlinkResult.status).not.toBe(0);
    expect(`${symlinkResult.stdout}${symlinkResult.stderr}`).toContain('cannot contain symbolic links');
    rmSync(linkedSecret, { force: true });

    const dependencyRoot = makeRoot();
    const siblingNodeModules = join(dependencyRoot, '..', `untrusted-${Date.now()}`, 'node_modules', 'private-package');
    mkdirSync(siblingNodeModules, { recursive: true });
    writeFileSync(join(siblingNodeModules, 'index.js'), 'export default "must-not-bundle";\n');
    writeFileSync(
      join(dependencyRoot, 'src/frontend.tsx'),
      `import secret from ${JSON.stringify(join(siblingNodeModules, 'index.js'))}; export function ExtensionPage() { return <div>{secret}</div>; }\n`,
    );
    writeJson(join(dependencyRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'unsafe-node-modules',
      packageType: 'user',
      frontend: { entry: 'dist/frontend.js' },
    });
    const dependencyResult = runBuilder(dependencyRoot);
    expect(dependencyResult.status).not.toBe(0);
    expect(`${dependencyResult.stdout}${dependencyResult.stderr}`).toContain('escapes its package');
    rmSync(join(siblingNodeModules, '..', '..'), { recursive: true, force: true });
  });

  it('ignores harmless process text but rejects dynamic host access in user backends', () => {
    const harmlessRoot = makeRoot();
    writeFileSync(
      join(harmlessRoot, 'src/backend.ts'),
      `// process.env and node:fs are documentation only\nexport async function ping() { return { ok: true, note: "process.env and node:fs" }; }\n`,
    );
    writeJson(join(harmlessRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'harmless-text',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    expect(runBuilder(harmlessRoot).status).toBe(0);

    const dynamicRoot = makeRoot();
    writeFileSync(
      join(dynamicRoot, 'src/backend.ts'),
      `const spec = 'node:' + 'fs'; export async function ping() { return import(spec); }\n`,
    );
    writeJson(join(dynamicRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'dynamic-host-access',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    const result = runBuilder(dynamicRoot);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('cannot use dynamic code');

    const templateRoot = makeRoot();
    writeFileSync(join(templateRoot, 'src/backend.ts'), 'export async function ping() { return `${process.env.HOME}`; }\n');
    writeJson(join(templateRoot, 'extension.json'), {
      schemaVersion: 2,
      id: 'template-host-access',
      packageType: 'user',
      backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
    });
    const templateResult = runBuilder(templateRoot);
    expect(templateResult.status).not.toBe(0);
    expect(`${templateResult.stdout}${templateResult.stderr}`).toContain('cannot access the host process');

    for (const moduleName of ['electron', 'fsevents', 'esbuild', 'better-sqlite3', '@xenova/transformers']) {
      const externalRoot = makeRoot();
      writeFileSync(
        join(externalRoot, 'src/backend.ts'),
        `import value from ${JSON.stringify(moduleName)}; export async function ping() { return value; }\n`,
      );
      writeJson(join(externalRoot, 'extension.json'), {
        schemaVersion: 2,
        id: `host-external-${moduleName.replace(/[^a-z]+/gu, '-')}`,
        packageType: 'user',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
      });
      const externalResult = runBuilder(externalRoot);
      expect(externalResult.status).not.toBe(0);
      expect(`${externalResult.stdout}${externalResult.stderr}`).toMatch(/cannot import|Could not resolve/u);
    }
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
