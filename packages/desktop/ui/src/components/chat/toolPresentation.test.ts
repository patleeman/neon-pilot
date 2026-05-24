import { describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import {
  getStreamingStatusLabel,
  normalizeConversationTranscriptDisclosureMode,
  resolveConversationBlockAutoOpen,
  resolveDisclosureOpen,
  shouldAutoOpenConversationBlock,
  shouldAutoOpenTraceCluster,
  stripAnsiForTranscript,
  toggleDisclosurePreference,
  toolMeta,
} from './toolPresentation.js';

describe('toolPresentation', () => {
  it('resolves known and unknown tool metadata', () => {
    expect(toolMeta('bash')).toMatchObject({ icon: '$', label: 'bash', tone: 'steel' });
    expect(toolMeta('custom_tool')).toMatchObject({ icon: '⚙', label: 'custom_tool', tone: 'muted' });
  });

  it('strips ANSI control sequences from transcript output', () => {
    expect(stripAnsiForTranscript('\u001B[1m\u001B[46m RUN \u001B[49m\u001B[22m vitest\n\u001B[31mfailed\u001B[39m')).toBe(
      ' RUN  vitest\nfailed',
    );
    expect(stripAnsiForTranscript('\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007')).toBe('link');
  });

  it('resolves disclosure preferences over auto state', () => {
    expect(resolveDisclosureOpen(true, 'auto')).toBe(true);
    expect(resolveDisclosureOpen(false, 'auto')).toBe(false);
    expect(resolveDisclosureOpen(false, 'open')).toBe(true);
    expect(resolveDisclosureOpen(true, 'closed')).toBe(false);
    // Clicking an auto-opened item makes the open preference explicit
    // instead of collapsing it (user was "looking at it").
    expect(toggleDisclosurePreference(true, 'auto')).toBe('open');
    expect(toggleDisclosurePreference(false, 'auto')).toBe('open');
  });

  it('auto-opens trace clusters while live or running', () => {
    expect(shouldAutoOpenTraceCluster(true, false)).toBe(true);
    expect(shouldAutoOpenTraceCluster(false, true)).toBe(true);
    expect(shouldAutoOpenTraceCluster(false, false)).toBe(false);
  });

  it('auto-opens running tool blocks and latest streaming thinking blocks', () => {
    const runningTool: MessageBlock = {
      type: 'tool_use',
      ts: '2026-04-26T00:00:00.000Z',
      tool: 'bash',
      input: {},
      output: '',
      status: 'running',
    };
    const thinking: MessageBlock = { type: 'thinking', ts: '2026-04-26T00:00:00.000Z', text: 'thinking' };

    expect(shouldAutoOpenConversationBlock(runningTool, 0, 2, false)).toBe(true);
    expect(shouldAutoOpenConversationBlock(thinking, 1, 2, true)).toBe(true);
    expect(shouldAutoOpenConversationBlock(thinking, 0, 2, true)).toBe(false);
  });

  it('can force transcript tool and thinking details expanded', () => {
    const completedTool: MessageBlock = {
      type: 'tool_use',
      ts: '2026-04-26T00:00:00.000Z',
      tool: 'bash',
      input: {},
      output: 'done',
      status: 'done',
    };
    const thinking: MessageBlock = { type: 'thinking', ts: '2026-04-26T00:00:00.000Z', text: 'thinking' };
    const text: MessageBlock = { type: 'text', ts: '2026-04-26T00:00:00.000Z', text: 'answer' };

    expect(normalizeConversationTranscriptDisclosureMode('expanded')).toBe('expanded');
    expect(normalizeConversationTranscriptDisclosureMode('bogus')).toBe('auto');
    expect(resolveConversationBlockAutoOpen(completedTool, 0, 3, false, 'auto')).toBe(false);
    expect(resolveConversationBlockAutoOpen(completedTool, 0, 3, false, 'expanded')).toBe(true);
    expect(resolveConversationBlockAutoOpen(thinking, 0, 3, false, 'expanded')).toBe(true);
    expect(resolveConversationBlockAutoOpen(text, 2, 3, false, 'expanded')).toBe(false);
  });

  it('describes streaming state from the latest block', () => {
    expect(getStreamingStatusLabel([], false)).toBeNull();
    expect(getStreamingStatusLabel([], true)).toBe('Working…');
    expect(getStreamingStatusLabel([{ type: 'text', ts: '2026-04-26T00:00:00.000Z', text: 'hi' }], true)).toBe('Responding…');
    expect(
      getStreamingStatusLabel(
        [
          {
            type: 'tool_use',
            ts: '2026-04-26T00:00:00.000Z',
            tool: 'bash',
            input: {},
            output: '',
            status: 'running',
          },
        ],
        true,
      ),
    ).toBe('Running bash…');
    expect(
      getStreamingStatusLabel(
        [{ type: 'subagent', ts: '2026-04-26T00:00:00.000Z', name: 'reviewer', prompt: '', status: 'running' }],
        true,
      ),
    ).toBe('Running reviewer…');
  });
});
