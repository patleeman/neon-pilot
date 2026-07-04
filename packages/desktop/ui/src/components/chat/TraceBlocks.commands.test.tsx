// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { TraceClusterBlock } from './TraceBlocks';
import {
  TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT,
  TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT,
  type TraceClusterCommandDetail,
} from './traceClusterCommands';
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

    expect(container.textContent).toContain('1 step');
    expect(container.querySelector('.ui-trace-cluster')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster')?.getAttribute('data-open')).toBeNull();
    expect(container.querySelector('.ui-trace-cluster__summary')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster__summary-button')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster__step-count')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster__categories')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster__toggle')).not.toBeNull();
    expect(container.querySelector('.ui-trace-cluster__rule')).not.toBeNull();
    expect(container.textContent).toContain('show');
    expect(container.textContent).not.toContain('first trace detail');

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('hide');
    expect(container.textContent).toContain('first trace detail');
    expect(container.querySelector('.ui-trace-cluster')?.getAttribute('data-open')).toBe('true');
    expect(container.querySelector('.ui-trace-cluster__body')).not.toBeNull();
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

  it('toggles the first trace cluster overflow from the shared command event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const blocks = Array.from({ length: 6 }, (_, index) => thinkingBlock(`trace detail ${index + 1}`));

    act(() => {
      root?.render(renderTraceCluster(blocks));
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('1 earlier step summarized above.');
    expect(container.querySelector('.ui-trace-cluster__overflow')).not.toBeNull();
    expect(container.textContent).not.toContain('trace detail 1');
    expect(container.textContent).toContain('trace detail 6');

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('Showing all 6 steps.');
    expect(container.textContent).toContain('Show latest 5');
    expect(container.textContent).toContain('trace detail 1');

    act(() => {
      window.dispatchEvent(new CustomEvent<TraceClusterCommandDetail>(TRACE_CLUSTER_TOGGLE_FIRST_OVERFLOW_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('1 earlier step summarized above.');
    expect(container.textContent).not.toContain('trace detail 1');
  });
});
