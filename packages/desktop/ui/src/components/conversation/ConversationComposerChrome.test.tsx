import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  BrowsePathButton,
  ChatBubbleIcon,
  ComposerActionIcon,
  FolderIcon,
  resolveConversationComposerShellStateClassName,
} from './ConversationComposerChrome';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('ConversationComposerChrome', () => {
  it('renders composer chrome icons and path button markup', () => {
    expect(renderToString(<FolderIcon className="folder" />)).toContain('folder');
    expect(renderToString(<ChatBubbleIcon className="chat" />)).toContain('chat');
    expect(renderToString(<ComposerActionIcon label="Follow up" className="follow" />)).toContain('follow');

    const browseHtml = renderToString(
      <BrowsePathButton busy title="Choose workspace folder" ariaLabel="Choose workspace folder" onClick={vi.fn()} />,
    );
    expect(browseHtml).toContain('Choose workspace folder');
    expect(browseHtml).toContain('disabled=""');
    expect(browseHtml).toContain('animate-pulse');
  });

  it('prioritizes composer shell state classes', () => {
    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: true,
        hasInteractiveOverlay: true,
        autoModeEnabled: true,
      }),
    ).toContain('ui-composer-state-focus');

    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: true,
        autoModeEnabled: true,
      }),
    ).toContain('ui-composer-state-drag');

    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: false,
        autoModeEnabled: true,
      }),
    ).toContain('ui-input-shell-auto-mode');

    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: false,
        autoModeEnabled: true,
        runMode: 'mission',
      }),
    ).toContain('ui-input-shell-mission');

    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: false,
        autoModeEnabled: true,
        runMode: 'loop',
      }),
    ).toContain('ui-input-shell-loop');

    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: false,
        autoModeEnabled: false,
      }),
    ).toBe('border-border-subtle');
  });

  it('applies streaming shell class when streaming', () => {
    const result = resolveConversationComposerShellStateClassName({
      dragOver: false,
      hasInteractiveOverlay: false,
      streamIsStreaming: true,
    });

    expect(result).toContain('ui-input-shell-streaming');
    expect(result).toContain('ui-composer-state-streaming');
  });

  it('streaming shell class takes priority over auto-mode', () => {
    const result = resolveConversationComposerShellStateClassName({
      dragOver: false,
      hasInteractiveOverlay: false,
      streamIsStreaming: true,
      autoModeEnabled: true,
      runMode: 'mission',
    });

    // Streaming takes priority — no auto-mode/mission classes
    expect(result).toContain('ui-input-shell-streaming');
    expect(result).not.toContain('ui-input-shell-auto-mode');
    expect(result).not.toContain('ui-input-shell-mission');
  });

  it('respects priority: dragOver > interactiveOverlay > streaming > auto-mode > default', () => {
    // drag takes priority over everything
    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: true,
        hasInteractiveOverlay: true,
        streamIsStreaming: true,
        autoModeEnabled: true,
      }),
    ).toContain('ui-composer-state-focus');

    // interactive overlay yields when drag is false
    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: true,
        streamIsStreaming: true,
        autoModeEnabled: true,
      }),
    ).toContain('ui-composer-state-drag');

    // streaming yields when both drag and overlay are false
    expect(
      resolveConversationComposerShellStateClassName({
        dragOver: false,
        hasInteractiveOverlay: false,
        streamIsStreaming: true,
        autoModeEnabled: true,
      }),
    ).toContain('ui-input-shell-streaming');
  });
});
