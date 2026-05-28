import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActivityTreeItem } from './activityTree';

export interface ActivityTreeContextMenuState {
  item: ActivityTreeItem;
  x: number;
  y: number;
}

export function useActivityTreeContextMenu() {
  const [contextMenu, setContextMenu] = useState<ActivityTreeContextMenuState | null>(null);
  const contextMenuRootRef = useRef<HTMLDivElement | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openContextMenu = useCallback((item: ActivityTreeItem, x: number, y: number) => {
    setContextMenu({ item, x, y });
  }, []);

  useEffect(() => {
    if (!contextMenu || typeof document === 'undefined') return;

    const closeIfOutsideMenu = (event: MouseEvent | PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRootRef.current?.contains(target)) return;
      closeContextMenu();
    };

    document.addEventListener('pointerdown', closeIfOutsideMenu, true);
    document.addEventListener('contextmenu', closeIfOutsideMenu, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutsideMenu, true);
      document.removeEventListener('contextmenu', closeIfOutsideMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

  return {
    closeContextMenu,
    contextMenu,
    contextMenuRootRef,
    openContextMenu,
  };
}
