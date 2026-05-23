import { describe, expect, it } from 'vitest';

import { extractUserContent } from './sessionUserContent';

const tinyPng = 'iVBORw0KGgo=';

describe('sessionUserContent', () => {
  it('extracts trimmed text from user content blocks', () => {
    expect(
      extractUserContent([
        { type: 'text', text: ' hello ' },
        { type: 'text', text: 'world' },
      ]).text,
    ).toBe('hello \nworld');
  });

  it('extracts valid images with captions and skips invalid images', () => {
    expect(
      extractUserContent([
        { type: 'image', mimeType: 'image/png', data: tinyPng, name: ' diagram.png ' },
        { type: 'image', mimeType: 'text/plain', data: tinyPng },
      ]).images,
    ).toEqual([
      {
        alt: 'Attached image: diagram.png',
        caption: 'diagram.png',
        mimeType: 'image/png',
        src: `data:image/png;base64,${tinyPng}`,
      },
    ]);
  });
});
