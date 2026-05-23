import { describe, expect, it, vi } from 'vitest';

import { hasBlockingOverlayOpen } from './conversationBlockingOverlay';

describe('conversationBlockingOverlay', () => {
  it('delegates to the overlay detector when document is available', () => {
    const detector = vi.fn(() => true);
    expect(hasBlockingOverlayOpen(detector, true)).toBe(true);
    expect(detector).toHaveBeenCalledOnce();
  });

  it('returns false when document is unavailable or detector reports no overlay', () => {
    const detector = vi.fn(() => true);
    expect(hasBlockingOverlayOpen(detector, false)).toBe(false);
    expect(detector).not.toHaveBeenCalled();
    expect(hasBlockingOverlayOpen(() => false, true)).toBe(false);
  });
});
