/**
 * Data hook for the Traces page.
 * Fetches all telemetry endpoints with a configurable time range.
 */

import type { NativeExtensionClient } from '@neon-pilot/extensions';
import type {
  AppTelemetryEventRow,
  AutoModeSummary,
  CacheEfficiencyAggregate,
  ContextPointerUsageResult,
  SystemPromptAggregate,
  ToolFlowResult,
  TraceAgentLoop,
  TraceCompactionAggs,
  TraceCompactionEvent,
  TraceContextSession,
  TraceCostRow,
  TraceModelUsage,
  TraceSummary,
  TraceThroughput,
  TraceTokenDaily,
  TraceToolHealth,
} from '@neon-pilot/extensions/data';
import { useCallback, useEffect, useRef, useState } from 'react';

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message, source: 'system-telemetry' } }));
}

export type TraceRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface TracesData {
  summary: TraceSummary | null;
  modelUsage: TraceModelUsage[] | null;
  throughput: TraceThroughput[] | null;
  costByConversation: TraceCostRow[] | null;
  toolHealth: TraceToolHealth[] | null;
  contextSessions: TraceContextSession[] | null;
  compactions: TraceCompactionEvent[] | null;
  compactionAggs: TraceCompactionAggs | null;
  agentLoop: TraceAgentLoop | null;
  tokensDaily: TraceTokenDaily[] | null;
  toolFlow: ToolFlowResult | null;
  autoMode: AutoModeSummary | null;
  cacheEfficiency: CacheEfficiencyAggregate | null;
  systemPrompt: SystemPromptAggregate | null;
  contextPointers: ContextPointerUsageResult | null;
  sessionIntegrity: AppTelemetryEventRow[] | null;
  loading: boolean;
  error: string | null;
}

interface TelemetryActionData {
  summary: TraceSummary;
  modelUsage: { models: TraceModelUsage[]; throughput: TraceThroughput[] };
  costByConversation: TraceCostRow[];
  toolHealth: TraceToolHealth[];
  context: { sessions: TraceContextSession[]; compactions: TraceCompactionEvent[]; compactionAggs: TraceCompactionAggs };
  agentLoop: TraceAgentLoop;
  tokensDaily: TraceTokenDaily[];
  toolFlow: ToolFlowResult;
  autoMode: AutoModeSummary;
  cacheEfficiency: { series: unknown[]; aggregate: CacheEfficiencyAggregate };
  systemPrompt: { series: unknown[]; aggregate: SystemPromptAggregate };
  contextPointers: ContextPointerUsageResult;
  sessionIntegrity: AppTelemetryEventRow[];
}

const EMPTY: TracesData = {
  summary: null,
  modelUsage: null,
  throughput: null,
  costByConversation: null,
  toolHealth: null,
  contextSessions: null,
  compactions: null,
  compactionAggs: null,
  agentLoop: null,
  tokensDaily: null,
  toolFlow: null,
  autoMode: null,
  cacheEfficiency: null,
  systemPrompt: null,
  contextPointers: null,
  sessionIntegrity: null,
  loading: true,
  error: null,
};

export function useTracesData(range: TraceRange, pa: NativeExtensionClient): TracesData & { refetch: () => void } {
  const [data, setData] = useState<TracesData>(EMPTY);
  const fetchSequenceRef = useRef(0);

  const fetch = useCallback(async () => {
    const sequence = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = sequence;
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = (await pa.extension.invoke('getTelemetryData', { range })) as TelemetryActionData;
      if (fetchSequenceRef.current !== sequence) {
        return;
      }

      setData({
        summary: result.summary,
        modelUsage: result.modelUsage.models,
        throughput: result.modelUsage.throughput,
        costByConversation: result.costByConversation,
        toolHealth: result.toolHealth,
        contextSessions: result.context.sessions,
        compactions: result.context.compactions,
        compactionAggs: result.context.compactionAggs,
        agentLoop: result.agentLoop,
        tokensDaily: result.tokensDaily,
        toolFlow: result.toolFlow,
        autoMode: result.autoMode,
        cacheEfficiency: result.cacheEfficiency.aggregate,
        systemPrompt: result.systemPrompt.aggregate,
        contextPointers: result.contextPointers,
        sessionIntegrity: result.sessionIntegrity,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (fetchSequenceRef.current !== sequence) {
        return;
      }
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load trace data',
      }));
      notifyError(err instanceof Error ? err.message : 'Failed to load trace data');
    }
  }, [pa, range]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...data, refetch: fetch };
}
