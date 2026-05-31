import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    'node_modules/better-sqlite3{,/**/*}',
    'node_modules/bindings{,/**/*}',
    'node_modules/file-uri-to-path{,/**/*}',
    'node_modules/node-pty{,/**/*}',
    'node_modules/fsevents{,/**/*}',
  ],
  asarUnpack: [
    'server/dist/conversations/conversationInspectWorker.js',
    // Extension backends import selected desktop server modules dynamically at
    // runtime. Those imports run from extension-hosted code, so keep the server
    // extension modules addressable as real files outside app.asar.
    'server/dist/extensions/**/*.js',
    // Shared chunks may be imported by the unpacked conversationInspectWorker thread.
    'server/dist/chunks/**/*',
    'node_modules/better-sqlite3/**/*',
    'node_modules/bindings/**/*',
    'node_modules/file-uri-to-path/**/*',
    'node_modules/node-pty/**/*',
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
      from: 'docs',
      to: 'docs',
    },
    ...optionalExtraResource({
      from: 'prompt-catalog',
      to: 'prompt-catalog',
    }),
    ...optionalExtraResource({
      from: 'node_modules/whisper-cpp-node',
      to: 'node_modules/whisper-cpp-node',
    }),
    ...optionalExtraResource({
      from: 'node_modules/@whisper-cpp-node',
      to: 'node_modules/@whisper-cpp-node',
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
