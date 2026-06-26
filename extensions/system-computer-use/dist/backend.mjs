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

// packages/desktop/server/extensions/backendApi/mcp.ts
async function callCoreExport(name, ...args) {
  return callServerModuleExport("@neon-pilot/core", name, ...args);
}
async function callMcpToolDirect(...args) {
  return callCoreExport("callMcpToolDirect", ...args);
}

// extensions/system-computer-use/src/backend.ts
var CUA_SERVER = {
  name: "cua-driver",
  transport: "stdio",
  command: "cua-driver",
  args: ["mcp"],
  env: { CUA_DRIVER_RS_TELEMETRY_ENABLED: "0" },
  raw: { allowToolCalls: true }
};
var MUTATING_ACTIONS = /* @__PURE__ */ new Set(["click", "type", "key", "scroll", "drag", "focus_app"]);
var BLOCKED_KEY_PATTERNS = [/lock/i, /logout/i, /log\s*out/i, /force\s*quit/i, /delete/i, /trash/i];
var BLOCKED_TEXT_PATTERNS = [
  /curl\s+[^\n|]+\|\s*(ba)?sh/i,
  /wget\s+[^\n|]+\|\s*(ba)?sh/i,
  /sudo\s+rm\s+-rf\s+\//i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/
];
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function messageFrom(error) {
  return error instanceof Error ? error.message : String(error);
}
function isCuaDriverUnavailable(error) {
  const message = messageFrom(error);
  return /\bENOENT\b/.test(message) || /not found/i.test(message) || /command not found/i.test(message);
}
function cuaDriverUnavailableResult(error) {
  return {
    ok: false,
    message: "Cua Driver is not installed or is not on PATH.",
    error: messageFrom(error),
    installHint: "Run the \u201CInstall Cua Driver\u201D command, then grant Accessibility and Screen Recording permissions when prompted by your OS."
  };
}
function mergeArgs(input) {
  const args = isRecord(input.arguments) ? { ...input.arguments } : {};
  for (const key of ["pid", "window_id", "element", "x", "y", "text", "keys", "button", "capture_after"]) {
    const value = input[key];
    if (value !== void 0) args[key] = value;
  }
  return args;
}
function normalizeCuaArgs(args) {
  const normalized = { ...args };
  if (typeof normalized.element === "number" && normalized.element_index === void 0) {
    normalized.element_index = normalized.element;
  }
  delete normalized.element;
  delete normalized.capture_after;
  return normalized;
}
function keyToolFor(args) {
  const normalized = normalizeCuaArgs(args);
  const keys = normalized.keys;
  if (typeof keys !== "string" || !keys.trim()) {
    throw new Error("keys is required for action=key.");
  }
  const parts = keys.split(/[+,]/).map((part) => part.trim().toLowerCase()).filter(Boolean);
  delete normalized.keys;
  if (parts.length > 1) return { tool: "hotkey", args: { ...normalized, keys: parts } };
  return { tool: "press_key", args: { ...normalized, key: parts[0] ?? keys.trim() } };
}
function mcpToolFor(input) {
  const args = mergeArgs(input);
  switch (input.action) {
    case "capture":
      return { tool: "get_accessibility_tree", args: {} };
    case "window_state":
      return { tool: "get_window_state", args: normalizeCuaArgs(args) };
    case "click":
      return { tool: "click", args: normalizeCuaArgs(args) };
    case "type":
      return { tool: "type_text", args: normalizeCuaArgs(args) };
    case "key":
      return keyToolFor(args);
    case "scroll":
      return { tool: "scroll", args: normalizeCuaArgs(args) };
    case "drag":
      return { tool: "drag", args: normalizeCuaArgs(args) };
    case "focus_app":
      return { tool: "bring_to_front", args: normalizeCuaArgs(args) };
    case "doctor":
      return { tool: "health_report", args };
    case "status":
      return { tool: "health_report", args };
    default:
      throw new Error(`Unsupported computer_use action: ${input.action}`);
  }
}
function assertSafeInput(input) {
  if (input.action === "type" && typeof input.text === "string") {
    const blocked = BLOCKED_TEXT_PATTERNS.find((pattern) => pattern.test(input.text ?? ""));
    if (blocked) throw new Error("Blocked unsafe text input pattern.");
  }
  if (input.action === "key" && typeof input.keys === "string") {
    const blocked = BLOCKED_KEY_PATTERNS.find((pattern) => pattern.test(input.keys ?? ""));
    if (blocked) throw new Error("Blocked unsafe key sequence.");
  }
}
async function callCuaTool(input, ctx) {
  assertSafeInput(input);
  const { tool, args } = mcpToolFor(input);
  ctx.log.info("Calling Cua Driver tool", { action: input.action, tool });
  const result = await callMcpToolDirect(CUA_SERVER, tool, args, {
    timeoutMs: input.action === "doctor" || input.action === "status" ? 2e4 : 3e4,
    log: (message) => ctx.log.info(message)
  });
  if (result.error || result.exitCode !== 0) {
    throw new Error(result.error ?? result.stderr ?? `Cua Driver ${tool} failed.`);
  }
  return result.data ?? result.stdout ?? result;
}
async function computerUse(input, ctx) {
  if (!input || typeof input !== "object" || typeof input.action !== "string") throw new Error("action is required.");
  if (input.action === "status") return computerUseStatus({}, ctx);
  if (input.action === "doctor") return computerUseDoctor(input, ctx);
  if (input.action === "focus_app" && process.platform === "darwin") {
    return {
      ok: true,
      focused: false,
      message: "Cua Driver does not bring macOS apps to the foreground; input actions are delivered directly to the target pid without focus."
    };
  }
  if (MUTATING_ACTIONS.has(input.action)) {
    assertSafeInput(input);
  }
  try {
    return await callCuaTool(input, ctx);
  } catch (error) {
    if (isCuaDriverUnavailable(error)) return cuaDriverUnavailableResult(error);
    throw error;
  }
}
async function computerUseStatus(_input, ctx) {
  try {
    const version = await ctx.shell.exec({ command: "cua-driver", args: ["--version"], timeoutMs: 1e4 });
    const health = await callCuaTool({ action: "status" }, ctx).catch((error) => ({ error: messageFrom(error) }));
    return {
      ok: true,
      installed: true,
      version: version.stdout.trim() || version.stderr.trim(),
      telemetry: "disabled",
      health
    };
  } catch (error) {
    return { installed: false, ...cuaDriverUnavailableResult(error) };
  }
}
async function computerUseDoctor(input, ctx) {
  try {
    return await callCuaTool({ ...input, action: "doctor" }, ctx);
  } catch (error) {
    return isCuaDriverUnavailable(error) ? cuaDriverUnavailableResult(error) : {
      ok: false,
      message: "Cua Driver doctor could not run.",
      error: messageFrom(error),
      installHint: "Run the \u201CInstall Cua Driver\u201D command, then grant Accessibility and Screen Recording permissions when prompted by your OS."
    };
  }
}
async function computerUseInstall(_input, ctx) {
  const platform = process.platform;
  const command = platform === "win32" ? "irm https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.ps1 | iex" : '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.sh)"';
  const shell = platform === "win32" ? "powershell.exe" : "/bin/bash";
  const args = platform === "win32" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command] : ["-lc", command];
  let result;
  try {
    result = await ctx.shell.exec({ command: shell, args, timeoutMs: 12e4, maxBuffer: 1024 * 1024 });
  } catch (error) {
    return {
      ok: false,
      message: "Cua Driver installer failed.",
      error: messageFrom(error),
      installCommand: command
    };
  }
  const version = await ctx.shell.exec({ command: "cua-driver", args: ["--version"], timeoutMs: 1e4 }).then((output) => output.stdout.trim() || output.stderr.trim()).catch((error) => `Unable to verify version: ${messageFrom(error)}`);
  const health = await callCuaTool({ action: "status" }, ctx).catch((error) => ({ error: messageFrom(error) }));
  return {
    ok: true,
    stdout: result.stdout,
    stderr: result.stderr,
    version,
    health,
    message: "Cua Driver installer finished and version verification ran. Run Computer Use doctor next to verify OS permissions."
  };
}
export {
  computerUse,
  computerUseDoctor,
  computerUseInstall,
  computerUseStatus
};
