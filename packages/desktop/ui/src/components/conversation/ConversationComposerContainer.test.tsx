import { parseFragment } from 'parse5';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConversationComposerContainer } from './ConversationComposerContainer';

type ParsedNode = {
  nodeName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: ParsedNode[];
};

function classList(node: ParsedNode): string[] {
  return (node.attrs?.find((attr) => attr.name === 'class')?.value ?? '').split(/\s+/).filter(Boolean);
}

function findByClass(node: ParsedNode, className: string): ParsedNode | null {
  if (classList(node).includes(className)) return node;
  for (const child of node.childNodes ?? []) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

describe('ConversationComposerContainer', () => {
  it('renders shelves inside the bordered input shell', () => {
    const html = renderToString(
      <ConversationComposerContainer
        dragOver={false}
        hasInteractiveOverlay={false}
        shelves={<div className="test-shelf">Attachment</div>}
        inputControls={<div className="test-input">Input</div>}
      />,
    );
    const root = parseFragment(html) as ParsedNode;
    const shell = findByClass(root, 'ui-input-shell');
    const shelf = findByClass(root, 'test-shelf');
    const shellShelf = shell ? findByClass(shell, 'test-shelf') : null;

    expect(shell).not.toBeNull();
    expect(shelf).not.toBeNull();
    expect(shellShelf).not.toBeNull();
    expect(html.indexOf('ui-input-shell')).toBeLessThan(html.indexOf('test-shelf'));
  });

  it('uses compact padding for rail layout', () => {
    const html = renderToString(
      <ConversationComposerContainer
        layout="rail"
        dragOver={false}
        hasInteractiveOverlay={false}
        inputControls={<div className="test-input">Input</div>}
      />,
    );

    expect(html).toContain('px-1.5');
    expect(html).toContain('py-3');
  });
});
