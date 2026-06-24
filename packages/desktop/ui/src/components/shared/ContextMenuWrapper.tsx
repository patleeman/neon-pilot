/**
 * Wraps a context menu to keep it within the viewport.
 *
 * The trees library positions the context menu anchor at the right-click
 * coordinates with `position: fixed`. The menu content (rendered inside a
 * slot with `width: 0; overflow: visible`) uses `absolute left-0` which
 * extends right from the anchor — if the anchor is near the viewport edge,
 * the menu spills off-screen.
 *
 * This component measures the menu and translates it back inside the viewport
 * when it would overflow any edge.
 */

import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { CONTEXT_MENU_EDGE_PADDING_PX } from './contextMenuPosition';

interface ContextMenuWrapperProps {
  children: ReactNode;
  className?: string;
}

export function ContextMenuWrapper({ children, className }: ContextMenuWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [clampStyle, setClampStyle] = useState<CSSProperties | undefined>();

  const measureAndClamp = useCallback((node: HTMLDivElement) => {
    const rect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dx =
      rect.left < CONTEXT_MENU_EDGE_PADDING_PX
        ? CONTEXT_MENU_EDGE_PADDING_PX - rect.left
        : Math.min(0, viewportWidth - CONTEXT_MENU_EDGE_PADDING_PX - rect.right);
    const dy =
      rect.top < CONTEXT_MENU_EDGE_PADDING_PX
        ? CONTEXT_MENU_EDGE_PADDING_PX - rect.top
        : Math.min(0, viewportHeight - CONTEXT_MENU_EDGE_PADDING_PX - rect.bottom);

    setClampStyle(dx || dy ? { transform: `translate(${dx}px, ${dy}px)` } : undefined);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Wait a tick for the DOM to settle and measure
    const raf = requestAnimationFrame(() => {
      measureAndClamp(el);
    });

    return () => cancelAnimationFrame(raf);
  }, [measureAndClamp]);

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node) {
        // Re-measure when the DOM settles (the menu content may be async)
        requestAnimationFrame(() => measureAndClamp(node));
      }
    },
    [measureAndClamp],
  );

  return (
    <div ref={handleRef} className={className} style={clampStyle}>
      {children}
    </div>
  );
}
