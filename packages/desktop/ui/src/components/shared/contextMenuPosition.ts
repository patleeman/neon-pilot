const CONTEXT_MENU_EDGE_PADDING_PX = 12;
const CONTEXT_MENU_ITEM_HEIGHT_PX = 28;
const CONTEXT_MENU_SHELL_PADDING_PX = 6;
const CONTEXT_MENU_SEPARATOR_HEIGHT_PX = 5;

function readSafeGeometryNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function estimateContextMenuHeight(input: { itemCount: number; separatorCount?: number }): number {
  const itemCount = Math.max(1, input.itemCount);
  const separatorCount = Math.max(0, input.separatorCount ?? 0);
  return itemCount * CONTEXT_MENU_ITEM_HEIGHT_PX + separatorCount * CONTEXT_MENU_SEPARATOR_HEIGHT_PX + CONTEXT_MENU_SHELL_PADDING_PX;
}

export function clampViewportMenuPosition(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  viewport: { width: number; height: number },
  edgePadding = CONTEXT_MENU_EDGE_PADDING_PX,
): { x: number; y: number } {
  const menuWidth = readSafeGeometryNumber(dimensions.width, edgePadding * 2);
  const menuHeight = readSafeGeometryNumber(dimensions.height, edgePadding * 2);
  const viewportWidth = readSafeGeometryNumber(viewport.width, menuWidth + edgePadding * 2);
  const viewportHeight = readSafeGeometryNumber(viewport.height, menuHeight + edgePadding * 2);
  const x = readSafeGeometryNumber(position.x, edgePadding);
  const y = readSafeGeometryNumber(position.y, edgePadding);

  return {
    x: Math.max(edgePadding, Math.min(x, viewportWidth - menuWidth - edgePadding)),
    y: Math.max(edgePadding, Math.min(y, viewportHeight - menuHeight - edgePadding)),
  };
}

export function getViewportMenuTranslation(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewport: { width: number; height: number },
  edgePadding = CONTEXT_MENU_EDGE_PADDING_PX,
): { x: number; y: number } {
  const viewportWidth = readSafeGeometryNumber(viewport.width, edgePadding * 2);
  const viewportHeight = readSafeGeometryNumber(viewport.height, edgePadding * 2);
  const dx = rect.left < edgePadding ? edgePadding - rect.left : Math.min(0, viewportWidth - edgePadding - rect.right);
  const dy = rect.top < edgePadding ? edgePadding - rect.top : Math.min(0, viewportHeight - edgePadding - rect.bottom);

  return { x: dx, y: dy };
}
