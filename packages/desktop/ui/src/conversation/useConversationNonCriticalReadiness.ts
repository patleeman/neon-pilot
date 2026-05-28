import { useEffect, useState } from 'react';

export interface ConversationNonCriticalReadinessOptions {
  conversationKey: string;
  metadataFallbackMs: number;
  shelvesDeferMs: number;
  modelsDeferMs: number;
}

export interface ConversationNonCriticalReadiness {
  metadataReady: boolean;
  shelvesReady: boolean;
  modelsReady: boolean;
}

type IdleCallbackHandle = number;
type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

interface IdleWindow {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
}

const COMPOSER_SHELVES_IDLE_TIMEOUT_MS = 120;
const CONVERSATION_MODELS_IDLE_TIMEOUT_MS = 1_000;

function scheduleNonCriticalReady(delayMs: number, idleTimeoutMs: number, callback: () => void): () => void {
  let cancelled = false;
  let idleHandle: IdleCallbackHandle | null = null;
  const timeout = window.setTimeout(() => {
    if (cancelled) {
      return;
    }

    const idleWindow = window as Window & IdleWindow;
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(
        () => {
          if (!cancelled) {
            callback();
          }
        },
        { timeout: idleTimeoutMs },
      );
      return;
    }

    callback();
  }, delayMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timeout);
    if (idleHandle !== null) {
      (window as Window & IdleWindow).cancelIdleCallback?.(idleHandle);
    }
  };
}

export function useConversationNonCriticalReadiness({
  conversationKey,
  metadataFallbackMs,
  shelvesDeferMs,
  modelsDeferMs,
}: ConversationNonCriticalReadinessOptions): ConversationNonCriticalReadiness {
  const [metadataReady, setMetadataReady] = useState(false);
  const [shelvesReady, setShelvesReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    setMetadataReady(false);
    setShelvesReady(false);
    setModelsReady(false);
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    const fallbackTimeout = window.setTimeout(() => {
      if (!cancelled) setMetadataReady(true);
    }, metadataFallbackMs);

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (!cancelled) setMetadataReady(true);
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimeout);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [conversationKey, metadataFallbackMs]);

  useEffect(() => {
    if (!metadataReady) {
      setShelvesReady(false);
      setModelsReady(false);
      return;
    }

    const cancelShelvesReady = scheduleNonCriticalReady(shelvesDeferMs, COMPOSER_SHELVES_IDLE_TIMEOUT_MS, () => setShelvesReady(true));
    const cancelModelsReady = scheduleNonCriticalReady(modelsDeferMs, CONVERSATION_MODELS_IDLE_TIMEOUT_MS, () => setModelsReady(true));

    return () => {
      cancelShelvesReady();
      cancelModelsReady();
    };
  }, [metadataReady, modelsDeferMs, shelvesDeferMs]);

  return { metadataReady, shelvesReady, modelsReady };
}
