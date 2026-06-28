import React, { Children, cloneElement, isValidElement, memo, type ReactElement, type ReactNode, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { type ParsedSkillBlock, parseSkillBlock } from '../../markdown/markdownExtensions';
import { extractMarkdownTextContent, InlineMarkdownCode } from '../MarkdownInlineCode';
import { Checkbox, cx, Disclosure, InlineCode, InlineCodeButton } from '../ui';
import {
  looksLikeTranscriptPath,
  normalizeTranscriptPathTarget,
  readKnowledgeBaseFileIdFromPath,
  trimTranscriptPathToken,
} from './transcriptPathLinks.js';

// ── Markdown renderer ─────────────────────────────────────────────────────────

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks];

function MentionPill({ text }: { text: string }) {
  return <span className="ui-markdown-mention">{text}</span>;
}

type EnhancedTextFragment = {
  text: string;
  kind: 'text' | 'mention' | 'commit' | 'knowledge-file' | 'file-path';
  fileId?: string;
  targetPath?: string;
};

function looksLikeCommitHash(value: string): boolean {
  const normalized = value.trim();
  return /^[a-f0-9]{7,64}$/i.test(normalized) && /[a-f]/i.test(normalized);
}

function CommitHashButton({ hash, onOpenCheckpoint }: { hash: string; onOpenCheckpoint?: (checkpointId: string) => void }) {
  if (!onOpenCheckpoint) {
    return <InlineCode>{hash}</InlineCode>;
  }

  return (
    <InlineCodeButton
      onClick={() => onOpenCheckpoint(hash)}
      aria-label={`Open diff for commit ${hash}`}
      title={`Open diff for commit ${hash}`}
    >
      {hash}
    </InlineCodeButton>
  );
}

function KnowledgeFileLink({ path, fileId, onOpenFilePath }: { path: string; fileId: string; onOpenFilePath?: (path: string) => void }) {
  if (!onOpenFilePath) {
    return <React.Fragment>{path}</React.Fragment>;
  }

  const href = `/knowledge?file=${encodeURIComponent(fileId)}`;

  return (
    <a
      href={href}
      className="font-mono text-[0.82em] text-accent underline decoration-accent/35 underline-offset-2 transition-colors hover:decoration-accent"
      title={`Open ${fileId} in Knowledge`}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return;
        }

        event.preventDefault();
        onOpenFilePath(`/knowledge-base/repo/${fileId}`);
      }}
    >
      {path}
    </a>
  );
}

function FilePathLink({ path, targetPath, onOpenFilePath }: { path: string; targetPath: string; onOpenFilePath?: (path: string) => void }) {
  if (!onOpenFilePath) {
    return <React.Fragment>{path}</React.Fragment>;
  }

  return (
    <a
      href={`file://${encodeURI(targetPath)}`}
      className="font-mono text-[0.82em] text-accent underline decoration-accent/35 underline-offset-2 transition-colors hover:decoration-accent"
      title={`Open ${targetPath}`}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return;
        }

        event.preventDefault();
        onOpenFilePath(targetPath);
      }}
    >
      {path}
    </a>
  );
}

