import { normalizeContent } from './sessionContent.js';
import { extractUserContent } from './sessionUserContent.js';

export function extractSearchTextFromMessage(message: { role: string; content?: unknown }): string {
  if (message.role === 'user') {
    return extractUserContent(message.content).text;
  }

  if (message.role !== 'assistant') {
    return '';
  }

  return normalizeContent(message.content)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
}
