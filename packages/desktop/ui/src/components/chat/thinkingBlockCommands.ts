import { setExtensionCommandContext } from '../../extensions/commands';

export const THINKING_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:thinking-block-toggle-first';

export interface ThinkingBlockCommandDetail {
  handled?: boolean;
}

const THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = 'thinkingBlock.canToggleFirst';
let thinkingBlockToggleCapabilityCount = 0;

export function registerThinkingBlockToggleCapability(): () => void {
  thinkingBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    thinkingBlockToggleCapabilityCount = Math.max(0, thinkingBlockToggleCapabilityCount - 1);
    if (thinkingBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(THINKING_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
