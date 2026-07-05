import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkPackagedNativeRuntime } from './scripts/check-packaged-native-runtime.mjs';
import { defaultInstallableBundleNames } from './scripts/default-installable-extensions.mjs';

const DEFAULT_DESKTOP_RELEASE_REPO_SLUG = 'patleeman/neon-pilot';

function resolveDesktopReleaseRepoSlug(value = process.env.NEON_PILOT_RELEASE_REPO) {
  const normalizedValue = value?.trim() || DEFAULT_DESKTOP_RELEASE_REPO_SLUG;
  const parts = normalizedValue
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length !== 2) {
    return DEFAULT_DESKTOP_RELEASE_REPO_SLUG;
  }

  return `${parts[0]}/${parts[1]}`;
}

export const DESKTOP_RELEASE_REPO_SLUG = resolveDesktopReleaseRepoSlug();
const [DESKTOP_RELEASE_REPO_OWNER, DESKTOP_RELEASE_REPO_NAME] = DESKTOP_RELEASE_REPO_SLUG.split('/', 2);

function optionalExtraResource(resource) {
  return existsSync(resource.from) ? [resource] : [];
}

const packagedExtensionFilter = [
  '*/extension.json',
  '*/README.md',
  '*/package.json',
  '*/dist/**/*',
  '*/src/**/*',
  '*/skills/**/*',
  '*/docs/**/*',
  '*/assets/**/*',
  '!**/*.map',
  '!**/src/**/*.test.*',
];
const defaultInstallableExtensionFilter = ['system-browser', 'system-onboarding'].flatMap((id) =>
  packagedExtensionFilter.map((entry) => `${id}/${entry.replace(/^\*\//u, '')}`),
);

