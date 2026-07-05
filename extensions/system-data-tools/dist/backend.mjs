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

// packages/desktop/server/extensions/backendApi/documents-store.ts
async function callMod(spec, name, ...args) {
  return callServerModuleExport(spec, name, ...args);
}
async function getStore() {
  const stateRoot = resolveStateRoot();
  return callMod("../../documents/store.js", "getDocumentsStore", stateRoot);
}
async function assertPermission(callerAppId, permission, capability) {
  if (!callerAppId) return;
  const readwritePermission = "documents:readwrite";
  const permitted = await callMod("../../extensions/extensionPermissions.js", "extensionHasPermission", callerAppId, permission);
  if (permitted) return;
  const readwritePermitted = await callMod(
    "../../extensions/extensionPermissions.js",
    "extensionHasPermission",
    callerAppId,
    readwritePermission
  );
  if (readwritePermitted) return;
  await callMod("../../extensions/extensionPermissions.js", "assertExtensionPermission", callerAppId, permission, capability);
}
async function publishDocumentsMutation(payload) {
  await callMod("../../shared/appEvents.js", "invalidateAppTopics", "documents");
  await callMod("../../extensions/extensionSubscriptions.js", "publishExtensionHostEvent", "documents", payload);
}
function resolveStateRoot() {
  if (typeof globalThis !== "undefined") {
    const g = globalThis;
    if (typeof g.__NEON_PILOT_STATE_ROOT__ === "string" && g.__NEON_PILOT_STATE_ROOT__) {
      return g.__NEON_PILOT_STATE_ROOT__;
    }
  }
  const envRoot = process.env.NEON_PILOT_STATE_ROOT?.trim();
  if (envRoot) return envRoot;
  throw new Error("Cannot resolve state root for documents store. Set NEON_PILOT_STATE_ROOT.");
}
function makeCaller(callerAppId) {
  return callerAppId ? { kind: "app", appId: callerAppId } : { kind: "host" };
}
function deny() {
  throw new Error("Document collection access denied");
}
function assertCanRead(s, c, owner, col) {
  if (c.kind === "host" || c.appId === owner) return;
  const summary = s.getCollection(owner, col);
  if (!summary) throw new Error(`Collection "${owner}/${col}" not found`);
  if (summary.defaultGrantRead === "all") return;
  if (!c.appId) deny();
  if (s.getGrant(owner, col, c.appId)?.canRead) return;
  deny();
}
function assertCanWrite(s, c, owner, col) {
  if (c.kind === "host" || c.appId === owner) return;
  const summary = s.getCollection(owner, col);
  if (!summary) throw new Error(`Collection "${owner}/${col}" not found`);
  if (summary.defaultGrantWrite === "all") return;
  if (!c.appId) deny();
  if (s.getGrant(owner, col, c.appId)?.canWrite) return;
  deny();
}
async function listCollections(options) {
  await assertPermission(options?.callerAppId, "documents:read", "documents.listCollections");
  const store = await getStore();
  const c = makeCaller(options?.callerAppId);
  return store.listCollections(options?.owner).filter((col) => {
    if (c.kind === "host" || c.appId === col.owner) return true;
    if (col.defaultGrantRead === "all") return true;
    if (!c.appId) return false;
    return store.getGrant(col.owner, col.collection, c.appId)?.canRead === true;
  });
}
async function listDocuments(owner, collection, options, callerAppId) {
  await assertPermission(callerAppId, "documents:read", "documents.listDocuments");
  const store = await getStore();
  assertCanRead(store, makeCaller(callerAppId), owner, collection);
  return store.listDocuments(owner, collection, { limit: options?.limit, offset: options?.offset });
}
async function getDocument(owner, collection, id, callerAppId) {
  await assertPermission(callerAppId, "documents:read", "documents.getDocument");
  const store = await getStore();
  assertCanRead(store, makeCaller(callerAppId), owner, collection);
  return store.getDocument(owner, collection, id);
}
async function putDocument(owner, collection, id, body, callerAppId) {
  await assertPermission(callerAppId, "documents:write", "documents.putDocument");
  const store = await getStore();
  assertCanWrite(store, makeCaller(callerAppId), owner, collection);
  const result = store.putDocument(owner, collection, id, body);
  await publishDocumentsMutation({ type: "document.updated", owner, collection, id, body });
  return result;
}

// extensions/system-data-tools/src/backend.ts
var pendingWatches = /* @__PURE__ */ new Set();
function cancelWatch(entry) {
  clearTimeout(entry.timer);
  pendingWatches.delete(entry);
}
async function dataList(input, ctx) {
  const collections = await listCollections({
    owner: input.owner,
    callerAppId: ctx.extensionId
  });
  return { collections };
}
async function dataRead(input, ctx) {
  if (input.id) {
    const document = await getDocument(input.owner, input.collection, input.id, ctx.extensionId);
    if (!document) {
      return { error: `Document "${input.owner}/${input.collection}/${input.id}" not found` };
    }
    return { document };
  }
  const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(input.limit, 1e3) : 100;
  const offset = typeof input.offset === "number" && input.offset >= 0 ? input.offset : 0;
  const result = await listDocuments(input.owner, input.collection, { limit, offset }, ctx.extensionId);
  return result;
}
async function dataWrite(input, ctx) {
  const document = await putDocument(input.owner, input.collection, input.id, input.body, ctx.extensionId);
  return { document };
}
async function dataWatch(input, _ctx) {
  const timeoutMs = Math.min(typeof input.timeout === "number" && input.timeout > 0 ? input.timeout * 1e3 : 6e4, 3e5);
  return new Promise((resolve2) => {
    const entry = {
      owner: input.owner,
      collection: input.collection,
      resolve: (value) => {
        resolve2(value);
      },
      timer: setTimeout(() => {
        pendingWatches.delete(entry);
        resolve2({ event: null, reason: "timeout" });
      }, timeoutMs)
    };
    pendingWatches.add(entry);
  });
}
function onDocumentEvent(input) {
  const payload = input.payload;
  if (!payload || typeof payload !== "object") return;
  const type = payload.type;
  if (type !== "document.updated" && type !== "document.deleted") return;
  for (const entry of pendingWatches) {
    if (entry.owner !== payload.owner) continue;
    if (entry.collection && entry.collection !== payload.collection) continue;
    cancelWatch(entry);
    entry.resolve({ event: payload });
    return;
  }
}
export {
  dataList,
  dataRead,
  dataWatch,
  dataWrite,
  onDocumentEvent
};
