import { setExtensionCommandContext } from '../../extensions/commands';

export const INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:inline-trace-run-toggle-first';

export interface InlineTraceRunCommandDetail {
  handled?: boolean;
}

const INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT = 'inlineTraceRun.canToggleFirst';
let inlineTraceRunToggleCapabilityCount = 0;

export function registerInlineTraceRunToggleCapability(): () => void {
  inlineTraceRunToggleCapabilityCount += 1;
  setExtensionCommandContext(INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    inlineTraceRunToggleCapabilityCount = Math.max(0, inlineTraceRunToggleCapabilityCount - 1);
    if (inlineTraceRunToggleCapabilityCount === 0) {
      setExtensionCommandContext(INLINE_TRACE_RUN_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