function readDesktopPackageVersion() {
  const packageJson = JSON.parse(readFileSync(resolve('packages/desktop/package.json'), 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
}

export function isRcDesktopVersion(version = readDesktopPackageVersion()) {
  return /-rc(?:\.|$)/iu.test(version);
}

export function resolveDesktopReleaseIdentity(version = readDesktopPackageVersion()) {
  const isRc = isRcDesktopVersion(version);
  return {
    appId: isRc ? 'com.neon-pilot.desktop.rc' : 'com.neon-pilot.desktop',
    artifactPrefix: isRc ? 'Neon-Pilot-RC' : 'Neon-Pilot',
    productName: isRc ? 'Neon Pilot RC' : 'Neon Pilot',
  };
}

export const desktopReleaseIdentity = resolveDesktopReleaseIdentity();

export const desktopReleasePublishConfig = {
  provider: 'github',
  owner: DESKTOP_RELEASE_REPO_OWNER,
  repo: DESKTOP_RELEASE_REPO_NAME,
  releaseType: 'release',
};

const electronBuilderConfig = {
  appId: desktopReleaseIdentity.appId,
  productName: desktopReleaseIdentity.productName,
  async afterPack(context) {
    if (context.electronPlatformName !== 'darwin') {
      return;
    }

    const appName = `${context.packager.appInfo.productFilename}.app`;
    const appPath = resolve(context.appOutDir, appName);
    const result = await checkPackagedNativeRuntime(appPath);
    if (!result.ok) {
      throw new Error(`Packaged native runtime check failed:\n${result.failures.join('\n')}`);
    }
  },
  directories: {
    app: 'packages/desktop',
    output: 'dist/release',
  },
  files: [
    'dist/**/*.js',
    'dist/**/*.cjs',
    '!dist/**/*.test.js',
    '!dist/mac{,/**/*}',
    'ui/dist/**/*',
    'server/dist/**/*',
    'server/extensions/backendApi/*.ts',
    'assets/**/*',
    '!ui/src{,/**/*}',
    '!server/src{,/**/*}',
    '!server/app{,/**/*}',
    '!ui/tsconfig*.json',
    '!ui/vite.config.ts',
    '!ui/postcss.config.js',
    '!ui/tailwind.config.js',
    // Exclude all node_modules — esbuild/Vite bundle everything except the explicit
    // runtime externals listed below. Shipping the raw node_modules tree is wasteful
    // because those packages are already inlined into the server and UI bundles.
    '!node_modules{,/**/*}',
    // ajv runtime modules: ajv uses code-generation (tagged template literals) that
    // emit require("ajv/dist/runtime/...") strings executed at runtime via the CJS
    // require shim. They cannot be statically bundled by esbuild.
    'node_modules/ajv{,/**/*}',
    'node_modules/ajv-formats{,/**/*}',
    // Native modules and their loader helpers (must remain on-disk, handled by asarUnpack).
    'node_modules/@ffmpeg-installer/darwin-arm64{,/**/*}',
    'node_modules/@ffmpeg-installer/ffmpeg{,/**/*}',
    'node_modules/@silvia-odwyer/photon-node{,/**/*}',
    'node_modules/@whisper-cpp-node/darwin-arm64{,/**/*}',
    'node_modules/better-sqlite3{,/**/*}',
    'node_modules/bindings{,/**/*}',
    'node_modules/file-uri-to-path{,/**/*}',
    'node_modules/node-pty{,/**/*}',
    'node_modules/whisper-cpp-node{,/**/*}',
    'node_modules/fsevents{,/**/*}',
    // @earendil-works/pi-coding-agent is imported dynamically at runtime by the
    // extension host child (serverModuleResolver resolves the bare specifier to
    // app.asar.unpacked/node_modules/...). esbuild inlines the static import
    // graph, but the dynamic import('@/earendil-works/pi-coding-agent') call
    // site survives bundling and requires the real package — plus its sibling
    // packages (pi-agent-core, pi-ai, pi-tui), which pi-coding-agent imports
    // internally — on disk outside app.asar. Without this, Node throws
    // "Cannot find package '@earendil-works/pi-coding-agent'" in packaged builds.
    'node_modules/@earendil-works/pi-agent-core{,/**/*}',
    'node_modules/@earendil-works/pi-ai{,/**/*}',
    'node_modules/@earendil-works/pi-coding-agent{,/**/*}',
    'node_modules/@earendil-works/pi-tui{,/**/*}',
  ],
  asarUnpack: [
    'server/dist/conversations/conversationInspectWorker.js',
    // Extension backends import selected desktop server modules dynamically at
    // runtime. Those imports run from extension-hosted code, so keep the server
    // extension modules addressable as real files outside app.asar.
    'server/dist/extensions/**/*.js',
    // Shared chunks may be imported by the unpacked conversationInspectWorker thread.
    'server/dist/chunks/**/*',
    'node_modules/@ffmpeg-installer/darwin-arm64/**/*',
    'node_modules/@ffmpeg-installer/ffmpeg/**/*',
    'node_modules/@silvia-odwyer/photon-node/**/*',
    'node_modules/@whisper-cpp-node/darwin-arm64/**/*',
    'node_modules/better-sqlite3/**/*',
    'node_modules/bindings/**/*',
    'node_modules/file-uri-to-path/**/*',
    'node_modules/node-pty/**/*',
    'node_modules/whisper-cpp-node/**/*',
    // Extract the @earendil-works scope so the extension host's dynamic
    // import('@earendil-works/pi-coding-agent') resolves from real files.
    // See the matching `files` entries above for why this is required.
    'node_modules/@earendil-works/pi-agent-core/**/*',
    'node_modules/@earendil-works/pi-ai/**/*',
    'node_modules/@earendil-works/pi-coding-agent/**/*',
    'node_modules/@earendil-works/pi-tui/**/*',
  ],
  extraMetadata: {
    main: './dist/main.js',
  },
  electronUpdaterCompatibility: '>=2.16',
  publish: desktopReleasePublishConfig,
  icon: 'packages/desktop/assets/icon.png',
  extraResources: [
    ...optionalExtraResource({
      from: 'defaults',
      to: 'defaults',
    }),
    {
      from: 'extensions',
      to: 'extensions',
      filter: packagedExtensionFilter,
    },
    {
      from: 'installable-extensions',
      to: 'default-installable-extensions',
      filter: defaultInstallableExtensionFilter,
    },
    {
      from: 'dist/installable-extensions',
      to: 'installable-extension-bundles',
      filter: defaultInstallableBundleNames,
    },
    {
      from: 'docs',
      to: 'docs',
    },
    ...optionalExtraResource({
      from: 'prompt-catalog',
      to: 'prompt-catalog',
    }),
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'packages/desktop/assets/icon.icns',
    hardenedRuntime: true,
    notarize: false,
    entitlements: 'apps/mac/entitlements.mac.plist',
    entitlementsInherit: 'apps/mac/entitlements.mac.inherit.plist',
    extendInfo: {
      LSUIElement: true,
      NSMicrophoneUsageDescription: 'Neon Pilot uses the microphone to capture composer dictation.',
    },
    target: [
      {
        target: 'dmg',
        arch: ['arm64'],
      },
      {
        target: 'zip',
        arch: ['arm64'],
      },
    ],
    artifactName: `${desktopReleaseIdentity.artifactPrefix}-\${version}-mac-\${arch}.\${ext}`,
  },
};

export default electronBuilderConfig;