function splitEnhancedTextFragments(text: string): EnhancedTextFragment[] {
  const fragments: EnhancedTextFragment[] = [];
  const tokenRegex =
    /\/[^\s`<>]*knowledge-base\/repo\/[^\s`<>]+|(?:~?\/|\.{1,2}\/)[^\s`<>]+|[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)+(?::\d+(?::\d+)?)?|@[A-Za-z0-9_][A-Za-z0-9_./-]*|[A-Fa-f0-9]{7,64}/g;
  let cursor = 0;
  let match: RegExpExecArray | null = null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const rawToken = match[0];
    const start = match.index;
    const previous = start > 0 ? text[start - 1] : '';

    const knowledgeFileId = rawToken.startsWith('/') ? readKnowledgeBaseFileIdFromPath(rawToken) : null;
    if (knowledgeFileId) {
      const path = trimTranscriptPathToken(rawToken);
      if (start > cursor) {
        fragments.push({ text: text.slice(cursor, start), kind: 'text' });
      }

      fragments.push({ text: path, kind: 'knowledge-file', fileId: knowledgeFileId });
      cursor = start + path.length;
      continue;
    }

    if (looksLikeTranscriptPath(rawToken)) {
      const path = trimTranscriptPathToken(rawToken);
      const targetPath = normalizeTranscriptPathTarget(path);
      if (start > cursor) {
        fragments.push({ text: text.slice(cursor, start), kind: 'text' });
      }

      fragments.push({ text: path, kind: 'file-path', targetPath });
      cursor = start + path.length;
      continue;
    }

    if (rawToken.startsWith('@')) {
      const mention = trimTranscriptPathToken(rawToken);
      const end = start + mention.length;
      const shouldSkip = start > 0 && /[\w./+-]/.test(previous);

      if (shouldSkip || mention === '@') {
        continue;
      }

      if (start > cursor) {
        fragments.push({ text: text.slice(cursor, start), kind: 'text' });
      }

      fragments.push({ text: mention, kind: 'mention' });
      cursor = end;
      continue;
    }

    const end = start + rawToken.length;
    const next = end < text.length ? text[end] : '';
    const shouldSkip =
      (start > 0 && /[\w./+-]/.test(previous)) || (end < text.length && /[\w./+-]/.test(next)) || !looksLikeCommitHash(rawToken);

    if (shouldSkip) {
      continue;
    }

    if (start > cursor) {
      fragments.push({ text: text.slice(cursor, start), kind: 'text' });
    }

    fragments.push({ text: rawToken, kind: 'commit' });
    cursor = end;
  }

  if (cursor < text.length) {
    fragments.push({ text: text.slice(cursor), kind: 'text' });
  }

  return fragments;
}

function renderEnhancedTextFragments(
  text: string,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
): ReactNode[] {
  return splitEnhancedTextFragments(text).map((fragment, index) => {
    if (fragment.kind === 'mention') {
      return <MentionPill key={`${fragment.text}-${index}`} text={fragment.text} />;
    }

    if (fragment.kind === 'commit') {
      return <CommitHashButton key={`${fragment.text}-${index}`} hash={fragment.text} onOpenCheckpoint={options?.onOpenCheckpoint} />;
    }

    if (fragment.kind === 'knowledge-file' && fragment.fileId) {
      return (
        <KnowledgeFileLink
          key={`${fragment.text}-${index}`}
          path={fragment.text}
          fileId={fragment.fileId}
          onOpenFilePath={options?.onOpenFilePath}
        />
      );
    }

    if (fragment.kind === 'file-path' && fragment.targetPath && options?.validatedFilePathTargets?.has(fragment.targetPath)) {
      return (
        <FilePathLink
          key={`${fragment.text}-${index}`}
          path={fragment.text}
          targetPath={fragment.targetPath}
          onOpenFilePath={options?.onOpenFilePath}
        />
      );
    }

    return <React.Fragment key={`${index}-${fragment.text}`}>{fragment.text}</React.Fragment>;
  });
}

function getMarkdownTagName(node: ReactNode): string | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as { node?: { tagName?: string } };
  if (typeof props.node?.tagName === 'string') {
    return props.node.tagName;
  }

  return typeof node.type === 'string' ? node.type : null;
}

function findMarkdownCodeElement(node: ReactNode): ReactElement<{ className?: string; children?: ReactNode }> | null {
  if (!isValidElement(node)) {
    return null;
  }

  if (getMarkdownTagName(node) === 'code') {
    return node as ReactElement<{ className?: string; children?: ReactNode }>;
  }

  const props = node.props as { children?: ReactNode };
  if (props.children === undefined) {
    return null;
  }

  for (const child of Children.toArray(props.children)) {
    const codeElement = findMarkdownCodeElement(child);
    if (codeElement) {
      return codeElement;
    }
  }

  return null;
}

function extractMarkdownCodeBlock(children: ReactNode): { className?: string; content: string } {
  for (const child of Children.toArray(children)) {
    const codeElement = findMarkdownCodeElement(child);
    if (!codeElement) {
      continue;
    }

    const props = codeElement.props as { className?: string; children?: ReactNode };
    return {
      className: props.className,
      content: extractMarkdownTextContent(props.children).replace(/\n$/, ''),
    };
  }

  return { content: extractMarkdownTextContent(children).replace(/\n$/, '') };
}

function renderChildrenWithEnhancements(
  children: ReactNode,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      return <React.Fragment key={index}>{renderEnhancedTextFragments(child, options)}</React.Fragment>;
    }

    if (typeof child === 'number' || typeof child === 'bigint') {
      return child;
    }

    if (!isValidElement(child)) {
      return child;
    }

    const tagName = getMarkdownTagName(child);
    if (tagName && ['a', 'code', 'pre'].includes(tagName)) {
      return child;
    }

    const props = child.props as { children?: ReactNode };
    if (props.children === undefined) {
      return child;
    }

    return cloneElement(
      child as ReactElement<{ children?: ReactNode }>,
      undefined,
      renderChildrenWithEnhancements(props.children, options),
    );
  });
}

function MarkdownCodeBlock({ children }: { children: ReactNode }) {
  const { content } = extractMarkdownCodeBlock(children);

  return (
    <div className="ui-markdown-code-block">
      <pre className="whitespace-pre-wrap break-all">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MarkdownInlineCodeWithCommitHash({
  className,
  children,
  onOpenCheckpoint,
  onOpenFilePath,
  validatedFilePathTargets,
}: {
  className?: string;
  children?: ReactNode;
  onOpenCheckpoint?: (checkpointId: string) => void;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
}) {
  const content = extractMarkdownTextContent(children).replace(/\n$/, '');
  const isBlock = content.includes('\n') || Boolean(className?.includes('language-'));

  if (!isBlock && looksLikeCommitHash(content)) {
    return <CommitHashButton hash={content} onOpenCheckpoint={onOpenCheckpoint} />;
  }

  const knowledgeFileId = !isBlock ? readKnowledgeBaseFileIdFromPath(content) : null;
  if (knowledgeFileId && onOpenFilePath) {
    return <KnowledgeFileLink path={content} fileId={knowledgeFileId} onOpenFilePath={onOpenFilePath} />;
  }

  if (!isBlock && onOpenFilePath && looksLikeTranscriptPath(content)) {
    const targetPath = normalizeTranscriptPathTarget(content);
    if (validatedFilePathTargets?.has(targetPath)) {
      return <FilePathLink path={content} targetPath={targetPath} onOpenFilePath={onOpenFilePath} />;
    }
  }

  return <InlineMarkdownCode className={className}>{children}</InlineMarkdownCode>;
}

const MarkdownText = memo(function MarkdownText({
  text,
  onOpenFilePath,
  onOpenCheckpoint,
  validatedFilePathTargets,
}: {
  text: string;
  onOpenFilePath?: (path: string) => void;
  onOpenCheckpoint?: (checkpointId: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
}) {
  const footnoteId = useId();
  const footnotePrefix = `chat-${footnoteId.replace(/[^a-zA-Z0-9_-]+/g, '-')}-`;

  return (
    <div className="ui-markdown">
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        remarkRehypeOptions={{ clobberPrefix: footnotePrefix }}
        components={{
          h1: ({ children, node: _node, ...props }) => (
            <h1 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h1>
          ),
          h2: ({ children, node: _node, ...props }) => (
            <h2 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h2>
          ),
          h3: ({ children, node: _node, ...props }) => (
            <h3 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h3>
          ),
          h4: ({ children, node: _node, ...props }) => (
            <h4 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h4>
          ),
          h5: ({ children, node: _node, ...props }) => (
            <h5 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h5>
          ),
          h6: ({ children, node: _node, ...props }) => (
            <h6 {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</h6>
          ),
          p: ({ children, node: _node, ...props }) => (
            <p {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</p>
          ),
          li: ({ children, node: _node, ...props }) => (
            <li {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</li>
          ),
          th: ({ children, node: _node, ...props }) => (
            <th {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</th>
          ),
          td: ({ children, node: _node, ...props }) => (
            <td {...props}>{renderChildrenWithEnhancements(children, { onOpenFilePath, onOpenCheckpoint, validatedFilePathTargets })}</td>
          ),
          a: ({ href, children, title }) => {
            if (typeof href !== 'string' || href.trim().length === 0) {
              return <span title={title}>{children}</span>;
            }

            if (href.startsWith('#')) {
              return (
                <a href={href} title={title}>
                  {children}
                </a>
              );
            }

            const isExternal = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
            if (!isExternal) {
              return <span title={title}>{children}</span>;
            }

            return (
              <a href={href} title={title} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-3 min-w-0 max-w-full overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <MarkdownCodeBlock>{children}</MarkdownCodeBlock>,
          code: ({ className, children }) => (
            <MarkdownInlineCodeWithCommitHash
              className={className}
              onOpenFilePath={onOpenFilePath}
              onOpenCheckpoint={onOpenCheckpoint}
              validatedFilePathTargets={validatedFilePathTargets}
            >
              {children}
            </MarkdownInlineCodeWithCommitHash>
          ),
          img: ({ src, alt, title }) =>
            src ? <img src={src} alt={alt ?? ''} title={title} loading="lazy" /> : <span className="text-dim">{alt ?? 'image'}</span>,
          input: ({ type, checked }) => {
            if (type === 'checkbox') {
              return (
                <Checkbox
                  checked={Boolean(checked)}
                  disabled
                  readOnly
                  className="mr-2 translate-y-[1px] accent-[rgb(var(--color-accent))]"
                />
              );
            }

            return (
              <>
                {/* ui-pattern-ok raw-control reason="ReactMarkdown may emit non-checkbox input types from user-authored markdown; unknown renderer fallbacks stay inert and disabled." */}
                <input type={type} checked={checked} readOnly disabled />
              </>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export function renderMarkdownText(
  text: string,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
) {
  return (
    <MarkdownText
      text={text}
      onOpenFilePath={options?.onOpenFilePath}
      onOpenCheckpoint={options?.onOpenCheckpoint}
      validatedFilePathTargets={options?.validatedFilePathTargets}
    />
  );
}

export function prepareStreamingMarkdownText(text: string): string {
  const lines = text.split('\n');
  let openFence: { marker: string; length: number } | null = null;

  for (const line of lines) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!match) {
      continue;
    }

    const marker = match[1] ?? '';
    const markerChar = marker[0] ?? '`';
    if (!openFence) {
      openFence = { marker: markerChar, length: marker.length };
      continue;
    }

    if (markerChar === openFence.marker && marker.length >= openFence.length) {
      openFence = null;
    }
  }

  if (!openFence) {
    return text;
  }

  const closingFence = openFence.marker.repeat(openFence.length);
  return `${text}${text.endsWith('\n') ? '' : '\n'}${closingFence}`;
}

