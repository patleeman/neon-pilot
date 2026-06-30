import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { recordClientPerfTiming } from '../client/perfDiagnostics';
import {
  getConversationBottomScrollTop,
  getConversationPrependRestoreScrollTop,
  getConversationStreamingTurnAnchorMessageIndex,
  getConversationTailBlockKey,
  isConversationScrolledToBottom,
  isConversationScrollOverflowing,
  isConversationTailVisibleAtBottom,
  scrollConversationMessageIntoView,
  shouldAutoScrollToStreamingTail,
} from '../conversation/conversationScroll';
import type { MessageBlock } from '../shared/types';

const useConversationScrollLayoutEffect =
  typeof window === 'undefined' || /\b(jsdom|happy-dom)\b/i.test(window.navigator?.userAgent ?? '') ? useEffect : useLayoutEffect;

interface UseConversationScrollOptions {
  conversationId: string | null;
  messages: MessageBlock[] | undefined;
  scrollRef: RefObject<HTMLDivElement>;
  sessionLoading: boolean;
  isStreaming: boolean;
  initialScrollKey: string | null;
  prependRestoreKey?: string | number | null;
  messageIndexOffset?: number;
}

interface UseConversationScrollResult {
  atBottom: boolean;
  syncScrollStateFromDom: () => void;
  scrollToBottom: (options?: { behavior?: ScrollBehavior; force?: boolean }) => void;
  capturePrependRestore: () => void;
}

function readAtBottom(el: HTMLDivElement): boolean {
  if (!isConversationScrollOverflowing({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })) {
    return true;
  }

  // When the last message element is visible at the container bottom, treat
  // the view as pinned even if CSS padding-bottom extends the scroll area.
  // This prevents a false "not at bottom" when bottom padding (e.g. 96px
  // padding to keep messages above the input area) creates extra scroll space
  // that has no actual content.
  if (isConversationTailVisibleAtBottom(el)) {
    return true;
  }

  return isConversationScrolledToBottom({
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
  });
}

function setBottom(el: HTMLDivElement, behavior: ScrollBehavior = 'auto') {
  const top = getConversationBottomScrollTop({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top, behavior });
    return;
  }

  el.scrollTop = top;
}

function isReaderKeyboardIntent(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    (event.target instanceof HTMLElement && event.target.isContentEditable)
  ) {
    return false;
  }

  return new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']).has(event.key);
}

function selectionTouchesElement(selection: Selection, el: HTMLElement): boolean {
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  return Boolean((anchorNode && el.contains(anchorNode)) || (focusNode && el.contains(focusNode)));
}

