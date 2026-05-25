type ExtensionModule = Record<string, unknown>;
type ExtensionModuleLoader = () => Promise<ExtensionModule>;

const systemExtensionFrontendModules = import.meta.glob<ExtensionModule>('../../../../../extensions/*/src/frontend.tsx');
const installableExtensionFrontendModules = import.meta.glob<ExtensionModule>('../../../../../installable-extensions/*/src/frontend.tsx');

function extensionIdFromModulePath(path: string): string | null {
  const match = path.match(/\/(?:extensions|installable-extensions)\/([^/]+)\/src\/frontend\.tsx$/);
  return match?.[1] ?? null;
}

export const systemExtensionModules = new Map<string, ExtensionModuleLoader>(
  Object.entries({ ...systemExtensionFrontendModules, ...installableExtensionFrontendModules }).flatMap(([path, loader]) => {
    const extensionId = extensionIdFromModulePath(path);
    return extensionId ? [[extensionId, loader as ExtensionModuleLoader]] : [];
  }),
);
