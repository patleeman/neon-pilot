import { useEffect, useRef, useState } from 'react';

import type { ThreadsFilterMode, ThreadsOrganizeMode, ThreadsSortMode } from './sidebarThreadModel';
import { IconButton, MenuGroupLabel, MenuItem, MenuSeparator, MenuShell } from './ui';

const PATH = {
  automations:
    'M7.5 4.75h9A2.25 2.25 0 0 1 18.75 7v10A2.25 2.25 0 0 1 16.5 19.25h-9A2.25 2.25 0 0 1 5.25 17V7A2.25 2.25 0 0 1 7.5 4.75ZM8.75 8.25h6.5M8.75 12h6.5M8.75 15.75h3',
  check: 'm5 12.75 4.5 4.5L19 7.75',
  clock: 'M12 6.25v6l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  conversations:
    'M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25H13.5l-3 3v-3H6.75A2.25 2.25 0 0 1 4.5 14.25v-7.5Z',
  filter: 'M4.5 7.5h15M7.5 12h9M10.5 16.5h3',
  list: 'M8 6.75h11M8 12h11M8 17.25h11M4.75 6.75h.01M4.75 12h.01M4.75 17.25h.01',
  sparkles:
    'M12 3.75l1.6 4.35 4.35 1.6-4.35 1.6L12 15.65l-1.6-4.35-4.35-1.6 4.35-1.6L12 3.75ZM18.25 14.75l.75 2 .75-2 2-.75-2-.75-.75-2-.75 2-2 .75 2 .75ZM5.25 15.75l.65 1.75.65-1.75 1.75-.65-1.75-.65-.65-1.75-.65 1.75-1.75.65 1.75.65Z',
  workspace:
    'M3.75 7.5A1.5 1.5 0 0 1 5.25 6h4.018a1.5 1.5 0 0 1 1.06.44l1.172 1.17a1.5 1.5 0 0 0 1.06.44h6.19a1.5 1.5 0 0 1 1.5 1.5v7.95a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z M3.75 9.75h16.5',
};

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function ThreadsFilterButton({
  organizeMode,
  filterMode,
  sortMode,
  onChangeOrganizeMode,
  onChangeFilterMode,
  onChangeSortMode,
}: {
  organizeMode: ThreadsOrganizeMode;
  filterMode: ThreadsFilterMode;
  sortMode: ThreadsSortMode;
  onChangeOrganizeMode: (value: ThreadsOrganizeMode) => void;
  onChangeFilterMode: (value: ThreadsFilterMode) => void;
  onChangeSortMode: (value: ThreadsSortMode) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  function openMenu() {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const menuWidth = 172;
    const menuHeight = 320;
    const edgePadding = 12;
    const viewportWidth = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight;

    setMenuPosition({
      x: Math.max(edgePadding, Math.min(bounds.right - menuWidth, viewportWidth - menuWidth - edgePadding)),
      y: Math.max(edgePadding, Math.min(bounds.bottom + 6, viewportHeight - menuHeight - edgePadding)),
    });
    setMenuOpen(true);
  }

  function stopMenuEvent(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleMenuToggle() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    openMenu();
  }

  function renderMenuItem({ label, icon, checked, onClick }: { label: string; icon: string; checked: boolean; onClick: () => void }) {
    return (
      <MenuItem
        onPointerDown={stopMenuEvent}
        onMouseDown={stopMenuEvent}
        onClick={() => {
          onClick();
          setMenuOpen(false);
        }}
        checked={checked}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-secondary">
            <Icon d={icon} size={11} />
          </span>
          <span className="truncate">{label}</span>
        </span>
        <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center text-accent">
          {checked ? <Icon d={PATH.check} size={11} /> : null}
        </span>
      </MenuItem>
    );
  }

  return (
    <>
      <IconButton
        ref={buttonRef}
        compact
        onClick={handleMenuToggle}
        className="shrink-0"
        title="Organize and sort threads"
        aria-label="Organize and sort threads"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Icon d={PATH.filter} size={12} />
      </IconButton>
      {menuOpen && menuPosition ? (
        <MenuShell
          ref={menuRootRef}
          className="fixed bottom-auto left-auto right-auto top-auto mb-0 min-w-[172px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          aria-label="Threads organization options"
        >
          <div className="space-y-px">
            <MenuGroupLabel>Show</MenuGroupLabel>
            {renderMenuItem({
              label: 'All threads',
              icon: PATH.list,
              checked: filterMode === 'all',
              onClick: () => onChangeFilterMode('all'),
            })}
            {renderMenuItem({
              label: 'Human threads',
              icon: PATH.conversations,
              checked: filterMode === 'human',
              onClick: () => onChangeFilterMode('human'),
            })}
            {renderMenuItem({
              label: 'Automation threads',
              icon: PATH.automations,
              checked: filterMode === 'automation',
              onClick: () => onChangeFilterMode('automation'),
            })}
            <MenuSeparator />
            <MenuGroupLabel>Organize</MenuGroupLabel>
            {renderMenuItem({
              label: 'By project',
              icon: PATH.workspace,
              checked: organizeMode === 'project',
              onClick: () => onChangeOrganizeMode('project'),
            })}
            {renderMenuItem({
              label: 'Chronological list',
              icon: PATH.list,
              checked: organizeMode === 'chronological',
              onClick: () => onChangeOrganizeMode('chronological'),
            })}
            <MenuSeparator />
            <MenuGroupLabel>Order</MenuGroupLabel>
            {renderMenuItem({
              label: 'Created',
              icon: PATH.clock,
              checked: sortMode === 'created',
              onClick: () => onChangeSortMode('created'),
            })}
            {renderMenuItem({
              label: 'Updated',
              icon: PATH.sparkles,
              checked: sortMode === 'updated',
              onClick: () => onChangeSortMode('updated'),
            })}
          </div>
        </MenuShell>
      ) : null}
    </>
  );
}