export function renderStreamingMarkdownText(
  text: string,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
) {
  return renderMarkdownText(prepareStreamingMarkdownText(text), options);
}

function parseSkillContentSections(content: string): { relativeTo: string | null; body: string } {
  const match = content.match(/^References are relative to (.+?)\.\n\n([\s\S]*)$/);
  if (!match) {
    return { relativeTo: null, body: content.trim() };
  }

  return {
    relativeTo: match[1] ?? null,
    body: (match[2] ?? '').trim(),
  };
}

export function SkillInvocationCard({
  skillBlock,
  className,
  onOpenFilePath,
  validatedFilePathTargets,
}: {
  skillBlock: ParsedSkillBlock;
  className?: string;
  onOpenFilePath?: (path: string) => void;
  validatedFilePathTargets?: ReadonlySet<string>;
}) {
  const { relativeTo, body } = parseSkillContentSections(skillBlock.content);

  return (
    <Disclosure
      className={cx('ui-skill-invocation', className)}
      summaryClassName="ui-skill-invocation-summary"
      bodyClassName="ui-skill-invocation-body"
      summary={
        <>
          <span className="ui-skill-invocation-label">skill</span>
          <span className="ui-skill-invocation-name">{skillBlock.name}</span>
        </>
      }
    >
      {relativeTo && <p className="ui-skill-invocation-meta">References resolve relative to {relativeTo}</p>}
      {renderMarkdownText(`**${skillBlock.name}**\n\n${body}`, { onOpenFilePath, validatedFilePathTargets })}
    </Disclosure>
  );
}

function renderSkillAwareText(
  text: string,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
) {
  const skillBlock = parseSkillBlock(text);
  if (!skillBlock) {
    return renderMarkdownText(text, options);
  }

  return (
    <div className="space-y-3">
      <SkillInvocationCard
        skillBlock={skillBlock}
        onOpenFilePath={options?.onOpenFilePath}
        validatedFilePathTargets={options?.validatedFilePathTargets}
      />
      {skillBlock.userMessage && renderMarkdownText(skillBlock.userMessage, options)}
    </div>
  );
}

export function renderText(
  text: string,
  options?: {
    onOpenFilePath?: (path: string) => void;
    onOpenCheckpoint?: (checkpointId: string) => void;
    validatedFilePathTargets?: ReadonlySet<string>;
  },
) {
  return renderSkillAwareText(text, options);
}
