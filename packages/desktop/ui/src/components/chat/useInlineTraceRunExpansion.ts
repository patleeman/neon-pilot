import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildInlineRunExpansionKey } from './linkedRunPolling.js';
import { collectTraceClusterLinkedRuns, readMentionedLinkedRunsFromText } from './linkedRuns.js';
import type { ChatRenderItem } from './transcriptItems.js';

function readRawRunCallbackLinkedRunIds(text: string): string[] {
  if (
    !/\b(?:Durable run|Background task)\s+\S+\s+has finished\./.test(text.trim()) ||
    !/\btaskSlug=/.test(text) ||
    !/\bstatus=/.test(text) ||
    !/\blog=/.test(text) ||
    !/Recent log tail:/.test(text)
  ) {
    return [];
  }

  const mentionedRuns = readMentionedLinkedRunsFromText(text);
  if (mentionedRuns.length > 0) {
    return mentionedRuns.map((run) => run.runId);
  }

  const directRunId = text.match(/\b(?:Durable run|Background task)\s+([^\s]+)\s+has finished\./)?.[1]?.trim();
  return directRunId ? readMentionedLinkedRunsFromText(`runId=${directRunId}`).map((run) => run.runId) : [];
}

export function collectVisibleInlineRunKeys(renderItems: ChatRenderItem[]): Set<string> {
  const next = new Set<string>();

  for (const item of renderItems) {
    if (item.type === 'message' && 'text' in item.block && typeof item.block.text === 'string') {
      for (const runId of readRawRunCallbackLinkedRunIds(item.block.text)) {
        next.add(buildInlineRunExpansionKey(item.index, runId));
      }
      continue;
    }

    if (item.type === 'trace_cluster') {
      for (const run of collectTraceClusterLinkedRuns(item.blocks)) {
        next.add(buildInlineRunExpansionKey(item.startIndex, run.runId));
      }
    }
  }

  return next;
}

export function readFirstVisibleInlineRunKey(renderItems: ChatRenderItem[]): string | null {
  return collectVisibleInlineRunKeys(renderItems).values().next().value ?? null;
}

export function filterInlineRunKeys(current: ReadonlySet<string>, visibleInlineRunKeySet: ReadonlySet<string>): ReadonlySet<string> {
  if (current.size === 0) {
    return current;
  }

  let changed = false;
  const next = new Set<string>();
  for (const inlineRunKey of current) {
    if (visibleInlineRunKeySet.has(inlineRunKey)) {
      next.add(inlineRunKey);
    } else {
      changed = true;
    }
  }

  return changed ? next : current;
}

export function toggleInlineRunKey(current: ReadonlySet<string>, inlineRunKey: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(inlineRunKey)) {
    next.delete(inlineRunKey);
  } else {
    next.add(inlineRunKey);
  }
  return next;
}

export function useInlineTraceRunExpansion(renderItems: ChatRenderItem[]) {
  const [expandedInlineRunKeys, setExpandedInlineRunKeys] = useState<ReadonlySet<string>>(() => new Set());
  const firstVisibleInlineRunKey = useMemo(() => readFirstVisibleInlineRunKey(renderItems), [renderItems]);

  useEffect(() => {
    setExpandedInlineRunKeys((current) => {
      if (current.size === 0) {
        return current;
      }

      return filterInlineRunKeys(current, collectVisibleInlineRunKeys(renderItems));
    });
  }, [renderItems]);

  const isInlineRunExpanded = useCallback((inlineRunKey: string) => expandedInlineRunKeys.has(inlineRunKey), [expandedInlineRunKeys]);

  const toggleInlineRun = useCallback((inlineRunKey: string) => {
    setExpandedInlineRunKeys((current) => toggleInlineRunKey(current, inlineRunKey));
  }, []);

  const toggleFirstInlineRun = useCallback(() => {
    if (!firstVisibleInlineRunKey) {
      return false;
    }
    setExpandedInlineRunKeys((current) => toggleInlineRunKey(current, firstVisibleInlineRunKey));
    return true;
  }, [firstVisibleInlineRunKey]);

  const expandInlineRun = useCallback((inlineRunKey: string) => {
    setExpandedInlineRunKeys((current) => (current.has(inlineRunKey) ? current : new Set(current).add(inlineRunKey)));
  }, []);

  return {
    isInlineRunExpanded,
    toggleInlineRun,
    toggleFirstInlineRun,
    hasVisibleInlineRuns: Boolean(firstVisibleInlineRunKey),
    expandInlineRun,
  };
}
