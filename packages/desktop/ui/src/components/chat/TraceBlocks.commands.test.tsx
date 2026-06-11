// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { TraceClusterBlock } from './TraceBlocks';
import { TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, type TraceClusterCommandDetail } from './traceClusterCommands';
import type { TraceClusterSummary, TraceConversationBlock } from './transcriptItems';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function thinkingBlock(text: string): Extract<MessageBlock, { type: 'thinking' }> {
  return {
    type: 'thinking',
    id: `thinking-${text}`,
    ts: '2026-06-11T12:00:00.000Z',
    text,
  };
}

function summaryFor(blocks: TraceConversationBlock[]): TraceClusterSummary {
  return {
    stepCount: blocks.length,
    categories: [{ key: 'thinking', kind: 'thinking', label: 'Thinking', count: blocks.length }],
    durationMs: null,
    hasError: false,
    hasRunning: false,
  };
}

function renderTraceCluster(blocks: TraceConversationBlock[]) {
  return (
    <TraceClusterBlock
      blocks={blocks}
      summary={summaryFor(blocks)}
      live={false}
      transcriptDisclosureMode="collapsed"
      diffDisclosureMode="collapsed"
      showPinnedToolCalls={false}
    />
  );
}

describe('TraceClusterBlock commands', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles the first visible trace cluster from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(renderTraceCluster([thinkingBlock('first trace detail')]));
    });

    expect(container.textContent).toContain('Internal work');
    expect(container.textContent).toContain('show');
    expect(container.textContent).not.toContain('first trace detail');

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('hide');
    expect(container.textContent).toContain('first trace detail');
  });

  it('lets only the first mounted trace cluster handle one shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          {renderTraceCluster([thinkingBlock('first trace detail')])}
          {renderTraceCluster([thinkingBlock('second trace detail')])}
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('first trace detail');
    expect(container.textContent).not.toContain('second trace detail');
  });
});
