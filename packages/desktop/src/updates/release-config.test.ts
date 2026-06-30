import { describe, expect, it } from 'vitest';

// @ts-expect-error electron-builder config is plain ESM, not typed TS.
import electronBuilderConfig, {
  desktopReleaseIdentity,
  desktopReleasePublishConfig,
  resolveDesktopReleaseIdentity,
} from '../../../../electron-builder.config.mjs';
import {
  buildDesktopReleaseAssetName,
  buildDesktopReleasePageUrl,
  buildDesktopReleaseTag,
  DESKTOP_RELEASE_REPO_NAME,
  DESKTOP_RELEASE_REPO_OWNER,
  DESKTOP_RELEASE_REPO_SLUG,
  isRcDesktopReleaseVersion,
  resolveDesktopReleaseArtifactPrefix,
} from './release-config.js';

describe('desktop release config', () => {
  it('uses the public release-only repository', () => {
    expect(DESKTOP_RELEASE_REPO_SLUG).toBe('patleeman/neon-pilot');
    expect(buildDesktopReleasePageUrl('0.1.14')).toBe('https://github.com/patleeman/neon-pilot/releases/tag/v0.1.14');
  });

  it('keeps the packaged updater feed pointed at the same release repo', () => {
    expect(desktopReleasePublishConfig).toMatchObject({
      provider: 'github',
      owner: DESKTOP_RELEASE_REPO_OWNER,
      repo: DESKTOP_RELEASE_REPO_NAME,
      releaseType: 'release',
    });
  });

  it('packages agent-readable docs and extension packages as filesystem resources', () => {
    expect(electronBuilderConfig.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'docs', to: 'docs' }),
        expect.objectContaining({ from: 'extensions', to: 'extensions' }),
      ]),
    );
  });

  it('packages and unpacks native backend dependencies together', () => {
    expect(typeof electronBuilderConfig.afterPack).toBe('function');
    expect(electronBuilderConfig.files).toEqual(
      expect.arrayContaining([
        'node_modules/@ffmpeg-installer/darwin-arm64{,/**/*}',
        'node_modules/@ffmpeg-installer/ffmpeg{,/**/*}',
        'node_modules/better-sqlite3{,/**/*}',
        'node_modules/@silvia-odwyer/photon-node{,/**/*}',
        'node_modules/bindings{,/**/*}',
        'node_modules/file-uri-to-path{,/**/*}',
        'node_modules/node-pty{,/**/*}',
      ]),
    );
    expect(electronBuilderConfig.asarUnpack).toEqual(
      expect.arrayContaining([
        'node_modules/@ffmpeg-installer/darwin-arm64/**/*',
        'node_modules/@ffmpeg-installer/ffmpeg/**/*',
        'node_modules/better-sqlite3/**/*',
        'node_modules/@silvia-odwyer/photon-node/**/*',
        'node_modules/bindings/**/*',
        'node_modules/file-uri-to-path/**/*',
        'node_modules/node-pty/**/*',
      ]),
    );
  });

  it('packages and unpacks the @earendil-works runtime-externalized packages together', () => {
    // The extension host child dynamically imports '@earendil-works/pi-coding-agent'
    // (the bare specifier survives esbuild bundling) and serverModuleResolver
    // resolves it to app.asar.unpacked/node_modules/@earendil-works/... at
    // runtime. pi-coding-agent also imports its sibling packages
    // (pi-agent-core, pi-ai, pi-tui) internally, so the whole scope must be
    // shipped as real files outside app.asar. Without this pairing, the
    // packaged app throws "Cannot find package '@earendil-works/pi-coding-agent'"
    // on the first dynamic import in the extension host.
    const earendilWorksPackages = ['pi-agent-core', 'pi-ai', 'pi-coding-agent', 'pi-tui'];

    expect(electronBuilderConfig.files).toEqual(
      expect.arrayContaining(earendilWorksPackages.map((name) => `node_modules/@earendil-works/${name}{,/**/*}`)),
    );
    expect(electronBuilderConfig.asarUnpack).toEqual(
      expect.arrayContaining(earendilWorksPackages.map((name) => `node_modules/@earendil-works/${name}/**/*`)),
    );
  });

  it('does not treat the local sharp stub as a native module', () => {
    expect(electronBuilderConfig.asarUnpack).not.toContain('node_modules/sharp/**/*');
  });

  it('normalizes version tags and asset names for updater artifacts', () => {
    expect(buildDesktopReleaseTag('v0.1.14')).toBe('v0.1.14');
    expect(buildDesktopReleaseAssetName({ version: 'v0.1.14', ext: 'zip' })).toBe('Neon-Pilot-0.1.14-mac-arm64.zip');
    expect(buildDesktopReleaseAssetName({ version: '0.1.14', ext: 'zip.blockmap' })).toBe('Neon-Pilot-0.1.14-mac-arm64.zip.blockmap');
  });

  it('uses a separate app identity and artifact prefix for RC releases', () => {
    expect(isRcDesktopReleaseVersion('0.7.9-rc.10')).toBe(true);
    expect(resolveDesktopReleaseArtifactPrefix('0.7.9-rc.10')).toBe('Neon-Pilot-RC');
    expect(buildDesktopReleaseAssetName({ version: 'v0.7.9-rc.10', ext: 'zip' })).toBe('Neon-Pilot-RC-0.7.9-rc.10-mac-arm64.zip');
    expect(resolveDesktopReleaseIdentity('0.7.9-rc.10')).toEqual({
      appId: 'com.neon-pilot.desktop.rc',
      artifactPrefix: 'Neon-Pilot-RC',
      productName: 'Neon Pilot RC',
    });
  });

  it('keeps stable releases on the stable app identity', () => {
    expect(resolveDesktopReleaseIdentity('0.7.9')).toEqual({
      appId: 'com.neon-pilot.desktop',
      artifactPrefix: 'Neon-Pilot',
      productName: 'Neon Pilot',
    });
  });

  it('configures the current package version with the matching release identity', () => {
    expect(electronBuilderConfig.appId).toBe(desktopReleaseIdentity.appId);
    expect(electronBuilderConfig.productName).toBe(desktopReleaseIdentity.productName);
    expect(electronBuilderConfig.mac?.artifactName).toBe(`${desktopReleaseIdentity.artifactPrefix}-\${version}-mac-\${arch}.\${ext}`);
  });
});
