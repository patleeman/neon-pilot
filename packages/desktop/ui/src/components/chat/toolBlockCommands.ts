import { setExtensionCommandContext } from '../../extensions/commands';

export const TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:tool-block-toggle-first';

export interface ToolBlockCommandDetail {
  handled?: boolean;
}

const TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = 'toolBlock.canToggleFirst';
let toolBlockToggleCapabilityCount = 0;

export function registerToolBlockToggleCapability(): () => void {
  toolBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    toolBlockToggleCapabilityCount = Math.max(0, toolBlockToggleCapabilityCount - 1);
    if (toolBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
