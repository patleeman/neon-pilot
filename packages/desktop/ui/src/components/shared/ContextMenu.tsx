import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { MenuShell } from '../ui';
import { clampViewportMenuPosition } from './contextMenuPosition';

type ContextMenuRole = 'menu' | 'listbox' | 'group';

type ContextMenuRef = RefObject<HTMLElement | null>;

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface ContextMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClose' | 'role'> {
  children: ReactNode;
  estimatedHeight?: number;
  ignoreRefs?: ContextMenuRef[];
  minWidth?: number;
  onClose?: () => void;
  portal?: boolean;
  position: { x: number; y: number };
  role?: ContextMenuRole;
  shell?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  (ref as MutableRefObject<T | null>).current = value;
}

function readViewport() {
  if (typeof window === 'undefined') {
    return { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  {
    children,
    className,
    estimatedHeight,
    ignoreRefs = [],
    minWidth,
    onClose,
    portal = true,
    position,
    role = 'menu',
    shell = true,
    style,
    ...props
  },
  forwardedRef,
) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);

  useBrowserLayoutEffect(() => {
    const node = menuRef.current;
    const rect = node?.getBoundingClientRect();
    const width = rect?.width || minWidth || 1;
    const height = rect?.height || estimatedHeight || 1;
    const nextPosition = clampViewportMenuPosition(position, { width, height }, readViewport());

    setResolvedPosition((current) => (current.x === nextPosition.x && current.y === nextPosition.y ? current : nextPosition));
  });

  useEffect(() => {
    if (!onClose || typeof document === 'undefined') return;

    function isInsideMenu(target: EventTarget | null) {
      if (!(target instanceof Node)) return false;
      if (menuRef.current?.contains(target)) return true;
      return ignoreRefs.some((ref) => ref.current?.contains(target));
    }

    function handleOutsidePointer(event: PointerEvent | MouseEvent) {
      if (isInsideMenu(event.target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    document.addEventListener('contextmenu', handleOutsidePointer, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
      document.removeEventListener('contextmenu', handleOutsidePointer, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ignoreRefs, onClose]);

  const menuStyle: CSSProperties = {
    bottom: 'auto',
    left: resolvedPosition.x,
    marginBottom: 0,
    minWidth,
    overflow: 'visible',
    position: 'fixed',
    right: 'auto',
    top: resolvedPosition.y,
    ...style,
  };

  const handleRef = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    assignRef(forwardedRef, node);
  };

  const menu = shell ? (
    <MenuShell ref={handleRef} className={className} role={role} style={menuStyle} {...props}>
      {children}
    </MenuShell>
  ) : (
    <div ref={handleRef} className={className} role={role} style={menuStyle} {...props}>
      {children}
    </div>
  );

  if (!portal || typeof document === 'undefined') {
    return menu;
  }

  return createPortal(menu, document.body);
});
