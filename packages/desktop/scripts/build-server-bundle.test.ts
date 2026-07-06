import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error electron-builder config is plain ESM, not typed TS.
import electronBuilderConfig from '../../../electron-builder.config.mjs';

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8');
}

function extractLazyServerModuleSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const regex = /call(?:Server)?ModuleExport(?:<[^>]+>)?\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    specifiers.add(match[1]);
  }
  return [...specifiers].sort();
}

function extractLazyServerExtensionModuleSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const regex = /importServerExtensionModule(?:<[^>]+>)?\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    specifiers.add(match[1]);
  }
  return [...specifiers].sort();
}

function normalizeLazySpecifier(specifier: string): string {
  return specifier.replace(/^\.\.\/\.\.\//, '').replace(/^\.\.\//, '');
}

function normalizeServerExtensionSpecifier(specifier: string): string {
  return specifier.replace(/^\.\.\//, 'extensions/').replace(/^\/+/, '');
}

describe('desktop server bundle lazy module entries', () => {
  it('builds the packaged protocol CLI entry used by state-root launchers', () => {
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');

    expect(buildScript).toContain("resolve(outdir, 'protocolCli.js')");
    expect(buildScript).toContain("entryPoints: [resolve(packageRoot, 'server/protocolCli.ts')]");
  });

  it('externalizes the Photon image runtime so packaged read tools can load it from disk', () => {
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');

    expect(buildScript).toContain("'@silvia-odwyer/photon-node'");
  });

  it('packages pi-coding-agent export HTML assets beside app chunks', () => {
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');

    expect(buildScript).toContain("resolve(piCodingAgentRoot, 'dist/core/export-html')");
    expect(buildScript).toContain("resolve(piCodingAgentRoot, 'dist/modes/interactive/theme')");
    expect(buildScript).toContain("resolve(outdir, 'app', 'chunks', 'dist', 'core', 'export-html')");
    expect(buildScript).toContain("resolve(outdir, 'app', 'chunks', 'dist', 'modes', 'interactive', 'theme')");
    expect(buildScript).toContain('cpSync(piCodingAgentExportHtml, bundledAppChunkExportHtml, { recursive: true })');
    expect(buildScript).toContain('cpSync(piCodingAgentInteractiveTheme, bundledAppChunkInteractiveTheme, { recursive: true })');
  });

  it('packages every relative backend API lazy module used by extension wrappers', () => {
    const backendApiFiles = [
      'audio.ts',
      'automations.ts',
      'desktop.ts',
      'documents.ts',
      'events.ts',
      'images.ts',
      'knowledge.ts',
      'transcription.ts',
      'videos.ts',
    ].map((file) => `packages/desktop/server/extensions/backendApi/${file}`);
    const lazyModuleSpecifiers = backendApiFiles.flatMap((path) => extractLazyServerModuleSpecifiers(readRepoFile(path)));
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');

    const missing = lazyModuleSpecifiers.map(normalizeLazySpecifier).filter((distPath) => !buildScript.includes(`['${distPath}',`));

    expect(missing).toEqual([]);
  });

  it('builds and unpacks every server extension module imported by extension-host backend APIs', () => {
    const backendApiFiles = ['extensions.ts'].map((file) => `packages/desktop/server/extensions/backendApi/${file}`);
    const lazyModuleSpecifiers = backendApiFiles.flatMap((path) => extractLazyServerExtensionModuleSpecifiers(readRepoFile(path)));
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');
    const distPaths = lazyModuleSpecifiers.map(normalizeServerExtensionSpecifier);

    const missingBuildEntries = distPaths.filter((distPath) => !buildScript.includes(`['${distPath}',`));
    const unpackPatterns = electronBuilderConfig.asarUnpack as string[];
    const missingUnpackEntries = distPaths.filter((distPath) => {
      const packagedPath = `server/dist/${distPath}`;
      return !unpackPatterns.some((pattern) => pattern === packagedPath || pattern === 'server/dist/extensions/**/*.js');
    });

    expect(missingBuildEntries).toEqual([]);
    expect(missingUnpackEntries).toEqual([]);
  });
});