export function useConversationScroll({
  conversationId,
  messages,
  scrollRef,
  isStreaming,
  initialScrollKey,
  prependRestoreKey,
  messageIndexOffset = 0,
}: UseConversationScrollOptions): UseConversationScrollResult {
  const [atBottom, setAtBottom] = useState(true);
  const pinnedToBottomRef = useRef(true);
  const tailFollowingRef = useRef(false);
  const completedInitialScrollKeyRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastTailKeyRef = useRef<string | null>(null);
  const pendingPrependRestoreRef = useRef<{
    conversationId: string;
    scrollHeight: number;
    scrollTop: number;
    stickToBottom: boolean;
  } | null>(null);
  const scrollFrameRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  const cancelScheduledScroll = useCallback(() => {
    if (scrollFrameRef.current !== 0) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = 0;
    }
  }, []);

  const syncScrollStateFromDom = useCallback(() => {
    const el = scrollRef.current;
    const nextAtBottom = el ? readAtBottom(el) : true;
    pinnedToBottomRef.current = nextAtBottom;
    setAtBottom(nextAtBottom);
  }, [scrollRef]);

  const scrollToBottom = useCallback(
    (options?: { behavior?: ScrollBehavior; force?: boolean }) => {
      const el = scrollRef.current;
      if (!el) {
        return;
      }

      if (!options?.force && !pinnedToBottomRef.current) {
        return;
      }

      pinnedToBottomRef.current = true;
      if (options?.force) {
        tailFollowingRef.current = true;
      }
      setAtBottom(true);
      cancelScheduledScroll();
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = 0;
        const current = scrollRef.current;
        if (!current) {
          return;
        }
        setBottom(current, options?.behavior ?? 'auto');
      });
    },
    [cancelScheduledScroll, scrollRef],
  );

  const capturePrependRestore = useCallback(() => {
    if (!conversationId) {
      return;
    }

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    pendingPrependRestoreRef.current = {
      conversationId,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      stickToBottom: pinnedToBottomRef.current,
    };
  }, [conversationId, scrollRef]);

  useConversationScrollLayoutEffect(() => {
    cancelScheduledScroll();
    pendingPrependRestoreRef.current = null;
    completedInitialScrollKeyRef.current = null;
    lastMessageCountRef.current = messages?.length ?? 0;
    lastTailKeyRef.current = getConversationTailBlockKey(messages?.[Math.max(0, (messages?.length ?? 0) - 1)]);
    lastScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
    pinnedToBottomRef.current = true;
    tailFollowingRef.current = false;
    setAtBottom(true);

    const frame = window.requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) {
        return;
      }
      setBottom(el);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cancelScheduledScroll, conversationId, scrollRef]);

  useConversationScrollLayoutEffect(
    () => () => {
      cancelScheduledScroll();
    },
    [cancelScheduledScroll],
  );

  useConversationScrollLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const detach = () => {
      if (!isConversationScrollOverflowing({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })) {
        pinnedToBottomRef.current = true;
        setAtBottom(true);
        return;
      }

      pinnedToBottomRef.current = false;
      tailFollowingRef.current = false;
      setAtBottom(false);
      cancelScheduledScroll();
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && pinnedToBottomRef.current) {
        detach();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!pinnedToBottomRef.current) {
        return;
      }

      if (event.clientX >= el.getBoundingClientRect().left + el.clientWidth) {
        return;
      }

      detach();
    };

    const handleTouchStart = () => {
      if (pinnedToBottomRef.current) {
        detach();
      }
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed && selectionTouchesElement(selection, el)) {
        detach();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pinnedToBottomRef.current && isReaderKeyboardIntent(event)) {
        detach();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('pointerdown', handlePointerDown, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelScheduledScroll, scrollRef]);

  useConversationScrollLayoutEffect(() => {
    const startedAtMs = performance.now();
    const pendingRestore = pendingPrependRestoreRef.current;
    if (!pendingRestore || !conversationId || pendingRestore.conversationId !== conversationId) {
      return;
    }

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const previousScrollHeight = pendingRestore.scrollHeight;
    const previousScrollTop = pendingRestore.scrollTop;
    const nextScrollHeight = el.scrollHeight;
    const nextClientHeight = el.clientHeight;
    const nextScrollTop = getConversationPrependRestoreScrollTop({
      previousScrollHeight: pendingRestore.scrollHeight,
      previousScrollTop: pendingRestore.scrollTop,
      nextScrollHeight,
      nextClientHeight,
      stickToBottom: pendingRestore.stickToBottom,
    });
    el.scrollTop = nextScrollTop;
    pinnedToBottomRef.current = pendingRestore.stickToBottom;
    setAtBottom(pendingRestore.stickToBottom ? true : readAtBottom(el));
    pendingPrependRestoreRef.current = null;

    recordClientPerfTiming({
      name: 'conversation.prependRestoreLayout',
      startedAtMs,
      minDurationMs: 8,
      meta: {
        conversationId,
        messageCount: messages?.length ?? 0,
        nextClientHeight,
        nextScrollHeight,
        nextScrollTop,
        prependRestoreKey: prependRestoreKey ?? null,
        previousScrollHeight,
        previousScrollTop,
        stickToBottom: pendingRestore.stickToBottom,
      },
    });
  }, [conversationId, messages, prependRestoreKey, scrollRef]);

  useConversationScrollLayoutEffect(() => {
    const messageCount = messages?.length ?? 0;
    const el = scrollRef.current;
    const tailBlock = messages?.[Math.max(0, messageCount - 1)] ?? null;
    const nextTailKey = getConversationTailBlockKey(tailBlock);
    const previousTailKey = lastTailKeyRef.current;
    const finishSync = () => {
      lastMessageCountRef.current = messageCount;
      lastTailKeyRef.current = nextTailKey;
      lastScrollHeightRef.current = el?.scrollHeight ?? 0;
    };

    if (!el) {
      finishSync();
      return;
    }

    if (initialScrollKey && messageCount > 0 && completedInitialScrollKeyRef.current !== initialScrollKey) {
      completedInitialScrollKeyRef.current = initialScrollKey;
      scrollToBottom();
      finishSync();
      return;
    }

    const scrollHeightChanged = el.scrollHeight !== lastScrollHeightRef.current;
    const messageCountIncreased = messageCount > lastMessageCountRef.current;
    const streamingTurnAnchorIndex = getConversationStreamingTurnAnchorMessageIndex(messages, messageIndexOffset);
    if (
      isStreaming &&
      messageCountIncreased &&
      pinnedToBottomRef.current &&
      !tailFollowingRef.current &&
      streamingTurnAnchorIndex !== null &&
      scrollConversationMessageIntoView(el, streamingTurnAnchorIndex, { block: 'start' })
    ) {
      pinnedToBottomRef.current = false;
      tailFollowingRef.current = false;
      setAtBottom(false);
      finishSync();
      return;
    }

    const shouldKeepFollowingTail =
      pinnedToBottomRef.current &&
      (!isStreaming || tailFollowingRef.current || shouldAutoScrollToStreamingTail(previousTailKey, tailBlock));

    if ((messageCountIncreased || scrollHeightChanged) && shouldKeepFollowingTail) {
      setBottom(el);
      setAtBottom(true);
    } else if (!pinnedToBottomRef.current) {
      setAtBottom(false);
    } else {
      setAtBottom(readAtBottom(el));
    }

    finishSync();
  }, [initialScrollKey, isStreaming, messageIndexOffset, messages, scrollRef, scrollToBottom]);

  return {
    atBottom,
    syncScrollStateFromDom,
    scrollToBottom,
    capturePrependRestore,
  };
}
