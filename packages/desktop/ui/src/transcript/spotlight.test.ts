// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { spotlightTranscriptTarget, transcriptTargetAttributes, transcriptTargetSelector } from './spotlight';

describe('transcript spotlight', () => {
  it('builds extension target attrs and selectors', () => {
    const target = { kind: 'extension' as const, extensionId: 'demo.ext', targetId: 'row-1' };

    expect(transcriptTargetAttributes(target)).toEqual({
      'data-transcript-target': 'extension:demo.ext:row-1',
      'data-transcript-extension-id': 'demo.ext',
      'data-transcript-extension-target-id': 'row-1',
    });
    expect(transcriptTargetSelector(target)).toContain('data-transcript-extension-id');
  });

  it('scrolls, focuses, and flashes a matching target', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const target = document.createElement('button');
    target.setAttribute('data-background-run-id', 'run-demo');
    document.body.append(target);

    expect(spotlightTranscriptTarget({ kind: 'background_run', runId: 'run-demo' })).toBe(true);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    expect(document.activeElement).toBe(target);
    expect(target.classList.contains('pa-transcript-spotlight')).toBe(true);

    target.remove();
  });
});
