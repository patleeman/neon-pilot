import { setExtensionCommandContext } from '../../extensions/commands';

export const TOOL_BLOCK_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:tool-block-toggle-first';
export const TOOL_BLOCK_TOGGLE_FIRST_LINKED_RUNS_COMMAND_EVENT = 'neon-pilot:tool-block-toggle-first-linked-runs';

export interface ToolBlockCommandDetail {
  handled?: boolean;
}

const TOOL_BLOCK_CAN_TOGGLE_FIRST_CONTEXT = 'toolBlock.canToggleFirst';
const TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT = 'toolBlock.canToggleFirstLinkedRuns';
let toolBlockToggleCapabilityCount = 0;
let toolBlockLinkedRunsToggleCapabilityCount = 0;

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

export function registerToolBlockLinkedRunsToggleCapability(): () => void {
  toolBlockLinkedRunsToggleCapabilityCount += 1;
  setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT, true);

  return () => {
    toolBlockLinkedRunsToggleCapabilityCount = Math.max(0, toolBlockLinkedRunsToggleCapabilityCount - 1);
    if (toolBlockLinkedRunsToggleCapabilityCount === 0) {
      setExtensionCommandContext(TOOL_BLOCK_CAN_TOGGLE_FIRST_LINKED_RUNS_CONTEXT, null);
    }
  };
}
