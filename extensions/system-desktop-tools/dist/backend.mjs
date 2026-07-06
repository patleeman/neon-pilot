import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// packages/desktop/server/extensions/backendApi/serverModuleResolver.ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
var dynamicImport = (specifier) => import(specifier);
function normalizeServerModuleSpecifier(relativeSpecifier) {
  return relativeSpecifier.replace(/^\.\.\/\.\.\//, "").replace(/^\/+/, "");
}
function packageEntryCandidates(specifier, resourcesPath) {
  const repoRoots = [process.env.NEON_PILOT_REPO_ROOT, process.cwd()].filter((value) => Boolean(value));
  const desktopRoots = repoRoots.flatMap((root) => [resolve(root, "packages/desktop"), root]);
  const candidates = [];
  const pushRepoPath = (relativePath) => {
    for (const repoRoot of repoRoots) candidates.push(resolve(repoRoot, relativePath));
  };
  const pushDesktopPath = (relativePath) => {
    for (const desktopRoot of desktopRoots) candidates.push(resolve(desktopRoot, relativePath));
  };
  const pushResourcePath = (relativePath) => {
    if (typeof resourcesPath !== "string") return;
    candidates.push(resolve(resourcesPath, "app.asar", relativePath));
    candidates.push(resolve(resourcesPath, "app.asar.unpacked", relativePath));
  };
  if (specifier === "@neon-pilot/core") {
    pushRepoPath("packages/desktop/server/dist/core/index.js");
    pushRepoPath("packages/desktop/dist/server/core/index.js");
    pushRepoPath("packages/core/dist/index.js");
    pushDesktopPath("server/dist/core/index.js");
    pushDesktopPath("dist/server/core/index.js");
    pushResourcePath("server/dist/core/index.js");
    pushResourcePath("packages/desktop/server/dist/core/index.js");
    pushResourcePath("packages/desktop/dist/server/core/index.js");
    pushResourcePath("packages/core/dist/index.js");
  } else if (specifier === "@neon-pilot/daemon") {
    pushRepoPath("packages/desktop/server/dist/daemon/index.js");
    pushDesktopPath("server/dist/daemon/index.js");
    pushDesktopPath("dist/server/daemon/index.js");
    pushResourcePath("packages/desktop/server/dist/daemon/index.js");
    pushResourcePath("server/dist/daemon/index.js");
  } else if (specifier === "@earendil-works/pi-coding-agent") {
    pushRepoPath("node_modules/@earendil-works/pi-coding-agent/dist/index.js");
    pushResourcePath("node_modules/@earendil-works/pi-coding-agent/dist/index.js");
  }
  return candidates;
}
function resolveServerModuleSpecifierFrom({
  importMetaUrl,
  relativeSpecifier,
  normalize = normalizeServerModuleSpecifier,
  resourcesPath: providedResourcesPath
}) {
  const resourcesPath = providedResourcesPath ?? process.resourcesPath;
  if (!relativeSpecifier.startsWith(".")) {
    const foundPackageEntry = packageEntryCandidates(relativeSpecifier, resourcesPath).find((candidate) => existsSync(candidate));
    return foundPackageEntry ? pathToFileURL(foundPackageEntry).href : relativeSpecifier;
  }
  const normalized = normalize(relativeSpecifier);
  const importMetaCandidate = !process.env.NEON_PILOT_REPO_ROOT && isFileUrl(importMetaUrl) ? resolveRepoRootFromImportMeta(importMetaUrl, normalized) : void 0;
  const candidates = [
    ...process.env.NEON_PILOT_REPO_ROOT ? [
      resolve(process.env.NEON_PILOT_REPO_ROOT, "packages/desktop/server/dist", normalized),
      resolve(process.env.NEON_PILOT_REPO_ROOT, "packages/desktop/dist/server", normalized)
    ] : [],
    resolve(process.cwd(), "packages/desktop/server/dist", normalized),
    resolve(process.cwd(), "server/dist", normalized),
    resolve(process.cwd(), "packages/desktop/dist/server", normalized),
    resolve(process.cwd(), "dist/server", normalized),
    ...importMetaCandidate ? [importMetaCandidate] : [],
    ...typeof resourcesPath === "string" ? [
      resolve(resourcesPath, "app.asar.unpacked/packages/desktop/server/dist", normalized),
      resolve(resourcesPath, "app.asar.unpacked/packages/desktop/dist/server", normalized),
      resolve(resourcesPath, "app.asar.unpacked/server/dist", normalized),
      resolve(resourcesPath, "app.asar/server/dist", normalized),
      resolve(resourcesPath, "server/dist", normalized)
    ] : []
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  return found ? pathToFileURL(found).href : relativeSpecifier;
}
function isFileUrl(url) {
  try {
    return new URL(url).protocol === "file:";
  } catch {
    return false;
  }
}
function resolveRepoRootFromImportMeta(importMetaUrl, normalized) {
  try {
    let dir = new URL(importMetaUrl).pathname;
    if (!dir.endsWith("/")) dir = dir.slice(0, dir.lastIndexOf("/"));
    const markerSegments = ["packages", "desktop", "dist", "server"];
    for (; ; ) {
      const checkPath = resolve(dir, ...markerSegments);
      if (existsSync(checkPath)) {
        return resolve(dir, ...markerSegments, normalized);
      }
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
  }
  return void 0;
}
function resolveServerModuleSpecifier(relativeSpecifier) {
  return resolveServerModuleSpecifierFrom({ importMetaUrl: import.meta.url, relativeSpecifier });
}
async function importServerModule(relativeSpecifier) {
  return dynamicImport(resolveServerModuleSpecifier(relativeSpecifier));
}
async function callServerModuleExport(relativeSpecifier, name, ...args) {
  const module = await importServerModule(relativeSpecifier);
  const fn = module[name];
  if (typeof fn !== "function") throw new Error(`Backend API export ${name} is unavailable.`);
  return fn(...args);
}

// packages/desktop/server/extensions/backendApi/desktop.ts
async function readDesktopState() {
  return callServerModuleExport("../../desktop/desktopState.js", "readDesktopStateSnapshot");
}

// extensions/system-desktop-tools/src/backend.ts
async function desktopState(_input, _ctx) {
  const state = await readDesktopState();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(state, null, 2)
      }
    ],
    details: state
  };
}
export {
  desktopState
};
