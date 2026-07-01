import { InlineMeta, Pill, Spinner, TextButton, ToolResultCard } from '@neon-pilot/extensions/ui';
import { memo } from 'react';

const BROWSER_TOOL_LABELS: Record<string, string> = {
  browser_snapshot: 'Browser snapshot',
  browser_cdp: 'Browser action',
  browser_screenshot: 'Browser screenshot',
};

function readBrowserUrl(block: { input?: unknown; details?: unknown }): string | null {
  const details =
    block.details && typeof block.details === 'object' ? (block.details as { url?: unknown; state?: { url?: unknown } }) : null;
  const input = block.input && typeof block.input === 'object' ? (block.input as { command?: unknown }) : null;

  if (typeof details?.url === 'string' && details.url.trim()) {
    return details.url.trim();
  }
  if (typeof details?.state?.url === 'string' && details.state.url.trim()) {
    return details.state.url.trim();
  }
  if (input?.command && typeof input.command === 'object' && !Array.isArray(input.command)) {
    const command = input.command as { method?: unknown; params?: { url?: unknown } };
    if (command.method === 'Page.navigate' && typeof command.params?.url === 'string' && command.params.url.trim()) {
      return command.params.url.trim();
    }
  }
  return null;
}

export const BrowserToolBlock = memo(function BrowserToolBlock({
  block,
  onOpenBrowser,
}: {
  block: {
    tool: string;
    status?: string;
    running?: boolean;
    error?: boolean | string;
    output?: string;
    input?: unknown;
    details?: unknown;
  };
  onOpenBrowser?: () => void;
}) {
  const isRunning = block.status === 'running' || !!block.running;
  const isError = block.status === 'error' || !!block.error;
  const url = readBrowserUrl(block);
  const title = BROWSER_TOOL_LABELS[block.tool] ?? 'Browser tool';

  return (
    <ToolResultCard
      tone={isError ? 'danger' : 'neutral'}
      title={title}
      badges={
        <Pill tone={isError ? 'danger' : 'teal'} mono>
          browser
        </Pill>
      }
      meta={url ? <span className="font-mono text-secondary">{url}</span> : undefined}
      body={
        isError && block.output ? block.output : 'The agent used the Workbench Browser. Open it when you want to see or control the page.'
      }
      actions={
        isRunning ? (
          <InlineMeta>
            <Spinner />
            using browser…
          </InlineMeta>
        ) : (
          <TextButton type="button" onClick={() => onOpenBrowser?.()} disabled={!onOpenBrowser} tone="accent">
            Open browser
          </TextButton>
        )
      }
    />
  );
});
