import type { ExtensionRightToolPanelSurface, ExtensionSurfaceSummary, NativeExtensionViewSummary } from '../../extensions/types';

export type BuiltInWorkbenchRailMode = 'files' | 'artifacts' | 'browser';
export type ExtensionWorkbenchRailMode = `extension:${string}:${string}`;
export type WorkbenchRailMode = BuiltInWorkbenchRailMode | ExtensionWorkbenchRailMode;

type WorkbenchToolPanelSurface = (ExtensionRightToolPanelSurface & ExtensionSurfaceSummary) | NativeExtensionViewSummary;

function getSurfaceToolSlot(surface: WorkbenchToolPanelSurface): string | undefined {
  return 'toolSlot' in surface ? ((surface as Record<string, unknown>).toolSlot as string | undefined) : undefined;
}

export function inferSurfaceToolSlot(surface: WorkbenchToolPanelSurface): string | undefined {
  const explicitSlot = getSurfaceToolSlot(surface);
  if (explicitSlot) return explicitSlot;
  if (surface.extensionId === 'system-files') return 'files';
  if (surface.extensionId === 'system-artifacts') return 'artifacts';
  if (surface.extensionId === 'system-browser') return 'browser';
  return undefined;
}

export function extensionToolPanelMode(surface: WorkbenchToolPanelSurface): WorkbenchRailMode {
  const slot = inferSurfaceToolSlot(surface);
  return slot ?? `extension:${surface.extensionId}:${surface.id}`;
}

export function resolveWorkbenchRailMode(
  builtInMode: BuiltInWorkbenchRailMode,
  surface: WorkbenchToolPanelSurface | null | undefined,
): WorkbenchRailMode {
  return surface ? extensionToolPanelMode(surface) : builtInMode;
}

export function parseExtensionToolPanelMode(mode: WorkbenchRailMode): { extensionId: string; surfaceId: string } | null {
  if (!mode.startsWith('extension:')) return null;
  const [, extensionId, surfaceId] = mode.split(':');
  return extensionId && surfaceId ? { extensionId, surfaceId } : null;
}

export function findExtensionToolPanelBySlot(panels: WorkbenchToolPanelSurface[], slot: string): WorkbenchToolPanelSurface | null {
  return panels.find((p) => inferSurfaceToolSlot(p) === slot) ?? null;
}

export function resolveActiveExtensionWorkbenchSurface({
  activeWorkbenchTool,
  extensionRightToolPanels,
  extensionWorkbenchSurfaces,
}: {
  activeWorkbenchTool: WorkbenchRailMode;
  extensionRightToolPanels: WorkbenchToolPanelSurface[];
  extensionWorkbenchSurfaces: NativeExtensionViewSummary[];
}): NativeExtensionViewSummary | null {
  const parsed = parseExtensionToolPanelMode(activeWorkbenchTool);
  const activeRailSurface = parsed
    ? extensionRightToolPanels.find((surface) => surface.extensionId === parsed.extensionId && surface.id === parsed.surfaceId)
    : findExtensionToolPanelBySlot(extensionRightToolPanels, activeWorkbenchTool);
  if (!activeRailSurface || !('detailView' in activeRailSurface) || typeof activeRailSurface.detailView !== 'string') return null;
  return (
    extensionWorkbenchSurfaces.find(
      (surface) => surface.extensionId === activeRailSurface.extensionId && surface.id === activeRailSurface.detailView,
    ) ?? null
  );
}

export function isArtifactsRailMode(mode: WorkbenchRailMode): boolean {
  return mode === 'artifacts' || mode.startsWith('extension:system-artifacts:');
}
