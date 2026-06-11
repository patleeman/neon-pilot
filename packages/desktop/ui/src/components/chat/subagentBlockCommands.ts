import { setExtensionCommandContext } from '../../extensions/commands';

export const SUBAGENT_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:subagent-block-toggle-first';

export interface SubagentBlockCommandDetail {
  handled?: boolean;
}

const SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = 'subagentBlock.canToggleFirst';
let subagentBlockToggleCapabilityCount = 0;

export function registerSubagentBlockToggleCapability(): () => void {
  subagentBlockToggleCapabilityCount += 1;
  setExtensionCommandContext(SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    subagentBlockToggleCapabilityCount = Math.max(0, subagentBlockToggleCapabilityCount - 1);
    if (subagentBlockToggleCapabilityCount === 0) {
      setExtensionCommandContext(SUBAGENT_BLOCK_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
