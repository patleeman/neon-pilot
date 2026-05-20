import type { CommandPaletteScope } from './commandPalette';

export const OPEN_COMMAND_PALETTE_EVENT = 'pa:command-palette-open';
export const COMMAND_PALETTE_STATE_EVENT = 'pa:command-palette-state';

export interface OpenCommandPaletteDetail {
  scope?: CommandPaletteScope;
  query?: string;
  anchorRect?: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
}

export interface CommandPaletteStateDetail {
  open: boolean;
}
