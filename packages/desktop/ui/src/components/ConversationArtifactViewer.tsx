import { useMemo } from 'react';

import type { ConversationArtifactRecord } from '../shared/types';
import { CodeBlock, ErrorState, SectionLabel } from './ui';

function buildArtifactDocument(content: string): string {
  const trimmed = content.trim();
  const looksLikeHtmlDocument = /^<!doctype\s+html|<html[\s>]/i.test(trimmed);
  if (looksLikeHtmlDocument) {
    return trimmed;
  }

  return [
    '<!doctype html>',
    '<html>',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <style>',
    '      :root { color-scheme: light dark; }',
    '      body { margin: 0; padding: 24px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '    </style>',
    '  </head>',
    '  <body>',
    content,
    '  </body>',
    '</html>',
  ].join('\n');
}

function HtmlArtifactViewer({ artifact }: { artifact: ConversationArtifactRecord }) {
  const srcDoc = useMemo(() => buildArtifactDocument(artifact.content), [artifact.content]);

  return (
    <iframe
      title={artifact.title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className="wos-composited-frame h-full w-full border-0 bg-white"
    />
  );
}

function SourceArtifactViewer({ artifact, label }: { artifact: ConversationArtifactRecord; label: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-5 py-5">
      <div className="mb-3 min-w-0">
        <SectionLabel>{label}</SectionLabel>
        <p className="mt-1 text-[12px] leading-relaxed text-secondary">
          The system-artifacts extension owns rendered artifact previews. Core fallback shows source.
        </p>
      </div>

      <CodeBlock>{artifact.content}</CodeBlock>
    </div>
  );
}

export function ConversationArtifactViewer({ artifact }: { artifact: ConversationArtifactRecord }) {
  switch (artifact.kind) {
    case 'html':
      return <HtmlArtifactViewer artifact={artifact} />;
    case 'mermaid':
      return <SourceArtifactViewer artifact={artifact} label="Mermaid source" />;
    case 'latex':
      return <SourceArtifactViewer artifact={artifact} label="LaTeX source" />;
    default:
      return <ErrorState message={`Unsupported artifact kind: ${artifact.kind}`} className="px-4 py-4" />;
  }
}
