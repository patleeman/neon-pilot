import { Children, isValidElement, type ReactNode } from 'react';

import { InlineCode } from './ui';

export function extractMarkdownTextContent(children: ReactNode): string {
  let text = '';

  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number' || typeof child === 'bigint') {
      text += String(child);
      return;
    }

    if (!isValidElement(child)) {
      return;
    }

    const props = child.props as { children?: ReactNode };
    if (props.children !== undefined) {
      text += extractMarkdownTextContent(props.children);
    }
  });

  return text;
}

export function InlineMarkdownCode({
  className,
  children,
  inlineCodeClassName,
}: {
  className?: string;
  children?: ReactNode;
  inlineCodeClassName?: string;
}) {
  const content = extractMarkdownTextContent(children).replace(/\n$/, '');
  const isBlock = content.includes('\n') || Boolean(className?.includes('language-'));

  if (!isBlock) {
    return <InlineCode className={inlineCodeClassName}>{content}</InlineCode>;
  }

  return <code className={className}>{content}</code>;
}
