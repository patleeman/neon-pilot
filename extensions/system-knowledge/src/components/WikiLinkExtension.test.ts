// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { buildWikiLinkExtension } from './WikiLinkExtension.js';

const entries = [
  { id: 'note.md', kind: 'file', name: 'note.md' },
  { id: 'docs/Plan.md', kind: 'file', name: 'Plan.md' },
  { id: 'folder', kind: 'folder', name: 'folder' },
] as never[];

describe('WikiLinkExtension', () => {
  it('tokenizes and renders wiki link markdown with optional labels', () => {
    const extension = buildWikiLinkExtension(() => entries, vi.fn(), vi.fn());
    const tokenizer = extension.config.markdownTokenizer as { tokenize(src: string): unknown };

    expect(tokenizer.tokenize('[[note]] rest')).toEqual({ type: 'wikiLink', raw: '[[note]]', target: 'note', label: null, tokens: [] });
    expect(tokenizer.tokenize('[[docs/Plan|Project plan]]')).toEqual({
      type: 'wikiLink',
      raw: '[[docs/Plan|Project plan]]',
      target: 'docs/Plan',
      label: 'Project plan',
      tokens: [],
    });
    expect(tokenizer.tokenize('[not a wiki link]')).toBeUndefined();

    expect(extension.config.parseMarkdown?.({ target: 'note', label: null })).toEqual({
      type: 'wikiLink',
      attrs: { target: 'note', label: null },
    });
    expect(extension.config.renderMarkdown?.({ attrs: { target: 'note', label: null } })).toBe('[[note]]');
    expect(extension.config.renderMarkdown?.({ attrs: { target: 'note', label: 'Note' } })).toBe('[[note|Note]]');
  });

  it('renders HTML spans with wiki link data and label fallback', () => {
    const extension = buildWikiLinkExtension(() => entries, vi.fn(), vi.fn());

    expect(
      extension.config.renderHTML?.({ node: { attrs: { target: 'note', label: 'Note' } }, HTMLAttributes: { class: 'existing' } } as never),
    ).toEqual(['span', { class: 'existing kb-wikilink', 'data-wikilink': 'note' }, 'Note']);
    expect(extension.config.parseHTML?.()).toEqual([{ tag: 'span[data-wikilink]' }]);
  });

  it('marks existing and missing node views and navigates existing files on click', () => {
    const navigate = vi.fn();
    const extension = buildWikiLinkExtension(() => entries, navigate, vi.fn());
    const addNodeView = extension.config.addNodeView?.bind({});
    const createView = addNodeView?.() as (props: { node: { attrs: { target: string; label?: string | null } } }) => {
      dom: HTMLElement;
      update(): boolean;
    };

    const existing = createView({ node: { attrs: { target: 'note', label: 'Read me' } } });
    expect(existing.dom.className).toBe('kb-wikilink');
    expect(existing.dom.getAttribute('title')).toBe('Open note');
    expect(existing.dom.textContent).toBe('Read me');
    existing.dom.click();
    expect(navigate).toHaveBeenCalledWith('note.md');
    expect(existing.update()).toBe(true);

    const missing = createView({ node: { attrs: { target: 'missing', label: null } } });
    expect(missing.dom.className).toBe('kb-wikilink kb-wikilink-broken');
    expect(missing.dom.getAttribute('title')).toBe('"missing" not found');
    missing.dom.click();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
