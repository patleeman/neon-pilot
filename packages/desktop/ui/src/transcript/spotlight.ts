export type TranscriptSpotlightTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'tool_call'; blockId: string }
  | { kind: 'background_run'; runId: string }
  | { kind: 'extension'; extensionId: string; targetId: string };

export interface TranscriptSpotlightOptions {
  expand?: boolean;
}

const SPOTLIGHT_CLASS = 'pa-transcript-spotlight';
const SPOTLIGHT_DURATION_MS = 1600;

function escapeAttr(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

export function transcriptTargetAttributes(target: TranscriptSpotlightTarget): Record<string, string> {
  switch (target.kind) {
    case 'block':
      return { 'data-transcript-target': `block:${target.blockId}`, 'data-transcript-block-id': target.blockId };
    case 'tool_call':
      return { 'data-transcript-target': `tool_call:${target.blockId}`, 'data-transcript-tool-call-id': target.blockId };
    case 'background_run':
      return { 'data-transcript-target': `background_run:${target.runId}`, 'data-background-run-id': target.runId };
    case 'extension':
      return {
        'data-transcript-target': `extension:${target.extensionId}:${target.targetId}`,
        'data-transcript-extension-id': target.extensionId,
        'data-transcript-extension-target-id': target.targetId,
      };
  }
}

export function transcriptTargetSelector(target: TranscriptSpotlightTarget): string {
  switch (target.kind) {
    case 'block':
      return `[data-transcript-block-id="${escapeAttr(target.blockId)}"], [data-transcript-target="block:${escapeAttr(target.blockId)}"]`;
    case 'tool_call':
      return `[data-transcript-tool-call-id="${escapeAttr(target.blockId)}"], [data-transcript-target="tool_call:${escapeAttr(target.blockId)}"]`;
    case 'background_run':
      return `[data-background-run-id="${escapeAttr(target.runId)}"], [data-transcript-target="background_run:${escapeAttr(target.runId)}"]`;
    case 'extension':
      return `[data-transcript-extension-id="${escapeAttr(target.extensionId)}"][data-transcript-extension-target-id="${escapeAttr(
        target.targetId,
      )}"], [data-transcript-target="extension:${escapeAttr(target.extensionId)}:${escapeAttr(target.targetId)}"]`;
  }
}

export function spotlightTranscriptElement(element: Element): void {
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
  if (element instanceof HTMLElement) {
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }
    element.classList.remove(SPOTLIGHT_CLASS);
    void element.offsetWidth;
    element.classList.add(SPOTLIGHT_CLASS);
    window.setTimeout(() => element.classList.remove(SPOTLIGHT_CLASS), SPOTLIGHT_DURATION_MS);
  }
}

export function spotlightTranscriptTarget(target: TranscriptSpotlightTarget): boolean {
  const element = document.querySelector(transcriptTargetSelector(target));
  if (!element) return false;
  spotlightTranscriptElement(element);
  return true;
}

export function dispatchTranscriptSpotlight(target: TranscriptSpotlightTarget, options?: TranscriptSpotlightOptions): void {
  window.dispatchEvent(new CustomEvent('pa:transcript-spotlight', { detail: { target, options } }));
}
