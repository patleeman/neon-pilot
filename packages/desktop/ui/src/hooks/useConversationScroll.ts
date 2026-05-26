import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { recordClientPerfTiming } from '../client/perfDiagnostics';
import {
  getConversationBottomScrollTop,
  getConversationPrependRestoreScrollTop,
  isConversationScrolledToBottom,
  isConversationScrollOverflowing,
} from '../conversation/conversationScroll';
import type { MessageBlock } from '../shared/types';

interface UseConversationScrollOptions {
  conversationId: string | null;
  messages: MessageBlock[] | undefined;
  scrollRef: RefObject<HTMLDivElement>;
  sessionLoading: boolean;
  isStreaming: boolean;
  initialScrollKey: string | null;
  prependRestoreKey?: string | number | null;
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

export function useConversationScroll({
  conversationId,
  messages,
  scrollRef,
  initialScrollKey,
  prependRestoreKey,
}: UseConversationScrollOptions): UseConversationScrollResult {
  const [atBottom, setAtBottom] = useState(true);
  const pinnedToBottomRef = useRef(true);
  const completedInitialScrollKeyRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef(0);
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

  useLayoutEffect(() => {
    cancelScheduledScroll();
    pendingPrependRestoreRef.current = null;
    completedInitialScrollKeyRef.current = null;
    lastMessageCountRef.current = messages?.length ?? 0;
    lastScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
    pinnedToBottomRef.current = true;
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

  useLayoutEffect(
    () => () => {
      cancelScheduledScroll();
    },
    [cancelScheduledScroll],
  );

  useLayoutEffect(() => {
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

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [cancelScheduledScroll, scrollRef]);

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    const messageCount = messages?.length ?? 0;
    const el = scrollRef.current;
    if (!el) {
      lastMessageCountRef.current = messageCount;
      return;
    }

    if (initialScrollKey && messageCount > 0 && completedInitialScrollKeyRef.current !== initialScrollKey) {
      completedInitialScrollKeyRef.current = initialScrollKey;
      scrollToBottom();
      lastMessageCountRef.current = messageCount;
      return;
    }

    const scrollHeightChanged = el.scrollHeight !== lastScrollHeightRef.current;
    if ((messageCount > lastMessageCountRef.current || scrollHeightChanged) && pinnedToBottomRef.current) {
      setBottom(el);
      setAtBottom(true);
    } else {
      setAtBottom(readAtBottom(el));
    }

    lastMessageCountRef.current = messageCount;
    lastScrollHeightRef.current = el.scrollHeight;
  }, [initialScrollKey, messages, scrollRef, scrollToBottom]);

  return {
    atBottom,
    syncScrollStateFromDom,
    scrollToBottom,
    capturePrependRestore,
  };
}
