import { buildUserMessageTitle } from './sessionNaming.js';
import { extractUserContent } from './sessionUserContent.js';

export function extractTitleFromMessage(message: { role: string; content?: unknown }): string | null {
  if (message.role !== 'user') {
    return null;
  }

  const { text, images } = extractUserContent(message.content);
  return buildUserMessageTitle({ text, imageCount: images.length });
}
