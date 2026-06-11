import { setExtensionCommandContext } from '../../extensions/commands';

export const TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT = 'neon-pilot:trace-cluster-toggle-first';

export interface TraceClusterCommandDetail {
  handled?: boolean;
}

const TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT = 'traceCluster.canToggleFirst';
let traceClusterToggleCapabilityCount = 0;

export function registerTraceClusterToggleCapability(): () => void {
  traceClusterToggleCapabilityCount += 1;
  setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT, true);

  return () => {
    traceClusterToggleCapabilityCount = Math.max(0, traceClusterToggleCapabilityCount - 1);
    if (traceClusterToggleCapabilityCount === 0) {
      setExtensionCommandContext(TRACE_CLUSTER_CAN_TOGGLE_FIRST_CONTEXT, null);
    }
  };
}
